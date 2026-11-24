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
    const byDay = {};
    history.forEach(h => { const d = String(h.date || '').slice(0, 10); byDay[d] = (byDay[d] || 0) + (h.minutes || 0); });
    const today = new Date();
    for (let i = 181; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const mins = byDay[key] || 0;
      const cell = document.createElement('div');
      cell.title = `${key}: ${mins} মিনিট`;
      cell.style.cssText = `height:12px;border-radius:3px;background:${mins === 0 ? 'var(--bg-card-subtle)' : mins < 15 ? 'rgba(16,185,129,.4)' : mins < 45 ? 'rgba(16,185,129,.75)' : 'var(--accent-green)'}`;
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
    if (sug && A) sug.textContent = '💡 ' + A.suggestNext({});
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
        const g = window.AlankarGenerator.generate({ noteCount: n === 5 ? 5 : n >= 7 ? 7 : 4, motion, bpm, seed: Date.now() % 100000, steps: 8 });
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
      const f = window.GanSiAuth ? window.GanSiAuth.fetch : fetch;
      const r = await f('/api/theory');
      const data = await r.json();
      const badge = document.getElementById('theoryVerifiedBadge');
      if (badge) badge.textContent = data.verified ? 'যাচাইকৃত' : 'শিক্ষক-যাচাই বাকি — সহায়ক পাঠ্য';
      list.innerHTML = '';
      (data.chapters || []).forEach(ch => {
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid var(--border-color);border-radius:10px;padding:12px;';
        card.innerHTML = `<strong style="color:var(--primary);">${ch.title}</strong><p style="font-size:.88rem;color:var(--text-muted);margin:6px 0;">${ch.body}</p>`;
        (ch.quiz || []).forEach((q, qi) => {
          const qEl = document.createElement('div');
          qEl.innerHTML = `<div style="font-size:.85rem;font-weight:700;">${q.q}</div>`;
          q.options.forEach((op, oi) => {
            const b = document.createElement('button');
            b.className = 'btn-outline';
            b.style.cssText = 'font-size:.8rem;margin:4px 6px 0 0;padding:4px 10px;';
            b.textContent = op;
            b.addEventListener('click', () => {
              b.style.borderColor = oi === q.answer ? 'var(--accent-green)' : 'var(--accent-red)';
            });
            qEl.appendChild(b);
          });
          card.appendChild(qEl);
        });
        list.appendChild(card);
      });
    } catch { list.innerHTML = '<div>তত্ত্ব লোড হয়নি (অফলাইন হলে সংযোগ ফিরলে চেষ্টা করুন)।</div>'; }
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
