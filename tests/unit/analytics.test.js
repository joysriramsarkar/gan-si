/**
 * Practice analytics: calendar-window aggregation (not "last N practiced
 * days"), local-day keys, and the weakest-swara suggestion.
 */
const A = require('../../public/js/practice/analytics');

function localSession(daysAgo, minutes) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const p = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00:00.000Z`,
    minutes
  };
}

describe('PracticeAnalytics.dateKey', () => {
  test('uses the local calendar day, not ISO-UTC', () => {
    const d = new Date(2026, 0, 15, 1, 30); // 01:30 local on Jan 15
    expect(A.dateKey(d)).toBe('2026-01-15');
  });

  test('degrades to a string slice for unparseable input', () => {
    expect(A.dateKey('not-a-date')).toBe('not-a-date'.slice(0, 10));
    expect(A.dateKey(null)).toBe('');
  });
});

describe('PracticeAnalytics.aggregate', () => {
  test('weekly/monthly totals are calendar windows ending today', () => {
    const sessions = [
      localSession(0, 10),   // today
      localSession(3, 5),    // 3 days ago — inside both windows
      localSession(20, 7),   // 20 days ago — monthly only
      localSession(40, 9)    // 40 days ago — neither
    ];
    const ag = A.aggregate(sessions);
    expect(ag.weeklyTotal).toBe(15);
    expect(ag.monthlyTotal).toBe(22);
  });

  test('a long gap does not turn old practice into "this week"', () => {
    // Practiced on 7 separate days but none within the last 30 days.
    const sessions = [];
    for (let i = 40; i <= 100; i += 7) sessions.push(localSession(i, 10));
    const ag = A.aggregate(sessions);
    expect(ag.weeklyTotal).toBe(0);
    expect(ag.monthlyTotal).toBe(0);
  });

  test('accuracy averages and the best session are preserved', () => {
    const ag = A.aggregate([
      { ...localSession(1, 30), accuracy: 80 },
      { ...localSession(2, 12), accuracy: 90 }
    ]);
    expect(ag.avgAccuracy).toBe(85);
    expect(ag.bestSession.minutes).toBe(30);
  });
});

describe('PracticeAnalytics.suggestNext', () => {
  test('names the weakest swara when miss data exists', () => {
    const out = A.suggestNext({ 'রে': 2, 'নি': 7, 'মা': 1 });
    expect(out).toContain('নি');
  });

  test('falls back to a gentle generic prompt when no data exists', () => {
    expect(A.suggestNext({})).toContain('সরল আরোহণ');
    expect(A.suggestNext(null)).toContain('সরল আরোহণ');
  });
});
