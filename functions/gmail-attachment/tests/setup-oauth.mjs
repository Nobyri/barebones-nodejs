/**
 * OAuth2 セットアップスクリプト
 *
 * このスクリプトを実行してrefresh_tokenを取得します。
 *
 * 使い方:
 * 1. 環境変数を設定:
 *    export GOOGLE_CLIENT_ID="your-client-id"
 *    export GOOGLE_CLIENT_SECRET="your-client-secret"
 * 2. node tests/setup-oauth.mjs を実行
 * 3. 表示されたURLをブラウザで開く
 * 4. Googleアカウントで認証
 * 5. リダイレクト後のURLから認証コードをコピー
 * 6. ターミナルに認証コードを入力
 * 7. 表示されたrefresh_tokenをAWS Secrets Managerに保存
 */

import { google } from 'googleapis';
import * as readline from 'readline';

// 環境変数から認証情報を取得
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('エラー: 環境変数が設定されていません。');
  console.error('以下のコマンドで設定してください:');
  console.error('  export GOOGLE_CLIENT_ID="your-client-id"');
  console.error('  export GOOGLE_CLIENT_SECRET="your-client-secret"');
  process.exit(1);
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// 認証URLを生成
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent' // 常にrefresh_tokenを取得するため
});

console.log('\n========================================');
console.log('Gmail OAuth2 セットアップ');
console.log('========================================\n');
console.log('1. 以下のURLをブラウザで開いてください:\n');
console.log(authUrl);
console.log('\n2. Googleアカウントで認証してください');
console.log('3. 認証後、表示される認証コードをコピーしてください\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('認証コードを入力してください: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());

    console.log('\n========================================');
    console.log('認証成功！');
    console.log('========================================\n');

    console.log('以下の情報をAWS Secrets Managerに保存してください:\n');

    const secretValue = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokens.refresh_token
    };

    console.log('Secret Value (JSON):');
    console.log(JSON.stringify(secretValue, null, 2));

    console.log('\n--- AWS CLI コマンド ---\n');
    console.log(`aws secretsmanager create-secret \\
  --name gmail-oauth-credentials \\
  --secret-string '${JSON.stringify(secretValue)}'`);

    console.log('\n既存のシークレットを更新する場合:');
    console.log(`aws secretsmanager update-secret \\
  --secret-id gmail-oauth-credentials \\
  --secret-string '${JSON.stringify(secretValue)}'`);

    console.log('\n========================================\n');

  } catch (error) {
    console.error('\nエラーが発生しました:', error.message);
    if (error.message.includes('invalid_grant')) {
      console.error('認証コードが無効または期限切れです。再度URLを開いてやり直してください。');
    }
  } finally {
    rl.close();
  }
});
