/**
 * Alankar generator semantics (v2.1): noteCount = swaras per run,
 * steps = runs; the first run starts on সা; generation is deterministic.
 */
const Gen = require('../../public/js/practice/alankar-generator');

describe('AlankarGenerator.generate', () => {
  test('saral: first run starts on সা and runs are successive transpositions', () => {
    const g = Gen.generate({ noteCount: 4, steps: 3, motion: 'saral', bpm: 80, seed: 7 });
    expect(g.notes.slice(0, 4)).toEqual(['সা', 'রে', 'গা', 'মা']);
    expect(g.notes.slice(4, 8)).toEqual(['রে', 'গা', 'মা', 'পা']);
    expect(g.notes.slice(8, 12)).toEqual(['গা', 'মা', 'পা', 'ধা']);
    expect(g.notes).toHaveLength(12);
  });

  test('noteCount controls the run length, not a cap on steps', () => {
    const g4 = Gen.generate({ noteCount: 4, steps: 5, motion: 'saral', seed: 1 });
    const g5 = Gen.generate({ noteCount: 5, steps: 5, motion: 'saral', seed: 1 });
    expect(g4.notes).toHaveLength(20);
    expect(g5.notes.slice(0, 5)).toEqual(['সা', 'রে', 'গা', 'মা', 'পা']);
  });

  test('deterministic: the same seed produces the same pattern', () => {
    const a = Gen.generate({ noteCount: 4, steps: 4, motion: 'lanka', seed: 1234 });
    const b = Gen.generate({ noteCount: 4, steps: 4, motion: 'lanka', seed: 1234 });
    expect(b.notes).toEqual(a.notes);
  });

  test('bakra zigzags without losing the run boundary start on সা', () => {
    const g = Gen.generate({ noteCount: 4, steps: 1, motion: 'bakra', seed: 3 });
    expect(g.notes[0]).toBe('সা');
    expect(new Set(g.notes)).toEqual(new Set(['সা', 'রে', 'গা', 'মা']));
  });

  test('punorabritti doubles every swara', () => {
    const g = Gen.generate({ noteCount: 3, steps: 2, motion: 'punorabritti', seed: 9 });
    expect(g.notes.slice(0, 6)).toEqual(['সা', 'সা', 'রে', 'রে', 'গা', 'গা']);
    expect(g.notes).toHaveLength(12);
  });

  test('intervals line up with the notes', () => {
    const g = Gen.generate({ noteCount: 4, steps: 2, motion: 'saral', seed: 5 });
    expect(g.intervals).toEqual([0, 2, 4, 5, 2, 4, 5, 7]);
  });

  test('raga aroha scales are honoured (khamaj omits রে in aroha)', () => {
    const khamaj = {
      aroha_intervals: [0, 4, 5, 7, 9, 11, 12]
    };
    const g = Gen.generate({ noteCount: 4, steps: 2, motion: 'saral', raga: khamaj, seed: 2 });
    expect(g.notes.slice(0, 4)).toEqual(['সা', 'গা', 'মা', 'পা']);
  });
});
