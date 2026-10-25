// GitHub Releases からダウンロードリンクを組み立てる処理 (ブラウザ / Node どちらでも動く純粋なロジック)

/** @returns {'win'|'mac'|'linux'|'other'} */
export function detectOS(ua = '', platform = '') {
  const s = `${platform} ${ua}`.toLowerCase();
  if (/android|iphone|ipad|ipod/.test(s)) return 'other'; // スマホ/タブレットはデスクトップ版が使えない
  if (/win/.test(s)) return 'win';
  if (/mac/.test(s)) return 'mac';
  if (/linux|x11|cros/.test(s)) return 'linux';
  return 'other';
}

/** リリースの assets から、配布対象のファイルだけを種類分けして返す */
export function classifyAssets(assets = []) {
  const out = [];
  for (const a of assets) {
    const name = String(a.name || '');
    const base = { name, url: a.browser_download_url, size: a.size || 0 };
    if (/\.exe$/i.test(name) && /portable/i.test(name)) out.push({ ...base, id: 'win-portable', os: 'win', kind: 'portable', label: 'Windows ポータブル版', note: 'インストール不要。自動更新は非対応', order: 11 });
    else if (/\.exe$/i.test(name)) out.push({ ...base, id: 'win-setup', os: 'win', kind: 'installer', label: 'Windows インストーラー', note: '推奨・自動更新に対応', order: 10 });
    else if (/\.dmg$/i.test(name) && /arm64/i.test(name)) out.push({ ...base, id: 'mac-arm64', os: 'mac', kind: 'installer', label: 'macOS (Apple Silicon)', note: 'M1 / M2 / M3 / M4 など', order: 20 });
    else if (/\.dmg$/i.test(name)) out.push({ ...base, id: 'mac-x64', os: 'mac', kind: 'installer', label: 'macOS (Intel)', note: 'Intel Mac', order: 21 });
    else if (/\.appimage$/i.test(name)) out.push({ ...base, id: 'linux', os: 'linux', kind: 'installer', label: 'Linux (AppImage)', note: '実行権限を付けて起動', order: 30 });
  }
  return out.sort((x, y) => x.order - y.order);
}

/** 検出したOSで最初におすすめするファイル。macはCPUが判別できないので null (両方を並べて見せる) */
export function pickPrimary(os, items) {
  if (os === 'win') return items.find((i) => i.id === 'win-setup') || items.find((i) => i.os === 'win') || null;
  if (os === 'linux') return items.find((i) => i.os === 'linux') || null;
  return null;
}

export function formatSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 最新リリースを取得。リリースがまだ無ければ null。通信エラーは例外。
 * @param {string} repo  "owner/repo"
 * @param {typeof fetch} fetchFn
 */
export async function fetchLatest(repo, fetchFn = fetch) {
  const r = await fetchFn(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub API ${r.status}`);
  const j = await r.json();
  return {
    version: String(j.tag_name || '').replace(/^v/i, ''),
    date: j.published_at || '',
    pageUrl: j.html_url,
    items: classifyAssets(j.assets),
  };
}
