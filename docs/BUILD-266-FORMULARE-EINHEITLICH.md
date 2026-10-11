# Build 266 RC – KC-DP-FORMULARE-EINHEITLICH

Ausgang: Build 265 RC, 252f22f. Wunsch Hansi (11.10.2026): „Alle Formulare in DP2 und der Club-App so aufgebaut – personalisiert mit QR-Code, der in DP2 eingelesen werden kann.“ Paket 1 = alle Wunsch-/Verfügbarkeitsformulare.

**QR mit Dokumentart** (`personalized-forms.js` `profileFor(person, kind)`): Der QR enthält wie bisher `schema`, `profileId`, `periodId` und zusätzlich `kind`:
`wish-matrix-v12` (leerer Wunschbogen), `wish-filled-v12` (Ausdruck „Meine Wunschzeiten“), `handwriting-v1`, `wish-excel-v6`, `person-account-v1`; die Club-App nutzt `club-bestaetigung-v1`. Alte QR-Codes ohne `kind` gelten als Wunschbogen V12.

**Einlesen** (`form-ocr.js` `identityFromRaw`, `photo-recognition.js`):
- Die Profil-ID passt jetzt auch auf die Mitglieds-ID (Club-App-Bögen tragen `KC-P-…` als Profil-ID) – in jedem ID-Format.
- Nur `wish-matrix-v12` und `wish-filled-v12` werden eingelesen. Andere Arten (Handschriftprobe, Excel-QR-Blatt, Kontoauszug, Club-Bestätigung) werden mit klarer Meldung abgelehnt – nichts wird übernommen.
- Gehört der Bogen zu einem anderen Zeitraum, erscheint ein deutlicher Hinweis (jede Zeile prüfen) – nie still übernommen.
- Beim Ausdruck gespeicherter Angaben erscheint der Hinweis, nur handschriftliche Änderungen zu prüfen.

**Aufbau** (`pdf.js`): wie Build 265 jetzt auch für die Bereitschaft – Auswahl als Tabelle `matrix-choice-table` mit mittigen Kästchen, Bereitschaftstabelle `matrix-standby-table` mit großen Datums-/Zeitzellen. Kästchen werden gezeichnet statt als Schriftzeichen; ☒ ist ein Kästchen mit Kreuz (vorher ein gefülltes ■).

Seite 1 (Spalten, Rasterlinien) ist unverändert – die Bilderkennung liest weiter V12. Keine Datenbankänderung.

## Prüfung

Neu `tools/smoke-form-identity.mjs` (in `test:smoke`): Art im QR, Zuordnung über HP-Profil und Mitglieds-ID, Ablehnung anderer Arten, Zeitraumhinweis. `npm run test:smoke` grün.
