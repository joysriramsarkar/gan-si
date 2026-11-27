/**
 * Tone Generator — PitchDiagram tone-generator adaptation.
 * Steady reference tone, note/frequency mode, waveform switch, faded start/stop.
 */
(function (root) {
  function bindUI() {
    const toggle = document.getElementById('toneToggleBtn');
    if (!toggle) return;
    const noteSel = document.getElementById('toneNoteSel');
    const octaveSel = document.getElementById('toneOctaveSel');
    const freqInput = document.getElementById('toneFreqInput');
    const modeSel = document.getElementById('toneModeSel');
    const waveSel = document.getElementById('toneWaveSel');
    const statusEl = document.getElementById('toneStatus');
    const saBtn = document.getElementById('toneSaBtn');

    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    if (noteSel) {
      noteSel.innerHTML = '';
      NOTE_NAMES.forEach((n, i) => {
        const o = document.createElement('option');
        o.value = String(i); o.textContent = n; noteSel.appendChild(o);
      });
      noteSel.value = '10'; // A# = default Sa
    }
    if (octaveSel) {
      octaveSel.innerHTML = '';
      ['2', '3', '4', '5'].forEach((v) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = `অক্টেভ ${v}`;
        octaveSel.appendChild(o);
      });
      octaveSel.value = '3';
    }
    if (waveSel) waveSel.value = 'sine';

    function currentFreq() {
      if (modeSel && modeSel.value === 'frequency' && freqInput) {
        const f = parseFloat(freqInput.value);
        if (Number.isFinite(f)) return Math.max(20, Math.min(4000, f));
      }
      const pc = noteSel ? parseInt(noteSel.value, 10) : 10;
      const oct = octaveSel ? parseInt(octaveSel.value, 10) : 3;
      const midi = (oct + 1) * 12 + pc;
      const base = (root.audioEngine && root.audioEngine.baseFreqA4) || 440;
      return base * Math.pow(2, (midi - 69) / 12);
    }

    function refreshStatus() {
      const f = currentFreq();
      const wave = waveSel ? waveSel.value : 'sine';
      const playing = root.audioEngine && root.audioEngine.isTonePlaying;
      if (statusEl) {
        const name = NOTE_NAMES[(noteSel ? parseInt(noteSel.value, 10) : 10) % 12] + (octaveSel ? octaveSel.value : 3);
        statusEl.textContent = playing
          ? `▶️ চলছে: ${f.toFixed(2)} Hz (${name}) · ${wave} — বন্ধ করতে বাটন চাপুন`
          : `⏹ বন্ধ · ${f.toFixed(2)} Hz (${name}) · ${wave}`;
      }
      toggle.innerHTML = playing
        ? '<svg class="icon" aria-hidden="true"><use href="/icons.svg#stop"></use></svg> টোন বন্ধ করুন'
        : '<svg class="icon" aria-hidden="true"><use href="/icons.svg#play"></use></svg> টোন চালু করুন';
      toggle.classList.toggle('btn-danger', !!playing);
      toggle.classList.toggle('btn-primary', !playing);
    }

    function applyLive() {
      const e = root.audioEngine;
      if (!e || !e.isTonePlaying) { refreshStatus(); return; }
      e.setToneFreq(currentFreq());
      if (waveSel) e.setToneWave(waveSel.value);
      refreshStatus();
    }

    toggle.addEventListener('click', () => {
      const e = root.audioEngine;
      if (!e) return;
      if (e.isTonePlaying) e.stopTone();
      else {
        if (modeSel && modeSel.value === 'frequency' && freqInput) {
          const f = parseFloat(freqInput.value);
          if (Number.isFinite(f)) freqInput.value = String(Math.max(20, Math.min(4000, f)));
        }
        e.startTone(currentFreq(), waveSel ? waveSel.value : 'sine');
      }
      refreshStatus();
    });

    if (saBtn) saBtn.addEventListener('click', () => {
      const off = root.audioEngine ? root.audioEngine.rootOffset : 10;
      if (noteSel) noteSel.value = String(off % 12);
      if (octaveSel) octaveSel.value = '3';
      applyLive();
    });
    [noteSel, octaveSel, freqInput, waveSel].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', applyLive);
      el.addEventListener('change', applyLive);
    });
    if (modeSel) modeSel.addEventListener('change', applyLive);
    window.addEventListener('gansi:a4change', applyLive);

    refreshStatus();
  }

  const api = { bindUI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ToneGeneratorUI = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bindUI);
})(typeof window !== 'undefined' ? window : globalThis);
