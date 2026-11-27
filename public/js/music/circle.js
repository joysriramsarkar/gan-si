/**
 * Circle of Fifths — pure, testable. muted.io interactive chart adaptation.
 * Works in browser (window.CircleFifths) and Node/Jest (module.exports).
 * Circle order (clockwise fifths): C G D A E B F# Db Ab Eb Bb F
 */
(function (root) {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const CIRCLE_NAMES = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

  function fifoStepForPc(pc) {
    return (normalizePc(pc) * 7) % 12;
  }
  function pcForStep(step) {
    return (normalizePc(step) * 7) % 12;
  }
  function normalizePc(pc) {
    return ((Number(pc) % 12) + 12) % 12;
  }

  function circleEntries(mode = 'major') {
    return CIRCLE_NAMES.map((name, step) => {
      const pc = pcForStep(step);
      const sharpName = NOTE_NAMES[pc];
      // Use circle name for outer ring; minor ring is relative minor (-3 semitones)
      const relativePc = mode === 'minor' ? normalizePc(pc + 9) : null;
      return { step, pc, name, sharpName, relativePc: mode === 'minor' ? pc : relativePc };
    });
  }

  // Major key signatures for the 12 circle positions (step 0..11)
  // step: 0 C0, 1 G1#, 2 D2#, 3 A3#, 4 E4#, 5 B5#, 6 F#6#, 7 Db5b, 8 Ab4b, 9 Eb3b, 10 Bb2b, 11 F1b
  const MAJOR_SIG = [
    { type: 'none', count: 0, label: 'স্বাভাবিক (সি)', en: 'No sharps/flats' },
    { type: 'sharp', count: 1, label: '১ শার্প', en: '1 sharp (F#)' },
    { type: 'sharp', count: 2, label: '২ শার্প', en: '2 sharps (F# C#)' },
    { type: 'sharp', count: 3, label: '৩ শার্প', en: '3 sharps (F# C# G#)' },
    { type: 'sharp', count: 4, label: '৪ শার্প', en: '4 sharps' },
    { type: 'sharp', count: 5, label: '৫ শার্প', en: '5 sharps' },
    { type: 'flat', count: 6, label: '৬ শার্প/ফ্ল্যাট', en: '6 sharps / 6 flats' },
    { type: 'flat', count: 5, label: '৫ ফ্ল্যাট', en: '5 flats' },
    { type: 'flat', count: 4, label: '৪ ফ্ল্যাট', en: '4 flats' },
    { type: 'flat', count: 3, label: '৩ ফ্ল্যাট', en: '3 flats' },
    { type: 'flat', count: 2, label: '২ ফ্ল্যাট', en: '2 flats' },
    { type: 'flat', count: 1, label: '১ ফ্ল্যাট', en: '1 flat (Bb)' },
  ];

  function keySignature(pc, mode = 'major') {
    const tonic = mode === 'minor' ? normalizePc(pc + 3) : normalizePc(pc);
    const step = fifoStepForPc(tonic);
    return { ...MAJOR_SIG[step], step, tonicPc: tonic };
  }

  function relativeKey(pc, mode = 'major') {
    if (mode === 'minor') return { pc: normalizePc(pc + 3), mode: 'major' };
    return { pc: normalizePc(pc + 9), mode: 'minor' };
  }

  // muted.io-style demo intervals on the circle: +1 step = P5, -1 = P4, +4 = M3, -3 = m3, opposite = tritone
  function circleInterval(fromPc, toPc) {
    const dist = (normalizePc(toPc) - normalizePc(fromPc) + 12) % 12;
    // chromatic semitones; circle distance is separate
    const fromStep = fifoStepForPc(fromPc);
    const toStep = fifoStepForPc(toPc);
    const stepDist = ((toStep - fromStep) % 12 + 12) % 12;
    return { semitones: dist, stepDist };
  }

  const SCALE_FORMULAS = {
    major: { nameBn: 'মেজর (আয়োনিয়ান)', steps: ['W', 'W', 'H', 'W', 'W', 'W', 'H'], semis: [2, 2, 1, 2, 2, 2, 1] },
    minor: { nameBn: 'ন্যাচারাল মাইনর (এওলিয়ান)', steps: ['W', 'H', 'W', 'W', 'H', 'W', 'W'], semis: [2, 1, 2, 2, 1, 2, 2] },
  };

  const api = {
    NOTE_NAMES, CIRCLE_NAMES, normalizePc, fifoStepForPc, pcForStep,
    circleEntries, keySignature, relativeKey, circleInterval, SCALE_FORMULAS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CircleFifths = api;
})(typeof window !== 'undefined' ? window : globalThis);
