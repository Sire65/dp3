// Sollplan-Bruecke zum PC-Manager (KC MarktKasse Suite).
//
// Baut aus dem aktuellen, veroeffentlichten Sollplan (K.shifts, layer='planned') einen
// Schnappschuss OHNE Klarnamen (nur personId) und schickt ihn ueber die neue Datenbankfunktion
// kc_dp_plan_publish an den Manager. Der Manager reicht ihn - mit Pseudonymen statt Klarnamen -
// an die Kassen weiter, wo alle Kollegen nachschauen koennen, wer wann kommt.
//
// AUSLOESUNG: haengt sich an den bestehenden Auto-Sync-Takt (siehe auto-sync.js) - kein neuer
// eigener Zeitgeber. Ein Fehlschlag hier darf den normalen Sync NICHT stoeren (try/catch dort).
//
// BEWUSST NUR ADDITIV: fasst kein bestehendes Kernmodul an ausser dem einen, kleinen Aufruf in
// auto-sync.js.
(function () {
  'use strict';
  const K = (window.KCDP = window.KCDP || {});
  const VERSION = '0.2.0';
  const VORSCHAU_TAGE = 30; // "die naechsten Tage" - genug fuer mehrere Wochen Blaetterpfeil,
                             // ohne bei jedem Takt unnoetig viel zu uebertragen

  // Dieselbe Filterung wie im bestehenden Sollplan-Dokument-Export (documents.js,
  // plannedDocument): gestrichene/ausgefallene Schichten gehoeren nicht in den Plan.
  const INAKTIV = new Set(['cancelled', 'absent', 'failed', 'deleted']);

  function stunden2Uhrzeit(stunden) {
    const h = Math.max(0, Math.floor(Number(stunden) || 0));
    const m = Math.round(((Number(stunden) || 0) - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function lokalesIsoDatum(datum = new Date()) {
    const y = datum.getFullYear();
    const m = String(datum.getMonth() + 1).padStart(2, '0');
    const d = String(datum.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function heute() {
    return lokalesIsoDatum();
  }

  function baueZeilen() {
    const startDatum = new Date();
    const endeDatum = new Date(startDatum);
    endeDatum.setDate(endeDatum.getDate() + VORSCHAU_TAGE);
    const start = lokalesIsoDatum(startDatum);
    const ende = lokalesIsoDatum(endeDatum);
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
    // Auch ein LEERER Plan wird veroeffentlicht (z.B. ausserhalb der Saison) - sonst wuerde
    // die Kasse einfach den letzten, inzwischen veralteten Stand weiter anzeigen.
    const eventId = K.eventConfig?.eventId || 'KC-WM-2026';
    return K.supabaseConnection.publishPlan({ eventId, rows });
  }

  K.planManagerBridge = { version: VERSION, publishNow: veroeffentlicheJetzt, buildRows: baueZeilen };
})();
