const R = require('../../public/js/music/raga-engine');
const ragas = require('../../data/ragas.json');
const byId = Object.fromEntries(ragas.map(r => [r.id, r]));

describe('raga engine', () => {
  test('Bhoopali: Ma/Ni rejected in either direction', () => {
    expect(R.validateNote({ sargamIndex: 5, raga: byId.bhoopali }).ok).toBe(false);
    expect(R.validateNote({ sargamIndex: 10, raga: byId.bhoopali }).ok).toBe(false);
    expect(R.validateNote({ sargamIndex: 4, raga: byId.bhoopali }).ok).toBe(true);
  });
  test('Khamaj: aroha has no Re, avaroha has komal Ni', () => {
    // Re = 2
    expect(R.validateNote({ sargamIndex: 2, direction: 'aroha', raga: byId.khamaj }).ok).toBe(false);
    expect(R.validateNote({ sargamIndex: 2, direction: 'avaroha', raga: byId.khamaj }).ok).toBe(true);
    expect(R.validateNote({ sargamIndex: 10, direction: 'avaroha', raga: byId.khamaj }).ok).toBe(true);
  });
  test('Asavari: Ga/Ni rejected in aroha only', () => {
    expect(R.validateNote({ sargamIndex: 3, direction: 'aroha', raga: byId.asavari }).ok).toBe(false);
    expect(R.validateNote({ sargamIndex: 3, direction: 'avaroha', raga: byId.asavari }).ok).toBe(true);
  });
  test('Marwa: Pa rejected', () => {
    expect(R.validateNote({ sargamIndex: 7, raga: byId.marwa }).ok).toBe(false);
  });
  test('pakad similarity + ranking are cautious aids', () => {
    const s = R.pakadSimilarity([4, 2, 0, 9, 0, 2, 4], byId.bhoopali.pakad_intervals);
    expect(s).toBeGreaterThan(0.7);
    const rank = R.ragaSimilarityScore([4, 2, 0], ragas);
    expect(rank[0].raga_id).toBeDefined();
  });
});
