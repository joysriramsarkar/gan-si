/**
 * Chords — pure, testable. muted.io Piano Chords (14 qualities) adaptation.
 * Works in browser (window.Chords) and Node/Jest (module.exports).
 */
(function (root) {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_NAMES_BN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const CHORD_QUALITIES = [
    { id: 'maj', symbol: 'maj', nameEn: 'Major', nameBn: 'মেজর', intervals: [0, 4, 7], formula: '১ ৩ ৫ (root, major 3rd, perfect 5th)' },
    { id: 'maj7', symbol: 'maj7', nameEn: 'Major 7th', nameBn: 'মেজর ৭', intervals: [0, 4, 7, 11], formula: '১ ৩ ৫ ৭' },
    { id: 'm', symbol: 'm', nameEn: 'Minor', nameBn: 'মাইনর', intervals: [0, 3, 7], formula: '১ ♭৩ ৫' },
    { id: 'm7', symbol: 'm7', nameEn: 'Minor 7th', nameBn: 'মাইনর ৭', intervals: [0, 3, 7, 10], formula: '১ ♭৩ ৫ ♭৭' },
    { id: 'dim', symbol: 'dim', nameEn: 'Diminished', nameBn: 'ডিমিনিশড', intervals: [0, 3, 6], formula: '১ ♭৩ ♭৫' },
    { id: 'dim7', symbol: 'dim7', nameEn: 'Diminished 7th', nameBn: 'ডিমিনিশড ৭', intervals: [0, 3, 6, 9], formula: '১ ♭৩ ♭৫ ♭♭৭' },
    { id: 'aug', symbol: 'aug', nameEn: 'Augmented', nameBn: 'অগমেন্টেড', intervals: [0, 4, 8], formula: '১ ৩ ♯৫' },
    { id: 'aug7', symbol: 'aug7', nameEn: 'Augmented 7th', nameBn: 'অগমেন্টেড ৭', intervals: [0, 4, 8, 10], formula: '১ ৩ ♯৫ ♭৭' },
    { id: 'sus2', symbol: 'sus2', nameEn: 'Suspended 2nd', nameBn: 'সাস ২', intervals: [0, 2, 7], formula: '১ ২ ৫' },
    { id: 'sus4', symbol: 'sus4', nameEn: 'Suspended 4th', nameBn: 'সাস ৪', intervals: [0, 5, 7], formula: '১ ৪ ৫' },
    { id: 'dom7', symbol: '7', nameEn: 'Dominant 7th', nameBn: 'ডমিন্যান্ট ৭', intervals: [0, 4, 7, 10], formula: '১ ৩ ৫ ♭৭' },
    { id: 'm7b5', symbol: 'm7b5', nameEn: 'Half-Diminished', nameBn: 'হাফ-ডিমিনিশড', intervals: [0, 3, 6, 10], formula: '১ ♭৩ ♭৫ ♭৭' },
    { id: 'maj6', symbol: 'maj6', nameEn: 'Major 6th', nameBn: 'মেজর ৬', intervals: [0, 4, 7, 9], formula: '১ ৩ ৫ ৬' },
    { id: 'm6', symbol: 'm6', nameEn: 'Minor 6th', nameBn: 'মাইনর ৬', intervals: [0, 3, 7, 9], formula: '১ ♭৩ ৫ ৬' },
  ];

  const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
  const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

  function getQuality(id) {
    return CHORD_QUALITIES.find((q) => q.id === id) || null;
  }

  function normalizePc(pc) {
    return ((Number(pc) % 12) + 12) % 12;
  }

  function chordPcs(rootPc, qualityId) {
    const q = getQuality(qualityId);
    if (!q) return [];
    const rootPcN = normalizePc(rootPc);
    return q.intervals.map((i) => normalizePc(rootPcN + i));
  }

  function chordNoteNames(rootPc, qualityId) {
    return chordPcs(rootPc, qualityId).map((pc) => NOTE_NAMES[pc]);
  }

  function chordName(rootPc, qualityId) {
    const q = getQuality(qualityId);
    if (!q) return '';
    return `${NOTE_NAMES[normalizePc(rootPc)]}${q.symbol}`;
  }

  function chordMidiNotes(rootPc, qualityId, baseOctave) {
    const q = getQuality(qualityId);
    if (!q) return [];
    const oct = Number(baseOctave);
    const rootMidi = (oct + 1) * 12 + normalizePc(rootPc);
    return q.intervals.map((i) => rootMidi + i);
  }

  function getScaleNotes(tonicPc, mode) {
    const scale = mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
    const tonic = normalizePc(tonicPc);
    return scale.map((i) => normalizePc(tonic + i));
  }

  function getScaleNoteNames(tonicPc, mode) {
    return getScaleNotes(tonicPc, mode).map((pc) => NOTE_NAMES[pc]);
  }

  function diatonicChords(tonicPc, mode) {
    const tonic = normalizePc(tonicPc);
    if (mode === 'minor') {
      const degrees = [0, 2, 3, 5, 7, 8, 10];
      const romans = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
      const quals = ['m', 'dim', 'maj', 'm', 'm', 'maj', 'maj'];
      return degrees.map((d, i) => {
        const rootPc = normalizePc(tonic + d);
        return { degree: i + 1, roman: romans[i], rootPc, quality: quals[i], name: chordName(rootPc, quals[i]) };
      });
    }
    const degrees = [0, 2, 4, 5, 7, 9, 11];
    const romans = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const quals = ['maj', 'm', 'm', 'maj', 'maj', 'm', 'dim'];
    return degrees.map((d, i) => {
      const rootPc = normalizePc(tonic + d);
      return { degree: i + 1, roman: romans[i], rootPc, quality: quals[i], name: chordName(rootPc, quals[i]) };
    });
  }

  function transposeChord(rootPc, qualityId, semitones) {
    const newRoot = normalizePc(Number(rootPc) + Number(semitones));
    return { rootPc: newRoot, quality: qualityId, name: chordName(newRoot, qualityId), pcs: chordPcs(newRoot, qualityId) };
  }

  const api = {
    NOTE_NAMES, NOTE_NAMES_BN, CHORD_QUALITIES, MAJOR_SCALE, MINOR_SCALE,
    getQuality, normalizePc, chordPcs, chordNoteNames, chordName, chordMidiNotes,
    getScaleNotes, getScaleNoteNames, diatonicChords, transposeChord,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Chords = api;
})(typeof window !== 'undefined' ? window : globalThis);
