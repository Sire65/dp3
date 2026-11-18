# Build 317 RC – Ampel ausschließlich nach Personenanzahl

Diese Regel ersetzt die Ampelregel aus Build 316 entsprechend der Vorgabe des Planers.

Verglichen wird die gleichzeitig gemeldete normale Kann-Anzahl mit dem Gesamtbedarf. Jede Person zählt einmal. Vorne, Hinten und B beeinflussen die Farbe nicht, auch wenn die Bereichsverteilung vom Bedarf abweicht.

- Rot: weniger Personen als Gesamtbedarf.
- Grün: genau so viele Personen wie Gesamtbedarf.
- Gelb: mehr Personen als Gesamtbedarf.

Die Kann-/Bedarf-Zeile und die Gesamtbewertung sind entsprechend gefärbt. Wunschzeit bleibt eine Teilmenge der Kannzeit. V/H/B, Reserve und ausdrücklich gemeldete Bereitschaft bleiben neutral und separat. „Nur wenn nötig“ zählt nicht stillschweigend zur vorbehaltlosen Kann-Anzahl.

Teilzeiten werden weiterhin getrennt geprüft. Grün gilt nur bei durchgehend passender Anzahl. Bei zeitweiser Unter- oder Überzahl steht „zeitw.“; wenn innerhalb einer Stunde sowohl Unter- als auch Überzahl auftritt, steht „wechselnd“ und die rote Farbe weist auf den tatsächlich unterbesetzten Teil hin. Der Detaildialog zeigt die genauen Zeitabschnitte.

Wunschzeiten, Bedarf und Dienste werden durch diese reine Anzeigeänderung nicht geändert. Der PDF-Ausdruck verwendet dieselbe Regel. Persönliche Einsatz- und Bereichsregeln bleiben Teil der eigentlichen Planprüfung und sind keine Farbursache in dieser Wunschstatistik.

Geprüft: 1.024 Kombinationen einschließlich falscher Bereichsverteilung bei exakt passender Kopfzahl; echte CSS-Farben im Browser, Wechsel Grün→Rot→Grün nach geänderter Personenanzahl, gelbe Überzahl, Bildschirm-/PDF-Legende und unveränderte Planungsdaten.
