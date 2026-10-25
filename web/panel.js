// 共有キューパネル (アプリ本体 / OBSドック)。transport = { onState(cb), action(a) }
// opts.sound: true で音通知 (アプリ本体のみ)
(function () {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.Panel = {
    mount(root, t, opts = {}) {
      let s = null, sel = '', prev = null, lastNotice = null, toastTimer = 0;
      const fresh = new Map();   // key -> 参加した時刻 (新着ハイライト用)
      root.classList.add('panel');
      root.innerHTML = `
        <div class="bar top">
          <button class="acc" data-a="accept" title="参加の受付 ON / OFF  [R]"></button>
          <div class="step">上限 <button data-a="limit" data-d="-1" aria-label="上限を減らす">−</button><b class="v-limit"></b><button data-a="limit" data-d="1" aria-label="上限を増やす">＋</button></div>
          <div class="step">枠 <button data-a="slots" data-d="-1" aria-label="枠を減らす">−</button><b class="v-slots"></b><button data-a="slots" data-d="1" aria-label="枠を増やす">＋</button></div>
        </div>
        <div class="bar actions">
          <button class="big all" data-a="plus1All" title="プレイ中の全員の回数を +1  [Space]">全員 ＋1</button>
          <button class="big swapall" data-a="swapLimit" title="上限に達したプレイ中の人を全員、最後尾へ  [S]">上限者を交代</button>
          <button class="big rmall" data-a="removeLimit" title="上限に達したプレイ中の人を全員、キューから削除 (元に戻せます)  [D]">上限者を削除</button>
          <button class="undo" data-a="undo" title="直前の操作を取り消す  [Z]">↶ 元に戻す</button>
        </div>
        <div class="sum"></div>
        <ul class="list"></ul>
        <div class="bar foot">
          <input class="add-name" placeholder="名前を手動で追加" maxlength="40" aria-label="手動で追加する名前">
          <button data-a="addBtn">追加</button>
          <button class="ghost" data-a="clear">全クリア</button>
        </div>
        <details class="keys"><summary>⌨ キーボード操作</summary>
          <dl>
            <dt>Space</dt><dd>全員 ＋1</dd><dt>S</dt><dd>上限者を交代</dd><dt>D</dt><dd>上限者を削除</dd><dt>N</dt><dd>先頭の人を交代</dd>
            <dt>Z</dt><dd>元に戻す</dd><dt>R</dt><dd>受付 ON/OFF</dd>
            <dt>↑ ↓</dt><dd>行を選ぶ (クリックでも選べます)</dd><dt>Enter</dt><dd>選んだ人を ＋1</dd>
            <dt>X</dt><dd>選んだ人を交代</dd><dt>Delete</dt><dd>選んだ人を削除</dd><dt>B</dt><dd>選んだ人をブロック</dd>
          </dl></details>
        <div class="toast" role="status" aria-live="polite" hidden></div>`;
      const $ = (q) => root.querySelector(q);
      const input = $('.add-name');
      const act = (a) => t.action(a);
      const addName = () => { const v = input.value.trim(); if (v) { act({ type: 'add', name: v }); input.value = ''; } };

      function toast(text, kind) {
        const el = $('.toast');
        el.textContent = text; el.className = 'toast ' + (kind || 'info'); el.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
      }

      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]');
        if (!b) {
          const row = e.target.closest('.row');
          if (row && row.dataset.k) { sel = sel === row.dataset.k ? '' : row.dataset.k; if (s) render(s); }
          return;
        }
        if (!s || b.disabled) return;
        const a = b.dataset.a, key = b.dataset.k, d = Number(b.dataset.d || 0);
        if (a === 'accept') act({ type: 'accept', value: !s.settings.accepting });
        else if (a === 'limit') act({ type: 'settings', settings: { limit: Math.max(1, s.settings.limit + d) } });
        else if (a === 'slots') act({ type: 'settings', settings: { slots: Math.max(1, s.settings.slots + d) } });
        else if (a === 'addBtn') { addName(); return; }
        else if (a === 'clear') { if (confirm('キューを全てクリアしますか？ (元に戻すで復元できます)')) act({ type: 'clear' }); }
        else act({ type: a, key });
        b.blur();   // クリック後はフォーカスを外し、Spaceなどのショートカットがそのまま効くようにする
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) addName();
        if (e.key === 'Escape') input.blur();
      });

      // ---- キーボード操作 ----
      document.addEventListener('keydown', (e) => {
        if (!s || e.isComposing || e.defaultPrevented) return;
        if (document.body.classList.contains('modal-open')) return;
        const tg = e.target;
        if (tg && tg.closest && tg.closest('input,select,textarea,button,summary,a,[contenteditable]')) return;
        if (e.altKey || (e.ctrlKey || e.metaKey) && e.key.toLowerCase() !== 'z') return;
        const k = e.key.toLowerCase();
        const keys = s.queue.map((u) => u.key), at = keys.indexOf(sel);
        let handled = true;
        if (k === ' ') act({ type: 'plus1All' });
        else if (k === 's' && !e.ctrlKey) act({ type: 'swapLimit' });
        else if (k === 'd') act({ type: 'removeLimit' });
        else if (k === 'n') act(sel ? { type: 'swap', key: sel } : { type: 'swapFirst' });
        else if (k === 'z') act({ type: 'undo' });
        else if (k === 'r') act({ type: 'accept', value: !s.settings.accepting });
        else if (k === 'arrowdown' || k === 'arrowup') {
          if (keys.length) {
            const n = at < 0 ? (k === 'arrowdown' ? 0 : keys.length - 1) : Math.min(keys.length - 1, Math.max(0, at + (k === 'arrowdown' ? 1 : -1)));
            sel = keys[n]; render(s);
            const li = root.querySelector('.row.sel'); if (li) li.scrollIntoView({ block: 'nearest' });
          }
        } else if (k === 'escape') { sel = ''; render(s); }
        else if (sel && k === 'enter') act({ type: 'plus1', key: sel });
        else if (sel && k === 'x') act({ type: 'swap', key: sel });
        else if (sel && k === 'delete') act({ type: 'remove', key: sel });
        else if (sel && k === 'b') act({ type: 'block', key: sel });
        else handled = false;
        if (handled) e.preventDefault();
      });

      // ---- 音通知 / 新着ハイライト ----
      function detect(state) {
        const now = Date.now(), { limit } = state.settings;
        const cur = new Map(state.queue.map((u) => [u.key, u.count]));
        let joined = false, hit = false;
        if (prev) {
          state.queue.forEach((u, i) => {
            if (!prev.counts.has(u.key)) { joined = true; fresh.set(u.key, now); }
            else if (i < state.settings.slots && limit === prev.limit && u.count > prev.counts.get(u.key) && u.count >= limit && prev.counts.get(u.key) < limit) hit = true;
          });
        }
        fresh.forEach((tm, k) => { if (now - tm > 4000 || !cur.has(k)) fresh.delete(k); });
        if (opts.sound && prev) {
          const snd = state.settings.ui.sound;
          if (hit) SFX.play(snd.limit, snd.volume);
          else if (joined) SFX.play(snd.join, snd.volume);
        }
        prev = { counts: cur, limit };
      }

      function render(state) {
        s = state;
        const { limit, slots, accepting } = s.settings;
        const playing = s.queue.slice(0, slots);
        const hit = playing.filter((u) => u.count >= limit).length;
        if (sel && !s.queue.some((u) => u.key === sel)) sel = '';

        const acc = $('.acc');
        acc.textContent = accepting ? '● 受付中' : '○ 受付停止';
        acc.classList.toggle('on', accepting);
        $('.v-limit').textContent = limit;
        $('.v-slots').textContent = slots;

        const all = $('.all'), sw = $('.swapall');
        all.disabled = playing.length === 0;
        sw.disabled = hit === 0;
        sw.classList.toggle('hot', hit > 0);
        sw.textContent = hit > 0 ? `上限者を交代 (${hit}人)` : '上限者を交代';
        const rm = $('.rmall');
        rm.disabled = hit === 0;
        rm.textContent = hit > 0 ? `上限者を削除 (${hit}人)` : '上限者を削除';
        $('.undo').disabled = !s.canUndo;
        $('.sum').textContent = `プレイ中 ${playing.length}/${slots}人 ・ 待機 ${Math.max(0, s.queue.length - slots)}人`;

        let html = '';
        if (!s.queue.length) html = '<li class="empty">まだ誰もいません。<br>「○ 受付停止」を押して受付を開始すると、視聴者のコメントやポイント交換でここに並びます。</li>';
        const now = Date.now();
        s.queue.forEach((u, i) => {
          const play = i < slots;
          const st = u.count > limit ? 'over' : u.count === limit ? 'limit' : '';
          if (i === 0) html += '<li class="sec">プレイ中</li>';
          if (i === slots) html += '<li class="sec wait">待機中</li>';
          const fr = fresh.has(u.key) ? ` fresh" style="animation-delay:-${now - fresh.get(u.key)}ms` : '';
          const k = esc(u.key);
          html += `<li class="row ${st} ${play ? 'play' : ''} ${u.key === sel ? 'sel' : ''}${fr}" data-k="${k}">
            <span class="name" title="${esc(u.name)}">${esc(u.name)}</span>
            <span class="cnt">${u.count}<small>/${limit}</small></span>
            ${play ? `<button class="p1" data-a="plus1" data-k="${k}">＋1</button>
                      <button class="sw" data-a="swap" data-k="${k}" title="最後尾へ送り、回数をリセット">交代</button>` : ''}
            <span class="mv">
              <button data-a="up" data-k="${k}" title="上へ" aria-label="上へ">▲</button>
              <button data-a="down" data-k="${k}" title="下へ" aria-label="下へ">▼</button>
              <button data-a="block" data-k="${k}" title="ブロック (キューから外し、今後の参加も断ります)" aria-label="ブロック" class="ghost">🚫</button>
              <button data-a="remove" data-k="${k}" title="削除" aria-label="削除" class="ghost">✕</button>
            </span></li>`;
        });
        $('.list').innerHTML = html;

        if (lastNotice === null) lastNotice = s.notice ? s.notice.n : 0;   // 起動時点の通知は出さない
        else if (s.notice && s.notice.n !== lastNotice) { lastNotice = s.notice.n; toast(s.notice.text, s.notice.kind); }
      }
      t.onState((state) => { detect(state); render(state); });
      root.toast = toast;
    },
  };
})();
