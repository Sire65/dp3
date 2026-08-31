# KC DP2 V0.20

Neuentwicklung des Dienstplan-Managers für den Köcheclub Werne auf Basis des stabilisierten Build 84.

Aktueller Stand: **V0.20.0 Build 139 – Phase 39 (Vorschauauswahl und sichtbare Zeilentrennung)**

## Enthalten

- Dashboard
- Wunschplan
- Sollplan
- Istplan
- Stundenmatrix
- Abweichungen
- frei verschiebbare und lokal gespeicherte Hauptregister
- responsive Bedienung für Desktop, Tablet und Handy
- installierbare PWA mit geprüftem atomarem Release-Cache
- automatische Update-Abfrage für jede höhere Version oder Buildnummer
- entschlackte, registerabhängige Bedienoberfläche für Desktop, Tablet und Handy
- Register „Fairnis“ mit neutraler Ist-/Soll-Verteilungsanalyse
- schneller Start aus dem verifizierten PWA-Cache bei fortlaufender Hintergrundprüfung
- zentrale Formulare und Vorlagen für Excel und Word
- lokale Foto-OCR mit Perspektivkorrektur, QR-Profilzuordnung und kontrollierter Übernahme

## Lokale Prüfung

```text
node tools/verify-release.mjs
node tools/smoke-core.mjs
```

## Veröffentlichung

Jeder Push auf `main` wird zunächst geprüft. Nur ein grüner Build wird über GitHub Actions auf GitHub Pages veröffentlicht.
