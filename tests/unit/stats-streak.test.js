const { istDateStr, computeStreak, validateSession } = require('../../src/server/lib/stats-service');

describe('IST streak', () => {
  test('consecutive days increment', () => {
    expect(computeStreak(['2026-11-22', '2026-11-23', '2026-11-24'], '2026-11-24')).toBe(3);
  });
  test('gap resets', () => {
    expect(computeStreak(['2026-11-20', '2026-11-24'], '2026-11-24')).toBe(1);
  });
  test('same-day double session counts once', () => {
    expect(computeStreak(['2026-11-24'], '2026-11-24')).toBe(1);
  });
  test('IST date uses Asia/Kolkata (23:55 UTC = next day IST)', () => {
    // 2026-11-24T00:05:00Z == 05:35 IST same date; 18:30Z == midnight IST next day
    expect(istDateStr(new Date('2026-11-24T18:35:00Z'))).toBe('2026-11-25');
  });
  test('session validation clamps', () => {
    expect(validateSession({ minutes: 0 }).errors.length).toBeGreaterThan(0);
    expect(validateSession({ minutes: 5, accuracy: 200 }).errors.length).toBeGreaterThan(0);
    expect(validateSession({ minutes: 5, accuracy: 80 }).errors).toEqual([]);
  });
});
