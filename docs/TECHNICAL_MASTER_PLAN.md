# Gan-si Technical Master Plan v1.0 — ✅ Implemented (v2.0.0)
> সুর সাধনা Pro — ভারতীয় শাস্ত্রীয় ও বাংলা সংগীত শেখার পূর্ণাঙ্গ সাধনা-প্ল্যাটফর্ম
> Repo: `joysriramsarkar/gan-si` | তারিখ: 2026-11-24 | ভিত্তি: বর্তমান `server.js`, `public/app.js`, `audio-engine.js`, `pitch-detector.js`
>
> **বাস্তবায়ন অবস্থা (2026-11-24):** Phase 1–5 সম্পন্ন + বাকি কাজ — তানপুরা per-string gain/decay/auto-stop/sample-layer, token auth + ownership check, Ear Training ট্যাব, PWA আইকন, Capacitor config + `docs/ANDROID.md`, `docs/VERIFICATION.md`, Playwright 6 spec সবুজ। `npm test` (38) + `npm run validate:ragas` + `npm run test:browser` (6) দিয়ে যাচাইকৃত।

## 0. মূলনীতি (Non-negotiable)

1. **শিক্ষা > স্কোর:** Pitch accuracy সহায়ক মাপ, চূড়ান্ত বিচার নয়।
2. **সংগীততাত্ত্বিক সত্যতা:** রাগ/তাল তথ্য শিল্পী/শিক্ষক দিয়ে যাচাই ছাড়া প্রকাশ নয়। AI-জেনারেটেড ডেটা `verified:false` থাকবে।
3. **ছোট, নিরাপদ ধাপ:** একবারে বড় refactor নয়। প্রতি ধাপে পুরোনো ফিচার চালু থাকবে।
4. **Privacy-first:** ব্যক্তিগত রেকর্ডিং default = IndexedDB (local)। Server upload = opt-in।
5. **Performance বাজেট:** Pitch প্রতিক্রিয়া 50–100ms লক্ষ্য; মোবাইলে CPU < 25% এক কোর।

---

## 1. বর্তমান অবস্থা Audit (প্রমাণসহ)

| ফাইল | আকার/অবস্থা | সমস্যা |
|---|---|---|
| `server.js:135-201` | `data/stats.json` এ stats | multi-user নয়, concurrent write-এ overwrite, UTC streak (IST নয়), restart/deploy-এ ডেটা হারানোর ঝুঁকি |
| `server.js:37,54` | `audio/webm...` + `audio/` prefix accept | MIME allowlist ফাঁকি দেওয়া যায়; magic-byte check নেই; ext client থেকে আসে |
| `server.js:63,66` | `cors()` open, `express.static(UPLOAD_DIR)` | সব origin允许, সব recording public URL-এ উন্মুক্ত; auth নেই |
| `server.js:22-24` | `helmet({csp:false})` | production CSP নেই |
| `public/app.js:1-1058` | ~40KB এক ফাইলে 17 দায়িত্ব | theme, scale, pitch UI, tanpura, harmonium, tabla, guided-practice, range-finder, raga-grid, IDB, recorder, timer সব একসাথে |
| `public/pitch-detector.js:124-184` | MPM + parabolic interpolation | noise-gate শুধু RMS 0.015; median filter নেই; octave-correction নেই; confidence score নেই; history শুধু 120-sample trail (`maxHistory`) |
| `public/pitch-detector.js:242-250` | `allowedIntervals.includes()` দিয়ে Apaswara | aroha/avaroha দিক-সচেতন নয়; pakad matching নেই |
| `data/ragas.json` | 10 রাগ, string field (`aroha:"নি্ রে গা..."`) | machine-readable স্বরক্রম নেই; `chalan`, `samay-chakra`, `rasa`, `bandish`, `verified` নেই |
| `data/alankars.json` | 7টি, শুধু `title/notes/description` | level, BPM, pattern-type, raga-link নেই |
| `public/audio-engine.js` | tanpura/harmonium/tabla/reverb এক ফাইল (~726 লাইন) | sample-ভিত্তিক ধ্বনি নেই; tanpura `setTimeout` loop (drift); tabla bol synth খুব সরল |
| `public/sw.js:36-50` | network-first, সব GET cache | versioning দুর্বল (`sur-sadhana-v1`); API response offline strategy নেই |
| `tests/pitch.test.js` | 4টি sine-wave test | noise/harmonic/vibrato/octave test নেই; vocal sample fixture নেই |

