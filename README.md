# rout-management

ゴミ収支管理アプリ。設計フェーズでは `public/mockup.html` の静的な画面モックアップのみを公開する。

- 設計ドキュメント: Obsidian `ゴミ収支管理アプリ/_docks/`
- Basic認証: Vercel の環境変数 `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` を設定して有効化（`.env.example` 参照）
- アノテーション機能: モックアップ画面上でレビュアーがコメントピンを残せる（`app/api/annotations/route.js`）。Neon Postgresの `DATABASE_URL` を設定すると有効化。未設定の間は機能が自動的に無効化される

## ローカル起動

```
npm install
npm run dev
```
