# Build 254 RC – Ausdruck „Meine Angaben“ und ganzer Sperrtag ohne V/H/B

Wunsch Hansi (01.10.2026), gebaut auf Build 253 RC (`d50ed58`, Zweig `codex/club-app-interface`).

## 1. Meine Angaben ausdrucken (Feature KC-DP2-WISH-PRINT)

- Knopf „🖨️ Meine Angaben ausdrucken (PDF mit QR)“ am Ende aller drei Eingabewege: Tagesmatrix (ohne Twinkey,
  Übersicht „Mein Wunschplan“), Twinkey-Auswertung („Fertig? Meine Auswertung“) und Schluss des einfachen Assistenten.
- Ablauf: Sicherheitsabfrage → PDF wird erzeugt → Vorschau → erst dort „Drucken“ (Desktop: eingebettete PDF-Vorschau,
  Drucken aus der Vorschau) bzw. „PDF öffnen“ (Handy: PDF-Anzeige des Geräts mit Drucken/Teilen) und „Speichern“.
- Inhalt: ausgefüllter Bogen im selben V12-Format wie die Papiermatrix (gleiche Spalten), QR oben rechts mit derselben
  Profil-ID (`document-identity`/`qrcode-generator`/`personalized-forms`, kein eigener Weg), Original-Kochmütze.
  Seite 2: Bereitschaft und Felderklärung. Quelle sind nur die gespeicherten Angaben; es wird nichts gespeichert.
- Dateien: `src/core/personalized-forms.js` (`filledPdf`, `filledMatrixDoc`, gemeinsame `MATRIX_GUIDE`),
  `src/ui/wish-print.js`/`.css` (neu), Knöpfe in `mobile-wish-matrix.js`, `chef-companion.js`, `simple-wish-assistant.js`.
  Die bisherige Browser-Druckfunktion „Gesamtübersicht drucken“ bleibt unverändert.
- `twinkey-test.html`: CSP `frame-src blob:` (nur die selbst erzeugte PDF-Vorschau; vorher `'none'`).

## 2. Ganzer Sperrtag ohne V/H/B (Feature KC-DP2-SPERRTAG-OHNE-BEREICH)

- Bildschirm: bereits gesperrt in allen drei Wegen (Matrix blendet den Einsatzbereich aus, einfacher Assistent springt
  bei Tagessperre zur Zusammenfassung, Twinkey-Assistent hat bei „ganzer Tag“ keinen Bereichsschritt) – unverändert.
- Papierimport (`src/adapters/form-ocr.js`): angekreuzter Sperrtag übernimmt kein V/H/B (Bereich neutral) und keine
  Kann-/Wunschzeit derselben Zeile. Nichts wird still verworfen: Mitgeschriebenes erscheint in der Prüfung als
  „nicht übernommen – bitte prüfen“ (`accepted:false`, `recognitionState:'conflict'`); die bestehende Regel
  „Sperrtag kann keine Kann- oder Wunschzeiten enthalten“ verhindert ein versehentliches Speichern.
- Leerer Papierbogen: Hinweis „Bei einem angekreuzten Sperrtag die übrige Zeile leer lassen“ (Spaltenlage unverändert).

## Tests

`tools/smoke-wish-print.mjs` (in `test:smoke`), `tools/test-wish-print.mjs` (in `test:browser`).

## Offen

Live-Handtest, zentrale Kollegenfreigabe, serverseitige Claim-/Versionsprüfung (siehe Build 252/253) – RC, nicht FINAL.