---

## 2. লক্ষ্য আর্কিটেকচার

```
Gan-si Client (Web / PWA / Android-Capacitor / Desktop-Tauri-ভবিষ্যৎ)
  └─ UI (Vanilla JS ES Modules) ─ i18n bn/en
  └─ App Core: practice / music-theory / settings / recordings
  └─ Audio Engine (Web Audio API) ─ tanpura / harmonium / tabla / swaramandal / reverb
  └─ Pitch Engine (DSP: MPM+YIN, Worker-Ready)
  └─ Music Engine (raga / swara / shruti / taal)
  └─ Storage: IndexedDB (local-first) + REST sync
Express REST API ─ Auth ─ SQLite (এখন) → PostgreSQL (পরে) ─ File Storage (private)
```

**সিদ্ধান্ত:** এখনই React/Vue-তে যাবে না। Vanilla JS ES Modules + ধাপে ধাপে বিভাজন।

### 2.1 প্রস্তাবিত ফাইল কাঠামো (চূড়ান্ত)

```
/
├── server.js                 # bootstrap only (app listen)
├── src/server/
│   ├── app.js                # express app factory (helmet/cors/rate-limit/error)
│   ├── config.js             # env: PORT, UPLOAD_DIR, MAX_UPLOAD_MB, CORS_ORIGIN, DB_PATH
│   ├── db.js                 # sqlite open/migrate/close (better-sqlite3)
│   ├── migrate.js            # node migrate runner
│   ├── middleware/
│   │   ├── error.js          # centralized error → {error, code}
│   │   └── auth.js           # stub now, session/token later (TO-DO, enforce না হওয়া পর্যন্ত open)
│   ├── routes/
│   │   ├── health.js         # GET /api/health
│   │   ├── ragas.js          # GET /api/ragas, /:id  (query: thaat, search)
│   │   ├── alankars.js       # GET /api/alankars
│   │   ├── stats.js          # GET /api/stats, POST /api/stats/session
│   │   └── recordings.js     # GET/POST/DELETE /api/recordings (+ stream /api/recordings/:id/stream)
│   └── lib/
│       ├── stats-service.js  # streak (Asia/Kolkata), totals, history cap
│       └── audio-validate.js # MIME allowlist + magic-byte + size/duration cap
├── data/
│   ├── ragas.json            # v2 schema-তে migrate (নিচে)
│   ├── alankars.json         # v2 schema-তে migrate
│   └── theory.json           # NEW: স্বর/সপ্তক/শ্রুতি/ঠাট/তাল পাঠ্যক্রম (TO-DO)
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js                 # v2 cache strategy (নিচে)
│   ├── css/                  # NEW (এখন style.css একটাই — ধাপে ভাঙো)
│   │   ├── main.css
│   │   ├── themes.css
│   │   └── responsive.css
│   ├── js/
│   │   ├── app.js            # bootstrap + tab router only (slim)
│   │   ├── audio/
│   │   │   ├── audio-engine.js  # facade: init/master/reverb/record
│   │   │   ├── tanpura.js
│   │   │   ├── harmonium.js
│   │   │   ├── tabla.js      # taal data + lookahead scheduler
│   │   │   └── reverb.js
│   │   ├── music/
│   │   │   ├── pitch-detector.js # MPM core + filters (Worker-ready pure fn)
│   │   │   ├── pitch-filters.js  # NEW: median/moving-avg/confidence/octave-fix/VAD
│   │   │   ├── pitch-history.js  # NEW: 10s ring buffer + target-deviation
│   │   │   ├── swara.js          # NEW: sargam/shruti/12-TET/cents/saptak map
│   │   │   ├── raga-engine.js    # NEW: aroha/avaroha validate, pakad match, similarity
│   │   │   └── shruti.js         # NEW: 22-shruti table (swara.js থেকে split, পরে)
│   │   ├── practice/
│   │   │   ├── guided-practice.js # alankar arena logic (app.js:636-802 থেকে সরাও)
│   │   │   ├── alankar-generator.js # NEW: pattern generator (Sec 5)
│   │   │   ├── vocal-range.js
│   │   │   └── analytics.js  # dashboard aggregation + calendar
│   │   └── ui/
│   │       ├── navigation.js
│   │       ├── settings.js   # scale/tuning/theme/i18n
│   │       ├── recordings.js # IDB + server sync UI
│   │       └── theory.js     # NEW: learning centre render + quiz
│   └── assets/               # samples/ icons/
├── tests/
│   ├── unit/pitch.test.js / swara.test.js / raga.test.js / alankar.test.js / taal.test.js / stats-streak.test.js
│   ├── integration/stats-api.test.js / recordings-api.test.js
│   ├── browser/*.spec.js     # Playwright (mic/guided/recording) — পরে
│   └── fixtures/             # sine/noise/vocal-samples (ছোট wav, git-lfs নয়)
├── scripts/                  # NEW: validate-ragas.js, check-audio.js
└── docs/TECHNICAL_MASTER_PLAN.md (এই ফাইল)
```

