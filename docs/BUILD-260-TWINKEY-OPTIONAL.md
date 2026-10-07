# Build 260 RC – freiwillige Unterbrechungen und kompakte Tagesauswahl

06.10.2026, Basis `ac46ce7` (Build 259). A1 des Gesamtauftrags ist bereits enthalten. Dieser Build erfüllt A2/A3.

## KC-DP-WUNSCH-SPERRE-OPTIONAL (A2)

Die erste Tagesfrage ist „Kannst du an diesem Tag helfen?“ mit Ja/Zeiten, Nein/ganzer Sperrtag und „Weiß ich noch nicht“. Letzteres speichert keine Zusage, ändert vorhandene Angaben nicht und zeigt ausdrücklich, dass der Tag offen bleibt. Ganze Sperrtage und deren Bereitschaftsbereinigung funktionieren wie in Build 259.

Im Kann-Schritt ist die Unterbrechung ein standardmäßig geschlossener Klappbereich „＋ Zwischendurch verhindert (z. B. Arzttermin)“. Hilfetext: „Alles außerhalb der Kann-Zeit ist automatisch frei. Sperrzeit nur für Unterbrechungen innerhalb der Kann-Zeit.“ Von/Bis bleiben bewusst zu wählen; „Nur wenn nötig“ bleibt das Häkchen am Zeitraum.

Neue oder geänderte Unterbrechungen müssen vollständig in einer eingegebenen Kann-Zeit liegen. Außerhalb oder nur angrenzend: „Nicht nötig – außerhalb deiner Kann-Zeit wirst du sowieso nicht eingeplant.“ Die unnötige Sperrzeit wird aus dem Entwurf entfernt und nicht gespeichert; die Eingabe bleibt zur Prüfung geöffnet. Unvollständige Zeiten sperren Weiter. Eine Sperre über die gesamte Kann-Zeit benötigt eine Korrektur oder einen ganzen Sperrtag.

Für eine interne Unterbrechung wird die verfügbare Kann-Zeit beim Speichern in getrennte Zeitfenster aufgeteilt, einschließlich Reserve/Einsatzbereich. „Kann-Zeit als Wunsch übernehmen“ übernimmt ebenfalls nur die freien Teilfenster. Beispiel: Kann 11–19, Unterbrechung 13–14 ergibt Kann/Wunsch 11–13 und 14–19 sowie Sperrzeit 13–14. So bleiben die bestehenden Daten- und Überschneidungsregeln erhalten.

Vorhandene Sperrzeiten – auch außerhalb/angrenzend – bleiben gültig und werden beim unveränderten Bearbeiten beibehalten. Die Unterscheidung besteht nur im Assistentenentwurf, ohne neues gespeichertes Feld und ohne Migration. Wer eine bestehende Sperrzeit aktiv ändert, prüft sie nach der neuen Regel. Alte Bereitschaft am 10.12. (Sperre 13–14, Bereitschaft 14–21) bleibt erlaubt.

## KC-DP-TWINKEY-KLAPPBEREICHE (A3)

Die Tage stehen in einem anfangs offenen Klappbereich mit erledigter Anzahl und zwei Spalten. Zehn Markttage sind bei 390×844 Pixeln komplett sichtbar, oberhalb der unteren Navigation. Die Twinkey-Hilfe einschließlich Ton- und Anzeigeeinstellungen bleibt über einen eigenen Klappbereich erreichbar.

Antippen klappt die Tage zu, zeigt den gewählten Tag und „ändern“. Die Auswahl bleibt über `aria-pressed` markiert; die vollständigen Tagesinformationen bleiben in `aria-label`. „ändern“ öffnet die Tagesauswahl erneut und fokussiert die gewählte Kachel. Sanftes Scrollen führt zum Eingabeknopf oben im Bild. Die Zeitübersicht darunter ist anfangs geschlossen.

Wunschzeit und Alternativen stehen in Klappbereichen; der benötigte Abschnitt ist offen. Eine sticky Tageszeile mit „← Andere Tage“ bleibt im Eingabeschritt erreichbar. Ein Wechsel bei ungesicherten Entwürfen fragt vorher nach; ein laufender Speichervorgang kann nicht verlassen werden. „▶ Weiter mit …“, Speicherung, Ausdruck und die bestätigte Versandmeldung bleiben erhalten. „(Kann-Zeit)“ und „(Wunschzeit)“ bleiben in Klammern.

## Prüfungen und Übernahme

Ergebnis: `npm test` (neun Smoke-/Releaseprüfungen), Syntaxprüfung (225 JavaScript-Dateien), neun Browserprüfungen aus dem Paket plus Admin-Vorschau sind grün. Der gezielte Test prüft zusätzlich das Einfügen einer Unterbrechung in bereits gespeicherte Wünsche: Beide freien Seiten bleiben erhalten. Screenshots der Tagesauswahl wurden visuell geprüft. Alle Prüfungen verwendeten isolierte Testdaten; kein Live-Import oder Live-Versand.

Neu: `tools/test-twinkey-optional.mjs` im Browser-Testpaket. Prüft zwei Spalten/zehn sichtbare Tage, Zuklappen/Ändern, geschlossene Zeitübersicht, Sprung zur Eingabe, unbekannte Tage ohne Datenverlust, keine Pflicht-Sperrauswahl, äußere/angrenzende Sperren, interne Aufteilung, alte Daten und 320–1280 Pixel. Die bestehenden Mitglieder- und Versandtests sind an die freiwillige Unterbrechung angepasst.

Claude übernimmt den veröffentlichten Build-260-Commit mit `tools/dp2-twinkey-uebernehmen.mjs`, neuer Club-Version, aktualisierter Quelle/Prüfsummen und Commit-Cachekennung. Vorher den gemeinsamen Stand pullen. Die Club-App wird durch Codex nicht deployed; keine Echtdaten wurden verändert.

RC bleibt RC: Wiederherstellungsprüfung, Zwei-PC-Live-Test und Wilfrieds Rückmeldung bleiben vor FINAL offen. „Willfried“ unverändert.

## Separater Auftrag B – KC Manager

Nicht Teil dieses DP2-Builds. Das zugängliche Repository `Sire65/KC-Manager` ist leer und archiviert. Im aktuellen Kasse-PC-Manager wurde keine bestehende zentrale Personen-Schreibfunktion gefunden. Hansi wurde nach dem aktuellen KC-Manager-Ordner/Repository gefragt. Die freigegebene Änderungsmeldung wird bis zur Integration nicht geschrieben oder quittiert. Die zwei vorgegebenen RPCs sowie „erst vorhandener Personen-Schreiber, dann quittieren“, Audit, Fälligkeitsdatum und manuelle Mitgliedschaftsentscheidung bleiben die Anschlussvorgaben.
