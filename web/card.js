// リッチカード: 背景画像 + アイコン + フレーム + 名前 を重ねた参加者カード。
// メインプロセス(検証/保存) / OBSオーバーレイ / 設定画面(エディタ) で共有。
(function (g) {
  const FONTS = {
    gothic: '"Yu Gothic UI","Hiragino Sans","Noto Sans JP",Meiryo,sans-serif',
    round: '"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","BIZ UDPGothic","Yu Gothic UI",Meiryo,sans-serif',
    mincho: '"Yu Mincho","Hiragino Mincho ProN","Noto Serif JP",serif',
    mono: '"Cascadia Mono",Consolas,"Osaka-Mono","Noto Sans Mono CJK JP",monospace',
  };
  const ENUMS = {
    fit: ['cover', 'contain', 'stretch', 'tile'],
    shape: ['circle', 'rounded', 'square', 'hexagon', 'diamond'],
    ring: ['none', 'solid', 'double', 'rainbow', 'glow'],
    frame: ['none', 'solid', 'double', 'inset', 'gold', 'neon', 'pixel', 'corners'],
    font: Object.keys(FONTS), align: ['left', 'center', 'right'],
    weight: ['400', '700', '900'], cstyle: ['text', 'badge'], cformat: ['both', 'num'],
  };
  const ART = [
    { ref: 'builtin:bg-aurora', name: 'オーロラ' }, { ref: 'builtin:bg-grid', name: 'ネオングリッド' },
    { ref: 'builtin:bg-sakura', name: 'サクラ' }, { ref: 'builtin:bg-dots', name: 'ポップドット' },
    { ref: 'builtin:bg-stars', name: '星空' }, { ref: 'builtin:bg-waves', name: '波' },
  ];

  const COLOR = /^#[0-9a-f]{6}$/i;
  const IMG = /^(builtin:[a-z0-9-]{1,30}|a_[0-9a-f]{8,16}\.(png|jpe?g|gif|webp|svg))$/i;
  const num = (v, min, max, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d; };
  const en = (v, list, d) => (list.includes(v) ? v : d);
  const col = (v, d) => (typeof v === 'string' && COLOR.test(v) ? v.toLowerCase() : d);
  const img = (v) => (typeof v === 'string' && IMG.test(v) ? v : '');
  const bool = (v, d) => (v === undefined ? d : !!v);

  // 任意の入力を安全な完全デザインにする
  function sanitize(i) {
    i = i || {};
    const b = i.bg || {}, a = i.avatar || {}, f = i.frame || {}, n = i.name || {}, c = i.count || {}, s = i.state || {};
    return {
      id: typeof i.id === 'string' && /^[\w-]{1,30}$/.test(i.id) ? i.id : '',
      title: typeof i.title === 'string' && i.title.trim() ? i.title.trim().slice(0, 30) : '新しいカード',
      w: num(i.w, 40, 900, 300), h: num(i.h, 24, 600, 96), radius: num(i.radius, 0, 200, 14),
      accent: col(i.accent, '#6ea8ff'),
      bg: { color: col(b.color, '#14161f'), alpha: num(b.alpha, 0, 100, 90), image: img(b.image), fit: en(b.fit, ENUMS.fit, 'cover'), imageAlpha: num(b.imageAlpha, 0, 100, 100), imageBlur: num(b.imageBlur, 0, 20, 0) },
      avatar: { show: bool(a.show, true), shape: en(a.shape, ENUMS.shape, 'circle'), size: num(a.size, 8, 400, 64), x: num(a.x, -300, 1200, 16), y: num(a.y, -300, 900, 16),
        ring: en(a.ring, ENUMS.ring, 'solid'), ringWidth: num(a.ringWidth, 1, 16, 3), ringColor: col(a.ringColor, ''), frameImage: img(a.frameImage), frameScale: num(a.frameScale, 100, 220, 130) },
      frame: { style: en(f.style, ENUMS.frame, 'none'), width: num(f.width, 1, 16, 3), color: col(f.color, ''), image: img(f.image), slice: num(f.slice, 0, 150, 0) },
      name: { show: bool(n.show, true), x: num(n.x, -300, 1200, 92), y: num(n.y, -300, 900, 18), w: num(n.w, 20, 900, 190), size: num(n.size, 8, 160, 24),
        color: col(n.color, '#ffffff'), font: en(n.font, ENUMS.font, 'gothic'), weight: en(String(n.weight), ENUMS.weight, '900'), align: en(n.align, ENUMS.align, 'left'),
        outline: num(n.outline, 0, 8, 0), outlineColor: col(n.outlineColor, '#000000') },
      count: { show: bool(c.show, true), style: en(c.style, ENUMS.cstyle, 'text'), format: en(c.format, ENUMS.cformat, 'both'), x: num(c.x, -300, 1200, 92), y: num(c.y, -300, 900, 56), w: num(c.w, 20, 900, 190),
        size: num(c.size, 8, 160, 20), color: col(c.color, '#ffffff'), font: en(c.font, ENUMS.font, 'gothic'), align: en(c.align, ENUMS.align, 'left'),
        badgeColor: col(c.badgeColor, ''), outline: num(c.outline, 0, 8, 0), outlineColor: col(c.outlineColor, '#000000') },
      state: { warn: col(s.warn, '#f5b700'), over: col(s.over, '#ff4d4f'), frame: bool(s.frame, true), ring: bool(s.ring, true), count: bool(s.count, true), name: bool(s.name, false), glow: bool(s.glow, true), blink: bool(s.blink, true) },
    };
  }
  const imageRefs = (d) => [d.bg.image, d.avatar.frameImage, d.frame.image].filter(Boolean);
  const mapRefs = (d, fn) => { d.bg.image = fn(d.bg.image); d.avatar.frameImage = fn(d.avatar.frameImage); d.frame.image = fn(d.frame.image); return d; };

  // ---- ビルトインデザイン ----
  const B = (id, title, o) => sanitize(Object.assign({ id, title }, o));
  const BUILTIN = [
    B('b-simple', 'シンプル', { w: 300, h: 84, radius: 14, accent: '#6ea8ff',
      avatar: { size: 60, x: 12, y: 12, ring: 'solid', ringWidth: 3 }, name: { x: 84, y: 12, w: 205, size: 24 }, count: { x: 84, y: 46, size: 20 } }),
    B('b-neon', 'ネオンゲーミング', { w: 330, h: 92, radius: 8, accent: '#00f0ff',
      bg: { color: '#08061a', alpha: 90, image: 'builtin:bg-grid' }, frame: { style: 'neon', width: 2 },
      avatar: { shape: 'hexagon', size: 70, x: 12, y: 11, ring: 'glow', ringWidth: 3 },
      name: { x: 94, y: 14, w: 225, size: 25, color: '#e8f9ff', font: 'mono' }, count: { x: 94, y: 54, size: 20, color: '#00f0ff', font: 'mono' },
      state: { warn: '#fff200', over: '#ff2d95' } }),
    B('b-sakura', 'サクラ', { w: 330, h: 96, radius: 30, accent: '#ff7eb6',
      bg: { color: '#fff0f6', alpha: 100, image: 'builtin:bg-sakura' }, frame: { style: 'double', width: 3 },
      avatar: { size: 70, x: 14, y: 13, ring: 'double', ringWidth: 3 },
      name: { x: 98, y: 16, w: 215, size: 25, color: '#5b2a45', font: 'round' },
      count: { style: 'badge', x: 98, y: 54, size: 18, color: '#ffffff', font: 'round' }, state: { warn: '#ff9f1c', over: '#e63970' } }),
    B('b-gold', 'ゴールド', { w: 340, h: 96, radius: 10, accent: '#ffc83d',
      bg: { color: '#1a1206', alpha: 96 }, frame: { style: 'gold', width: 4 }, avatar: { size: 68, x: 16, y: 14, ring: 'solid', ringWidth: 4 },
      name: { x: 98, y: 14, w: 230, size: 27, color: '#ffe9a8', font: 'mincho' }, count: { x: 98, y: 56, size: 20, color: '#ffc83d', font: 'mincho' },
      state: { warn: '#ff9142', over: '#ff4d4f' } }),
    B('b-pop', 'ポップ', { w: 310, h: 90, radius: 22, accent: '#ff3d81',
      bg: { color: '#ffe14d', alpha: 100, image: 'builtin:bg-dots' }, frame: { style: 'solid', width: 4, color: '#161616' },
      avatar: { shape: 'rounded', size: 66, x: 12, y: 12, ring: 'solid', ringWidth: 4, ringColor: '#161616' },
      name: { x: 90, y: 13, w: 210, size: 25, color: '#161616', font: 'round' },
      count: { style: 'badge', x: 90, y: 52, size: 18, badgeColor: '#161616', color: '#ffffff', font: 'round' } , state: { warn: '#ff8a00', over: '#e0003c', name: false } }),
    B('b-retro', 'レトロゲーム', { w: 330, h: 88, radius: 0, accent: '#39ff14',
      bg: { color: '#021a02', alpha: 100 }, frame: { style: 'pixel', width: 4 }, avatar: { shape: 'square', size: 60, x: 14, y: 14, ring: 'solid', ringWidth: 3 },
      name: { x: 88, y: 14, w: 230, size: 22, color: '#b8ffb0', font: 'mono' }, count: { x: 88, y: 50, size: 20, color: '#39ff14', font: 'mono' },
      state: { warn: '#ffd400', over: '#ff3b3b', glow: false } }),
    B('b-portrait', 'ポートレート (縦)', { w: 180, h: 244, radius: 20, accent: '#a970ff',
      bg: { color: '#0d1020', alpha: 100, image: 'builtin:bg-aurora' }, frame: { style: 'none' },
      avatar: { size: 124, x: 28, y: 22, ring: 'rainbow', ringWidth: 5 },
      name: { x: 10, y: 160, w: 160, size: 24, align: 'center' }, count: { style: 'badge', x: 10, y: 200, w: 160, size: 20, align: 'center' },
      state: { warn: '#ffd23f', over: '#ff5470' } }),
    B('b-mini', 'ミニバッジ', { w: 240, h: 56, radius: 28, accent: '#6ea8ff',
      bg: { color: '#14161f', alpha: 90 }, avatar: { size: 44, x: 6, y: 6, ring: 'solid', ringWidth: 2 },
      name: { x: 58, y: 7, w: 130, size: 20 }, count: { x: 186, y: 14, w: 46, size: 19, align: 'right' } }),
    B('b-clear', '透明 (アイコン+名前)', { w: 270, h: 72, radius: 0, accent: '#ffffff',
      bg: { alpha: 0 }, avatar: { size: 56, x: 6, y: 8, ring: 'solid', ringWidth: 3 },
      name: { x: 72, y: 8, w: 190, size: 25, outline: 3 }, count: { x: 72, y: 40, size: 21, outline: 3 }, state: { glow: false } }),
  ];

  const api = { FONTS, ENUMS, ART, BUILTIN, sanitize, imageRefs, mapRefs };
  g.CARD = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  // ================= DOM 描画 =================
  const SHAPES = {
    circle: 'circle(50% at 50% 50%)', rounded: 'inset(0 round 24%)', square: 'none',
    hexagon: 'polygon(25% 6%,75% 6%,100% 50%,75% 94%,25% 94%,0 50%)', diamond: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
  };
  const ref = (r, ctx) => (r.startsWith('builtin:') ? `${ctx.art}${r.slice(8)}.svg` : `${ctx.user}${r}`);
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lum = (hex) => { const [r, g2, b] = rgb(hex); return (0.299 * r + 0.587 * g2 + 0.114 * b) / 255; };
  const outline = (w, c) => {
    if (!w) return 'none';
    const p = [[w, 0], [-w, 0], [0, w], [0, -w], [w, w], [-w, w], [w, -w], [-w, -w]];
    return p.map(([x, y]) => `${x}px ${y}px 0 ${c}`).join(',');
  };
  const hue = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };

  function build(d, ctx) {
    const el = document.createElement('div');
    el.className = 'card'; el._d = d; el._ctx = ctx;
    const { bg, avatar: a, frame: f, name: n, count: c } = d;
    el.style.cssText = `width:${d.w}px;height:${d.h}px;border-radius:${d.radius}px`;
    el.innerHTML = '<div class="cl bg"></div><div class="cl bgi"><i></i></div><div class="cl av"><div class="avo"><div class="avm"><div class="avi"><b class="ini"></b><img alt=""></div></div></div></div>' +
      '<div class="cl avf"></div><div class="cl fi"></div><div class="cl fr"></div><div class="cl nm"><span></span></div><div class="cl ct"><span></span></div>';
    const q = (s) => el.querySelector(s);

    const [r, g2, b2] = rgb(bg.color);
    q('.bg').style.background = `rgba(${r},${g2},${b2},${bg.alpha / 100})`;
    const bgi = q('.bgi i');
    if (bg.image) {
      const bl = bg.imageBlur;
      Object.assign(bgi.style, { inset: `${-bl * 2}px`, backgroundImage: `url("${ref(bg.image, ctx)}")`, opacity: bg.imageAlpha / 100, filter: bl ? `blur(${bl}px)` : 'none',
        backgroundSize: { cover: 'cover', contain: 'contain', stretch: '100% 100%', tile: 'auto' }[bg.fit], backgroundRepeat: bg.fit === 'tile' ? 'repeat' : 'no-repeat', backgroundPosition: 'center' });
    } else q('.bgi').style.display = 'none';

    // アイコン
    const av = q('.av');
    if (!a.show) { av.style.display = 'none'; q('.avf').style.display = 'none'; } else {
      Object.assign(av.style, { left: a.x + 'px', top: a.y + 'px', width: a.size + 'px', height: a.size + 'px' });
      const clip = SHAPES[a.shape];
      const rw = a.ring === 'none' ? 0 : a.ringWidth;
      const avo = q('.avo'), avm = q('.avm'), avi = q('.avi');
      [avo, avm, avi].forEach((x) => { x.style.clipPath = clip; x.style.webkitClipPath = clip; });
      avo.style.background = a.ring === 'rainbow' ? 'conic-gradient(#ff4d4d,#ffd24d,#4dff88,#4dd2ff,#a24dff,#ff4dc4,#ff4d4d)' : 'var(--ringc)';
      if (a.ring === 'none') avo.style.background = 'none';
      avm.style.cssText += `;inset:${rw}px;background:${a.ring === 'double' ? `rgb(${r},${g2},${b2})` : 'none'}`;
      avi.style.cssText += `;inset:${a.ring === 'double' ? rw : 0}px`;
      av.style.filter = a.ring === 'glow' ? 'drop-shadow(0 0 7px var(--ringc))' : 'none';
      const ini = q('.ini'); ini.style.fontSize = Math.max(10, a.size * 0.45) + 'px';
      const im = q('.avi img');
      im.addEventListener('error', () => { im.style.display = 'none'; });
      im.addEventListener('load', () => { im.style.display = ''; });
      if (a.frameImage) {
        const s = a.size * a.frameScale / 100;
        Object.assign(q('.avf').style, { left: a.x + a.size / 2 - s / 2 + 'px', top: a.y + a.size / 2 - s / 2 + 'px', width: s + 'px', height: s + 'px', backgroundImage: `url("${ref(a.frameImage, ctx)}")` });
      } else q('.avf').style.display = 'none';
    }

    // フレーム
    const fr = q('.fr'); fr.dataset.fs = f.style; el.style.setProperty('--fw', f.width + 'px');
    if (f.image) {
      const fi = q('.fi'), u = `url("${ref(f.image, ctx)}")`;
      if (f.slice > 0) { fi.style.border = `${f.slice}px solid transparent`; fi.style.borderImage = `${u} ${f.slice} / ${f.slice}px stretch`; fi.style.webkitBorderImage = `${u} ${f.slice} / ${f.slice}px stretch`; }
      else { fi.style.backgroundImage = u; fi.style.backgroundSize = '100% 100%'; }
    } else q('.fi').style.display = 'none';

    // 名前 / 回数
    const nm = q('.nm');
    if (!n.show) nm.style.display = 'none';
    else Object.assign(nm.style, { left: n.x + 'px', top: n.y + 'px', width: n.w + 'px', fontSize: n.size + 'px', fontWeight: n.weight, textAlign: n.align, fontFamily: FONTS[n.font], textShadow: outline(n.outline, n.outlineColor) });
    const ct = q('.ct');
    if (!c.show) ct.style.display = 'none';
    else {
      Object.assign(ct.style, { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', fontSize: c.size + 'px', textAlign: c.align, fontFamily: FONTS[c.font], textShadow: c.style === 'badge' ? 'none' : outline(c.outline, c.outlineColor) });
      q('.ct span').className = c.style === 'badge' ? 'badge' : '';
    }
    return el;
  }

  // 状態 (名前/回数/アイコン/上限色) の反映
  function update(el, u, limit) {
    const d = el._d, S = d.state, ctx = el._ctx;
    const over = !u.recruit && u.count > limit, hit = !u.recruit && u.count === limit, alert = over || hit;
    const stc = over ? S.over : S.warn;
    const use = (custom, flag) => (alert && flag ? stc : custom || d.accent);
    el.classList.toggle('limit', hit); el.classList.toggle('over', over); el.classList.toggle('recruit', !!u.recruit);
    el.classList.toggle('glow', alert && S.glow); el.classList.toggle('blink', alert && S.blink);
    const sp = (k, v) => el.style.setProperty(k, v);
    sp('--st', stc); sp('--frc', use(d.frame.color, S.frame)); sp('--ringc', use(d.avatar.ringColor, S.ring));

    const nm = el.querySelector('.nm span'); nm.textContent = u.name;
    nm.style.color = alert && S.name ? stc : d.name.color;
    const cs = el.querySelector('.ct span');
    cs.textContent = d.count.format === 'both' ? `${u.count}/${limit}` : String(u.count);
    if (d.count.style === 'badge') {
      const bgc = alert && S.count ? stc : d.count.badgeColor || d.accent;
      cs.style.background = bgc; cs.style.color = lum(bgc) > 0.6 ? '#111' : d.count.color === '#000000' ? '#fff' : (lum(d.count.color) < 0.4 ? '#fff' : d.count.color);
    } else cs.style.color = alert && S.count ? stc : d.count.color;

    if (d.avatar.show) {
      const ini = el.querySelector('.ini'), im = el.querySelector('.avi img');
      const ch = (u.name || '?').trim().charAt(0).toUpperCase();
      ini.textContent = ch;
      el.querySelector('.avi').style.background = `hsl(${hue(u.name || '?')},55%,48%)`;
      const src = u.avatar || '';
      if (im._src !== src) { im._src = src; if (src) { im.style.display = ''; im.src = src; } else { im.removeAttribute('src'); im.style.display = 'none'; } }
    }
  }

  api.build = build; api.update = update; api.refUrl = ref;
})(typeof window !== 'undefined' ? window : globalThis);
