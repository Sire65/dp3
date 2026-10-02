# Build 255 RC – Reservierter Club-App-Wunscheingang

Feature: **KC-DP-WUNSCH-SPERRE** · 02.10.2026 · Basis: Build 254 RC `3945960`.

## Ergebnis

DP2 verwendet die von Claude bereits eingespielten RPCs `kc_dp_wish_inbox_claim`, `kc_dp_wish_inbox_ack_claimed`, `kc_dp_wish_inbox_release` und `kc_dp_wish_inbox_receipt`. Es wurden keine Tabellen, RPCs oder Live-Mitgliederdaten geändert. Die Signaturen und Execute-Rechte wurden lesend in Supabase geprüft: authenticated berechtigt, anon nicht berechtigt.

Der Tagesvergleich aus Build 252 findet weiterhin vor der Reservierung statt. Nach den Entscheidungen und der Validierung wird unmittelbar vor dem lokalen Eintragen für zehn Minuten reserviert. Die vorhandene Gerätekennung stammt aus `K.multiDeviceTest.identity()`. Ohne Kennung oder bestätigte Reservierung wird nichts eingetragen. Ändern sich Anmeldung, Veranstaltung oder die verglichenen Angaben während der Reservierung, wird abgebrochen beziehungsweise erneut geprüft.

Das Token wird im dauerhaften lokalen Beleg zusammen mit dem begonnenen Benutzerkonto gespeichert. Die lokalen Änderungen bleiben als `club_pending` zurückgehalten, bis die Bestätigung erfolgreich ist. Bei `claimed` werden keine lokalen Angaben angelegt; auch ein zweiter PC mit demselben Konto ist damit gesperrt. `stale` und `claim_lost` rollen die lokale Übernahme zurück. Bei lokalen Fehlern wird die Reservierung freigegeben; ein Fehler beim Freigeben wird aufgefangen, weil die Reservierung abläuft.

## Wiederaufnahme

Für neue Belege prüft DP2 den Serverbeleg. Nur `takenClaim === meinToken` und `takenRevision === meineRevision` bei abgeschlossenem Eingang geben den gesicherten Stapel frei. Ein bloß fehlender offener Eingang genügt nicht. Bei offenem Eingang gleicher Revision wird mit dem gespeicherten Token erneut bestätigt, ohne ein zweites Mal einzutragen. Ein gelöschter Eingang, eine andere Übernahme oder eine neue Revision führen zum Zurückrollen. Netzwerkfehler oder unklare Antworten lassen den Stapel gesperrt.

Das Zurückrollen neuer Belege betrifft nur die tatsächlich angefassten Wunsch-IDs und Bereitschaftstage. Unabhängig hinzugekommene Angaben anderer Tage und frisch gelesene Serverfreigaben bleiben erhalten. Belege ohne Token aus Build 254 werden einmalig nach dem bisherigen Übergangsweg verarbeitet. Dieser Altweg bietet keinen eindeutigen Gerätebeweis und darf vor dem parallelen Live-Test nicht mehr offen sein.

Die Kollegenfreigabe wird nicht aus dem Eingang lokal gesetzt. Berechtigungen bleiben Serverdaten; `sharingApplied` und `shareWithColleagues` aus einer erfolgreichen Bestätigung werden angezeigt. Kopierberechtigungen werden durch diesen Client nicht erweitert. Die bisherigen Papier-/PDF-/QR- und Mitgliederfunktionen aus Build 254 bleiben enthalten. „Willfried“ wurde nicht geändert.

## Automatisierte Prüfung

`tools/smoke-club-interface.mjs` umfasst die vorhandenen Schnittstellentests und einen gemeinsamen RPC-Simulator mit zwei getrennten DP2-Instanzen:

