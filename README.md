# গান-সি | সুর সাধনা Pro (Gan-si Sur Sadhana Pro)

> আধুনিক ভারতীয় ও বাংলা সঙ্গীত সাধনা, লাইভ ভোকাল পিচ ট্রেইনার, কারাওকে অলংকার এরিনা ও ভার্চুয়াল স্টুডিও স্যুট (Node.js & Express Full-Stack Application)

---

## 🌟 নতুন ও উন্নত বৈশিষ্ট্যসমূহ (Next-Gen Features)

### v2.2.2 — Bengali digits ও cache fixes
- **🔢 সব visible সংখ্যা বাংলায়:** timer, stats, BPM, frequency, cents, quiz, date এবং select option label; ASCII digit দৃশ্যমান হয় না, form/API value ASCII-ই থাকে।
- **🔄 SW v8 cache repair:** পুরোনো cached HTML-এ নতুন localization script না থাকলেও নতুন SW installation সব App Shell asset cache-diplোম করে reload নিশ্চিত করে।
- **🪕 Tanpura spacing fix:** চারটি string label responsive grid-এ; mobile-এ ২×২, desktop-এ ৪ কলাম—overlap হয় না।
- **🎨 নতুন ডিজাইন:** warm paper background, white matte cards, clay accent, soft elevation; generic black/neon look সরানো হয়েছে।
- **🧭 Consistent iconography:** reusable SVG icon set; header, tabs, cards, buttons ও recording actions একই visual language-এ।
- **📱 Responsive layout:** sticky pill tabs, mobile-safe header, stacked recording rows, contained modals ও safe-area padding।
- **🌗 Theme choice:** ডিফল্ট “ম্যাট পেপার”; Royal Gold, Sunset, Wood এবং optional Dark Studio রাখা হয়েছে।
- **📊 Theme-aware charts:** pitch canvas এখন light/dark theme token অনুযায়ী repaint হয়।

### v2.1 — রাগ শিক্ষা, privacy ও নিরাপত্তা
- **🎯 ধাপে ধাপে রাগ শিক্ষা:** সা → আরোহ → অবরোহ → পাকড়; absolute-MIDI octave check, ৩০০ms time-based hold, target-locked pitch graph এবং “সম্ভাব্য পাকড় মিল” (শিল্পের চূড়ান্ত বিচার নয়)।
- **🔒 Local-first recording:** নতুন রেকর্ডিং ডিফল্টে শুধু IndexedDB; server backup ডিফল্ট বন্ধ। চাইলে প্রতিটি রেকর্ডিং আলাদাভাবে “☁️ ব্যাকআপ” করা যায়।
- **🛡️ Token ও ownership:** invalid token 401; user ভেদে recording list/stream/delete isolated; existing username থেকে নতুন token জারি হয় না।
- **♿ Accessibility:** pinch-zoom আবার চালু, সব form control-এ label, keyboard-driven tabs (`←/→/Home/End`), duplicate ID বন্ধ, improved contrast।
- **🐛 C-scale fix:** `সা = C` এখন ভুল করে A# হয়ে যায় না; practice accuracy প্রতি mic session-এ reset হয়।
- **📦 Native offline content:** রাগ/অলংকার/তত্ত্বের bundled fallback থাকায় backend ছাড়াই Android/PWA-এ শিক্ষা-content খোলে।
- **🔄 Stale UI fix:** SW v8 network-first + install-time refresh—পুরোনো cached HTML/JS/CSS আর UI নষ্ট করবে না।

### মূল স্যুট

