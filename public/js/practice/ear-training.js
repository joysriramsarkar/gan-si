/**
 * Ear training: swara + interval recognition (pure logic + UI binder).
 * A swara sounds (harmonium synth); user identifies it. Aid only.
 */
(function (root) {
  const SWARA = ['সা', 'রে', 'গা', 'মা', 'পা', 'ধা', 'নি', 'সাঁ'];
  const INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12];
  const INTERVAL_NAMES = { 0: 'সম (সা)', 2: 'রে দূরত্ব', 4: 'গা দূরত্ব', 5: 'মা দূরত্ব', 7: 'পা (পঞ্চম)', 9: 'ধা দূরত্ব', 11: 'নি দূরত্ব', 12: 'সপ্তক (সাঁ)' };

  function pickTarget(pool, rand = Math.random) {
    const idx = Math.floor(rand() * pool.length);
    return { swara: pool[idx], interval: INTERVALS[SWARA.indexOf(pool[idx])] ?? 0 };
  }
  function checkAnswer(target, answer) {
    return String(target).trim() === String(answer).trim();
  }

  function bindUI() {
    const playBtn = document.getElementById('earPlayBtn');
    if (!playBtn) return;
    let current = null;
    let score = 0, total = 0;
    const qEl = document.getElementById('earQuestion');
    const scoreEl = document.getElementById('earScore');
    playBtn.addEventListener('click', () => {
      const level = (document.getElementById('earLevel') || {}).value || 'easy';
      const pool = level === 'easy' ? ['সা', 'গা', 'পা'] : level === 'medium' ? ['সা', 'রে', 'গা', 'মা', 'পা'] : SWARA;
      current = pickTarget(pool);
      if (qEl) qEl.textContent = '🔊 শুনুন… কোন স্বর বাজলো?';
      const iv = current.interval;
      if (window.audioEngine) window.audioEngine.playIntervalSequence([iv], null, null);
    });
    document.querySelectorAll('.ear-answer').forEach(b => {
      b.addEventListener('click', () => {
        if (!current) return;
        total++;
        const ok = checkAnswer(current.swara, b.dataset.swara);
        if (ok) score++;
        if (qEl) qEl.textContent = ok ? `✅ সঠিক! (${current.swara}) — নতুনটি শুনুন` : `❌ ওটি ছিল ${current.swara}`;
        if (scoreEl) scoreEl.textContent = `${score}/${total}`;
        current = null;
      });
    });
  }

  const api = { SWARA, INTERVAL_NAMES, pickTarget, checkAnswer, bindUI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EarTraining = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bindUI);
})(typeof window !== 'undefined' ? window : globalThis);
