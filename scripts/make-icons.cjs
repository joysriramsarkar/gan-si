// Minimal PWA icons: warm paper background + clay swara ring. No deps (zlib only).
const fs = require('fs');
const zlib = require('zlib');

function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (w * 4 + 1) + 1 + x * 4;
      // clay ring on warm paper
      const dx = (x - w / 2) / w, dy = (y - h / 2) / h;
      const d = Math.sqrt(dx * dx + dy * dy);
      let r = 245, g = 242, b = 236, a = 255;
      if (d > 0.30 && d < 0.38) { r = 164; g = 74; b = 42; }
      else if (d <= 0.30) { r = 243; g = 220; b = 210; }
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? 0 : 0, 0);
    // compute crc32 manually via zlib? use table
    return Buffer.concat([len, td, crc32buf(td)]);
  };
  const table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc32buf = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    const out = Buffer.alloc(4); out.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
    return out;
  };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const s of [192, 512]) {
  fs.writeFileSync(`public/icon-${s}.png`, png(s, s));
  console.log('wrote icon', s, fs.statSync(`public/icon-${s}.png`).size, 'bytes');
}
// Capacitor source assets (icon >=1024, splash 2732)
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/icon.png', png(1024, 1024));
fs.writeFileSync('assets/splash.png', png(2732, 2732));
console.log('wrote assets/icon.png + assets/splash.png');
