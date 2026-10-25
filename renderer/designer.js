// 「OBS見た目」タブ: テーマ/表示スタイルの選択 + ライブプレビュー
(function () {
  const { THEMES, LAYOUTS, DEFAULTS } = window.OVERLAY;
  const box = document.getElementById('designer');
  const opt = (v, t) => `<option value="${v}">${t}</option>`;
  const chk = (k, t) => `<label class="chk"><input type="checkbox" data-k="${k}">${t}</label>`;

  box.innerHTML = `
    <div class="pvwrap"><div class="pv bg-checker" id="pv"><iframe id="pvf" title="プレビュー" tabindex="-1"></iframe></div></div>
    <div class="bar"><label class="inl">プレビュー背景
      <select id="pvbg">${opt('checker', '市松')}${opt('game', 'ゲーム風')}${opt('white', '白')}${opt('green', 'グリーン')}</select></label>
      <span class="dim small">見本の名前で表示。変更はOBSにも即反映</span></div>

    <div class="gt">テーマ</div>
    <div id="rich-note" class="note" hidden>いまは「リッチカード」表示です。テーマを選ぶと通常の表示 (リスト等) に切り替わります。カードの色は「カード」タブで変えます。
      </div>
    <div id="themes" class="swatches"></div>
    <div class="gt">表示スタイル</div><div id="layouts" class="layouts"></div>

    <div class="gt">リッチカードの並べ方 <span class="dim small">(スタイル「リッチカード」用)</span></div>
    <div class="grid2">
      <label>並び<select data-k="arrange">${opt('row', '横に並べる')}${opt('column', '縦に並べる')}${opt('grid', 'グリッド')}</select></label>
      <label>列数 (グリッド時)<input type="number" data-k="columns" min="1" max="8"></label>
    </div>
    <label class="range">カードの間隔 <b data-v="gap" data-u="px"></b><input type="range" data-k="gap" min="0" max="100" step="2"></label>

    <div class="grid2">
      <label>配置<select data-k="align">${opt('left', '左')}${opt('center', '中央')}${opt('right', '右')}</select></label>
      <label>フォント<select data-k="font">${opt('auto', 'テーマ標準')}${opt('gothic', 'ゴシック')}${opt('round', '丸ゴシック')}${opt('mincho', '明朝')}${opt('mono', '等幅')}</select></label>
      <label>登場アニメ<select data-k="anim">${opt('slide', 'スライド')}${opt('pop', 'ポップ')}${opt('fade', 'フェード')}${opt('none', 'なし')}</select></label>
      <label>アクセント色<span class="bar"><input type="color" data-k="accent" value="#6ea8ff"><button id="acc-reset" class="ghost">テーマ標準</button></span></label>
    </div>

    <label class="range">サイズ <b data-v="scale"></b><input type="range" data-k="scale" min="50" max="200" step="5"></label>
    <label class="range">背景の濃さ <b data-v="opacity"></b><input type="range" data-k="opacity" min="0" max="100" step="5"></label>

    <div class="checks">
      ${chk('showCount', '回数を表示')}${chk('showLimit', '上限も表示 (1/3)')}
      ${chk('showIndex', '番号を表示')}${chk('limitBlink', '上限者を点滅')}
      ${chk('showLabel', 'ラベルを表示')}${chk('showWaiting', '待機中も表示')}
      ${chk('showRecruit', '誰もいない時「募集中」表示')}
    </div>
    <div class="grid2">
      <label>ラベル (プレイ中)<input data-k="labelText" maxlength="12"></label>
      <label>ラベル (待機中)<input data-k="waitLabelText" maxlength="12"></label>
      <label>待機の表示人数<input type="number" data-k="waitingMax" min="1" max="20"></label>
    </div>
    <div class="gt">交代時の演出</div>
    <div class="grid2">
      <label>去る人のアニメ<select data-k="leaveAnim">${opt('slide', 'スライドアウト')}${opt('fade', 'フェード')}${opt('pop', 'ポップ')}${opt('none', 'なし')}</select></label>
      <label>出番が来た人の強調<select data-k="promoteFx">${opt('flash', 'ピカッと光る')}${opt('glow', '輝く')}${opt('bounce', '跳ねる')}${opt('none', 'なし')}</select></label>
    </div>
    <div class="gt">効果音 <span class="dim small">(OBSの配信に流れます)</span></div>
    <div class="sfxs">
      <label>誰かが参加した時<span class="bar"><select data-sfx="sfxJoin"></select><button class="ghost" data-try="sfxJoin" aria-label="試聴">▶</button></span></label>
      <label>出番が来た時 (交代の後)<span class="bar"><select data-sfx="sfxPromote"></select><button class="ghost" data-try="sfxPromote" aria-label="試聴">▶</button></span></label>
      <label>上限に達した時<span class="bar"><select data-sfx="sfxLimit"></select><button class="ghost" data-try="sfxLimit" aria-label="試聴">▶</button></span></label>
    </div>
    <label class="range">効果音の音量 <b data-v="sfxVolume"></b><input type="range" data-k="sfxVolume" min="0" max="100" step="5"></label>
    <input type="file" id="sfx-file" accept="audio/*,.mp3,.wav,.ogg,.m4a" hidden>
    <p class="dim small">「ファイルを選ぶ」で好きな音声 (mp3 / wav / ogg、8MBまで) を使えます。音を出すのは1つのオーバーレイだけにしてください (複数のシーンに置くと重なって鳴ります)。
      OBSの「ブラウザソースのプロパティ → OBSで音声を制御」にチェックすると、音声ミキサーで音量を調整できます。</p>
    <div class="bar">
      <button id="copy-style">この見た目の専用URLをコピー</button>
      <button id="reset-style" class="ghost">初期設定に戻す</button>
    </div>
    <p class="dim small">専用URLは、シーンごとに別のスタイルにしたい時に使います。通常のURL/ドラッグ追加分は、ここの設定にそのまま従います。</p>`;

  const $ = (q) => box.querySelector(q);
  let urls = null, cur = DEFAULTS, lastPlain = 'list';
  const set = (patch) => api.action({ type: 'settings', settings: { overlay: patch } });

  // テーマ見本
  $('#themes').innerHTML = THEMES.map((t) => {
    const v = t.v, a = parseFloat(v['--alpha-mul']);
    const bg = a === 0 ? 'transparent' : `rgba(${v['--bg-rgb']},${Math.max(.5, a)})`;
    return `<button class="sw" data-theme="${t.id}" title="${t.name}" style="background:${bg};color:${v['--text']};border-color:${v['--accent']}">
      <span class="dot" style="background:${v['--accent']}"></span>Aa<small>${t.name}</small></button>`;
  }).join('');
  $('#layouts').innerHTML = LAYOUTS.map((l) => `<button data-layout="${l.id}"><b>${l.name}</b><small>${l.desc}</small></button>`).join('');

  box.addEventListener('click', (e) => {
    const th = e.target.closest('[data-theme]'), ly = e.target.closest('[data-layout]');
    // リッチカード表示ではテーマが効かないので、テーマを選んだら直前の通常スタイル (なければリスト) に戻す
    if (th) set(cur.layout === 'rich' ? { theme: th.dataset.theme, layout: lastPlain } : { theme: th.dataset.theme });
    else if (ly) set({ layout: ly.dataset.layout });
  });
  box.addEventListener('input', (e) => {
    const el = e.target.closest('[data-k]');
    if (!el) return;
    const k = el.dataset.k;
    const v = el.type === 'checkbox' ? el.checked : (el.type === 'range' || el.type === 'number') ? Number(el.value) : el.value;
    set({ [k]: v });
  });
  $('#acc-reset').onclick = () => set({ accent: '' });
  $('#reset-style').onclick = () => { if (confirm('OBS見た目を初期設定に戻しますか？')) set(DEFAULTS); };
  $('#copy-style').onclick = () => {
    const p = new URLSearchParams();
    Object.keys(DEFAULTS).forEach((k) => {
      let v = cur[k];
      if (typeof v === 'boolean') v = v ? '1' : '0';
      if (k === 'accent') v = String(v).replace('#', '');
      p.set(k, v);
    });
    api.copy(`${urls.overlay}?${p.toString()}`);
    const b = $('#copy-style'); const t = b.textContent; b.textContent = 'コピーしました'; setTimeout(() => (b.textContent = t), 1500);
  };

  // プレビュー (iframeを幅に合わせて縮小)
  const pv = $('#pv'), f = $('#pvf');
  const fit = () => { const w = pv.clientWidth; f.style.transform = `scale(${w / 640})`; pv.style.height = `${w * 9 / 16}px`; };
  new ResizeObserver(fit).observe(pv);
  $('#pvbg').onchange = (e) => { pv.className = `pv bg-${e.target.value}`; };
  api.urls().then((u) => { urls = u; f.src = `${u.overlay}?demo=1`; fit(); });

  // ---- 効果音 ----
  const { SOUNDS } = window.OPS;
  const sfxSel = box.querySelectorAll('[data-sfx]');
  let sfxTarget = null;
  const fillSfx = (sel, v) => {
    const custom = /^a_/.test(v) ? `<option value="${v}">取り込んだ音声</option>` : '';
    sel.innerHTML = SOUNDS.map((x) => opt(x.id, x.name)).join('') + custom + opt('__file', 'ファイルを選ぶ…');
    sel.value = v;
  };
  sfxSel.forEach((sel) => sel.addEventListener('change', () => {
    if (sel.value === '__file') { sfxTarget = sel; $('#sfx-file').click(); fillSfx(sel, cur[sel.dataset.sfx]); return; }
    set({ [sel.dataset.sfx]: sel.value });
  }));
  $('#sfx-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f || !sfxTarget) return;
    try {
      const id = await api.addAsset(f.name, new Uint8Array(await f.arrayBuffer()));
      if (!/\.(mp3|wav|ogg|m4a)$/i.test(id)) throw new Error('音声ファイル (mp3 / wav / ogg / m4a) を選んでください');
      set({ [sfxTarget.dataset.sfx]: id });
    } catch (err) { alert(err.message); }
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-try]');
    if (b) SFX.play(cur[b.dataset.try], cur.sfxVolume, urls ? urls.base : '');
  });

  // 状態 → コントロール反映
  function sync(s) {
    cur = s.settings.overlay;
    $('#rich-note').hidden = cur.layout !== 'rich';
    if (cur.layout !== 'rich') lastPlain = cur.layout;
    box.querySelectorAll('[data-k]').forEach((el) => {
      const v = cur[el.dataset.k];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.dataset.k === 'accent') el.value = v || '#6ea8ff';
      else if (document.activeElement !== el) el.value = v;
    });
    sfxSel.forEach((sel) => { if (document.activeElement !== sel && sel.dataset.last !== cur[sel.dataset.sfx]) { fillSfx(sel, cur[sel.dataset.sfx]); sel.dataset.last = cur[sel.dataset.sfx]; } });
    box.querySelectorAll('[data-v]').forEach((b) => { b.textContent = cur[b.dataset.v] + (b.dataset.u || '%'); });
    box.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('on', b.dataset.theme === cur.theme));
    box.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === cur.layout));
  }
  api.getState().then(sync);
  api.onState(sync);
})();
