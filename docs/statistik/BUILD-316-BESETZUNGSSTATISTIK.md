# Build 316 RC: nachvollziehbare Wunsch-Besetzung

## Fachliche Bedeutung

Die Auswertung unter dem Wunschplan ist eine Prüfung möglicher Stundenbesetzung, kein Sollplan. Sie schreibt weder Wünsche noch Dienste, Bereitschaften, Bedarf oder Serverstand.

- Wunschzeit ist eine Teilmenge der normalen Kannzeit. Die beiden Zeilen werden nicht addiert.
- Jede Person gehört je Teilintervall zu genau einem normalen Bereich: nur V, nur H oder B. Überlappende Kann- und Wunschdatensätze erzeugen keine zweite Person. Gleichzeitige V- und H-Möglichkeiten werden zu einem gemeinsamen B-Pool zusammengeführt.
- B bedeutet vorne ODER hinten. Bei der Machbarkeitsprüfung verbrauchen die offenen V- und H-Plätze gemeinsam den B-Pool.
- „Nur wenn nötig“ bleibt außerhalb der vorbehaltlosen Verfügbarkeit. Reicht erst diese Möglichkeit, lautet die Bewertung „mit Vorbehalt“.
- Sperrtage, zeitweise Sperren, ausgeschiedene/inaktive und für den Tag gesperrte Personen werden nicht gezählt. Wunschzeit außerhalb einer vorhandenen expliziten Kannzeit wird als Widerspruch gemeldet; alte Wünsche ohne separaten Kann-Datensatz bleiben verwendbar.
- Bereitschaft wird nur aus einer ausdrücklichen Ja-Meldung mit Uhrzeit für den Tag gezählt. Sie ist eine separate Zeile ohne automatische Soll-/Bereitschaftszuweisung. Eine gleichzeitige eigene Verfügbarkeit schließt die Bereitschaft nicht aus.

## Anzeige

Die einzelnen Zahlen bleiben neutral. Nur die Gesamtbewertung bekommt eine Farbe:

- Grün „möglich“: mit den gemeldeten Bereichen abdeckbar.
- Gelb „Zuteilen“: genügend flexible Personen, Bereichszuteilung offen.
- Gelb „mit Vorbehalt“: nur mit ausdrücklich bedingten Angaben abdeckbar.
- Rot „n fehlt/fehlen“: selbst mit bedingten Angaben nicht abdeckbar. Genügend Gesamtpersonen allein genügen nicht, wenn der benötigte Bereich nicht abgedeckt werden kann.

Zeitwechsel innerhalb einer Stunde werden an den tatsächlichen Wunsch-, Sperr-, Bedarfs-, Programm- und Bereitschaftsgrenzen geprüft. Zusätzlich wird mindestens viertelstündlich ausgewertet. Zahlenbereiche wie 2–3 bedeuten wechselnde gleichzeitige Personenzahlen. Zwei aufeinanderfolgende halbe Stunden werden niemals zu zwei gleichzeitig verfügbaren Personen addiert. Benachbarte unveränderte Intervalle werden für die Details zusammengefasst.

Ein Klick auf die Gesamtbewertung zeigt Teilintervalle und Namen je Bereich, Reserve und Bereitschaft. Es gibt dort keine Einplanungsaktion. Persönliche Höchststunden, Pausen, Fairness und die eigentliche Diensteinteilung bleiben Aufgaben der Planprüfung; diese Statistik behauptet keine Freigabe eines fertigen Dienstplans.

## Druck

Die PDF-Schaltflächen unter dem Wunschplan verwenden dieselbe Auswertung wie der Bildschirm. Titel „Wunsch-Besetzungsübersicht“ und Legende unterscheiden sie vom Soll-/Istplan. Der bestehende Soll-/Ist-Matrixdruck bleibt erhalten.

## Nachweise

- tools/test-wish-staffing.mjs: gemeinsamer Flex-Pool, disjunkte Personen, Reserve, zeitliche Wechsel, Sperren, Widersprüche und explizite Bereitschaft. Zusätzlich 1.024 Konstellationen gegen unabhängige Aufteilung des B-Pools geprüft.
- tools/test-wish-staffing-browser.mjs: korrekte Ampel, neutrale V/H-Zahlen, mindestens 44px große Detailschaltflächen, Dialog bei 390px, sichere Namensdarstellung, Bildschirm/PDF identisch und unveränderte Planungsdaten.
- tools/test-staffing-matrix-print.mjs: bestehender Soll-Matrixdruck weiterhin korrekt.
