# Build 256 RC – Twinkey einfacher und fehlersicher

Feature: **KC-DP-TWINKEY-EINFACH** · 02.10.2026 · Basis: Build 255 RC `ae349c0` · Wunsch Hansi nach UX-Prüfung des
Club-App-Wegs („bedienerfreundlich, logisch, übersichtlich, damit dem User keine Fehler passieren können“).

Geändert ist nur `src/ui/simple-wish-assistant.js` (Twinkey „Selbst eingeben“). Datenformat, Speichern, Signaturen,
Reservierung (Build 255) und alle übrigen Wege bleiben unverändert.

## Änderungen
1. **Kein vorzeitiges „Fertig“** – Tagesliste, Speicherbestätigung und Abschluss zeigen „x von 13 Tagen fertig“
   (`#swProgress`, offene Tage benannt, sobald höchstens sechs offen sind). „Fertig“ fragt nach, wenn noch Tage ohne
   fertige Angabe sind („Für diese Tage weiß der Planer nicht, ob du kannst. Trotzdem beenden?“).
2. **Kann-Zeit nicht vorausgefüllt** – bisher stand der ganze Tagesrahmen drin; ein bloßes „Weiter“ meldete den
   ganzen Tag. Jetzt Von/Bis leer, „Weiter“ gesperrt mit Grund. Bewusst ganze Zeit: Knopf
   „Ganze freie Zeit übernehmen (von–bis)“ (`#swWholeDay`, nur bei genau einem freien Fenster). Neue zusätzliche
   Zeiträume starten ebenfalls leer.
3. **Bearbeiten sofort sichtbar** – beim Antippen eines Tages steht „Diesen Tag eintragen“ (leerer Tag) bzw.
   „Angaben bearbeiten“ (`#swEditDay`) oberhalb der Zeitübersicht und wird in die Bildmitte gescrollt.
   Zusätzlich oben „▶ Los geht’s mit / Weiter mit <nächster offener Tag>“ (`#swNextOpen`).
4. **Wunschzeit nur nach Wahl** – „Weiter“ ist gesperrt, bis „Kann-Zeit als Wunsch“, „Ohne Wunschzeit“ oder
   „Eigene Wunschzeit“ gewählt ist (bereits gespeicherte Tage gelten als entschieden).
5. **Nächster offener Tag** – nach dem Speichern „▶ Weiter mit <Datum>“ (`#swNextDay`); „Zur Tagesübersicht“
   (`#swMore`) und „Fertig“ (`#swFinish`) bleiben.

## Tests
- `tools/test-member-button-logic.mjs`: Fortschritt 0/1 von n, `#swNextOpen`, Knopftext „Diesen Tag eintragen“, leere
  Kann-Zeit sperrt „Weiter“, `#swWholeDay`, Wunsch-Wahl erforderlich, `#swNextDay`, Rückfrage vor „Fertig“.
- `tools/test-wish-print.mjs`: Rückfrage vor „Fertig“ bestätigt.
- `npm test` und alle sieben Browserprüfungen aus `test:browser` grün (ohne Chrome-Kanal ausgeführt).
- Club-App-Durchlauf (Handy 390 px) mit Wilfried als Beispiel: kein JS-Fehler, gespeicherte Einträge unverändert im Format.

Hinweis: Die manuellen Einzeltests mit lokalem Server (`test-assistant-finish`, `test-day-status`,
`test-simple-wish-assistant` u. a.) sind nicht Teil von `test:browser`; sie setzen teils die frühere Vorbelegung
oder ein „Fertig“ ohne Rückfrage voraus und müssen bei Bedarf entsprechend angepasst werden.

Stage bleibt **RC**. Vor FINAL weiterhin: Wiederherstellungsprüfung und Zwei-PC-Live-Handtest (Build 255).
