/**
 * Music intervals — pure, testable. Adapted from muted.io interval tool
 * for Gan-si (Indian classical + Western theory).
 * Semitones 1..12 = simple intervals; 13..24 = compound (+octave).
 * Works in browser (window.Intervals) and Node/Jest (module.exports).
 */
(function (root) {
  // id: short symbol, en: English name, bn: Bengali name, sargam: Sa → X in Bilaval terms
  const INTERVALS = [
    { semitones: 1, id: 'm2', en: 'Minor 2nd (m2)', bn: 'ক্ষুদ্র ২য়', sargam: 'রে♭' },
    { semitones: 2, id: 'M2', en: 'Major 2nd (M2)', bn: 'বৃহৎ ২য়', sargam: 'রে' },
    { semitones: 3, id: 'm3', en: 'Minor 3rd (m3)', bn: 'ক্ষুদ্র ৩য়', sargam: 'গা♭' },
    { semitones: 4, id: 'M3', en: 'Major 3rd (M3)', bn: 'বৃহৎ ৩য়', sargam: 'গা' },
    { semitones: 5, id: 'P4', en: 'Perfect 4th (P4)', bn: 'শুদ্ধ ৪র্থ', sargam: 'মা' },
    { semitones: 6, id: 'A4', en: 'Tritone (A4/d5)', bn: 'ট্রাইটোন', sargam: 'মা♯' },
    { semitones: 7, id: 'P5', en: 'Perfect 5th (P5)', bn: 'শুদ্ধ ৫ম', sargam: 'পা' },
    { semitones: 8, id: 'm6', en: 'Minor 6th (m6)', bn: 'ক্ষুদ্র ৬ষ্ঠ', sargam: 'ধা♭' },
    { semitones: 9, id: 'M6', en: 'Major 6th (M6)', bn: 'বৃহৎ ৬ষ্ঠ', sargam: 'ধা' },
    { semitones: 10, id: 'm7', en: 'Minor 7th (m7)', bn: 'ক্ষুদ্র ৭ম', sargam: 'নি♭' },
    { semitones: 11, id: 'M7', en: 'Major 7th (M7)', bn: 'বৃহৎ ৭ম', sargam: 'নি' },
    { semitones: 12, id: 'P8', en: 'Octave (P8)', bn: 'অষ্টক', sargam: 'সাঁ' },
    { semitones: 13, id: 'm9', en: 'Minor 9th (m9)', bn: 'ক্ষুদ্র ৯ম', sargam: 'রে♭ (সপ্তক)' },
    { semitones: 14, id: 'M9', en: 'Major 9th (M9)', bn: 'বৃহৎ ৯ম', sargam: 'রে (সপ্তক)' },
    { semitones: 15, id: 'm10', en: 'Minor 10th (m10)', bn: 'ক্ষুদ্র ১০ম', sargam: 'গা♭ (সপ্তক)' },
    { semitones: 16, id: 'M10', en: 'Major 10th (M10)', bn: 'বৃহৎ ১০ম', sargam: 'গা (সপ্তক)' },
    { semitones: 17, id: 'P11', en: 'Perfect 11th (P11)', bn: 'শুদ্ধ ১১ম', sargam: 'মা (সপ্তক)' },
    { semitones: 18, id: 'A11', en: 'Augmented 11th (A11)', bn: 'ট্রাইটোন (সপ্তক)', sargam: 'মা♯ (সপ্তক)' },
    { semitones: 19, id: 'P12', en: 'Perfect 12th (P12)', bn: 'শুদ্ধ ১২ম', sargam: 'পা (সপ্তক)' },
    { semitones: 20, id: 'm13', en: 'Minor 13th (m13)', bn: 'ক্ষুদ্র ১৩ম', sargam: 'ধা♭ (সপ্তক)' },
    { semitones: 21, id: 'M13', en: 'Major 13th (M13)', bn: 'বৃহৎ ১৩ম', sargam: 'ধা (সপ্তক)' },
    { semitones: 22, id: 'm14', en: 'Minor 14th (m14)', bn: 'ক্ষুদ্র ১৪ম', sargam: 'নি♭ (সপ্তক)' },
    { semitones: 23, id: 'M14', en: 'Major 14th (M14)', bn: 'বৃহৎ ১৪ম', sargam: 'নি (সপ্তক)' },
    { semitones: 24, id: 'P15', en: 'Double octave (P15)', bn: 'দ্বি-অষ্টক', sargam: 'সাঁ (দ্বি)' },
  ];

  function getInterval(semitones) {
    return INTERVALS.find((i) => i.semitones === Number(semitones)) || null;
  }

  function levelPool(level) {
    if (level === 'easy') return [2, 4, 5, 7, 12];
    if (level === 'medium') return [1, 2, 3, 4, 5, 6, 7];
    if (level === 'hard') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    if (level === 'compound') return [13, 14, 15, 16, 17, 19, 24];
    return [2, 4, 5, 7, 12];
  }

  function pickInterval(pool, rand) {
    const r = typeof rand === 'function' ? rand : Math.random;
    const idx = Math.floor(r() * pool.length);
    const semitones = pool[idx];
    return { semitones, ...(getInterval(semitones) || {}) };
  }

  function checkAnswer(target, guess) {
    return Number(target) === Number(guess);
  }

  function sargamForInterval(semitones) {
    const iv = getInterval(semitones);
    return iv ? iv.sargam : '';
  }

  // Inverted interval: simple intervals pair to 9 degrees (e.g. M3 ↔ m6)
  function invertSimple(semitones) {
    if (semitones < 1 || semitones > 12) return null;
    const inv = 12 - semitones;
    if (inv < 1 || inv > 12) return null;
    return getInterval(inv);
  }

  const api = { INTERVALS, getInterval, levelPool, pickInterval, checkAnswer, sargamForInterval, invertSimple };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Intervals = api;
})(typeof window !== 'undefined' ? window : globalThis);