> **Migration নিয়ম:** `public/*.js` এখন root-এ আছে এবং `index.html` সেখান থেকে load করে। নতুন `public/js/...` এ সরানোর সময় `index.html` একসাথে বদলাও + পুরোনো পথে 1-release alias রাখো। এক PR-এ এক মডিউল।

---

## 3. প্রতিটি মডিউল: দায়িত্ব + Public API

### 3.1 `src/server/*` (Backend)

**`config.js`**
```js
export { PORT, UPLOAD_DIR, MAX_UPLOAD_MB, CORS_ORIGIN, DB_PATH, TZ }
// TZ='Asia/Kolkata' — streak এ বাধ্যতামূলক
```

**`db.js` (better-sqlite3, WAL mode)**
- `openDb(path)`, `migrate()`, `getDb()`
- Schema (Sec 4 দেখো)। সব write transaction-এ।

**Routes — চুক্তি (contract):**
```
GET  /api/health → {status:'ok', app, version, timestamp, db:'ok'}
GET  /api/ragas?thaat=&search= → {count, ragas[]}
GET  /api/ragas/:id → raga | 404 {error}
GET  /api/alankars?level=&raga= → {count, alankars[]}
GET  /api/stats?range=7d|30d → {totalMinutes, totalSessions, currentStreak, lastPracticedDate, history[]}
POST /api/stats/session {minutes:1..180, accuracy?:0..100, raga_id?, alankar_id?, duration_sec?} → {message, stats}
GET  /api/recordings → {count, recordings[{id, filename, size, duration_sec, url, createdAt, raga_id?, alankar_id?}]}
POST /api/recordings (multipart field 'audio') → 201 {message, recording}
DELETE /api/recordings/:filename → {message} (basename sanitize + owner-check যখন auth আসবে)
GET  /api/recordings/:id/stream → authenticated audio stream (Range support) — `express.static` এর বদলে
```
Error format সবখানে: `{error: string, code?: string}` + সঠিক status।

### 3.2 `js/music/*`

**`swara.js`** — pure, testable, DOM-free
```js
centsBetween(freq, refFreq)
freqToMidi(freq, a4=440)
midiToSargam(midi, rootOffset) → {sargamIndex, short, long}
centsOff(freq, saFreq, targetShrutiCents) → -50..+50
saptakOf(midi, rootOffset) → 'mandra'|'madhya'|'tara'
isInTune(cents, tol=12) → bool
```

**`pitch-filters.js`**
```js
rmsGate(buf, threshold) → {rms, voiced:bool}
voiceActivity({rms, freq, snr}) → bool
medianFilter(window: number[]) → number
movingAverage(prev, next, alpha=0.35)
octaveFix(freq, expectedRange:[min,max], history) → freq  // 2x/0.5x snap রোধ
confidence({nsdfPeak, rms, stability}) → 0..1
```

