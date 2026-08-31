# Phase 25 - Build 122

## Papierformular-OCR

- Personalisierte Formulare werden über die im QR enthaltene Profil-ID zugeordnet; Klarname und interne Personen-ID müssen nicht im QR stehen.
- Selbstbedienungsimporte werden nur übernommen, wenn der QR sicher zur angemeldeten Person passt.
- Foto, OCR-Modell und erkannte Werte werden lokal im Browser verarbeitet.
- Perspektivkorrektur und Erkennung des V12- sowie des älteren V6-Tabellenrasters.
- Wunsch-, Kann-, Sperr- und Nur-wenn-nötig-Einträge bleiben getrennt; V/H/B bleibt erhalten.
- Geringe Erkennungssicherheit erzeugt keine erfundenen Zeiten, sondern führt in die Kontrollansicht.
- QR-Fallback für Browser ohne native QR-Erkennung.
- Kostenfreie Hybrid-OCR: drei Bildaufbereitungen pro beschrifteter Zelle, unterschiedliche Segmentierungsmodi und Konsensbewertung statt eines einzelnen OCR-Treffers.
- Vollständige Nachbearbeitung: Kannzeit, Wunschzeit und Sperrzeit werden für jeden Tag angezeigt; fehlende und unsichere Werte sind nicht vorausgewählt und können manuell ergänzt werden.
- Zugängliche Nachbearbeitungsmarkierung mit Text, Tooltip, Kontur und zarten Farben für nicht erkannte, unvollständige und unsichere Werte.

## Qualitätssicherung

- echter Matrixplan als lokaler Foto-Rastertest
- Ladefolge und OCR-Datenvertrag im UI-Smoke-Test
- vollständige Syntax-, Core-, UI- und Release-Verifikation
