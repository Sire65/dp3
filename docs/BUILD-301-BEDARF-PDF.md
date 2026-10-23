# Build 301 – Bedarf als PDF

Im Register **Bedarf** öffnet **Bedarfsmatrix als PDF** jetzt die Druckauswahl:

- **Kompakte Übersicht:** Tagesblöcke mit Datum, Zeit, Bedarf, V und H. Gleiche unmittelbar benachbarte Werte werden zusammengefasst. Automatisch möglichst eine, sonst zwei A4-Querseiten; keine Verkleinerung unter 10 pt und kein Abschneiden bei umfangreicheren Ausnahmen. Bei besonders vielen unterschiedlichen Zeitfenstern sind weitere Seiten möglich und werden nach der Erstellung angezeigt.
- **Tagesblätter:** jeder Tag beginnt auf einer neuen Seite, unveränderte Zeitzeilen. Überlange Tage werden mit wiederholtem Kopf fortgesetzt.
- Auswahl **alle Tage**, **aktueller Tag** oder **bestimmte Tage** mit fingergeeigneten Ankreuzfeldern.

Unter jedem Tag stehen die zeitgewichteten Personalstunden für Gesamtbedarf, Vorne und Hinten. Die ausgewählten Tage werden am Ende zusätzlich summiert. Unbekannte Bereichszuordnungen werden als Strich dargestellt, nicht als null. Null-Bedarf bleibt sichtbar. Getrennte Zeitfenster werden nicht über Lücken hinweg verbunden.

Original-Kochmütze und burgunderfarbener CD-Kopf, Zeitraum, Legende, Erstellungsdatum, Datenstand und Seitenzahl erscheinen auf allen Seiten. Die bestehende PDF-Erzeugung wird erweitert; keine zusätzliche PDF-Bibliothek und kein Popup erforderlich.

Im primären Arbeitsmodus liest `cloudPrimary.confirmedSnapshot()` den bestätigten Serverstand nochmals. Bei ungespeicherten Änderungen im Bedarfseditor, offenen Übertragungen, Konflikten oder einer inzwischen geänderten Serverversion entsteht keine PDF mit vermeintlich bestätigten Werten. Der Druck verändert weder die Bedarfsmatrix noch Wünsche, Soll-Dienste oder Supabase-Datensätze. Die alte programmatische Tages-PDF-Schnittstelle bleibt kompatibel.

Prüfung: 13 Tage auf zwei A4-Querseiten mit Testdaten erzeugt, beide Seiten als Bilder geprüft. Vollständige Intervallabdeckung, kein Zeilenverlust, Bereichs- und Gesamtsummen, halbe Stunden, Bereich ohne Zuordnung, keine Zusammenfassung über Zeitlücken, Tagesblätter, Tagesauswahl, Druck aus dem bestätigten Stand statt einer abweichenden lokalen Matrix und Fehlermeldung bei offener Übertragung getestet. Dialog bei 390 Pixel Breite geprüft. Die statische Test-PDF enthält ausschließlich Prüfdaten und ist kein Ausdruck des realen Mitglieds-/Bedarfsbestands.
