// Gmail Attachment Lambda Handler
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { google } from 'googleapis';

const SECRETS_NAME = process.env.SECRETS_NAME || 'gmail-oauth-credentials';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

/**
 * Secrets ManagerからOAuth2認証情報を取得
 */
async function getOAuthCredentials() {
  const client = new SecretsManagerClient({ region: AWS_REGION });
  const command = new GetSecretValueCommand({ SecretId: SECRETS_NAME });
  const response = await client.send(command);
  return JSON.parse(response.SecretString);
}

/**
 * Gmail APIクライアントを初期化
 */
function createGmailClient(credentials) {
  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret
  );
  oauth2Client.setCredentials({
    refresh_token: credentials.refresh_token
  });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * 検索クエリを構築
 */
function buildSearchQuery({ from, subject, has_attachment = true }) {
  const queryParts = [];
  if (from) queryParts.push(`from:${from}`);
  if (subject) queryParts.push(`subject:${subject}`);
  if (has_attachment) queryParts.push('has:attachment');
  return queryParts.join(' ');
}

/**
 * メッセージから添付ファイルを取得
 */
async function getAttachmentsFromMessage(gmail, messageId) {
  const attachments = [];

  // メッセージ詳細を取得
  const message = await gmail.users.messages.get({
    userId: 'me',
    id: messageId
  });

  const parts = message.data.payload?.parts || [];

  // 添付ファイルパートを探索（ネストされたパートも対応）
  async function processParts(parts) {
    for (const part of parts) {
      // ネストされたパート（multipart）の場合
      if (part.parts) {
        await processParts(part.parts);
      }

      // 添付ファイルの場合
      if (part.filename && part.body?.attachmentId) {
        const attachment = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: messageId,
          id: part.body.attachmentId
        });

        // Gmail APIはURL-safe Base64を返すので標準Base64に変換
        const base64Data = attachment.data.data
          .replace(/-/g, '+')
          .replace(/_/g, '/');

        attachments.push({
          message_id: messageId,
          filename: part.filename,
          mime_type: part.mimeType,
          size: part.body.size,
          data_base64: base64Data
        });
      }
    }
  }

  await processParts(parts);
  return attachments;
}

/**
 * Lambda ハンドラー
 */
export const handler = async (event) => {
  try {
    // 入力パース
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
    const { from, subject, message_id, max_messages = 10 } = body;

    // バリデーション
    if (!from && !subject && !message_id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required filter',
          message: 'At least one of from, subject, or message_id must be provided'
        })
      };
    }

    // Step 1: Secrets ManagerからOAuth認証情報を取得
    console.log('Step 1: Getting OAuth credentials from Secrets Manager...');
    const credentials = await getOAuthCredentials();

    // Step 2: Gmail APIクライアントを初期化
    console.log('Step 2: Initializing Gmail API client...');
    const gmail = createGmailClient(credentials);

    let messageIds = [];

    // Step 3: メッセージを検索または指定されたIDを使用
    if (message_id) {
      console.log(`Step 3: Using specified message ID: ${message_id}`);
      messageIds = [message_id];
    } else {
      const query = buildSearchQuery({ from, subject });
      console.log(`Step 3: Searching messages with query: ${query}`);

      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: max_messages
      });

      messageIds = (listResponse.data.messages || []).map(m => m.id);
      console.log(`Found ${messageIds.length} messages`);
    }

    if (messageIds.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [],
          total_messages_scanned: 0,
          total_attachments: 0
        })
      };
    }

    // Step 4: 各メッセージから添付ファイルを取得
    console.log('Step 4: Fetching attachments from messages...');
    const allAttachments = [];

    for (const msgId of messageIds) {
      const attachments = await getAttachmentsFromMessage(gmail, msgId);
      allAttachments.push(...attachments);
    }

    console.log(`Total attachments found: ${allAttachments.length}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: allAttachments,
        total_messages_scanned: messageIds.length,
        total_attachments: allAttachments.length
      })
    };

  } catch (error) {
    console.error('Error:', error);

    // 認証エラー
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Authentication failed',
          message: 'Refresh token may be expired or revoked',
          details: error.message
        })
      };
    }

    // レート制限
    if (error.code === 429 || error.message?.includes('Rate Limit')) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Rate limited',
          message: 'Gmail API quota exceeded',
          details: error.message
        })
      };
    }

    // Secrets Manager エラー
    if (error.name === 'ResourceNotFoundException') {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Secrets retrieval failed',
          message: `Secret '${SECRETS_NAME}' not found`,
          details: error.message
        })
      };
    }

    // その他のエラー
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal error',
        message: error.message,
        stack: error.stack
      })
    };
  }
};
