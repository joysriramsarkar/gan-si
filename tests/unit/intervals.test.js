const Intervals = require('../../public/js/music/intervals');

describe('intervals (muted.io adaptation)', () => {
  test('24 intervals, simple 1..12 present', () => {
    expect(Intervals.INTERVALS).toHaveLength(24);
    expect(Intervals.getInterval(1).id).toBe('m2');
    expect(Intervals.getInterval(7).id).toBe('P5');
    expect(Intervals.getInterval(12).id).toBe('P8');
    expect(Intervals.getInterval(24).id).toBe('P15');
  });

  test('level pools', () => {
    expect(Intervals.levelPool('easy')).toEqual([2, 4, 5, 7, 12]);
    expect(Intervals.levelPool('hard')).toHaveLength(12);
    expect(Intervals.levelPool('compound')).toContain(24);
  });

  test('pick is deterministic with seeded rand', () => {
    const a = Intervals.pickInterval([5, 7], () => 0);
    expect(a.semitones).toBe(5);
    const b = Intervals.pickInterval([5, 7], () => 0.99);
    expect(b.semitones).toBe(7);
  });

  test('check + sargam + invert', () => {
    expect(Intervals.checkAnswer(7, 7)).toBe(true);
    expect(Intervals.checkAnswer(7, 5)).toBe(false);
    expect(Intervals.sargamForInterval(7)).toBe('পা');
    expect(Intervals.sargamForInterval(4)).toBe('গা');
    expect(Intervals.invertSimple(4).semitones).toBe(8); // M3 ↔ m6
  });
});
