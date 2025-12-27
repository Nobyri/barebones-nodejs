// manual-run.mjs - 手動実行スクリプト
import { handler } from '../src/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resultDir = path.join(__dirname, '../result');

const testEvent = {
  body: JSON.stringify({
    user_id: 'sDaGZvbV',
    password: 'ARjAq3vT',
    service_id: 'S96783982',
    year_month: '2025-10'
  })
};

console.log('Running NURO Invoice Handler manually...\n');

try {
  const response = await handler(testEvent);
  
  console.log('Status Code:', response.statusCode);
  console.log('Headers:', JSON.stringify(response.headers, null, 2));
  console.log('Is Base64:', response.isBase64Encoded);
  
  if (response.statusCode === 200 && response.isBase64Encoded) {
    // Base64をデコードしてPDFファイルとして保存
    const pdfBuffer = Buffer.from(response.body, 'base64');
    const fileName = response.headers['Content-Disposition']?.match(/filename="(.+)"/)?.[1] || 'invoice.pdf';

    // resultディレクトリが存在しない場合は作成
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }

    const filePath = path.join(resultDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);
    console.log(`\n✅ PDF saved: ${filePath}`);
    console.log(`   File size: ${pdfBuffer.length} bytes`);
  } else {
    // エラーレスポンスの場合
    console.log('\n❌ Error Response:');
    console.log(response.body);
  }
} catch (error) {
  console.error('Test failed:', error);
}