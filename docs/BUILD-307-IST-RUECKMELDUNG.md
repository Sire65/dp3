# Build 307 RC · Ist-Rückmeldung nach dem Dienst

**Vorgabe:** Hansi, 08.11.2026 – „In DP2 gibt es einen Kontoauszug. Er muss das alles richtig zeigen.“

## Ablauf
1. Die Club App fragt nach jedem geplanten Dienst: „Dein Dienst heute war 11:00–15:00 – als Ist übernehmen? [Ja] [Andere Zeiten] [Ich war nicht da]“, optional mit Grund, dazu freiwillig Stimmung (😀/🙂/☹️) und Besetzung (zu wenig / passt / zu viele).
2. Der Club-Server speichert in `public.kc_dp_dienst_rueckmeldung` (nur service_role, RLS ohne Policy). **Migration im Club-App-Repo, nicht in DP2.**
3. DP2 liest nur über `rpc/kc_dp_rueckmeldungen_liste(p_org_id, p_von, p_bis)` und entscheidet über `rpc/kc_dp_rueckmeldung_entscheiden(p_id, p_status, p_grund)` (Anmeldung wie `kc_dp_hour_report_decide`). `tools/supabase-security-contract.mjs` prüft, dass DP2 die Tabelle nie direkt anspricht.

## Regeln in DP2 (`src/core/ist-rueckmeldung.js`)
- `passt` → automatisch → eine Ist-Zeit `self_confirm` (Ist = Soll). `geaendert` automatisch/bestätigt → `self_change`, `original` = Soll.
- `zu_bestaetigen` zählt nicht (Kontoauszug „⏳ wartet“); `abgelehnt` → keine Ist-Zeit; `nicht_da` bestätigt → keine Ist-Zeit, Solldienst gilt als abwesend (keine „Buchung fehlt“).
- `korrektur` bestätigt → die vorhandene Kassen-/App-Buchung wird korrigiert (Recht „Istzeiten korrigieren“), Rohbuchung bleibt als `original`.
- Vorrang: Planer-Korrektur > Kasse/Stempeluhr/Import/manuell > App-Live-Buchung > Selbstauskunft. Eine Selbstauskunft überschreibt nie eine Buchung; ein späterer Import legt sie still (Audit `actual.self_report.retire`).
- Genau eine Ist-Zeit je Rückmeldung (`istRueckmeldungId`); neue Version aktualisiert dieselbe Ist-Zeit.
- Zeiten: timestamptz → Dezimalstunden am Diensttag in Europe/Berlin (01:30 Folgetag = 25,5).
- Nur-Feedback-Zeilen (ergebnis leer) zählen nicht als „keine Antwort“, wenn schon eine Buchung existiert.
- Abgeschlossener Istplan sperrt Bestätigen und Buchen.

## Oberfläche
- Register Ist → ☰ → „✓ Ist-Rückmeldungen der Mitglieder“: Zu bestätigen / Keine Antwort / Erledigt / Alle / Stimmung & Besetzung.
- Kontoauszug, Ist-Abgleich und Abweichungen zeigen die neuen Quellen und Zustände. Das eigene Gesicht steht nur im eigenen Kontoauszug.
- Auto-Sync holt höchstens alle 5 Minuten ab (nur Planerrollen).

## Test
`node tools/test-ist-rueckmeldung.mjs` (offline, Supabase nachgebildet) – Teil von `npm test`.

## Build 308 · Abschluss an die Club App
`src/core/days-publish-bridge.js` schickt je Tag `istStatus` ('closed'|'open') und `istClosedAt`. Abgeschlossen sind alle Tage bis einschließlich zum Abschlussdatum (Europe/Berlin) von `K.actualWorkflow.closedAt`. `closePlan`/`reopenPlan` veröffentlichen sofort neu. Test: `tools/test-ist-closed-days.mjs`.
