const { app, BrowserWindow, ipcMain, clipboard, dialog, shell, nativeImage, globalShortcut } = require('electron');
const fs = require('fs');
const crypto = require('crypto');
const CARD = require('./web/card.js');
const OPS = require('./web/ops-defs.js');
const path = require('path');
const { Store } = require('./src/store');
const { startServer } = require('./src/server');
const { Twitch } = require('./src/twitch');
const { YouTubeChat } = require('./src/youtube');
const { DEFAULT_CLIENT_ID, AUTH_REDIRECT, BASE_PORT } = require('./src/config');

const SCOPES = 'chat:read channel:read:redemptions';
let win, store, twitch, youtube, port = BASE_PORT, assetsDir;
let mini = false, pinned = false, normalBounds = null;

// 二重起動の防止 (ポート競合・二重受付の原因になる)
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

const customClientId = () => (store.data.settings.clientId || '').trim();
const clientId = () => customClientId() || DEFAULT_CLIENT_ID;

async function validate(token) {
  const r = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${token}` } });
  if (!r.ok) throw new Error('トークンが無効です');
  return r.json();
}

// OAuth (Implicit grant): 認証ウィンドウ内でリダイレクトを検出してトークンを取得
function authorize(id) {
  const url =
    `https://id.twitch.tv/oauth2/authorize?client_id=${encodeURIComponent(id)}` +
    `&redirect_uri=${encodeURIComponent(AUTH_REDIRECT)}&response_type=token` +
    `&scope=${encodeURIComponent(SCOPES)}&force_verify=true`;
  const w = new BrowserWindow({
    width: 520, height: 720, parent: win, modal: true,
    webPreferences: { partition: 'twitch-auth', sandbox: true },
  });
  w.setMenu(null);
  const wc = w.webContents;
  return new Promise((resolve, reject) => {
    let done = false;
    // 先に結果を確定してからウィンドウを閉じる (閉じるイベントでキャンセル扱いにならないように)
    const finish = (err, token) => {
      if (done) return;
      done = true;
      err ? reject(err) : resolve(token);
      if (!w.isDestroyed()) w.destroy();
    };
    const check = (u) => {
      if (!u || !u.startsWith(AUTH_REDIRECT)) return false;
      const [beforeHash, hash = ''] = u.split('#');
      const query = new URLSearchParams(beforeHash.split('?')[1] || '');
      const token = new URLSearchParams(hash).get('access_token');
      if (token) finish(null, token);
      else if (query.get('error')) finish(new Error('認証が拒否されました: ' + (query.get('error_description') || query.get('error'))));
      else return false;
      return true;
    };
    const guard = (e, u) => { if (check(u)) e.preventDefault(); };
    wc.on('will-redirect', guard);
    wc.on('will-navigate', guard);
    wc.on('did-redirect-navigation', (_, u) => check(u));
    wc.on('did-navigate', (_, u) => check(u));
    wc.on('did-navigate-in-page', (_, u) => check(u));
    wc.on('did-fail-load', (_e, _c, _d, u) => check(u));
    w.on('closed', () => finish(new Error(
      '認証ウィンドウが閉じられました。Twitchの画面にエラーが出ていた場合は、Developer Consoleの' +
      `「OAuthのリダイレクトURL」が ${AUTH_REDIRECT} と完全一致しているか確認してください。`)));
    w.loadURL(url);
  });
}

async function login() {
  const id = clientId();
  if (!id || id === 'YOUR_CLIENT_ID_HERE') throw new Error('Client ID が未設定です');
  const token = await authorize(id);
  const v = await validate(token);
  store.setAuth({ token, login: v.login, userId: v.user_id, clientId: v.client_id });
  twitch.connect();
}

