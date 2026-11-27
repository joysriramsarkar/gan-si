/**
 * Chord Explorer — muted.io Piano Chords + Chords-in-Keys adaptation.
 * Highlights keys on the harmonium keyboard; plays with audioEngine.
 * Aid only.
 */
(function (root) {
  function bindUI() {
    const rootSel = document.getElementById('chordRootSelect');
    if (!rootSel) return;
    const qualitySel = document.getElementById('chordQualitySelect');
    const octaveSel = document.getElementById('chordOctaveSelect');
    const arpChk = document.getElementById('chordArpChk');
    const playBtn = document.getElementById('chordPlayBtn');
    const infoEl = document.getElementById('chordInfo');
    const gridEl = document.getElementById('chordGrid');
    const diatonicKey = document.getElementById('diatonicKeySelect');
    const diatonicMode = document.getElementById('diatonicModeSelect');
    const diatonicEl = document.getElementById('diatonicChords');

    const C = root.Chords;
    if (!C) return;

    function midiFreq(midi) {
      const e = root.audioEngine;
      if (!e) return 440;
      return e.baseFreqA4 * Math.pow(2, (midi - 69) / 12);
    }

    function sargamForPc(pc) {
      const rootOff = root.audioEngine ? root.audioEngine.rootOffset : 10;
      const idx = (((pc - rootOff) % 12) + 12) % 12;
      return root.Swara ? root.Swara.SARGAM_SHORT[idx] : '';
    }

    function fillRootSelects() {
      const prevRoot = rootSel.value;
      const prevDiatonic = diatonicKey ? diatonicKey.value : null;
      const makeOptions = (sel) => {
        if (!sel) return;
        sel.innerHTML = '';
        C.NOTE_NAMES.forEach((n, pc) => {
          const o = document.createElement('option');
          o.value = String(pc);
          o.textContent = `${n} (${sargamForPc(pc)})`;
          sel.appendChild(o);
        });
      };
      makeOptions(rootSel);
      makeOptions(diatonicKey);
      if (rootSel) rootSel.value = prevRoot !== '' && prevRoot != null ? prevRoot : '0'; // C
      if (diatonicKey) diatonicKey.value = prevDiatonic != null && prevDiatonic !== '' ? prevDiatonic : '0';
      if (qualitySel) {
        qualitySel.innerHTML = '';
        C.CHORD_QUALITIES.forEach((q) => {
          const o = document.createElement('option');
          o.value = q.id;
          o.textContent = `${q.nameBn} — ${q.nameEn} (${q.symbol})`;
          qualitySel.appendChild(o);
        });
        qualitySel.value = 'maj';
      }
      if (octaveSel) {
        octaveSel.innerHTML = '';
        [['3', 'অক্টেভ ৩'], ['4', 'অক্টেভ ৪']].forEach(([v, l]) => {
          const o = document.createElement('option');
          o.value = v; o.textContent = l; octaveSel.appendChild(o);
        });
        octaveSel.value = '3';
      }
    }

    function currentRoot() { return parseInt(rootSel.value, 10); }
    function currentQuality() { return qualitySel.value || 'maj'; }
    function currentOctave() { return parseInt(octaveSel.value, 10); }

    function updateInfo() {
      const mids = C.chordMidiNotes(currentRoot(), currentQuality(), currentOctave());
      const names = mids.map((m) => C.NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1));
      const sargs = mids.map((m) => sargamForPc(m % 12));
      const q = C.getQuality(currentQuality());
      if (infoEl) {
        infoEl.textContent = `${C.chordName(currentRoot(), currentQuality())} — ${q ? q.nameEn : ''} · সুর: ${names.join(', ')} · স্বর: ${sargs.join(' ')} · সূত্র: ${q ? q.formula : ''}`;
      }
      document.querySelectorAll('#harmoniumKeyboard .piano-key').forEach((el) => {
        const midi = parseInt(el.dataset.midi, 10);
        el.classList.toggle('chord-highlight', mids.includes(midi));
      });
    }

    function playChord(midis, { arpeggiate = false, highlight = true } = {}) {
      const engine = root.audioEngine;
      if (!engine) return;
      if (highlight) {
        document.querySelectorAll('#harmoniumKeyboard .piano-key').forEach((el) => {
          el.classList.toggle('chord-highlight', midis.includes(parseInt(el.dataset.midi, 10)));
        });
        setTimeout(updateInfoClear, 1100);
      }
      midis.forEach((m, i) => {
        const key = `chord-${m}`;
        const start = arpeggiate ? i * 90 : 0;
        setTimeout(() => {
          engine.playHarmoniumNote(midiFreq(m), key);
          setTimeout(() => engine.stopHarmoniumNote(key), 900);
        }, start);
      });
    }

    function updateInfoClear() {
      if (!document.hidden) setTimeout(() => {
        document.querySelectorAll('#harmoniumKeyboard .piano-key').forEach((el) => el.classList.remove('chord-highlight'));
      }, 400);
    }

    function renderGrid() {
      if (!gridEl) return;
      gridEl.innerHTML = '';
      const r = currentRoot();
      const oct = currentOctave();
      C.CHORD_QUALITIES.forEach((q) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-outline chord-q-btn';
        b.dataset.q = q.id;
        b.textContent = `${C.chordName(r, q.id)} (${q.nameBn})`;
        b.setAttribute('aria-label', `${q.nameEn} শুনুন`);
        b.addEventListener('click', () => {
          qualitySel.value = q.id;
          updateInfo();
          playChord(C.chordMidiNotes(r, q.id, oct), { arpeggiate: arpChk && arpChk.checked });
        });
        gridEl.appendChild(b);
      });
    }

    function renderDiatonic() {
      if (!diatonicEl || !diatonicKey) return;
      const tonic = parseInt(diatonicKey.value, 10);
      const mode = diatonicMode ? diatonicMode.value : 'major';
      const list = C.diatonicChords(tonic, mode);
      const notes = C.getScaleNoteNames(tonic, mode);
      diatonicEl.innerHTML = '';
      const scaleLine = document.createElement('p');
      scaleLine.style.fontSize = '0.85rem';
      scaleLine.style.color = 'var(--text-muted)';
      scaleLine.textContent = `স্কেল: ${notes.join(' · ')} — প্রতিটি কর্ড ক্লিক করলে বাজবে`;
      diatonicEl.appendChild(scaleLine);
      const wrap = document.createElement('div');
      wrap.style.display = 'flex'; wrap.style.gap = '8px'; wrap.style.flexWrap = 'wrap';
      list.forEach((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-outline chord-q-btn';
        b.textContent = `${c.roman} — ${c.name}`;
        b.setAttribute('aria-label', `${c.name} শুনুন`);
        b.addEventListener('click', () => {
          const midis = C.chordMidiNotes(c.rootPc, c.quality, currentOctave());
          playChord(midis, {});
          if (infoEl) infoEl.textContent = `${c.roman} ${c.name} · সুর: ${C.chordNoteNames(c.rootPc, c.quality).join(', ')}`;
        });
        wrap.appendChild(b);
      });
      diatonicEl.appendChild(wrap);
    }

    if (playBtn) playBtn.addEventListener('click', () => {
      updateInfo();
      playChord(C.chordMidiNotes(currentRoot(), currentQuality(), currentOctave()), { arpeggiate: arpChk && arpChk.checked });
    });
    [rootSel, qualitySel, octaveSel].forEach((el) => el && el.addEventListener('change', () => { updateInfo(); renderGrid(); }));
    if (diatonicKey) diatonicKey.addEventListener('change', renderDiatonic);
    if (diatonicMode) diatonicMode.addEventListener('change', renderDiatonic);

    // Sargam comparisons follow the singer's Sa when it changes.
    window.addEventListener('gansi:scalechange', () => {
      const keepRoot = rootSel.value;
      const keepKey = diatonicKey ? diatonicKey.value : null;
      [rootSel, diatonicKey].forEach((sel) => {
        if (!sel) return;
        sel.innerHTML = '';
        C.NOTE_NAMES.forEach((n, pc) => {
          const o = document.createElement('option');
          o.value = String(pc);
          o.textContent = `${n} (${sargamForPc(pc)})`;
          sel.appendChild(o);
        });
      });
      rootSel.value = keepRoot;
      if (diatonicKey) diatonicKey.value = keepKey;
      updateInfo();
      renderGrid();
    });

    fillRootSelects();
    updateInfo();
    renderGrid();
    renderDiatonic();
  }

  const api = { bindUI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ChordExplorer = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bindUI);
})(typeof window !== 'undefined' ? window : globalThis);
