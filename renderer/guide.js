// 初回ガイド: ログイン → 参加方法 → OBS表示 → 動作テスト。「❓ 使い方ガイド」からいつでも開き直せる
(function () {
  const root = document.getElementById('guide');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STEPS = ['Twitchにログイン', '参加のしかた', 'OBSに表示', '動作テスト'];
  let testN = 0, step = 0, s = null, urls = null, lastFocus = null;

  const body = {
    0: () => `
      <p>視聴者のコメントやチャンネルポイントを読み取るため、まず配信者のTwitchアカウントでログインします。</p>
      <p class="g-state" id="g-login"></p>
      <p class="err small" id="g-err"></p>
      <div class="bar"><button class="primary" id="g-do-login">Twitchでログイン</button></div>
      <p class="dim small">ログインしたアカウントのチャンネルを対象にします。パスワードはこのアプリには渡りません (Twitchの画面で入力します)。トークンはこのPC内にだけ保存されます。</p>`,
    1: () => `
      <p>視聴者はどうやって参加しますか？</p>
      <label>受付方法
        <select id="g-mode"><option value="chat">コメント (例: !参加)</option><option value="points">チャンネルポイント</option><option value="both">両方</option></select></label>
      <label id="g-l-cmd">参加コメント <input id="g-cmd" placeholder="!参加"></label>
      <label id="g-l-rw">報酬名 (チャンネルポイント) <input id="g-rw" placeholder="参加したい！"><span class="dim small">Twitchのダッシュボードで作った報酬の名前と同じにしてください</span></label>`,
    2: () => `
      <p>配信画面 (OBS) に参加者を表示します。下の枠を <b>OBSの画面へドラッグ＆ドロップ</b> してください。</p>
      <a id="g-ovl" class="drag" draggable="true" href="#">オーバーレイをOBSへドラッグ</a>
      <p class="dim small">うまくいかない時: OBSで ソース＋ → ブラウザ → URLに貼り付け (幅600 高さ400くらい)</p>
      <div class="bar"><button id="g-copy">オーバーレイURLをコピー</button></div>
      <p class="g-state" id="g-obs"></p>
      <p class="dim small">見た目は「OBS見た目」タブでいつでも変えられます。OBSをまだ使わない場合は「次へ」で飛ばせます。</p>`,
    3: () => `
      <p>動作を確かめましょう。受付を開始して、テスト用の参加者を入れてみます。</p>
      <div class="bar"><button id="g-acc"></button><button id="g-test">テスト参加者を追加</button></div>
      <p class="g-state" id="g-q"></p>
      <ul class="dim small g-tips">
        <li>自分のチャットに <b id="g-cmdv"></b> と送ると、本物の参加が入ります</li>
        <li>キューの <b>＋1</b> で回数を増やし、<b>交代</b> で最後尾へ送ります</li>
        <li>キーボードの <b>Space</b> でプレイ中の全員を＋1、<b>S</b> で上限者を交代できます</li>
        <li>配信中は、右下の「操作・通知」でホットキー・音・ミニ表示を設定できます</li>
      </ul>
      <p class="dim small">テスト参加者は、キュー右の ✕ や「全クリア」で消せます。</p>`,
  };

  function draw() {
    root.innerHTML = `
      <div class="modal-card" tabindex="-1">
        <div class="g-head"><h2 id="guide-title">はじめてのセットアップ</h2><button class="ghost" id="g-close" aria-label="閉じる">✕</button></div>
        <ol class="g-steps">${STEPS.map((t, i) => `<li class="${i === step ? 'on' : i < step ? 'done' : ''}"><span>${i < step ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol>
        <div class="g-body">${body[step]()}</div>
        <div class="g-foot">
          <button class="ghost" id="g-later">あとで</button><span class="grow"></span>
          ${step > 0 ? '<button id="g-back">戻る</button>' : ''}
          <button class="primary" id="g-next">${step === STEPS.length - 1 ? '完了' : '次へ'}</button>
        </div>
      </div>`;
    const $ = (id) => root.querySelector('#' + id);
    $('g-close').onclick = $('g-later').onclick = close;
    if ($('g-back')) $('g-back').onclick = () => { step--; draw(); };
    $('g-next').onclick = async () => {
      if (step === 1) await saveStep1();
      if (step === STEPS.length - 1) return close();
      step++; draw();
    };
    if (step === 0) {
      $('g-do-login').onclick = async () => {
        $('g-err').textContent = '';
        const r = await api.login();
        if (!r.ok) $('g-err').textContent = r.error;
      };
    }
    if (step === 1 && s) {
      $('g-mode').value = s.settings.mode; $('g-cmd').value = s.settings.command; $('g-rw').value = s.settings.rewardTitle;
      const vis = () => { const m = $('g-mode').value; $('g-l-cmd').hidden = m === 'points'; $('g-l-rw').hidden = m === 'chat'; };
      $('g-mode').onchange = vis; vis();
    }
    if (step === 2) {
      $('g-ovl').addEventListener('dragstart', (e) => { e.preventDefault(); api.startDrag(); });
      $('g-ovl').addEventListener('click', (e) => e.preventDefault());
      $('g-copy').onclick = () => { api.copy(urls.overlay); $('g-copy').textContent = 'コピーしました'; setTimeout(() => { if ($('g-copy')) $('g-copy').textContent = 'オーバーレイURLをコピー'; }, 1500); };
    }
    if (step === 3) {
      $('g-acc').onclick = () => api.action({ type: 'accept', value: !s.settings.accepting });
      $('g-test').onclick = () => {
        const used = new Set(s.queue.map((u) => u.name));
        let n = Math.max(testN, 0) + 1; while (used.has('テスト' + n)) n++;
        testN = n;   // 連打しても同じ名前にならないよう、画面の更新を待たず番号を進める
        api.action({ type: 'add', name: 'テスト' + n });
      };
    }
    refresh();
    const f = root.querySelector('.primary:not([hidden]), button'); if (f) f.focus();
  }

  async function saveStep1() {
    const mode = root.querySelector('#g-mode').value;
    await api.action({ type: 'settings', settings: { mode, command: root.querySelector('#g-cmd').value.trim() || '!参加', rewardTitle: root.querySelector('#g-rw').value.trim() } });
    // 設定画面の入力欄にも反映させる
    ['mode', 'command', 'rewardTitle'].forEach((k) => { const el = document.getElementById(k); if (el) el.value = (k === 'mode' ? mode : k === 'command' ? (root.querySelector('#g-cmd').value.trim() || '!参加') : root.querySelector('#g-rw').value.trim()); });
  }

  // 状態に応じて動的な部分だけを更新 (入力中の欄は触らない)
  function refresh() {
    if (!s || root.hidden) return;
    const q = (id) => root.querySelector('#' + id);
    if (step === 0) {
      q('g-login').innerHTML = s.user ? `✅ ログイン中: <b>${esc(s.user)}</b>` : '⬜ まだログインしていません';
      q('g-login').className = 'g-state ' + (s.user ? 'ok' : '');
      q('g-do-login').hidden = !!s.user;
      if (urls && !urls.hasClientId) q('g-err').textContent = 'Client ID が未設定です。配布元の設定 (src/config.js) か、設定タブの「詳細設定」で独自のClient IDを入れてください。';
      q('g-next').textContent = s.user ? '次へ' : 'ログインせずに進む';
    }
    if (step === 2) {
      const c = (s.clients && s.clients.overlay) || 0;
      q('g-obs').innerHTML = c ? `✅ OBSとつながりました (${c}件)` : '⬜ OBSからの接続を待っています… (つながるとここが変わります)';
      q('g-obs').className = 'g-state ' + (c ? 'ok' : '');
    }
    if (step === 3) {
      q('g-acc').textContent = s.settings.accepting ? '● 受付中 (クリックで停止)' : '○ 受付を開始する';
      q('g-acc').classList.toggle('on', s.settings.accepting);
      q('g-q').innerHTML = s.queue.length ? `✅ いまキューに <b>${s.queue.length}</b> 人います` : '⬜ まだ誰もいません';
      q('g-q').className = 'g-state ' + (s.queue.length ? 'ok' : '');
      q('g-cmdv').textContent = s.settings.mode === 'points' ? `「${s.settings.rewardTitle || '報酬'}」の交換` : s.settings.command;
    }
  }

  function open(from = 0) {
    step = from; lastFocus = document.activeElement;
    root.hidden = false; document.body.classList.add('modal-open');
    draw();
  }
  function close() {
    root.hidden = true; document.body.classList.remove('modal-open');
    if (s && !s.settings.onboarded) api.action({ type: 'settings', settings: { onboarded: true } });
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab') return;
    const f = [...root.querySelectorAll('button:not([hidden]), input, select, a[href]')].filter((x) => !x.disabled && x.offsetParent);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  document.getElementById('open-guide').onclick = () => open(0);
  api.urls().then((u) => { urls = u; refresh(); });
  let first = true;
  const onState = (st) => {
    s = st;
    if (first) { first = false; if (!st.settings.onboarded) open(0); }
    refresh();
  };
  api.getState().then(onState);
  api.onState(onState);
})();
