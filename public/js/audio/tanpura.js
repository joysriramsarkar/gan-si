/**
 * Tanpura theory helpers (pure): tuning presets + string-note calculator.
 * Master Plan Sec 6. DSP/synth stays in audio-engine.js (Phase 2: per-string gain/decay + samples).
 */
(function (root) {
  const TUNINGS = [
    { id: 0, name: 'পঞ্চম (Pa)', string1Interval: 7 },
    { id: 1, name: 'মধ্যম (Shuddha Ma)', string1Interval: 5 },
    { id: 2, name: 'নিষাদ (Shuddha Ni)', string1Interval: 11 },
    { id: 3, name: 'ধৈবত (Shuddha Dha)', string1Interval: 9 }
  ];
  // Returns semitone offsets for 4 strings given root + tuning (octave hints included)
  function stringIntervals(rootOffset, tuningId) {
    const t = TUNINGS.find(x => x.id === tuningId) || TUNINGS[0];
    return [
      { string: 1, interval: t.string1Interval, octaveShift: -1 },
      { string: 2, interval: 0, octaveShift: 0, detuneCents: -1.8 },
      { string: 3, interval: 0, octaveShift: 0, detuneCents: 1.8 },
      { string: 4, interval: 0, octaveShift: -1 }
    ];
  }
  const api = { TUNINGS, stringIntervals };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TanpuraTheory = api;
})(typeof window !== 'undefined' ? window : globalThis);
