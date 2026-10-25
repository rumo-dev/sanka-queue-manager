// 「参加管理」タブ: 参加条件 / ブラックリスト / 参加履歴 / 最近のできごと
(function () {
  const box = document.getElementById('people');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = (t) => (t ? new Date(t).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const TYPES = { join: '参加', swap: '交代', remove: '削除', block: 'ブロック', reject: '拒否' };

  box.innerHTML = `
    <details class="box" open><summary>参加条件</summary><div class="inner">
      <label class="chk"><input type="checkbox" data-j="restrict">視聴者の種類で制限する <span class="dim small">(コメント参加のみ)</span></label>
      <div class="checks indent" id="roles">
        <label class="chk"><input type="checkbox" data-j="sub">サブスクライバー</label>
        <label class="chk"><input type="checkbox" data-j="vip">VIP</label>
        <label class="chk"><input type="checkbox" data-j="mod">モデレーター</label>
      </div>
      <div class="grid2">
        <label>キューの最大人数 <input type="number" data-j="maxQueue" min="0" max="999" placeholder="0 = 無制限"></label>
        <label>退出後の再参加待ち (分) <input type="number" data-j="cooldownMin" min="0" max="600" placeholder="0 = なし"></label>
      </div>
      <p class="dim small">配信者本人は常に参加できます。チャンネルポイントでの参加は、ポイント交換自体が条件になるため視聴者の種類の制限は適用されません。
        「再参加待ち」は、削除・全クリアなどでキューから抜けた人が、すぐ戻ってくるのを防ぎます (交代で最後尾に回った人は対象外)。</p>
    </div></details>

    <details class="box" open><summary>ブラックリスト <span id="bl-n" class="dim small"></span></summary><div class="inner">
      <div class="bar"><input id="bl-name" placeholder="ログイン名 (例: spammer123)" maxlength="40" aria-label="ブロックする名前" style="flex:1"><button id="bl-add">ブロック</button></div>
      <ul id="bl-list" class="plist"></ul>
      <p class="dim small">ブロックした人は、コメントでもポイントでも参加できません。キューの行の「🚫」からも追加できます。</p>
    </div></details>

    <details class="box" open><summary>参加履歴 <span id="hs-n" class="dim small"></span></summary><div class="inner">
      <div class="bar"><input id="hs-q" type="search" placeholder="名前で検索" aria-label="履歴を検索" style="flex:1"><button id="hs-clear" class="ghost">履歴をリセット</button></div>
      <ul id="hs-list" class="plist"></ul>
    </div></details>

    <details class="box"><summary>最近のできごと</summary><div class="inner">
      <ul id="lg-list" class="plist log"></ul>
    </div></details>`;

  const $ = (q) => box.querySelector(q);
  let st = null, sig = '', filter = '';

  // 参加条件 (入力するたびに保存)
  box.addEventListener('input', (e) => {
    const el = e.target.closest('[data-j]');
    if (!el) return;
    const v = el.type === 'checkbox' ? el.checked : Number(el.value || 0);
    api.action({ type: 'settings', settings: { joinRules: { [el.dataset.j]: v } } });
  });

  const addBlock = () => {
    const v = $('#bl-name').value.trim();
    if (!v) return;
    api.action({ type: 'block', name: v, key: v });
    $('#bl-name').value = '';
  };
  $('#bl-add').onclick = addBlock;
  $('#bl-name').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) addBlock(); });
  $('#hs-q').addEventListener('input', (e) => { filter = e.target.value.trim().toLowerCase(); sig = ''; render(st); });
  $('#hs-clear').onclick = () => { if (confirm('参加履歴と「最近のできごと」を消しますか？ (ブラックリストは残ります)')) api.action({ type: 'clearHistory' }); };

  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-do]');
    if (!b) return;
    const k = b.dataset.k, n = b.dataset.n;
    if (b.dataset.do === 'unblock') api.action({ type: 'unblock', key: k });
    else if (b.dataset.do === 'block') api.action({ type: 'block', key: k, name: n });
    else if (b.dataset.do === 'add') api.action({ type: 'add', name: n });
  });

  function render(s) {
    if (!s) return;
    st = s;
    const r = s.settings.joinRules;
    box.querySelectorAll('[data-j]').forEach((el) => {
      if (document.activeElement === el) return;
      if (el.type === 'checkbox') el.checked = !!r[el.dataset.j]; else el.value = r[el.dataset.j] || '';
    });
    $('#roles').classList.toggle('off', !r.restrict);
    $('#roles').querySelectorAll('input').forEach((i) => { i.disabled = !r.restrict; });

    const inQ = new Set(s.queue.map((u) => u.key));
    const next = JSON.stringify([s.blacklist, s.history, s.log, [...inQ], filter]);
    if (next === sig) return;   // 履歴に関係ない更新 (＋1 など) では作り直さない
    sig = next;

    $('#bl-n').textContent = s.blacklist.length ? `(${s.blacklist.length}人)` : '';
    $('#bl-list').innerHTML = s.blacklist.length ? s.blacklist.map((b) =>
      `<li><span class="nm" title="${esc(b.key)}">${esc(b.name)}</span><span class="dim small">${when(b.at)}</span>
       <button data-do="unblock" data-k="${esc(b.key)}">解除</button></li>`).join('') : '<li class="dim small">いません</li>';

    const h = s.history.filter((x) => !filter || x.name.toLowerCase().includes(filter) || x.key.includes(filter));
    $('#hs-n').textContent = s.history.length ? `(${s.history.length}人)` : '';
    $('#hs-list').innerHTML = h.length ? h.map((x) => {
      const cur = (s.queue.find((u) => u.key === x.key) || {}).count || 0;
      return `<li><span class="nm" title="${esc(x.key)}">${esc(x.name)}</span>
        <span class="dim small">参加${x.joins}回 ・ 通算${x.total + cur}プレイ ・ ${when(x.lastAt)}</span>
        ${inQ.has(x.key) ? '<span class="dim small tag">参加中</span>' : `<button data-do="add" data-n="${esc(x.name)}" title="キューに追加">＋</button>`}
        ${x.blocked ? `<button data-do="unblock" data-k="${esc(x.key)}">解除</button>` : `<button class="ghost" data-do="block" data-k="${esc(x.key)}" data-n="${esc(x.name)}" title="ブロック">🚫</button>`}</li>`;
    }).join('') : `<li class="dim small">${s.history.length ? '見つかりません' : 'まだ履歴がありません。参加者が来るとここに貯まります'}</li>`;

    $('#lg-list').innerHTML = s.log.length ? s.log.map((e) =>
      `<li class="lg-${esc(e.type)}"><span class="dim small">${when(e.t)}</span><span class="tag">${TYPES[e.type] || esc(e.type)}</span>
       <span class="nm">${esc(e.name)}</span><span class="dim small">${esc(e.note)}</span></li>`).join('') : '<li class="dim small">まだありません</li>';
  }
  api.getState().then(render);
  api.onState(render);
})();
