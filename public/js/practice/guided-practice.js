/**
 * Guided practice core (pure queue + time-based hold). Master Plan Sec 5/P2-2.
 * Replaces frame-count hold (>=4 frames) with time-based hold (>=300ms) for fps-independence.
 */
(function (root) {
  function parseSwaras(noteString) {
    return String(noteString || '').replace(/[|,]/g, ' ').split(/\s+/).map(s => s.trim()).filter(Boolean);
  }
  function normSwara(s) {
    return String(s || '').replace(/['ঁ♭♯]/g, '').trim();
  }
  function createSession(swaraList, { holdMs = 300 } = {}) {
    return {
      queue: [...swaraList],
      index: 0,
      score: 0,
      holdStart: null,
      holdMs,
      target() { return this.queue[this.index]; },
      done() { return this.index >= this.queue.length; },
      // Returns 'advanced' | 'holding' | 'reset' | 'done'
      feed({ sungShort, inTune, now = Date.now() }) {
        if (this.done()) return 'done';
        const target = normSwara(this.target());
        if (inTune && normSwara(sungShort) === target) {
          if (this.holdStart == null) this.holdStart = now;
          if (now - this.holdStart >= this.holdMs) {
            this.index++;
            this.score += 10;
            this.holdStart = null;
            return this.done() ? 'done' : 'advanced';
          }
          return 'holding';
        }
        this.holdStart = null;
        return 'reset';
      }
    };
  }
  const api = { parseSwaras, normSwara, createSession };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GuidedPractice = api;
})(typeof window !== 'undefined' ? window : globalThis);
