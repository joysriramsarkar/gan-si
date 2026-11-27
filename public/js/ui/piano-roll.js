/**
 * Piano-Roll Pitch Monitor — Singing Carrots pitch-monitor adaptation, kept
 * as a separate tab: cents band on top, full piano keyboard in the middle,
 * scrolling piano-roll below. Shares the app's mic/pitch detector (no second
 * audio pipeline); audio never leaves the device.
 */
(function (root) {
  const BN = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const BLACK = new Set([1, 3, 6, 8, 10]);
  const BAND_H = 48;
  const KEYS_H = 84;
  const WINDOW_SEC = 10;

  function toBn(v) { return String(v ?? '').replace(/[0-9]/g, (d) => BN[Number(d)]); }
  function westernName(midi) {
    const m = Math.round(midi);
    return NOTE_NAMES[((m % 12) + 12) % 12] + toBn(Math.floor(m / 12) - 1);
  }

  function bindUI() {
    const canvas = document.getElementById('pianoRollCanvas');
    if (!canvas) return;
    const toggleBtn = document.getElementById('pianoRollToggleBtn');
    const clearBtn = document.getElementById('pianoRollClearBtn');
    const micSel = document.getElementById('pianoRollMicSelect');
    const rangeSel = document.getElementById('pianoRollRange');
    const noteEl = document.getElementById('pianoRollNote');
    const statusEl = document.getElementById('pianoRollStatus');
    const ctx = canvas.getContext('2d');

    let samples = []; // {t, midi|null, cents}
    let lastPushAt = 0;

    function rootPc() {
      return root.audioEngine && Number.isFinite(root.audioEngine.rootOffset) ? root.audioEngine.rootOffset : 10;
    }
    function range() {
      const v = (rangeSel && rangeSel.value) || '36-84';
      const [lo, hi] = v.split('-').map((n) => parseInt(n, 10));
      return { lo: Number.isFinite(lo) ? lo : 36, hi: Number.isFinite(hi) ? hi : 84 };
    }

    // Piano geometry: white keys get equal slots, black keys sit on the
    // boundary before them. Centres per semitone drive every x mapping, so
    // the cents line, keyboard highlight and roll all line up.
    function layout(w) {
      const { lo, hi } = range();
      const whites = [];
      for (let m = lo; m <= hi; m++) if (!BLACK.has(((m % 12) + 12) % 12)) whites.push(m);
      const whiteW = w / Math.max(1, whites.length);
      const centre = new Map();
      whites.forEach((m, i) => centre.set(m, (i + 0.5) * whiteW));
      for (let m = lo; m <= hi; m++) {
        if (!BLACK.has(((m % 12) + 12) % 12)) continue;
        // black key centre = boundary between previous and next white keys
        let prev = m - 1;
        while (prev >= lo && BLACK.has(((prev % 12) + 12) % 12)) prev--;
        centre.set(m, centre.has(prev) ? centre.get(prev) + whiteW * 0.5 : whiteW * 0.32);
      }
      return { lo, hi, whites, whiteW, centre };
    }
    function xForMidi(lay, midiFloat) {
      const m0 = Math.floor(midiFloat);
      const frac = midiFloat - m0;
      const x0 = lay.centre.get(m0);
      const x1 = lay.centre.get(m0 + 1);
      if (x0 == null && x1 == null) return null;
      if (x0 == null) return x1 - lay.whiteW * 0.5;
      if (x1 == null) return x0 + lay.whiteW * 0.5 * frac;
      return x0 + (x1 - x0) * frac;
    }
    function token(name, fallback) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
      } catch (_) { return fallback; }
    }

    function resize() {
      const w = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
      if (!w || w < 60) return;
      const dpr = window.devicePixelRatio || 1;
      const h = 430;
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
      const w = canvas.clientWidth;
      const h = canvas.clientHeight || 430;
      if (!w || w < 60) { requestAnimationFrame(draw); return; }
      if (canvas.width !== Math.floor(w * (window.devicePixelRatio || 1))) resize();
      const now = Date.now();
      pushSample(now);
      const pd = root.pitchDetector;
      const p = pd && pd.isListening ? pd.lastPayload : null;
      const lay = layout(w);
      const colors = {
        bg: token('--chart-bg', '#fbfaf7'),
        grid: token('--chart-grid', '#e4ddd3'),
        label: token('--chart-label', '#756d64'),
        line: token('--chart-line', '#a44a2a'),
        target: token('--chart-target', '#2f6f5e'),
      };
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);

      // ---- Cents band (±50c, ±5* and ±12** zones) ----
      const cx = w / 2;
      const centsToX = (c) => cx + (Math.max(-50, Math.min(50, c)) / 50) * (w / 2 - 8);
      ctx.fillStyle = 'rgba(120,120,120,0.15)';
      ctx.fillRect(0, 0, w, BAND_H);
      ctx.fillStyle = 'rgba(47,111,94,0.20)';
      ctx.fillRect(centsToX(-12), 0, centsToX(12) - centsToX(-12), BAND_H);
      ctx.fillStyle = 'rgba(47,111,94,0.38)';
      ctx.fillRect(centsToX(-5), 0, centsToX(5) - centsToX(-5), BAND_H);
      ctx.strokeStyle = colors.grid;
      ctx.fillStyle = colors.label;
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('♭ (flat)', 6, BAND_H - 8);
      ctx.textAlign = 'right';
      ctx.fillText('# (sharp)', w - 6, BAND_H - 8);
      ctx.textAlign = 'center';
      [[-12, '-১২¢'], [-5, '-৫¢'], [5, '+৫¢ (*)'], [12, '+১২¢ (**)']].forEach(([c, t]) => ctx.fillText(t, centsToX(c), BAND_H - 8));
      ctx.strokeStyle = colors.target;
      ctx.beginPath(); ctx.moveTo(cx, 4); ctx.lineTo(cx, BAND_H - 18); ctx.stroke();

      // ---- Keyboard ----
      const keysTop = BAND_H;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, keysTop, w, KEYS_H);
      lay.whites.forEach((m, i) => {
        const x = i * lay.whiteW;
        const isC = ((m % 12) + 12) % 12 === 0;
        const isSa = ((m % 12) + 12) % 12 === rootPc();
        const isCurrent = p && Math.round(p.noteNum) === m;
        ctx.fillStyle = isCurrent ? 'rgba(239,68,68,0.35)' : '#f8fafc';
        ctx.fillRect(x, keysTop, lay.whiteW, KEYS_H);
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(x + 0.5, keysTop + 0.5, lay.whiteW - 1, KEYS_H - 1);
        if (isSa) {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath(); ctx.arc(x + lay.whiteW / 2, keysTop + 12, 4, 0, Math.PI * 2); ctx.fill();
        }
        if (isC) {
          ctx.fillStyle = '#334155';
          ctx.font = 'bold 10px "Segoe UI", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(westernName(m), x + 2, keysTop + KEYS_H - 6);
        }
      });
      for (let m = lay.lo; m <= lay.hi; m++) {
        if (!BLACK.has(((m % 12) + 12) % 12)) continue;
        const bx = (lay.centre.get(m) || 0) - lay.whiteW * 0.32;
        const isCurrent = p && Math.round(p.noteNum) === m;
        ctx.fillStyle = isCurrent ? '#dc2626' : '#0f172a';
        ctx.fillRect(bx, keysTop, lay.whiteW * 0.64, KEYS_H * 0.62);
      }

      // ---- Scrolling piano-roll ----
      const rollTop = keysTop + KEYS_H;
      const rollH = h - rollTop;
      ctx.fillStyle = 'rgba(180,160,130,0.12)';
      ctx.fillRect(0, rollTop, w, rollH);
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 0.6;
      for (let m = lay.lo; m <= lay.hi; m++) {
        const x = lay.centre.get(m);
        if (x == null) continue;
        ctx.globalAlpha = BLACK.has(((m % 12) + 12) % 12) ? 0.35 : 0.6;
        ctx.beginPath(); ctx.moveTo(x, rollTop); ctx.lineTo(x, h); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const pxPerSec = rollH / WINDOW_SEC;
      for (const s of samples) {
        if (s.midi == null) continue;
        const ageSec = (now - s.t) / 1000;
        if (ageSec > WINDOW_SEC) continue;
        const x = xForMidi(lay, s.midi);
        if (x == null) continue;
        const y = rollTop + ageSec * pxPerSec;
        const ac = Math.abs(s.cents);
        ctx.fillStyle = ac <= 12 ? 'rgba(47,111,94,0.9)' : ac <= 25 ? 'rgba(183,121,31,0.9)' : 'rgba(220,38,38,0.9)';
        const segW = Math.max(3, lay.whiteW * 0.55);
        ctx.fillRect(x - segW / 2, y, segW, Math.max(3, pxPerSec * 0.09));
      }
      // Sa guide columns
      ctx.strokeStyle = 'rgba(245,158,11,0.5)';
      ctx.setLineDash([4, 5]);
      for (let m = lay.lo; m <= lay.hi; m++) {
        if (((m % 12) + 12) % 12 !== rootPc()) continue;
        const x = lay.centre.get(m);
        if (x == null) continue;
        ctx.beginPath(); ctx.moveTo(x, rollTop); ctx.lineTo(x, h); ctx.stroke();
      }
      ctx.setLineDash([]);

      // ---- Current pitch line through all three panels ----
      if (p && Number.isFinite(p.noteNum)) {
        const x = xForMidi(lay, p.noteNum);
        if (x != null) {
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, keysTop); ctx.lineTo(x, h); ctx.stroke();
          ctx.lineWidth = 1;
          const bx = centsToX(Number(p.cents) || 0);
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(bx, 2); ctx.lineTo(bx, BAND_H - 16); ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
      if (!pd || !pd.isListening) {
        ctx.fillStyle = colors.label;
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('মনিটর চালু করে গাইলে এখানে পিয়ানো-রোল নামবে', w / 2, rollTop + 30);
        ctx.textAlign = 'left';
      }
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
