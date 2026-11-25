/**
 * Alankar generator: deterministic (seeded) practice patterns. Master Plan Sec 5.
 *
 * Semantics (v2.1): `noteCount` is the number of swaras in one run and
 * `steps` is how many runs are produced. Every run starts on a successive
 * scale step (the first run always starts on সা), so a generated alankar is
 * a real palta: N consecutive swaras, transposed up the scale run by run.
 * Motions:
 *   saral        — straight ascending runs
 *   bakra        — zigzag inside the run (up two, back one)
 *   lanka        — seeded jumps across the scale
 *   punorabritti — each swara of the run doubled
 */
(function (root) {
  const SWARA_7 = ['সা', 'রে', 'গা', 'মা', 'পা', 'ধা', 'নি', 'সাঁ'];
  const INTERVALS_7 = [0, 2, 4, 5, 7, 9, 11, 12];

  function seededRand(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function baseScale(raga) {
    if (raga && Array.isArray(raga.aroha_intervals) && raga.aroha_intervals.length >= 4) {
      const idx = [...new Set(raga.aroha_intervals.map(n => ((n % 12) + 12) % 12))].sort((a, b) => a - b);
      return { names: idx.map(i => swaraNameForInterval(i)), intervals: idx };
    }
    return { names: SWARA_7, intervals: INTERVALS_7 };
  }

  function swaraNameForInterval(i) {
    const map = { 0: 'সা', 1: 'রে♭', 2: 'রে', 3: 'গা♭', 4: 'গা', 5: 'মা', 6: 'মা♯', 7: 'পা', 8: 'ধা♭', 9: 'ধা', 10: 'নি♭', 11: 'নি', 12: 'সাঁ' };
    return map[i] ?? `(${i})`;
  }

  // One run of noteCount swaras starting at scale offset `start`.
  function runNotes(scale, start, noteCount, motion, rand) {
    const len = Math.max(1, Math.min(noteCount, scale.names.length - start));
    const notes = [];
    for (let i = 0; i < len; i++) {
      const at = Math.min(start + i, scale.names.length - 1);
      notes.push(at);
    }
    if (motion === 'bakra') {
      // Zigzag: swap inner pairs so the line turns back on itself.
      for (let i = 1; i + 1 < notes.length; i += 2) {
        const t = notes[i]; notes[i] = notes[i + 1]; notes[i + 1] = t;
      }
    } else if (motion === 'lanka') {
      // Seeded permutation: deterministic shuffle within the run.
      for (let i = notes.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const t = notes[i]; notes[i] = notes[j]; notes[j] = t;
      }
    }
    return notes;
  }

  function generate({ noteCount = 4, motion = 'saral', bpm = 80, raga = null, seed = 42, steps = 8 } = {}) {
    const rand = seededRand(seed);
    const scale = baseScale(raga);
    const n = Math.max(2, Math.min(parseInt(noteCount, 10) || 4, scale.names.length));
    const runCount = Math.max(1, Math.min(parseInt(steps, 10) || 4, 16));
    const maxStart = Math.max(0, scale.names.length - n);

    const positions = [];
    for (let step = 0; step < runCount; step++) {
      const start = Math.min(step, maxStart);
      const run = runNotes(scale, start, n, motion, rand);
      for (const at of run) {
        positions.push(motion === 'punorabritti' ? [at, at] : [at]);
      }
    }

    const notes = positions.flat().map(at => scale.names[at]);
    const intervals = positions.flat().map(at => scale.intervals[at]);
    return {
      title: `স্বয়ংক্রিয় পল্টা (${motion}, ${n} স্বর × ${runCount} ধাপ, ${bpm} BPM)`,
      notes,
      intervals,
      noteCount: n,
      steps: runCount,
      bpm, motion, seed
    };
  }

  const api = { generate, LEVELS: ['beginner', 'elementary', 'intermediate', 'advanced', 'expert'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AlankarGenerator = api;
})(typeof window !== 'undefined' ? window : globalThis);
