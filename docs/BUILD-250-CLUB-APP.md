# Build 250 RC – DP2 / Club-App

Basis: aktueller `Sire65/dp3` main, Commit `7b1469c`. Lokaler Branch `codex/club-app-interface`. Versionsvertrag: `release-version.json` (0.20.0, Build 250, RC). Nicht veröffentlicht, keine produktiven Daten verändert.

## Verhalten

Nach dem normalen Auto-Sync und der Sollplan-Veröffentlichung laufen zwei unabhängig abgefangene Schritte:

1. DP2 veröffentlicht alle Veranstaltungstage mit den wirksamen Tagesüberschreibungen, Kernzeiten, Grundbedarfsblöcken und Programmhinweisen. Auch ein leerer Snapshot wird gesendet. Konfiguration und Twinkey benutzen dieselben Tagesobjekte. Aus der Cloud geladene Tagesüberschreibungen werden ebenfalls angewendet.
2. DP2 holt Club-App-Eingänge ab, prüft Person, Planungsberechtigung und Wunschphase. Nur Club-App-Wünsche derselben Person im Veranstaltungszeitraum werden ersetzt. Direkte DP2-Einträge bleiben erhalten. Ungültige Einträge werden mit Begründung übersprungen. Anschließend werden Daten lokal verschlüsselt gesichert und quittiert.

Bereitschaft, `onlyIfNeeded` und `assistantDay` bleiben erhalten. Die Schlüsselreihenfolge der Bereitschaft wird anhand der unveränderten `completedSignature` wiederhergestellt; Twinkeys tatsächliche Statusfunktion wurde getestet.

Die Mutationen und der vorhandene verschlüsselte Sync bleiben zuständig. Ein kleiner zusätzlicher Sync-Datensatz `club_wish_meta` trägt Bereitschaft und Freigabehinweise auch zu anderen DP2-Clients. Die vorhandene Serverfunktion erlaubt diese Entität den drei Planungsrollen; keine Migration notwendig. Alte Clients kennen diesen Zusatz nicht – beteiligte DP2-Clients auf Build 250 aktualisieren.

Die Istzeit-Schnittstelle verwendet nun durchgehend den Event-Fallback `KC-WM-2026`.

## Fehler und Wiederanlauf

- Mutationen werden synchron als Batch vorgemerkt. Bis zur Quittierung können ihre Sync-Operationen nicht gesendet werden.
- Fehler vor Abschluss der lokalen Speicherung rollen Wünsche, Bereitschaft, Freigabemetadaten, Audit und Import-Queue zurück; es erfolgt keine Quittierung.
- Ein gespeicherter Importbeleg verhindert doppelte Einträge, auch nach Neustart oder verlorener ACK-Antwort.
- Eine unmittelbar erhaltene `stale`-Antwort rollt den lokalen Batch zurück. Eine neuere offene Revision wird im nächsten Lauf eingelesen.
- Ist nach einem ACK-Netzwerkfehler kein offener Eingang mehr vorhanden, bleiben die bereits gesicherten Daten erhalten und die Queue wird freigegeben. Die bestehende RPC unterscheidet nicht zwischen eigener erfolgreicher Quittierung, Quittierung durch einen zweiten PC oder einer Ablehnung durch einen zweiten PC. Diese verbleibende Mehrdeutigkeit benötigt für eine strikte Mehr-PC-Garantie einen serverseitig lesbaren Übernahmestatus. Im Handtest zunächst einen Planungs-PC verwenden.
- Während einer offenen Importbestätigung ist die betreffende Person gegen konkurrierende Wunschänderungen geschützt; Undo/Redo wartet ebenfalls auf den Abschluss.

## Noch offen: zentrale Kollegenfreigabe

Die produktive Datenbank wurde am 30.09.2026 ausschließlich lesend geprüft:

- Alle drei geforderten RPCs sind mit den erwarteten Parametern vorhanden.
- `kc_dp_plan_sharing` enthält nur `org_id`, `person_id`, `plan_kind`, `allow_view`, `allow_copy`; keinen Änderungszeitpunkt.
- INSERT/UPDATE erlauben ausschließlich `membership.person_id = plan_sharing.person_id`. Ein Planer kann also nicht die Freigabe des eingegangenen Mitglieds zentral speichern.
- `kc_dp_wish_inbox_ack` aktualisiert nur den Eingang, nicht die Freigabetabelle.

