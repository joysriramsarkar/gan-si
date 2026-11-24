// CDP tanpura toggle on emulator WebView.
const ADB = 'C:\\Users\\joysr\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const { execFileSync } = require('child_process');
const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8', timeout: 30000 });

(async () => {
  const pid = adb('shell', 'pidof', 'com.gansi.sursadhana').trim();
  const pages = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = pages.find(p => p.type === 'page' && p.url.includes('localhost'));
  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m); };
  const evalJs = (expr) => new Promise((resolve) => {
    const cur = ++id; pending.set(cur, resolve);
    ws.send(JSON.stringify({ id: cur, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  });
  console.log(JSON.stringify(await evalJs(`document.querySelector('#startTanpuraBtn').click(); 'clicked'`)).slice(0, 120));
  await new Promise(r => setTimeout(r, 4000));
  console.log('TANPURA:', JSON.stringify(await evalJs(`String(window.audioEngine.isTanpuraPlaying)`)));
  console.log('BTN:', JSON.stringify(await evalJs(`document.querySelector('#startTanpuraBtn').textContent`)).slice(0, 160));
  // stop again
  await evalJs(`document.querySelector('#startTanpuraBtn').click()`);
  await new Promise(r => setTimeout(r, 1000));
  console.log('AFTER-STOP:', JSON.stringify(await evalJs(`String(window.audioEngine.isTanpuraPlaying)`)));
  ws.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
