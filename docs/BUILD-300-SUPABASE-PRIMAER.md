# Build 300 RC – Supabase führt den Planungsstand

Stand: 23.10.2026. Ausgangspunkt: Build 299, Commit 0ab4cec.

## Verhalten im DP2-Arbeitsmodus

Für Admin, Planer und Dienstleitung lädt DP2 den zentralen Planungsstand vor der Bearbeitung aus Supabase. `persistAll` schreibt einen vollständigen verschlüsselten Planungsstand und wartet auf die ausdrückliche Serverquittung. Regelmäßiges lokales Speichern und lokale Recovery-Checkpoints dieses Planungsstands entfallen. Die bisherige Einzeloperations-Synchronisation darf den zentral geladenen Stand nicht mehr verändern.

Die Anzeige unterscheidet: **In Supabase gespeichert**, **Speichert in Supabase**, **Nur lokal – Übertragung offen**, **Speicherkonflikt prüfen** und **Speichern gesperrt**. Ein Verbindungsfehler legt die Änderungen verschlüsselt in `cloudPrimaryPendingV1` ab. Wiederholung nutzt dieselbe Vorgangsnummer und denselben verschlüsselten Inhalt. Bei verlorener Antwort wird nicht doppelt geschrieben. Eine neuere fremde Revision zählt nicht als eigene Bestätigung. Eine andere Anmeldung darf die Ausfallsicherung nicht übernehmen.

Bei Versionskonflikten bleibt der Entwurf erhalten. Ein Vergleich zeigt PC und Server; die Entscheidung gilt für den gesamten angezeigten Planungsstand. Vor der Entscheidung prüft DP2 nochmals, dass der Vergleich aktuell ist. Abgelehnte lokale Varianten werden verschlüsselt im lokalen Prüfverlauf erhalten, zentrale Revisionen bleiben erhalten. Ohne lokale Ausfallsicherung ist beim Offline-Neustart keine Bearbeitung erlaubt. Online muss der Browser keinen zusätzlichen Planungs-Cache schreiben.

Technische Anmeldung, Geräteschlüssel, Verbindungsparameter und Push-Konfiguration bleiben gerätebezogen lokal. Sie werden nicht in den gemeinsamen Planungsstand aufgenommen. Die Mitgliedereingabe der Club-App bleibt bei ihrem bisherigen Serververtrag; diese Umstellung gilt für das DP2-Planungsprogramm. Handschriftprofile und sonstige separat verwaltete Dokumentarchive sind nicht Teil dieser Umstellung.

## Einmalige Übernahme bestehender Daten

Ein leerer neuer Hauptspeicher wird **niemals automatisch** mit Beispieldaten oder dem zufällig geladenen PC-Bestand gefüllt. DP2 zeigt einen gesperrten Umstellungsdialog:

1. PC-/Server-Abweichungen vergleichen und ausdrücklich wählen. Die Auswahl ist zunächst nur ein Umstellungsentwurf.
2. **Bisherigen Serverbestand prüfen**. Der bestehende verschlüsselte Operationsbestand wird mit festen Versionsgrenzen über alle Seiten gelesen. Fehlende Wunsch-/Dienstkennungen müssen zuerst ergänzt werden; bestehende PC-Zeilen werden dabei nicht ersetzt. Unlesbare oder unvollständige Bestände blockieren die Übernahme.
3. Den Vergleich prüfen und anschließend **Geprüften PC-Bestand als Ausgangsstand übernehmen** bestätigen.

Eine serverseitige Versions- und Bestandsprüfung verhindert, dass zwei PCs gleichzeitig initialisieren oder ein inzwischen geänderter alter Serverbestand unbemerkt übergangen wird. Schreibt ein älterer DP2-PC später in den alten Operationsspeicher, hält die neue Arbeitsversion an und verlangt eine Prüfung. Deshalb alle Planer-PCs vor paralleler Arbeit aktualisieren. Die Club-App verwendet weiterhin den separaten Wunscheingang.

Ein weiterer PC mit vorhandenem Altbestand muss den Wechsel zum bereits eingerichteten Serverstand einmal bestätigen. Sein lokaler Altstand wird dabei zusätzlich verschlüsselt archiviert und kann vorher als Datei gesichert werden. Alte lokale Übertragungsaufträge werden archiviert, damit sie später nicht wieder in den früheren Operationsspeicher gelangen. Der Beitritt eines weiteren PCs schreibt keine Planungsdaten auf den Server und ersetzt keine fremden Eingaben.

