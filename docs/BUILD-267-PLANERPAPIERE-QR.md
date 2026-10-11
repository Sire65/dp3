# Build 267 RC – KC-DP-PLANERPAPIERE-QR

Ausgang: Build 266 RC, 77fa25f. Wunsch Hansi (11.10.2026), Paket 2 von „alle Formulare personalisiert mit QR-Code, der in DP2 eingelesen werden kann“: die Planer-Papiere.

**QR auf den Papieren** (neu `src/core/paper-documents.js` → `KCDP.paperDocuments`, Dokumentvertrag `KCDP-DOC-1` aus `document-identity.js`):

| Papier | Art (`docType`) | Inhalt des QR |
|---|---|---|
| Leerplan (je Tag eine Seite) | `empty-plan-v1` | Tag |
| Besetzungsmatrix für Papierplanung (je Tag) | `paper-staffing-v1` | Tag |
| Persönlicher Dienstplan | `personal-plan-v1` | Mitglieds-ID, Zeitraum, Planversion |

Der QR steht oben rechts, darunter eine Klartext-Zeile (z. B. „LEERPLAN · 04.12.2026“). `document-identity.js` nimmt dafür optional `personId` und `date` auf; leere Felder entfallen. Bisherige Dokumente sind unverändert.

Wirkt in allen Ausgabewegen: Browserdruck (`export.js` `printHtml` → `fillRoot`), PDF (`pdf.js` zeichnet den QR je Seite) und Papierplanungs-Fenster (`paper-staffing.js`).

**Einlesen** (`form-ocr.js`, `photo-recognition.js`): Ein Planer-Papier wird erkannt und klar benannt, z. B. „Persönlicher Dienstplan von … , Planversion V4 – ACHTUNG: veraltet, aktuell ist V5. Bitte neu ausdrucken.“ Leerplan und Papierplanung sagen, wo die Einträge für den Tag hingehören. Es ist kein Wunschbogen – es wird nichts übernommen. Wunschbögen (Build 266) laufen unverändert.

Keine Datenbankänderung.

## Prüfung

Neu `tools/smoke-paper-documents.mjs` (in `test:smoke`): QR-Inhalt je Art, Erkennen inkl. veraltetem Plan, Platzhalter und Ausfüllen (Fehler sichtbar als „QR-Code fehlt“), Ablehnung beim Einlesen, Einbau in Leerplan/Dienstplan/Papierplanung/Druck/PDF. `npm run test:smoke` grün.
