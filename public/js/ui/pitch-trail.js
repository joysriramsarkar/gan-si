/* Gan-si Pitch Trail v3: high-resolution, target-locked, DPR-aware. */
(function (root) {
  const HISTORY_MS = 60000;
  const SAMPLE_MS = 50;

  function createPitchTrail(canvas, options) {
    const ctx = canvas.getContext('2d');
    const opts = options || {};
    const history = []; // { t, midi, inTune, cents }
    let view = { zoom: 1, pan: 0, drag: false, lastX: 0 };
    let running = false;
    let raf = null;
    let targetMidi = null;
    let targetTolerance = 12;
    let baseMidi = 60;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.parentElement ? canvas.parentElement.clientWidth : canvas.width;
      const h = opts.height || 180;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function push(sample) {
      const now = Date.now();
      history.push({ t: now, midi: sample.midi, inTune: !!sample.inTune, cents: sample.cents || 0 });
      // Trim to 60s.
      const cutoff = now - HISTORY_MS;
      while (history.length && history[0].t < cutoff) history.shift();
    }

    function setTarget(midi, tolerance) {
      targetMidi = (typeof midi === 'number') ? midi : null;
      targetTolerance = tolerance || 12;
    }

    function setBaseMidi(midi) {
      baseMidi = midi || baseMidi;
    }

    function stats() {
      const samples = history.filter(s => s.midi != null);
      if (!samples.length) return null;
      const mids = samples.map(s => s.midi);
      const mean = mids.reduce((a, b) => a + b, 0) / mids.length;
      const variance = mids.reduce((a, b) => a + (b - mean) ** 2, 0) / mids.length;
      const std = Math.sqrt(variance);
      const cents = samples.map(s => s.cents);
      const minC = Math.min(...cents);
      const maxC = Math.max(...cents);
      const inTune = samples.filter(s => s.inTune).length;
      return {
        count: samples.length,
        accuracy: Math.round((inTune / samples.length) * 100),
        minCents: Math.round(minC),
        maxCents: Math.round(maxC),
        stdCents: Math.round(std * 100),
        spanSec: Math.round((samples[samples.length - 1].t - samples[0].t) / 1000)
      };
    }

    function yOf(midiVal, lo, hi, h) {
      const total = Math.max(hi - lo, 1);
      return h - ((midiVal - lo) / total) * (h - 16) - 8;
    }

    function draw() {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const css = getComputedStyle(document.documentElement);
      const token = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
      const colors = {
        bg: token('--chart-bg', '#fbfaf7'),
        grid: token('--chart-grid', '#e4ddd3'),
        gridActive: token('--chart-grid-active', '#d9b8a6'),
        label: token('--chart-label', '#756d64'),
        line: token('--chart-line', '#a44a2a'),
        target: token('--chart-target', '#2f6f5e'),
        band: token('--chart-band', 'rgba(47,111,94,.12)'),
        inTune: token('--chart-in-tune', '#2f6f5e'),
        outTune: token('--chart-out-tune', '#a34e55')
      };

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);

      const now = Date.now();
      const windowMs = HISTORY_MS / view.zoom;
      const end = now - view.pan;
      const start = end - windowMs;
      const visible = history.filter(s => s.t >= start && s.t <= end);

      // Auto range.
      let lo = baseMidi - 6, hi = baseMidi + 6;
      if (targetMidi != null) { lo = targetMidi - 2; hi = targetMidi + 2; }
      else if (visible.length) {
        const mids = visible.map(s => s.midi);
        const mn = Math.min(...mids), mx = Math.max(...mids);
        const span = Math.max(mx - mn, 6);
        lo = Math.max(20, mn - span * 0.3);
        hi = Math.min(90, mx + span * 0.3);
      }
      const total = Math.max(hi - lo, 1);

      // Grid: swaras.
      const root = (window.audioEngine && window.audioEngine.rootOffset) || (baseMidi % 12);
      const base = Math.floor(baseMidi / 12) * 12;
      const swaraIntervals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const swaraNames = ['সা', 'রে♭', 'রে', 'গা♭', 'গা', 'মা', 'মা♯', 'পা', 'ধা♭', 'ধা', 'নি♭', 'নি'];
      const activeRaga = (window.pitchDetector && window.pitchDetector.activeRaga) || null;
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const midiVal = base + i;
        const y = yOf(midiVal, lo, hi, h);
        if (y < 0 || y > h) continue;
        const allowed = activeRaga && activeRaga.allowedIntervals ? activeRaga.allowedIntervals.includes(i) : (i === 0 || i === 7);
        ctx.strokeStyle = allowed ? colors.gridActive : colors.grid;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.fillStyle = allowed ? colors.label : 'rgba(117,109,100,.45)';
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillText(swaraNames[i], 6, y - 2);
      }

      // Target band.
      if (targetMidi != null) {
        const ty = yOf(targetMidi, lo, hi, h);
        const bandPx = (targetTolerance / 100) * ((h - 16) / total) * 2;
        ctx.fillStyle = colors.band;
        ctx.fillRect(0, ty - bandPx / 2, w, bandPx);
        ctx.strokeStyle = colors.target;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, ty);
        ctx.lineTo(w, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = colors.target;
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.fillText('লক্ষ্য', w - 44, ty - 6);
      }

      // Time axis (seconds ago).
      ctx.fillStyle = colors.label;
      ctx.font = '9px "Segoe UI", sans-serif';
      const ticks = 6;
      for (let i = 0; i <= ticks; i++) {
        const tSec = (windowMs / 1000) * (i / ticks);
        const x = w - (tSec / (windowMs / 1000)) * w;
        ctx.fillText(tSec.toFixed(0) + 's', x + 2, h - 2);
        if (i > 0) {
          ctx.strokeStyle = colors.grid;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
      }

      // Pitch trail (segmented by in-tune state).
      if (visible.length > 1) {
        let seg = [];
        const flush = (color) => {
          if (seg.length < 2) { seg = []; return; }
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          seg.forEach((p, i) => {
            const x = ((p.t - start) / windowMs) * w;
            const y = yOf(p.midi, lo, hi, h);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();
          // Glow for in-tune.
          if (color === colors.inTune) {
            ctx.strokeStyle = color + '55';
            ctx.lineWidth = 6;
            ctx.stroke();
          }
          seg = [];
        };
        let curColor = null;
        for (const s of visible) {
          const c = s.inTune ? colors.inTune : colors.outTune;
          if (c !== curColor && seg.length) flush(curColor);
          curColor = c;
          seg.push(s);
        }
        if (seg.length) flush(curColor);

        // Dots at sample points.
        for (const s of visible) {
          const x = ((s.t - start) / windowMs) * w;
          const y = yOf(s.midi, lo, hi, h);
          ctx.fillStyle = s.inTune ? colors.inTune : colors.outTune;
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Stats overlay.
      const st = stats();
      if (st) {
        const lines = [
          `নমুনা: ${st.count}  •  নিখুঁত: ${st.accuracy}%`,
          `cents: ${st.minCents} … ${st.maxCents}  •  σ≈${st.stdCents / 100} ST`,
          `সময়: ${st.spanSec}s`
        ];
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(6, 6, 230, 44);
        ctx.fillStyle = '#fff';
        ctx.font = '10px "Segoe UI", sans-serif';
        lines.forEach((l, i) => ctx.fillText(l, 12, 20 + i * 13));
      }

      // Empty state.
      if (!visible.length) {
        ctx.fillStyle = colors.label;
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('মাইক্রোফোন চালু করে গাইলে এখানে পিচ-ট্রেইল দেখা যাবে', w / 2, h / 2);
        ctx.textAlign = 'left';
      }
    }

    function loop() {
      if (!running) return;
      draw();
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (running) return;
      running = true;
      resize();
      loop();
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    // Zoom / pan.
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.2 : 0.83;
      view.zoom = Math.min(8, Math.max(1, view.zoom * factor));
    }, { passive: false });
    canvas.addEventListener('mousedown', (e) => { view.drag = true; view.lastX = e.clientX; });
    window.addEventListener('mouseup', () => { view.drag = false; });
    canvas.addEventListener('mousemove', (e) => {
      if (!view.drag) return;
      const dx = e.clientX - view.lastX;
      view.lastX = e.clientX;
      view.pan = Math.max(0, view.pan - dx * (HISTORY_MS / (canvas.width / (window.devicePixelRatio || 1)) / (window.devicePixelRatio || 1)));
    });

    window.addEventListener('resize', resize);

    return {
      push, setTarget, setBaseMidi, start, stop, resize, draw, stats,
      history: () => history.slice()
    };
  }

  root.PitchTrail = { create: createPitchTrail };
})(typeof window !== 'undefined' ? window : globalThis);
