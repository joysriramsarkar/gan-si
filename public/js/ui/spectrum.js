/**
 * Spectrum Analyzer — PitchDiagram spectrum adaptation (lightweight).
 * Draws log-scale FFT from pitchDetector.analyser when mic is live.
 * No extra mic stream; prompts to use the main mic.
 */
(function (root) {
  function bindUI() {
    const canvas = document.getElementById('spectrumCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const statusEl = document.getElementById('spectrumStatus');

    function resize() {
      const w = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
      canvas.width = Math.max(280, w || 480);
      canvas.height = 150;
    }
    try { resize(); } catch (_) {}
    window.addEventListener('resize', resize);

    const dataArray = new Uint8Array(1024);
    let raf = null;
    let peaks = [];

    function draw() {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0b0f17';
      ctx.fillRect(0, 0, w, h);
      // grid: log labels
      ctx.strokeStyle = 'rgba(148,163,184,0.18)';
      ctx.fillStyle = 'rgba(148,163,184,0.8)';
      ctx.font = '10px sans-serif';
      [100, 1000, 5000].forEach((f) => {
        const x = freqToX(f, w);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        ctx.fillText(String(f), x + 2, 12);
      });

      const pd = root.pitchDetector;
      const analyser = pd && pd.analyser;
      if (!analyser || !pd.isListening) {
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('মাইক চালু করলে এখানে স্পেকট্রাম দেখাবে', w / 2, h / 2);
        ctx.textAlign = 'left';
        if (statusEl) statusEl.textContent = 'মাইক বন্ধ — রেওয়াজ শুরু করলে স্পেকট্রাম দেখাবে';
        raf = requestAnimationFrame(draw);
        return;
      }
      if (statusEl) statusEl.textContent = 'স্পেকট্রাম চলছে — ১০ Hz – ২০ kHz';
      analyser.getByteFrequencyData(dataArray);
      const sampleRate = root.audioEngine && root.audioEngine.ctx ? root.audioEngine.ctx.sampleRate : 44100;
      const bins = dataArray.length;
      ctx.beginPath();
      ctx.moveTo(0, h);
      // average adjacent bins for smooth log curve
      const steps = 120;
      for (let i = 0; i <= steps; i++) {
        const f = 10 * Math.pow(2000, i / steps); // 10..20000
        const bin = Math.max(0, Math.min(bins - 1, Math.round(f / (sampleRate / 2) * bins)));
        const v = dataArray[bin] / 255;
        const x = (i / steps) * w;
        const y = h - v * (h - 18) - 4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(245,158,11,0.28)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,158,11,0.95)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // peak follows pitch (first strong peak approximated via lastPayload freq)
      if (pd.lastPayload && pd.lastPayload.freq) {
        const x = freqToX(pd.lastPayload.freq, w);
        ctx.strokeStyle = 'rgba(16,185,129,0.9)';
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        ctx.fillStyle = 'rgba(16,185,129,1)';
        ctx.fillText(pd.lastPayload.noteName + ' ' + pd.lastPayload.freq + ' Hz', Math.min(w - 90, x + 4), 22);
      }
      raf = requestAnimationFrame(draw);
    }

    function freqToX(f, w) {
      return (Math.log10(Math.max(10, f)) - 1) / (Math.log10(20000) - 1) * w;
    }

    if (!raf) raf = requestAnimationFrame(draw);
  }

  const api = { bindUI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SpectrumUI = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', bindUI);
})(typeof window !== 'undefined' ? window : globalThis);
