// ★配布者(あなた)が1回だけ設定する値★
// Twitch Developer Console で登録したアプリの Client ID を貼り付けてください。
// Client ID は公開情報 (Implicit grant / Public クライアント) なので同梱して問題ありません。
// ※ Client Secret は絶対にここへ書かないこと。
module.exports = {
  DEFAULT_CLIENT_ID: 'bbcx5unegue8fbnsd58qkrnxkeo2zc',
  // 認証のリダイレクトURL。Twitchコンソールにこの値を登録 (実際にはアプリが横取りするので、ポートが使用中でも動作)
  AUTH_REDIRECT: 'http://localhost:3000/auth/callback',
  // OBS用サーバーの希望ポート。使用中なら +1 ずつ最大10個まで探索
  BASE_PORT: 3000,
};
