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
npm run test:browser      # 16 Playwright test
node scripts/smoke.cjs    # isolated temporary DB/uploads
node scripts/smoke-auth.cjs
```
Fresh Lighthouse (2026-11-25, v2.2.1): Accessibility / SEO / Best Practices = **100 / 100 / 100**।
