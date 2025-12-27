import { handler } from './index.mjs';

const testEvent = {
  body: JSON.stringify({
    user_id: "sDaGZvbV",
    password: "ARjAq3vT",
    service_id: "S96783982",
    year_month: "2025-11"
  })
};

const result = await handler(testEvent);
const body = JSON.parse(result.body);

// Base64をデコードして中身を確認
const decoded = Buffer.from(body.pdf_base64, 'base64').toString('utf-8');
console.log('Decoded response:');
console.log(decoded);
