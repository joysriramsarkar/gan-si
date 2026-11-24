/**
 * Pitch filters: RMS/VAD, median, EMA, octave-fix, confidence. Master Plan Sec 5.
 * Pure functions — no DOM, no AudioContext. window.PitchFilters + module.exports.
 */
(function (root) {
  function rmsOf(buf) {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }
  function rmsGate(buf, threshold = 0.015) {
    const rms = rmsOf(buf);
    return { rms, voiced: rms >= threshold };
  }
  function voiceActivity({ rms, freq, rmsThreshold = 0.015, minFreq = 60, maxFreq = 1200 }) {
    if (rms < rmsThreshold) return false;
    if (!Number.isFinite(freq) || freq < minFreq || freq > maxFreq) return false;
    return true;
  }
  function median(arr) {
    if (!arr.length) return null;
    const a = [...arr].sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function ema(prev, next, alpha = 0.35) {
    if (prev == null) return next;
    return prev * (1 - alpha) + next * alpha;
  }
  // If freq is ~2x or ~0.5x of stable reference, snap back; returns corrected freq
  function octaveFix(freq, refFreq, toleranceCents = 120) {
    if (!refFreq || !freq) return freq;
    const ratio = freq / refFreq;
    const cents = 1200 * Math.log2(ratio);
    if (Math.abs(Math.abs(cents) - 1200) <= toleranceCents) {
      return cents > 0 ? freq / 2 : freq * 2;
    }
    return freq;
  }
  function confidence({ nsdfPeak = 0, rms = 0, stabilityCents = 50, voiced = true }) {
    if (!voiced) return 0;
    const peakScore = Math.max(0, Math.min(1, (nsdfPeak - 0.45) / 0.5));
    const rmsScore = Math.max(0, Math.min(1, rms / 0.08));
    const stabScore = Math.max(0, Math.min(1, 1 - stabilityCents / 50));
    return Math.round((0.5 * peakScore + 0.25 * rmsScore + 0.25 * stabScore) * 100) / 100;
  }
  // Stable pitch: same sargam ±tol cents for >=minMs
  function createStabilityTracker({ tolCents = 12, minMs = 250 } = {}) {
    let anchor = null;
    let since = 0;
    return {
      update({ freq, cents, now = Date.now() }) {
        if (freq == null) { anchor = null; return { stable: false, heldMs: 0 }; }
        if (!anchor || Math.abs(cents - anchor.cents) > tolCents) {
          anchor = { cents, freq };
          since = now;
          return { stable: false, heldMs: 0 };
        }
        const heldMs = now - since;
        return { stable: heldMs >= minMs, heldMs };
      },
      reset() { anchor = null; }
    };
  }

  const api = { rmsOf, rmsGate, voiceActivity, median, ema, octaveFix, confidence, createStabilityTracker };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PitchFilters = api;
})(typeof window !== 'undefined' ? window : globalThis);