Die bisherige offene Entscheidung Freitag 04.12.2026 (PC 53 gegenüber älteren 51 Bedarfsstunden) wurde durch diesen Umbau **nicht entschieden**. Auch reale Mitgliedereinträge wurden noch nicht in die neue Revisionstabelle übernommen. Die bestehende lokale Datenbank und die bisherigen Supabase-Operationen wurden nicht gelöscht.

Der erste Ausgangsstand enthält zusätzlich das geprüfte alte Operationsinventar als nachvollziehbare Bestandsaufnahme. Dieses bleibt in Revision 1 erhalten; laufende Änderungen schreiben neue Revisionen.

## Datenbank und Sicherung

Neue Tabelle: `public.kc_dp_workspace_revisions`. Append-only über die Client-API, eindeutige Vorgangsnummer, fortlaufende Version je Organisation/Projekt, verschlüsselter Inhalt und Autor. Keine direkten Client-Lese-/Schreibrechte. RPCs `kc_dp_workspace_read` und `kc_dp_workspace_save` prüfen aktive Planungsrolle und echte Anmeldung. Die Speicherung sperrt auch einen noch leeren Projektraum und vergleicht die erwartete Version atomar.

Eingespielt in Supabase `ptblnpiroqftcvlsrhac`:

- `20261023072200_dp_primary_workspace.sql`
- `20261023073658_dp_primary_backup_gate.sql`
- `20261023073830_dp_primary_backup_ready.sql`

Die produktive Neon-Erweiterung wurde zunächst durch die automatische Freigabeprüfung abgelehnt. Nach ausdrücklicher Nutzerfreigabe wurde die auf dem Testzweig geprüfte leere Zieltabelle im Produktionszweig angelegt. Vorlage: `docs/neon-dp-primary-workspace.sql`. Die Tabelle ist anschließend im Sicherungsregister für Spiegelung und Backup freigeschaltet. Die Funktionen verweigern den ersten Schreibvorgang, wenn diese Sicherungsvorbereitung deaktiviert ist. Bestehende Sicherungssätze wurden nicht verändert.

Neon-Testzweig: `dp2-primary-b300-check`, ID `br-restless-snow-zam3jqwi`; nur die neue leere Tabellenstruktur ergänzt. Der Zweig besteht noch. Keine neue vollständige Wiederherstellungsprüfung des nächtlichen Gesamtbackups behauptet.

## Prüfung

- Automatisierte Speicherprüfungen: Server vor alter lokaler Kopie, Online-Speichern ohne Planungs-Cache, Offline-Änderungen/Neustart/Wiederverbindung, zwei simulierte PCs mit Versionskonflikt, verlorene Antwort, fremde neuere Revision, falsche Quittung, fehlende Rechte/RPC, Anmeldung gewechselt, Initialisierung nur nach Prüfung und vollständiger Übernahme vorhandener Kennungen, mehrseitiger Serverbestand.
- Echter Verschlüsselungstest mit großem Unicode-Datenpaket, falschem Projekt und manipuliertem Inhalt. Base64-Konvertierung für große Planungsstände ohne Argumentlimit korrigiert; Umschlagformat bleibt kompatibel.
- Test des echten `persistAll`-Codes: Startschutz, zentraler Speicherzweig, Ausfallhinweis, Fehlerweitergabe und unveränderter Mitgliedereingabeweg.
- Browser: gesperrter Umstellungsdialog, ausdrückliche Auswahl, getrennte Initialisierung, 390 Pixel ohne Überlauf, Bedienung des Bedarfseditors mit zentraler Bestätigung und ohne alten IndexedDB-Rücklesetest.
- Club-App-Eingang: Ohne zentrale Speicherbestätigung keine Übernahmequittung; Änderungen werden zurückgenommen. Claim-/Wiederanlaufvertrag bleibt bestehen.
- SQL-Prüfung in Supabase: Erstschreiben, Wiederholung, veraltete Version, Folgerevision, eigener Beleg gegenüber neuerem Stand, geänderte Wiederholung, fehlende Version, andere Organisation, fehlende Anmeldung und verbotener Direktzugriff. Testtransaktion vollständig zurückgerollt.

Offen vor produktiver Freigabe: geprüften echten Ausgangsstand übernehmen und danach den tatsächlichen Wiederanlauf sowie den Live-Test mit zwei Planer-PCs durchführen. Die automatisierten Tests ersetzen diese Abnahme nicht. Stand bleibt RC.
