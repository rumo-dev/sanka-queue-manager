// ビルド前チェック: Client ID が設定済みか確認
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'config.js'), 'utf8');
const m = src.match(/DEFAULT_CLIENT_ID:\s*'([^']*)'/);
if (!m || !/^[a-z0-9]{20,40}$/i.test(m[1])) {
  console.error('\n[ERROR] src/config.js の DEFAULT_CLIENT_ID が未設定です。');
  console.error('        Twitch Developer Console の Client ID を貼り付けてから再実行してください。\n');
  process.exit(1);
}
console.log('[OK] Client ID 設定済み');

// 自動アップデートの配布元 (任意)。未設定でもビルドは通りますが、アプリ内の自動更新は無効になります。
try {
  const pub = ((require('../package.json').build || {}).publish || [])[0] || {};
  if (!pub.owner || pub.owner === 'YOUR_GITHUB_USER') {
    console.log('[INFO] package.json の build.publish (GitHubのowner/repo) が未設定です。自動アップデートを使うなら設定してください。');
  } else {
    console.log(`[OK] 自動アップデートの配布元: github.com/${pub.owner}/${pub.repo}`);
  }
} catch { /* ignore */ }
