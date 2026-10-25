const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const WEB = path.join(__dirname, '..', 'web');
const ORIGIN_OK = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(port); });
  });
}

// basePort から最大10個まで空きポートを探して起動。実際のポートを返す
async function startServer(store, basePort, assetsDir) {
  const app = express();
  app.get('/overlay', (_, r) => r.sendFile(path.join(WEB, 'overlay.html')));
  app.get('/dock', (_, r) => r.sendFile(path.join(WEB, 'dock.html')));
  app.get('/auth/callback', (_, r) => r.type('html').send('<meta charset="utf-8">認証が完了しました。このウィンドウは自動で閉じます。'));
  app.use('/assets', express.static(WEB));
  if (assetsDir) app.use('/user', express.static(assetsDir, { index: false, dotfiles: 'ignore' })); // ユーザーがアップロードした画像

  let wss = null;
  store.on('change', () => {
    if (!wss) return;
    const msg = JSON.stringify({ type: 'state', state: store.publicState(true) });
    wss.clients.forEach((c) => c.readyState === 1 && c.send(msg));
  });

  for (let p = basePort; p < basePort + 10; p++) {
    const server = http.createServer(app);
    try {
      await listen(server, p);
    } catch (e) {
      if (e.code === 'EADDRINUSE') continue;
      throw e;
    }
    wss = new WebSocketServer({
      server,
      path: '/ws',
      // 外部サイトからの接続を拒否 (localhost のページのみ許可)
      verifyClient: ({ origin }) => !origin || ORIGIN_OK.test(origin),
    });
    // 接続中のオーバーレイ/ドックの数を数える (初回ガイドの「OBSにつながったか」表示用)
    const roles = new Map();
    const recount = () => {
      const c = { overlay: 0, dock: 0 };
      roles.forEach((r) => { c[r]++; });
      store.setClients(c);
    };
    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'state', state: store.publicState(true) }));
      ws.on('close', () => { if (roles.delete(ws)) recount(); });
      ws.on('message', (raw) => {
        try {
          const m = JSON.parse(raw);
          if (m.type === 'hello') { roles.set(ws, m.role === 'overlay' ? 'overlay' : 'dock'); recount(); return; }
          if (m.type !== 'action' || !m.action || typeof m.action !== 'object') return;
          const a = m.action;
          // ドック/外部からは上限・枠数のみ設定変更可
          if (a.type === 'settings') {
            const { limit, slots } = a.settings || {};
            a.settings = {};
            if (limit !== undefined) a.settings.limit = limit;
            if (slots !== undefined) a.settings.slots = slots;
          }
          store.dispatch(a, true);
        } catch { /* ignore */ }
      });
    });
    return p;
  }
  throw new Error(`ポート ${basePort}〜${basePort + 9} がすべて使用中です`);
}

module.exports = { startServer };
