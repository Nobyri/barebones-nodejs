# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

NURO光（NTT NURO）のAPIから請求書PDFを取得するNode.js製AWS Lambda関数です。AWS Signature V4を使用した3ステップの認証フローを実装しています。

## ディレクトリ構成

```
functions/nuro-invoice/
├── src/
│   └── index.mjs          # メインのLambdaハンドラー
├── tests/
│   ├── manual-run.mjs     # 手動実行スクリプト
│   └── debug.mjs          # デバッグスクリプト
├── result/                # テスト出力（gitignore対象）
└── package.json
```

## よく使うコマンド

```bash
# 依存関係のインストール
cd functions/nuro-invoice
npm install

# 関数を手動実行（PDFをresult/に保存）
node tests/manual-run.mjs

# デバッグスクリプトの実行
node tests/debug.mjs
```

## アーキテクチャ

Lambda関数は3ステップのフローを実装しています：

1. **認証** (src/index.mjs の 18-40行目)
   - `https://api.c.nuro.jp/auth-api/api/v2/authn/mypage/login` にPOST
   - AWS一時認証情報（access_key_id, access_secret, session_token）を取得

2. **AWS Signature V4 署名** (42-65行目)
   - `@aws-sdk/signature-v4` を使用してリクエストに署名
   - リージョン: `ap-northeast-1`
   - サービス: `execute-api`

3. **請求書取得** (67-111行目)
   - 署名済みヘッダーで請求書APIにGETリクエスト
   - Base64エンコードされたPDFを含むJSONが返却される（`data`フィールド）
   - LambdaはBase64形式でPDFをレスポンスボディに返却

## 入出力フォーマット

**Lambda イベント入力:**
```json
{
  "body": "{\"user_id\": \"...\", \"password\": \"...\", \"service_id\": \"...\", \"year_month\": \"YYYY-MM\"}"
}
```

**Lambda レスポンス:**
```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/pdf",
    "Content-Disposition": "attachment; filename=\"...\""
  },
  "isBase64Encoded": true,
  "body": "<base64-pdf-data>"
}
```

## 依存関係

- `@aws-sdk/signature-v4` - AWSリクエスト署名
- `@aws-crypto/sha256-js` - 署名用SHA256ハッシュ

## 開発環境

- ランタイム: Node.js 20
- Dev container（AWS CLIとAWS Toolkit拡張機能付き）
- 現在のブランチ: `feature/nuro-invoice`