1. **🎯 গাইডেড কারাওকে অলংকার এরিনা (Interactive Guided Practice)**:
   - স্বরলিপির প্রতিটি স্বর (সা, রে, গা, মা...) রিয়েল-টাইমে ভিজ্যুয়াল ট্রেইল হিসেবে প্রদর্শিত হয়।
   - ব্যবহারকারী মাইক্রোফোনে সঠিক সুরে স্বরটি গাইলে কার্ডটি সবুজ আভা নিয়ে পরবর্তী স্বরে এগিয়ে যায়।
   - সঠিক সুর ধরে রাখলে পয়েন্ট ও স্কোরবোর্ড আপডেট হয় (+10 pts) এবং অনুশীলন শেষে সাফল্য স্বীকৃতি ও অটো-লগিং।

2. **🎙️ ভোকাল রেঞ্জ ফাইন্ডার ও আদর্শ 'সা' নির্ধারক (Vocal Range & Scale Finder)**:
   - ব্যবহারকারী নিজের স্বাভাবিক গলায় সর্বনিম্ন খাদ থেকে সর্বোচ্চ চড়া স্বর পর্যন্ত গাইলে সিস্টেম স্বয়ংক্রিয়ভাবে রেঞ্জ নির্ণয় করে (যেমন: G2 থেকে E4, ১.৮ অক্টেভ)।
   - ব্যবহারকারীর গলার ধরন (Bass, Baritone, Tenor, Alto, Soprano) চিহ্নিত করে এবং সাধনার জন্য সবচেয়ে আরামদায়ক আদর্শ 'সা' স্কেল সুপারিশ করে। ১-ক্লিকেই সেই স্কেল অ্যাপে সেট করা যায়।

3. **🏛️ কনসার্ট হল রিভার্ব ও স্বরমণ্ডল ঝালা (Studio Ambience & Swaramandal)**:
   - **কনভলভার রিভার্ব**: ড্রাই সাউন্ডের বদলে বাস্তব কনসার্ট হলের মতো রিভার্ব অ্যাম্বিয়েন্স (ওয়েব অডিও ইমপালস সিন্থেসিস)।
   - **স্বরমণ্ডল (Swaramandal)**: ভারতীয় উচ্চাঙ্গ সঙ্গীতের ঐতিহ্যবাহী স্বরমণ্ডলের মতো ২ অক্টেভের দ্রুত ক্যাসকেডিং হার্প গ্লিসান্দো ঝালা।

4. **⚠️ রাগ কন্ট্রাক্ট ও অপস্বর (বর্জিত স্বর) ডিটেক্টর (Apaswara Warning)**:
   - রাগ মোডে কোনো বর্জিত স্বর (যেমন: ভূপালীতে মা বা নি, কিংবা মারবায় পা) গাওয়া হলে তৎক্ষণাৎ স্ক্রিনে লাল সতর্কবার্তা ও ভাইব্রেশন প্রদর্শিত হয়।

5. **🎹 হারমোনিয়াম সুর সুরতি পিন (Continuous Drone Stops)**:
   - ভারতীয় হারমোনিয়ামের সুর পিনের মতো একটানা 'সা' বা 'পা' ড্রোন বাজিয়ে রাখার সুবিধা।

6. **🔥 দৈনিক সাধনা স্ট্রিক ও অ্যানালিটিক্স (Daily Riyaz Streak & Goals)**:
   - কত দিন একটানা রেওয়াজ করছেন তার স্ট্রিক ট্র্যাকার (🔥 ১ দিন, ২ দিন...)।
   - মোট রেওয়াজের সময়কাল এবং সেশন লগ সরাসরি Node.js ব্যাকএন্ডে সংরক্ষিত হয়।

7. **🥁 ৬টি শাস্ত্রীয় তাল মেশিন (Tabla Machine)**:
   - ত্রিতাল (১৬ মাত্রা), কাহারবা (৮ মাত্রা), দাদরা (৬ মাত্রা), রূপক (৭ মাত্রা), **ঝাপতাল (১০ মাত্রা)**, এবং **একতাল (১২ মাত্রা)**।

