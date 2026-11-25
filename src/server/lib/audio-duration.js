/**
 * Real audio duration probing for upload enforcement (MAX_RECORDING_MIN).
 *
 * Supported: WAV (RIFF chunk math) and WebM/Matroska (EBML Segment→Info→
 * Duration × TimecodeScale). These are the two formats the app itself
 * produces (MediaRecorder → webm; WAV exports). For other accepted formats
 * (ogg/mp3/m4a) the duration is reported as null and the limit is enforced
 * only by the byte-size cap — documented honestly rather than guessed.
 */

function readVint(buf, off, keepMarker) {
  // EBML variable-length integer. Returns { value, length } or null.
  if (off >= buf.length) return null;
  const first = buf[off];
  if (first === 0) return null; // all-zero vint is invalid in practice
  // The canonical unknown-size encoding is eight 0xff bytes. It cannot be
  // inferred from the first byte alone (0xff is also a valid 1-byte size),
  // so recognize the complete marker before the normal length calculation.
  if (!keepMarker && first === 0xff && off + 8 <= buf.length &&
      buf[off + 1] === 0xff && buf[off + 2] === 0xff && buf[off + 3] === 0xff &&
      buf[off + 4] === 0xff && buf[off + 5] === 0xff && buf[off + 6] === 0xff && buf[off + 7] === 0xff) {
    return { value: Math.pow(2, 56), length: 8, unknown: true };
  }
  let len = 0;
  let mask = 0x80;
  while (mask && !(first & mask)) { mask >>= 1; len++; }
  len += 1; // total bytes of the vint
  if (off + len > buf.length) return null;
  let value = keepMarker ? first : first & (0xff >> len);
  for (let i = 1; i < len; i++) {
    value = value * 256 + buf[off + i];
  }
  return { value, length: len };
}

// Minimal, depth-limited EBML walk that finds the Segment→Info→Duration.
// MediaRecorder blobs keep Duration in the header segment info; when a live
// stream left it unwritten we return null instead of guessing.
function webmDurationSec(buf) {
  // Walk top-level elements looking for Segment (id 0x18538067).
  let off = 0;
  let guard = 0;
  while (off < buf.length && guard++ < 64) {
    const id = readVint(buf, off, true);
    if (!id) break;
    const size = readVint(buf, off + id.length, false);
    if (!size) break;
    const headerLen = id.length + size.length;
    const bodyOff = off + headerLen;
    // Unknown/unfinished size (all-ones): scan a bounded window for Info.
    const bodyLen = size.value < Math.pow(2, 56) ? size.value : Math.min(buf.length - bodyOff, 1 << 20);
    if (id.value === 0x18538067 && bodyLen > 0) {
      // Inside Segment, look for Info (0x1549a966) then Duration (0x4489) and
      // TimecodeScale (0x2ad7b1).
      let io = bodyOff;
      let iguard = 0;
      const end = Math.min(bodyOff + bodyLen, buf.length);
      let timecodeScale = null;
      let duration = null;
      while (io < end && iguard++ < 64) {
        const iid = readVint(buf, io, true);
        if (!iid) break;
        const isize = readVint(buf, io + iid.length, false);
        if (!isize) break;
        const ibody = io + iid.length + isize.length;
        const ilen = isize.value < Math.pow(2, 56) ? isize.value : Math.min(end - ibody, 1 << 16);
        if (iid.value === 0x1549a966) {
          // Parse children of Info.
          let co = ibody;
          const cend = Math.min(ibody + ilen, end);
          let cguard = 0;
          while (co < cend && cguard++ < 64) {
            const cid = readVint(buf, co, true);
            if (!cid) break;
            const csize = readVint(buf, co + cid.length, false);
            if (!csize) break;
            const cbody = co + cid.length + csize.length;
            const clen = csize.value < Math.pow(2, 56) ? csize.value : cend - cbody;
            if (cid.value === 0x2ad7b1 && clen > 0 && cbody + clen <= buf.length) {
              // TimecodeScale: unsigned int, default 1_000_000 ns.
              let scale = 0;
              for (let i = 0; i < clen; i++) scale = scale * 256 + buf[cbody + i];
              timecodeScale = scale;
            } else if (cid.value === 0x4489 && clen > 0 && cbody + clen <= buf.length) {
              // Duration: float (4 or 8 bytes) in timecodeScale units.
              if (clen === 4) {
                duration = buf.readFloatBE(cbody);
              } else if (clen === 8) {
                duration = buf.readDoubleBE(cbody);
              } else if (clen <= 8) {
                let v = 0;
                for (let i = 0; i < clen; i++) v = v * 256 + buf[cbody + i];
                duration = v;
              }
            }
            co = cbody + (clen >= 0 ? clen : 0);
            if (co <= cbody) break;
          }
          if (duration != null) {
            const scale = timecodeScale || 1000000;
            const sec = (duration * scale) / 1e9;
            if (Number.isFinite(sec) && sec >= 0) return sec;
            return null;
          }
        }
        if (ilen < 0) break;
        io = ibody + ilen;
      }
      return null;
    }
    if (bodyLen < 0) break;
    off = bodyOff + bodyLen;
    if (off <= bodyOff) break;
  }
  return null;
}

function wavDurationSec(buf) {
  // RIFF....WAVE, then chunks: "fmt " gives byte rate, "data" gives size.
  if (buf.length < 44 || buf.readUInt32BE(0) !== 0x52494646) return null; // 'RIFF'
  let off = 12;
  let byteRate = null;
  let dataSize = null;
  let guard = 0;
  while (off + 8 <= buf.length && guard++ < 64) {
    const id = buf.toString('latin1', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ' && off + 8 + Math.min(size, 16) <= buf.length) {
      const channels = buf.readUInt16LE(off + 10);
      const rate = buf.readUInt32LE(off + 12);
      const bits = buf.readUInt16LE(off + 22);
      if (rate > 0 && channels > 0 && bits > 0) byteRate = rate * channels * (bits / 8);
    } else if (id === 'data') {
      dataSize = size;
      break;
    }
    off += 8 + size + (size % 2); // chunks are word-aligned
  }
  if (byteRate && dataSize) return dataSize / byteRate;
  return null;
}

/**
 * Best-effort real duration of an uploaded audio buffer.
 * Returns seconds, or null when the container does not carry the answer.
 */
function probeDurationSec(buffer, mime) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  const m = String(mime || '').toLowerCase();
  if (m.includes('wav')) return wavDurationSec(buffer);
  if (m.includes('webm')) return webmDurationSec(buffer);
  return null;
}

module.exports = { probeDurationSec };
