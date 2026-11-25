/* Gan-si microphone diagnostics.
   Privacy-first: this module never sends anything anywhere. It only reads
   browser permission/device state and turns getUserMedia failures into clear,
   actionable Bengali guidance so a silent session is never mistaken for a
   working one. */
(function (root) {
  const BN = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  function bn(v) {
    return String(v ?? '').replace(/[0-9]/g, (d) => BN[Number(d)]);
  }

  const PERMISSION_HINT = 'ঠিকানা বারের 🔒 আইকন → Site settings → Microphone → Allow করুন, তারপর পেজ রিলোড করুন।';

  /**
   * Translate a getUserMedia / audio error into an actionable Bengali message.
   * Exposed as GanSiMic.describe(err) for tests and all mic-start call sites.
   */
  function describe(err) {
    const name = String((err && (err.name || err.code)) || '');
    const message = String((err && err.message) || '');
    const all = (name + ' ' + message).toLowerCase();

    if (/notallowederror|permissiondeniederror|securityerror|permission denied|denied/.test(all)) {
      return 'মাইক্রোফোন অনুমতি বন্ধ আছে। ' + PERMISSION_HINT;
    }
    if (/notfounderror|devicesnotfounderror|overconstrainederror|requested device not found/.test(all)) {
      return 'কোনো মাইক্রোফোন পাওয়া যায়নি। ডিভাইস সংযুক্ত করুন বা সিস্টেমের ইনপুট নির্বাচন ঠিক করে আবার চেষ্টা করুন।';
    }
    if (/notreadableerror|trackstarterror|could not start|device in use/.test(all)) {
      return 'মাইক্রোফোন পড়া যাচ্ছে না — হয় অন্য অ্যাপ এটি ব্যবহার করছে, নয়তো হার্ডওয়্যার ব্যস্ত। অন্য অ্যাপ বন্ধ করে আবার চেষ্টা করুন।';
    }
    if (/aborterror|aborted/.test(all)) {
      return 'মাইক্রোফোন শুরু করা বাতিল হয়েছে। আবার চেষ্টা করুন।';
    }
    if (/typeerror|not a function/.test(all)) {
      return 'এই ব্রাউজারে মাইক্রোফোন API নেই। Chrome/Edge-এর সাম্প্রতিক সংস্করণ ব্যবহার করুন।';
    }
    return 'মাইক্রোফোন চালু করা যায়নি' + (message ? ': ' + message : '') + '। «মাইক যাচাই» বাটন চেপে বিস্তারিত দেখুন।';
  }

  /** Read-only(ish) self-test: permission + device list + a real short capture. */
  async function check() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { ok: false, permission: 'unsupported', deviceCount: 0, message: describe(new Error('getUserMedia unsupported')) };
    }
    let permission = 'unknown';
    try {
      permission = (await navigator.permissions.query({ name: 'microphone' })).state;
    } catch (_) { /* permissions API optional */ }

    let deviceCount = 0;
    try {
      deviceCount = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput').length;
    } catch (_) { /* enumeration may be blocked */ }

    if (permission === 'denied') {
      return { ok: false, permission, deviceCount, message: 'অনুমতি স্থায়ীভাবে বন্ধ (' + PERMISSION_HINT + ')' };
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
    } catch (err) {
      return { ok: false, permission, deviceCount, message: describe(err) };
    }
    const tracks = stream.getAudioTracks();
    const label = tracks.map((t) => t.label || 'মাইক্রোফোন').join(', ');
    const ready = tracks.length > 0 && tracks.every((t) => t.readyState === 'live');
    tracks.forEach((t) => t.stop()); // never keep the mic open after a check
    if (!ready) {
      return { ok: false, permission, deviceCount, message: 'মাইক্রোফোন ট্র্যাক পাওয়া গেলেও সেটি সক্রিয় নয়। ডিভাইস পুনরায় সংযুক্ত করুন।' };
    }
    return {
      ok: true,
      permission,
      deviceCount,
      message: 'মাইক্রোফোন কাজ করছে: ' + label + ' (' + bn(deviceCount || tracks.length) + 'টি ইনপুট)।'
    };
  }

  root.GanSiMic = { describe, check, bn };
})(typeof window !== 'undefined' ? window : globalThis);