Der Client speichert die eingegangene Entscheidung in den vorhandenen Mitgliedsmetadaten. Ein Nein schränkt die lokale Ansicht ein. Ein Ja erweitert keine vorhandenen zentralen Rechte. Ist eine zentrale Änderung nötig, erscheint ein Hinweis im Übernahmeergebnis und im E-Mail-Center. Das Mitglied kann seine Freigabe in DP2 selbst speichern. Keine Umgehung der RLS, kein Service-Schlüssel im Browser.

**Übergabe an Claude/Backend für die vollständige Automatik:** Die vorhandene `kc_dp_wish_inbox_ack` könnte bei erfolgreicher, revisionsgleicher Übernahme die drei Freigabezeilen für exakt `inbox.org_id + inbox.person_id` aus `inbox.share_with_colleagues` aktualisieren. Nicht aus einer frei übergebenen Personen-ID. Nur wenn der Wert nicht null ist; derselbe Datenbankvorgang wie die Quittierung. Zusätzlich wäre ein eindeutig abfragbarer Übernahmebeleg für verlorene ACK-Antworten sinnvoll. Diese Änderung wurde wegen „Bereits vorhanden (nicht ändern)“ im Auftrag **nicht** durchgeführt. Nach Backend-Anpassung Client-Fallback entfernen/vereinfachen und beide Richtungen der Freigabe erneut prüfen.

## Automatisch geprüft

- `smoke-club-interface`: 13 Tage, leere Snapshots, wirksame Overrides, zusammengefasste Bedarfe, REST-Parameter/Auth, Rollen, Ersetzen, direkte Daten, Duplikate, Validierung, geschlossene Phase, Rollback, `stale`, verlorenes ACK, Neustart, neuere Revision, Bereitschaft, Freigabesicherheit und reale Twinkey-Fertigprüfung.
- Bestehende Smoke-Tests: Core, UI-Verträge, Wunsch–Soll–Ist-Transfer, Ist-Abgleich, TimeClock-Supabase.
- `supabase-security-contract`.
- Browser: Twinkey, mobile Matrix, Wunschassistent, Besetzungsanzeige; 320–1280 px.
- Neue Club-App-Statusanzeige: 320/390/768/1280 px, vollständige Problemliste, HTML-Escaping.
- Release-Manifest: Dateigrößen und SHA-256, Runtime-Verweise, zentraler Versionsvertrag.

Die Tests arbeiten mit Testdaten und simulierten Transportantworten. Die Live-Prüfung prüfte nur Schema/Funktionsdefinitionen, nicht den produktiven Schreibweg.

## Handtest Hansi – RC → FINAL

1. Diese Arbeitskopie separat starten, beispielsweise mit `START_LOCAL_WINDOWS.bat`; danach `http://localhost:8000/` öffnen. Build 250 prüfen. Eine bereits laufende ältere Instanz nicht mit dieser Version verwechseln.
2. Als Planer/Admin anmelden, Online-Sync aktivieren, Wunschphase offen lassen. Einen Abgleich ausführen. In der Club-App dieselben Tage/Kernzeiten prüfen.
3. Mit einer Testperson in der Club-App Kannzeit, abgedeckte Wunschzeit, Sperrzeit/Sperrtag, Nur-wenn-nötig und Bereitschaft eintragen; einen Tag fertigstellen.
4. Nach dem nächsten DP2-Auto-Sync die Zeiten und Twinkeys „Fertig“ prüfen. Club-App muss „in DP2 übernommen“ anzeigen; Hinweise im E-Mail-Center prüfen.
5. Dieselbe Person ändert und entfernt Zeiten in der Club-App. Nach dem Folgelauf keine doppelten Einträge, entfernte Club-App-Zeiten weg, direkte DP2-Einträge weiterhin da.
6. Mit geschlossener Wunschphase eine erneute Abgabe prüfen: Ablehnung statt Übernahme.
7. Zentrale Freigabe in beide Richtungen erst nach der oben beschriebenen Backend-Klärung abnehmen. Ergebnisse notieren; erst danach FINAL und Veröffentlichung.

DEV-Implementierung und automatisierte RC-Prüfung abgeschlossen. FINAL bleibt ausdrücklich offen.
