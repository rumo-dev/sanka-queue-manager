const fs = require('fs');
const { EventEmitter } = require('events');
const path = require('path');
const { safeStorage } = require('electron');
const OVERLAY = require(path.join(__dirname, '..', 'web', 'overlay-themes.js'));
const CARD = require(path.join(__dirname, '..', 'web', 'card.js'));
const OPS = require(path.join(__dirname, '..', 'web', 'ops-defs.js'));

const DEFAULTS = {
  clientId: '',
  mode: 'chat',        // chat | points | both
  command: '!参加',
  rewardTitle: '',
  limit: 3,            // 連続参加の上限回数
  slots: 1,            // 同時プレイ人数 (キュー先頭から slots 人がプレイ中)
  accepting: false,
  onboarded: false,    // 初回ガイドを済ませたか
  autoUpdate: true,    // 自動アップデート
  overlay: OVERLAY.DEFAULTS,   // OBSオーバーレイの見た目
  joinRules: OPS.JOIN_DEFAULTS, // 参加条件
  ui: OPS.UI_DEFAULTS,         // 音・ホットキー
};
const PLAIN_KEYS = ['clientId', 'mode', 'command', 'rewardTitle', 'limit', 'slots', 'onboarded', 'autoUpdate'];
const REMOTE_OK = ['plus1', 'plus1All', 'swap', 'swapLimit', 'swapFirst', 'removeLimit', 'up', 'down', 'remove', 'clear', 'undo',
  'accept', 'toggleAccept', 'add', 'block', 'settings'];   // ドック等(ネットワーク経由)から許可する操作

const MAX_STATS = 2000, MAX_LOG = 200, KEEP_STATS = 1800;

const enc = (s) => (safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(s).toString('base64') : s);
const dec = (s) => (s.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(s.slice(4), 'base64')) : s);
const normKey = (s) => String(s || '').trim().replace(/^@/, '').toLowerCase();
const str = (v, n) => String(v === undefined || v === null ? '' : v).slice(0, n);
const int = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);

