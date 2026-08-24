# KC DP2 V0.20.0 Build 88 – Phase 2

## Ziel

Die vorhandene Oberfläche wird entschlackt, ohne Fachlogik umzubauen oder funktionierende Funktionen zu entfernen.

## Umsetzung

- kompaktere Kopfzeile
- klare Registerleiste als oberste Navigation
- vorhandene Wunsch-/Soll-/Ist-Layer bleiben intern kompatibel, sind aber nicht mehr als zweite Hauptnavigation sichtbar
- Ribbon zeigt nur die Hauptaktionen des aktiven Registers
- Datum, Pfeile, Tag/Woche/Zeitraum und Zeitraster bleiben dauerhaft erreichbar
- Meldungen stehen in einer eigenen zentralen Zeile
- registerbezogene Beschriftung und Farbpunkt erklären den aktuellen Arbeitskontext
- seltene Funktionen bleiben unter „Mehr“ erreichbar
- Tablet und Handy verwenden dieselbe Aktionszuordnung wie Desktop
- horizontales Scrollen verhindert abgeschnittene Funktionen auf schmalen Displays

## Aktionszuordnung

| Register | Sichtbare Hauptaktionen |
|---|---|
| Dashboard | Wetter, Programm, Risiken und weitere Funktionen |
| Wunschplan | Planfoto, Farberklärung und Wunschkontext |
| Sollplan | KI-Vorschlag, Pause, Dienst, Prüfung, Einplanung, Veröffentlichung und Planinformationen |
| Istplan | Istzeitimport und Farberklärung |
| Stundenmatrix | Prüfung, Wetter, Programm, Lücken und Planinformationen |

## Architekturgrenze

`v020-layout.js` setzt ausschließlich UI-Metadaten und Sichtbarkeit. Es schreibt nicht in Personen, Wünsche, Schichten, Istzeiten, IndexedDB, Supabase oder Auditdaten. Vorhandene Buttons und deren Handler bleiben die einzigen Ausführungspfade.

## TÜV

- Release-Verifikation: 138/138 Dateien
- JavaScript-Syntax: 103/103 Dateien
- Core-Smoke-Test: grün
- Buildnummer und atomarer PWA-Cache: 88
- keine Änderung an Auth-/Sessionpfad
- keine Änderung an Planungs-, Import- oder Sync-Core

## Nächster Schritt

Manueller Studio-TÜV nach regulärer Anmeldung auf Desktop, Tablet und Handy. Danach folgt die Wunschplan-Domäne mit endgültigem Vertrag für Wunsch, Reserve, Sperrtag, Sperrzeit, Deadline und Audit.
