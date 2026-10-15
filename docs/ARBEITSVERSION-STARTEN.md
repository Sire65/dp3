# DP2 – Arbeitsversion Build 283 RC

## Einmalige Einrichtung für Updates ohne neues ZIP

Vor dem Wechsel im bisher verwendeten DP2 unter Einstellungen → Backup / Restore → „Backup erstellen“ eine Sicherung herunterladen. Danach Build 283 einmal vollständig entpacken und mit DP2-OFFLINE-STARTEN.cmd unter der festen Adresse http://127.0.0.1:8765/index.html starten (vorhandenes Node.js erforderlich). Diesen Ordner und die Serveradresse danach beibehalten.

Wichtig: Wer bisher index.html direkt als Datei oder einen anderen Browser/Port verwendet hat, wechselt den Browser-Ursprung. Dort ist der bisherige lokale Speicher nicht automatisch sichtbar. Zuerst im alten DP2 sichern, dann im neuen unter Backup / Restore die Sicherung prüfen und wiederherstellen, mit dem bisherigen Geräteschlüssel entsperren und den Bestand kontrollieren. Nicht den alten Testbestand aus Build 269 übernehmen, sondern ausschließlich den aktuellen Arbeitsbestand. Keine Browserdaten löschen und nicht einfach alle Eingänge erneut quittieren.

In der Wunschplan-Wochen-/Gesamtansicht zeigt ein Zähler die lokal geladenen Personen und Angaben. Für den aktuellen neun Personen umfassenden Eingang muss der Arbeitsbestand die neun Personen enthalten; in Supabase liegen weiterhin neun bestätigte Eingänge mit 179 Originalangaben. Bewusste lokale Änderungen können die Zahl der Zeitangaben verändern.

Künftige Versionen auf dem gemeinsamen Arbeitszweig werden automatisch angeboten: „Ja, installieren“, Prüflauf abwarten, danach „KC DP2 neu starten“. Geänderte Daten werden vorher gespeichert; derselbe verschlüsselte Arbeitsspeicher bleibt erhalten. Bei einer fehlerhaften Datei wird nicht aktiviert. Updates funktionieren über die lokale HTTP-Adresse, nicht beim direkten Öffnen als file://. Das Serverfenster muss geöffnet bleiben. Nach dieser einmaligen Einrichtung ist für Programmupdates kein erneutes Entpacken erforderlich.

Diese Arbeitsversion baut auf Build 268 auf. Sie ist für den kontrollierten Einstieg am Planer-PC vorgesehen. Vor paralleler Nutzung auf zwei PCs bleiben der echte Zwei-PC-Test und die Wiederherstellungsprüfung erforderlich. Der Stand ist RC, nicht FINAL.

Build 283 startet im Arbeitsmodus ohne Beispiel-Dienste, Beispiel-Wünsche, Beispiel-Bereitschaft, lokale Beispiel-Aushilfen und angenommene Aushilfen-Verfügbarkeit. Ein eigener verschlüsselter Arbeitsspeicher verhindert, dass der alte Testspeicher erneut geladen wird. Die frühere Datenbank wird weder gelöscht noch überschrieben. Bereits vorhandene echte lokale Planungen dort bleiben erhalten; sie müssen vor einer gewünschten Übernahme gesichert und einzeln geprüft werden. Keinen ungeprüften alten Testbestand vollständig zurückspielen.

Die Personen werden nach Anmeldung aus dem zentralen operativen Verzeichnis geladen. Solange dieses nicht geladen ist, bleibt der Club-App-Import gesperrt. Bei Verbindungs-/Rechteproblemen die Meldung prüfen; fehlende Daten werden nicht durch Beispiele ersetzt. Wetter und Bühnenprogramm sind zunächst unbekannt/leer, bis ihre reale Quelle freigegeben geladen wurde.

1. Vorhandenen DP2-Datenstand über dessen Sicherungsfunktion sichern. Den bisherigen Programmordner und das verwendete Browserprofil behalten; keine Browserdaten löschen.
2. Das ZIP vollständig in einen eigenen Ordner entpacken. Nicht im ZIP und nicht im temporären Entpackordner des Downloadprogramms arbeiten.
3. Für den lokalen HTTP-Start mit vorhandener Node.js-Laufzeit `DP2-OFFLINE-STARTEN.cmd` starten. Das Serverfenster geöffnet lassen. Der Browser öffnet `http://127.0.0.1:8765/index.html?build=283`. Der Name „OFFLINE“ stammt aus dem bisherigen Startwerkzeug: Für Anmeldung und Club-App-Eingang ist Internet erforderlich.
4. Alternativ `index.html` im entpackten Ordner öffnen; bei Browserbeschränkungen den lokalen HTTP-Start verwenden. `twinkey-test.html` ist eine Testseite mit Beispieldaten und dient nicht zum Import von Echtdaten.
5. Prüfen, dass Build 283 angezeigt wird. Mit dem vorhandenen berechtigten Planer-/Admin-Konto anmelden und die Veranstaltung KC-WM-2026 auswählen. Bestehende Supabase-Einrichtung verwenden; keine Zugangsschlüssel in Dateien oder Chat kopieren. Ein neuer Browser-Ursprung kann die vorhandene lokale Einrichtung nicht automatisch übernehmen: vor dem Import geladenen Datenstand, Personen und Veranstaltung prüfen.
6. „Mail / E-Mail & Posteingang“ öffnen, im Bereich „Club-App-Eingang“ auf „Eingang neu prüfen“ klicken. Bereits vorhandene Angaben werden pro betroffenem Tag mit den Handy-Angaben verglichen. Bewusst „DP2-Angaben behalten“ oder „Mit Handy-Angaben überschreiben“ wählen. Unklare Angaben oder offene Synchronisationskonflikte zuerst klären.
7. Nach der bestätigten Übernahme Personen, Kann-/Wunschzeiten, Sperren und Bereitschaft stichprobenartig prüfen und eine neue Sicherung erstellen. Eine ausstehende Serverbestätigung ist kein abgeschlossener Import. Bei Fehlern nicht noch einmal alles manuell eingeben, sondern den Eingang erneut prüfen.

Es sind keine persönlichen Eingänge, Passwörter, Tokens oder lokalen Datenbestände im Download enthalten. Die Eingänge werden nach Anmeldung aus der Datenbank gelesen. Wunschpläne sind Angebote für die Planung; sie werden dadurch noch nicht automatisch zu einem veröffentlichten Dienstplan.

Die GitHub-Pages-Adresse kann einen anderen Zweigstand zeigen. Für diese Arbeitsversion den ausdrücklich benannten Release-Download verwenden, nicht den allgemeinen „Source code“-Download.
