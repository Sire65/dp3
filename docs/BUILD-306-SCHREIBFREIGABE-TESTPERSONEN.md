# Build 306 RC – Schreibfreigabe und ausgeschiedene Testkennungen

## Ursache und Korrektur

`kc_dp_workspace_save` verlangte bisher `mirror_enabled AND backup_enabled` im Sicherungsregister. Seit der bewusst geänderten täglichen Sicherungsauswahl vom 26.10. ist `backup_enabled` für die großen Planungsrevisionen falsch. Dadurch wurden trotz vorhandenen Neon-Spiegels alle neuen DP2-Schreibvorgänge mit `Backup preparation is not complete` abgelehnt.

Die produktive Migration `dp_write_backup_readiness_v2` ist am 30.10.2026 eingespielt. Ihre Datei ist `supabase/migrations/20261030170000_dp_write_backup_readiness.sql`. Sie ergänzt ausschließlich im vorhandenen Supabase-Register `write_backup_ready`, standardmäßig falsch. Nur die zuvor geprüfte DP2-Zeile erhält die explizite Schreibfreigabe. Voraussetzung bleibt `mirror_enabled AND (backup_enabled OR write_backup_ready)`. Dies beschreibt eine geprüfte Vorbereitung, keinen aktuellen grünen Backup-Tageslauf.

`backup_enabled=false`, `mirror_enabled=true` und die sonstigen Sicherungsrichtlinien bleiben erhalten. Das Register wird nicht nach Neon gespiegelt; es gibt dort keine entsprechende Registertabelle. Deshalb war hierfür keine produktive Neon-Strukturänderung erforderlich. In einem isolierten Neon-Testzweig wurden die additive Spalte, der falsche Standardwert und die Zulassungsfälle geprüft.

Am Funktionskörper wurde nur dieses Prädikat ersetzt. Rollenprüfung, dauerhaftes Konto, leerer `search_path`, Anforderungslimits, gemeinsame Transaktionssperre, erwartete Version, Altoperationsstand und eigene Wiederholungsbelege bleiben unverändert. Keine neuen Client-Schreibrechte und keine Änderungen an bestehenden verschlüsselten Revisionen.

## Geprüfter Datenbestand

Vorher enthielten Supabase und Neon je 28 Planungsrevisionen mit derselben aggregierten Prüfsumme `5a925197206ed8a18ce206b44a4ecd3d`. Direkt nach der Migration waren diese Anzahl und Prüfsumme unverändert. Das ist ein Abgleich des vorhandenen Spiegelbestands, keine neue vollständige Wiederherstellungsprüfung oder Aussage zum aktuellen B2-/Frankfurt-Lauf.

Die ausdrücklich beauftragte Bereinigung der beiden Testkennungen `KC-P-LOCAL-01` und `KC-P-LOCAL-02` wurde getrennt als verschlüsselte Revision 29 angehängt. Vergleichsschutz: Ausgangsversion 28, Altfolge 1376 und dieselbe Sperre wie beim normalen Speichern. Entfernt wurden genau zwei zugehörige Wunschzeilen. 209 andere Wunschangaben, alle 13 Bedarfstage und die übrigen Planungsdaten blieben unverändert. Der unveränderte Bedarf wurde vor dem Schreiben zusätzlich per SHA-256 geprüft. Sämtliche bisherigen Revisionen bleiben als Wiederherstellungsverlauf erhalten.

Im Programm werden die beiden Kennungen nicht mehr als Personen oder Beispieldienste angelegt. Auch ihre alten Alias-IDs `KC-P-016` und `KC-P-017` sind nicht planbar. Die feste ID-Zuordnung der übrigen Beispielpersonen bleibt trotz der kürzeren Personenliste erhalten. Keine pauschale Löschung anhand eines Namens; andere Aushilfen bleiben erhalten. Ein Programmupdate selbst bereinigt oder ersetzt keine realen gespeicherten Planungsdaten.

## Import und Prüfung

Neue Club-App-Meldungen weiterhin ausschließlich über den regulären Claim-/Ack-Weg übernehmen. Konflikte benötigen eine Tagesentscheidung; die neue Schreibfreigabe umgeht diese Prüfung nicht. Ein leerer Zeitenteil darf keine Zeit erfinden oder vorhandene fremde Daten entfernen. Allgemeine Bereitschaft ist eine eigene Angabe und kann auch ohne Tageszeiten vorliegen. Wünsche werden nicht als Soll-Dienste angelegt.

- `npm test`: grün, einschließlich SQL-Vertragsvergleich, Verschlüsselung, Servervorrang, Zwei-PC-CAS, Wiederholungsbelege, Bedarfsschutz und Import-Rückrollen.
- `tools/test-work-mode.mjs`: grün, einschließlich beider Arbeitsmodi, alter Alias-IDs und stabiler Zuordnung anderer Aushilfen.
- `supabase/tests/workspace-write-gate-rollback.sql`: in Supabase grün; acht Zulassungsfälle, gesperrter Standard, tatsächliche Freigabe, Rollenprüfung, unveränderte RPC-Rechte sowie RLS/fehlende direkte Schreibrechte; Transaktion zurückgerollt.

Für Claude: Die tägliche Sicherungsauswahl bitte nicht als Reparatur wieder einschalten und `write_backup_ready` nicht mit dem Ergebnis des letzten Backup-Laufs verwechseln. Diese Spalte ist die getrennte Schreibzulassung. Bei Änderungen der Sicherungsarchitektur muss die zugehörige Schreibzulassung ausdrücklich neu geprüft werden. Der Stand bleibt RC; ein echter Zwei-PC-Live-Test und eine vollständige Wiederherstellungsabnahme werden dadurch nicht ersetzt.

## Abschluss der regulären Eingangsübernahme

Die fünf zuvor offenen aktuellen Eingänge sind über DP2 mit eigener Reservierung und zentral bestätigtem Speichern übernommen. Die abweichenden Tage wurden erst nach ausdrücklicher Entscheidung für die neuen Handy-Angaben ersetzt. Keine direkte Quittierung im SQL-Werkzeug.

Der anschließende rein lesende Vergleich der verschlüsselten Revision 47 mit dem Ausgangsbestand bestätigt: alle 13 Bedarfstage und deren Bestätigungen unverändert, übrige Mitgliederwünsche unverändert, Soll- und Ist-Dienste unverändert jeweils null, keine aktuellen Wunschzeilen der beiden ausgeschiedenen Testkennungen. Bedarf-SHA-256: `fca274d2ffd04ac47c1c847dd08fe70fff44a82a3f9e3cabca0972466c6939fd`. Es wurden ausschließlich Prüfsummen und Mengen ausgegeben; Schlüssel und entschlüsselte Planungsinhalte wurden nicht gespeichert oder ausgegeben.

Zusätzlich: Syntaxprüfung aller 273 JavaScript-Dateien grün. Die Backend-Korrektur wirkt unmittelbar auch im bereits geöffneten Build 305; der nächste normale Programm-Updatezyklus ergänzt Build 306 mit dem dauerhaft ausgeschlossenen Test-Personenstamm. Ein erzwungener weiterer Browserneustart ist für die erfolgte zentrale Übernahme nicht erforderlich.