1. PC A reserviert; PC B trägt nichts ein. A bestätigt allein.
2. Gleiches Benutzerkonto auf zwei Geräten wird über unterschiedliche Gerätekennungen getrennt.
3. Neustart mit offenem Eingang gleicher Revision bestätigt den gespeicherten Stapel ohne zweiten Import.
4. Nach abgelaufener Reservierung übernimmt B; A erkennt fremdes `takenClaim` und rollt zurück. Auch verlorene Reservierung bei noch offenem Eingang wird geprüft.
5. Neue Mitgliedsrevision während der Bestätigung führt zum Zurückrollen.
6. Verlorene ACK-Antwort nach erfolgreicher Serverbestätigung wird anhand des eigenen Tokens erkannt.
7. Lokaler Fehler rollt zurück, gibt die Reservierung frei und sendet kein ACK.
8. Ablehnung reserviert ebenfalls; fremde Reservierung verhindert die Ablehnung.
9. Freigaben werden nicht lokal aus dem Eingang gesetzt und Kopierrechte nicht erweitert.

Zusätzlich geprüft: gelöschter Eingang, fehlende Gerätekennung, Sitzungwechsel, unabhängige neue Tagesangaben beim Zurückrollen, vorhandener Tagesvergleich/Behalten/Ersetzen sowie Parameter und Bearer-Transport der vier neuen Provider-RPCs.

`tools/test-club-interface.mjs` prüft den tatsächlichen Vergleichsdialog, Behalten und die sichtbaren Ergebnisse `claimed`/`claim_lost` bei 320/390/768/1280 Pixeln. Kein gesperrter oder zurückgerollter Import erscheint dort als erfolgreicher Import.

## Übergabe an Claude

Den endgültigen Build-255-Commit auf `codex/club-app-interface` mit dem bestehenden Werkzeug `node tools/dp2-twinkey-uebernehmen.mjs <dp3-Pfad>` übernehmen, Club-Version erhöhen und Vertragstests 142/146/149/151 aktualisieren. Vorher den Club-App-Hauptzweig aktualisieren. `dp2/QUELLE.json`, Prüfsummen und Commit-basierte Cache-Kennung erneuern. Kein Zurücksetzen des gemeinsamen Verlaufs. Stage bleibt **RC**.

## Noch vor FINAL: Wiederherstellung und Live-Handtest

- Alle importierenden Planer-PCs müssen Build 255 verwenden. Offene Belege aus Build 254 zuerst abschließen und kontrollieren. Zwei PCs brauchen unterschiedliche dauerhaft gespeicherte Gerätekennungen, auch bei gleichem Konto.
- Einen gesicherten Teststand mit Wünschen, Bereitschaft und Planständen exportieren und in einer isolierten Testumgebung wiederherstellen. Zeilen, Tagesarten, Bereitschaft und Stunden mit dem gesicherten Stand vergleichen. Eine erfolgreiche Sicherung allein ist noch kein Wiederherstellungsnachweis.
- Mit einem vereinbarten Testmitglied auf zwei echten PCs gleichzeitig denselben Eingang abrufen. Nur einer darf importieren. Den zweiten Status und den Serverbeleg kontrollieren.
- Direkt in DP2/Twinkey gespeicherte Angaben gegen eine abweichende Handy-Version testen: Behalten, Ersetzen und erneute Handy-Änderung während der Vorschau. Ergebnisse auf beiden PCs nach dem Sync vergleichen.
- Verbindungsabbruch während der Bestätigung und Neustart prüfen: eigene Bestätigung wird erkannt, keine doppelten Zeilen. Ebenso fremde Übernahme nach Ablauf der Reservierung und erneuten Abgleich prüfen.
- Kollegen-Sichtfreigabe Ja/Nein sowie bereits vorhandene Kopierrechte kontrollieren. Danach Testdaten gezielt aufräumen und den geprüften Commit im Freigabeprotokoll festhalten.

Die automatisierten Clienttests ersetzen diese Wiederherstellungs- und Zwei-PC-Liveprüfung nicht. Die Claim-RPC koordiniert den Eingang; verschlüsselte Planoperationen werden weiterhin über die bestehende Sync-Warteschlange übertragen. Die Freigabe für Echtdaten erfolgt erst nach den noch offenen Prüfungen. Stevens tatsächlicher Eingang wurde durch diese Entwicklung nicht übernommen oder verändert.