// OBSへドラッグ&ドロップするためのHTMLファイル。OBSはHTMLファイルのドロップをブラウザソースにする。
// 中身は現在のポートのオーバーレイへ移動するだけなので、ポートが変わっても次回起動時に自動更新される。
function writeLauncher() {
  const f = path.join(app.getPath('userData'), 'sanka-overlay.html');
  const u = `http://localhost:${port}/overlay`;
  fs.writeFileSync(f,
    `<!doctype html><meta charset="utf-8"><title>Sanka Overlay</title>` +
    `<meta http-equiv="refresh" content="0;url=${u}"><script>location.replace(${JSON.stringify(u)})</script>`);
  return f;
}

// ---- ユーザー画像 (背景・フレーム) ----
const MIME = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
function saveAsset(buf, ext) {
  ext = ext.toLowerCase().replace('jpeg', 'jpg');
  const id = 'a_' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12) + '.' + ext;
  const f = path.join(assetsDir, id);
  if (!fs.existsSync(f)) fs.writeFileSync(f, buf);
  return id;
}
// どのデザインからも使われていない古い画像を掃除 (アップロード直後の画像は10分間残す)
function gcAssets() {
  const used = new Set();
  store.data.designs.forEach((d) => CARD.imageRefs(d).forEach((r) => used.add(r)));
  const ov = store.data.settings.overlay;
  ['sfxJoin', 'sfxPromote', 'sfxLimit'].forEach((k) => used.add(ov[k]));   // 取り込んだ効果音
  for (const f of fs.readdirSync(assetsDir)) {
    const p = path.join(assetsDir, f);
    try { if (!used.has(f) && Date.now() - fs.statSync(p).mtimeMs > 10 * 60 * 1000) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}

// ---- ミニ表示 (小さく・常に最前面。別モニターの端に置いて使う想定) ----
function setMini(on) {
  if (!win || win.isDestroyed() || on === mini) return;
  mini = on;
  if (on) {
    if (win.isMaximized()) win.unmaximize();
    normalBounds = win.getBounds();
    win.setMinimumSize(300, 240);
    win.setSize(400, 560);
    win.setAlwaysOnTop(true, 'floating');
  } else {
    win.setMinimumSize(760, 520);
    if (normalBounds) win.setBounds(normalBounds);
    win.setAlwaysOnTop(pinned);
  }
  win.webContents.send('mini', mini);
}
function setPinned(on) {
  pinned = !!on;
  if (win && !win.isDestroyed() && !mini) win.setAlwaysOnTop(pinned);
  if (win && !win.isDestroyed()) win.webContents.send('pinned', pinned);
}

// ---- グローバルホットキー (ゲーム中などアプリが前面にない時でも操作できる) ----
let hotkeySig = '';
function applyHotkeys() {
  const h = store.data.settings.ui.hotkeys;
  const sig = JSON.stringify(h);
  if (sig === hotkeySig) return;
  hotkeySig = sig;
  globalShortcut.unregisterAll();
  if (!h.enabled) return;
  const failed = [];
  for (const def of OPS.HOTKEYS) {
    const acc = h.map[def.id];
    if (!acc) continue;
    let ok = false;
    try { ok = globalShortcut.register(acc, () => runHotkey(def)); } catch { ok = false; }
    if (!ok) failed.push(acc);
  }
  if (failed.length) store.notify(`ホットキーを登録できませんでした: ${failed.join(', ')} (他のアプリが使用中か、書き方が正しくありません)`, 'warn');
}
function runHotkey(def) {
  if (def.id === 'toggleMini') return setMini(!mini);
  store.dispatch({ type: def.id });
  const s = store.data.settings;
  store.notify(def.id === 'toggleAccept' ? (s.accepting ? '受付を開始しました' : '受付を停止しました') : `${def.label} (ホットキー)`);
}

// ---- 自動アップデート (electron-updater / GitHub Releases) ----
let updater = null, updateTimer = null;
let updateInfo = { state: 'idle', version: '', percent: 0, message: '' };
function sendUpdate(patch) {
  updateInfo = { ...updateInfo, ...patch };
  if (win && !win.isDestroyed()) win.webContents.send('update', updateInfo);
}
function releasesUrl() {
  const pub = ((require('./package.json').build || {}).publish || [])[0] || {};
  return pub.owner && pub.repo && pub.owner !== 'YOUR_GITHUB_USER' ? `https://github.com/${pub.owner}/${pub.repo}/releases/latest` : '';
}
function setupUpdater() {
  if (!app.isPackaged) return sendUpdate({ state: 'disabled', message: '開発中は自動更新を使えません' });
  if (process.env.PORTABLE_EXECUTABLE_FILE) return sendUpdate({ state: 'disabled', message: 'ポータブル版は自動更新に対応していません (インストーラー版をご利用ください)' });
  if (!releasesUrl()) return sendUpdate({ state: 'disabled', message: '配布元の GitHub が未設定のため、自動更新は無効です' });
  try { ({ autoUpdater: updater } = require('electron-updater')); } catch { return sendUpdate({ state: 'disabled', message: '自動更新モジュールが見つかりません' }); }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.on('checking-for-update', () => sendUpdate({ state: 'checking', message: '' }));
  updater.on('update-available', (i) => sendUpdate({ state: 'downloading', version: i.version, percent: 0 }));
  updater.on('download-progress', (p) => sendUpdate({ state: 'downloading', percent: Math.round(p.percent) }));
  updater.on('update-downloaded', (i) => sendUpdate({ state: 'ready', version: i.version, percent: 100 }));
  updater.on('update-not-available', () => sendUpdate({ state: 'latest', message: '' }));
  updater.on('error', (e) => sendUpdate({ state: 'error', message: String((e && e.message) || e).split('\n')[0].slice(0, 120) }));
  const check = () => { if (store.data.settings.autoUpdate) updater.checkForUpdates().catch(() => {}); };
  setTimeout(check, 8000);
  updateTimer = setInterval(check, 4 * 60 * 60 * 1000);
  sendUpdate({ state: 'idle' });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1120, height: 780, minWidth: 760, minHeight: 520,
    backgroundColor: '#14161f',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.setMenu(null);
  // 外部リンクはアプリ内で開かず既定ブラウザへ / 画面遷移は禁止
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(async () => {
  store = new Store(path.join(app.getPath('userData'), 'state.json'));
  twitch = new Twitch(store);
  youtube = new YouTubeChat(store);
  try {
    assetsDir = path.join(app.getPath('userData'), 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    port = await startServer(store, BASE_PORT, assetsDir);
    gcAssets();
  } catch (e) {
    dialog.showErrorBox('起動エラー', e.message);
    app.quit();
    return;
  }

  ipcMain.handle('state', () => store.publicState());
  ipcMain.handle('action', (_, a) => store.dispatch(a));
  ipcMain.handle('urls', () => ({
    overlay: `http://localhost:${port}/overlay`,
    dock: `http://localhost:${port}/dock`,
    base: `http://localhost:${port}`,
    redirect: AUTH_REDIRECT,
    version: app.getVersion(),
    hasClientId: !!clientId() && clientId() !== 'YOUR_CLIENT_ID_HERE',
    releases: releasesUrl(),
  }));
  ipcMain.handle('mini:set', (_, on) => setMini(!!on));
  ipcMain.handle('pin:set', (_, on) => setPinned(on));
  ipcMain.handle('ui:flags', () => ({ mini, pinned }));
  ipcMain.handle('update:state', () => updateInfo);
  ipcMain.handle('update:check', () => {
    if (!updater) return updateInfo;
    updater.checkForUpdates().catch(() => {});
    return updateInfo;
  });
  ipcMain.handle('update:install', () => { if (updater && updateInfo.state === 'ready') updater.quitAndInstall(); });
  ipcMain.handle('update:releases', () => { const u = releasesUrl(); if (u) shell.openExternal(u); });
  ipcMain.on('drag', (e) => {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png')).resize({ width: 48, height: 48 });
    e.sender.startDrag({ file: writeLauncher(), icon });
  });
  ipcMain.handle('asset:add', (_, name, data) => {
    const m = /\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|m4a)$/i.exec(String(name));
    if (!m) throw new Error('画像 (png / jpg / gif / webp / svg) または音声 (mp3 / wav / ogg / m4a) を選んでください');
    const buf = Buffer.from(data);
    if (buf.length > 8 * 1024 * 1024) throw new Error('8MB以下のファイルにしてください');
    return saveAsset(buf, m[1]);
  });
  ipcMain.handle('design:save', (_, d, select) => {
    const id = store.designSave(d);
    if (select) store.dispatch({ type: 'settings', settings: { overlay: { design: id, layout: 'rich' } } });
    return id;
  });
  ipcMain.handle('design:delete', (_, id) => { store.designDelete(id); gcAssets(); });
  ipcMain.handle('design:export', async (_, id) => {
    const d = store.data.designs.find((x) => x.id === id);
    if (!d) return { ok: false };
    const assets = {};
    CARD.imageRefs(d).filter((r) => r.startsWith('a_')).forEach((r) => {
      const f = path.join(assetsDir, r);
      if (fs.existsSync(f)) assets[r] = `data:${MIME[path.extname(r).slice(1)]};base64,${fs.readFileSync(f).toString('base64')}`;
    });
    const { filePath } = await dialog.showSaveDialog(win, { defaultPath: `${d.title}.sankacard.json`, filters: [{ name: 'Sanka カードデザイン', extensions: ['json'] }] });
    if (!filePath) return { ok: false };
    fs.writeFileSync(filePath, JSON.stringify({ type: 'sanka-card-design', version: 1, design: d, assets }));
    return { ok: true };
  });
  ipcMain.handle('design:import', async () => {
    const { filePaths } = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Sanka カードデザイン', extensions: ['json'] }] });
    if (!filePaths || !filePaths[0]) return { ok: false };
    if (fs.statSync(filePaths[0]).size > 40 * 1024 * 1024) throw new Error('ファイルが大きすぎます');
    const j = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    if (j.type !== 'sanka-card-design' || !j.design) throw new Error('カードデザインのファイルではありません');
    const map = {};
    for (const [ref, url] of Object.entries(j.assets || {})) {
      const mm = /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)$/.exec(url);
      if (mm) map[ref] = saveAsset(Buffer.from(mm[2], 'base64'), mm[1] === 'svg+xml' ? 'svg' : mm[1]);
    }
    const d = CARD.sanitize(j.design);
    CARD.mapRefs(d, (r) => (r.startsWith('a_') ? map[r] || '' : r));
    d.id = '';
    const id = store.designSave(d);
    store.dispatch({ type: 'settings', settings: { overlay: { design: id, layout: 'rich' } } });
    return { ok: true, id };
  });
  ipcMain.handle('copy', (_, t) => clipboard.writeText(String(t)));
  ipcMain.handle('login', async () => {
    try { await login(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('logout', () => { twitch.disconnect(); store.setAuth(null); });

  writeLauncher();
  createWindow();
  store.on('change', () => {
    if (store.data.settings.platform === 'youtube') twitch.disconnect();
    else if (store.data.auth && twitch.stopped) twitch.connect();
    youtube.sync();
    if (win && !win.isDestroyed()) win.webContents.send('state', store.publicState());
    applyHotkeys();
  });
  applyHotkeys();
  youtube.sync();
  setupUpdater();

  // 保存済みトークンで自動ログイン
  if (store.data.auth) {
    try {
      const v = await validate(store.data.auth.token);
      store.setAuth({ ...store.data.auth, login: v.login, userId: v.user_id, clientId: v.client_id });
      twitch.connect();
    } catch { store.setAuth(null); }
  }
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); clearInterval(updateTimer); if (youtube) youtube.stop(); });
app.on('window-all-closed', () => app.quit());
