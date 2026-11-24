/**
 * PitchHistory: 10s ring buffer with target-deviation stats. Master Plan Sec 3.2/5.
 */
(function (root) {
  class PitchHistory {
    constructor({ windowSec = 10 } = {}) {
      this.windowSec = windowSec;
      this.samples = []; // {t, freq|null, targetMidi|null, cents|null}
    }
    push({ freq = null, targetMidi = null, cents = null, t = Date.now() } = {}) {
      this.samples.push({ t, freq, targetMidi, cents });
      const cutoff = t - this.windowSec * 1000;
      while (this.samples.length && this.samples[0].t < cutoff) this.samples.shift();
    }
    last10s() { return this.samples; }
    deviationStats() {
      const vals = this.samples.filter(s => s.freq != null && s.cents != null).map(s => s.cents);
      if (!vals.length) return { n: 0, meanAbs: null, inTunePct: null };
      const inTune = vals.filter(c => Math.abs(c) <= 12).length;
      return {
        n: vals.length,
        meanAbs: Math.round(vals.reduce((a, c) => a + Math.abs(c), 0) / vals.length * 10) / 10,
        inTunePct: Math.round(inTune / vals.length * 100)
      };
    }
    toChartSeries() {
      return this.samples.map(s => ({ t: s.t, freq: s.freq, target: s.targetMidi, cents: s.cents }));
    }
    clear() { this.samples = []; }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = PitchHistory;
  root.PitchHistory = PitchHistory;
})(typeof window !== 'undefined' ? window : globalThis);
