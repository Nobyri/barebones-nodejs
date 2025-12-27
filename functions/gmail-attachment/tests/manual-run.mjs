/**
 * Gmail Attachment Lambda 手動実行スクリプト
 *
 * 使い方:
 * 1. AWS認証情報が設定されていることを確認
 * 2. Secrets Managerにgmail-oauth-credentialsが登録済みであること
 * 3. node tests/manual-run.mjs を実行
 */

import { handler } from '../src/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resultDir = path.join(__dirname, '../result');

// ===== テストパラメータを設定 =====
const testEvent = {
  body: JSON.stringify({
    // フィルタ条件（いずれか必須）
    from: 'billing@jetbrains.com',  // 送信者でフィルタ
    // subject: '請求書',          // 件名でフィルタ
    // message_id: 'xxxxx',        // 特定のメッセージID

    // オプション
    max_messages: 5               // 最大取得件数
  })
};
// ==================================

console.log('========================================');
console.log('Gmail Attachment Lambda - 手動実行');
console.log('========================================\n');
console.log('テストイベント:', testEvent.body);
console.log('\n実行中...\n');

try {
  const response = await handler(testEvent);

  console.log('Status Code:', response.statusCode);
  console.log('Headers:', response.headers);

  const body = JSON.parse(response.body);

  if (response.statusCode === 200) {
    console.log(`\nスキャンしたメッセージ数: ${body.total_messages_scanned}`);
    console.log(`見つかった添付ファイル数: ${body.total_attachments}`);

    if (body.attachments?.length > 0) {
      // 結果ディレクトリを作成
      if (!fs.existsSync(resultDir)) {
        fs.mkdirSync(resultDir, { recursive: true });
      }

      console.log('\n--- 添付ファイル一覧 ---');
      for (const attachment of body.attachments) {
        console.log(`\n- ファイル名: ${attachment.filename}`);
        console.log(`  MIME Type: ${attachment.mime_type}`);
        console.log(`  サイズ: ${attachment.size} bytes`);
        console.log(`  メッセージID: ${attachment.message_id}`);

        // ファイルを保存
        const buffer = Buffer.from(attachment.data_base64, 'base64');
        const filePath = path.join(resultDir, `${attachment.message_id}_${attachment.filename}`);
        fs.writeFileSync(filePath, buffer);
        console.log(`  保存先: ${filePath}`);
      }

      console.log('\n========================================');
      console.log(`${body.attachments.length} 個のファイルを result/ に保存しました`);
      console.log('========================================\n');
    } else {
      console.log('\n添付ファイルが見つかりませんでした');
    }
  } else {
    console.log('\nエラーレスポンス:');
    console.log(JSON.stringify(body, null, 2));
  }

} catch (error) {
  console.error('\n実行エラー:', error);
}