**`pitch-history.js`**
```js
class PitchHistory { push(t, freq|null, targetMidi?); last10s(); deviationStats(); toChartSeries() }
```
UI গ্রাফ: X=time, Y=freq/swara, target-line + ±cents band।

**`raga-engine.js`**
```js
validateNote({sargamIndex, direction:'aroha'|'avaroha'|'either', raga}) → {ok, reason?}
validatePhrase(swaraSeq, raga) → {ok, violatedAt?, msg?}
pakadSimilarity(sungSeq, pakadSeq) → 0..1  // সতর্কতা: চলন-ভিত্তিক, শুধু interval মিল নয়
ragaSimilarityScore(sungSeq, candidates) → [{raga_id, score}] // মতভেদপূর্ণ — UI-তে "সম্ভাব্য মিল" হিসেবে, চূড়ান্ত নয়
```
নোট: Khamaj-এর মতো aroha/avaroha ভিন্ন রাগে `allowedIntervals` একা যথেষ্ট নয় — `arohaIntervals[]`, `avarohaIntervals[]` বাধ্যতামূলক (Sec 4.1)।

### 3.3 `js/audio/*`

- `tanpura.js`: `start({tuning:'Pa|Ma|Ni|Dha', tempoBpm, volume, autoStopMin?})`, `stop()`, `pluckString(i)`; per-string gain + decay envelope। পরে real-sample layer (`sampleUrl?` থাকলে sample, না থাকলে synth fallback)।
- `harmonium.js`: `noteOn(freq,key)`, `noteOff(key)`, `droneToggle(freq,id)`; 3-octave keyboard map; bellows curve (velocity→gain) TO-DO।
- `tabla.js`: `getTaalData(key)` (8 taal + বিভাগ/তালি/খালি/সম), `start({taal,bpm,laya})`, `stop()`, `onBeat(cb)`; lookahead scheduler রাখো (বর্তমান two-clocks pattern সঠিক — `audio-engine.js:432-486`)।
- `reverb.js`: convolver IR gen + `setEnabled/setLevel`; offline render-এ testable।

### 3.4 `js/practice/*`

- `guided-practice.js`: queue, target-hold (বর্তমান 4-frame → time-based 300ms-এ বদলাও), scoring (Sec 5)।
- `alankar-generator.js`: `generate({notes:3|4|5|7, motion:'saral|bakra|lanka|punorabritti', bpm, raga_id?, scale}) → {title, notes[], bpm}`।
- `analytics.js`: daily/weekly/monthly, avg accuracy, best session, raga/alankar progress, vocal-range delta, practice calendar (GitHub-style heatmap), smart suggestion (দুর্বল স্বর → পরের অনুশীলন)।

---

## 4. ডেটা ও ডেটাবেস

### 4.1 Raga JSON v2 (backward-compat: পুরোনো string field রাখো, নতুন array যোগ করো)

```json
{
  "id": "yaman",
  "name": "রাগ ইমন / কল্যাণ (Yaman)",
  "name_en": "Yaman",
  "thaat": "কল্যাণ",
  "jati": "সম্পূর্ণ",
  "vadi": {"swara": "গা", "interval": 4},
  "samvadi": {"swara": "নি", "interval": 11},
  "time": "প্রথম প্রহর (সন্ধ্যা)",
  "aroha_text": "নি্ রে গা, মা♯ ধা নি সাঁ",
  "avaroha_text": "সাঁ নি ধা পা, মা♯ গা রে সা",
  "aroha_intervals": [11, 0, 2, 4, 6, 7, 9, 11, 12],
  "avaroha_intervals": [12, 11, 9, 7, 6, 4, 2, 0],
  "pakad_text": "নি্ রে গা রে, মা♯ ধা নি সাঁ",
  "pakad_intervals": [11, 0, 2, 0, 6, 9, 11, 12],
  "varjya_text": "কোনো স্বর বর্জিত নয়",
  "allowedIntervals": [0, 2, 4, 6, 7, 9, 11],
  "chalan": "মা♯-প্রধান, গা-নি সংবাদ...",
  "rasa": "গম্ভীর/ভক্তি",
  "bandish_ref": "...",
  "audio_example_url": null,
  "verified": false,
  "verified_by": null
}
```
Validation script `scripts/validate-ragas.js`: প্রতিটি interval 0..12, aroha/avaroha `allowedIntervals`-এর subset কিনা (Khamaj-এর মতো mixed-shruti ক্ষেত্রে exception list), `pakad_intervals` subset কিনা।

