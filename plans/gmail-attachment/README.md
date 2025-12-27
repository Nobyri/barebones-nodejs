# Gmail添付ファイル取得Lambda関数

## 概要

Gmail APIを使用してメールの添付ファイルを取得するLambda関数です。
特定の送信者や件名でメールをフィルタし、添付ファイルをBase64形式で取得できます。

## デプロイ済みAPI情報

| 項目 | 値 |
|------|-----|
| Endpoint | `https://tk8qbp0jw2.execute-api.ap-northeast-1.amazonaws.com/Prod/gmail/attachments` |
| Method | POST |
| API Key Header | `x-api-key` |
| リージョン | ap-northeast-1 |

### 使用例

```bash
curl -X POST \
  https://tk8qbp0jw2.execute-api.ap-northeast-1.amazonaws.com/Prod/gmail/attachments \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from": "billing@example.com", "max_messages": 5}'
```

### APIキーの取得

```bash
aws apigateway get-api-key --api-key zhh1ei9ed1 --include-value --region ap-northeast-1 --query 'value' --output text
```

## ディレクトリ構成

```
functions/gmail-attachment/
├── index.mjs                    # エントリーポイント
├── src/
│   └── index.mjs                # メインハンドラー
├── tests/
│   ├── manual-run.mjs           # 手動実行スクリプト
│   └── setup-oauth.mjs          # OAuth初期設定用スクリプト
├── result/                      # テスト出力（gitignore対象）
├── template.yaml                # SAMテンプレート
└── package.json
```

## 依存関係

```json
{
  "@aws-sdk/client-secrets-manager": "^3.x",
  "googleapis": "^140.0.0"
}
```

## 処理フロー（4ステップ）

1. **Secrets Manager認証情報取得** - OAuth2クレデンシャルを取得
2. **アクセストークン取得** - refresh_tokenからaccess_tokenを取得
3. **メール検索** - フィルタ条件でメール一覧を取得
4. **添付ファイル取得** - 各メールから添付ファイルをダウンロード

## Secrets Manager構造

**シークレット名:** `gmail-oauth-credentials`

```json
{
  "client_id": "xxxxx.apps.googleusercontent.com",
  "client_secret": "GOCSPX-xxxxx",
  "refresh_token": "1//0xxxxx"
}
```

## 入出力フォーマット

**入力:**
```json
{
  "body": "{\"from\": \"sender@example.com\", \"subject\": \"請求書\", \"max_messages\": 5}"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| from | string | いずれか必須 | 送信者フィルタ |
| subject | string | いずれか必須 | 件名フィルタ |
| max_messages | number | No | 最大取得件数（デフォルト: 10） |
| message_id | string | No | 特定メールID指定 |

**出力:**
```json
{
  "statusCode": 200,
  "body": "{\"attachments\": [{\"message_id\": \"xxx\", \"filename\": \"invoice.pdf\", \"mime_type\": \"application/pdf\", \"size\": 12345, \"data_base64\": \"...\"}]}"
}
```

## 実装ステップ

### Step 1: プロジェクト構造作成
- [x] `functions/gmail-attachment/` ディレクトリ作成
- [x] `package.json` 作成
- [x] `index.mjs` エントリーポイント作成

### Step 2: メインハンドラー実装 (`src/index.mjs`)
- [x] 入力バリデーション
- [x] Secrets Manager連携
- [x] OAuth2認証（googleapis使用）
- [x] Gmail APIメッセージ検索
- [x] 添付ファイル取得
- [x] エラーハンドリング

### Step 3: テストスクリプト作成
- [x] `tests/manual-run.mjs` 作成
- [x] `tests/setup-oauth.mjs` 作成（初回トークン取得用）

### Step 4: SAMテンプレート作成
- [x] `template.yaml` 作成
- [x] Secrets Manager IAMポリシー設定
- [x] API Gateway設定

### Step 5: デプロイ
- [x] SAMビルド・デプロイ完了
- [x] API Gateway動作確認済み

## 変更対象ファイル

**新規作成:**
- `functions/gmail-attachment/package.json`
- `functions/gmail-attachment/index.mjs`
- `functions/gmail-attachment/src/index.mjs`
- `functions/gmail-attachment/tests/manual-run.mjs`
- `functions/gmail-attachment/tests/setup-oauth.mjs`
- `functions/gmail-attachment/template.yaml`

**変更:**
- `.gitignore` - `functions/gmail-attachment/result/` 追加

## 注意事項

- Gmail APIはURL-safe Base64を返すため、標準Base64への変換が必要
- Lambdaレスポンス上限6MBのため、大きな添付ファイルは別対応が必要
- Gmail APIのレート制限に注意（429エラー時のリトライ実装推奨）

---

## OAuth2セットアップ手順（事前準備）

### 1. Google Cloud Consoleでプロジェクト作成
1. https://console.cloud.google.com/ にアクセス
2. 新しいプロジェクトを作成（例: `gmail-attachment-lambda`）

### 2. Gmail APIを有効化
1. 「APIとサービス」→「ライブラリ」
2. 「Gmail API」を検索して有効化

### 3. OAuth同意画面の設定
1. 「APIとサービス」→「OAuth同意画面」
2. ユーザータイプ: 「外部」を選択
3. アプリ名、サポートメールを入力
4. スコープ追加: `https://www.googleapis.com/auth/gmail.readonly`
5. テストユーザーに自分のGmailアドレスを追加

### 4. OAuth2クレデンシャル作成
1. 「APIとサービス」→「認証情報」
2. 「認証情報を作成」→「OAuthクライアントID」
3. アプリケーションの種類: 「デスクトップアプリ」
4. 作成後、`client_id`と`client_secret`をメモ

### 5. refresh_tokenの取得
環境変数を設定してスクリプトを実行:
```bash
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
node tests/setup-oauth.mjs
```

### 6. AWS Secrets Managerに保存
```bash
aws secretsmanager create-secret \
  --name gmail-oauth-credentials \
  --secret-string '{"client_id":"xxx","client_secret":"xxx","refresh_token":"xxx"}'
```
