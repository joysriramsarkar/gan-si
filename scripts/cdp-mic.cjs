// CDP mic test on emulator WebView (Node 24 global WebSocket, no deps).
const ADB = 'C:\\Users\\joysr\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const { execFileSync } = require('child_process');

function adb(...args) {
  return execFileSync(ADB, args, { encoding: 'utf8', timeout: 30000 });
}

(async () => {
  const pid = adb('shell', 'pidof', 'com.gansi.sursadhana').trim();
  if (!pid) throw new Error('app not running');
  console.log('PID', pid);
  try { adb('forward', '--remove', 'tcp:9222'); } catch {}
  console.log(adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`).trim());
  await new Promise(r => setTimeout(r, 1500));
  const pages = await (await fetch('http://127.0.0.1:9222/json')).json();
  const page = pages.find(p => p.type === 'page' && p.url.includes('localhost'));
  if (!page) throw new Error('webview page not found: ' + JSON.stringify(pages.map(p => p.url)));
  console.log('PAGE', page.url);

  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m);
  };
  const evalJs = (expr) => new Promise((resolve) => {
    const cur = ++id;
    pending.set(cur, resolve);
    ws.send(JSON.stringify({ id: cur, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  });

  console.log('clicking mic button...');
  console.log(JSON.stringify(await evalJs(`document.querySelector('#startMicBtn').click(); 'clicked'`)).slice(0, 200));
  await new Promise(r => setTimeout(r, 6000));
  const btn = await evalJs(`document.querySelector('#startMicBtn').textContent`);
  const listening = await evalJs(`String(window.pitchDetector && window.pitchDetector.isListening)`);
  const sargam = await evalJs(`document.querySelector('#sargamDisplay').textContent`);
  console.log('BTN:', JSON.stringify(btn).slice(0, 200));
  console.log('LISTENING:', JSON.stringify(listening).slice(0, 200));
  console.log('SARGAM:', JSON.stringify(sargam).slice(0, 200));
  ws.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
