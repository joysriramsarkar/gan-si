/**
 * Tabla taal metadata (pure). Master Plan Sec 7.
 * Canonical source for tests + UI; audio-engine.js keeps scheduler.
 */
(function (root) {
  const TAALS = {
    teental: { name: 'ত্রিতাল (Teental - ১৬ মাত্রা)', matras: 16, divisions: [{ name: '১ম', from: 1, to: 4, mark: 'সম' }, { name: '২য়', from: 5, to: 8, mark: 'তালি' }, { name: '৩য়', from: 9, to: 12, mark: 'খালি' }, { name: '৪র্থ', from: 13, to: 16, mark: 'তালি' }] },
    keherwa: { name: 'কাহারবা (Keherwa - ৮ মাত্রা)', matras: 8, divisions: [] },
    dadra: { name: 'দাদরা (Dadra - ৬ মাত্রা)', matras: 6, divisions: [] },
    rupak: { name: 'রূপক (Rupak - ৭ মাত্রা)', matras: 7, divisions: [] },
    jhaptal: { name: 'ঝাঁপতাল (Jhaptal - ১০ মাত্রা)', matras: 10, divisions: [] },
    ektaal: { name: 'একতাল (Ektaal - ১২ মাত্রা)', matras: 12, divisions: [] },
    tewra: { name: 'তেওড়া (Tewra - ৭ মাত্রা)', matras: 7, divisions: [] },
    deepchandi: { name: 'দীপচন্দী (Deepchandi - ১৪ মাত্রা)', matras: 14, divisions: [] }
  };
  function taalList() { return Object.entries(TAALS).map(([id, t]) => ({ id, ...t })); }
  function getTaal(id) { return TAALS[id] || TAALS.teental; }
  const api = { TAALS, taalList, getTaal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TablaData = api;
})(typeof window !== 'undefined' ? window : globalThis);
