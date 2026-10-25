// 効果音。プリセットはWebAudioで合成 (音声ファイル不要)。
// SFX.play(name, volume0-100, base)  name: プリセットID または a_xxxx.mp3 などの取り込み済みファイル (base + '/user/' + name)
(function (g) {
  const AC = g.AudioContext || g.webkitAudioContext;
  let ctx = null;
  const getCtx = () => {
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };

  function tone(c, t, o) {
    const osc = c.createOscillator(), gn = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(gn); gn.connect(c.destination);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }

  function noise(c, t, dur, gain, f0, f1) {
    const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const flt = c.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = 1.2;
    flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + dur * 0.3);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(gn); gn.connect(c.destination);
    src.start(t);
  }

  const PRESETS = {
    chime: (c, t, v) => { tone(c, t, { f: 880, dur: 0.45, gain: 0.45 * v }); tone(c, t + 0.13, { f: 1318.5, dur: 0.6, gain: 0.4 * v }); },
    pop: (c, t, v) => { tone(c, t, { f: 520, f2: 180, dur: 0.14, gain: 0.7 * v }); },
    coin: (c, t, v) => { tone(c, t, { f: 988, type: 'square', dur: 0.09, gain: 0.22 * v }); tone(c, t + 0.09, { f: 1319, type: 'square', dur: 0.4, gain: 0.22 * v }); },
    horn: (c, t, v) => { tone(c, t, { f: 196, type: 'sawtooth', dur: 0.28, gain: 0.3 * v }); tone(c, t + 0.3, { f: 196, type: 'sawtooth', dur: 0.4, gain: 0.3 * v }); },
    whoosh: (c, t, v) => { noise(c, t, 0.45, 0.8 * v, 400, 4200); },
  };

  const base64ok = /^a_[0-9a-f]{8,16}\.(mp3|wav|ogg|m4a)$/i;

  function play(name, volume, base) {
    try {
      const v = Math.max(0, Math.min(100, Number(volume))) / 100;
      if (!name || name === 'none' || !v) return;
      if (PRESETS[name]) {
        const c = getCtx();
        if (c) PRESETS[name](c, c.currentTime + 0.01, v);
      } else if (base64ok.test(name)) {
        const a = new Audio((base || '') + '/user/' + name);
        a.volume = v;
        a.play().catch(() => {});
      }
    } catch { /* 音が鳴らなくても動作に影響させない */ }
  }

  g.SFX = { play, presets: Object.keys(PRESETS) };
})(typeof window !== 'undefined' ? window : globalThis);
