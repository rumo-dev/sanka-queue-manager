const $ = (id) => document.getElementById(id);
const fields = ['clientId', 'platform', 'youtubeVideo', 'mode', 'command', 'rewardTitle'];
let urls, formLoaded = false;

Panel.mount($('queue'), {
  onState: (cb) => { api.getState().then(cb); api.onState(cb); },
  action: (a) => api.action(a),
}, { sound: true });

// キューパネルの右端に「ミニ表示」「最前面」ボタン (別モニターの端に小さく置く用)
$('queue').querySelector('.bar.top').insertAdjacentHTML('beforeend',
  `<span class="grow"></span>
   <button id="btn-pin" class="ghost" aria-pressed="false" title="常に最前面に固定">📌</button>
   <button id="btn-mini" title="ミニ表示 (小さく・常に最前面)  [ホットキーでも切替可]">▣ ミニ</button>`);
let isMini = false;
$('btn-mini').onclick = () => api.setMini(!isMini);
$('btn-pin').onclick = () => api.setPinned($('btn-pin').getAttribute('aria-pressed') !== 'true');
api.onMini((v) => {
  isMini = v;
  document.body.classList.toggle('mini', v);
  $('btn-mini').textContent = v ? '▢ 元の大きさ' : '▣ ミニ';
});
api.onPinned((v) => { $('btn-pin').setAttribute('aria-pressed', String(v)); $('btn-pin').classList.toggle('on', v); });
api.uiFlags().then((f) => { $('btn-pin').setAttribute('aria-pressed', String(f.pinned)); $('btn-pin').classList.toggle('on', f.pinned); });

function onState(s) {
  $('login-state').textContent = s.user ? `ログイン中: ${s.user}` : '未ログイン';
  $('status').textContent = s.status || '';
  $('login').hidden = !!s.user;
  $('logout').hidden = !s.user;
  if (!formLoaded) { // 入力中の値を上書きしないよう初回のみ反映
    fields.forEach((f) => { $(f).value = s.settings[f]; });
    formLoaded = true;
    updatePlatformFields();
  }
}
api.getState().then(onState);
api.onState(onState);

api.urls().then((u) => {
  urls = u;
  $('redirect').textContent = u.redirect;
  $('ovl').title = u.overlay;
});

// ファイルとしてドラッグ → OBSのソース一覧/プレビューへドロップ
$('ovl').addEventListener('dragstart', (e) => { e.preventDefault(); api.startDrag(); });
$('ovl').addEventListener('click', (e) => e.preventDefault());

const flash = (el, t) => { el.textContent = t; setTimeout(() => (el.textContent = ''), 1800); };
$('copy-ovl').onclick = () => api.copy(urls.overlay);
$('copy-dck').onclick = () => api.copy(urls.dock);

$('save').onclick = async () => {
  const settings = Object.fromEntries(fields.map((f) => [f, $(f).value.trim()]));
  await api.action({ type: 'settings', settings });
  flash($('saved'), '保存しました');
};
function updatePlatformFields() {
  const platform = $('platform').value;
  const youtube = platform === 'youtube';
  const youtubeEnabled = youtube || platform === 'both';
  $('youtube-row').hidden = !youtubeEnabled;
  $('youtube-note').hidden = !youtubeEnabled;
  $('reward-row').hidden = youtube;
  if (youtube && $('mode').value !== 'chat') $('mode').value = 'chat';
  $('mode').disabled = youtube;
}
$('platform').onchange = updatePlatformFields;
$('login').onclick = async () => {
  await $('save').onclick();
  const r = await api.login();
  if (!r.ok) $('status').textContent = r.error;
};
$('logout').onclick = () => api.logout();
updatePlatformFields();

// サイドバーのタブ切り替え
document.querySelectorAll('.tab').forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
    document.querySelectorAll('.pane').forEach((p) => { p.hidden = p.id !== t.dataset.pane; });
    t.blur();   // フォーカスを残すとSpaceなどのショートカットが効かなくなるため
  };
});
