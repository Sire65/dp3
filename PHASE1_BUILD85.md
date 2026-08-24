# KC DP2 V0.20.0 Build 88 – Phase 2

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
- automatische Updateprüfung beim Start, bei Rückkehr, nach Netzrückkehr und alle fünf Minuten
- klare Updatefrage „Ja, installieren“ oder „Nein, später“ mit Version und Buildnummer
- GitHub-Pages-Sperre gegen Veröffentlichungen ohne erhöhte Buildnummer
- eigener verschlüsselter DP3-IndexedDB-Namensraum ohne Zugriff auf alte Dienstplan-Gerätedaten
- kompakte Kopfzeile und zentrale Meldungszeile
- registerabhängige Hauptaktionen statt dauerhafter Button-Flut
- identische Aktionslogik auf Desktop, Tablet und Handy
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
