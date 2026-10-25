const { BrowserWindow } = require('electron');

function videoId(input) {
  const value = String(input || '').trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const u = new URL(value);
    const id = u.searchParams.get('v') || (u.hostname === 'youtu.be' && u.pathname.slice(1)) ||
      (u.pathname.match(/\/live\/([\w-]{11})/) || [])[1];
    return id && /^[\w-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
}

class YouTubeChat {
  constructor(store) { this.store = store; this.window = null; this.timer = null; this.seen = new Set(); this.signature = ''; }

  sync() {
    const s = this.store.data.settings;
    const id = videoId(s.youtubeVideo);
    const sig = `${s.platform}|${id}|${s.command}|${s.mode}`;
    if (sig === this.signature) return;
    this.signature = sig;
    this.stop();
    if (!['youtube', 'both'].includes(s.platform)) return;
    if (!id) return this.store.setStatus('YouTube配信URLまたは動画IDを設定してください');
    this.store.status = '';
    this.open(id);
  }

  open(id) {
    const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
    this.window = w;
    w.webContents.on('did-fail-load', (_e, code, desc, url, mainFrame) => {
      if (mainFrame && this.window === w) this.store.setStatus(`YouTubeチャットを開けません: ${desc} (${code})`);
    });
    w.webContents.on('did-finish-load', () => {
      if (this.window !== w) return;
      this.store.setStatus('YouTubeライブチャットに接続しました');
      this.poll(w);
      this.timer = setInterval(() => this.poll(w), 1500);
    });
    w.loadURL(`https://www.youtube.com/live_chat?v=${id}`);
  }

  async poll(w) {
    if (!w || w.isDestroyed() || this.window !== w) return;
    try {
      const rows = await w.webContents.executeJavaScript(`(() => Array.from(document.querySelectorAll('yt-live-chat-text-message-renderer'))
        .map(e => ({ id: e.getAttribute('id') || '', authorId: e.getAttribute('author-external-channel-id') || '',
          name: e.querySelector('#author-name')?.textContent?.trim() || '',
          text: e.querySelector('#message')?.innerText?.trim() || '' })).filter(x => x.name && x.text))()`, true);
      for (const m of rows) {
        if (!m.id || this.seen.has(m.id)) continue;
        this.seen.add(m.id);
        if (this.seen.size > 2000) this.seen = new Set(Array.from(this.seen).slice(-1000));
        const s = this.store.data.settings;
        if (!['youtube', 'both'].includes(s.platform) || s.mode === 'points' || !s.command) continue;
        const first = m.text.trim().split(/\\s+/)[0];
        if (first.toLowerCase() === s.command.trim().toLowerCase()) {
          // Channel ID gives a stable, unique queue key; display name remains the visible label.
          this.store.join(m.authorId || m.name, m.name);
        }
      }
    } catch { /* ページ読み込み中やYouTube側の構造変更 */ }
  }

  stop() {
    clearInterval(this.timer); this.timer = null;
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
    this.window = null; this.seen.clear();
  }
}

module.exports = { YouTubeChat, videoId };
