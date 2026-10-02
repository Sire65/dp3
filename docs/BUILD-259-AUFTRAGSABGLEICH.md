# Build 259 RC – vollständigen Build-258-Auftrag abgeglichen

Basis: Build 258 `b310e46`, 02.10.2026. Die Originaldatei `Auftrag_Codex_Twinkey_Build258.md` wurde nach Veröffentlichung von Build 258 bereitgestellt. Der veröffentlichte Verlauf bleibt erhalten; Ergänzungen werden deshalb als Build 259 ausgewiesen.

## KC-DP-TWINKEY-SPERRTAG-OHNE-BEREITSCHAFT

`standbyEnabled` berücksichtigt jetzt auch den Sperrtag für die jeweilige Person, einschließlich des aktuellen Entwurfs. Sperrtage haben weder Bereitschaftsfrage noch Bereitschaftszeile in Tages- oder Gesamtübersicht. Alte widersprüchliche Bereitschaft wird nicht in die Bereitschaftsstunden eingerechnet. Die Berechtigung für andere Kollegen bleibt unabhängig vom eigenen Sperrtag.

Hinweis im Entwurf: „Am Sperrtag ist keine Bereitschaft möglich – die Bereitschaft für diesen Tag wurde entfernt.“ Das betrifft die Entwurfsangabe; dauerhaft gespeichert wird erst mit „Angaben speichern“.

Die zentrale Tagesmatrixvalidierung erkennt Sperrtag plus Bereitschafts-Slots als ungültig. Beim Speichern bereinigt die Matrix diese Bereitschaft vor der Validierung in den Zeilen und im Tagescache, ohne andere Angaben zu löschen. Alte ungültige Fertigsignaturen werden beim Bereinigen nicht als fertig ausgegeben. Das Laden eines Tages normalisiert den Assistentenentwurf, verändert aber die Datenbank nicht ungefragt. Zeitweise Sperren bleiben erlaubt, getestet mit Sperre 13–14 und Bereitschaft 14–21 am 10.12.

## KC-DP-TWINKEY-VERSANDMELDUNG

„Fertig“ nach einem einzelnen gespeicherten Tag führt weiterhin zur optionalen Gesamtübersicht. Die Versandmeldung kommt jetzt am endgültigen Ausstieg („Jetzt beenden“ / „Fertig · Assistent verlassen“). Nach bestätigtem Versand bleibt der genaue Erfolgstext bis OK sichtbar; OK verlässt den Assistenten.

Fehlertext genau nach Auftrag: „Deine Dienstzeiten konnten gerade nicht verschickt werden. Bitte prüfe die Internetverbindung und tippe noch einmal auf ‚Fertig‘.“ Der Assistent bleibt offen und die Angaben erhalten.

Die Club-App verwendet ausschließlich ihren bestehenden `K.persistAll`-Anschluss, keine eigenen Netzaufrufe. Das bestätigte `true` des aktuellen Club-Anschlusses ist erforderlich; ein unbekanntes Ergebnis gilt nicht als Erfolg. Die zusätzliche Transportprüfung aus Build 258 bleibt ausschließlich im eigenständigen DP2 erhalten, weil dessen `persistAll` zunächst lokal speichert und eine lokale Sicherung keinen Versand beweist.

## Prüfung und Übergabe

Ergebnis: `npm test` (neun Smoke-/Releaseprüfungen), Syntaxprüfung (224 JavaScript-Dateien), die acht Prüfungen aus `test:browser` und zusätzlich die Admin-Vorschau sind grün. Die Ansichten und der OK-Dialog wurden im Browser auf 320/390/768/1280 Pixeln geprüft. Ein Live-Handtest durch Hansi/Wilfried ist damit nicht ersetzt; alle Transportantworten waren simuliert.

Der neue Versand-Browsertest ist auf den endgültigen Ausstieg angepasst und prüft zusätzlich alte Sperrtagdaten, ausgeblendete Bereitschaft, null Bereitschaftsstunden sowie zentrale Validierung/Bereinigung beider Speicher. Bestehende Abschluss- und Drucktests sind auf den endgültigen OK-Dialog angepasst.

Claude übernimmt den endgültigen Build-259-Commit mit dem bestehenden Club-App-Übernahme-Werkzeug, erneuerter Club-Version, Quelle/Prüfsummen und Commit-Cachekennung. Die angekündigte zusätzliche Serverbereinigung übernimmt Claude. Die Mitgliederdaten und Live-Datenbank wurden durch Codex nicht verändert.

Stand bleibt RC: Wiederherstellungsprüfung, Zwei-PC-Liveprüfung und Auswertung von Wilfrieds Test fehlen vor FINAL. „Willfried“ bleibt unverändert.
