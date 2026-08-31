# Phase 18 · Build 115

Gezielte Regressionskonsolidierung ohne Änderungen an den übrigen Planungsansichten.

- Bedarf ist in der Tagesansicht wieder über einen sichtbaren Schalter direkt editierbar.
- Die Bedarfsfelder sind Zahlenfelder mit nativen Hoch-/Runter-Pfeilen und explizitem Speichern/Abbrechen.
- Hauptregister werden wieder kompakt nach ihrem Inhalt dargestellt und nicht gleichmäßig über die gesamte Breite gedehnt.
- Personalisierte Excel-Wunschmatrizen werden als saubere neue Arbeitsmappe erzeugt. Die komplexe Originalvorlage wird nicht mehr durch SheetJS geöffnet und neu geschrieben; dadurch können vorhandene Zellverbünde nicht beschädigt werden.
- Automatische UI-Vertragstests sichern diese drei Bedien- und Dateiverträge gegen erneute Rückschritte ab.
