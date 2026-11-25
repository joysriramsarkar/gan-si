# সংগীততাত্ত্বিক যাচাই workflow

> AI-জেনারেটেড রাগ/তাল তথ্য `verified:false` থাকে। `verified:true` শুধু মানুষের যাচাইয়ে।

## নিয়ম
1. `data/ragas.json`, `data/theory.json`, `data/alankars.json`-এ নতুন/বদলানো এন্ট্রি default `verified:false`।
2. যাচাইকারী (শিল্পী/শিক্ষক): নাম + তারিখ + মন্তব্যসহ `verified_by` লিখবেন:
   ```json
   { "verified": true, "verified_by": "পণ্ডিত … (2026-..-..): আরোহ-পাকড় শোনে নিশ্চিত" }
   ```
3. `npm run validate:ragas` — গঠনগত (schema) যাচাই; সংগীততাত্ত্বিক সত্যের বিকল্প নয়।
4. UI (`theoryList`, raga card) `verified:false` হলে "শিক্ষক-যাচাই বাকি" ব্যাজ দেখায় — মিথ্যা নিশ্চয়তা নয়।

## বর্তমান অবস্থা
- ১০ রাগ: সব `verified:false`
- তত্ত্ব ১০ অধ্যায়: `verified:false`

## স্বয়ংক্রিয় যাচাই (সংগীততাত্ত্বিক সত্য নয়)
```powershell
npm test -- --runInBand   # 17 suite / 92 test
npm run validate:ragas    # 10 ragas structural validation
npm run validate:alankars # 7 alankars structural validation
npm run test:browser      # 24 Playwright test
node scripts/smoke.cjs    # isolated temporary DB/uploads
node scripts/smoke-auth.cjs
```
Fresh Lighthouse (2026-11-25, v2.6.0): Accessibility / SEO / Best Practices = **100 / 100 / 100**।

## মাইক / রেকর্ডিং ডায়াগনসিস (v2.6.0)
- এই মেশিনে যাচাইকৃত root cause: `navigator.permissions.query({name:'microphone'})` → **`denied`**, `getUserMedia` ব্যর্থ → কোনো পিচ নমুনা/ট্রেইল/স্কোর/রেকর্ডিং তৈরি হয়নি। অনুমতি শুধু ব্রাউজার সেটিংস থেকে মানুষের দেওয়া যায়; অ্যাপ প্রোগ্রাম্যাটিকভাবে চাইতে পারে না।
- `#micStatus` (aria-live): অনুমতি বন্ধ / ডিভাইস নেই / অন্য অ্যাপ ব্যস্ত / সংযোগ বিচ্ছিন্ন — প্রতিটির জন্য আলাদা বাংলা নির্দেশনা; আর কোনো blocking `alert()` নেই।
- «মাইক যাচাই» → permission + ইনপুট ডিভাইস + স্বল্প `getUserMedia` পরীক্ষা; ট্র্যাক সঙ্গে সঙ্গে বন্ধ করা হয় (মাইক খোলা থাকে না)।
- `track.onended` → ghost session (স্কোর ০, কিন্তু «থামান» দেখানো) ভেঙে সব প্র্যাকটিস মোড বন্ধ + গ্রাফ ফ্রিজ।
- ৬ সেকেন্ড কোনো সুর না ধরা পড়লে সতর্কবার্তা; সুর না পেয়ে `/api/stats/session`-এ মিনিটও লগ হয় না।
- খালি MediaRecorder blob আর phantom রেকর্ডিং হিসেবে সেভ হয় না; recorder error/status UI-তে দেখানো হয়।
- পুরোনো cache-বান্ডেলের ট্যাব শনাক্ত হলে «এখনই রিলোড» নোটিশ (offline-এ নীরব)।

## গ্রাফ রিগ্রেশন (v2.5.0)
- ফিক্সড `baseMidi±12` দুই-সপ্তক গ্রিড + নিচে ±৫০ সেন্ট রিবন; ভিউপোর্ট ≤৬৪০px-এ ক্যানভাস ৩৬০px, নইলে ৪০০px।
- `stop()` ফ্রিজ, `push()` auto-resume, `setTarget()` ধাপ-ইতিহাস, `exportPNG()` স্থানীয় ডাউনলোড (কোনো আপলোড নয়)।
- স্ক্রিন-রিডারের জন্য `#trailSummary` (aria-live) থিম/স্টপ/ক্লিয়ারে হালনাগাদ হয়; সব canvas সংখ্যা বাংলা অঙ্কে।

## Bengali digit regression contract
- DOM text, dynamic mutation, native select option label, `title`, `aria-label`, `placeholder` visible digit বাংলায় দেখাবে।
- `input/select` value, `data-*`, IDs, URL, API payload ASCII থাকবে।
- Browser regression-এ timer/streak/BPM/frequency/piano note/select label scan হয়; পুরোনো HTML cache থেকে `numbers.js` বাদ পড়লে repair bootstrap + SW v13 migration test হয়।