### 4.2 Alankar JSON v2
```json
{"id": 1, "title": "...", "notes": "...", "notes_seq": ["সা","রে",...], "level": "beginner", "pattern": "saral", "suggested_bpm": 60, "raga_id": null}
```
Levels: `beginner < elementary < intermediate < advanced < expert`।

### 4.3 SQLite Schema (Phase-1: single-user `user_id=1` default; multi-user-ready)

```sql
PRAGMA journal_mode=WAL;
CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, email TEXT UNIQUE, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE practice_sessions(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
  duration_min INTEGER NOT NULL CHECK(duration_min BETWEEN 1 AND 180),
  accuracy INTEGER CHECK(accuracy BETWEEN 0 AND 100),
  raga_id TEXT, alankar_id INTEGER,
  practiced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user_date ON practice_sessions(user_id, practiced_at);
CREATE TABLE recordings(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
  filename TEXT NOT NULL UNIQUE, size INTEGER NOT NULL, duration_sec INTEGER,
  raga_id TEXT, alankar_id INTEGER, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE user_settings(user_id INTEGER PRIMARY KEY REFERENCES users(id),
  preferred_scale INTEGER DEFAULT 10, preferred_tuning TEXT DEFAULT 'just_intonation', theme TEXT DEFAULT 'dark');
-- migrate: data/stats.json → practice_sessions (history[] প্রতিটি → এক row; lastPracticedDate → streak recompute Asia/Kolkata)
```
Streak নিয়ম (IST): `Asia/Kolkata` তারিখে পরপর দিন থাকলে +1; একই দিনে multiple session → streak অপরিবর্তিত; 1 দিন gap-এর বেশি → reset 1।

### 4.4 Upload নিরাপত্তা (এখনই করণীয়)
- Allowlist ঠিক: `audio/webm, audio/wav, audio/ogg, audio/mpeg, audio/mp4` (বর্তমান `audio/` prefix ফাঁক বন্ধ করো — `server.js:54`)।
- Magic-byte check (`file-type` বা হাতে header): WebM=`1A 45 DF A3`, WAV=`RIFF`, OGG=`OggS`, MP3=`ID3/FF FB`।
- `MAX_UPLOAD_MB` (default 25) + duration cap (TO-DO: `music-metadata` দিয়ে ≤15 min)।
- Filename সর্বদা সার্ভার-জেনারেটেড (`riyaz-<ts>-<uuid>.<ext-from-mime>`, ext কখনো client থেকে নয়)।
- `/recordings-stream` public static তুলে `/api/recordings/:id/stream` (auth + Range)। পুরোনো URL 1 release redirect রাখো।

---

## 5. Pitch Engine উন্নয়ন (সর্বোচ্চ অগ্রাধিকার)

বর্তমান: MPM core সঠিক (`pitch-detector.js:124-184`) কিন্তু production-voice-এর জন্য অসম্পূর্ণ।

1. **Noise/VAD:** `rmsGate` threshold auto-calibrate (শুরতে 500ms room-noise মাপো) + freq range 60–1200Hz (আছে) + harmonic-suppression (NSDF peak 0.45 → SNR-adaptive)।
2. **Octave fix:** `freq` হঠাৎ 2x/0.5x jump + confidence কম → পূর্ব stable-এর সাথে snap; `smoothedPitch*0.65+raw*0.35` (লাইন 197) → `median(5) + EMA(alpha by confidence)`।
3. **Stability:** stable-pitch = একই sargam ±12 cents-এ ≥250ms; তারপর UI/score আপডেট। এখন `handleGuidedPracticePitch` 4-frame hold ব্যবহার করে (`app.js:743`) — frame-rate নির্ভর, time-based করো।
4. **History graph:** 10s ring buffer, target swara line, cents-deviation shade। বর্তমান canvas (`drawGraph:354-429`) auto-scale করে — target-locked Y-scale যোগ করো।
5. **Calibration:** mic-level meter + auto-gain hint; `echoCancellation:false` রাখো (সঠিক — লাইন 88-94)।
6. **পরের ধাপ (Phase-2 পরে):** YIN vs MPM A/B; CREETE/ML শুধু optional Worker + মডেল-সাইজ বিবেচনায়। Latency লক্ষ্য বজায় রাখো।

