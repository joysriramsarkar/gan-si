/**
 * Raga Learning Mode v1 — Sa → Aroha → Avaroha → Pakad.
 * Pure controller: no DOM/audio dependencies. Targets use absolute MIDI so
 * low Sa and high Sa can never collapse into the same lesson step.
 * Pakad similarity is a practice aid, never an artistic verdict.
 */
(function (root) {
  const RagaEngine = typeof module !== 'undefined' && module.exports
    ? require('../music/raga-engine')
    : root.RagaEngine;

  const SWARAS = ['সা', 'রে♭', 'রে', 'গা♭', 'গা', 'মা', 'মা♯', 'পা', 'ধা♭', 'ধা', 'নি♭', 'নি'];
  const STAGE_META = {
    sa: { title: 'সা স্থাপন', direction: 'either' },
    aroha: { title: 'আরোহ', direction: 'aroha' },
    avaroha: { title: 'অবরোহ', direction: 'avaroha' },
    pakad: { title: 'পাকড়', direction: 'either' }
  };

  function labelFor(interval) {
    const n = ((interval % 12) + 12) % 12;
    return interval === 12 ? 'সাঁ' : SWARAS[n];
  }

  // Strict practice-phrase similarity: extra/missing/substituted swaras reduce
  // the score, unlike a pure subsequence match that can ignore wrong notes.
  function phraseSimilarity(a, b) {
    const left = (a || []).map(n => ((n % 12) + 12) % 12);
    const right = (b || []).map(n => ((n % 12) + 12) % 12);
    if (!right.length) return 0;
    const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
    for (let i = 0; i <= left.length; i++) dp[i][0] = i;
    for (let j = 0; j <= right.length; j++) dp[0][j] = j;
    for (let i = 1; i <= left.length; i++) {
      for (let j = 1; j <= right.length; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
        );
      }
    }
    return Math.max(0, Math.round((1 - dp[left.length][right.length] / Math.max(left.length, right.length)) * 100) / 100);
  }

  // Data intervals are Sa-relative pitch classes. Recover the intended octave
  // for ascending/descending scales (e.g. Yaman starts on lower Ni: 11 → 0).
  function absoluteIntervals(seq, direction) {
    const vals = (seq || []).map(Number).filter(Number.isFinite);
    if (!vals.length) return [];
    const out = [vals[0]];
    if ((direction === 'aroha' || direction === 'phrase') && vals.length > 1 && vals[0] - vals[1] > 6) out[0] -= 12;
    for (let i = 1; i < vals.length; i++) {
      let v = vals[i];
      if (direction === 'aroha') {
        while (v < out[i - 1]) v += 12;
      } else if (direction === 'avaroha') {
        while (v > out[i - 1]) v -= 12;
      }
      out.push(v);
    }
    return out;
  }

  function buildStages(raga, baseMidi) {
    const definitions = [
      ['sa', [0]],
      ['aroha', raga.aroha_intervals || []],
      ['avaroha', raga.avaroha_intervals || []],
      ['pakad', raga.pakad_intervals || []]
    ];
    return definitions.filter(([, seq]) => seq.length).map(([id, seq]) => {
      const meta = STAGE_META[id];
      const absolute = id === 'pakad' ? absoluteIntervals(seq, 'phrase') : absoluteIntervals(seq, meta.direction);
      return {
        id,
        title: meta.title,
        direction: meta.direction,
        targets: absolute.map((interval, index) => ({
          interval,
          midi: baseMidi + interval,
          label: labelFor(interval),
          index
        }))
      };
    });
  }

  function createSession(raga, { baseMidi = 48, holdMs = 300, midiTolerance = 0.65, centsTolerance = 12 } = {}) {
    if (!raga || !raga.id) throw new Error('raga is required');
    if (!Number.isFinite(baseMidi)) throw new Error('baseMidi must be finite');
    const safeHold = Math.max(0, Number(holdMs) || 0);
    const stages = buildStages(raga, baseMidi);
    const totalTargets = stages.reduce((n, s) => n + s.targets.length, 0);
    const session = {
      raga,
      baseMidi,
      holdMs: safeHold,
      midiTolerance,
      centsTolerance,
      stages,
      stageIndex: 0,
      targetIndex: 0,
      completed: 0,
      holdStart: null,
      startedAt: null,
      finishedAt: null,
      samples: 0,
      inTuneSamples: 0,
      sungSequence: [],
      pakadSequence: [],
      lastPakadInterval: null,
      lastResult: 'ready',
      lastMessage: '',
      current() {
        const stage = this.stages[this.stageIndex];
        const target = stage && stage.targets[this.targetIndex];
        return { stage, target };
      },
      progress() {
        return totalTargets ? Math.round((this.completed / totalTargets) * 100) : 0;
      },
      holdProgress(now = Date.now()) {
        if (this.holdStart == null || !this.holdMs) return 0;
        return Math.min(1, Math.max(0, (now - this.holdStart) / this.holdMs));
      },
      start(now = Date.now()) {
        if (this.startedAt != null) return this;
        this.startedAt = now;
        this.lastResult = 'started';
        return this;
      },
      feed({ midi, cents = 0, inTune = false, now = Date.now() } = {}) {
        if (this.finishedAt != null) return 'done';
        if (this.startedAt == null) this.start(now);
        const { stage, target } = this.current();
        if (!target) return 'done';
        if (!Number.isFinite(midi)) {
          this.holdStart = null;
          this.lastResult = 'reset';
          this.lastMessage = 'মাইক্রোফোনে সুরটি ধরুন…';
          return 'reset';
        }
        this.samples++;
        const octaveOk = Number.isFinite(midi) && Math.abs(midi - target.midi) <= this.midiTolerance;
        const tuneOk = inTune && Math.abs(Number(cents) || 0) <= this.centsTolerance;
        const rule = RagaEngine.validateNote({ sargamIndex: target.interval, direction: stage.direction, raga: this.raga });

        // Capture the actual stable phrase during Pakad, including wrong notes.
        // Accepted-target-only capture would always produce a misleading 100%.
        if (stage.id === 'pakad' && tuneOk && Number.isFinite(midi)) {
          const actual = ((Math.round(midi - this.baseMidi) % 12) + 12) % 12;
          if (actual !== this.lastPakadInterval) {
            this.pakadSequence.push(actual);
            this.lastPakadInterval = actual;
          }
        }

        if (octaveOk && tuneOk && rule.ok) {
          this.inTuneSamples++;
          if (this.holdStart == null) this.holdStart = now;
          if (now - this.holdStart >= this.holdMs) {
            this.sungSequence.push(target.interval % 12);
            const nextTarget = stage.targets[this.targetIndex + 1];
            this.lastPakadInterval = stage.id === 'pakad' && nextTarget && nextTarget.interval % 12 === target.interval % 12
              ? null
              : target.interval % 12;
            this.completed++;
            this.holdStart = null;
            this.targetIndex++;
            if (this.targetIndex >= stage.targets.length) {
              this.stageIndex++;
              this.targetIndex = 0;
              if (this.stageIndex >= this.stages.length) {
                this.finishedAt = now;
                this.lastResult = 'done';
                this.lastMessage = 'শিক্ষা-ক্রম সম্পন্ন — পাকড়ের মিল সহায়ক পরিমাপ, শিল্পের চূড়ান্ত বিচার নয়।';
                return 'done';
              }
              this.lastResult = 'stage-complete';
              this.lastMessage = `${stage.title} সম্পন্ন`;
              return 'stage-complete';
            }
            this.lastResult = 'advanced';
            this.lastMessage = '';
            return 'advanced';
          }
          this.lastResult = 'holding';
          return 'holding';
        }

        this.holdStart = null;
        this.lastResult = rule.ok ? (octaveOk ? 'reset' : 'wrong-octave') : 'apaswara';
        this.lastMessage = !rule.ok ? rule.msg : (!octaveOk ? 'সঠিক সপ্তক/অক্টেভে লক্ষ্যটি গান' : 'সুরটি আরও নিখুঁত করুন');
        return 'reset';
      },
      stop(reason = 'stopped', now = Date.now()) {
        if (this.finishedAt == null) this.finishedAt = now;
        this.holdStart = null;
        this.lastResult = reason;
        return this;
      },
      summary() {
        const pakadSimilarity = phraseSimilarity(this.pakadSequence, this.raga.pakad_intervals || []);
        return {
          raga_id: this.raga.id,
          completed: this.completed,
          total: totalTargets,
          progress: this.progress(),
          accuracy: this.samples ? Math.round((this.inTuneSamples / this.samples) * 100) : 0,
          elapsedMs: this.startedAt == null ? 0 : (this.finishedAt || Date.now()) - this.startedAt,
          pakadSimilarity,
          finished: this.finishedAt != null
        };
      }
    };
    return session;
  }

  const api = { createSession, absoluteIntervals, labelFor, phraseSimilarity, SWARAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RagaLearning = api;
})(typeof window !== 'undefined' ? window : globalThis);
