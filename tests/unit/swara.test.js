const Swara = require('../../public/js/music/swara');

describe('swara mapping', () => {
  test('midi 69 (A440) maps with root A# (10) to sargam নি-ish', () => {
    const m = Swara.freqToMidi(440);
    expect(Math.round(m)).toBe(69);
    const s = Swara.midiToSargam(69, 10);
    expect(s.sargamIndex).toBe((69 - 10) % 12);
  });
  test('cents off JI target for exact Sa is 0', () => {
    expect(Swara.centsOff(261.63, 261.63, 0)).toBe(0);
  });
  test('saptak boundaries', () => {
    expect(Swara.saptakOf(48 + 10, 10)).toBe('madhya');
    expect(Swara.saptakOf(30, 10)).toBe('mandra');
    expect(Swara.saptakOf(48 + 10 + 12, 10)).toBe('tara');
  });
  test('in-tune tolerance', () => {
    expect(Swara.isInTune(11)).toBe(true);
    expect(Swara.isInTune(13)).toBe(false);
  });
});
