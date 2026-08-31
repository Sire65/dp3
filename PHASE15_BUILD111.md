# Phase 15 · Build 111

## Eindeutige Besetzungspflege

- Das Register **Bedarf** ist die einzige schreibende Pflegeansicht für Grundbedarf und Sollbesetzung.
- Die Registerkarte **Sollmatrix** wurde aus den Zahnrad-Einstellungen entfernt.
- Unter **Allgemein** verweist ein Sprungknopf auf das Register Bedarf, ohne eine zweite Eingabemaske anzubieten.
- Die Stundenmatrix bleibt Kontroll- und Umplanungsansicht; ihr zweiter Sollwerteditor wurde durch einen Sprung zum Bedarfsregister ersetzt.
- Automatisch eingeblendete zweite Zahlenfelder in der Bedarfstabelle wurden entfernt.
- Das zusätzliche Aktionsmenü innerhalb der Bedarfsansicht wurde entfernt; maßgeblich ist das gemeinsame Hamburger-Menü des Registers.

Vorhandene Besetzungsdaten und das zentrale Datenmodell wurden nicht verändert.

## Regression

- JavaScript-Syntaxprüfung: grün.
- Core-Smoke-Test: grün.
- UI-Vertrags-Smoke-Test: grün.
- Release-Manifest: 166/166 Dateien verifiziert.
