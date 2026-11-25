/* Gan-si Pitch Trail: fixed two-octave swara grid, DPR-aware, target-locked. */
(function (root) {
  const HISTORY_MS = 60000;
  const SAMPLE_MS = 50;
  const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SARGAM_SHORT = ['সা', 'রে♭', 'রে', 'গা♭', 'গা', 'মা', 'মা♯', 'পা', 'ধা♭', 'ধা', 'নি♭', 'নি'];
  // Fixed layout: no auto y-range. The full Sa-to-Sa two-octave grid always
  // fills the canvas between top padding and the time axis, so there is no
  // empty top/bottom band and lines never cluster.
  const GRID_LEFT = 86;
  const GRID_TOP = 12;
  const GRID_BOTTOM = 28;

  function toBn(value) {
    return String(value ?? '').replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
  }

  function westernName(midi) {
    const idx = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return NOTE_STRINGS[idx] + toBn(octave);
  }

  function createPitchTrail(canvas, options) {
    const ctx = canvas.getContext('2d');
    const opts = options || {};
    const history = []; // { t, midi, inTune, cents }
    let view = { zoom: 1, pan: 0, drag: false, lastX: 0 };
    let running = false;
    let raf = null;
    let frozenEnd = null; // set on stop(): time window freezes, graph must not scroll
    let targetMidi = null;
    let targetTolerance = 12;
    let baseMidi = 60;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.parentElement ? canvas.parentElement.clientWidth : canvas.width;
      const h = opts.height || 340;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function push(sample) {
      if (!running) start(); // mic started without explicit trail.start() (guided etc.)
      const now = Date.now();
      history.push({ t: now, midi: sample.midi, inTune: !!sample.inTune, cents: sample.cents || 0 });
      // Trim to 60s.
      const cutoff = now - HISTORY_MS;
      while (history.length && history[0].t < cutoff) history.shift();
    }

    function clear() {
      history.length = 0;
      draw();
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
      const usable = Math.max(1, h - GRID_TOP - GRID_BOTTOM);
      const y = GRID_TOP + (1 - (midiVal - lo) / total) * usable;
      // Clamp so an off-grid pitch still points at the nearest edge swara.
      return Math.min(h - GRID_BOTTOM, Math.max(GRID_TOP, y));
    }

    function xOf(t, start, windowMs, w) {
      const span = Math.max(1, w - GRID_LEFT - 8);
      return GRID_LEFT + ((t - start) / windowMs) * span;
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
      const end = (frozenEnd != null ? frozenEnd : now) - view.pan;
      const start = end - windowMs;
      const visible = history.filter(s => s.t >= start && s.t <= end);

      // Fixed two-octave range: Mandra Sa .. Tara Sa (baseMidi is the active
      // Sa). Never auto-zoom vertically, so all 25 swara lines are visible
      // with equal spacing top-to-bottom.
      const lo = baseMidi - 12;
      const hi = baseMidi + 12;
      const total = hi - lo;

      // Grid: every swara in two octaves, with both names visible.
      // Left gutter (GRID_LEFT) holds Bengali sargam + western note (A-G).
      const activeRaga = (window.pitchDetector && window.pitchDetector.activeRaga) || null;
      ctx.lineWidth = 1;
      for (let offset = -12; offset <= 12; offset++) {
        const midiVal = baseMidi + offset;
        const idx = ((offset % 12) + 12) % 12;
        const y = yOf(midiVal, lo, hi, h);
        const isSa = idx === 0;
        const allowed = activeRaga && activeRaga.allowedIntervals
          ? activeRaga.allowedIntervals.includes(idx)
          : (idx === 0 || idx === 7);
        ctx.strokeStyle = allowed ? colors.gridActive : colors.grid;
        ctx.beginPath();
        ctx.moveTo(GRID_LEFT, y);
        ctx.lineTo(w - 4, y);
        ctx.stroke();
        // Saptak tag for the three Sa lines.
        const saptak = offset === -12 ? 'মন্দ্র ' : offset === 0 ? 'মধ্য ' : offset === 12 ? 'তারা ' : '';
        const sargam = offset === 12 ? 'সাঁ' : SARGAM_SHORT[idx];
        ctx.fillStyle = isSa ? colors.line : allowed ? colors.label : 'rgba(117,109,100,.55)';
        ctx.font = (isSa ? 'bold 11px' : '11px') + ' "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(saptak + sargam, 4, y + 4);
        ctx.fillStyle = allowed ? colors.label : 'rgba(117,109,100,.55)';
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillText(westernName(midiVal), Math.min(GRID_LEFT - 30, 46), y + 4);
      }

      // Target band.
      if (targetMidi != null) {
        const ty = yOf(targetMidi, lo, hi, h);
        const usable = Math.max(1, h - GRID_TOP - GRID_BOTTOM);
        const bandPx = (2 * targetTolerance / 100) * (usable / total);
        ctx.fillStyle = colors.band;
        ctx.fillRect(GRID_LEFT, ty - bandPx / 2, w - GRID_LEFT, bandPx);
        ctx.strokeStyle = colors.target;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(GRID_LEFT, ty);
        ctx.lineTo(w - 4, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = colors.target;
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('লক্ষ্য ' + toBn(targetTolerance) + ' সেন্ট', w - 6, ty - 6);
        ctx.textAlign = 'left';
      }

      // Time axis (seconds ago), Bengali digits.
      ctx.fillStyle = colors.label;
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      const ticks = 6;
      for (let i = 0; i <= ticks; i++) {
        const tSec = (windowMs / 1000) * (i / ticks);
        const x = xOf(start + (tSec / (windowMs / 1000)) * windowMs, start, windowMs, w);
        ctx.fillText(toBn(Math.round(tSec)) + 'সে', Math.min(w - 34, x + 2), h - 8);
        if (i > 0) {
          ctx.strokeStyle = colors.grid;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(x, GRID_TOP);
          ctx.lineTo(x, h - GRID_BOTTOM);
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
            const x = xOf(p.t, start, windowMs, w);
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
          const x = xOf(s.t, start, windowMs, w);
          const y = yOf(s.midi, lo, hi, h);
          ctx.fillStyle = s.inTune ? colors.inTune : colors.outTune;
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Stats overlay: small, top-right, Bengali digits.
      const st = stats();
      if (st) {
        const stdText = toBn((st.stdCents / 100).toFixed(2));
        const lines = [
          'নমুনা ' + toBn(st.count) + ' • নিখুঁত ' + toBn(st.accuracy) + '%',
          'সেন্ট ' + toBn(st.minCents) + '…+' + toBn(st.maxCents) + ' • σ≈' + stdText + ' ST',
          'সময় ' + toBn(st.spanSec) + 'সে'
        ];
        ctx.font = '10px "Segoe UI", sans-serif';
        const width = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18;
        const height = 42;
        const ox = w - width - 8;
        const oy = 6;
        ctx.fillStyle = 'rgba(0,0,0,.38)';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(ox, oy, width, height, 8);
          ctx.fill();
        } else {
          ctx.fillRect(ox, oy, width, height);
        }
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        lines.forEach((l, i) => ctx.fillText(l, ox + 9, oy + 15 + i * 13));
      }

      // Frozen badge (practice stopped): trail no longer scrolls.
      if (frozenEnd != null) {
        const label = 'রেওয়াজ বন্ধ — শেষের ট্রেইল';
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        const width = ctx.measureText(label).width + 18;
        const height = 20;
        const ox = GRID_LEFT + 8;
        const oy = GRID_TOP + 2;
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(ox, oy, width, height, 10);
          ctx.fill();
        } else {
          ctx.fillRect(ox, oy, width, height);
        }
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(label, ox + 9, oy + 14);
      }

      // Empty state.
      if (!visible.length) {
        ctx.fillStyle = colors.label;
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('মাইক্রোফোন চালু করে গাইলে এখানে পিচ-ট্রেইল দেখা যাবে', (GRID_LEFT + w) / 2, h / 2);
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
      frozenEnd = null;
      running = true;
      resize();
      loop();
    }
    function stop() {
      if (!running) { draw(); return; }
      frozenEnd = Date.now();
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      draw(); // freeze frame: static grid + last trail
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
      push, setTarget, setBaseMidi, start, stop, clear, resize, draw, stats,
      history: () => history.slice(),
      isLive: () => running
    };
  }

  root.PitchTrail = { create: createPitchTrail };
})(typeof window !== 'undefined' ? window : globalThis);
