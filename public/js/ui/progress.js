/**
 * Progress dashboard + practice calendar + alankar generator + theory centre wiring.
 * Depends on: PracticeAnalytics, AlankarGenerator (optional globals).
 */
(function () {
  async function fetchStats(range) {
    try {
      const f = window.GanSiAuth ? window.GanSiAuth.fetch : fetch;
      const r = await f('/api/stats' + (range && range !== 'all' ? `?range=${range}` : ''));
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }
  function renderCalendar(history) {
    const el = document.getElementById('practiceCalendar');
    if (!el || !history) return;
    el.innerHTML = '';
    const dateKey = window.PracticeAnalytics ? window.PracticeAnalytics.dateKey : null;
    const byDay = {};
    history.forEach(h => {
      const d = h.date || h.practiced_at || '';
      const key = dateKey ? dateKey(d) : String(d).slice(0, 10);
      byDay[key] = (byDay[key] || 0) + (h.minutes || 0);
    });
    const today = new Date();
    for (let i = 181; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = dateKey ? dateKey(d) : d.toISOString().slice(0, 10);
      const mins = byDay[key] || 0;
      const cell = document.createElement('div');
      cell.className = `calendar-cell level-${mins === 0 ? 0 : mins < 15 ? 1 : mins < 45 ? 2 : 3}`;
      cell.title = `${key}: ${mins} মিনিট`;
      cell.setAttribute('aria-label', `${key}: ${mins} মিনিট`);
      el.appendChild(cell);
    }
  }
  async function loadDashboard() {
    const rangeEl = document.getElementById('progressRange');
    const range = rangeEl ? rangeEl.value : 'all';
    const stats = await fetchStats(range);
    if (!stats) return;
    const A = window.PracticeAnalytics;
    const ag = A ? A.aggregate(stats.history || []) : null;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('dashWeekly', ag ? `${ag.weeklyTotal} মি.` : `${stats.totalMinutes || 0} মি.`);
    set('dashMonthly', ag ? `${ag.monthlyTotal} মি.` : '--');
    set('dashAcc', ag && ag.avgAccuracy != null ? `${ag.avgAccuracy}%` : '--');
    set('dashBest', ag && ag.bestSession ? `${ag.bestSession.minutes} মি.` : '--');
    const sug = document.getElementById('dashSuggestion');
    if (sug && A) sug.textContent = 'পরামর্শ: ' + A.suggestNext(window.GanSiPracticeMiss || {});
    renderCalendar(stats.history);
  }
  function wireGenerator() {
    const btn = document.getElementById('genBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const n = parseInt(document.getElementById('genNotes').value, 10);
      const motion = document.getElementById('genMotion').value;
      const bpm = parseInt(document.getElementById('genBpm').value, 10);
      const out = document.getElementById('genOutput');
      if (window.AlankarGenerator) {
        const g = window.AlankarGenerator.generate({ noteCount: n === 5 ? 5 : n >= 7 ? 7 : 4, motion, bpm, seed: Date.now() % 100000, steps: 4 });
        out.textContent = `${g.title}: ${g.notes.join(' ')}`;
        if (window.audioEngine && g.intervals) {
          window.audioEngine.playIntervalSequence(g.intervals, null, null);
        }
      } else if (out) out.textContent = 'জেনারেটর লোড হয়নি।';
    });
  }
  async function loadTheory() {
    const list = document.getElementById('theoryList');
    if (!list) return;
    try {
      const data = window.GanSiMusicData
        ? await window.GanSiMusicData.loadDocument('/api/theory', '/data/theory.json')
        : await fetch('/api/theory').then(r => r.json());
      const badge = document.getElementById('theoryVerifiedBadge');
      if (badge) badge.textContent = data.verified ? 'যাচাইকৃত' : 'শিক্ষক-যাচাই বাকি — সহায়ক পাঠ্য';
      list.innerHTML = '';
      (data.chapters || []).forEach(ch => {
        const card = document.createElement('div');
        card.className = 'theory-card';
        card.innerHTML = `<strong class="theory-title">${ch.title}</strong><p class="theory-body">${ch.body}</p>`;
        (ch.quiz || []).forEach((q, qi) => {
          const qEl = document.createElement('div');
          qEl.className = 'theory-quiz';
          qEl.innerHTML = `<div class="theory-question">${q.q}</div>`;
          q.options.forEach((op, oi) => {
            const b = document.createElement('button');
            b.className = 'btn-outline theory-answer';
            b.textContent = op;
            b.addEventListener('click', () => {
              b.classList.add(oi === q.answer ? 'answer-correct' : 'answer-wrong');
              b.setAttribute('aria-pressed', 'true');
            });
            qEl.appendChild(b);
          });
          card.appendChild(qEl);
        });
        list.appendChild(card);
      });
    } catch { list.innerHTML = '<div class="empty-state">তত্ত্ব লোড হয়নি (অফলাইন হলে সংযোগ ফিরলে চেষ্টা করুন)।</div>'; }
  }
  document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    wireGenerator();
    loadTheory();
    const pr = document.getElementById('progressRange');
    if (pr) pr.addEventListener('change', loadDashboard);
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.tab === 'tab-progress') loadDashboard();
    }));
  });
})();
