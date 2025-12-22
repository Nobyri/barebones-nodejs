# NURO Invoice Lambda

NURO光の請求書PDFを取得するAWS Lambda関数です。

## 機能

- NURO光マイページAPIから請求書PDFをダウンロード
- AWS Signature V4による認証
- API Gateway経由でHTTPSエンドポイントを提供
- iPhoneショートカットから呼び出し可能

## アーキテクチャ

```
クライアント（iPhone/Web）
    ↓ HTTPS POST (API Key認証)
API Gateway
    ↓
Lambda関数
    ├─ 1. NURO APIにログイン
    ├─ 2. AWS SigV4署名を生成
    └─ 3. 請求書PDFを取得
    ↓
Base64エンコードされたPDF
```

## 必要な環境

- AWS CLI（v2以上）
- AWS SAM CLI
- Node.js 20以上
- AWSアカウントと適切な権限

## セットアップ

### 1. 依存関係のインストール

```bash
cd functions/nuro-invoice
npm install
```

### 2. ローカルテスト

```bash
# 手動実行スクリプトで動作確認
npm test
# または
node tests/manual-run.mjs
```

PDFは `result/` ディレクトリに保存されます。

## デプロイ

### 初回デプロイ

```bash
cd functions/nuro-invoice

# ビルドとデプロイ（対話式）
npm run deploy
```

対話式プロンプトで以下を設定：
- Stack Name: `nuro-invoice-stack`（任意）
- AWS Region: `ap-northeast-1`（推奨）
- Confirm changes: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Save arguments to configuration: `Y`

### 2回目以降のデプロイ

```bash
# 設定を保存済みなので高速デプロイ
npm run deploy:fast
```

### デプロイ後の確認

デプロイが完了すると、以下の情報が表示されます：

```
Outputs
---------------------------------------------------------------
Key                 NuroInvoiceApi
Description         API Gateway endpoint URL for Prod stage
Value               https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/Prod/invoice

Key                 ApiKeyId
Description         API Key ID
Value               xxxxxxxxxx
```

### API Keyの取得

```bash
# API Keyの値を取得（上記のApiKeyIdを使用）
aws apigateway get-api-key --api-key <ApiKeyId> --include-value --query 'value' --output text
```

## 使い方

### cURLでのテスト

```bash
curl -X POST https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/Prod/invoice \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "user_id": "your_user_id",
    "password": "your_password",
    "service_id": "your_service_id",
    "year_month": "2024-12"
  }' \
  --output invoice.pdf
```

### iPhoneショートカットでの利用

1. ショートカットアプリで新規作成
2. 「辞書」アクションを追加し、以下のキーを設定：
   - `user_id`: テキスト
   - `password`: テキスト
   - `service_id`: テキスト
   - `year_month`: テキスト（YYYY-MM形式）

3. 「URLの内容を取得」アクションを追加：
   - URL: デプロイ時のAPI Gateway URL
   - メソッド: POST
   - ヘッダー:
     - `Content-Type`: `application/json`
     - `x-api-key`: 取得したAPI Key
   - 本文: 辞書（リクエストの本文）

4. レスポンスをファイルに保存またはクイックルックで表示

## ローカル開発

### SAM Localで起動

```bash
npm run local
```

`http://127.0.0.1:3000/invoice` でローカルテスト可能。

### ログの確認

```bash
npm run logs
```

## ディレクトリ構成

```
functions/nuro-invoice/
├── index.mjs           # Lambdaエントリポイント
├── src/
│   └── index.mjs       # メインハンドラー
├── tests/
│   ├── manual-run.mjs  # 手動実行スクリプト
│   └── debug.mjs       # デバッグスクリプト
├── result/             # テスト結果（gitignore）
├── template.yaml       # SAMテンプレート
├── package.json
└── README.md
```

## トラブルシューティング

### デプロイエラー

```bash
# ビルドキャッシュをクリア
rm -rf .aws-sam/
npm run build
```

### API Key認証エラー

- `x-api-key` ヘッダーが正しく設定されているか確認
- API Keyが有効になっているか確認

### タイムアウトエラー

- Lambdaのタイムアウト設定は30秒（template.yamlで変更可能）
- NURO APIのレスポンスが遅い場合は設定を調整

## セキュリティ

- API Keyは環境変数や秘密管理サービスで管理してください
- ユーザーIDとパスワードは通信時のみ使用され、保存されません
- API Gatewayのレート制限: 10 req/s、月間1000リクエスト

## ライセンス

ISC
