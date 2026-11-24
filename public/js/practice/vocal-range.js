/**
 * Vocal range classifier (pure). Master Plan Sec 3/practice.
 */
(function (root) {
  function classifyRange(minMidi, maxMidi) {
    if (minMidi == null || maxMidi == null) return null;
    const span = maxMidi - minMidi;
    let voiceType = 'সাধারণ ভোকাল রেঞ্জ';
    if (minMidi < 40) voiceType = 'খাদ / বাস (Bass)';
    else if (minMidi < 45) voiceType = 'ব্যারিটোন (Baritone)';
    else if (minMidi < 52) voiceType = 'টেনর (Tenor)';
    else if (minMidi < 58) voiceType = 'আল্টো / মেজো-সোপ্রানো (Alto/Mezzo)';
    else voiceType = 'সোপ্রানো (Soprano)';
    const idealSaMidi = minMidi + Math.round(span * 0.35);
    return { minMidi, maxMidi, semitonesSpan: span, octavesSpan: (span / 12).toFixed(1), idealSaMidi, idealRootIdx: ((idealSaMidi % 12) + 12) % 12, voiceType };
  }
  const api = { classifyRange };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VocalRange = api;
})(typeof window !== 'undefined' ? window : globalThis);
