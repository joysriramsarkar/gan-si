/**
 * Swara / Shruti mapping — pure, testable. Master Plan Sec 3.2
 * Works in browser (window.Swara) and Node/Jest (module.exports).
 */
(function (root) {
  const NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SARGAM_SHORT = ['সা', 'রে♭', 'রে', 'গা♭', 'গা', 'মা', 'মা♯', 'পা', 'ধা♭', 'ধা', 'নি♭', 'নি'];
  const SARGAM_LONG = ['সা (Sa)', 'রে♭ (কোমল)', 'রে (শুদ্ধ)', 'গা♭ (কোমল)', 'গা (শুদ্ধ)', 'মা (শুদ্ধ)', 'মা♯ (তীব্র)', 'পা (Pa)', 'ধা♭ (কোমল)', 'ধা (শুদ্ধ)', 'নি♭ (কোমল)', 'নি (শুদ্ধ)'];
  // Movable-Do chromatic solfege for the same 12 pitch classes from Sa.
  const SOLFEGE_SHORT = ['Do', 'Ra', 'Re', 'Me', 'Mi', 'Fa', 'Se', 'Sol', 'Le', 'La', 'Te', 'Ti'];
  // Just Intonation cents from Sa
  const JI_CENTS = [0, 112, 204, 316, 386, 498, 590, 702, 814, 884, 1018, 1088];

  function freqToMidi(freq, a4 = 440) {
    return 12 * (Math.log(freq / a4) / Math.log(2)) + 69;
  }
  function midiToFreq(midi, a4 = 440) {
    return a4 * Math.pow(2, (midi - 69) / 12);
  }
  function centsBetween(freq, refFreq) {
    return 1200 * (Math.log(freq / refFreq) / Math.log(2));
  }
  function midiToSargam(midi, rootOffset) {
    const idx = (((Math.round(midi) % 12) - rootOffset) % 12 + 12) % 12;
    return { sargamIndex: idx, short: SARGAM_SHORT[idx], long: SARGAM_LONG[idx] };
  }
  function centsOff(freq, saFreq, sargamIndex) {
    const actual = centsBetween(freq, saFreq);
    let diff = actual - JI_CENTS[sargamIndex];
    // Bring to the nearest octave only. Folding by 100 cents (the old code)
    // flipped the sign of a clearly sharp/flat note (e.g. +59c became -41c).
    diff = ((diff % 1200) + 1200) % 1200;
    if (diff > 600) diff -= 1200;
    return Math.round(diff) || 0;
  }
  function solfegeOf(sargamIndex) {
    return SOLFEGE_SHORT[((Number(sargamIndex) % 12) + 12) % 12];
  }
  function saptakOf(midi, rootOffset) {
    const middleSaMidi = 48 + rootOffset;
    const m = Math.round(midi);
    if (m < middleSaMidi) return 'mandra';
    if (m >= middleSaMidi + 12) return 'tara';
    return 'madhya';
  }
  function saptakLabel(saptak) {
    return saptak === 'mandra' ? 'মন্দ্র সপ্তক (উদারা)' : saptak === 'tara' ? 'তার সপ্তক (তারা)' : 'মধ্য সপ্তক (মুদারা)';
  }
  function isInTune(cents, tol = 12) {
    return Math.abs(cents) <= tol;
  }

  const api = { NOTE_STRINGS, SARGAM_SHORT, SARGAM_LONG, SOLFEGE_SHORT, JI_CENTS, freqToMidi, midiToFreq, centsBetween, midiToSargam, centsOff, solfegeOf, saptakOf, saptakLabel, isInTune };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Swara = api;
})(typeof window !== 'undefined' ? window : globalThis);
