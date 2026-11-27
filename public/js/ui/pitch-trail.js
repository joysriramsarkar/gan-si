/* Gan-si Pitch Trail — two-panel sadhana graph (v2.5).
   Top: fixed Sa-anchored two-octave swara grid with a smooth, cents-graded
   pitch curve, stepped target history, stable-note hold labels, hover readout.
   Bottom: a ±50 cents deviation ribbon so "how in tune" is readable at a glance.
   All canvas numbers use Bengali digits. start()/stop() freeze semantics kept.
   API: { push, setTarget, setBaseMidi, setWindow, resetView, setHolds,
          exportPNG, describe, start, stop, clear, resize, draw, stats,
          history, isLive } */
(function (root) {
  const HISTORY_MS = 60000;
  const GAP_MS = 420;        // silence longer than this breaks the line
  const CENTS_MAX = 50;      // ribbon vertical scale
  const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SARGAM_SHORT = ['সা', 'রে♭', 'রে', 'গা♭', 'গা', 'মা', 'মা♯', 'পা', 'ধা♭', 'ধা', 'নি♭', 'নি'];

  const GRID_LEFT = 98;
  const GRID_RIGHT = 14;
  const GRID_TOP = 20;
  const TIME_AXIS_H = 20;
  const RIBBON_H = 54;
  const RIBBON_GAP = 10;
  const BOTTOM_PAD = 8;

  function toBn(value) {
    return String(value ?? '').replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
  }
  function westernName(midi) {
    const idx = ((midi % 12) + 12) % 12;
    return NOTE_STRINGS[idx] + toBn(Math.floor(midi / 12) - 1);
  }
  function signedBn(n) {
    const v = Math.round(Number(n) || 0);
    return (v > 0 ? '+' : v < 0 ? '−' : '') + toBn(Math.abs(v));
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  // Parse #rgb/#rrggbb/rgb()/rgba() so alpha variants work for every theme token.
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
  function rgba(c, alpha) { return `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${alpha})`; }

  // Vertical geometry, derived from canvas height so both panels stay in sync.
  function plotBottom(h) { return h - TIME_AXIS_H - RIBBON_GAP - RIBBON_H - BOTTOM_PAD; }
  function ribbonTop(h) { return h - RIBBON_H - BOTTOM_PAD; }
  function ribbonBottom(h) { return h - BOTTOM_PAD; }
  function ribbonZero(h) { return ribbonTop(h) + RIBBON_H / 2; }

  function createPitchTrail(canvas, options) {
    const ctx = canvas.getContext('2d');
    const opts = options || {};
    const history = [];        // { t, midi|null, inTune, cents }
    const targetEvents = [];   // { t, midi|null, tol } — stepped target history
    let view = { zoom: 1, pan: 0 };
    let baseWindowMs = HISTORY_MS;
    let running = false;
    let raf = null;
    let hidden = false;
    let frozenEnd = null;      // set on stop(): time window freezes
    let targetMidi = null;
    let targetTolerance = 12;
    let baseMidi = 60;
    // Vertical viewport: a fixed note ladder on the left that slides up/down
    // with the voice instead of clipping notes outside a two-octave box.
    let viewCenter = null;
    let viewCenterBase = null;
    let showHolds = true;
    let hover = null;
    let dragging = false;
    let lastX = 0;
    const pointers = new Map();
    let pinchDist = 0;
    let pinchZoom = 1;
    let colors = null;
    let colorsAt = 0;
    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function refreshColors(force) {
      const nowMs = performance.now();
      if (!force && colors && nowMs - colorsAt < 1000) return;
      colorsAt = nowMs;
      const css = getComputedStyle(document.documentElement);
      const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
      colors = {
        bg: parseColor(token('--chart-bg', '#fbfaf7'), '#fbfaf7'),
        gutter: parseColor(token('--chart-gutter', '#f3efe8'), '#f3efe8'),
        ribbon: parseColor(token('--chart-ribbon', '#f6f2eb'), '#f6f2eb'),
        grid: parseColor(token('--chart-grid', '#e4ddd3'), '#e4ddd3'),
        gridActive: parseColor(token('--chart-grid-active', '#d9b8a6'), '#d9b8a6'),
        label: parseColor(token('--chart-label', '#756d64'), '#756d64'),
        line: parseColor(token('--chart-line', '#a44a2a'), '#a44a2a'),
        target: parseColor(token('--chart-target', '#2f6f5e'), '#2f6f5e'),
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
      // Inline height would override the CSS media query, so choose it here
      // using the same viewport breakpoint as material.css.
      const mobile = !!(window.matchMedia && window.matchMedia('(max-width: 640px)').matches);
      const h = mobile ? (opts.mobileHeight || 360) : (opts.height || 400);
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
      const now = Date.now();
      if (midi == null) {
        // One silence marker is enough; the time gap itself breaks the line.
        const last = history[history.length - 1];
        if (running && (!last || last.midi != null)) {
          history.push({ t: now, midi: null, inTune: false, cents: 0 });
        }
      } else {
        if (!running) start(); // guided/raga paths may push without explicit start
        history.push({ t: now, midi, inTune: !!sample.inTune, cents: Number(sample.cents) || 0 });
      }
      const cutoff = now - HISTORY_MS;
      while (history.length && history[0].t < cutoff) history.shift();
      while (targetEvents.length > 1 && targetEvents[1].t < cutoff) targetEvents.shift();
    }

    function clear() {
      history.length = 0;
      targetEvents.length = 0;
      targetEvents.push({ t: Date.now() - HISTORY_MS, midi: targetMidi, tol: targetTolerance });
      hover = null;
      draw();
    }
    function setTarget(midi, tolerance) {
      targetMidi = typeof midi === 'number' && Number.isFinite(midi) ? midi : null;
      targetTolerance = tolerance || 12;
      const last = targetEvents[targetEvents.length - 1];
      if (!last) {
        // First target: treat it as active for the whole visible window.
        targetEvents.push({ t: Date.now() - HISTORY_MS, midi: targetMidi, tol: targetTolerance });
      } else if (last.midi !== targetMidi || last.tol !== targetTolerance) {
        targetEvents.push({ t: Date.now(), midi: targetMidi, tol: targetTolerance });
      }
      if (targetEvents.length > 240) targetEvents.splice(0, targetEvents.length - 240);
    }
    function setBaseMidi(midi) {
      if (!Number.isFinite(midi)) return;
      baseMidi = midi;
      draw(); // the Sa grid must follow a scale change even while silent
    }
    let notationMode = 'indian';
    function setNotation(mode) {
      if (['indian', 'western', 'solfege'].includes(mode)) { notationMode = mode; draw(); }
    }
    function primaryLabel(midiVal) {
      if (notationMode === 'western') return westernName(Math.round(midiVal));
      if (notationMode === 'solfege') return (window.Swara ? window.Swara.solfegeOf(shortIdx(midiVal)) : shortSargam(midiVal));
      return shortSargam(midiVal);
    }
    function shortIdx(midiVal) {
      return ((Math.round(midiVal) - baseMidi) % 12 + 12) % 12;
    }
    function setHolds(on) { showHolds = !!on; draw(); }
    function setWindow(ms) {
      baseWindowMs = Math.min(HISTORY_MS, Math.max(5000, Number(ms) || HISTORY_MS));
      view.zoom = 1; view.pan = 0;
      draw();
    }
    function resetView() { view.zoom = 1; view.pan = 0; draw(); }

    function exportPNG() {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gansi-pitch-trail-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return url.length;
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
    function describe() {
      const st = stats();
      if (!st) return 'পিচ ট্রেইল এখনও খালি। মাইক্রোফোন চালু করে গাইলে সুরের রেখা ও সেন্ট-বিচ্যুতি দেখা যাবে।';
      return 'পিচ ট্রেইল: ' + toBn(st.count) + 'টি নমুনা, নিখুঁত ' + toBn(st.accuracy) +
        '%, গড় বিচ্যুতি ' + signedBn(st.meanCents) + ' সেন্ট, পরিসর ' + signedBn(st.minCents) +
        '…' + signedBn(st.maxCents) + ' সেন্ট, মোট ' + toBn(st.spanSec) +
        ' সেকেন্ড। স্কোর সহায়ক পরিমাপ, শিল্পের চূড়ান্ত মান নয়।';
    }

    function yOf(midiVal, lo, hi, h) {
      const usable = Math.max(1, plotBottom(h) - GRID_TOP);
      return GRID_TOP + (1 - (midiVal - lo) / Math.max(hi - lo, 1)) * usable;
    }
    function xOf(t, start, winMs, w) {
      return GRID_LEFT + ((t - start) / Math.max(winMs, 1)) * plotW(w);
    }
    function centY(cents, h) {
      const half = RIBBON_H / 2 - 6;
      return ribbonZero(h) - (clamp(Number(cents) || 0, -CENTS_MAX, CENTS_MAX) / CENTS_MAX) * half;
    }
    function qualityOf(s) {
      const ac = Math.abs(Number(s.cents) || 0);
      if (s.inTune || ac <= 12) return 0;
      if (ac <= 25) return 1;
      return 2;
    }
    function qualityColor(q) { return q === 0 ? colors.inTune : q === 1 ? colors.near : colors.outTune; }
    function sargamOf(midiVal) {
      const rel = Math.round(midiVal) - baseMidi;
      const idx = ((rel % 12) + 12) % 12;
      const saptak = rel < 0 ? 'মন্দ্র ' : rel >= 12 ? 'তারা ' : 'মধ্য ';
      if (notationMode === 'western') return saptak + westernName(Math.round(midiVal));
      if (notationMode === 'solfege') return saptak + (window.Swara ? window.Swara.solfegeOf(idx) : SARGAM_SHORT[idx]);
      return saptak + (idx === 0 && rel >= 12 ? 'সাঁ' : SARGAM_SHORT[idx]);
    }
    function shortSargam(midiVal) {
      const idx = ((Math.round(midiVal) - baseMidi) % 12 + 12) % 12;
      return SARGAM_SHORT[idx];
    }
    function smoothPath(points) {
      ctx.moveTo(points[0].x, points[0].y);
      if (points.length === 2) { ctx.lineTo(points[1].x, points[1].y); return; }
      for (let i = 1; i < points.length - 1; i++) {
        ctx.quadraticCurveTo(points[i].x, points[i].y,
          (points[i].x + points[i + 1].x) / 2, (points[i].y + points[i + 1].y) / 2);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    function pill(x, y, text, o) {
      o = o || {};
      ctx.font = (o.bold ? 'bold ' : '') + (o.size || 10.5) + 'px "Segoe UI", sans-serif';
      const wdt = ctx.measureText(text).width + 16;
      const hgt = o.height || 19;
      const minX = o.minX != null ? o.minX : 2;
      const maxX = o.maxX != null ? o.maxX : cssW() - 2;
      const minY = o.minY != null ? o.minY : 2;
      const maxY = o.maxY != null ? o.maxY : cssH() - 2;
      const px = clamp(x, minX, maxX - wdt);
      const py = clamp(y, minY, maxY - hgt);
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
      if (!w || w < 60 || !h || h < 120) return;
      refreshColors(false);
      const C = colors;
      const plb = plotBottom(h);
      const rt = ribbonTop(h);
      const rb = ribbonBottom(h);
      const zero = ribbonZero(h);
      const plotRight = w - GRID_RIGHT;
      const winMs = windowMs();
      const end = endTime();
      // Young session: stretch the trail across the panel instead of squeezing
      // a few seconds into the far-right sliver of a 60s window. Once the
      // session is longer than the window this is a normal scrolling view.
      let start = end - winMs;
      if (history.length && history[0].t > start + 250) {
        start = Math.max(history[0].t - 250, end - HISTORY_MS);
      }
      const win = Math.max(1000, end - start);
      const mobile = !!(window.matchMedia && window.matchMedia('(max-width: 640px)').matches);
      const span = mobile ? 17 : 25; // semitones visible at once
      const half = span / 2;
      if (viewCenter == null || viewCenterBase !== baseMidi) {
        viewCenter = baseMidi;
        viewCenterBase = baseMidi;
      }
      // Follow the voice: when the note approaches the top/bottom edge, slide
      // the ladder so the singer stays comfortably in view.
      const lastVoiced = (() => {
        for (let i = history.length - 1; i >= 0; i--) {
          const s = history[i];
          if (s.t < start || s.t > end) continue;
          if (s.midi != null) return s;
        }
        return null;
      })();
      if (lastVoiced) {
        const margin = 3;
        let target = viewCenter;
        if (lastVoiced.midi > viewCenter + half - margin) target = lastVoiced.midi - (half - margin);
        else if (lastVoiced.midi < viewCenter - half + margin) target = lastVoiced.midi + (half - margin);
        viewCenter += (target - viewCenter) * 0.22;
      } else {
        viewCenter += (baseMidi - viewCenter) * 0.04; // ease home when silent
      }
      let lo = viewCenter - half;
      let hi = viewCenter + half;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = rgba(C.bg, 1);
      ctx.fillRect(0, 0, w, h);

      // Visible points, decimated to ~1.4px so the curve stays light.
      const visible = [];
      let lastPx = -Infinity;
      for (const s of history) {
        if (s.t < start || s.t > end) continue;
        const x = xOf(s.t, start, win, w);
        if (s.midi != null && x - lastPx < 1.4 && visible.length) continue;
        if (s.midi != null) lastPx = x;
        visible.push({ s, x, y: null });
      }
      // A fast glide can briefly leave the followed window; widen just enough
      // to keep the dot visible rather than clipping it off the panel edge.
      for (const p of visible) {
        if (p.s.midi == null) continue;
        if (p.s.midi < lo) lo = Math.floor(p.s.midi) - 1;
        if (p.s.midi > hi) hi = Math.ceil(p.s.midi) + 1;
      }
      for (const p of visible) p.y = p.s.midi == null ? null : yOf(p.s.midi, lo, hi, h);
      const voiced = visible.filter((p) => p.s.midi != null);

      // Runs: broken at silence markers or long gaps (shared by both panels).
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

      // Piano-style semitone rows: black keys get a faint band so the ladder
      // reads like a keyboard. Sa's octave keeps a slightly warmer tint.
      const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
      const rowTop = Math.ceil(lo - 0.5);
      const rowBot = Math.floor(hi + 0.5);
      for (let m = rowTop; m <= rowBot; m++) {
        const pc = ((m % 12) + 12) % 12;
        const y1 = yOf(m + 0.5, lo, hi, h);
        const y2 = yOf(m - 0.5, lo, hi, h);
        if (BLACK_PCS.has(pc)) {
          ctx.fillStyle = rgba(C.label, 0.055);
          ctx.fillRect(GRID_LEFT, y1, plotW(w), Math.max(1, y2 - y1));
        }
        if (pc === ((baseMidi % 12) + 12) % 12) {
          ctx.fillStyle = rgba(C.line, 0.05);
          ctx.fillRect(GRID_LEFT, y1, plotW(w), Math.max(1, y2 - y1));
        }
      }
      // Gutter panel + separator (covers both panels).
      ctx.fillStyle = rgba(C.gutter, 1);
      ctx.fillRect(0, 0, GRID_LEFT, h);
      ctx.strokeStyle = rgba(C.grid, 1);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(GRID_LEFT + 0.5, 0); ctx.lineTo(GRID_LEFT + 0.5, h); ctx.stroke();

      // Time gridlines + axis labels; remember x positions for the ribbon.
      const tickXs = [];
      ctx.font = '10px "Segoe UI", sans-serif';
      const winSec = win / 1000;
      const stepSec = winSec > 40 ? 10 : winSec > 15 ? 5 : winSec > 6 ? 2 : 1;
      for (let ago = 0; ago * 1000 <= win; ago += stepSec) {
        const t = end - ago * 1000;
        const x = xOf(t, start, win, w);
        tickXs.push(x);
        if (ago > 0) {
          ctx.strokeStyle = rgba(C.grid, 0.55);
          ctx.lineWidth = 0.6;
          ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.moveTo(x, GRID_TOP); ctx.lineTo(x, plb); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = rgba(C.label, 1);
        ctx.textAlign = ago === 0 ? 'right' : x < GRID_LEFT + 20 ? 'left' : 'center';
        const label = ago === 0 ? 'এখন' : '−' + toBn(ago) + 'সে';
        ctx.fillText(label, ago === 0 ? plotRight : x < GRID_LEFT + 20 ? GRID_LEFT + 1 : x, plb + 14);
      }
      ctx.strokeStyle = rgba(C.gridActive, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(GRID_LEFT, plb + 0.5); ctx.lineTo(plotRight, plb + 0.5); ctx.stroke();
      ctx.fillStyle = rgba(C.label, 0.85);
      ctx.font = '9.5px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('সময় →', 6, plb + 14);

      // ---- Cents deviation ribbon ----
      ctx.fillStyle = rgba(C.ribbon, 0.75);
      ctx.fillRect(GRID_LEFT, rt, plotW(w), RIBBON_H);
      ctx.strokeStyle = rgba(C.grid, 1);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(GRID_LEFT, rt + 0.5); ctx.lineTo(plotRight, rt + 0.5); ctx.stroke();
      // ±tolerance band around zero.
      const tolHalf = (Math.min(targetTolerance, CENTS_MAX) / CENTS_MAX) * (RIBBON_H / 2 - 6);
      ctx.fillStyle = rgba(C.target, 0.13);
      ctx.fillRect(GRID_LEFT, zero - tolHalf, plotW(w), tolHalf * 2);
      // Horizontal guides: ±50 / ±25 / 0.
      const guides = [
        { c: CENTS_MAX, dash: [], a: 0.5 },
        { c: 25, dash: [2, 4], a: 0.4 },
        { c: 0, dash: [5, 3], a: 0.95 },
        { c: -25, dash: [2, 4], a: 0.4 },
        { c: -CENTS_MAX, dash: [], a: 0.5 }
      ];
      for (const g of guides) {
        const gy = centY(g.c, h);
        ctx.strokeStyle = rgba(g.c === 0 ? C.target : C.grid, g.a);
        ctx.lineWidth = g.c === 0 ? 1.2 : 0.8;
        ctx.setLineDash(g.dash);
        ctx.beginPath(); ctx.moveTo(GRID_LEFT, gy); ctx.lineTo(plotRight, gy); ctx.stroke();
        ctx.setLineDash([]);
      }
      // Ribbon gutter labels.
      ctx.font = '9px "Segoe UI", sans-serif';
      ctx.fillStyle = rgba(C.label, 0.95);
      ctx.textAlign = 'right';
      ctx.fillText('+' + toBn(CENTS_MAX), GRID_LEFT - 7, centY(CENTS_MAX, h) + 3);
      ctx.fillText(signedBn(0), GRID_LEFT - 7, zero + 3);
      ctx.fillText('−' + toBn(CENTS_MAX), GRID_LEFT - 7, centY(-CENTS_MAX, h) + 3);
      ctx.font = 'bold 9.5px "Segoe UI", sans-serif';
      ctx.fillStyle = rgba(C.line, 1);
      ctx.textAlign = 'left';
      ctx.fillText('সেন্ট', 6, rt + 11);
      // Faint vertical ticks inside the ribbon.
      ctx.strokeStyle = rgba(C.grid, 0.45);
      ctx.lineWidth = 0.6;
      ctx.setLineDash([2, 4]);
      for (const x of tickXs) {
        ctx.beginPath(); ctx.moveTo(x, rt); ctx.lineTo(x, rb); ctx.stroke();
      }
      ctx.setLineDash([]);
      // Ribbon area + line, same runs and grading as the main trail.
      ctx.save();
      ctx.beginPath(); ctx.rect(GRID_LEFT, rt, plotW(w), RIBBON_H); ctx.clip();
      for (const r of runs) {
        if (r.length < 2) continue;
        const pts = r.map((p) => ({ x: p.x, y: centY(p.s.cents, h), q: qualityOf(p.s) }));
        for (let i = 1; i < pts.length; i++) {
          ctx.fillStyle = rgba(qualityColor(pts[i].q), 0.2);
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, zero);
          ctx.lineTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[i].x, zero);
          ctx.closePath(); ctx.fill();
        }
        ctx.lineWidth = 1.9;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i < pts.length; i++) {
          ctx.strokeStyle = rgba(qualityColor(pts[i].q), 0.92);
          ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
        }
      }
      ctx.restore();

      // ---- Full note ladder (fixed gutter) + semitone grid ----
      const activeRaga = (window.pitchDetector && window.pitchDetector.activeRaga) || null;
      const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
      for (let m = rowTop; m <= rowBot; m++) {
        const idx = ((m - baseMidi) % 12 + 12) % 12;
        const pc = ((m % 12) + 12) % 12;
        const isSa = idx === 0;
        const y = yOf(m, lo, hi, h);
        const allowed = activeRaga && activeRaga.allowedIntervals
          ? activeRaga.allowedIntervals.includes(idx) : null;
        const inScale = allowed == null ? [0, 2, 4, 5, 7, 9, 11].includes(idx) : allowed;
        // Gutter row: white keys light, black keys tinted like a keyboard.
        const rowTopY = yOf(m + 0.5, lo, hi, h);
        const rowH = Math.max(1, yOf(m - 0.5, lo, hi, h) - rowTopY);
        ctx.fillStyle = WHITE_PCS.has(pc) ? rgba(C.gutter, 1) : rgba(C.cardText, 0.10);
        ctx.fillRect(0, rowTopY, GRID_LEFT, rowH);
        ctx.strokeStyle = isSa ? rgba(C.line, 0.55) : inScale ? rgba(C.gridActive, 0.85) : rgba(C.grid, 0.6);
        ctx.lineWidth = isSa ? 1.4 : inScale ? 1 : 0.7;
        if (!inScale && allowed != null) ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(GRID_LEFT, y); ctx.lineTo(plotRight, y); ctx.stroke();
        ctx.setLineDash([]);
        const rel = m - baseMidi;
        const saptak = rel <= -12 ? 'মন্দ্র ' : rel >= 12 ? 'তারা ' : '';
        const sargam = idx === 0 && rel >= 12 ? 'সাঁ' : SARGAM_SHORT[idx];
        const primary = notationMode === 'western' ? westernName(m)
          : notationMode === 'solfege' ? (window.Swara ? window.Swara.solfegeOf(idx) : sargam)
          : (isSa ? saptak : '') + sargam;
        const secondary = notationMode === 'western' ? saptak + sargam : westernName(m);
        if (isSa) {
          ctx.fillStyle = rgba(C.line, 1);
          ctx.beginPath(); ctx.arc(8, y, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = isSa ? rgba(C.line, 1) : inScale ? rgba(C.cardText, 0.92) : rgba(C.label, 0.55);
        ctx.font = (isSa ? 'bold 10px' : inScale ? '600 9.5px' : '9.5px') + ' "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(primary, 14, y + 3.5);
        ctx.fillStyle = inScale ? rgba(C.label, 0.95) : rgba(C.label, 0.5);
        ctx.font = '8.5px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(secondary, GRID_LEFT - 6, y + 3);
        ctx.textAlign = 'left';
      }

      // ---- Stepped target history ----
      const targetSegs = [];
      for (let i = 0; i < targetEvents.length; i++) {
        const e = targetEvents[i];
        const nextT = i + 1 < targetEvents.length ? targetEvents[i + 1].t : end;
        const from = Math.max(start, e.t);
        const to = Math.min(end, nextT);
        if (to > from && e.midi != null) {
          targetSegs.push({ x1: xOf(from, start, win, w), x2: xOf(to, start, win, w), midi: e.midi, tol: e.tol || 12 });
        }
      }
      for (const seg of targetSegs) {
        const ty = clamp(yOf(seg.midi, lo, hi, h), GRID_TOP, plb);
        const usable = Math.max(1, plb - GRID_TOP);
        const bandPx = Math.max(3, (2 * seg.tol / 100) * (usable / (hi - lo)));
        const grad = ctx.createLinearGradient(0, ty - bandPx / 2, 0, ty + bandPx / 2);
        grad.addColorStop(0, rgba(C.target, 0));
        grad.addColorStop(0.5, rgba(C.target, 0.16));
        grad.addColorStop(1, rgba(C.target, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(seg.x1, ty - bandPx / 2, Math.max(1, seg.x2 - seg.x1), bandPx);
        ctx.strokeStyle = rgba(C.target, 0.85);
        ctx.lineWidth = 1.3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(seg.x1, ty); ctx.lineTo(seg.x2, ty); ctx.stroke();
        ctx.setLineDash([]);
        // Step riser between consecutive targets.
        if (seg !== targetSegs[targetSegs.length - 1]) {
          ctx.strokeStyle = rgba(C.target, 0.45);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(seg.x2, ty); ctx.lineTo(seg.x2, ty + 6); ctx.stroke();
        }
      }
      if (targetMidi != null) {
        const ty = clamp(yOf(targetMidi, lo, hi, h), GRID_TOP, plb);
        // Sits below the line; the live-head pill sits above it, so they never overlap.
        pill(plotRight - 118, ty + 8,
          'লক্ষ্য ' + sargamOf(targetMidi).replace(/^(মন্দ্র|মধ্য|তারা) /, '') + ' ±' + toBn(targetTolerance) + ' সেন্ট',
          { bg: C.target, bgA: 0.92, fg: parseColor('#ffffff'), size: 10, bold: true, minY: GRID_TOP, maxY: plb });
      }

      // "Now" edge line.
      if (frozenEnd == null) {
        ctx.strokeStyle = rgba(C.target, 0.35);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(plotRight - 0.5, GRID_TOP); ctx.lineTo(plotRight - 0.5, plb); ctx.stroke();
        ctx.setLineDash([]);
      }

      // ---- Main trail ----
      ctx.save();
      ctx.beginPath(); ctx.rect(GRID_LEFT, GRID_TOP - 2, plotW(w), plb - GRID_TOP + 4); ctx.clip();
      for (const r of runs) {
        if (r.length < 2) continue;
        ctx.beginPath();
        smoothPath(r);
        ctx.lineTo(r[r.length - 1].x, plb);
        ctx.lineTo(r[0].x, plb);
        ctx.closePath();
        const wash = ctx.createLinearGradient(0, GRID_TOP, 0, plb);
        wash.addColorStop(0, rgba(C.line, 0.10));
        wash.addColorStop(1, rgba(C.line, 0.01));
        ctx.fillStyle = wash;
        ctx.fill();
        let seg = [r[0]];
        let segQ = qualityOf(r[0].s);
        const strokeSeg = () => {
          if (seg.length < 2) return;
          const col = qualityColor(segQ);
          const fade = ctx.createLinearGradient(GRID_LEFT, 0, plotRight, 0);
          fade.addColorStop(0, rgba(col, 0.22));
          fade.addColorStop(0.55, rgba(col, 0.75));
          fade.addColorStop(1, rgba(col, 1));
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); smoothPath(seg);
          ctx.strokeStyle = fade; ctx.globalAlpha = 0.16; ctx.lineWidth = 6.5; ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.beginPath(); smoothPath(seg);
          ctx.strokeStyle = fade; ctx.lineWidth = 2.7; ctx.stroke();
        };
        for (let i = 1; i < r.length; i++) {
          const q = qualityOf(r[i].s);
          seg.push(r[i]);
          if (q !== segQ) { strokeSeg(); seg = [r[i]]; segQ = q; }
        }
        strokeSeg();
      }

      // Stable-note hold labels, with anti-overlap.
      if (showHolds) {
        const holds = [];
        for (const r of runs) {
          let cur = null;
          const finish = () => {
            if (cur && cur.count >= 4 && cur.lastT - cur.firstT >= 550) holds.push(cur);
          };
          for (const p of r) {
            const note = Math.round(p.s.midi);
            if (!cur || cur.note !== note || p.s.t - cur.lastT > GAP_MS) {
              finish();
              cur = { note, firstT: p.s.t, lastT: p.s.t, firstX: p.x, lastX: p.x, count: 1, ySum: p.y };
            } else {
              cur.lastT = p.s.t; cur.lastX = p.x; cur.count++; cur.ySum += p.y;
            }
          }
          finish();
        }
        holds.sort((a, b) => a.firstX - b.firstX);
        let lastLabelX = -Infinity;
        let shown = 0;
        for (const hd of holds) {
          if (shown >= 6) break;
          const cx = (hd.firstX + hd.lastX) / 2;
          if (cx - lastLabelX < 78) continue;
          const dur = (hd.lastT - hd.firstT) / 1000;
          const txt = primaryLabel(hd.note) + ' · ' + toBn(dur.toFixed(1)) + 'সে';
          const box = pill(cx - 24, hd.ySum / hd.count - 24, txt, {
            bg: C.cardBg, bgA: 0.92, fg: C.cardSub, border: C.cardBorder, borderA: 1,
            size: 9.5, minX: GRID_LEFT + 2, maxX: plotRight, minY: GRID_TOP + 2, maxY: plb
          });
          lastLabelX = box.x + box.w;
          shown++;
        }
      }

      // Live head: ring + dot + note pill.
      const last = voiced[voiced.length - 1];
      if (last) {
        const col = qualityColor(qualityOf(last.s));
        if (frozenEnd == null && !reduceMotion) {
          const pulse = 8 + Math.sin(Date.now() / 320) * 1.8;
          ctx.strokeStyle = rgba(col, 0.35);
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(last.x, last.y, pulse, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = rgba(col, 1);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(last.x, last.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (!hover) {
          const hq = qualityOf(last.s);
          const verdict = hq === 0 ? '✓ সঠিক' : hq === 1 ? '≈ কাছে' : '✗ বেঠিক';
          const headText = verdict + ' · ' + sargamOf(last.s.midi) + ' ' + westernName(Math.round(last.s.midi)) + ' ' + signedBn(last.s.cents) + ' সেন্ট';
          pill(Math.min(last.x + 10, plotRight - 200), last.y - 26, headText,
            { bg: C.cardBg, bgA: 0.96, fg: C.cardText, border: col, borderA: 0.9,
              size: 10, bold: true, minY: GRID_TOP, maxY: plb });
        }
      }
      ctx.restore();

      // Hover crosshair spans both panels.
      if (hover && hover.s && hover.s.midi != null) {
        const hx = xOf(hover.s.t, start, win, w);
        const hy = yOf(hover.s.midi, lo, hi, h);
        ctx.strokeStyle = rgba(C.label, 0.45);
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(hx, GRID_TOP); ctx.lineTo(hx, rb); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(GRID_LEFT, hy); ctx.lineTo(plotRight, hy); ctx.stroke();
        ctx.setLineDash([]);
        const qc = qualityColor(qualityOf(hover.s));
        ctx.fillStyle = rgba(qc, 1);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(hx, centY(hover.s.cents, h), 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const agoSec = Math.max(0, Math.round((end - hover.s.t) / 1000));
        const tip = sargamOf(hover.s.midi) + ' ' + westernName(Math.round(hover.s.midi)) + ' • ' +
          signedBn(hover.s.cents) + ' সেন্ট • ' + (agoSec === 0 ? 'এখন' : toBn(agoSec) + 'সে আগে');
        pill(hx + 10, hy - 28, tip,
          { bg: C.cardBg, bgA: 0.97, fg: C.cardText, border: C.cardBorder, borderA: 1, size: 10 });
      }

      // Legend.
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

      // Stats card.
      const st = stats();
      if (st) {
        const lines = [
          { t: 'নিখুঁত ' + toBn(st.accuracy) + '%', bold: true },
          { t: 'নমুনা ' + toBn(st.count) + ' • সময় ' + toBn(st.spanSec) + 'সে' },
          { t: 'বিচ্যুতি ' + signedBn(st.minCents) + '…' + signedBn(st.maxCents) + ' • σ ' + toBn(st.stdCents) + ' সেন্ট' }
        ];
        const tw = Math.max(...lines.map((l) => {
          ctx.font = (l.bold ? 'bold 11px' : '10px') + ' "Segoe UI", sans-serif';
          return ctx.measureText(l.t).width;
        }));
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

      if (frozenEnd != null) {
        pill(GRID_LEFT + 8, GRID_TOP + 16, 'রেওয়াজ বন্ধ — শেষের ট্রেইল',
          { bg: parseColor('#292723'), bgA: 0.82, fg: parseColor('#ffffff'), size: 10.5, bold: true });
      }

      if (!voiced.length) {
        const cx = (GRID_LEFT + plotRight) / 2;
        const cy = (GRID_TOP + plb) / 2;
        ctx.fillStyle = rgba(C.line, 0.16);
        ctx.font = '34px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♪', cx, cy - 8);
        ctx.fillStyle = rgba(C.label, 1);
        ctx.font = '12.5px "Segoe UI", sans-serif';
        ctx.fillText('মাইক্রোফোন চালু করে গাইলে এখানে সুরের রেখা ফুটে উঠবে', cx, cy + 16);
        ctx.font = '10.5px "Segoe UI", sans-serif';
        ctx.fillStyle = rgba(C.label, 0.75);
        ctx.fillText('উপরে স্বরের রেখা • নিচে সেন্ট-বিচ্যুতি • সবুজ = সঠিক সুর', cx, cy + 34);
        ctx.textAlign = 'left';
      }
    }

    function loop() {
      if (!running || hidden) return;
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
      if (typeof opts.onStop === 'function') { try { opts.onStop(); } catch (_) {} }
    }

    // Pointer: hover readout, drag pan, pinch zoom (touch), wheel zoom, dblclick reset.
    function pointerPos(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    canvas.addEventListener('pointermove', (e) => {
      const pos = pointerPos(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, pos.x);
      if (pointers.size >= 2) {
        const xs = [...pointers.values()];
        const d = Math.abs(xs[0] - xs[1]);
        if (pinchDist > 4) {
          view.zoom = clamp(pinchZoom * (d / pinchDist), 1, 8);
          if (view.zoom === 1) view.pan = 0;
          draw();
        }
        return;
      }
      if (dragging) {
        const dx = pos.x - lastX;
        lastX = pos.x;
        const span = plotW(cssW());
        view.pan = clamp(view.pan - dx * (windowMs() / span), 0, HISTORY_MS - windowMs());
        draw();
        return;
      }
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
      const x = pointerPos(e).x;
      pointers.set(e.pointerId, x);
      if (pointers.size === 1) {
        dragging = true;
        lastX = x;
        canvas.classList.add('dragging');
      } else if (pointers.size === 2) {
        dragging = false;
        const xs = [...pointers.values()];
        pinchDist = Math.abs(xs[0] - xs[1]);
        pinchZoom = view.zoom;
      }
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
    });
    const endPointer = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 1) {
        dragging = true;
        lastX = [...pointers.values()][0];
      } else if (pointers.size === 0) {
        dragging = false;
        canvas.classList.remove('dragging');
        pinchDist = 0;
      }
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', () => { hover = null; if (!running) draw(); });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      view.zoom = clamp(view.zoom * (e.deltaY < 0 ? 1.2 : 0.83), 1, 8);
      if (view.zoom === 1) view.pan = 0;
      draw();
    }, { passive: false });
    canvas.addEventListener('dblclick', () => resetView());
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      hidden = document.hidden;
      if (hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      } else if (running && !raf) {
        loop();
      }
    });
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => { refreshColors(true); draw(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    }

    return {
      push, setTarget, setBaseMidi, setNotation, setWindow, resetView, setHolds, exportPNG,
      describe, start, stop, clear, resize, draw, stats,
      history: () => history.slice(),
      targetHistory: () => targetEvents.slice(),
      baseMidi: () => baseMidi,
      notation: () => notationMode,
      isLive: () => running
    };
  }

  root.PitchTrail = { create: createPitchTrail };
})(typeof window !== 'undefined' ? window : globalThis);
