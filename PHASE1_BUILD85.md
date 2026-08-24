# KC DP2 V0.20.0 Build 85 – Phase 1

## Umgesetzt

- additive Hauptregister: Dashboard, Wunschplan, Sollplan, Istplan, Stundenmatrix
- Wunsch-, Soll- und Istplan als optisch zusammengehörige Registergruppe
- bestehende Wunsch-/Soll-/Ist-Fachansichten über die vorhandenen Layer-Schalter angebunden
- gemeinsame Registerzustände für Desktop, Tablet und Mobil
- Tastaturbedienung mit Pfeiltasten, Pos1 und Ende
- aktiver Zustand per Text, ARIA und visueller Markierung – nicht nur über Farbe
- kompakte KC-DP2-Kennung mit Version und Build in der Kopfzeile
- Registerwechsel-Ereignis `kc-v020-register-change` als Erweiterungspunkt
- frei verschiebbare Register per Maus sowie Touch/Pointer auf Tablet und Handy
- lokal gespeicherte persönliche Registerreihenfolge
- barrierefreie Registerverschiebung mit Alt+Pfeil links/rechts
- Stundenmatrix-Register setzt den vorhandenen Sollplan und betont die bestehende Matrix
- Dashboard und Stundenmatrix sind in Phase 1 als Grundregister angelegt; der Fachausbau folgt gemäß Masterplan

## Bewusst unverändert

- Auth-/Sessionpfad
- Supabase und IndexedDB
- Wunsch-/Excel-/Fotoimport
- Planungs-, Pausen- und Besetzungscores
- Istzeitimport
- Push/E-Mail-Safety
- Druck und Export

## Prüfung

- Release: 136/136 Dateien verifiziert
- JavaScript: 102/102 syntaktisch gültig
- Core-Smoke-Test: grün
- PWA-Startwächter: grün
- Runtime-Dateien: 130/130 verifiziert
- Console-Fehler beim Browserstart: 0

## Nächster TÜV

Nach regulärer Anmeldung sind Registerwechsel, Tastaturbedienung, Touch/Long-Press und die bestehenden Planfunktionen manuell gegenzuprüfen. Bei einem roten Ergebnis wird Phase 2 nicht begonnen.
