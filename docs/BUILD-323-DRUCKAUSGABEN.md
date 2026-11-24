# Build 323 RC · Dienstplan-Druck

Einstieg: **Druck / PDF** in der Kopfleiste bzw. **Mehr → Schnell-Druck**. Der Wunschplan-PDF-Knopf öffnet die Auswahl mit dem aktuellen Tag, der Bedarfsmatrix-PDF-Knopf mit der Regelmatrix. Bestehende Dokument- und CSV-Funktionen bleiben im Programm verfügbar.

## Ausgaben und Filter

Wunschplan, Sollplan, Gesamt (Wünsche / Dienste übereinander), Einsatzplan (ein ganzer Tag je Blatt), Regelmatrix mit Besetzung, Sollstunden, Wunschstunden, Lückenblatt und Vorschläge für die Planung. Mehrere Ausgaben können zusammen in eine Datei. Optional Stunden- und Lückenblätter am Ende; keine doppelten Zusatzblätter.

Alle Tage, aktueller Tag, ausgewählte Tage, Aufbau, Markt oder Nachbereitung; Personen einschließlich Einzelplan; alle Bereiche, vorne oder hinten; Bereitschaft und Auswertungszeilen an/aus. Ein Blatt breit 8–23 Uhr oder zwei Blätter breit 8–16 und 15:30–23 Uhr. Die halbe Stunde Überlappung ist im Fuß als Klebekante bezeichnet. Tagesblöcke werden niemals senkrecht geteilt. Zu große Tagesblöcke führen zu einer verständlichen Aufforderung, Personen auszuwählen, statt Zeilen abzuschneiden oder unlesbar zu verkleinern.

## Datenregeln

Reine Ausgabe des geladenen DP2-Standes, keine Neuberechnung, Mutation, Übernahme oder Veröffentlichung. Keine neuen Serverwege. Die Club-App wurde ausschließlich als Quellvorbild gelesen und nicht geändert.

- Eigene Wünsche: `club_app`, `self_service` sowie geprüfte Formular-/Papier-/Handschrift-Eingaben; keine `admin_entry` oder unbekannte Herkunft. Explizit als Planer-Ergänzung markierte Angaben bleiben ebenfalls draußen. Ohne eigene Eingaben erscheint „nicht selbst eingetragen“. Sperren haben Vorrang; überlappende Wunschfenster werden nicht doppelt summiert.
- Karla, Fridbert und Peter sind aus diesem Veranstaltungsdruck ausgeschlossen; weitere nicht planbare, inaktive und am Tag gesperrte Personen ebenfalls. Kommentare, Abwesenheitsgründe, Kontakte und Gesundheitsangaben sind keine Druckfelder.
- Bereitschaft nur aus eingetragenen Zeitfenstern bzw. dem DP2-Bereitschaftsplan, separat. Sie erhöht weder Wunsch- noch Sollstunden oder Besetzungszahlen. Ein generelles „bereit“ erzeugt kein Fenster.
- Bedarf aus `requirementFor`, Programm-Zuschlag als Differenz zum Grundbedarf. Besetzung zählt eindeutige Personen; Sonderdienste zählen nicht zur Standbesetzung. Pausen und Stundenabrechnung folgen der DP2-Konfiguration. Gesamtampel ausschließlich nach Gesamtzahl, V/H nur feste Zuordnungen. Bei Personen-/Bereichsfiltern warnt der Fuß, dass die Gesamtvorgabe bestehen bleibt und nur die Auswahl gezählt wird.
- Vorschläge ändern nichts und verwenden nur passende hinterlegte Angebote, ohne Sperren, Überschneidungen oder Warnungen der Dienstprüfung. Keine automatische Bereitschaft.

## PDF und Prüfung

Direkte komprimierte Vektor-PDFs: Texte, Rechtecke, echte Linien, ein gemeinsam eingebettetes KC-Logo. Keine Streifen, Verläufe, Seitenbilder oder Masken. A4 quer; feste Blattgrenzen; Kopf und Seitenzählung auf jeder Seite. Vor Download/Drucken erscheint die PDF-Vorschau. Dateien ab 1 MB werden mit Hinweis auf eine kleinere Auswahl abgewiesen.

Neue reproduzierbare Prüfungen: `tools/test-print-center.mjs` und `tools/test-print-center-browser.mjs`. Letztere erstellt 36 PDFs: alle neun Arten, aktueller Tag / alle Tage, ein / zwei Blätter breit; außerdem Auswahl und Vorschau. Lokale Echtdaten bleiben unter `tmp/`, niemals im Repository oder Release.

Lesender Datenabgleich am 24.11.2026: Die lokale Prüffassung des Club-App-Druckstands vom 23.11.2026, 21:23:47 UTC, liefert bei identischer Eingabe exakt dieselben Soll- und Wunschstunden je Person und **10,5 fehlende Personenstunden**. Eine separate PDF-Prüfung kontrolliert Blattanzahl, A4-Grenzen, keine leeren Seiten, keine Schattierungen und keine ausgeschlossenen Angaben. Die größte geprüfte Einzeldatei lag unter 200 KB.

**Datenstände sind nicht gleich:** In den veröffentlichten DP2-Tabellen standen beim lesenden Abgleich nur drei Soll-Dienste, während die Club-App einen vollständigen berechneten Plan für 13 Tage hatte. Der neue Druck importiert diesen nicht. Der identische Zahlenvergleich belegt die Rechnung bei gleichem Stand, nicht eine bereits erfolgte vollständige Übernahme in den aktuellen DP2-Arbeitsstand.
