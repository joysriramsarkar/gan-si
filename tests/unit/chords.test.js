const Chords = require('../../public/js/music/chords');

describe('chords (muted.io Piano Chords)', () => {
  test('14 qualities', () => {
    expect(Chords.CHORD_QUALITIES).toHaveLength(14);
    expect(Chords.getQuality('maj').intervals).toEqual([0, 4, 7]);
    expect(Chords.getQuality('dom7').intervals).toEqual([0, 4, 7, 10]);
  });
  test('chord names + pcs', () => {
    expect(Chords.chordName(0, 'maj')).toBe('Cmaj');
    expect(Chords.chordName(7, 'dom7')).toBe('G7');
    expect(Chords.chordPcs(0, 'm')).toEqual([0, 3, 7]);
  });
  test('midi + scale', () => {
    expect(Chords.chordMidiNotes(0, 'maj', 3)).toEqual([48, 52, 55]);
    expect(Chords.getScaleNoteNames(0, 'major')).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(Chords.getScaleNoteNames(9, 'minor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });
  test('diatonic + transpose', () => {
    const dia = Chords.diatonicChords(0, 'major');
    expect(dia).toHaveLength(7);
    expect(dia[0].name).toBe('Cmaj');
    expect(dia[6].name).toBe('Bdim');
    expect(Chords.transposeChord(0, 'maj', 7).name).toBe('Gmaj');
  });
});
