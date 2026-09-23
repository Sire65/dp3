// Sollplan-Bruecke zum PC-Manager (KC MarktKasse Suite).
//
// Baut aus dem aktuellen, veroeffentlichten Sollplan (K.shifts, layer='planned') einen
// Schnappschuss OHNE Klarnamen (nur personId) und schickt ihn ueber die Datenbankfunktion
// kc_dp_plan_publish an den Manager. Der Manager reicht ihn - mit Pseudonymen statt Klarnamen -
// an die Kassen weiter, wo alle Kollegen nachschauen koennen, wer wann kommt.
//
// AUSLOESUNG: haengt sich an den bestehenden Auto-Sync-Takt (siehe auto-sync.js) - kein neuer
// eigener Zeitgeber. Ein Fehlschlag hier darf den normalen Sync NICHT stoeren (try/catch dort).
(function () {
  'use strict';
  const K = (window.KCDP = window.KCDP || {});
  const VERSION = '0.2.0';
  const VORSCHAU_TAGE = 30;
  const INAKTIV = new Set(['cancelled', 'absent', 'failed', 'deleted']);
  const state = { lastPublishedAt: null, lastError: null, lastCount: null, eventId: null };

  function stunden2Uhrzeit(stunden) {
    const h = Math.max(0, Math.floor(Number(stunden) || 0));
    const m = Math.round(((Number(stunden) || 0) - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Der Weihnachtsmarkt wird in Europe/Berlin geplant. toISOString() waere rund um Mitternacht
  // ein UTC-Datum und kann dadurch fuer kurze Zeit den falschen Planungstag liefern.
  function datumInEventZeitzone(date = new Date()) {
    const teile = new Intl.DateTimeFormat('de-DE', {
      timeZone: K.eventConfig?.timezone || 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const wert = (typ) => teile.find((p) => p.type === typ)?.value;
    return `${wert('year')}-${wert('month')}-${wert('day')}`;
  }

  function verschiebeIso(iso, delta) {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  function heute() {
    return datumInEventZeitzone();
  }

  function baueZeilen() {
    const start = heute();
    const ende = verschiebeIso(start, VORSCHAU_TAGE);
    return (K.shifts || [])
      .filter((s) => s.layer === 'planned' && s.date >= start && s.date <= ende && !INAKTIV.has(s.status))
      .filter((s) => K.personPlanningAllowed ? K.personPlanningAllowed(s.personId) : true)
      .map((s) => ({
        sourceShiftId: s.id,
        personId: s.personId,
        date: s.date,
        start: stunden2Uhrzeit(s.start),
        end: stunden2Uhrzeit(s.end),
        breakMinutes: Number(s.breakMinutes || 0),
        zone: s.zone || null,
        area: s.area || null,
      }))
      // Deterministischer Snapshot: reine Reihenfolgeaenderungen im lokalen Modell duerfen beim
      // PC-Manager nicht wie eine fachliche Planaenderung aussehen.
      .sort((a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        String(a.start).localeCompare(String(b.start)) ||
        String(a.personId).localeCompare(String(b.personId)) ||
        String(a.sourceShiftId).localeCompare(String(b.sourceShiftId))
      );
  }

  async function veroeffentlicheJetzt() {
    if (!K.supabaseConnection?.publishPlan) throw new Error('Supabase-Verbindung nicht bereit.');
    const rows = baueZeilen();
    const eventId = K.eventConfig?.eventId || K.integrationConfig?.supabase?.projectId || 'KC-WM-2026';
    state.eventId = eventId;
    try {
      // Auch ein LEERER Plan wird veroeffentlicht. Die Datenbankfunktion behandelt den Aufruf
      // als vollstaendigen Snapshot und entfernt damit einen vorherigen, inzwischen alten Stand.
      const result = await K.supabaseConnection.publishPlan({ eventId, rows });
      state.lastPublishedAt = new Date().toISOString();
      state.lastCount = rows.length;
      state.lastError = null;
      return result;
    } catch (e) {
      state.lastError = e?.message || String(e);
      throw e;
    }
  }

  K.planManagerBridge = {
    version: VERSION,
    state,
    publishNow: veroeffentlicheJetzt,
    buildRows: baueZeilen,
    today: heute,
  };
})();
