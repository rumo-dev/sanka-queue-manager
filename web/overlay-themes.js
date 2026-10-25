// オーバーレイの見た目の定義 (メインプロセス / OBSオーバーレイ / 設定画面で共有)
(function (g) {
  const GOTHIC = '"Yu Gothic UI","Hiragino Sans","Noto Sans JP",Meiryo,sans-serif';
  const ROUND = '"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","BIZ UDPGothic","Yu Gothic UI",Meiryo,sans-serif';
  const MINCHO = '"Yu Mincho","Hiragino Mincho ProN","Noto Serif JP",serif';
  const MONO = '"Cascadia Mono",Consolas,"Osaka-Mono","Noto Sans Mono CJK JP",monospace';

  const BASE = {
    '--bg-rgb': '20,22,31', '--alpha-mul': '1',
    '--text': '#ffffff', '--sub': '#a9afc8',
    '--accent': '#6ea8ff', '--warn': '#f5b700', '--over': '#ff4d4f',
    '--radius': '0.35em', '--bw': '0px', '--glow': '0px', '--blur': '0px',
    '--shadow': '0 0.1em 0.4em rgba(0,0,0,.35)', '--tsh': '0 1px 3px rgba(0,0,0,.8)',
    '--weight': '700', '--font': GOTHIC,
  };
  const T = (id, name, v) => ({ id, name, v: Object.assign({}, BASE, v) });

  const THEMES = [
    T('dark', 'ダーク', {}),
    T('light', 'ライト', { '--bg-rgb': '255,255,255', '--text': '#1b1e2b', '--sub': '#667085', '--accent': '#3b82f6', '--warn': '#e69a00', '--over': '#e5383b', '--tsh': 'none', '--shadow': '0 0.1em 0.5em rgba(0,0,0,.25)' }),
    T('neon', 'ネオン', { '--bg-rgb': '8,6,24', '--text': '#e8f9ff', '--accent': '#00f0ff', '--warn': '#fff200', '--over': '#ff2d95', '--bw': '2px', '--glow': '0.7em', '--radius': '0.2em', '--tsh': '0 0 6px rgba(0,240,255,.8)', '--shadow': '0 0 0 0 transparent' }),
    T('sakura', 'サクラ', { '--bg-rgb': '255,240,246', '--text': '#5b2a45', '--sub': '#a8607f', '--accent': '#ff7eb6', '--warn': '#ff9f1c', '--over': '#e63970', '--radius': '1em', '--bw': '2px', '--tsh': 'none', '--shadow': '0 0.15em 0.5em rgba(230,57,112,.25)', '--font': ROUND }),
    T('purple', 'パープル', { '--bg-rgb': '38,20,70', '--sub': '#c9b6f2', '--accent': '#a970ff', '--warn': '#ffd23f', '--over': '#ff5470', '--radius': '0.5em' }),
    T('glass', 'ガラス', { '--bg-rgb': '255,255,255', '--alpha-mul': '0.22', '--blur': '12px', '--bw': '1px', '--accent': '#9be7ff', '--warn': '#ffe27a', '--over': '#ff8fa3', '--radius': '0.6em', '--shadow': '0 0.1em 0.6em rgba(0,0,0,.25)', '--tsh': '0 1px 4px rgba(0,0,0,.7)' }),
    T('retro', 'レトロ', { '--bg-rgb': '0,12,0', '--text': '#b8ffb0', '--sub': '#5fae55', '--accent': '#39ff14', '--warn': '#ffd400', '--over': '#ff3b3b', '--radius': '0', '--bw': '3px', '--tsh': 'none', '--shadow': '0.2em 0.2em 0 rgba(0,0,0,.6)', '--font': MONO }),
    T('minimal', 'ミニマル', { '--alpha-mul': '0', '--accent': '#ffffff', '--sub': '#e6e6e6', '--radius': '0', '--shadow': '0 0 0 0 transparent', '--tsh': '-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000,0 0 6px #000' }),
    T('gold', 'ゴールド', { '--bg-rgb': '26,18,6', '--text': '#ffe9a8', '--sub': '#bfa56a', '--accent': '#ffc83d', '--warn': '#ff9142', '--over': '#ff4d4f', '--bw': '1px', '--glow': '0.25em', '--radius': '0.25em' }),
    T('mint', 'ミント', { '--bg-rgb': '230,255,245', '--text': '#0d3b32', '--sub': '#4a7c70', '--accent': '#19c3a0', '--warn': '#f0a500', '--over': '#e5484d', '--radius': '0.7em', '--tsh': 'none', '--shadow': '0 0.1em 0.4em rgba(13,59,50,.25)', '--font': ROUND }),
  ];

  const LAYOUTS = [
    { id: 'list', name: 'リスト', desc: '縦に並べる定番' },
    { id: 'cards', name: 'カード', desc: '横並びのカード' },
    { id: 'chips', name: 'チップ', desc: '小さく省スペース' },
    { id: 'line', name: '1行バー', desc: '画面端に細く表示' },
    { id: 'spotlight', name: 'スポットライト', desc: '名前を大きく中央に' },
    { id: 'rich', name: 'リッチカード', desc: 'アイコン・背景・フレーム付き' },
  ];
  const FONTS = { gothic: GOTHIC, round: ROUND, mincho: MINCHO, mono: MONO };

  const DEFAULTS = {
    theme: 'dark', layout: 'list', align: 'left', font: 'auto', anim: 'slide',
    scale: 100, opacity: 85, accent: '',
    showCount: true, showLimit: true, showIndex: false, showLabel: true,
    labelText: 'プレイ中', waitLabelText: '待機中',
    showWaiting: false, waitingMax: 5, showRecruit: false, limitBlink: true,
    design: 'b-simple', arrange: 'row', columns: 3, gap: 12,   // リッチカード用
    // 交代時の演出: 退場アニメ / 出番が来た人の強調 / 効果音 (プリセットID、または取り込んだ音声ファイル a_xxx.mp3)
    leaveAnim: 'slide', promoteFx: 'flash',
    sfxJoin: 'none', sfxPromote: 'none', sfxLimit: 'none', sfxVolume: 60,
  };
  const SFX_PRESETS = ['none', 'chime', 'pop', 'coin', 'horn', 'whoosh'];
  const SFX_FILE = /^a_[0-9a-f]{8,16}\.(mp3|wav|ogg|m4a)$/i;
  const ENUM = {
    layout: LAYOUTS.map((l) => l.id), align: ['left', 'center', 'right'],
    font: ['auto'].concat(Object.keys(FONTS)), anim: ['none', 'slide', 'pop', 'fade'], arrange: ['row', 'column', 'grid'],
    leaveAnim: ['none', 'slide', 'fade', 'pop'], promoteFx: ['none', 'flash', 'glow', 'bounce'],
  };
  const RANGE = { scale: [50, 200], opacity: [0, 100], waitingMax: [1, 20], columns: [1, 8], gap: [0, 100], sfxVolume: [0, 100] };

  // 任意の入力 (保存値 / URLパラメータ) を検証して完全な設定にする
  function clean(o) {
    o = o || {};
    const r = {};
    for (const k of Object.keys(DEFAULTS)) {
      const d = DEFAULTS[k]; const v = o[k];
      if (v === undefined) { r[k] = d; continue; }
      if (k === 'theme') r[k] = THEMES.some((t) => t.id === v) ? v : d;
      else if (ENUM[k]) r[k] = ENUM[k].includes(v) ? v : d;
      else if (k === 'design') r[k] = /^[\w-]{1,30}$/.test(String(v)) ? String(v) : d;
      else if (/^sfx(Join|Promote|Limit)$/.test(k)) r[k] = SFX_PRESETS.includes(v) || SFX_FILE.test(String(v)) ? String(v) : d;
      else if (k === 'accent') { const m = '#' + String(v).replace(/^#/, ''); r[k] = /^#[0-9a-f]{6}$/i.test(m) ? m : ''; }
      else if (typeof d === 'boolean') r[k] = v === true || v === '1' || v === 'true';
      else if (typeof d === 'number') {
        const n = Number(v), g = RANGE[k];
        r[k] = Number.isFinite(n) ? (g ? Math.min(g[1], Math.max(g[0], n)) : n) : d;
      } else r[k] = String(v).slice(0, 30);
    }
    return r;
  }

  const OVERLAY = { THEMES, LAYOUTS, FONTS, DEFAULTS, ENUM, RANGE, SFX_PRESETS, clean };
  g.OVERLAY = OVERLAY;
  if (typeof module !== 'undefined' && module.exports) module.exports = OVERLAY;
})(typeof window !== 'undefined' ? window : globalThis);
