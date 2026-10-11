/* KC Direkte Leitung (KC-RT-PROGRAMME, 11.10.2026)                                    Build 1.0.0
 *
 * Betreiber: "Hänge PC-Manager, Money Butler und dp2 an die Standleitung" – dieselbe direkte Leitung wie in der
 * Club-App (KC-CLUB-REALTIME). Das Programm hält eine offene Leitung zu Supabase Realtime (Broadcast, kostenlos) auf
 * einem nicht erratbaren Kanal. Darüber kommt nur ein SIGNAL ("geld", "zaehlung", "einstellungen", "dienstplan",
 * "abgleich") – nie Beträge, Namen oder Inhalte. Den Inhalt holt das Programm wie bisher über seinen gesicherten Weg.
 *
 * Grundregeln:
 *  - Den Kanalnamen liefert die Datenbank (kc_rt_programm_kanal) nur angemeldeten, berechtigten Benutzern.
 *    Ohne Kanal (nicht angemeldet, keine Berechtigung, offline) baut der Baustein keine Leitung auf – das Programm
 *    fragt dann wie früher selbst im Takt nach. Es geht nie etwas verloren.
 *  - Steht die Leitung, dürfen die Programme seltener selbst nachfragen (steht() liefert true).
 *  - Bricht sie ab: Neuverbinden mit wachsender Pause 1 s … 60 s; eine "stumme" Leitung (keine Antwort auf das
 *    Lebenszeichen) wird erkannt und neu aufgebaut. Nach jedem (Wieder-)Verbinden einmal nachholen().
 *  - Der Schlüssel unten ist der öffentliche Browser-Schlüssel (kein Geheimnis, steht auch in Club-App und Manager).
 *  - Kein Fremdcode, keine Bibliothek: einfaches WebSocket-Protokoll von Supabase Realtime (Phoenix, vsn 1.0.0).
 */
(function (global) {
  'use strict';
  const STANDARD = {
    url: 'wss://ptblnpiroqftcvlsrhac.supabase.co/realtime/v1/websocket',
    schluessel: 'sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24',
  };
  const HERZ_MS = 25000, STUMM_MS = 65000, WARTE_MAX_MS = 60000, OHNE_KANAL_MS = 5 * 60000;

  function starte(opt) {
    const o = Object.assign({ name: 'programm', url: STANDARD.url, schluessel: STANDARD.schluessel }, opt || {});
    const L = { ws: null, ok: false, ref: 0, herz: null, neu: null, warte: 1000, kanal: null, zu: false,
      zuletzt: 0, signale: 0, verbindungen: 0, letzterFehler: '', seit: null };
    const WS = o.WebSocket || global.WebSocket;
    const status = () => { try { o.beiStatus && o.beiStatus(zustand()); } catch (e) { /* Anzeige darf nie stören */ } };
    function zustand() {
      return { name: o.name, steht: L.ok, kanalBekannt: !!L.kanal, signale: L.signale, verbindungen: L.verbindungen,
        seit: L.seit, letzterFehler: L.letzterFehler };
    }
    function trennen() {
      L.zu = true; clearTimeout(L.neu); clearInterval(L.herz);
      const ws = L.ws; L.ws = null; const war = L.ok; L.ok = false; L.seit = null;
      try { ws && ws.close(); } catch (e) { /* egal */ }
      if (war) status();
    }
    function spaeter(ms) {
      clearTimeout(L.neu);
      L.neu = setTimeout(verbinden, ms != null ? ms : L.warte);
      if (ms == null) L.warte = Math.min(L.warte * 2, WARTE_MAX_MS);
    }
    async function verbinden() {
      if (typeof WS !== 'function') return;
      if (L.ws && L.ws.readyState <= 1) return; // steht schon / baut gerade auf
      let kanal = null;
      try { kanal = await o.kanalHolen(); } catch (e) { L.letzterFehler = String(e && e.message || e); }
      if (!kanal || typeof kanal !== 'string') { L.kanal = null; status(); return spaeter(OHNE_KANAL_MS); }
      trennen(); L.zu = false; L.kanal = kanal;
      let ws;
      try { ws = new WS(`${o.url}?apikey=${encodeURIComponent(o.schluessel)}&vsn=1.0.0`); } catch (e) { L.letzterFehler = 'WebSocket'; return spaeter(); }
      L.ws = ws; L.zuletzt = Date.now();
      const senden = (m) => { try { ws.send(JSON.stringify(Object.assign({}, m, { ref: String(++L.ref) }))); } catch (e) { /* egal */ } };
      ws.onopen = () => {
        senden({ topic: 'realtime:' + kanal, event: 'phx_join', payload: { config: { broadcast: { self: false }, presence: { key: '' }, private: false } } });
        clearInterval(L.herz);
        L.herz = setInterval(() => {
          // stumme Leitung: seit über einer Minute nichts gehört (auch keine Antwort auf das Lebenszeichen) → neu aufbauen
          if (Date.now() - L.zuletzt > STUMM_MS) { L.letzterFehler = 'stumm'; try { ws.close(); } catch (e) { /* egal */ } return; }
          senden({ topic: 'phoenix', event: 'heartbeat', payload: {} });
        }, HERZ_MS);
      };
      ws.onmessage = (e) => {
        L.zuletzt = Date.now();
        let d; try { d = JSON.parse(e.data); } catch (x) { return; }
        if (d.event === 'phx_reply' && d.topic === 'realtime:' + kanal && d.payload && d.payload.status === 'ok' && !L.ok) {
          L.ok = true; L.warte = 1000; L.verbindungen++; L.seit = new Date().toISOString(); L.letzterFehler = ''; status();
          try { o.nachholen && o.nachholen(); } catch (x) { /* egal */ }
        } else if (d.event === 'broadcast' && d.payload && d.payload.event === 'neu') {
          L.signale++;
          try { o.beiSignal && o.beiSignal(String((d.payload.payload || {}).art || '')); } catch (x) { /* egal */ }
        }
      };
      ws.onclose = () => {
        if (L.ws !== ws) return;
        const war = L.ok; L.ok = false; L.ws = null; L.seit = null; clearInterval(L.herz);
        if (war) status();
        if (!L.zu) spaeter();
      };
      ws.onerror = () => { L.letzterFehler = L.letzterFehler || 'Verbindungsfehler'; };
    }
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => { if (!document.hidden && !L.ok) { L.warte = 1000; spaeter(0); } });
    }
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('online', () => { if (!L.ok) { L.warte = 1000; spaeter(0); } });
    }
    spaeter(o.startNachMs != null ? o.startNachMs : 3000);
    return { steht: () => L.ok, zustand, neuVerbinden: () => { L.warte = 1000; trennen(); L.zu = false; spaeter(0); }, trennen };
  }

  global.KCDirekteLeitung = { version: '1.0.0', starte };
})(typeof window !== 'undefined' ? window : globalThis);
