// debug-login.mjs - ログインAPIのレスポンスを確認
const loginResponse = await fetch('https://api.c.nuro.jp/auth-api/api/v2/authn/mypage/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 'sDaGZvbV',
    password: 'ARjAq3vT'
  })
});

console.log('Status:', loginResponse.status);
console.log('Status Text:', loginResponse.statusText);
console.log('Headers:', Object.fromEntries(loginResponse.headers.entries()));

const responseText = await loginResponse.text();
console.log('\nResponse Body:');
console.log(responseText);

try {
  const json = JSON.parse(responseText);
  console.log('\nParsed JSON:');
  console.log(JSON.stringify(json, null, 2));

  if (json.credentials) {
    console.log('\n✅ Credentials found!');
  } else {
    console.log('\n❌ No credentials in response');
    console.log('Keys in response:', Object.keys(json));
  }
} catch (e) {
  console.log('\nNot valid JSON');
}