8. **🎨 ৫টি ভিজ্যুয়াল থিম (Visual Studio Themes)**:
   - ☀️ ম্যাট পেপার (Default)
   - 👑 রয়্যাল গোল্ড
   - 🌅 সূর্যাস্ত রাগ
   - 🪵 হারমোনিয়াম কাঠ
   - 🌙 ডার্ক স্টুডিও (Optional)

---

## 🚀 ইনস্টলেশন ও রান করার নিয়ম (Getting Started)

### ১. ডিপেন্ডেন্সি ইনস্টল
```powershell
npm install
```

### ২. সার্ভার চালু করুন
```powershell
npm start
```
ডেভেলপমেন্ট মোডে (Auto-reload সহ):
```powershell
npm run dev
```

### ৩. ব্রাউজারে অ্যাপটি ওপেন করুন
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📡 REST API এন্ডপয়েন্টস (v2.2)

| মেথড | এন্ডপয়েন্ট | বিবরণ |
|---|---|---|
| `GET` | `/api/health` | সার্ভার হেলথ, ভার্সন ও DB স্ট্যাটাস |
| `GET` | `/api/ragas?thaat=&search=` | রাগ তালিকা (v2 schema: aroha/avaroha intervals, pakad, verified) |
| `GET` | `/api/ragas/:id` | একটি রাগের বিস্তারিত |
| `GET` | `/api/alankars?level=&search=` | অলংকার তালিকা (level, pattern, BPM) |
| `GET` | `/api/theory` | সংগীততত্ত্ব পাঠ্যক্রম + কুইজ |
| `GET` | `/api/stats?range=7d\|30d\|all` | IST স্ট্রিক, মোট মিনিট ও হিস্ট্রি (SQLite) |
| `POST` | `/api/stats/session` | সেশন সেভ `{minutes:1..180, accuracy?:0..100, raga_id?, alankar_id?}` |
| `GET` | `/api/recordings` | রেকর্ডিং তালিকা (stream URL সহ; owner-filtered) |
| `POST` | `/api/recordings` | opt-in অডিও ব্যাকআপ — strict MIME + magic-byte যাচাই |
| `POST` | `/api/users` | ব্যক্তিগত ব্যবহারকারী + token তৈরি `{username}`; existing username → 409 |
| `GET` | `/api/users/me` | বর্তমান ব্যবহারকারী (Bearer token) |
| `GET` | `/api/recordings/:filename/stream` | ব্যক্তিগত স্ট্রিম (Range support; ownership check; পুরোনো `/recordings-stream/*` redirect হয়) |
| `DELETE` | `/api/recordings/:filename` | রেকর্ডিং মুছে ফেলা |

Privacy: ব্যক্তিগত রেকর্ডিং default = ব্রাউজার IndexedDB; server backup ডিফল্ট বন্ধ এবং শুধু স্পষ্ট অনুমতি/ব্যাকআপ বাটনে আপলোড হয়। Invalid bearer token 401; না-দেওয়া token হলে local user 1 mode থাকে।

## 🧪 যাচাই

```powershell
npm test              # 92 unit/integration (17 suites)
npm run validate:ragas
npm run validate:alankars
npm run test:browser  # 16 headless-Chrome specs (tabs, theory, generator, ear, mic, a11y, Bengali digits, light/dark theme, mobile layout, tanpura labels, C-scale, raga learning, opt-in backup, token reset, offline fallback)
```

## 📱 Android / PWA

`docs/ANDROID.md` দেখুন (Capacitor config + অডিও পরীক্ষা-তালিকা)। আইকন (`icon-192/512.png`) ও SW v8 network-first strategy সহ installable PWA; Android version 2.2.2 (code 6)। রাগ/অলংকার/তত্ত্বের bundled fallback থাকায় backend ছাড়াও Native-এ শিক্ষা-content খোলে।

## ✅ সংগীততাত্ত্বিক যাচাই

`docs/VERIFICATION.md` — সব কন্টেন্ট `verified:false` দিয়ে শুরু; মানুষের যাচাই ছাড়া `true` নয়।
