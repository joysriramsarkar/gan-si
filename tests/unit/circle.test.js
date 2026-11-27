const Circle = require('../../public/js/music/circle');

describe('circle of fifths (muted.io)', () => {
  test('circle order + steps', () => {
    expect(Circle.CIRCLE_NAMES).toEqual(['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F']);
    expect(Circle.fifoStepForPc(0)).toBe(0);
    expect(Circle.fifoStepForPc(7)).toBe(1); // G
    expect(Circle.pcForStep(1)).toBe(7);
    expect(Circle.fifoStepForPc(5)).toBe(11); // F
  });
  test('key signature + relative', () => {
    expect(Circle.keySignature(0, 'major').label).toContain('স্বাভাবিক');
    expect(Circle.keySignature(7, 'major').count).toBe(1);
    expect(Circle.keySignature(0, 'major').type).toBe('none');
    expect(Circle.relativeKey(0, 'major')).toEqual({ pc: 9, mode: 'minor' });
    expect(Circle.relativeKey(9, 'minor')).toEqual({ pc: 0, mode: 'major' });
  });
  test('entries + interval', () => {
    const e = Circle.circleEntries('major');
    expect(e).toHaveLength(12);
    expect(e[0].name).toBe('C');
    expect(Circle.circleInterval(0, 7).semitones).toBe(7);
    expect(Circle.SCALE_FORMULAS.major.steps).toEqual(['W', 'W', 'H', 'W', 'W', 'W', 'H']);
  });
});
