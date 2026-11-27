/**
 * Intonation Tracker — PitchDiagram intonation adaptation (lightweight).
 * Polls pitchDetector.lastPayload; shows ±50 cents zoom, labels held notes (~500ms).
 * No score/grading — aid only.
 */
(function (root) {
  function bindUI() {
    const card = document.getElementById('intonationCard');
    if (!card) return;
    const bigEl = document.getElementById('intonationCents');
    const noteEl = document.getElementById('intonationNote');
    const labelEl = document.getElementById('intonationLabel');
    const driftEl = document.getElementById('intonationDrift');

    let heldSince = null;
    let heldNoteIdx = null;
    let samples = []; // recent cents

    function tick() {
      const pd = root.pitchDetector;
      const p = pd && pd.lastPayload;
      if (!p) {
        if (bigEl) bigEl.textContent = '--';
        if (noteEl) noteEl.textContent = 'মাইক বন্ধ — রেওয়াজ শুরু করুন';
        heldSince = null; heldNoteIdx = null;
        samples = [];
        return;
      }
      const cents = Number(p.cents) || 0;
      if (bigEl) {
        bigEl.textContent = (cents > 0 ? '+' : '') + cents + ' cents';
        bigEl.classList.toggle('is-good', Math.abs(cents) <= 12);
        bigEl.classList.toggle('is-bad', Math.abs(cents) > 12);
      }
      if (noteEl) noteEl.textContent = `${p.sargamShortName} (${p.noteName}) · ${p.freq} Hz`;

      samples.push(cents);
      if (samples.length > 120) samples.shift();

      if (heldNoteIdx !== p.noteIndex) { heldNoteIdx = p.noteIndex; heldSince = Date.now(); }
      if (heldSince && Date.now() - heldSince >= 500) {
        const avg = Math.round(samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length));
        const inTune = Math.abs(avg) <= 12;
        if (labelEl) labelEl.textContent = `${p.sargamShortName} ধরা হয়েছে · গড় ${avg > 0 ? '+' : ''}${avg} cents ${inTune ? '· সুরে আছে' : (avg > 0 ? '· চড়া (sharp)' : '· খাদে (flat)')}`;
      }
      if (driftEl && samples.length >= 12) {
        const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        driftEl.textContent = `গড় ${avg > 0 ? '+' : ''}${avg} · পরিসর ${min} … ${max > 0 ? '+' : ''}${max}`;
      }
    }

    setInterval(tick, 120);
    tick();
  }

  const api = { bindUI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IntonationTrackerUI = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bindUI);
})(typeof window !== 'undefined' ? window : globalThis);
