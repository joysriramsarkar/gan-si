/**
 * Interval trainer (অন্তরাল সাধনা) — muted.io Intervals adaptation.
 * Two notes from Sa, modes: ascending / descending / harmony.
 * Aid only — score is practice feedback, not final judgement.
 */
(function (root) {
  function defaultRand() { return Math.random(); }

  function bindUI() {
    const playBtn = document.getElementById('intervalPlayBtn');
    if (!playBtn) return;

    const levelSel = document.getElementById('intervalLevel');
    const modeSel = document.getElementById('intervalMode');
    const replayBtn = document.getElementById('intervalReplayBtn');
    const skipBtn = document.getElementById('intervalSkipBtn');
    const qEl = document.getElementById('intervalQuestion');
    const scoreEl = document.getElementById('intervalScore');
    const choicesEl = document.getElementById('intervalChoices');
    const chartEl = document.getElementById('intervalChart');

    const I = root.Intervals;
    if (!I) return;

    let current = null; // {semitones, ...}
    let score = 0, total = 0, streak = 0;

    function getRoot() {
      if (root.audioEngine && Number.isFinite(root.audioEngine.rootOffset)) return root.audioEngine.rootOffset;
      const s = document.getElementById('scaleSelect');
      const v = s ? parseInt(s.value, 10) : 10;
      return Number.isFinite(v) ? v : 10;
    }

    function playFreq(freq, key, durMs) {
      if (!root.audioEngine) return;
      root.audioEngine.playHarmoniumNote(freq, key);
      setTimeout(() => root.audioEngine.stopHarmoniumNote(key), durMs);
    }

    function frequenciesFor(semitones) {
      const engine = root.audioEngine;
      const rootIdx = getRoot();
      // Middle-Sa anchored (MIDI 48 + root), same anchor as the pitch grid.
      const baseMidi = 48 + rootIdx;
      const freqOf = (midi) => engine.baseFreqA4 * Math.pow(2, (midi - 69) / 12);
      return { base: freqOf(baseMidi), upper: freqOf(baseMidi + semitones) };
    }

    function playInterval(target) {
      const engine = root.audioEngine;
      if (!engine) return;
      const mode = (modeSel && modeSel.value) || 'ascending';
      const { base, upper } = frequenciesFor(target.semitones);
      if (mode === 'descending') {
        playFreq(upper, 'int-hi', 650);
        setTimeout(() => playFreq(base, 'int-lo', 750), 700);
      } else if (mode === 'harmony') {
        playFreq(base, 'int-lo', 900);
        playFreq(upper, 'int-hi', 900);
      } else {
        playFreq(base, 'int-lo', 650);
        setTimeout(() => playFreq(upper, 'int-hi', 750), 700);
      }
    }

    function newQuestion() {
      const level = (levelSel && levelSel.value) || 'easy';
      const pool = I.levelPool(level);
      current = I.pickInterval(pool, defaultRand);
      if (qEl) qEl.textContent = '🔊 শুনুন… সা থেকে কোন দূরত্বের স্বর বাজলো?';
      playInterval(current);
    }

    function renderChoices() {
      if (!choicesEl) return;
      choicesEl.innerHTML = '';
      const level = (levelSel && levelSel.value) || 'easy';
      const pool = new Set(I.levelPool(level));
      // Always offer full simple set so guessing is not narrowed by pool for hard;
      // for easy/medium offer pool + common neighbours to keep screen light.
      const semis = level === 'hard' || level === 'compound'
        ? Array.from(pool)
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((s) => pool.has(s) || s === 12);
      semis.forEach((semi) => {
        const iv = I.getInterval(semi);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-outline interval-guess-btn';
        b.dataset.interval = String(semi);
        b.textContent = `${iv ? iv.bn : ''} (${iv ? iv.id : semi})`;
        b.setAttribute('aria-label', `${iv ? iv.en : semi} চেষ্ট করুন`);
        b.addEventListener('click', () => answer(semi, b));
        choicesEl.appendChild(b);
      });
    }

    function answer(semi, btn) {
      if (!current) {
        if (qEl) qEl.textContent = 'প্রথমে “স্বর বাজান” চাপুন';
        return;
      }
      total++;
      const ok = I.checkAnswer(current.semitones, semi);
      if (ok) { score++; streak++; } else { streak = 0; }
      const iv = I.getInterval(current.semitones);
      if (scoreEl) scoreEl.textContent = `${score}/${total}`;
      if (qEl) {
        qEl.textContent = ok
          ? `✅ সঠিক! সা → ${iv ? iv.sargam : ''} (${iv ? iv.en : ''}) — নতুনটি শুনুন`
          : `❌ ওটি ছিল ${iv ? iv.bn : ''} (${iv ? iv.en : ''}) — সা → ${iv ? iv.sargam : ''}`;
      }
      document.querySelectorAll('#intervalChoices .interval-guess-btn').forEach((b) => {
        b.classList.toggle('is-correct', b.dataset.interval === String(current.semitones));
        if (b === btn && !ok) b.classList.add('is-wrong');
      });
      current = null;
      setTimeout(renderChoices, 400);
    }

    function renderChart() {
      if (!chartEl) return;
      chartEl.innerHTML = '';
      I.INTERVALS.filter((i) => i.semitones >= 1 && i.semitones <= 12).forEach((iv) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'btn-outline interval-chart-row';
        row.innerHTML = `<span>${iv.bn} <strong>(${iv.id})</strong></span><span>${iv.en}</span><span>সা → ${iv.sargam} · ${iv.semitones} সেমিটোন</span>`;
        row.setAttribute('aria-label', `${iv.en} শুনুন`);
        row.addEventListener('click', () => {
          playInterval(iv);
          if (qEl) qEl.textContent = `▶️ ${iv.bn} (${iv.en}) — সা → ${iv.sargam} শুনুন`;
        });
        chartEl.appendChild(row);
      });
    }

    playBtn.addEventListener('click', newQuestion);
    if (replayBtn) replayBtn.addEventListener('click', () => {
      if (current) playInterval(current);
      else if (qEl) qEl.textContent = 'আগে একটি প্রশ্ন বাজান';
    });
    if (skipBtn) skipBtn.addEventListener('click', () => {
      current = null;
      renderChoices();
      newQuestion();
    });
    if (levelSel) levelSel.addEventListener('change', renderChoices);
    if (modeSel) modeSel.addEventListener('change', () => { if (current) playInterval(current); });

    // Keyboard: 1-9,0,-,= → semitones 1..12 when no text input focused
    document.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const map = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '0': 10, '-': 11, '=': 12 };
      const semi = map[e.key];
      if (semi && document.getElementById('tab-ear') && document.getElementById('tab-ear').classList.contains('active')) {
        answer(semi, null);
      }
    });

    renderChoices();
    renderChart();
    if (scoreEl) scoreEl.textContent = '0/0';
  }

  const api = { bindUI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntervalTrainer = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bindUI);
})(typeof window !== 'undefined' ? window : globalThis);
