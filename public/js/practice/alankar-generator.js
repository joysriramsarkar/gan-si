/**
 * Alankar generator: deterministic (seeded) practice patterns. Master Plan Sec 5.
 * Levels: beginner < elementary < intermediate < advanced < expert
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
      const idx = [...new Set(raga.aroha_intervals.map(n => ((n % 12) + 12) % 12))];
      return { names: idx.map(i => swaraNameForInterval(i)), intervals: idx };
    }
    return { names: SWARA_7, intervals: INTERVALS_7 };
  }

  function swaraNameForInterval(i) {
    const map = { 0: 'সা', 1: 'রে♭', 2: 'রে', 3: 'গা♭', 4: 'গা', 5: 'মা', 6: 'মা♯', 7: 'পা', 8: 'ধা♭', 9: 'ধা', 10: 'নি♭', 11: 'নি', 12: 'সাঁ' };
    return map[i] ?? `(${i})`;
  }

  function generate({ noteCount = 4, motion = 'saral', bpm = 80, raga = null, seed = 42, steps = 8 } = {}) {
    const rand = seededRand(seed);
    const scale = baseScale(raga);
    const pool = scale.names.filter(n => !['সাঁ'].includes(n) || noteCount >= 7);
    const notes = [];
    let pos = 0;
    for (let s = 0; s < steps; s++) {
      if (motion === 'saral') {
        pos = (pos + 1) % pool.length;
        notes.push(pool.slice(pos, pos + 1 > pool.length ? pool.length : pos + 1).length ? pool[pos % pool.length] : pool[0]);
      } else if (motion === 'bakra') {
        pos = (pos + 2) % pool.length;
        const a = pool[pos % pool.length];
        const b = pool[Math.max(0, (pos - 1 + pool.length) % pool.length)];
        notes.push(a, b);
        if (notes.length >= steps) break;
      } else if (motion === 'lanka') {
        const jump = 2 + Math.floor(rand() * 3);
        pos = (pos + jump) % pool.length;
        notes.push(pool[pos]);
      } else { // punorabritti
        const n = pool[pos % pool.length];
        notes.push(n, n);
        pos = (pos + 1) % pool.length;
        if (notes.length >= steps) break;
      }
      if (notes.length >= steps) break;
    }
    const seq = notes.slice(0, noteCount >= 7 ? steps : steps);
    return {
      title: `স্বয়ংক্রিয় পল্টা (${motion}, ${noteCount} স্বর, ${bpm} BPM)`,
      notes: seq,
      intervals: seq.map(n => scale.names.indexOf(n)).filter(i => i >= 0).map(i => scale.intervals[i]),
      bpm, motion, seed
    };
  }

  const api = { generate, LEVELS: ['beginner', 'elementary', 'intermediate', 'advanced', 'expert'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AlankarGenerator = api;
})(typeof window !== 'undefined' ? window : globalThis);
