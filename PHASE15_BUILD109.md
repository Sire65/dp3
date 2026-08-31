# Phase 15 · Build 109

## Namensanzeige

- Globale Voreinstellung unter **Einstellungen → Allgemein**: vollständiger Vor- und Nachname oder nur Vorname.
- Separate Option, Pseudonyme aus PC Manager bevorzugt anzuzeigen.
- Keine lokale Pseudonym-Zuordnung in KC DP: PC Manager bleibt die führende Quelle.
- Klarname bleibt bei aktiver Pseudonymanzeige über den Tooltip nachvollziehbar.
- Erste Personenspalte der Planungsansichten und Abweichungen verwenden dieselbe zentrale Anzeigelogik.

## PC-Manager-Anbindung

- Klarname und Pseudonym werden getrennt eingelesen.
- Unterstützte Pseudonymfelder: `pseudoName`, `pseudo_name`, `pseudonym`, `nickname`, `preferredName`, `preferred_name`.
- `preferred_name` wird nur als Pseudonym behandelt, wenn es vom Klar-/Anzeigenamen abweicht.

## Konsolidierung

- Syntaxprüfung aller JavaScript-Dateien: grün.
- Core-Smoke-Test: grün.
- UI-Vertrags-Smoke-Test: grün.
- Chrome-Laufzeitprüfung aller drei Namensmodi: grün; keine Konsolenwarnungen oder -fehler.
- Release-Manifest: 166/166 Dateien verifiziert.