**Acceptance:** sine 440/220/261Hz ±5Hz; octave-jump test (220Hz-এ 440 detect নয়); vibrato ±30 cents-এ stable; fan-noise fixture-এ false-positive <5%।

---

## 6. Raga Learning Mode (ধাপে ধাপে)

`raga-engine.js` + UI wizard:
1. সা স্থাপন (tanpura) → 2. Aroha (এক-এক স্বর, hold-to-pass) → 3. Avaroha → 4. Pakad (phrase match ≥0.8) → 5. রেকর্ড + self-review (pitch graph overlay)।
- Yaman উদাহরণ: aroha `[11,0,2,4,6,7,9,11,12]` (নি্ থেকে সাঁ) — শুধু `allowedIntervals` দেখিয়ে শেখানো যাবে না, চলন+অলংকারসহ শেখাও।

## 7. Practice স্কোরিং (সহায়ক, চূড়ান্ত নয়)

```
score = 0.4*pitchAcc + 0.2*timing + 0.15*durationHold + 0.15*stability + 0.1*completion
```
- pitchAcc: % frames |cents|≤12 (stable-only)
- timing: target onset ±150ms (metronome-anchored, যখন taal চলে)
- UI-তে লেখো: "অনুশীলনের সহায়ক পরিমাপ, শিল্পের মান নয়"।

## 8. UI/UX পুনর্বিন্যাস (5 মডিউল)

স্বর সাধনা (pitch) / রাগ শিক্ষা / তাল ও লয় / বাদ্যযন্ত্র (tanpura+harmonium+swaramandal) / আমার অগ্রগতি (recording+calendar+stats)। Bottom-nav (mobile), keyboard-accessible, bn/en toggle, dark/light, help per-module। প্রথম পৃষ্ঠায় সব control নয় — hero-তে আজকের সাধনা timer + streak।

## 9. PWA → Android

- `sw.js` v2: `CACHE_VERSION='sur-sadhana-v2'`; app-shell cache-first; `/api/ragas|/alankars` stale-while-revalidate + IndexedDB fallback; POST/stream কখনো cache নয়; পুরোনো cache delete on activate।
- পরে: Capacitor (mic/audio/background test: Android Chrome mic, iOS Safari mic, BT latency, offline recording, low-end CPU)।

## 10. পরীক্ষা

```
tests/unit: pitch(noise/octave/vibrato) / swara / raga(aroha-vs-avaroha, Khamaj/Marwa/Bhoopali) / alankar-gen / taal(length/division) / stats-streak(IST edge: 23:55→00:05)
tests/integration: stats-api (concurrent POST), recordings-api (bad MIME, traversal `../../`, oversize)
tests/browser (পরে): mic mock → guided pass; recording save/load
```
শুধু sine নয় — `fixtures/vocal-samples/` (ছোট, সম্মতিসহ) দিয়ে gate করো। Coverage লক্ষ্য: music-engine ≥80%।

## 11. নিরাপত্তা/নির্ভরযোগ্যতা চেকলিস্ট

CORS allowlist (`CORS_ORIGIN`) | Helmet CSP (media/stream allowance সহ) | per-route rate-limit (stats/recordings কঠোর) | Zod/equivalent validation | centralized error middleware + structured log | DB backup (SQLite file snapshot) | recording retention policy UI-তে দেখাও।

---

## 12. 90-দিন রোডম্যাপ (AI-agent-এর কাজের ক্রম)

