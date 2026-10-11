# Build 264 RC – KC-DP-REGELZEIT-ERSTER-FREITAG

Ausgang: Build 263 RC, ceefe07. Auftrag von Hansi (11.10.2026, über die Club-App-Sitzung): Regelzeiten des Weihnachtsmarkts 2026.

Einzige Änderung: Der erste Markt-Freitag (04.12.2026) beginnt um **10:00** statt 11:00 (`src/core/model.js`, Grundeinstellung der Tage).
Alle übrigen Regelzeiten entsprachen bereits der Vorgabe und bleiben unverändert:

| Tag | Regelzeit |
|---|---|
| Aufbau 02.12./03.12. | 08:00–18:00 |
| Fr 04.12. | 10:00–23:00 (neu) |
| Sa 05.12., So 06.12. | 11:00–23:00 |
| Mo 07.12. | 13:00–23:00 |
| Di 08.12. | 11:00–23:00 |
| Mi 09.12., Do 10.12. | 13:00–23:00 |
| Fr 11.12., Sa 12.12., So 13.12. | 11:00–23:00 |
| Abbau 14.12. | 08:00–15:00 (unverändert) |

Kernzeit (Öffnung 12:00), Bedarf, Programm, Personen und Datenformat unverändert. Keine Datenbankänderung.
Hinweis: Hat ein Planer die Tageseinstellungen in DP2 bereits von Hand geändert bzw. veröffentlicht (`kc_dp_days_published`), gilt sein Stand – die Grundeinstellung greift nur, solange nichts anderes festgelegt ist.

## Prüfung

`npm run test:smoke` grün (inkl. `verify-release.mjs` mit neu erzeugtem Manifest). Cachekennung von `model.js` auf b264.
