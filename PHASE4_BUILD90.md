# KC DP2 V0.20.0 Build 90 – Phase 4

## Einheitlicher Wunschvertrag

- Gemeinsames DP3-Datenformat für Verfügbarkeit, Bevorzugung, „Nur wenn nötig“ und Sperren.
- Sperren unterscheiden fachlich und in der Oberfläche zwischen **Sperrzeit** und **Sperrtag**.
- Ein Sperrtag übernimmt automatisch Beginn und Ende des vorhandenen Tagesmodells; es werden keine festen Uhrzeiten eingebaut.
- Bestehende Wunschzeilen werden beim Laden additiv normalisiert und bleiben abwärtskompatibel.
- Direkteingabe, Excel-/CSV-Import und Foto-Prüfung verwenden dieselbe Validierung.
- Herkunft, Status, Bereich, Umfang und Vertragsversion bleiben am Datensatz nachvollziehbar.

## Bereits enthalten

- Startoptimierung mit früh sichtbarer Oberfläche und nachlaufender Integritätsprüfung.
- Registerkarte **Fairnis** mit Ist-/Sollvergleich und neutralen Verteilungskennzahlen.
- Feine Schraffur für Vor-/Nachbereitung und hellgraue Wochenendmarkierung in Tagesboxen.

## Prüfung

- JavaScript-Syntaxprüfung aller geänderten Kernmodule.
- Release-Manifest vollständig neu erzeugt und gegen alle Paketdateien geprüft.
- Core-Smoke-Test und Browserprüfung ohne Konsolenfehler.