### Phase 1 — Foundation (দিন 1–15): কাঠামো ও স্থিতিশীলতা
- [ ] P1-1 `src/server/{app,config,db,migrate}` + SQLite migrate + `stats.json` import (IST streak) — **Accept:** restart-এ ডেটা থাকে; concurrent POST-এ হারায় না
- [ ] P1-2 Upload harden (allowlist+magic-byte+server filename+stream endpoint) — **Accept:** `audio/` prefix bypass বন্ধ; traversal test পাস
- [ ] P1-3 `app.js` থেকে `guided-practice.js` + `vocal-range.js` আলাদা (index.html import বদল, পুরোনো path alias) — **Accept:** সব tab আগের মতো চলে
- [ ] P1-4 Raga/Alankar v2 schema + `validate-ragas.js` — **Accept:** 10 রাগ validate পাস
- [ ] P1-5 Test বিস্তার: `swara/raga/stats-streak/recordings-api` — **Accept:** `npm test` সবুজ

### Phase 2 — Audio Intelligence (16–30)
- [ ] P2-1 `pitch-filters.js` + `pitch-history.js` (median/OctaveFix/confidence/10s graph) — **Accept:** octave/vibrato/noise fixture পাস
- [ ] P2-2 Guided hold time-based (300ms) + scoring v1 — **Accept:** 60fps/30fps দুটোতেই একই pass-rate
- [ ] P2-3 Tanpura per-string gain/decay + auto-stop; tabla visual taal-cycle (সম/তালি/খালি) — **Accept:** UI-তে 16-মাত্রা চক্র দৃশ্যমান

### Phase 3 — Music Education (31–50)
- [ ] P3-1 `raga-engine.js` (direction-aware + pakad) + Learning Mode wizard — **Accept:** Bhoopali-তে মা/নি warn; Khamaj aroha/avaroha ভিন্নভাবে validate
- [ ] P3-2 `alankar-generator.js` (level/BPM/pattern/raga) + taal visual engine — **Accept:** 5 level-এ deterministic seed-এ snapshot
- [ ] P3-3 `theory.json` + Learning Centre + quiz — **Accept:** 10 ঠাট/তাল কুইজ পাস; `verified:false` ব্যাজ দৃশ্যমান

### Phase 4 — Personalization (51–70)
- [ ] P4-1 users/settings টেবিল + opt-in cloud sync (default local) — **Accept:** logout/login-এ ডেটা আলাদা
- [ ] P4-2 analytics dashboard + practice calendar + smart suggestion — **Accept:** 7d/30d aggregate সঠিক
- [ ] P4-3 recording library (rename/trim-TO-DO/playback-speed/pitch-overlay) — **Accept:** WAV/MP3 export (WAV আগে)

### Phase 5 — Release (71–90)
- [ ] P5-1 UI redesign (5-module) + bn/en + a11y — **Accept:** Lighthouse mobile ≥85, keyboard-only flow
- [ ] P5-2 Offline PWA v2 + Android Capacitor build — **Accept:** offline-এ raga/alankar খোলে; mic permission flow
- [ ] P5-3 Device matrix test + docs + release — **Accept:** test report + `verified` রাগ তালিকা

---

## 13. AI Coding Agent-এর নিয়ম

1. প্রতি task-এ একটি মডিউল; `docs/TECHNICAL_MASTER_PLAN.md` Sec নম্বর PR-এ উল্লেখ করো।
2. Public API signature বদলালে `index.html` + test একসাথে আপডেট করো।
3. `allowedIntervals` একা দিয়ে রাগ-নিয়ম লিখো না — `aroha/avaroha_intervals` ব্যবহার করো।
4. Score-কে চূড়ান্ত বিচার হিসেবে UI-তে দেখিও না।
5. Secret/`.env` commit নয়; `UPLOAD_DIR`/`DB_PATH` env থেকে।
6. প্রতিটি Phase-শেষে `npm test` + manual checklist (mic/tanpura/tabla/recording) চালাও।

## 14. এখনই পরের 5টি কাজ (সুপারিশ-ক্রমে)

1. P1-1 SQLite, 2. P1-2 Upload, 3. P1-3 guided-practice split, 4. P2-1 pitch filters, 5. P1-4 raga v2 (+validate)।
