# Build 258 RC – Sperrtag und bestätigter Versand

Basis: Build 257 `37bd067`, Zweig `codex/club-app-interface`, 02.10.2026.

## KC-DP-TWINKEY-SPERRTAG-OHNE-BEREITSCHAFT

Ein ganzer Sperrtag führt direkt zur Zusammenfassung ohne Bereitschaftsfrage. Vorhandene Bereitschaft wird im Entwurf auf `{answer:'no',slots:[]}` gesetzt. In der Sperrauswahl und Zusammenfassung steht der Hinweis, dass sie beim Speichern entfernt wird. Erst „Angaben speichern“ aktualisiert die gespeicherten Angaben. Tageszeile und `memberUxData.assistantStandby` erhalten denselben Wert. Ein erneutes Öffnen eines alten widersprüchlichen Sperrtags normalisiert ebenfalls den Entwurf; Öffnen allein speichert nichts.

Zeitweise Sperren bleiben unverändert. Regression: 10.12. Sperrzeit 13–14, Bereitschaft 14–21 und Kann-Zeit 21–23. „(Kann-Zeit)“ und „(Wunschzeit)“ bleiben erhalten.

## KC-DP-TWINKEY-VERSANDMELDUNG

Der Abschluss „Fertig“ nach dem gespeicherten Tag prüft weiter offene Tage, speichert den aktuellen Stand und wartet auf bestätigten Versand. Die Erfolgsmeldung lautet genau:

> Deine Dienstzeiten wurden erfolgreich verschickt.

Sie bleibt in einem modalen Dialog bis „OK“ stehen; Escape schließt sie nicht. Danach kommt die bestehende Gesamtübersicht. Der endgültige Ausstieg überprüft erneut, falls sich seit der Bestätigung Angaben geändert haben. Unveränderte, in dieser Sitzung bestätigte Angaben erzeugen keine doppelte Erfolgsmeldung. Einzelne Tages-Speichervorgänge bleiben ohne Versandmeldung.

Club-App: Das vorhandene `KC_CLUB_DW_API` kennzeichnet den Anschluss; nur `K.persistAll() === true` nach erfülltem Promise gilt als Bestätigung. Die bestehende Club-Speicherfunktion wartet auf `dienstwunsch_speichern` und gibt auch bei bereits bestätigtem unverändertem Stand `true` zurück. Es werden keine neuen RPCs vorausgesetzt.

Eigenständiges DP2: lokales Speichern allein genügt nicht. Healthcheck muss erfolgreich sein; `sync.flush({force:true})` muss ohne Fehler, Konflikte oder offene Warteschlangeneinträge abschließen. Der ausdrückliche erneute Abschluss versucht ausstehende `pending`-Operationen sofort erneut; normale automatische Wiederholungen behalten ihre Wartezeit. `club_pending`, Konflikte und bereits laufende Übertragungen werden nicht freigegeben. Negative Serverantworten bleiben in der Warteschlange.

Bei Fehlern bleibt der Benutzer am Abschluss; Hinweis und erneut aktiver Knopf „Fertig“. Keine Angaben werden gelöscht. Während des Versands sind die Knöpfe gesperrt. Bei Wechsel der Anmeldung, des sichtbaren Schritts oder der Angaben gibt es keine Erfolgsmeldung für den alten Stand. Die isolierte Admin-/Twinkey-Vorschau ohne Serveranschluss darf keinen echten Versand behaupten.

## Prüfung und Übernahme

Ergebnis: `npm test` (neun Smoke-/Releaseprüfungen), Syntaxprüfung (224 JavaScript-Dateien), die acht Prüfungen aus `test:browser` und zusätzlich `test-twinkey-admin` sind grün. Es wurden ausschließlich isolierte Testdaten und simulierte Transportantworten verwendet; kein Live-Versand wurde ausgelöst.

- Neuer Browser-Vertragstest `tools/test-twinkey-submission.mjs` in `test:browser`: zeitweise Sperre, Bereitschaft entfernen in beiden Speichern, Hinweis, keine Frage am Sperrtag, stummer Tages-Speichervorgang, fehlerhafter/fehlender/verspäteter ACK, erneuter Abschluss ohne Datenverlust, gesperrte Knöpfe, OK/Escape, Warteschlange und 320–1280 Pixel.
- Neuer `tools/smoke-submission-sync.mjs` in `npm test`: negative Serverantwort, unveränderte automatische Wartezeit, ausdrücklicher Sofortversuch sowie unangetastete Claim-/Konflikt-/laufende Sperren.
- Bestehende Abschlussprüfungen in `test-member-button-logic` und `test-wish-print` bestätigen den neuen OK-Dialog mit simuliertem erfolgreichem Transport.

Claude übernimmt den veröffentlichten Commit mit dem bestehenden Übernahme-Werkzeug, neuer Club-Version, Prüfsummen und Commit-Cachekennung. Die Club-App muss vor Übernahme gepullt werden. Die angekündigte serverseitige Sperrtag-Normalisierung baut Claude; Codex hat weder die Club-App noch Live-Datenbank oder Mitgliederdaten verändert.

Stage bleibt **RC**. Wiederherstellungsprüfung, Zwei-PC-Live-Test und Wilfrieds Rückmeldung bleiben vor FINAL offen. „Willfried“ bleibt unverändert.
