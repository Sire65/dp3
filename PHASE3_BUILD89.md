# KC DP2 V0.20.0 Build 89 – Phase 3

## Programmstart

- Bereits verifizierte Programmdateien werden beim Start sofort aus dem aktiven Release-Cache ausgeliefert.
- Manifest-, SHA-256- und Supabase-Startprüfung laufen vollständig im Hintergrund weiter.
- Der Startstatus beginnt sichtbar mit „GELB – Hintergrundprüfung läuft“ und wechselt nach dem Ergebnis zu Grün, Gelb oder Rot.
- Das Login-Hintergrundbild wird im Startdokument mit hoher Priorität vorab angekündigt.

## Register „Fairnis“

- Ist-Stunden je Person als zugängliche Balkengrafik mit Textwerten
- sortierbar nach Abweichung, Ist-Stunden und Name
- Filter nach Planzeitraum, Team/Personengruppe und vorhandenen Tätigkeitsangaben
- Kennzahlen für Gesamtstunden, Durchschnitt, Median, größte Über-/Unterdeckung und Verteilungsspanne
- Vergleichsbasis ohne feste Vollzeitannahme: hinterlegte Sollstunden, ansonsten Sollplan, explizite Verfügbarkeit oder Teamdurchschnitt
- vorhandene Abwesenheiten reduzieren hinterlegte Sollwerte anteilig
- Abweichung in Stunden und Prozent; bei 0-Stunden-Basis bewusst keine irreführende Prozentzahl
- Details je Balken erklären Vergleichsbasis, Sollplan und Verfügbarkeit
- Richtung und Größenordnung stehen immer als Text bereit; Farbe ist nur ergänzend
- fehlende Istzeiten werden klar gemeldet und nicht durch Sollzeiten ersetzt
- Fairnis-Auswertung kann als CSV heruntergeladen oder über den Druckdialog als PDF ausgegeben werden

## Tageskennzeichnung

- Aufbau- und Nachbereitungstage sind in allen Tagesboxen schräg schraffiert.
- Samstage und Sonntage sind hellgrau unterlegt.
- Treffen beide Merkmale zusammen, bleibt die Schraffur auf hellgrauer Wochenendfläche sichtbar.

## Architekturgrenze

Die Ansicht ist rein lesend. Sie verändert weder Personen noch Soll-/Istzeiten, Verfügbarkeit, Abwesenheiten, IndexedDB, Supabase oder Auditdaten.
