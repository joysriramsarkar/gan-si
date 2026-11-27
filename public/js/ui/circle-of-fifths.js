/**
 * Circle of Fifths UI — muted.io interactive chart adaptation.
 * Click a key to select tonic, play its triad, see sig + diatonic chords.
 */
(function (root) {
  function noteFreq(midi) {
    const e = root.audioEngine;
    if (!e) return 440;
    return e.baseFreqA4 * Math.pow(2, (midi - 69) / 12);
  }
  function playNotes(midis, { arpeggiate = false } = {}) {
    const e = root.audioEngine;
    if (!e) return;
    midis.forEach((m, i) => {
      const key = `cof-${m}`;
      const start = arpeggiate ? i * 90 : 0;
      setTimeout(() => {
        e.playHarmoniumNote(noteFreq(m), key);
        setTimeout(() => e.stopHarmoniumNote(key), 950);
      }, start);
    });
  }
  function sargamForPc(pc) {
    const off = root.audioEngine ? root.audioEngine.rootOffset : 10;
    const idx = (((pc - off) % 12) + 12) % 12;
    return root.Swara ? root.Swara.SARGAM_SHORT[idx] : '';
  }

  function bindUI() {
    const wrap = document.getElementById('circleSvgWrap');
    const modeSel = document.getElementById('circleModeSel');
    const infoEl = document.getElementById('circleInfo');
    const scaleBtn = document.getElementById('circlePlayScaleBtn');
    if (!wrap) return;

    const F = root.CircleFifths;
    const C = root.Chords;
    if (!F) return;

    let selectedPc = 0; // C

    function svgEl(name, attrs) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', name);
      Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    }

    function renderCircle() {
      const mode = modeSel ? modeSel.value : 'major';
      const entries = F.circleEntries(mode);
      wrap.innerHTML = '';
      const svg = svgEl('svg', { viewBox: '0 0 320 320', width: '100%', style: 'max-width:340px;display:block;margin:0 auto;' });
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Circle of Fifths');
      const CX = 160, CY = 160;
      // outer circle steps
      entries.forEach((en) => {
        const ang = (en.step * 30 - 90) * Math.PI / 180;
        const x = CX + Math.cos(ang) * 118;
        const y = CY + Math.sin(ang) * 118;
        const selected = en.pc === selectedPc;
        const circle = svgEl('circle', {
          cx: x, cy: y, r: selected ? 26 : 23,
          fill: selected ? 'var(--primary)' : 'var(--bg-card-subtle)',
          stroke: selected ? 'var(--primary)' : 'var(--border-color)',
          style: 'cursor:pointer;',
        });
        circle.addEventListener('click', () => selectPc(en.pc));
        const label = svgEl('text', { x, y, 'text-anchor': 'middle', dy: '0.35em', 'font-size': '12', 'font-weight': '700', fill: selected ? '#0b0f17' : 'var(--text-main)' });
        const displayName = mode === 'minor' ? (en.relativePc != null ? F.NOTE_NAMES[en.relativePc] + 'm' : en.name + 'm') : en.name;
        label.textContent = displayName;
        svg.appendChild(circle);
        svg.appendChild(label);
        // sargam tiny label inside outer margin? keep for selected only
        if (selected) {
          const s = svgEl('text', { x, y: y + 14, 'text-anchor': 'middle', 'font-size': '8', fill: '#0b0f17' });
          s.textContent = sargamForPc(en.pc);
          svg.appendChild(s);
        }
      });
      // center label
      const center = svgEl('text', { x: CX, y: CY - 6, 'text-anchor': 'middle', 'font-size': '16', 'font-weight': '800', fill: 'var(--text-main)' });
      const tonicName = F.NOTE_NAMES[selectedPc];
      center.textContent = mode === 'minor' ? tonicName + ' মাইনর' : tonicName + ' মেজর';
      const center2 = svgEl('text', { x: CX, y: CY + 12, 'text-anchor': 'middle', 'font-size': '11', fill: 'var(--text-muted)' });
      const sig = F.keySignature(selectedPc, mode);
      center2.textContent = `${sig.label} · ${sargamForPc(selectedPc)}`;
      svg.appendChild(center);
      svg.appendChild(center2);
      wrap.appendChild(svg);
      renderInfo();
    }

    function renderInfo() {
      if (!infoEl) return;
      const mode = modeSel ? modeSel.value : 'major';
      const sig = F.keySignature(selectedPc, mode);
      const rel = F.relativeKey(selectedPc, mode);
      const relName = F.NOTE_NAMES[rel.pc] + (rel.mode === 'minor' ? ' মাইনর' : ' মেজর');
      let html = `<strong>${F.NOTE_NAMES[selectedPc]} ${mode === 'minor' ? 'মাইনর' : 'মেজর'}</strong> · সা-তুলনা: <strong>${sargamForPc(selectedPc)}</strong> · কী সিগনেচার: <strong>${sig.label} (${sig.en})</strong> · আপেক্ষিক কী: <strong>${relName} (${sargamForPc(rel.pc)})</strong>`;
      if (root.Chords) {
        const notes = root.Chords.getScaleNoteNames(selectedPc, mode);
        html += `<br>স্কেল নোট: <strong>${notes.join(' · ')}</strong> · সূত্র: ${root.CircleFifths.SCALE_FORMULAS[mode].steps.join('-')}`;
        const diat = root.Chords.diatonicChords(selectedPc, mode);
        html += `<br>ডায়াটনিক কর্ড: ${diat.map((d) => `${d.roman} ${d.name}`).join(' · ')}`;
      }
      html += '<br><span style="font-size:0.8rem;color:var(--text-muted);">ঘড়ির কাঁটার দিকে পরেরটা = শুদ্ধ ৫ম (P5) · ঠিক বিপরীতে = ট্রাইটোন · ৪ ঘর এগিয়ে = বৃহৎ ৩য়।</span>';
      infoEl.innerHTML = html;
    }

    function selectPc(pc) {
      selectedPc = pc;
      renderCircle();
      // play tonic triad
      if (root.Chords) {
        const mode = modeSel ? modeSel.value : 'major';
        const q = mode === 'minor' ? 'm' : 'maj';
        playNotes(root.Chords.chordMidiNotes(pc, q, 3), { arpeggiate: true });
      } else {
        playNotes([(3 + 1) * 12 + pc], {});
      }
    }

    function playScale() {
      if (!root.Chords) return;
      const mode = modeSel ? modeSel.value : 'major';
      const scale = root.Chords.getScaleNotes(selectedPc, mode);
      scale.forEach((pc, i) => {
        setTimeout(() => {
          const midi = (3 + 1) * 12 + pc + (i === 0 ? 0 : 0);
          playNotes([midi], {});
        }, i * 320);
      });
    }

    if (modeSel) modeSel.addEventListener('change', renderCircle);
    if (scaleBtn) scaleBtn.addEventListener('click', playScale);
    window.addEventListener('gansi:scalechange', renderCircle);
    renderCircle();
  }

  const api = { bindUI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CircleUI = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bindUI);
})(typeof window !== 'undefined' ? window : globalThis);
