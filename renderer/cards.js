// 「カード」タブ: リッチカードのデザイン選択 + エディタ (ドラッグで配置 / 自動保存)
(function () {
  const C = window.CARD;
  const box = document.getElementById('cards');
  const FONT_OPTS = [['gothic', 'ゴシック'], ['round', '丸ゴシック'], ['mincho', '明朝'], ['mono', '等幅']];
  const ALIGN = [['left', '左'], ['center', '中央'], ['right', '右']];
  const SECTIONS = [
    { t: 'カード', open: true, f: [
      ['w', '幅', 'range', 40, 900], ['h', '高さ', 'range', 24, 600], ['radius', '角丸', 'range', 0, 200], ['accent', 'アクセント色', 'color']] },
    { t: '背景', f: [
      ['bg.color', '背景色', 'color'], ['bg.alpha', '背景の濃さ', 'range', 0, 100], ['bg.image', '背景画像', 'image', 'bg'],
      ['bg.fit', '画像の表示', 'select', [['cover', '全面に拡大'], ['contain', '全体を収める'], ['stretch', '引き伸ばし'], ['tile', 'タイル']]],
      ['bg.imageAlpha', '画像の濃さ', 'range', 0, 100], ['bg.imageBlur', '画像のぼかし', 'range', 0, 20]] },
    { t: 'アイコン (参加者のプロフィール画像)', f: [
      ['avatar.show', '表示する', 'chk'], ['avatar.shape', '形', 'select', [['circle', '円'], ['rounded', '角丸'], ['square', '四角'], ['hexagon', '六角形'], ['diamond', 'ひし形']]],
      ['avatar.size', '大きさ', 'range', 8, 300], ['avatar.x', '位置 X', 'range', -100, 800], ['avatar.y', '位置 Y', 'range', -100, 600],
      ['avatar.ring', '縁', 'select', [['none', 'なし'], ['solid', '単色'], ['double', '二重'], ['rainbow', 'レインボー'], ['glow', '発光']]],
      ['avatar.ringWidth', '縁の太さ', 'range', 1, 16], ['avatar.ringColor', '縁の色', 'coloropt'],
      ['avatar.frameImage', 'アイコン用フレーム画像 (透過PNG)', 'image', 'frame'], ['avatar.frameScale', 'フレーム画像の大きさ', 'range', 100, 220]] },
    { t: 'フレーム (カード全体)', f: [
      ['frame.style', '種類', 'select', [['none', 'なし'], ['solid', '単色'], ['double', '二重線'], ['inset', 'くぼみ'], ['gold', 'ゴールド'], ['neon', 'ネオン'], ['pixel', 'ドット絵'], ['corners', '四隅']]],
      ['frame.width', '太さ', 'range', 1, 16], ['frame.color', '色', 'coloropt'],
      ['frame.image', 'フレーム画像 (透過PNG)', 'image', 'frame'], ['frame.slice', '角を固定して伸ばす (px / 0=全体伸縮)', 'range', 0, 150]] },
    { t: '名前', f: [
      ['name.show', '表示する', 'chk'], ['name.size', '文字サイズ', 'range', 8, 120], ['name.x', '位置 X', 'range', -100, 800], ['name.y', '位置 Y', 'range', -100, 600],
      ['name.w', '幅', 'range', 20, 800], ['name.font', 'フォント', 'select', FONT_OPTS], ['name.weight', '太さ', 'select', [['400', '標準'], ['700', '太字'], ['900', '極太']]],
      ['name.align', '揃え', 'select', ALIGN], ['name.color', '文字色', 'color'], ['name.outline', '縁取り', 'range', 0, 8], ['name.outlineColor', '縁取りの色', 'color']] },
    { t: '回数', f: [
      ['count.show', '表示する', 'chk'], ['count.style', '形', 'select', [['text', '文字'], ['badge', 'バッジ']]], ['count.format', '書式', 'select', [['both', '2/3'], ['num', '2']]],
      ['count.size', '文字サイズ', 'range', 8, 120], ['count.x', '位置 X', 'range', -100, 800], ['count.y', '位置 Y', 'range', -100, 600], ['count.w', '幅', 'range', 20, 800],
      ['count.font', 'フォント', 'select', FONT_OPTS], ['count.align', '揃え', 'select', ALIGN], ['count.color', '文字色', 'color'],
      ['count.badgeColor', 'バッジの色', 'coloropt'], ['count.outline', '縁取り', 'range', 0, 8], ['count.outlineColor', '縁取りの色', 'color']] },
    { t: '上限・超過のときの表現', f: [
      ['state.warn', '上限に達した時の色', 'color'], ['state.over', '超過した時の色', 'color'],
      ['state.frame', 'フレームの色を変える', 'chk'], ['state.ring', 'アイコンの縁の色を変える', 'chk'], ['state.count', '回数の色を変える', 'chk'],
      ['state.name', '名前の色を変える', 'chk'], ['state.glow', 'カードを光らせる', 'chk'], ['state.blink', '点滅させる', 'chk']] },
  ];

  box.innerHTML = `
    <div class="cardpv">
      <div class="cpv" id="cpv"></div>
      <div class="bar"><div class="seg" id="pvst"><button data-s="normal" class="on">通常</button><button data-s="limit">上限</button><button data-s="over">超過</button></div>
        <span class="dim small">アイコン・名前・回数はドラッグで動かせます</span></div>
    </div>
    <div class="gt">デザインを選ぶ <span class="dim small">(選ぶとOBSに反映)</span></div>
    <div id="gallery" class="gallery"></div>
    <div class="bar"><button id="c-new">＋ 新規作成</button><button id="c-import">ファイルから読み込み</button></div>
    <p class="dim small">並べ方(横/縦/グリッド)や間隔は「OBS見た目」タブで設定します。ビルトインを編集すると、自動で「カスタム」として複製・保存されます。</p>
    <div class="gt">編集 <span class="dim small">(変更は自動保存)</span></div>
    <div id="ed"></div>
    <input type="file" id="c-file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" hidden>`;

  const $ = (q) => box.querySelector(q);
  const cpv = $('#cpv');
  let urls = null, st = null, draft = null, pvState = 'normal', saveT = null, pending = 0, chain = Promise.resolve(), galleryKey = '', uploadTarget = null, drag = null, pvScale = 1;

  const ctx = () => ({ art: '../web/art/', user: urls.overlay.replace(/\/overlay$/, '/user/') });
  const getp = (o, p) => p.split('.').reduce((a, k) => a[k], o);
  const setp = (o, p, v) => { const ks = p.split('.'); const l = ks.pop(); ks.reduce((a, k) => a[k], o)[l] = v; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isCustom = () => draft && draft.id && !draft.id.startsWith('b-');
  const allDesigns = () => (st.designs || []).concat(C.BUILTIN);
  const sample = (i = 0, n) => ({ name: ['さくら', 'Taro_Gamer', 'ゲーマーふじ'][i], count: n === undefined ? 1 : n, avatar: ctx().art + `avatar-${i + 1}.svg` });
  const pvUser = () => sample(0, { normal: 1, limit: 3, over: 4 }[pvState]);

  // ---------- エディタUI ----------
  function fieldHTML([p, label, type, a, b]) {
    const d = `data-p="${p}"`;
    if (type === 'range') return `<label class="range">${label} <b data-vv="${p}"></b><input type="range" ${d} min="${a}" max="${b}" step="1"></label>`;
    if (type === 'chk') return `<label class="chk"><input type="checkbox" ${d}>${label}</label>`;
    if (type === 'select') return `<label>${label}<select ${d}>${a.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`;
    if (type === 'color') return `<label>${label}<input type="color" ${d} data-t="color"></label>`;
    if (type === 'coloropt') return `<label>${label}<span class="bar"><input type="color" ${d} data-t="color"><label class="chk"><input type="checkbox" data-auto="${p}">自動</label></span></label>`;
    if (type === 'image') return `<label>${label}<span class="bar"><select ${d} data-t="image" data-kind="${a}"></select><button data-up="${p}">画像を選ぶ</button></span></label>`;
    return '';
  }
  function buildEditor() {
    $('#ed').innerHTML = `
      <label>デザイン名<input data-p="title" maxlength="30"></label>
      ${SECTIONS.map((s) => `<details class="box sec" ${s.open ? 'open' : ''}><summary>${s.t}</summary><div class="inner">${s.f.map(fieldHTML).join('')}</div></details>`).join('')}
      <div class="bar">
        <button id="c-dup">複製</button><button id="c-exp">書き出し</button><button id="c-del" class="ghost">削除</button>
      </div>`;
    syncValues();
  }

  function imageOptions(el) {
    const cur = getp(draft, el.dataset.p);
    const o = [['', 'なし']];
    if (el.dataset.kind === 'bg') C.ART.forEach((x) => o.push([x.ref, x.name]));
    if (cur && cur.startsWith('a_')) o.push([cur, 'アップロード画像']);
    el.innerHTML = o.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    el.value = cur || '';
  }

  function syncValues() {
    if (!draft) return;
    box.querySelectorAll('#ed [data-p]').forEach((el) => {
      const v = getp(draft, el.dataset.p);
      if (el.dataset.t === 'image') imageOptions(el);
      else if (el.type === 'checkbox') el.checked = !!v;
      else if (el.dataset.t === 'color') el.value = v || (getp(draft, 'accent') || '#6ea8ff');
      else if (document.activeElement !== el || el.type === 'range') el.value = v;
    });
    box.querySelectorAll('#ed [data-auto]').forEach((el) => { el.checked = !getp(draft, el.dataset.auto); });
    box.querySelectorAll('#ed [data-vv]').forEach((b) => { b.textContent = getp(draft, b.dataset.vv); });
    const custom = isCustom();
    $('#c-del').disabled = !custom; $('#c-exp').disabled = !custom;
  }

  // ---------- 編集の反映 / 保存 ----------
  function ensureCustom() {
    if (draft.id && !draft.id.startsWith('b-')) return;
    draft.id = ''; if (!/\(カスタム\)$/.test(draft.title)) draft.title = (draft.title + ' (カスタム)').slice(0, 30);
  }
  function edit(fn) { ensureCustom(); fn(draft); refreshPreview(); syncValues(); scheduleSave(); }
  function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(save, 350); }
  function save() {
    clearTimeout(saveT); saveT = null; pending++;
    chain = chain.then(async () => {
      const sel = !draft.id;
      const id = await api.saveDesign(clone(draft), sel);
      if (!draft.id) draft.id = id;
    }).catch((e) => alert(e.message)).finally(() => { pending--; });
    return chain;
  }
  const flush = () => (saveT ? save() : chain);

  box.addEventListener('input', (e) => {
    const el = e.target.closest('[data-p]');
    if (!el || !draft || !el.closest('#ed')) return;
    const p = el.dataset.p;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'range') v = Number(el.value);
    else v = el.value;
    if (el.dataset.t === 'color') { // 色を選んだら「自動」を解除
      const auto = box.querySelector(`[data-auto="${p}"]`); if (auto) auto.checked = false;
    }
    edit((d) => setp(d, p, v));
  });
  box.addEventListener('change', (e) => {
    const a = e.target.closest('[data-auto]');
    if (a && a.checked) edit((d) => setp(d, a.dataset.auto, ''));
  });

  // 画像アップロード
  box.addEventListener('click', (e) => {
    const up = e.target.closest('[data-up]');
    if (up) { uploadTarget = up.dataset.up; $('#c-file').value = ''; $('#c-file').click(); }
  });
  $('#c-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f || !uploadTarget) return;
    try {
      const id = await api.addAsset(f.name, new Uint8Array(await f.arrayBuffer()));
      const p = uploadTarget; edit((d) => setp(d, p, id));
    } catch (err) { alert(err.message); }
  });

  // ---------- プレビュー ----------
  function refreshPreview() {
    if (!draft || !urls) return;
    const d = C.sanitize(draft);
    const el = C.build(d, ctx()); el.classList.add('editing'); C.update(el, pvUser(), 3);
    pvScale = Math.min((cpv.clientWidth - 16) / d.w, 200 / d.h, 2.5);
    const stage = document.createElement('div'); stage.className = 'stage';
    stage.style.cssText = `width:${d.w}px;height:${d.h}px;transform:scale(${pvScale});left:${(cpv.clientWidth - d.w * pvScale) / 2}px;top:${(220 - d.h * pvScale) / 2}px`;
    stage.appendChild(el); cpv.replaceChildren(stage);
  }
  new ResizeObserver(refreshPreview).observe(cpv);
  $('#pvst').addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    pvState = b.dataset.s; $('#pvst').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); refreshPreview();
  });

  // ドラッグで配置
  cpv.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.av,.nm,.ct');
    if (!t || !draft) return;
    const key = t.classList.contains('av') ? 'avatar' : t.classList.contains('nm') ? 'name' : 'count';
    ensureCustom();
    drag = { key, sx: e.clientX, sy: e.clientY, ox: draft[key].x, oy: draft[key].y };
    cpv.setPointerCapture(e.pointerId);
  });
  cpv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const clamp = (v) => Math.max(-100, Math.min(1000, Math.round(v)));
    draft[drag.key].x = clamp(drag.ox + (e.clientX - drag.sx) / pvScale);
    draft[drag.key].y = clamp(drag.oy + (e.clientY - drag.sy) / pvScale);
    refreshPreview(); syncValues();
  });
  const endDrag = () => { if (drag) { drag = null; scheduleSave(); } };
  cpv.addEventListener('pointerup', endDrag); cpv.addEventListener('pointercancel', endDrag);

  // ---------- ギャラリー ----------
  function renderGallery() {
    const cur = st.settings.overlay.design;
    const key = JSON.stringify([st.designs, cur]);
    if (key === galleryKey) return; galleryKey = key;
    $('#gallery').innerHTML = '';
    allDesigns().forEach((d) => {
      const b = document.createElement('button');
      b.className = 'gi' + (d.id === cur ? ' on' : ''); b.dataset.id = d.id;
      const th = document.createElement('div'); th.className = 'gthumb';
      const el = C.build(d, ctx()); C.update(el, sample(0, 1), 3);
      el.style.cssText += `;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(${Math.min(150 / d.w, 76 / d.h, 1)})`;
      th.appendChild(el);
      const n = document.createElement('span'); n.textContent = d.title + (d.id.startsWith('b-') ? '' : ' ★');
      b.append(th, n); $('#gallery').appendChild(b);
    });
  }
  $('#gallery').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    await flush();
    api.action({ type: 'settings', settings: { overlay: { design: b.dataset.id, layout: 'rich' } } });
  });

  // ---------- ボタン ----------
  $('#c-new').onclick = async () => {
    await flush(); draft = C.sanitize({ title: '新しいカード' }); draft.id = '';
    buildEditor(); refreshPreview(); save();
  };
  $('#c-import').onclick = async () => {
    try { await flush(); const r = await api.importDesign(); if (r && r.ok) galleryKey = ''; } catch (e) { alert(e.message); }
  };
  box.addEventListener('click', async (e) => {
    if (e.target.closest('#c-dup')) { await flush(); draft.id = ''; draft.title = (draft.title.replace(/ \((コピー|カスタム)\)$/, '') + ' (コピー)').slice(0, 30); syncValues(); save(); }
    else if (e.target.closest('#c-exp') && isCustom()) { await flush(); try { await api.exportDesign(draft.id); } catch (err) { alert(err.message); } }
    else if (e.target.closest('#c-del') && isCustom()) { if (confirm(`「${draft.title}」を削除しますか？`)) { const id = draft.id; draft = null; await api.deleteDesign(id); } }
  });

  // ---------- 状態の反映 ----------
  function onState(s) {
    st = s;
    if (!urls) return;
    renderGallery();
    const cur = allDesigns().find((d) => d.id === s.settings.overlay.design) || C.BUILTIN[0];
    if (pending === 0 && !saveT && !drag && (!draft || draft.id !== cur.id)) {
      draft = clone(cur); buildEditor(); refreshPreview();
    }
  }
  api.urls().then((u) => { urls = u; api.getState().then(onState); });
  api.onState(onState);
})();
