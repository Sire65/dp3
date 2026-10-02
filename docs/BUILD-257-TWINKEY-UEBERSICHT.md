# Build 257 RC – Twinkey übersichtlicher

Feature: **KC-DP-TWINKEY-EINFACH** (zweiter Schritt) · 02.10.2026 · Basis: Build 256 RC `51518cc` · Wunsch Hansi
vor Wilfrieds Live-Test. Die Begriffe „(Kann-Zeit)“ und „(Wunschzeit)“ bleiben in Klammern (gleich wie Papiermatrix/Excel).

Geändert: `src/ui/simple-wish-assistant.js`, `src/ui/twinkey.js` (Willkommen), `src/ui/wish-demand.css` (+ neu gebautes
`src/ui/startup.css`, nur die neuen Regeln). Datenformat, Speichern, Signaturen und Reservierung (Build 255) unverändert.

1. **Sperren als klare Frage** – `#swNoBlock` „✓ Ich kann an diesem Tag“ (geht direkt zur (Kann-Zeit)),
   `#swDayBlock` „Ganzer Tag gesperrt“, `#swTimeBlock` „Nur zeitweise gesperrt“ als große Auswahlflächen.
   „Weiter“ ist ohne Antwort gesperrt (Merker `blockChosen`; gespeicherte Tage gelten als beantwortet).
2. **Ein Zurück je Schritt** – oberer `#swBackTop` in den Schritten entfällt, `#swBack` neben „Weiter“ bleibt.
   Tagesliste und Abschlussseiten behalten ihren einzigen Zurück-Knopf.
3. **Besetzung nur bei der (Wunschzeit)** – `#swTeamToggle` als kleiner Link „👥 Bisherige Besetzung anzeigen“, nur im
   Wunschzeit-Schritt. Prüfschritt mit Besetzungskacheln und Alternativen unverändert.
4. **Kurze Tageszusammenfassung** – „Das trägst du für diesen Tag ein“ + Haken „fertig“ + Hinweis auf
   „Angaben speichern“. Stundenüberblick, Durchschnitt und „Zusammenfassung drucken“ in `<details class="sw-more">`.
5. **Tageskacheln** – „Mi., 2.12. · Aufbau · 08:00–18:00“, Status mit Zeichen und Farbe (✓ grün Fertig, ✎ gelb In
   Bearbeitung, ○ grau Noch kein Eintrag); vollständiger Text als `aria-label`.
6. **Willkommen** – `#twSkip` „Überspringen“ entfällt (doppelt zu „Ohne Assistent“); „Ohne Assistent“ schaltet jetzt
   ebenfalls den Ton ab und öffnet die Startseite.
7. **Kleinigkeiten** – `#swLeave` heißt „Jetzt beenden“ (passte nicht in den Knopf). Die untere Leiste „Meine Zeiten“
   bleibt aktiv: sie ist der Einstieg zur Zeiteingabe, nicht nur eine Anzeige.

## Tests
- `test-member-button-logic`: Sperr-Antwort nötig (Weiter gesperrt, `#swNoBlock`), kein `#swBackTop`, kein
  `#swTeamToggle` außerhalb der Wunschzeit. `test-twinkey`: kein `#twSkip`, „Ohne Assistent“ führt zur Startseite.
- `npm test`, Syntaxprüfung und alle sieben Browserprüfungen aus `test:browser` grün (ohne Chrome-Kanal).
- Club-App-Durchlauf 390 px: zwei Tage (einer gesperrt) gespeichert, Kacheln grün, kein JS-Fehler.
- Manuelle Einzeltests mit lokalem Server (`test-assistant-*`, `test-day-status`, `test-simple-wish-assistant`,
  `test-twinkey-local-entry`) sind nicht Teil von `test:browser` und erwarten teils noch die alte Sperr-Seite
  (Weiter ohne Antwort) bzw. `#swTeamToggle` außerhalb der Wunschzeit – bei Bedarf anpassen.

Stage **RC**. Vor FINAL: Wiederherstellungsprüfung, Zwei-PC-Live-Handtest, Auswertung Wilfried.