class Store extends EventEmitter {
  constructor(file) {
    super();
    this.file = file;
    this.status = '';
    this.history = [];   // 元に戻す用スナップショット
    this.notice = { n: 0, text: '', kind: 'info' };   // 画面に一瞬出す通知
    this.clients = { overlay: 0, dock: 0 };
    this._rej = new Map();
    this.data = {
      settings: { ...DEFAULTS, overlay: OVERLAY.clean(), joinRules: OPS.cleanJoin(), ui: OPS.cleanUi() },
      queue: [], auth: null, designs: [], blacklist: [], stats: {}, log: [],
    };
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      const ds = d.settings || {};
      this.data.settings = {
        ...DEFAULTS, ...ds, overlay: OVERLAY.clean(ds.overlay), joinRules: OPS.cleanJoin(ds.joinRules), ui: OPS.cleanUi(ds.ui), accepting: false,
        // 既存ユーザーは初回ガイドを出さない (設定済みの人にウィザードは不要)
        onboarded: ds.onboarded === undefined ? !!(d.auth || (d.queue && d.queue.length)) : !!ds.onboarded,
      };
      this.data.queue = (d.queue || []).filter((u) => u && u.key).map((u) => ({ ...u, count: int(u.count) }));
      this.data.designs = (d.designs || []).map(CARD.sanitize).filter((x) => x.id).slice(0, 30);
      this.data.blacklist = (Array.isArray(d.blacklist) ? d.blacklist : []).filter((b) => b && b.key)
        .map((b) => ({ key: normKey(b.key), name: str(b.name || b.key, 40), at: int(b.at) })).slice(0, 500);
      for (const [k, st] of Object.entries(d.stats && typeof d.stats === 'object' ? d.stats : {})) {
        this.data.stats[normKey(k)] = { name: str(st.name || k, 40), joins: int(st.joins), total: int(st.total), rounds: int(st.rounds), firstAt: int(st.firstAt), lastAt: int(st.lastAt), lastLeaveAt: int(st.lastLeaveAt) };
      }
      this.data.log = (Array.isArray(d.log) ? d.log : []).slice(-MAX_LOG)
        .map((e) => ({ t: int(e.t), type: str(e.type, 12), key: str(e.key, 40), name: str(e.name, 40), note: str(e.note, 80) }));
      if (d.auth) this.data.auth = { ...d.auth, token: dec(d.auth.token) };
    } catch { /* 初回起動 */ }
  }

  save() {
    const { settings, queue, auth, designs, blacklist, stats, log } = this.data;
    const out = { settings, queue, designs, blacklist, stats, log, auth: auth ? { ...auth, token: enc(auth.token) } : null };
    try {
      // 書き込み途中の電源断などで壊れないよう、一時ファイル経由で置き換える
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(out));
      fs.renameSync(tmp, this.file);
    } catch { /* ignore */ }
  }

  commit() { this.save(); this.emit('change'); }

  // lite=true: OBSオーバーレイ/ドック向けの軽い状態 (履歴などを含めない)
  publicState(lite = false) {
    const base = {
      settings: this.data.settings,
      queue: this.data.queue,
      designs: this.data.designs,
      user: this.data.auth ? this.data.auth.login : null,
      status: this.status,
      canUndo: this.history.length > 0,
      notice: this.notice,
      clients: this.clients,
    };
    if (lite) return base;
    const st = this.data.stats, bl = new Set(this.data.blacklist.map((b) => b.key));
    return {
      ...base,
      blacklist: this.data.blacklist,
      history: Object.keys(st).map((k) => ({ key: k, ...st[k], blocked: bl.has(k) })).sort((a, b) => b.lastAt - a.lastAt).slice(0, 300),
      log: this.data.log.slice(-60).reverse(),
    };
  }

  setStatus(t) { this.status = t; this.emit('change'); }
  setAuth(a) { this.data.auth = a; this.status = ''; this.commit(); }
  setClients(c) {
    if (c.overlay === this.clients.overlay && c.dock === this.clients.dock) return;
    this.clients = c;
    this.emit('change');
  }
  // 画面に一瞬出す通知 (kind: info | warn)
  notify(text, kind = 'info') {
    this.notice = { n: this.notice.n + 1, text: String(text), kind };
    this.emit('change');
  }

  // ---- 履歴・ログ ----
  stat(key, name) {
    let st = this.data.stats[key];
    if (!st) {
      st = this.data.stats[key] = { name: str(name || key, 40), joins: 0, total: 0, rounds: 0, firstAt: Date.now(), lastAt: 0, lastLeaveAt: 0 };
      const keys = Object.keys(this.data.stats);
      if (keys.length > MAX_STATS) {
        const keep = new Set(this.data.queue.map((u) => u.key));
        keys.filter((k) => !keep.has(k)).sort((a, b) => this.data.stats[a].lastAt - this.data.stats[b].lastAt)
          .slice(0, keys.length - KEEP_STATS).forEach((k) => delete this.data.stats[k]);
      }
    }
    if (name) st.name = str(name, 40);
    return st;
  }

  logEvent(type, key, name, note = '') {
    this.data.log.push({ t: Date.now(), type, key, name: str(name, 40), note: str(note, 80) });
    if (this.data.log.length > MAX_LOG) this.data.log.splice(0, this.data.log.length - MAX_LOG);
  }

  isBlocked(key) { return this.data.blacklist.some((b) => b.key === key); }

  // 参加を断った時の記録・通知。チャットで連投されても騒がないよう同じ人・理由は30秒に1回だけ
  reject(key, name, reason, manual) {
    const id = key + '|' + reason, now = Date.now();
    if (!manual && now - (this._rej.get(id) || 0) < 30000) return;
    this._rej.set(id, now);
    if (this._rej.size > 300) this._rej.clear();
    this.logEvent('reject', key, name, OPS.REASONS[reason]);
    this.notify(`${name}さんは参加できません: ${OPS.REASONS[reason]}`, 'warn');
    this.save();
  }

  // 参加追加。戻り値: true=追加 / 文字列=追加しなかった理由 (dup, closed, black, role, full, cooldown, invalid)
  // opts: { manual, roles: {broadcaster, sub, vip, mod} } (rolesはチャット参加のみ。ポイント交換は条件対象外)
  join(login, display, opts = {}) {
    const key = normKey(login);
    if (!key) return 'invalid';
    const s = this.data.settings, q = this.data.queue, manual = !!opts.manual;
    if (!manual && !s.accepting) return 'closed';
    if (q.some((u) => u.key === key)) return 'dup';
    const name = str(display || login, 40).trim() || key;
    if (this.isBlocked(key)) { this.reject(key, name, 'black', manual); return 'black'; }
    if (!manual) {
      const r = s.joinRules;
      if (r.maxQueue > 0 && q.length >= r.maxQueue) { this.reject(key, name, 'full', false); return 'full'; }
      const st = this.data.stats[key];
      if (r.cooldownMin > 0 && st && st.lastLeaveAt && Date.now() - st.lastLeaveAt < r.cooldownMin * 60000) {
        this.reject(key, name, 'cooldown', false); return 'cooldown';
      }
      const ro = opts.roles;
      if (r.restrict && ro && !ro.broadcaster && !((r.sub && ro.sub) || (r.vip && ro.vip) || (r.mod && ro.mod))) {
        this.reject(key, name, 'role', false); return 'role';
      }
    }
    q.push({ key, name, count: 0 });
    const st = this.stat(key, name);
    st.joins++; st.lastAt = Date.now();
    this.logEvent('join', key, name, manual ? '手動' : '');
    this.commit();
    this.emit('join');           // アイコン(プロフィール画像)の取得トリガー
    return true;
  }

  // Twitchのプロフィール画像を反映 (取得を試みたら空文字で「確認済み」にして再取得ループを防ぐ)
  setAvatars(keys, map) {
    this.data.queue.forEach((u) => { if (u.avatar === undefined && keys.includes(u.key)) u.avatar = map[u.key] || ''; });
    this.commit();
  }

  // ---- リッチカードのデザイン ----
  designSave(d) {
    const c = CARD.sanitize(d);
    const list = this.data.designs;
    if (!c.id || c.id.startsWith('b-')) c.id = 'c_' + Math.random().toString(36).slice(2, 10);
    const i = list.findIndex((x) => x.id === c.id);
    if (i >= 0) list[i] = c;
    else if (list.length < 30) list.push(c);
    else throw new Error('カスタムデザインは30個までです');
    this.commit();
    return c.id;
  }

  designDelete(id) {
    this.data.designs = this.data.designs.filter((x) => x.id !== id);
    if (this.data.settings.overlay.design === id) this.data.settings.overlay = OVERLAY.clean({ ...this.data.settings.overlay, design: 'b-simple' });
    this.commit();
  }

  // ---- 元に戻す ----
  snapshot() {
    const st = {};
    this.data.queue.forEach((u) => { if (this.data.stats[u.key]) st[u.key] = { ...this.data.stats[u.key] }; });
    return JSON.stringify({ q: this.data.queue, st, bl: this.data.blacklist });
  }

  restore(snap) {
    const prev = JSON.parse(snap), keys = new Set(prev.q.map((u) => u.key));
    // 取り消し後に参加した人は消さずに末尾へ残す
    this.data.queue = prev.q.concat(this.data.queue.filter((u) => !keys.has(u.key)));
    Object.assign(this.data.stats, prev.st);
    this.data.blacklist = prev.bl;
  }

  dispatch(a, remote = false) {
    if (!a || typeof a !== 'object') return;
    if (remote && !REMOTE_OK.includes(a.type)) return;
    const q = this.data.queue, s = this.data.settings;
    const i = q.findIndex((u) => u.key === a.key);
    const UNDOABLE = ['plus1', 'plus1All', 'swap', 'swapLimit', 'swapFirst', 'removeLimit', 'up', 'down', 'remove', 'clear', 'block'];
    let snap = null, before = null;
    if (UNDOABLE.includes(a.type)) { snap = this.snapshot(); before = snap; }

    // 退場の記録: 通算回数に加算。depart=true は完全に抜けた (再参加クールダウンの起点)
    const leave = (u, depart) => {
      const st = this.stat(u.key, u.name);
      st.total += u.count;
      if (depart) st.lastLeaveAt = Date.now(); else st.rounds++;
    };
    const toBack = (u) => { leave(u, false); this.logEvent('swap', u.key, u.name, `${u.count}回`); q.splice(q.indexOf(u), 1); u.count = 0; q.push(u); };
    const drop = (u) => { leave(u, true); this.logEvent('remove', u.key, u.name, `${u.count}回`); };

    switch (a.type) {
      case 'accept': s.accepting = !!a.value; break;
      case 'toggleAccept': s.accepting = !s.accepting; break;
      case 'settings': {
        const p = a.settings || {};
        for (const k of PLAIN_KEYS) if (k in p) s[k] = p[k];
        if (p.overlay) s.overlay = OVERLAY.clean({ ...s.overlay, ...p.overlay });
        if (p.joinRules) s.joinRules = OPS.cleanJoin({ ...s.joinRules, ...p.joinRules });
        if (p.ui) {
          const u = p.ui;
          s.ui = OPS.cleanUi({
            sound: { ...s.ui.sound, ...u.sound },
            hotkeys: { ...s.ui.hotkeys, ...u.hotkeys, map: { ...s.ui.hotkeys.map, ...(u.hotkeys && u.hotkeys.map) } },
          });
        }
        s.limit = Math.max(1, parseInt(s.limit, 10) || 1);
        s.slots = Math.max(1, parseInt(s.slots, 10) || 1);
        s.onboarded = !!s.onboarded; s.autoUpdate = !!s.autoUpdate;
        break;
      }
      case 'plus1': if (i >= 0) q[i].count++; break;
      case 'plus1All': q.slice(0, s.slots).forEach((u) => u.count++); break;   // プレイ中の全員を+1
      case 'undo': {
        const last = this.history.pop();
        if (!last) return;
        this.restore(last);
        break;
      }
      case 'swap': if (i >= 0) toBack(q[i]); break;                      // 交代: 最後尾へ & 回数リセット
      case 'swapLimit': q.slice(0, s.slots).filter((u) => u.count >= s.limit).forEach(toBack); break;
      case 'removeLimit':     // 上限に達したプレイ中の人を全員、キューから削除
        q.slice(0, s.slots).filter((u) => u.count >= s.limit).forEach((u) => { drop(u); q.splice(q.indexOf(u), 1); });
        break;
      case 'swapFirst': if (q.length > 1 || (q.length === 1 && q[0].count > 0)) toBack(q[0]); break;
      case 'up': if (i > 0) [q[i - 1], q[i]] = [q[i], q[i - 1]]; break;
      case 'down': if (i >= 0 && i < q.length - 1) [q[i + 1], q[i]] = [q[i], q[i + 1]]; break;
      case 'remove': if (i >= 0) { drop(q[i]); q.splice(i, 1); } break;
      case 'clear': q.forEach(drop); q.length = 0; break;
      case 'block': {          // キューから外してブラックリストへ (キュー外の名前だけでも登録できる)
        const key = normKey(a.key || a.name);
        if (!key) return;
        const u = q.find((x) => x.key === key);
        const name = u ? u.name : str(a.name || (this.data.stats[key] && this.data.stats[key].name) || key, 40);
        if (u) { drop(u); q.splice(q.indexOf(u), 1); }
        if (!this.isBlocked(key)) {
          this.data.blacklist.push({ key, name, at: Date.now() });
          this.logEvent('block', key, name);
          this.notify(`${name}さんをブロックしました`);
        }
        break;
      }
      case 'unblock': {
        const key = normKey(a.key);
        this.data.blacklist = this.data.blacklist.filter((b) => b.key !== key);
        break;
      }
      case 'clearHistory': this.data.stats = {}; this.data.log = []; q.forEach((u) => { this.stat(u.key, u.name).joins = 1; }); break;
      case 'add': {
        const r = this.join(a.name, a.name, { manual: true });
        if (r === 'dup') this.notify(`${a.name}さんはすでにキューにいます`, 'warn');
        return;
      }
      default: return;
    }
    // 何も変わらなかった操作は「元に戻す」履歴に積まない
    if (snap && this.snapshot() !== before) {
      this.history.push(snap);
      if (this.history.length > 30) this.history.shift();
    }
    this.commit();
  }
}

module.exports = { Store, normKey };
