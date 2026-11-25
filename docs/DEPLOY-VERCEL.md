# Vercel ডেপ্লয়মেন্ট (gan-si.vercel.app)

> `500 FUNCTION_INVOCATION_FAILED` এর সমাধান — **v2.7.0** থেকে Vercel-এ অ্যাপটি **সম্পূর্ণ function-বিহীন static site** হিসেবে ডেপ্লয় হয়।

## কেন ৫০০ হয়েছিল

| কারণ | ব্যাখ্যা |
|---|---|
| `server.js` → `app.listen(PORT)` | Vercel Function হলো `(req, res)` handler; `listen()` করা লং-রানিং সার্ভার নয়। Vercel zero-config এটিকে function হিসেবে wrap করলে invocation ব্যর্থ হয়। |
| `node:sqlite` | শুধু Node ≥ ২২.৫-এ, আর `data/gansi.sqlite`-তে **লিখতে** হয়। Vercel-এর FS read-only (`/tmp` ছাড়া) ও ephemeral → import/boot-এ ক্র্যাশ। |
| `./uploads`, `./data` | writable ডিস্ক ধরে নেওয়া হয়েছে; সার্ভারলেসে নেই। |
| কোনো `vercel.json` ছিল না | Vercel নিজের মতো `server.js`-কে function বানিয়েছিল, তাই `/`-তেই ৫০০। |

## সমাধান: pure static, কোনো Serverless Function নেই

`vercel.json`:

```json
{
  "framework": null,
  "buildCommand": "npm run sync:data",
  "outputDirectory": "public"
}
```

- `framework: null` → Vercel "Other" static preset, `server.js` আর function হিসেবে build হয় না।
- `outputDirectory: public` → `public/index.html` = `/`, সব JS/CSS/SVG/JSON/আইকন static।
- **`api/` ডিরেক্টরি নেই**, **`rewrites`/`functions`/`builds` নেই** → invocation-এর কোনো পথই নেই, তাই `FUNCTION_INVOCATION_FAILED` অসম্ভব।
- `buildCommand: npm run sync:data && npm run mark:static` → `data/*.json` → `public/data/*.json` sync, এবং `public/static-mode.js`-এ `GANSI_STATIC_MODE = true` লেখা হয়। লোকাল/dev/Android বিল্ডে `sync:data`-র `mark-local` ধাপ এটিকে আবার `false` করে, তাই পুরো Express ব্যাকএন্ড স্বাভাবিকভাবেই চলে।

### `/api/*` কলগুলোর কী হয়

static বিল্ডে ফ্রন্টএন্ড **কোনো `/api/*` রিকোয়েস্টই পাঠায় না** (নইলে ৪০৪ console error ও Lighthouse-এর «no browser errors» অডিট নষ্ট হতো)। `public/static-mode.js`-এর `GANSI_STATIC_MODE` ফ্ল্যাগ দেখে:

| কল | Vercel-এ |
|---|---|
| `/api/ragas`, `/api/alankars`, `/api/theory` | সরাসরি bundled `/data/*.json` (১০ রাগ / ৭ অলংকার / ১০ অধ্যায়); `GanSiMusicData`-তেই fallback আছে |
| `/api/health` | version-check skip → কোনো ভুল «পুরোনো সংস্করণ» ব্যানার নেই |
| `/api/stats` | skip → ড্যাশবোর্ড সৎভাবে `--` দেখায় |
| `/api/stats/session`, `/api/users*`, `/api/recordings` | skip → «স্থানীয় মোড» / «সার্ভার ব্যাকআপ নেই» বার্তা; কোনো মিথ্যা «সংরক্ষিত» নয় |

**ব্যক্তিগত রেকর্ডিং, স্ট্রিক ও টোকেন সার্ভারে যায় না** — ব্রাউজারের IndexedDB-তেই থাকে, যা মূল ডিজাইন। কোনো মিথ্যা «সংরক্ষিত» বার্তা দেখানো হয় না।

লোকাল / self-hosted / Android ব্যাকএন্ড আগের মতোই **সম্পূর্ণ Express + SQLite** (`npm start`)। Vercel-এ SQLite কখনো importই হয় না — দুটো আলাদা ডেপ্লয়মেন্ট মোড।

## Vercel Dashboard সেটিংস (প্রয়োজনে মিলিয়ে নিন)

| সেটিং | মান |
|---|---|
| Framework Preset | **Other** (`framework: null`) |
| Root Directory | repository root (`./`) |
| Build Command | `npm run sync:data && npm run mark:static` (vercel.json থেকেই নেওয়া হবে) |
| Output Directory | `public` |
| Node.js Version | 22.x |
| Install Command | `npm install` (default) |

Dashboard-এ পুরোনো override (যেমন Framework = Express বা Build = `npm start`) থাকলে **সরিয়ে দিন**; নইলে আবার `server.js` function হতে পারে।

## ডেপ্লয় ও যাচাই

`git push origin main` → Vercel GitHub integration স্বয়ংক্রিয়ভাবে নতুন ডেপ্লয় করে। তারপর:

```powershell
curl.exe -s https://gan-si.vercel.app/            # 200, HTML (<!DOCTYPE html>...)
curl.exe -s https://gan-si.vercel.app/data/ragas.json  # 200, ১০ রাগ
curl.exe -s https://gan-si.vercel.app/static-mode.js   # GANSI_STATIC_MODE = true
curl.exe -s https://gan-si.vercel.app/api/health  # ৪০৪ — প্রত্যাশিত; কিন্তু ব্রাউজার এই কলটি করবেই না, তাই ৫০০/console error নেই
```

ব্রাউজারে: ১০টি ট্যাব, রাগ অভিধানে ১০ কার্ড, তত্ত্ব কেন্দ্রে ১০ অধ্যায়, গ্রাফ/তানপুরা/হারমোনিয়াম সব কাজ করে। Console-এ কোনো error নেই (`tests/vercel.test.js` + Vercel-এর মতো static simulation-এ যাচাইকৃত)।

## সীমাবদ্ধতা (স্বচ্ছতা)

- Vercel-এ **সার্ভার-সাইড স্ট্রিক/রেকর্ডিং ব্যাকআপ নেই** — ওগুলো শুধু ডিভাইসে। চাইলে পরে PostgreSQL/Blob স্টোরেজ যোগ করে স্থায়ী Node host-এ full backend ডেপ্লয় করতে হবে (মাস্টার প্ল্যানে "PostgreSQL later")।
- Android অ্যাপে `/api/*` দরকার হলে writable disk-সহ স্থায়ী Node host দিন, তারপর `capacitor.config.json`-এ `server.url` সেট করুন। Vercel static URL দিলে bundled offline ডেটাই কাজ করবে।
- সংগীত-ডেটা এখনো `verified:false`; মানুষের যাচাই ছাড়া `verified:true` করা হয়নি (`docs/VERIFICATION.md`)।
