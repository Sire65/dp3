// Build 252 – direkte Leitung (KC-RT-PROGRAMME): ohne Anmeldung keine Leitung; mit Anmeldung Kanal "dp" erfragt,
// Adresse/Schlüssel aus der DP2-Supabase-Einstellung; Signal "abgleich" → sofort abgleichen (gebündelt, nie parallel).
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const lies = (p) => readFile(path.join(root, p), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
let fehler = 0; const pr = (n, b, z = '') => { if (!b) { fehler++; console.error(`FEHLER ${n} ${z}`); } };

async function umgebung({ token = 'tok-dp' } = {}) {
  const sockets = [], log = [];
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 0; this.gesendet = []; sockets.push(this); setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 5); }
    send(t) { this.gesendet.push(JSON.parse(t)); }
    close() { this.readyState = 3; setTimeout(() => this.onclose?.(), 1); }
    antworte(d) { this.onmessage?.({ data: JSON.stringify(d) }); }
  }
  const autoSync = { state: { inFlight: false }, runNow: () => { log.push('abgleich'); return Promise.resolve(); } };
  const K = {
    autoSync,
    supabaseConnection: {
      validateConfig: () => ({ url: 'https://beispiel.supabase.co', publishableKey: 'sb_publishable_TEST' }),
      hasAccessToken: () => !!token, ensureSession: async () => {}, sessionSnapshot: () => ({ access_token: token }),
    },
  };
  const win = { KCDP: K, WebSocket: FakeWS, addEventListener() {} };
  const ctx = { window: win, globalThis: win, document: { readyState: 'complete', addEventListener() {}, hidden: false }, AbortSignal,
    fetch: async (url, o) => { log.push(['fetch', url, JSON.parse(o.body).p_bereich, o.headers.Authorization, o.headers.apikey]); return { ok: true, json: async () => 'kc-rt-dp-test' }; },
    setTimeout, clearTimeout, setInterval, clearInterval, Promise, JSON, Date, String, Object, Math, encodeURIComponent, console };
  vm.createContext(ctx);
  vm.runInContext((await lies('src/core/kc-direkte-leitung.js')).replace('startNachMs != null ? o.startNachMs : 3000', 'startNachMs != null ? 0 : 0'), ctx);
  vm.runInContext((await lies('src/core/direkte-leitung-dp.js')).replace('startNachMs:4000', 'startNachMs:0'), ctx);
  return { K, sockets, log, autoSync };
}

{ const u = await umgebung({ token: '' }); await warte(60);
  pr('ohne Anmeldung keine Leitung', u.sockets.length === 0 && u.K.direkteLeitung && !u.K.direkteLeitung.steht()); }
const u = await umgebung(); await warte(60);
const f = u.log.find((x) => Array.isArray(x) && x[0] === 'fetch');
pr('Kanal "dp" mit eigenem Token an der eingestellten Adresse erfragt', !!f && f[1] === 'https://beispiel.supabase.co/rest/v1/rpc/kc_rt_programm_kanal' && f[2] === 'dp' && f[3] === 'Bearer tok-dp' && f[4] === 'sb_publishable_TEST', JSON.stringify(f));
const ws = u.sockets[0];
pr('Leitung zur eingestellten Realtime-Adresse', !!ws && ws.url.startsWith('wss://beispiel.supabase.co/realtime/v1/websocket?apikey=sb_publishable_TEST'), ws?.url);
ws.antworte({ event: 'phx_reply', topic: 'realtime:kc-rt-dp-test', payload: { status: 'ok' } });
pr('Leitung steht nach "ok"', u.K.direkteLeitung.steht());
await warte(1700); u.log.length = 0;
const signal = (art) => ws.antworte({ event: 'broadcast', topic: 'realtime:kc-rt-dp-test', payload: { event: 'neu', payload: { art } } });
signal('abgleich'); signal('abgleich'); signal('abgleich'); await warte(1700);
pr('drei Signale → einmal sofort abgleichen', u.log.filter((x) => x === 'abgleich').length === 1, JSON.stringify(u.log));
u.log.length = 0; u.autoSync.state.inFlight = true; signal('abgleich'); await warte(1700);
pr('läuft gerade ein Abgleich → nicht parallel starten', u.log.length === 0, JSON.stringify(u.log));
u.autoSync.state.inFlight = false; await warte(1700);
pr('danach wird nachgeholt', u.log.filter((x) => x === 'abgleich').length === 1, JSON.stringify(u.log));
u.log.length = 0; signal('geld'); await warte(1700);
pr('fremde Signalart löst keinen Abgleich aus', u.log.length === 0, JSON.stringify(u.log));
const html = await lies('index.html');
pr('index.html lädt Baustein und Anschluss nach auto-sync.js', html.indexOf('src/core/auto-sync.js') < html.indexOf('src/core/kc-direkte-leitung.js?v=0.20.0-b252') && html.includes('src/core/direkte-leitung-dp.js?v=0.20.0-b252'));
if (fehler) { console.error(`Direkte-Leitung-Smoke-Test: ${fehler} Fehler`); process.exit(1); }
console.log('Direkte-Leitung-Smoke-Test OK: Kanal nur mit Anmeldung, sofortiger Abgleich auf Signal, gebündelt und nie parallel');
process.exit(0); // Leitung hält Zeitgeber offen
