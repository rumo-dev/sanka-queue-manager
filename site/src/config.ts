// ★配布者が設定する値★
// アプリの配布先 (リリースを置く GitHub リポジトリ)。package.json の build.publish と同じものにします。
// ビルド時に環境変数 PUBLIC_RELEASE_REPO (例: myname/sanka-queue-manager) で上書きもできます。
export const RELEASE_REPO: string = import.meta.env.PUBLIC_RELEASE_REPO || 'rumo-dev/sanka-queue-manager';
export const APP_NAME = 'Sanka Queue Manager';
export const TAGLINE = 'Twitch参加型配信の「次、誰が遊ぶ？」を、ひとつの画面で。';
