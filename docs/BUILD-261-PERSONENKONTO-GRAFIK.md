# Build 261 RC – KC-DP-PK-GRAFIK

Auftrag vom 06.10.2026 umgesetzt in src/ui/person-account-print.js, auf Build 260 RC.

Je Person bleiben Tabellenaufteilung und Auswertung unverändert. Danach folgen standardmäßig Grafikseiten: Tagesstunden mit Wunsch-/Ist-Säulen und Soll-Strich, Gesamtbalken und Zeitspuren. Der Druckdialog bietet „Grafikseite mitdrucken“, standardmäßig eingeschaltet. Ausgeschaltet bleibt die vorherige Tabellen-Ausgabe erhalten.

Fehlende Buchungen sind rot schraffiert und beschriftet. Das Gesamt-Ist zeigt die bisher erfassten Stunden und wird ausdrücklich als unvollständig bezeichnet; Differenzen bleiben dann offen. Ohne Wünsche erscheinen Hinweiskasten und Striche statt erfundener Wunschstunden. Pseudonym-Ausgabe gilt auch im Hinweis. Es gibt kein neues Datenfeld und keine Speicherung. Ein freier allgemeiner Wunschtext ohne Zeitangabe ist im bestehenden Konto-Datenmodell nicht vorhanden; Sperrzeit-Kommentare werden nicht als solcher umgedeutet.

Nur aktive Tage erscheinen in Grafiken, maximal 14 je Grafikseite. Weitere Grafiken schließen direkt an dieselbe Person an, bevor die nächste Person beginnt. Summen beziehen sich auf den ganzen gewählten Zeitraum. Kopf/QR nutzen den bestehenden Druckvertrag. Zeitspuren zeigen mindestens 8 bis 24 Uhr und erweitern sich bei Zeiten außerhalb dieses Bereichs, damit nichts abgeschnitten wird. Schraffur, Helligkeit, feste Spurpositionen und Soll-Strich erhalten die Bedeutung beim Schwarz-Weiß-Druck.

Prüfung: neuer Browsertest tools/test-person-account-graphs.mjs prüft Standard und Abschalten, unveränderte Tabellen/Auswertung, fehlende Buchungen, keinen Wunsch, Pseudonym, Reihenfolge/Seitenzählung und 30 aktive Tage einschließlich Überlauffreiheit der Grafikseiten. Die repräsentative PDF wurde gerendert und visuell geprüft. npm test, die Syntaxprüfung und alle zehn Browserprüfungen (inklusive neuer Grafikprüfung) sind grün. Kein Eingriff in Echtdaten, keine Datenbankänderung.

Übergabe: Personenkonto ist ein DP2-Druckmodul, keine Twinkey-Ablaufänderung. Stand bleibt RC; kein Server-Einspielen durch diesen Auftrag.
