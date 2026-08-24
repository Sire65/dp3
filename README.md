# KC DP2 V0.20

Neuentwicklung des Dienstplan-Managers für den Köcheclub Werne auf Basis des stabilisierten Build 84.

Aktueller Stand: **V0.20.0 Build 85 – Phase 1**

## Enthalten

- Dashboard
- Wunschplan
- Sollplan
- Istplan
- Stundenmatrix
- frei verschiebbare und lokal gespeicherte Hauptregister
- responsive Bedienung für Desktop, Tablet und Handy
- installierbare PWA mit geprüftem atomarem Release-Cache

## Lokale Prüfung

```text
node tools/verify-release.mjs
node tools/smoke-core.mjs
```

## Veröffentlichung

Jeder Push auf `main` wird zunächst geprüft. Nur ein grüner Build wird über GitHub Actions auf GitHub Pages veröffentlicht.

