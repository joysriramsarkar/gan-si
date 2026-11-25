#!/usr/bin/env node
/**
 * Alankar data validation (P1 data hygiene).
 *
 * 1. notes_seq must be exactly the token sequence of `notes` (separators
 *    stripped) — the old hand-written copies drifted into truncated
 *    sequences that no longer matched the printed alankar.
 * 2. Every token must be a known swara notation (সা রে♭ রে গা♭ গা মা মা♯ পা
 *    ধা♭ ধা নি♭ নি সাঁ) so guided practice can map targets to semitones.
 *
 * --fix rewrites notes_seq in place; without it the script only checks.
 */
const fs = require('fs');
const path = require('path');

const KNOWN = new Set(['সা', 'রে♭', 'রে', 'গা♭', 'গা', 'মা', 'মা♯', 'পা', 'ধা♭', 'ধা', 'নি♭', 'নি', 'সাঁ']);

function tokens(noteString) {
  return String(noteString || '').replace(/[|,]/g, ' ').split(/\s+/).filter(Boolean);
}

function run(file, fix) {
  const raw = fs.readFileSync(file, 'utf-8');
  const data = JSON.parse(raw);
  const arr = Array.isArray(data) ? data : (data.alankars || []);
  const errors = [];
  let fixed = 0;
  for (const item of arr) {
    const tok = tokens(item.notes);
    if (!tok.length) { errors.push(`[${item.id}] notes is empty`); continue; }
    const unknown = tok.filter(t => !KNOWN.has(t));
    if (unknown.length) errors.push(`[${item.id}] unknown swara notation: ${unknown.join(', ')}`);
    const expected = tok.join(' ');
    if ((item.notes_seq || '') !== expected) {
      if (fix) {
        item.notes_seq = expected;
        fixed++;
      } else {
        errors.push(`[${item.id}] notes_seq does not match notes (run with --fix)`);
      }
    }
  }
  if (fix && (fixed > 0 || JSON.stringify(arr, null, 2) !== JSON.stringify(Array.isArray(data) ? data : data.alankars, null, 2))) {
    const out = Array.isArray(data) ? arr : Object.assign({}, data, { alankars: arr });
    fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n', 'utf-8');
  }
  if (errors.length) {
    console.error('❌ alankar validation failed:');
    for (const e of errors) console.error('   • ' + e);
    process.exit(1);
  }
  console.log(`✅ ${path.basename(file)}: ${arr.length} alankar(s) valid${fix ? `, ${fixed} notes_seq regenerated` : ''}`);
}

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const files = args.filter(a => !a.startsWith('--'));
const targets = files.length ? files : [
  path.join(__dirname, '..', 'data', 'alankars.json'),
  path.join(__dirname, '..', 'public', 'data', 'alankars.json')
];
let failed = 0;
for (const f of targets) {
  if (!fs.existsSync(f)) { console.error(`missing: ${f}`); failed++; continue; }
  try { run(f, fix); } catch (e) { console.error(`${f}: ${e.message}`); failed++; }
}
process.exit(failed ? 1 : 0);
