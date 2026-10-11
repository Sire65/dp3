# Build 265 RC – KC-DP-MATRIX-LESBARER

Ausgang: Build 264 RC, 6972df3. Wunsch Hansi (11.10.2026) nach dem Ausdruck der leeren Verfügbarkeitsmatrix:

- In den Tageszeilen sind **Datum, Tag/Bereich und Rahmenzeit** größer (8 pt statt 5,4 pt) und senkrecht mittig gesetzt.
- Die **Kästchen** (Sperrtag, Nur wenn nötig; im ausgefüllten Bogen auch ☒) stehen **waagrecht und senkrecht mittig** in ihrer Zelle und sind etwas größer.

Nur `src/adapters/pdf.js` (Zeichnen der Tabelle `matrix-form-table`); Spalten, Inhalte, QR-Code, Datenformat und Import unverändert. Cachekennung von `pdf.js` auf b265. Keine Datenbankänderung.

## Prüfung

`npm run test:smoke` grün (inkl. `verify-release.mjs`). Ausdruck für ein Mitglied über die Club-App erzeugt und angesehen.
