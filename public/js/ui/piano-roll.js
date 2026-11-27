/**
 * Piano-Roll Pitch Monitor — Singing Carrots-style layout:
 *   fixed note ladder on the left, time-scrolling pitch roll on the right,
 *   cents meter on top.
 * Both axes are fixed: the ladder never slides and notes outside the chosen
 * range are not drawn. Shares the app's mic/pitch detector (no second audio
 * pipeline); audio never leaves the device.
 */
(function (root) {
  const BN = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SARGAM = ['সা', 'রে♭', 'রে', 'গা♭', 'গা', 'মা', 'মা♯', 'পা', 'ধা♭', 'ধা', 'নি♭', 'নি'];
  const BLACK = new Set([1, 3, 6, 8, 10]);
  const BAND_H = 46;
  const TIME_AXIS_H = 18;
  const WINDOW_SEC = 10;

  function toBn(v) { return String(v ?? '').replace(/[0-9]/g, (d) => BN[Number(d)]); }
  function pcOf(m) { return ((Math.round(m) % 12) + 12) % 12; }
  function westernName(midi) {
    const m = Math.round(midi);
    // Note names keep Latin octaves (C4, A#3) — Bengali ৪/৮ is misread.
    return NOTE_NAMES[pcOf(m)] + (Math.floor(m / 12) - 1);
  }

  function bindUI() {
    const canvas = document.getElementById('pianoRollCanvas');
    if (!canvas) return;
    const toggleBtn = document.getElementById('pianoRollToggleBtn');
    const clearBtn = document.getElementById('pianoRollClearBtn');
    const micSel = document.getElementById('pianoRollMicSelect');
    const spanSel = document.getElementById('pianoRollRange');
    const noteEl = document.getElementById('pianoRollNote');
    const statusEl = document.getElementById('pianoRollStatus');
    const ctx = canvas.getContext('2d');

    let samples = []; // {t, midi|null, cents}
    let lastPushAt = 0;

    function rootPc() {
      return root.audioEngine && Number.isFinite(root.audioEngine.rootOffset) ? ((root.audioEngine.rootOffset % 12) + 12) % 12 : 10;
    }
    function midiToY(midi, lo, span, top, hgt) {
      return top + (1 - (midi - lo) / Math.max(span, 1)) * hgt;
    }
    function token(name, fallback) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
      } catch (_) { return fallback; }
    }
    function spanFor(w) {
      const mode = (spanSel && spanSel.value) || 'auto';
      if (mode === '36') return 36;
      if (mode === '24') return 24;
      return w < 480 ? 15 : 21;
    }

    function resize() {
      const w = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
      if (!w || w < 60) return;
      const dpr = window.devicePixelRatio || 1;
      const h = w < 520 ? 430 : 470;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let lastListening = null;
    function pushSample(now) {
      if (now - lastPushAt < 30) return;
      lastPushAt = now;
      const pd = root.pitchDetector;
      const listeningNow = !!(pd && pd.isListening);
      if (lastListening === null) lastListening = listeningNow;
      else if (listeningNow !== lastListening) { lastListening = listeningNow; syncToggleLabel(); }
      const p = pd && pd.isListening ? pd.lastPayload : null;
      const last = samples[samples.length - 1];
      if (p && Number.isFinite(p.noteNum)) {
        samples.push({ t: now, midi: p.noteNum, cents: Number(p.cents) || 0 });
      } else if (last && last.midi != null) {
        samples.push({ t: now, midi: null, cents: 0 });
      }
      const cutoff = now - (WINDOW_SEC + 2) * 1000;
      while (samples.length && samples[0].t < cutoff) samples.shift();
      if (noteEl) {
        noteEl.textContent = p
          ? `${p.sargamShortName} · ${p.noteName} · ${(Number(p.cents) || 0) > 0 ? '+' : ''}${p.cents} cents`
          : '-';
      }
    }

    function draw() {
      // Collect samples even while the tab is hidden (clientWidth is 0 then),
      // so opening the roll later still shows the phrase just sung.
      const now = Date.now();
      pushSample(now);
      const w = canvas.clientWidth;
      if (!w || w < 60) { requestAnimationFrame(draw); return; }
      if (canvas.width !== Math.floor(w * (window.devicePixelRatio || 1))) resize();
      const h = canvas.clientHeight || 430;
      const pd = root.pitchDetector;
      const isOn = !!(pd && pd.isListening);
      const p = isOn ? pd.lastPayload : null;

      const colors = {
        bg: token('--chart-bg', '#fbfaf7'),
        grid: token('--chart-grid', '#e4ddd3'),
        label: token('--chart-label', '#756d64'),
        line: token('--chart-line', '#a44a2a'),
        target: token('--chart-target', '#2f6f5e'),
      };
      const bandH = BAND_H;
      const ladderW = w < 420 ? 76 : 92;
      const rollX = ladderW;
      const rollRight = w - 8;
      const rollTop = bandH;
      const rollBottom = h - TIME_AXIS_H;
      const rollH = rollBottom - rollTop;
      const rollW = Math.max(1, rollRight - rollX);
      const span = spanFor(w);
      const rootPcVal = rootPc();
      const middleSa = 48 + rootPcVal;

      // ---- Fixed note ladder: Sa-centred range, labels never slide ----
      // Notes outside this range are simply not drawn (clipped), like samples
      // older than the time window. Use the range selector to widen it.
      const lo = middleSa - Math.floor(span / 2);
      const hi = lo + span;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);

      // ---- Cents meter ----
      const cx = rollX + rollW / 2;
      const centsToX = (c) => cx + (Math.max(-50, Math.min(50, c)) / 50) * (rollW / 2 - 6);
      ctx.fillStyle = 'rgba(120,120,120,0.12)';
      ctx.fillRect(0, 0, w, bandH);
      ctx.fillStyle = 'rgba(47,111,94,0.18)';
      ctx.fillRect(centsToX(-12), 0, centsToX(12) - centsToX(-12), bandH);
      ctx.fillStyle = 'rgba(47,111,94,0.34)';
      ctx.fillRect(centsToX(-5), 0, centsToX(5) - centsToX(-5), bandH);
      ctx.strokeStyle = colors.target;
      ctx.beginPath(); ctx.moveTo(cx, 6); ctx.lineTo(cx, bandH - 16); ctx.stroke();
      ctx.fillStyle = colors.label;
      ctx.font = '9.5px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('♭', 6, bandH - 8);
      ctx.textAlign = 'right';
      ctx.fillText('#', w - 8, bandH - 8);
      ctx.textAlign = 'center';
      ctx.fillText('−৫০¢', centsToX(-50), bandH - 8);
      ctx.fillText('০', cx, bandH - 8);
      ctx.fillText('+৫০¢', centsToX(50), bandH - 8);

      // Everything from here on stays inside the roll area, so the fixed
      // cents meter above is never covered by a partially visible row.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, rollTop, w, rollBottom - rollTop);
      ctx.clip();

      // ---- Fixed note ladder ----
      ctx.fillStyle = 'rgba(120,110,95,0.06)';
      ctx.fillRect(0, rollTop, ladderW, rollH);
      const rowTop = Math.ceil(lo - 0.5);
      const rowBot = Math.floor(hi + 0.5);
      for (let m = rowTop; m <= rowBot; m++) {
        const pc = pcOf(m);
        const black = BLACK.has(pc);
        const y1 = midiToY(m + 0.5, lo, span, rollTop, rollH);
        const y2 = midiToY(m - 0.5, lo, span, rollTop, rollH);
        const rowH = Math.max(1, y2 - y1);
        const isSa = pc === rootPcVal;
        ctx.fillStyle = black ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.55)';
        ctx.fillRect(0, y1, ladderW, rowH);
        if (isSa) {
          ctx.fillStyle = 'rgba(245,158,11,0.22)';
          ctx.fillRect(0, y1, ladderW, rowH);
        }
        // little black-key block on the right edge of the ladder
        if (black) {
          ctx.fillStyle = 'rgba(15,23,42,0.55)';
          ctx.fillRect(ladderW - 16, y1 + rowH * 0.12, 16, rowH * 0.76);
        }
        // swara (left) + western note (right)
        ctx.fillStyle = isSa ? colors.line : black ? '#2a3444' : '#3b3330';
        ctx.font = (isSa ? 'bold 9.5px' : '9.5px') + ' "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(SARGAM[((m - middleSa) % 12 + 12) % 12], 6, y1 + rowH / 2 + 3.2);
        ctx.fillStyle = black ? '#e8edf5' : '#6b625a';
        ctx.font = '9px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(westernName(m), ladderW - 19, y1 + rowH / 2 + 3.2);
        // row separator
        ctx.strokeStyle = 'rgba(120,110,95,0.22)';
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(ladderW, y1); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(120,110,95,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ladderW + 0.5, 0); ctx.lineTo(ladderW + 0.5, rollBottom); ctx.stroke();

      // ---- Roll background rows + semitone guides ----
      for (let m = rowTop; m <= rowBot; m++) {
        const pc = pcOf(m);
        const y1 = midiToY(m + 0.5, lo, span, rollTop, rollH);
        const y2 = midiToY(m - 0.5, lo, span, rollTop, rollH);
        if (BLACK.has(pc)) {
          ctx.fillStyle = 'rgba(15,23,42,0.05)';
          ctx.fillRect(rollX, y1, rollW, Math.max(1, y2 - y1));
        }
        if (pc === rootPcVal) {
          ctx.fillStyle = 'rgba(245,158,11,0.10)';
          ctx.fillRect(rollX, y1, rollW, Math.max(1, y2 - y1));
        }
        ctx.strokeStyle = pc === rootPcVal ? 'rgba(200,140,20,0.55)' : 'rgba(120,110,95,0.18)';
        ctx.lineWidth = pc === rootPcVal ? 1 : 0.6;
        ctx.beginPath(); ctx.moveTo(rollX, y1); ctx.lineTo(rollRight, y1); ctx.stroke();
      }

      // ---- Time grid (lines inside the roll; labels are drawn after) ----
      const tickXs = [];
      for (let ago = 0; ago <= WINDOW_SEC; ago += (WINDOW_SEC > 8 ? 2 : 1)) {
        const x = rollX + (1 - ago / WINDOW_SEC) * rollW;
        if (ago > 0) {
          ctx.strokeStyle = 'rgba(120,110,95,0.22)';
          ctx.lineWidth = 0.6;
          ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.moveTo(x, rollTop); ctx.lineTo(x, rollBottom); ctx.stroke();
          ctx.setLineDash([]);
        }
        tickXs.push({ ago, x });
      }

      // ---- Pitch trail: vertical bars scrolling right-to-left ----
      const barH = Math.max(2, rollH / span * 0.6);
      for (const s of samples) {
        if (s.midi == null) continue;
        const age = (now - s.t) / 1000;
        if (age < 0 || age > WINDOW_SEC) continue;
        const x = rollX + (1 - age / WINDOW_SEC) * rollW;
        const y = midiToY(s.midi, lo, span, rollTop, rollH);
        const ac = Math.abs(s.cents);
        ctx.fillStyle = ac <= 12 ? 'rgba(47,111,94,0.85)' : ac <= 25 ? 'rgba(183,121,31,0.85)' : 'rgba(220,38,38,0.85)';
        ctx.fillRect(x - 1.5, y - barH / 2, 3, barH);
      }

      // ---- Current pitch: line across the roll + live dot ----
      if (p && Number.isFinite(p.noteNum)) {
        const y = midiToY(p.noteNum, lo, span, rollTop, rollH);
        ctx.strokeStyle = 'rgba(220,38,38,0.75)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(rollX, y); ctx.lineTo(rollRight, y); ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath(); ctx.arc(rollRight - 5, y, 4.5, 0, Math.PI * 2); ctx.fill();
        // cents marker
        const bx = centsToX(Number(p.cents) || 0);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bx, 4); ctx.lineTo(bx, bandH - 14); ctx.stroke();
        ctx.lineWidth = 1;
      } else if (!isOn) {
        ctx.fillStyle = colors.label;
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('মনিটর চালু করে গাইলে এখানে সুরের রোল নামবে', rollX + rollW / 2, rollTop + 30);
        ctx.textAlign = 'left';
      }
      ctx.restore();

      // ---- Time axis labels (outside the clipped roll) ----
      ctx.font = '9px "Segoe UI", sans-serif';
      ctx.fillStyle = colors.label;
      for (const t of tickXs) {
        if (t.ago > 0 && t.x > rollRight - 30) continue; // don't collide with "এখন"
        ctx.textAlign = t.ago === 0 ? 'right' : 'center';
        ctx.fillText(t.ago === 0 ? 'এখন' : '−' + toBn(t.ago) + 'সে', t.ago === 0 ? rollRight : t.x, h - 5);
      }
      ctx.strokeStyle = 'rgba(120,110,95,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rollX, rollBottom + 0.5); ctx.lineTo(rollRight, rollBottom + 0.5); ctx.stroke();
      requestAnimationFrame(draw);
    }

    async function refreshDevices() {
      if (!micSel || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter((d) => d.kind === 'audioinput');
        const keep = micSel.value;
        micSel.innerHTML = '';
        const def = document.createElement('option');
        def.value = '';
        def.textContent = 'ডিফল্ট মাইক';
        micSel.appendChild(def);
        inputs.forEach((d, i) => {
          const o = document.createElement('option');
          o.value = d.deviceId;
          o.textContent = d.label || `মাইক ${i + 1}`;
          micSel.appendChild(o);
        });
        if (keep) micSel.value = keep;
      } catch (_) {}
    }

    function syncToggleLabel() {
      const pd = root.pitchDetector;
      const on = !!(pd && pd.isListening);
      if (toggleBtn) {
        toggleBtn.innerHTML = on
          ? '<svg class="icon" aria-hidden="true"><use href="/icons.svg#stop"></use></svg> মনিটর বন্ধ করুন'
          : '<svg class="icon" aria-hidden="true"><use href="/icons.svg#mic"></use></svg> মনিটর চালু করুন';
        toggleBtn.classList.toggle('btn-danger', on);
        toggleBtn.classList.toggle('btn-primary', !on);
      }
      if (statusEl) statusEl.textContent = on ? 'মনিটর চলছে — গাইলে রোল নামবে' : 'মনিটর বন্ধ';
    }

    if (toggleBtn) toggleBtn.addEventListener('click', async () => {
      const pd = root.pitchDetector;
      if (!pd) return;
      const deviceId = micSel && micSel.value ? micSel.value : undefined;
      try {
        if (pd.isListening) {
          pd.stopListening();
        } else {
          await pd.startListening(deviceId);
          refreshDevices();
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = '❌ মাইক্রোফোন চালু করা যায়নি — অনুমতি যাচাই করুন';
      }
      window.dispatchEvent(new CustomEvent('gansi:micstate', { detail: { listening: pd.isListening } }));
      syncToggleLabel();
    });
    if (micSel) micSel.addEventListener('change', async () => {
      const pd = root.pitchDetector;
      if (!pd || !pd.isListening) return;
      // Restart on the newly picked device so the switch actually takes effect.
      pd.stopListening();
      try { await pd.startListening(micSel.value || undefined); } catch (_) {}
      window.dispatchEvent(new CustomEvent('gansi:micstate', { detail: { listening: pd.isListening } }));
      syncToggleLabel();
    });
    if (clearBtn) clearBtn.addEventListener('click', () => { samples = []; });
    window.addEventListener('gansi:micstate', syncToggleLabel);
    window.addEventListener('resize', resize);

    resize();
    refreshDevices();
    syncToggleLabel();
    requestAnimationFrame(draw);
  }

  const api = { bindUI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PianoRollUI = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bindUI);
})(typeof window !== 'undefined' ? window : globalThis);
