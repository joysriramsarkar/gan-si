const RL = require('../../public/js/practice/raga-learning');
const ragas = require('../../data/ragas.json');
const byId = Object.fromEntries(ragas.map(r => [r.id, r]));

function singTarget(session, now) {
  const { target } = session.current();
  return session.feed({ midi: target.midi, cents: 0, inTune: true, now });
}

describe('raga learning controller', () => {
  test('stage order is Sa → Aroha → Avaroha → Pakad', () => {
    const s = RL.createSession(byId.bhoopali, { baseMidi: 48, holdMs: 0 });
    expect(s.stages.map(x => x.id)).toEqual(['sa', 'aroha', 'avaroha', 'pakad']);
    expect(s.current().target.label).toBe('সা');
  });

  test('Yaman lower Ni is one semitone below Sa, not an octave above', () => {
    const s = RL.createSession(byId.yaman, { baseMidi: 48, holdMs: 0 });
    const aroha = s.stages.find(x => x.id === 'aroha');
    expect(aroha.targets[0].midi).toBe(47);
    expect(aroha.targets[1].midi).toBe(48);
    expect(aroha.targets.at(-1).midi).toBe(60);
  });

  test('low Sa and high Sa are distinct absolute targets', () => {
    const s = RL.createSession(byId.bhoopali, { baseMidi: 48, holdMs: 0 });
    const aroha = s.stages.find(x => x.id === 'aroha');
    expect(aroha.targets[0].midi).toBe(48);
    expect(aroha.targets.at(-1).midi).toBe(60);
    s.feed({ midi: 60, cents: 0, inTune: true, now: 0 });
    expect(s.completed).toBe(0);
    expect(s.lastResult).toBe('wrong-octave');
  });

  test('hold is time-based and wrong pitch resets it', () => {
    const s = RL.createSession(byId.bhoopali, { baseMidi: 48, holdMs: 300 }).start(0);
    expect(s.feed({ midi: 48, cents: 0, inTune: true, now: 0 })).toBe('holding');
    expect(s.feed({ midi: 50, cents: 0, inTune: true, now: 100 })).toBe('reset');
    expect(s.feed({ midi: 48, cents: 0, inTune: true, now: 150 })).toBe('holding');
    expect(s.feed({ midi: 48, cents: 0, inTune: true, now: 449 })).toBe('holding');
    expect(s.feed({ midi: 48, cents: 0, inTune: true, now: 450 })).toBe('stage-complete');
  });

  test('Khamaj avaroha accepts komal Ni but aroha does not', () => {
    const s = RL.createSession(byId.khamaj, { baseMidi: 48, holdMs: 0 });
    const aroha = s.stages.find(x => x.id === 'aroha');
    const avaroha = s.stages.find(x => x.id === 'avaroha');
    expect(aroha.targets.some(t => t.interval === 10)).toBe(false);
    expect(avaroha.targets.some(t => t.interval === 10)).toBe(true);
  });

  test('complete lesson reports cautious pakad similarity and elapsed time', () => {
    const s = RL.createSession(byId.bhoopali, { baseMidi: 48, holdMs: 0 }).start(0);
    let now = 0;
    while (s.finishedAt == null && now < 100) {
      singTarget(s, now);
      now++;
    }
    expect(s.finishedAt).not.toBeNull();
    expect(s.progress()).toBe(100);
    expect(s.summary().pakadSimilarity).toBe(1);
    expect(s.summary().elapsedMs).toBeGreaterThanOrEqual(0);
    expect(s.summary().finished).toBe(true);
  });

  test('pakad similarity penalizes an extra wrong swara instead of ignoring it', () => {
    const expected = byId.bhoopali.pakad_intervals;
    expect(RL.phraseSimilarity([5, ...expected], expected)).toBeLessThan(1);
    expect(RL.phraseSimilarity(expected, expected)).toBe(1);
  });

  test('repeated pakad swaras are preserved as separate phrase steps', () => {
    const s = RL.createSession(byId.bhairav, { baseMidi: 48, holdMs: 0 }).start(0);
    let now = 0;
    while (s.finishedAt == null && now < 100) {
      singTarget(s, now);
      now++;
    }
    expect(s.summary().pakadSimilarity).toBe(1);
    expect(s.pakadSequence).toEqual(byId.bhairav.pakad_intervals.map(n => ((n % 12) + 12) % 12));
  });

  test('silence does not lower voiced-practice accuracy', () => {
    const s = RL.createSession(byId.bhoopali, { baseMidi: 48, holdMs: 0 }).start(0);
    s.feed({ midi: null, inTune: false, now: 0 });
    singTarget(s, 1);
    expect(s.summary().accuracy).toBe(100);
  });
});
