# Sanka Queue Manager ダウンロードページ

Astro 製の静的サイトを GitHub Pages で公開します。ページを開いた人のブラウザが GitHub の最新リリースを取得し、
OS を判別して適切なダウンロードボタンを出します。**新バージョンを出してもサイトの再公開は不要**です (常に最新を表示)。

## 公開手順 (1回だけ)
このフォルダ (`site/`) はアプリと同じリポジトリに入っています。公開用の設定は、リポジトリ直下の `.github/workflows/deploy-site.yml` です。
1. リポジトリを GitHub に push。
2. **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする。
3. `main` に push (または Actions の `deploy-site` を手動実行) すると、`https://<ユーザー名>.github.io/<リポジトリ名>/` に公開されます。
   - アプリのリリースが別のリポジトリにある場合だけ、**Settings → Secrets and variables → Actions → Variables** に `RELEASE_REPO` = `ユーザー名/リポジトリ名` を追加。

## 設定
- `src/config.ts` の `RELEASE_REPO`: アプリのリリースがある `owner/repo` (アプリの `package.json` の `build.publish` と同じ)。ビルド時に環境変数 `PUBLIC_RELEASE_REPO` でも上書きできます。
- 独自ドメインにする場合: ビルド時に `SITE=https://example.com BASE=/` を指定。
- 文言は `src/pages/index.astro`、画像は `public/img/` (アプリの実画面に差し替えると良い)。

## ダウンロード対象のファイル名
リリースの添付ファイル名で OS を判別します (アプリの `package.json` の `artifactName` と対応)。
`*Setup*.exe` (Windows インストーラー) / `*Portable*.exe` / `*arm64*.dmg` / `*.dmg` (Intel) / `*.AppImage`。
`latest*.yml`・`.blockmap`・`.zip` は表示しません (自動更新用)。

## ローカルで確認
```
npm install
npm run dev      # http://localhost:4321
npm test         # ダウンロード判定ロジックのテスト
npm run build    # dist/ に出力
```
