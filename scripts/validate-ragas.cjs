/**
 * Validate data/ragas.json v2 schema. Exit 1 on failure.
 * Usage: node scripts/validate-ragas.cjs
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'ragas.json');
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const ragas = Array.isArray(raw) ? raw : raw.ragas;
let errors = 0;
const norm = (a) => (a || []).map(Number).filter(Number.isFinite).map((n) => ((n % 12) + 12) % 12);

for (const r of ragas) {
  const tag = `raga ${r.id || '?'}`;
  for (const f of ['aroha_intervals', 'avaroha_intervals', 'allowedIntervals']) {
    if (!Array.isArray(r[f])) { console.error(`${tag}: missing ${f}`); errors++; }
  }
  if (r.aroha_intervals && r.avaroha_intervals && r.allowedIntervals) {
    const allowed = new Set(norm(r.allowedIntervals));
    // Khamaj-style mixed shruti: allow avaroha komal Ni even if aroha has shuddha Ni — allowed list covers both
    for (const [key, seq] of [['aroha', r.aroha_intervals], ['avaroha', r.avaroha_intervals]]) {
      for (const n of norm(seq)) {
        // allow high-Sa (12 % 12 == 0) implicitly
        if (!allowed.has(n)) { console.error(`${tag}: ${key} interval ${n} not in allowedIntervals`); errors++; }
      }
    }
  }
  if (r.pakad_intervals && r.allowedIntervals) {
    const allowed = new Set(norm(r.allowedIntervals));
    for (const n of norm(r.pakad_intervals)) {
      if (!allowed.has(n)) { console.error(`${tag}: pakad interval ${n} not in allowedIntervals`); errors++; }
    }
  }
}
if (errors) { console.error(`validate-ragas FAILED: ${errors} errors`); process.exit(1); }
console.log(`validate-ragas OK: ${ragas.length} ragas`);
