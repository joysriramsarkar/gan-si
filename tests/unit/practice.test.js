const G = require('../../public/js/practice/alankar-generator');
const GP = require('../../public/js/practice/guided-practice');
const A = require('../../public/js/practice/analytics');
const T = require('../../public/js/audio/tabla');

describe('alankar generator', () => {
  test('deterministic seed', () => {
    const a = G.generate({ motion: 'lanka', seed: 7, steps: 8 });
    const b = G.generate({ motion: 'lanka', seed: 7, steps: 8 });
    expect(a.notes).toEqual(b.notes);
  });
  test('levels list', () => {
    expect(G.LEVELS).toEqual(['beginner', 'elementary', 'intermediate', 'advanced', 'expert']);
  });
});

describe('guided practice time-based hold', () => {
  test('advances after holdMs, fps-independent', () => {
    const s = GP.createSession(['সা', 'রে'], { holdMs: 300 });
    expect(s.feed({ sungShort: 'সা', inTune: true, now: 0 })).toBe('holding');
    expect(s.feed({ sungShort: 'সা', inTune: true, now: 100 })).toBe('holding');
    expect(s.feed({ sungShort: 'সা', inTune: true, now: 350 })).toBe('advanced');
    expect(s.target()).toBe('রে');
  });
});

describe('analytics', () => {
  test('aggregate + score', () => {
    const ag = A.aggregate([{ date: '2026-11-24T10:00:00', minutes: 10, accuracy: 80 }, { date: '2026-11-23T10:00:00', minutes: 5, accuracy: 60 }]);
    expect(ag.weeklyTotal).toBe(15);
    expect(ag.avgAccuracy).toBe(70);
    expect(A.scoreSession({ pitchAcc: 90, timing: 80, holdRatio: 80, stability: 80, completion: 100 })).toBeGreaterThan(80);
  });
});

describe('taal metadata', () => {
  test('8 taals incl teental 16', () => {
    expect(T.taalList().length).toBe(8);
    expect(T.getTaal('teental').matras).toBe(16);
  });
});
