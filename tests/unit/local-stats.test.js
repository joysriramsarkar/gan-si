const LocalStats = require('../../public/js/practice/local-stats.js');

function dayKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return LocalStats.dateKey(d);
}

describe('local-first practice stats (static/Vercel mode)', () => {
  test('totals, current streak and windows come from day entries', () => {
    const days = {
      [dayKey(0)]: 10,
      [dayKey(-1)]: 5,
      [dayKey(-2)]: 20,
      [dayKey(-10)]: 7
    };
    const s = LocalStats.summary({ days });
    expect(s.totalMinutes).toBe(42);
    expect(s.currentStreak).toBe(3); // today, yesterday, day before
    expect(s.weekMinutes).toBe(35); // the 7-minute day is 10 days ago
    expect(s.monthMinutes).toBe(42);
    expect(s.history).toHaveLength(4);
    expect(s.history[s.history.length - 1]).toEqual({ date: dayKey(0), minutes: 10 });
  });

  test('a streak ending yesterday is still current until today is missed', () => {
    const days = { [dayKey(-1)]: 12, [dayKey(-2)]: 8 };
    const s = LocalStats.summary({ days });
    expect(s.totalMinutes).toBe(20);
    expect(s.currentStreak).toBe(2);
  });

  test('gaps break the streak', () => {
    const days = { [dayKey(0)]: 4, [dayKey(-2)]: 9, [dayKey(-3)]: 1 };
    const s = LocalStats.summary({ days });
    expect(s.currentStreak).toBe(1);
  });

  test('empty state is honest zero', () => {
    const s = LocalStats.summary({ days: {} });
    expect(s.totalMinutes).toBe(0);
    expect(s.currentStreak).toBe(0);
    expect(s.weekMinutes).toBe(0);
    expect(s.history).toEqual([]);
  });

  test('dateKey uses local calendar fields', () => {
    const d = new Date(2026, 10, 27); // 27 Nov 2026, local
    expect(LocalStats.dateKey(d)).toBe('2026-11-27');
  });
});
