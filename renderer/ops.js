// 「操作・通知」(ホットキー / 音 / ミニ表示) と「アプリについて・アップデート」
(function () {
  const { HOTKEYS, SOUNDS, UI_DEFAULTS } = window.OPS;
  const $ = (id) => document.getElementById(id);
  const opt = (v, t) => `<option value="${v}">${t}</option>`;
  const mac = /Mac/i.test(navigator.platform);

  // ---------- 操作・通知 ----------
  $('ops').innerHTML = `
    <div class="gt">ミニ表示</div>
    <p class="dim small">別モニターの端に小さく置いて使うための表示です。キューの操作ボタンだけを残し、常に最前面になります。</p>
    <div class="bar"><button id="ops-mini">▣ ミニ表示にする</button>
      <label class="chk"><input type="checkbox" id="ops-pin">通常表示でも最前面に固定</label></div>

    <div class="gt">音で知らせる <span class="dim small">(このアプリを開いている側で鳴ります。OBSの配信には入りません)</span></div>
    <div class="grid2">
      <label>誰かが参加した時<span class="bar"><select data-snd="join">${SOUNDS.map((x) => opt(x.id, x.name)).join('')}</select><button class="ghost" data-try="join" aria-label="試聴">▶</button></span></label>
      <label>プレイ中の人が上限に達した時<span class="bar"><select data-snd="limit">${SOUNDS.map((x) => opt(x.id, x.name)).join('')}</select><button class="ghost" data-try="limit" aria-label="試聴">▶</button></span></label>
    </div>
    <label class="range">音量 <b id="snd-vol-v"></b><input type="range" id="snd-vol" min="0" max="100" step="5"></label>

    <div class="gt">ホットキー <span class="dim small">(ゲーム中など、このアプリが裏にあっても操作できます)</span></div>
    <label class="chk"><input type="checkbox" id="hk-on">ホットキーを使う</label>
    <div id="hk-rows" class="hk"></div>
    <p class="dim small">欄をクリックして、使いたいキーの組み合わせを押してください。Backspaceで無効化。他のアプリと重なると登録できないことがあります。</p>
    <div class="bar"><button id="hk-reset" class="ghost">ホットキーを初期値に戻す</button></div>`;

  $('hk-rows').innerHTML = HOTKEYS.map((h) =>
    `<div class="hkr"><span>${h.label}</span><input readonly data-hk="${h.id}" aria-label="${h.label}のホットキー" placeholder="(なし)"><button class="ghost" data-hkx="${h.id}" aria-label="無効にする" title="無効にする">✕</button></div>`).join('');

  const setUi = (ui) => api.action({ type: 'settings', settings: { ui } });
  let ui = UI_DEFAULTS, base = '';
  api.urls().then((u) => { base = u.base; });

  $('ops-mini').onclick = () => api.setMini(true);
  $('ops-pin').onchange = (e) => api.setPinned(e.target.checked);
  api.onPinned((v) => { $('ops-pin').checked = v; });
  api.uiFlags().then((f) => { $('ops-pin').checked = f.pinned; });

  $('ops').addEventListener('change', (e) => {
    const sn = e.target.closest('[data-snd]');
    if (sn) setUi({ sound: { [sn.dataset.snd]: sn.value } });
  });
  $('snd-vol').addEventListener('input', (e) => setUi({ sound: { volume: Number(e.target.value) } }));
  $('ops').addEventListener('click', (e) => {
    const tr = e.target.closest('[data-try]');
    if (tr) SFX.play($('ops').querySelector(`[data-snd="${tr.dataset.try}"]`).value, ui.sound.volume || 60, base);
    const x = e.target.closest('[data-hkx]');
    if (x) setUi({ hotkeys: { map: { [x.dataset.hkx]: '' } } });
  });
  $('hk-on').onchange = (e) => setUi({ hotkeys: { enabled: e.target.checked } });
  $('hk-reset').onclick = () => setUi({ hotkeys: { map: UI_DEFAULTS.hotkeys.map } });

  // キー入力 → Electronのアクセラレータ表記
  const CODE = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Space: 'Space', Enter: 'Return', Tab: 'Tab',
    Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert', Delete: 'Delete', Minus: 'Minus', Equal: 'Plus' };
  function accel(e) {
    const c = e.code; let key = null;
    if (/^Key[A-Z]$/.test(c)) key = c.slice(3);
    else if (/^Digit\d$/.test(c)) key = c.slice(5);
    else if (/^F\d{1,2}$/.test(c)) key = c;
    else if (/^Numpad\d$/.test(c)) key = 'num' + c.slice(6);
    else if (CODE[c]) key = CODE[c];
    if (!key) return null;
    const mods = [];
    if (e.ctrlKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.metaKey) mods.push(mac ? 'Command' : 'Super');
    if (!mods.length && !/^F\d{1,2}$/.test(key)) return false;   // 修飾キーなしの通常キーは奪わない
    return mods.concat(key).join('+');
  }
  $('hk-rows').addEventListener('keydown', (e) => {
    const inp = e.target.closest('[data-hk]');
    if (!inp || e.isComposing) return;
    if (e.key === 'Tab') return;
    e.preventDefault();
    if (e.key === 'Escape') return inp.blur();
    if (e.key === 'Backspace' || e.key === 'Delete') return setUi({ hotkeys: { map: { [inp.dataset.hk]: '' } } });
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    const a = accel(e);
    if (a === false) { inp.placeholder = 'Ctrl / Alt などと一緒に押してください'; return; }
    if (a) setUi({ hotkeys: { map: { [inp.dataset.hk]: a } } });
  });
  $('hk-rows').addEventListener('blur', (e) => { if (e.target.placeholder) e.target.placeholder = '(なし)'; }, true);

  function syncOps(s) {
    ui = s.settings.ui;
    document.querySelectorAll('[data-snd]').forEach((el) => { el.value = ui.sound[el.dataset.snd]; });
    $('snd-vol').value = ui.sound.volume; $('snd-vol-v').textContent = ui.sound.volume + '%';
    $('hk-on').checked = ui.hotkeys.enabled;
    const used = {};
    Object.values(ui.hotkeys.map).forEach((a) => { if (a) used[a] = (used[a] || 0) + 1; });
    document.querySelectorAll('[data-hk]').forEach((el) => {
      const a = ui.hotkeys.map[el.dataset.hk];
      el.value = a; el.classList.toggle('dup', !!a && used[a] > 1);
      el.title = a && used[a] > 1 ? '他の操作と同じキーです' : '';
      el.disabled = !ui.hotkeys.enabled;
    });
    document.querySelectorAll('[data-hkx]').forEach((b) => { b.disabled = !ui.hotkeys.enabled; });
    $('hk-reset').disabled = !ui.hotkeys.enabled;
  }

  // ---------- アップデート ----------
  $('upd').innerHTML = `
    <p>バージョン <b id="upd-ver">-</b></p>
    <label class="chk"><input type="checkbox" id="upd-auto">新しいバージョンを自動で確認・ダウンロードする</label>
    <p id="upd-msg" class="small"></p>
    <div class="bar"><button id="upd-check">今すぐ確認</button><button id="upd-install" class="primary" hidden>再起動して更新</button><button id="upd-rel" class="ghost" hidden>配布ページを開く</button></div>`;
  $('upd-auto').onchange = (e) => api.action({ type: 'settings', settings: { autoUpdate: e.target.checked } });
  $('upd-check').onclick = () => api.checkUpdate();
  $('upd-install').onclick = () => api.installUpdate();
  $('upd-rel').onclick = () => api.openReleases();

  const banner = $('upd-banner');
  function showUpdate(u) {
    const text = {
      checking: '更新を確認中…', latest: '最新バージョンです',
      downloading: `新しいバージョン v${u.version} をダウンロード中… ${u.percent}%`,
      ready: `v${u.version} をダウンロードしました。再起動すると更新されます`,
      error: `更新を確認できませんでした${u.message ? ': ' + u.message : ''}`,
      disabled: u.message || '', idle: '',
    }[u.state] || '';
    $('upd-msg').textContent = text;
    $('upd-msg').className = 'small ' + (u.state === 'error' ? 'err' : u.state === 'ready' ? 'ok' : 'dim');
    $('upd-install').hidden = u.state !== 'ready';
    $('upd-check').disabled = u.state === 'checking' || u.state === 'downloading' || u.state === 'disabled';
    banner.hidden = !(u.state === 'ready' || u.state === 'downloading');
    if (!banner.hidden) {
      banner.innerHTML = u.state === 'ready'
        ? `<span>🎉 v${u.version} に更新できます</span><button class="primary" id="banner-install">再起動して更新</button>`
        : `<span>⬇ v${u.version} をダウンロード中 ${u.percent}%</span>`;
      const b = $('banner-install'); if (b) b.onclick = () => api.installUpdate();
    }
  }
  api.urls().then((u) => { $('upd-ver').textContent = 'v' + u.version; $('upd-rel').hidden = !u.releases; });
  api.updateState().then(showUpdate);
  api.onUpdate(showUpdate);

  const sync = (s) => { syncOps(s); if (document.activeElement !== $('upd-auto')) $('upd-auto').checked = s.settings.autoUpdate; };
  api.getState().then(sync);
  api.onState(sync);
})();
