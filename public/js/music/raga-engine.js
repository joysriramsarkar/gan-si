/**
 * Raga engine: direction-aware validation + pakad matching. Master Plan Sec 4/6.
 * IMPORTANT: interval lists only; chalan/phrase decides identity, not this score alone.
 */
(function (root) {
  function normSeq(seq) {
    return (seq || []).map(Number).filter(n => Number.isFinite(n)).map(n => ((n % 12) + 12) % 12);
  }

  function allowedSet(raga) {
    return new Set(normSeq(raga && raga.allowedIntervals));
  }

  function validateNote({ sargamIndex, direction = 'either', raga }) {
    if (!raga) return { ok: true, reason: 'no-raga' };
    const idx = ((sargamIndex % 12) + 12) % 12;
    if (direction === 'aroha' && Array.isArray(raga.aroha_intervals)) {
      const ok = normSeq(raga.aroha_intervals).includes(idx);
      return { ok, reason: ok ? null : 'not-in-aroha', msg: ok ? null : `${raga.name}-এর আরোহে এই স্বরটি নেই` };
    }
    if (direction === 'avaroha' && Array.isArray(raga.avaroha_intervals)) {
      const ok = normSeq(raga.avaroha_intervals).includes(idx);
      return { ok, reason: ok ? null : 'not-in-avaroha', msg: ok ? null : `${raga.name}-এর অবরোহে এই স্বরটি নেই` };
    }
    const ok = allowedSet(raga).has(idx);
    return { ok, reason: ok ? null : 'apaswara', msg: ok ? null : `⚠️ ${raga.name}-এ এই স্বরটি বর্জিত (অপস্বর)!` };
  }

  function validatePhrase(swaraSeq, raga, direction = 'either') {
    for (let i = 0; i < swaraSeq.length; i++) {
      const r = validateNote({ sargamIndex: swaraSeq[i], direction, raga });
      if (!r.ok) return { ok: false, violatedAt: i, ...r };
    }
    return { ok: true };
  }

  // Longest-ordered-subsequence-ish similarity 0..1 against pakad (cautious: phrase aid only)
  function pakadSimilarity(sungSeq, pakadSeq) {
    const a = normSeq(sungSeq);
    const b = normSeq(pakadSeq);
    if (!b.length) return 0;
    let matches = 0;
    let j = 0;
    for (let i = 0; i < a.length && j < b.length; i++) {
      if (a[i] === b[j]) { matches++; j++; }
    }
    return Math.round((matches / b.length) * 100) / 100;
  }

  function ragaSimilarityScore(sungSeq, candidates) {
    // Returns sorted [{raga_id, score}] — label as "সম্ভাব্য মিল", never final verdict.
    const a = normSeq(sungSeq);
    return (candidates || [])
      .map(r => ({ raga_id: r.id, score: pakadSimilarity(a, r.pakad_intervals || []) }))
      .sort((x, y) => y.score - x.score);
  }

  const api = { validateNote, validatePhrase, pakadSimilarity, ragaSimilarityScore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RagaEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
