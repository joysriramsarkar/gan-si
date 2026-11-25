/* Gan-si Pitch Trail — polished two-octave sadhana graph.
   Fixed Sa-anchored grid (Mandra Sa .. Tara Sa), smooth pitch curve with
   silence breaks, cents-graded colour, target band, hover readout,
   theme-aware stats card. All canvas numbers use Bengali digits.
   API: create(canvas, { height }) -> { push, setTarget, setBaseMidi,
   setWindow, resetView, start, stop, clear, resize, draw, stats,
   history, isLive } — start/stop freeze semantics kept from v2.3.2. */
(function (root) {
  const HISTORY_MS = 60000;
  const GAP_MS = 420; // silence longer than this breaks the line
  const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SARGAM_SHORT = ['সা', 'রে♭', 'রে', 'গা♭', 'গা', 'মা', 'মা♯', 'পা', 'ধা♭', 'ধা', 'নি♭', 'নি'];

  const GRID_LEFT = 98;
  const GRID_RIGHT = 14;
  const GRID_TOP = 20;
  const GRID_BOTTOM = 38;

  function toBn(value) {
    return String(value ?? '').replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
  }
  function westernName(midi) {
    const idx = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return NOTE_STRINGS[idx] + toBn(octave);
  }
  function signedBn(n) {
    const v = Math.round(Number(n) || 0);
    return (v > 0 ? '+' : '') + toBn(v);
  }
  // Parse #rgb/#rrggbb/rgb()/rgba() into channels so alpha variants work
  // for every theme token (hex concat like color+'55' breaks on rgb()).
  function parseColor(str, fallback) {
    const s = String(str || fallback || '#000000').trim();
    let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      let hex = m[1];
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
    }
    m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const p = m[1].split(',').map((v) => parseFloat(v));
      return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: p.length > 3 ? p[3] : 1 };
    }
    return parseColor(fallback || '#000000');
  }
  function rgba(c, alpha) {
    return `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${alpha})`;
  }

  function createPitchTrail(canvas, options) {
    const ctx = canvas.getContext('2d');
    const opts = options || {};
    const history = []; // { t, midi|null, inTune, cents }
    let view = { zoom: 1, pan: 0 };
    let baseWindowMs = HISTORY_MS;
    let running = false;
    let raf = null;
    let frozenEnd = null; // set on stop(): window freezes, graph must not scroll
    let targetMidi = null;
    let targetTolerance = 12;
    let baseMidi = 60;
    let hover = null; // { x, y, s }
    let dragging = false;
    let lastX = 0;
    let colors = null;
    let colorsAt = 0;

    function refreshColors(force) {
      const nowMs = performance.now();
      if (!force && colors && nowMs - colorsAt < 1000) return;
      colorsAt = nowMs;
      const css = getComputedStyle(document.documentElement);
      const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
      colors = {
        bg: parseColor(token('--chart-bg', '#fbfaf7'), '#fbfaf7'),
        gutter: parseColor(token('--chart-gutter', '#f3efe8'), '#f3efe8'),
        grid: parseColor(token('--chart-grid', '#e4ddd3'), '#e4ddd3'),
        gridActive: parseColor(token('--chart-grid-active', '#d9b8a6'), '#d9b8a6'),
        label: parseColor(token('--chart-label', '#756d64'), '#756d64'),
        line: parseColor(token('--chart-line', '#a44a2a'), '#a44a2a'),
        target: parseColor(token('--chart-target', '#2f6f5e'), '#2f6f5e'),
        band: parseColor(token('--chart-band', 'rgba(47,111,94,.12)'), 'rgba(47,111,94,.12)'),
        inTune: parseColor(token('--chart-in-tune', '#2f6f5e'), '#2f6f5e'),
        near: parseColor(token('--chart-near', '#b7791f'), '#b7791f'),
        outTune: parseColor(token('--chart-out-tune', '#a63d40'), '#a63d40'),
        cardBg: parseColor(token('--chart-card-bg', 'rgba(255,255,255,.94)'), 'rgba(255,255,255,.94)'),
        cardText: parseColor(token('--chart-card-text', '#292723'), '#292723'),
        cardSub: parseColor(token('--chart-card-sub', '#625c55'), '#625c55'),
        cardBorder: parseColor(token('--chart-card-border', '#ded6cc'), '#ded6cc')
      };
    }

    function cssW() { return canvas.width / (window.devicePixelRatio || 1); }
    function cssH() { return canvas.height / (window.devicePixelRatio || 1); }
    function plotW(w) { return Math.max(1, w - GRID_LEFT - GRID_RIGHT); }
    function windowMs() { return baseWindowMs / view.zoom; }
    function endTime() { return (frozenEnd != null ? frozenEnd : Date.now()) - view.pan; }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.parentElement ? canvas.parentElement.clientWidth : canvas.width;
      const h = opts.height || 360;
      if (!w || w < 40) return;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function push(sample) {
      const midi = sample && typeof sample.midi === 'number' && Number.isFinite(sample.midi) ? sample.midi : null;
      if (midi == null) {
        // Silence marker: one is enough; the time gap itself breaks the line.
        const last = history[history.length - 1];
        if (running && (!last || last.midi != null)) {
          history.push({ t: Date.now(), midi: null, inTune: false, cents: 0 });
        }
        return;
      }
      if (!running) start(); // guided/raga paths may push without explicit start
      const now = Date.now();
      history.push({ t: now, midi, inTune: !!sample.inTune, cents: Number(sample.cents) || 0 });
      const cutoff = now - HISTORY_MS;
      while (history.length && history[0].t < cutoff) history.shift();
    }

    function clear() {
      history.length = 0;
      hover = null;
      draw();
    }
    function setTarget(midi, tolerance) {
      targetMidi = typeof midi === 'number' && Number.isFinite(midi) ? midi : null;
      targetTolerance = tolerance || 12;
    }
    function setBaseMidi(midi) { if (midi) baseMidi = midi; }
    function setWindow(ms) {
      baseWindowMs = Math.min(HISTORY_MS, Math.max(5000, Number(ms) || HISTORY_MS));
      view.zoom = 1;
      view.pan = 0;
      draw();
    }
    function resetView() {
      view.zoom = 1;
      view.pan = 0;
      draw();
    }

    function stats() {
      const samples = history.filter((s) => s.midi != null);
      if (!samples.length) return null;
      const cents = samples.map((s) => s.cents).filter((c) => Number.isFinite(c));
      const mean = cents.length ? cents.reduce((a, b) => a + b, 0) / cents.length : 0;
      const variance = cents.length ? cents.reduce((a, b) => a + (b - mean) ** 2, 0) / cents.length : 0;
      const inTune = samples.filter((s) => s.inTune || Math.abs(s.cents) <= targetTolerance).length;
      return {
        count: samples.length,
        accuracy: Math.round((inTune / samples.length) * 100),
        meanCents: Math.round(mean),
        minCents: cents.length ? Math.round(Math.min(...cents)) : 0,
        maxCents: cents.length ? Math.round(Math.max(...cents)) : 0,
        stdCents: Math.round(Math.sqrt(variance)),
        spanSec: Math.round((samples[samples.length - 1].t - samples[0].t) / 1000)
      };
    }

    function yOf(midiVal, lo, hi, h) {
      const usable = Math.max(1, h - GRID_TOP - GRID_BOTTOM);
      return GRID_TOP + (1 - (midiVal - lo) / Math.max(hi - lo, 1)) * usable;
    }
    function xOf(t, start, winMs, w) {
      return GRID_LEFT + ((t - start) / Math.max(winMs, 1)) * plotW(w);
    }
    function qualityOf(s) {
      const ac = Math.abs(Number(s.cents) || 0);
      if (s.inTune || ac <= 12) return 0;
      if (ac <= 25) return 1;
      return 2;
    }
    function qualityColor(q) {
      return q === 0 ? colors.inTune : q === 1 ? colors.near : colors.outTune;
    }
    function sargamOf(midiVal) {
      const rel = Math.round(midiVal) - baseMidi;
      const idx = ((rel % 12) + 12) % 12;
      const saptak = rel < 0 ? 'মন্দ্র ' : rel >= 12 ? 'তারা ' : 'মধ্য ';
      const name = idx === 0 && rel >= 12 ? 'সাঁ' : SARGAM_SHORT[idx];
      return saptak + name;
    }
    function smoothPath(points) {
      ctx.moveTo(points[0].x, points[0].y);
      if (points.length === 2) { ctx.lineTo(points[1].x, points[1].y); return; }
      for (let i = 1; i < points.length - 1; i++) {
        const mx = (points[i].x + points[i + 1].x) / 2;
        const my = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    function pill(x, y, text, opts2) {
      const o = opts2 || {};
      ctx.font = (o.bold ? 'bold ' : '') + (o.size || 10.5) + 'px "Segoe UI", sans-serif';
      const tw = ctx.measureText(text).width;
      const wdt = tw + 16;
      const hgt = o.height || 19;
      let px = Math.max(2, Math.min(cssW() - wdt - 2, x));
      let py = Math.max(2, Math.min(cssH() - hgt - 2, y));
      ctx.fillStyle = rgba(o.bg, o.bgA != null ? o.bgA : 1);
      ctx.strokeStyle = rgba(o.border || o.bg, o.borderA != null ? o.borderA : 1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, wdt, hgt, hgt / 2); else ctx.rect(px, py, wdt, hgt);
      ctx.fill();
      if (o.border) ctx.stroke();
      ctx.fillStyle = rgba(o.fg, 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, px + 8, py + hgt / 2 + 0.5);
      ctx.textBaseline = 'alphabetic';
      return { x: px, y: py, w: wdt, h: hgt };
    }

    function draw() {
      const w = cssW();
      const h = cssH();
      if (!w || w < 60 || !h || h < 60) return;
      refreshColors(false);
      const C = colors;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = rgba(C.bg, 1);
      ctx.fillRect(0, 0, w, h);

      const winMs = windowMs();
      const end = endTime();
      const start = end - winMs;
      const lo = baseMidi - 12;
      const hi = baseMidi + 12;
      const plotBottom = h - GRID_BOTTOM;
      const plotRight = w - GRID_RIGHT;

      // Octave bands: middle saptak breathes, outer saptaks recede.
      const bandDefs = [
        { from: lo, to: baseMidi, c: C.line, a: 0.035 },
        { from: baseMidi, to: baseMidi + 12, c: C.target, a: 0.045 },
        { from: baseMidi + 12, to: hi, c: C.line, a: 0.035 }
      ];
      for (const b of bandDefs) {
        ctx.fillStyle = rgba(b.c, b.a);
        ctx.fillRect(GRID_LEFT, yOf(b.to, lo, hi, h), plotW(w), yOf(b.from, lo, hi, h) - yOf(b.to, lo, hi, h));
      }
      // Gutter panel + separator.
      ctx.fillStyle = rgba(C.gutter, 1);
      ctx.fillRect(0, 0, GRID_LEFT, h);
      ctx.strokeStyle = rgba(C.grid, 1);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(GRID_LEFT + 0.5, 0); ctx.lineTo(GRID_LEFT + 0.5, h); ctx.stroke();

      // Vertical time gridlines (every 10s of the visible window).
      ctx.font = '10px "Segoe UI", sans-serif';
      const stepSec = winMs / 1000 > 30 ? 10 : 5;
      for (let ago = 0; ago * 1000 <= winMs; ago += stepSec) {
        const t = end - ago * 1000;
        const x = xOf(t, start, winMs, w);
        if (ago > 0) {
          ctx.strokeStyle = rgba(C.grid, 0.55);
          ctx.lineWidth = 0.6;
          ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.moveTo(x, GRID_TOP); ctx.lineTo(x, plotBottom); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = rgba(C.label, 1);
        ctx.textAlign = ago === 0 ? 'right' : x < GRID_LEFT + 20 ? 'left' : 'center';
        const label = ago === 0 ? 'এখন' : '−' + toBn(ago) + 'সে';
        ctx.fillText(label, ago === 0 ? plotRight : x < GRID_LEFT + 20 ? GRID_LEFT + 1 : x, h - 22);
      }
      // Time axis baseline.
      ctx.strokeStyle = rgba(C.gridActive, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(GRID_LEFT, plotBottom + 0.5); ctx.lineTo(plotRight, plotBottom + 0.5); ctx.stroke();
      ctx.fillStyle = rgba(C.label, 0.85);
      ctx.font = '9.5px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('সময় →', GRID_LEFT + 2, h - 8);

      // Swara grid + gutter labels.
      const activeRaga = (window.pitchDetector && window.pitchDetector.activeRaga) || null;
      for (let offset = -12; offset <= 12; offset++) {
        const midiVal = baseMidi + offset;
        const idx = ((offset % 12) + 12) % 12;
        const y = yOf(midiVal, lo, hi, h);
        const isSa = idx === 0;
        const isPa = idx === 7;
        const allowed = activeRaga && activeRaga.allowedIntervals
          ? activeRaga.allowedIntervals.includes(idx)
          : null; // null = no raga: shuddha emphasis only
        const inScale = allowed == null ? (isSa || isPa || [2, 4, 5, 9, 11].includes(idx)) : allowed;
        ctx.strokeStyle = isSa ? rgba(C.line, 0.55) : inScale ? rgba(C.gridActive, 0.85) : rgba(C.grid, 0.6);
        ctx.lineWidth = isSa ? 1.4 : inScale ? 1 : 0.7;
        if (!inScale && allowed != null) ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(GRID_LEFT, y); ctx.lineTo(plotRight, y); ctx.stroke();
        ctx.setLineDash([]);
        const saptak = offset === -12 ? 'মন্দ্র ' : offset === 0 ? 'মধ্য ' : offset === 12 ? 'তারা ' : '';
        const sargam = offset === 12 ? 'সাঁ' : SARGAM_SHORT[idx];
        if (isSa) {
          // Sa gets a filled marker dot in the gutter.
          ctx.fillStyle = rgba(C.line, 1);
          ctx.beginPath(); ctx.arc(8, y, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = isSa ? rgba(C.line, 1) : inScale ? rgba(C.cardText, 0.92) : rgba(C.label, 0.55);
        ctx.font = (isSa ? 'bold 10.5px' : inScale ? '600 10.5px' : '10.5px') + ' "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(saptak + sargam, 16, y + 4);
        ctx.fillStyle = inScale ? rgba(C.label, 0.95) : rgba(C.label, 0.5);
        ctx.font = '9.5px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(westernName(midiVal), GRID_LEFT - 7, y + 3.5);
        ctx.textAlign = 'left';
      }

      // Target band + centre line.
      if (targetMidi != null) {
        const ty = yOf(targetMidi, lo, hi, h);
        const usable = Math.max(1, h - GRID_TOP - GRID_BOTTOM);
        const bandPx = Math.max(3, (2 * targetTolerance / 100) * (usable / (hi - lo)));
        const grad = ctx.createLinearGradient(0, ty - bandPx / 2, 0, ty + bandPx / 2);
        grad.addColorStop(0, rgba(C.target, 0));
        grad.addColorStop(0.5, rgba(C.target, 0.16));
        grad.addColorStop(1, rgba(C.target, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(GRID_LEFT, ty - bandPx / 2, plotW(w), bandPx);
        ctx.strokeStyle = rgba(C.target, 0.85);
        ctx.lineWidth = 1.3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(GRID_LEFT, ty); ctx.lineTo(plotRight, ty); ctx.stroke();
        ctx.setLineDash([]);
        pill(plotRight - 118, ty - bandPx / 2 - 21,
          'লক্ষ্য ' + sargamOf(targetMidi).replace(/^(মন্দ্র|মধ্য|তারা) /, '') + ' ±' + toBn(targetTolerance) + ' সেন্ট',
          { bg: C.target, bgA: 0.92, fg: parseColor('#ffffff'), size: 10, bold: true });
      }

      // Build visible points, decimated to ~1.4px so the curve stays light.
      const visible = [];
      let lastPx = -Infinity;
      for (const s of history) {
        if (s.t < start || s.t > end) continue;
        const x = xOf(s.t, start, winMs, w);
        if (s.midi != null && x - lastPx < 1.4 && visible.length) continue;
        if (s.midi != null) lastPx = x;
        visible.push({ s, x, y: s.midi == null ? null : yOf(s.midi, lo, hi, h) });
      }
      const voiced = visible.filter((p) => p.s.midi != null);

      // "Now" edge line.
      if (frozenEnd == null) {
        ctx.strokeStyle = rgba(C.target, 0.35);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(plotRight - 0.5, GRID_TOP); ctx.lineTo(plotRight - 0.5, plotBottom); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Trail: split on silence gaps / nulls, grade by cents, smooth curve.
      ctx.save();
      ctx.beginPath();
      ctx.rect(GRID_LEFT, GRID_TOP - 2, plotW(w), plotBottom - GRID_TOP + 4);
      ctx.clip();
      const runs = [];
      let run = [];
      let prevT = null;
      for (const p of visible) {
        if (p.s.midi == null || (prevT != null && p.s.t - prevT > GAP_MS)) {
          if (run.length) runs.push(run);
          run = [];
        }
        if (p.s.midi != null) run.push(p);
        prevT = p.s.t;
      }
      if (run.length) runs.push(run);

      for (const r of runs) {
        if (r.length < 2) continue;
        // Area wash under the whole run (neutral clay, very light).
        ctx.beginPath();
        smoothPath(r);
        ctx.lineTo(r[r.length - 1].x, plotBottom);
        ctx.lineTo(r[0].x, plotBottom);
        ctx.closePath();
        const wash = ctx.createLinearGradient(0, GRID_TOP, 0, plotBottom);
        wash.addColorStop(0, rgba(C.line, 0.10));
        wash.addColorStop(1, rgba(C.line, 0.01));
        ctx.fillStyle = wash;
        ctx.fill();
        // Colour segments (boundary point shared so the line never breaks).
        let seg = [r[0]];
        let segQ = qualityOf(r[0].s);
        const strokeSeg = () => {
          if (seg.length < 2) return;
          const col = qualityColor(segQ);
          const fade = ctx.createLinearGradient(GRID_LEFT, 0, plotRight, 0);
          fade.addColorStop(0, rgba(col, 0.22));
          fade.addColorStop(0.55, rgba(col, 0.75));
          fade.addColorStop(1, rgba(col, 1));
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath(); smoothPath(seg);
          ctx.strokeStyle = fade;
          ctx.globalAlpha = 0.16;
          ctx.lineWidth = 6.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.beginPath(); smoothPath(seg);
          ctx.strokeStyle = fade;
          ctx.lineWidth = 2.7;
          ctx.stroke();
        };
        for (let i = 1; i < r.length; i++) {
          const q = qualityOf(r[i].s);
          seg.push(r[i]);
          if (q !== segQ) { strokeSeg(); seg = [r[i]]; segQ = q; }
        }
        strokeSeg();
      }

      // Live head: ring + dot + note pill.
      const last = voiced[voiced.length - 1];
      if (last) {
        const col = qualityColor(qualityOf(last.s));
        if (frozenEnd == null) {
          const pulse = 8 + Math.sin(Date.now() / 320) * 1.8;
          ctx.strokeStyle = rgba(col, 0.35);
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(last.x, last.y, pulse, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = rgba(col, 1);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(last.x, last.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const headText = sargamOf(last.s.midi) + ' ' + westernName(Math.round(last.s.midi)) + ' ' + signedBn(last.s.cents) + ' সেন্ট';
        if (!hover) pill(Math.min(last.x + 10, plotRight - 150), last.y - 26, headText,
          { bg: C.cardBg, bgA: 0.96, fg: C.cardText, border: C.cardBorder, borderA: 1, size: 10, bold: true });
      }
      ctx.restore();

      // Hover crosshair + readout.
      if (hover && hover.s && hover.s.midi != null) {
        const hx = xOf(hover.s.t, start, winMs, w);
        const hy = yOf(hover.s.midi, lo, hi, h);
        ctx.strokeStyle = rgba(C.label, 0.45);
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(hx, GRID_TOP); ctx.lineTo(hx, plotBottom); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(GRID_LEFT, hy); ctx.lineTo(plotRight, hy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = rgba(qualityColor(qualityOf(hover.s)), 1);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const agoSec = Math.max(0, Math.round((end - hover.s.t) / 1000));
        const tip = sargamOf(hover.s.midi) + ' ' + westernName(Math.round(hover.s.midi)) + ' • ' + signedBn(hover.s.cents) + ' সেন্ট • ' + (agoSec === 0 ? 'এখন' : toBn(agoSec) + 'সে আগে');
        pill(hx + 10, hy - 28, tip, { bg: C.cardBg, bgA: 0.97, fg: C.cardText, border: C.cardBorder, borderA: 1, size: 10 });
      }

      // Legend (top-left inside plot).
      const legend = [
        { c: C.inTune, t: 'সঠিক ≤' + toBn(12) },
        { c: C.near, t: 'কাছে ≤' + toBn(25) },
        { c: C.outTune, t: 'বাইরে' }
      ];
      let lx = GRID_LEFT + 8;
      const ly = GRID_TOP + 3;
      ctx.font = '9.5px "Segoe UI", sans-serif';
      for (const item of legend) {
        ctx.fillStyle = rgba(item.c, 1);
        ctx.beginPath(); ctx.arc(lx + 4, ly + 4, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(C.label, 1);
        ctx.textAlign = 'left';
        ctx.fillText(item.t, lx + 11, ly + 8);
        lx += 11 + ctx.measureText(item.t).width + 12;
      }

      // Stats card (top-right, theme-aware).
      const st = stats();
      if (st) {
        const lines = [
          { t: 'নিখুঁত ' + toBn(st.accuracy) + '%', bold: true },
          { t: 'নমুনা ' + toBn(st.count) + ' • সময় ' + toBn(st.spanSec) + 'সে' },
          { t: 'বিচ্যুতি ' + signedBn(st.minCents) + '…' + signedBn(st.maxCents) + ' • σ ' + toBn(st.stdCents) + ' সেন্ট' }
        ];
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        const tw = Math.max(...lines.map((l) => { ctx.font = (l.bold ? 'bold 11px' : '10px') + ' "Segoe UI", sans-serif'; return ctx.measureText(l.t).width; }));
        const cardW = tw + 20;
        const cardH = 58;
        const ox = w - cardW - 8;
        const oy = 6;
        ctx.fillStyle = rgba(C.cardBg, 0.94);
        ctx.strokeStyle = rgba(C.cardBorder, 1);
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(ox, oy, cardW, cardH, 10); else ctx.rect(ox, oy, cardW, cardH);
        ctx.fill(); ctx.stroke();
        // Accuracy bar.
        ctx.fillStyle = rgba(C.grid, 1);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(ox + 9, oy + cardH - 10, cardW - 18, 4, 2); else ctx.rect(ox + 9, oy + cardH - 10, cardW - 18, 4);
        ctx.fill();
        ctx.fillStyle = rgba(C.inTune, 1);
        const bw = Math.max(0, Math.min(cardW - 18, (cardW - 18) * st.accuracy / 100));
        if (bw > 2) {
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(ox + 9, oy + cardH - 10, bw, 4, 2); else ctx.rect(ox + 9, oy + cardH - 10, bw, 4);
          ctx.fill();
        }
        lines.forEach((l, i) => {
          ctx.font = (l.bold ? 'bold 11px' : '10px') + ' "Segoe UI", sans-serif';
          ctx.fillStyle = rgba(i === 0 ? C.cardText : C.cardSub, 1);
          ctx.textAlign = 'left';
          ctx.fillText(l.t, ox + 9, oy + 16 + i * 13);
        });
      }

      // Frozen badge.
      if (frozenEnd != null) {
        pill(GRID_LEFT + 8, GRID_TOP + 16, 'রেওয়াজ বন্ধ — শেষের ট্রেইল',
          { bg: parseColor('#292723'), bgA: 0.82, fg: parseColor('#ffffff'), size: 10.5, bold: true });
      }

      // Empty state.
      if (!voiced.length) {
        ctx.fillStyle = rgba(C.line, 0.16);
        ctx.font = '34px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♪', (GRID_LEFT + plotRight) / 2, h / 2 - 8);
        ctx.fillStyle = rgba(C.label, 1);
        ctx.font = '12.5px "Segoe UI", sans-serif';
        ctx.fillText('মাইক্রোফোন চালু করে গাইলে এখানে সুরের রেখা ফুটে উঠবে', (GRID_LEFT + plotRight) / 2, h / 2 + 16);
        ctx.font = '10.5px "Segoe UI", sans-serif';
        ctx.fillStyle = rgba(C.label, 0.75);
        ctx.fillText('সবুজ = সঠিক সুর • হলুদাভ = কাছাকাছি • লালচে = সুরের বাইরে', (GRID_LEFT + plotRight) / 2, h / 2 + 34);
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
      draw();
    }

    // Pointer: hover readout + drag pan; wheel zoom; double-click reset.
    function pointerPos(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    canvas.addEventListener('pointermove', (e) => {
      const pos = pointerPos(e);
      if (dragging) {
        const dx = pos.x - lastX;
        lastX = pos.x;
        const span = plotW(cssW());
        view.pan = Math.max(0, Math.min(HISTORY_MS - windowMs(), view.pan - dx * (windowMs() / span)));
        draw();
        return;
      }
      // Nearest voiced sample to the cursor x.
      const end = endTime();
      const start = end - windowMs();
      let best = null;
      let bestDx = Infinity;
      for (const s of history) {
        if (s.midi == null || s.t < start || s.t > end) continue;
        const dx = Math.abs(xOf(s.t, start, windowMs(), cssW()) - pos.x);
        if (dx < bestDx) { bestDx = dx; best = s; }
      }
      hover = best && bestDx <= 26 ? { x: pos.x, y: pos.y, s: best } : null;
      canvas.style.cursor = hover ? 'crosshair' : 'grab';
      if (!running) draw();
    });
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = pointerPos(e).x;
      canvas.classList.add('dragging');
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
    });
    const endDrag = () => { dragging = false; canvas.classList.remove('dragging'); };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => { hover = null; if (!running) draw(); });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.2 : 0.83;
      view.zoom = Math.min(8, Math.max(1, view.zoom * factor));
      if (view.zoom === 1) view.pan = 0;
      draw();
    }, { passive: false });
    canvas.addEventListener('dblclick', () => resetView());
    window.addEventListener('resize', resize);
    // Theme tokens live on <html data-theme>: repaint instantly on switch.
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => { refreshColors(true); draw(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    }

    return {
      push, setTarget, setBaseMidi, setWindow, resetView, start, stop, clear, resize, draw, stats,
      history: () => history.slice(),
      isLive: () => running
    };
  }

  root.PitchTrail = { create: createPitchTrail };
})(typeof window !== 'undefined' ? window : globalThis);
