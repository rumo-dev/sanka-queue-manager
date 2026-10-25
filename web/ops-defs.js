// 操作・通知・参加条件の定義 (メインプロセス / 設定画面 / パネルで共有)
(function (g) {
  // グローバルホットキー (ゲーム中など、アプリが前面にない時でも使える)
  const HOTKEYS = [
    { id: 'plus1All', label: '全員 ＋1', def: 'Ctrl+Alt+1' },
    { id: 'swapLimit', label: '上限者を交代', def: 'Ctrl+Alt+2' },
    { id: 'swapFirst', label: '先頭の人を交代', def: 'Ctrl+Alt+3' },
    { id: 'removeLimit', label: '上限者を削除', def: 'Ctrl+Alt+4' },
    { id: 'undo', label: '元に戻す', def: 'Ctrl+Alt+Z' },
    { id: 'toggleAccept', label: '受付 ON / OFF', def: 'Ctrl+Alt+R' },
    { id: 'toggleMini', label: 'ミニ表示 切替', def: 'Ctrl+Alt+M' },
  ];

  const SOUNDS = [
    { id: 'none', name: 'なし' }, { id: 'chime', name: 'チャイム' }, { id: 'pop', name: 'ポップ' },
    { id: 'coin', name: 'コイン' }, { id: 'horn', name: 'ブザー' }, { id: 'whoosh', name: 'シュッ' },
  ];
  const SOUND_IDS = SOUNDS.map((x) => x.id);

  // 参加を断った理由 (通知・履歴に表示)
  const REASONS = {
    black: 'ブラックリストに登録されています',
    role: '参加条件 (視聴者の種類) を満たしていません',
    full: 'キューが満員です',
    cooldown: '再参加までの待ち時間中です',
  };

  const UI_DEFAULTS = {
    sound: { join: 'chime', limit: 'horn', volume: 60 },
    hotkeys: { enabled: false, map: Object.fromEntries(HOTKEYS.map((h) => [h.id, h.def])) },
  };
  const JOIN_DEFAULTS = { restrict: false, sub: true, vip: true, mod: true, maxQueue: 0, cooldownMin: 0 };

  const num = (v, min, max, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d; };
  const bool = (v, d) => (v === undefined ? d : v === true || v === 'true' || v === '1');

  function cleanUi(o) {
    o = o || {};
    const s = o.sound || {}, h = o.hotkeys || {}, m = h.map || {};
    const sd = UI_DEFAULTS.sound;
    const map = {};
    HOTKEYS.forEach((k) => {
      const v = m[k.id];
      map[k.id] = typeof v === 'string' && (v === '' || /^[A-Za-z0-9+\-_ ]{1,40}$/.test(v)) ? v.trim() : k.def;
    });
    return {
      sound: {
        join: SOUND_IDS.includes(s.join) ? s.join : sd.join,
        limit: SOUND_IDS.includes(s.limit) ? s.limit : sd.limit,
        volume: num(s.volume, 0, 100, sd.volume),
      },
      hotkeys: { enabled: bool(h.enabled, false), map },
    };
  }

  function cleanJoin(o) {
    o = o || {};
    const d = JOIN_DEFAULTS;
    return {
      restrict: bool(o.restrict, d.restrict), sub: bool(o.sub, d.sub), vip: bool(o.vip, d.vip), mod: bool(o.mod, d.mod),
      maxQueue: num(o.maxQueue, 0, 999, 0), cooldownMin: num(o.cooldownMin, 0, 600, 0),
    };
  }

  const OPS = { HOTKEYS, SOUNDS, REASONS, UI_DEFAULTS, JOIN_DEFAULTS, cleanUi, cleanJoin };
  g.OPS = OPS;
  if (typeof module !== 'undefined' && module.exports) module.exports = OPS;
})(typeof window !== 'undefined' ? window : globalThis);
