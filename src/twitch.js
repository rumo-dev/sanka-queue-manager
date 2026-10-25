const WebSocket = require('ws');

const EVENTSUB = 'wss://eventsub.wss.twitch.tv/ws';

class Twitch {
  constructor(store) {
    this.store = store;
    this.irc = null;
    this.es = null;
    this.stopped = true;
    store.on('join', () => this.scheduleAvatars());
  }

  connect() {
    this.disconnect();
    if (!this.store.data.auth || this.store.data.settings.platform === 'youtube') return;
    this.stopped = false;
    this.openIrc();
    this.openEventSub();
    this.scheduleAvatars();
  }

  disconnect() {
    this.stopped = true;
    [this.irc, this.es].forEach((w) => { try { w && w.close(); } catch { /* ignore */ } });
    this.irc = this.es = null;
  }

  // ---- 参加者のプロフィール画像 (Helix: users) ----
  scheduleAvatars() {
    clearTimeout(this._at);
    this._at = setTimeout(() => this.resolveAvatars(), 400);
  }

  async resolveAvatars() {
    const a = this.store.data.auth;
    if (!a) return;
    const keys = this.store.data.queue.filter((u) => u.avatar === undefined).map((u) => u.key).slice(0, 100);
    if (!keys.length) return;
    try {
      const r = await fetch('https://api.twitch.tv/helix/users?' + keys.map((k) => 'login=' + encodeURIComponent(k)).join('&'), {
        headers: { 'Client-Id': a.clientId, Authorization: `Bearer ${a.token}` },
      });
      if (!r.ok) return;
      const map = {};
      (await r.json()).data.forEach((x) => { map[x.login.toLowerCase()] = x.profile_image_url; });
      this.store.setAvatars(keys, map);
    } catch { /* ネットワーク失敗時は次回に再試行 */ }
  }

  // ---- チャット (IRC over WebSocket) : 特定コメントで参加 ----
  openIrc() {
    const a = this.store.data.auth;
    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    this.irc = ws;
    ws.on('open', () => {
      ws.send('CAP REQ :twitch.tv/tags');
      ws.send(`PASS oauth:${a.token}`);
      ws.send(`NICK ${a.login}`);
      ws.send(`JOIN #${a.login}`);
    });
    ws.on('message', (d) => d.toString().split('\r\n').filter(Boolean).forEach((l) => this.onIrc(ws, l)));
    ws.on('close', () => { if (!this.stopped && this.irc === ws) setTimeout(() => !this.stopped && this.openIrc(), 5000); });
    ws.on('error', () => {});
  }

  onIrc(ws, line) {
    if (line.startsWith('PING')) return ws.send('PONG :tmi.twitch.tv');
    if (line.includes('NOTICE') && line.includes('authentication failed')) {
      return this.store.setStatus('チャット認証に失敗しました。再ログインしてください');
    }
    const m = line.match(/^@(\S+) :([^!]+)![^ ]+ PRIVMSG #\S+ :(.*)$/);
    if (!m) return;
    const s = this.store.data.settings;
    if (s.platform === 'youtube') return;
    if (s.mode === 'points') return;
    const tags = Object.fromEntries(m[1].split(';').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i), kv.slice(i + 1)];
    }));
    const first = m[3].trim().split(/\s+/)[0];
    if (s.command && first.toLowerCase() === s.command.trim().toLowerCase()) {
      // 視聴者の種類 (参加条件の判定用)。badges 例: "broadcaster/1,subscriber/12,vip/1"
      const badges = (tags.badges || '').split(',').map((b) => b.split('/')[0]);
      const has = (n) => badges.includes(n);
      const roles = {
        broadcaster: has('broadcaster') || m[2].toLowerCase() === this.store.data.auth.login.toLowerCase(),
        sub: tags.subscriber === '1' || has('subscriber') || has('founder'),
        vip: has('vip'),
        mod: tags.mod === '1' || has('moderator'),
      };
      this.store.join(m[2], tags['display-name'] || m[2], { roles });
    }
  }

  // ---- チャンネルポイント引き換え (EventSub WebSocket) ----
  openEventSub(url = EVENTSUB, reconnect = false) {
    const ws = new WebSocket(url);
    this.es = ws;
    ws.on('message', async (d) => {
      let m; try { m = JSON.parse(d); } catch { return; }
      const type = m.metadata && m.metadata.message_type;
      if (type === 'session_welcome' && !reconnect) await this.subscribe(m.payload.session.id);
      else if (type === 'session_reconnect') this.openEventSub(m.payload.session.reconnect_url, true);
      else if (type === 'notification') this.onRedeem(m.payload.event);
    });
    ws.on('close', () => { if (!this.stopped && this.es === ws) setTimeout(() => !this.stopped && this.openEventSub(), 5000); });
    ws.on('error', () => {});
  }

  async subscribe(sessionId) {
    const a = this.store.data.auth;
    try {
      const r = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'POST',
        headers: {
          'Client-Id': a.clientId,
          Authorization: `Bearer ${a.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'channel.channel_points_custom_reward_redemption.add',
          version: '1',
          condition: { broadcaster_user_id: a.userId },
          transport: { method: 'websocket', session_id: sessionId },
        }),
      });
      if (!r.ok) this.store.setStatus(`チャンネルポイント監視に失敗 (${r.status})。再ログインを試してください`);
    } catch (e) {
      this.store.setStatus('チャンネルポイント監視に失敗: ' + e.message);
    }
  }

  onRedeem(ev) {
    const s = this.store.data.settings;
    if (s.mode === 'chat' || !s.rewardTitle) return;
    if (ev.reward && ev.reward.title.trim().toLowerCase() === s.rewardTitle.trim().toLowerCase()) {
      this.store.join(ev.user_login, ev.user_name);
    }
  }
}

module.exports = { Twitch };
