// OBS用オーバーレイ。見た目はアプリの「OBS見た目」設定に従う。
// URLパラメータで上書き可 (例: /overlay?theme=neon&layout=cards&scale=120&showWaiting=1)
(function () {
  const { THEMES, FONTS, DEFAULTS, clean } = window.OVERLAY;
  const q = new URLSearchParams(location.search);
  const demo = q.get('demo') === '1';
  const ALIAS = { count: 'showCount', waiting: 'showWaiting' }; // 旧パラメータ互換

  const urlOverrides = () => {
    const o = {};
    q.forEach((v, k) => { const key = ALIAS[k] || k; if (key in DEFAULTS) o[key] = v; });
    return o;
  };

  const root = document.getElementById('root');
  const lab = { play: root.querySelector('.lab.play'), wait: root.querySelector('.lab.wait') };
  const grp = { play: root.querySelector('.grp.play'), wait: root.querySelector('.grp.wait') };
  const els = new Map();
  let prev = null;   // 前回の状態 (効果音・昇格演出の判定用)。null = まだ受け取っていない

  const CTX = { art: '/assets/art/', user: '/user/' };
  const AV = [1, 2, 3, 4, 5, 6, 7].map((i) => `/assets/art/avatar-${(i - 1) % 4 + 1}.svg`);

  function make() {
    const el = document.createElement('div');
    el.className = 'it';
    el.innerHTML = '<span class="idx"></span><span class="n"></span><span class="c"></span>';
    return el;
  }

  function demoQueue(limit) {
    const names = ['さくら', 'Taro_Gamer', 'ゲーマーふじ', 'Mika', 'ぽん太', 'Ryu', 'Hinata'];
    const counts = [Math.max(0, limit - 1), limit, limit + 1, 0, 0, 0, 0];
    return names.map((n, i) => ({ key: 'demo' + i, name: n, count: counts[i], avatar: AV[i] }));
  }

  // 退場: アニメしてから外す。leave中の要素は els から切り離すので、同じ人が戻ってきても新しく作られる
  function dispose(el, o) {
    if (o.leaveAnim === 'none' || !prev || demo) { el.remove(); return; }
    el.classList.remove('enter', 'promote');
    el.classList.add('leave');
    const done = () => el.remove();
    el.addEventListener('animationend', (e) => { if (e.target === el) done(); });
    setTimeout(done, 900);
  }

  const live = (c) => Array.from(c.children).filter((x) => !x.classList.contains('leave'));

  function sync(name, users, offset, o, limit, design) {
    const c = grp[name];
    const rich = o.layout === 'rich';
    const sig = rich ? JSON.stringify(design) : '';
    users.forEach((u, i) => {
      let el = els.get(u.key);
      if (el && (el._rich !== rich || (rich && el._sig !== sig))) { el.remove(); els.delete(u.key); el = null; } // 種類/デザインが変わったら作り直す
      if (!el) {
        el = rich ? CARD.build(design, CTX) : make();
        el._rich = rich; el._sig = sig; el._g = name;
        els.set(u.key, el);
        el.addEventListener('animationend', (e) => { if (e.target === el) el.classList.remove('enter', 'promote'); });
        // 待機から出番になった人は昇格演出、それ以外の新規参加は登場アニメ
        const promoted = prev && name === 'play' && prev.all.has(u.key) && o.promoteFx !== 'none';
        if (promoted) el.classList.add('promote');
        else if (o.anim !== 'none') el.classList.add('enter');
      } else if (el._g !== name) {
        if (el._g === 'wait' && name === 'play' && o.promoteFx !== 'none') { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('promote'); }
        el._g = name;
      }
      if (rich) {
        CARD.update(el, u, limit);
      } else {
        el.classList.toggle('recruit', !!u.recruit);
        el.classList.toggle('limit', !u.recruit && u.count === limit);
        el.classList.toggle('over', !u.recruit && u.count > limit);
        el.querySelector('.idx').textContent = String(offset + i + 1);
        el.querySelector('.n').textContent = u.name;
        el.querySelector('.c').textContent = o.showLimit ? `${u.count}/${limit}` : String(u.count);
        if (!u.recruit && o.anim !== 'none' && el._c !== undefined && u.count > el._c) {
          const ce = el.querySelector('.c');
          ce.classList.remove('bump'); void ce.offsetWidth; ce.classList.add('bump');
        }
      }
      el._c = u.count;
      if (live(c)[i] !== el) c.insertBefore(el, live(c)[i] || null);
    });
  }

  // 効果音 (OBSのブラウザソースで鳴る。デモ/プレビューでは鳴らさない)
  function sounds(st, queue, play, o, limit) {
    if (demo || !prev) return;
    const joined = queue.some((u) => !prev.all.has(u.key));
    const promoted = play.some((u) => !u.recruit && !prev.play.has(u.key) && prev.all.has(u.key));
    const hit = play.some((u) => !u.recruit && prev.counts.has(u.key) && u.count >= limit && prev.counts.get(u.key) < limit && u.count > prev.counts.get(u.key));
    const seq = [];
    if (promoted) seq.push(o.sfxPromote);
    if (joined) seq.push(o.sfxJoin);
    if (hit) seq.push(o.sfxLimit);
    seq.forEach((n, i) => setTimeout(() => SFX.play(n, o.sfxVolume, ''), i * 350));
  }

  function render(st) {
    const o = clean(Object.assign({}, st.settings.overlay, urlOverrides()));
    const limit = st.settings.limit;
    const slots = demo ? Math.max(st.settings.slots, 3) : st.settings.slots;
    const theme = THEMES.find((t) => t.id === o.theme) || THEMES[0];

    Object.keys(theme.v).forEach((k) => root.style.setProperty(k, theme.v[k]));
    if (o.font !== 'auto') root.style.setProperty('--font', FONTS[o.font]);
    if (o.accent) root.style.setProperty('--accent', o.accent);
    root.style.setProperty('--scale', String(o.scale / 100));
    root.style.setProperty('--alpha', (o.opacity / 100 * parseFloat(theme.v['--alpha-mul'])).toFixed(3));
    const designs = (st.designs || []).concat(CARD.BUILTIN);
    const design = designs.find((x) => x.id === o.design) || CARD.BUILTIN[0];
    root.style.setProperty('--cols', String(o.columns)); root.style.setProperty('--gap', o.gap + 'px');
    const d = root.dataset; d.arrange = o.arrange;
    d.layout = o.layout; d.align = o.align; d.anim = o.anim; d.leave = o.leaveAnim; d.promote = o.promoteFx;
    d.count = o.showCount ? '1' : '0'; d.index = o.showIndex ? '1' : '0'; d.blink = o.limitBlink ? '1' : '0';

    const queue = demo ? demoQueue(limit) : st.queue;
    let play = queue.slice(0, slots);
    const wait = o.showWaiting ? queue.slice(slots, slots + o.waitingMax) : [];
    if (!demo && o.showRecruit && st.settings.accepting && !queue.length) {
      play = [{ key: '__recruit', name: `参加者募集中 ${st.settings.command}`, recruit: true, count: 0 }];
    }

    const keep = new Set(play.concat(wait).map((u) => u.key));
    els.forEach((el, k) => { if (!keep.has(k)) { dispose(el, o); els.delete(k); } });
    sync('play', play, 0, o, limit, design);
    sync('wait', wait, slots, o, limit, design);
    sounds(st, queue, play, o, limit);
    prev = { all: new Set(queue.map((u) => u.key)), play: new Set(play.map((u) => u.key)), counts: new Map(queue.map((u) => [u.key, u.count])) };

    lab.play.textContent = o.labelText; lab.play.hidden = !(o.showLabel && o.labelText && play.length && !(play[0] && play[0].recruit));
    lab.wait.textContent = o.waitLabelText; lab.wait.hidden = !(o.showLabel && o.waitLabelText && wait.length);
  }

  function connect() {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onopen = () => { prev = null; if (!demo) ws.send(JSON.stringify({ type: 'hello', role: 'overlay' })); };   // 再接続直後は演出・効果音を出さない
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === 'state') render(m.state); };
    ws.onclose = () => setTimeout(connect, 2000);
  }
  connect();
})();
