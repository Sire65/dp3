# Phase 16 · Build 113

## Gemeinsamer sicherer Import

- Excel-/CSV- und Foto-/Handschriftangaben verwenden denselben Prüfvertrag.
- Personen werden über ID, Klarname und die vom PC Manager gelieferte Pseudonym-Zuordnung erkannt.
- Datum, Von/Bis, Wunschstatus und feldbezogene Erkennungssicherheit werden vor einer Übernahme geprüft.
- Bereits gespeicherte sowie innerhalb einer Importcharge doppelte oder überlappende Angaben werden sichtbar markiert.
- Erkannte Werte werden niemals ungeprüft automatisch gespeichert.

## Handschriftprofil

- Der persönliche Schriftlernbogen V1 steht im Formularzentrum direkt zum Download bereit.
- Drei Seiten decken Ziffern, Buchstaben, typische Verwechslungen, Uhrzeiten, Datumsangaben und V/H/B/Z-Planstatus ab.
- Die spätere Zuordnung ist auf eine Profil-ID ausgelegt; ein Klarname muss nicht auf dem Lernbogen stehen.

## Konsolidierung

- Bestehende Wunsch-, Soll-, Ist-, Bedarfs-, Stundenmatrix- und Dashboard-Funktionen bleiben unverändert angebunden.
- Ein zusätzlicher UI-Vertrag prüft Pseudonymauflösung, Feldsicherheit, Duplikaterkennung und die Verfügbarkeit des Lernbogens.
