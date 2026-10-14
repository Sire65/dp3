# DP2 – Arbeitsversion Build 271 RC

Diese Arbeitsversion baut auf Build 268 auf. Sie ist für den kontrollierten Einstieg am Planer-PC vorgesehen. Vor paralleler Nutzung auf zwei PCs bleiben der echte Zwei-PC-Test und die Wiederherstellungsprüfung erforderlich. Der Stand ist RC, nicht FINAL.

Build 271 startet im Arbeitsmodus ohne Beispiel-Dienste, Beispiel-Wünsche, Beispiel-Bereitschaft, lokale Beispiel-Aushilfen und angenommene Aushilfen-Verfügbarkeit. Ein eigener verschlüsselter Arbeitsspeicher verhindert, dass der alte Testspeicher erneut geladen wird. Die frühere Datenbank wird weder gelöscht noch überschrieben. Bereits vorhandene echte lokale Planungen dort bleiben erhalten; sie müssen vor einer gewünschten Übernahme gesichert und einzeln geprüft werden. Keinen ungeprüften alten Testbestand vollständig zurückspielen.

Die Personen werden nach Anmeldung aus dem zentralen operativen Verzeichnis geladen. Solange dieses nicht geladen ist, bleibt der Club-App-Import gesperrt. Bei Verbindungs-/Rechteproblemen die Meldung prüfen; fehlende Daten werden nicht durch Beispiele ersetzt. Wetter und Bühnenprogramm sind zunächst unbekannt/leer, bis ihre reale Quelle freigegeben geladen wurde.

1. Vorhandenen DP2-Datenstand über dessen Sicherungsfunktion sichern. Den bisherigen Programmordner und das verwendete Browserprofil behalten; keine Browserdaten löschen.
2. Das ZIP vollständig in einen eigenen Ordner entpacken. Nicht im ZIP und nicht im temporären Entpackordner des Downloadprogramms arbeiten.
3. Für den lokalen HTTP-Start mit vorhandener Node.js-Laufzeit `DP2-OFFLINE-STARTEN.cmd` starten. Das Serverfenster geöffnet lassen. Der Browser öffnet `http://127.0.0.1:8765/index.html?build=271`. Der Name „OFFLINE“ stammt aus dem bisherigen Startwerkzeug: Für Anmeldung und Club-App-Eingang ist Internet erforderlich.
4. Alternativ `index.html` im entpackten Ordner öffnen; bei Browserbeschränkungen den lokalen HTTP-Start verwenden. `twinkey-test.html` ist eine Testseite mit Beispieldaten und dient nicht zum Import von Echtdaten.
5. Prüfen, dass Build 271 angezeigt wird. Mit dem vorhandenen berechtigten Planer-/Admin-Konto anmelden und die Veranstaltung KC-WM-2026 auswählen. Bestehende Supabase-Einrichtung verwenden; keine Zugangsschlüssel in Dateien oder Chat kopieren. Ein neuer Browser-Ursprung kann die vorhandene lokale Einrichtung nicht automatisch übernehmen: vor dem Import geladenen Datenstand, Personen und Veranstaltung prüfen.
6. „Mail / E-Mail & Posteingang“ öffnen, im Bereich „Club-App-Eingang“ auf „Eingang neu prüfen“ klicken. Bereits vorhandene Angaben werden pro betroffenem Tag mit den Handy-Angaben verglichen. Bewusst „DP2-Angaben behalten“ oder „Mit Handy-Angaben überschreiben“ wählen. Unklare Angaben oder offene Synchronisationskonflikte zuerst klären.
7. Nach der bestätigten Übernahme Personen, Kann-/Wunschzeiten, Sperren und Bereitschaft stichprobenartig prüfen und eine neue Sicherung erstellen. Eine ausstehende Serverbestätigung ist kein abgeschlossener Import. Bei Fehlern nicht noch einmal alles manuell eingeben, sondern den Eingang erneut prüfen.

Es sind keine persönlichen Eingänge, Passwörter, Tokens oder lokalen Datenbestände im Download enthalten. Die Eingänge werden nach Anmeldung aus der Datenbank gelesen. Wunschpläne sind Angebote für die Planung; sie werden dadurch noch nicht automatisch zu einem veröffentlichten Dienstplan.

Die GitHub-Pages-Adresse kann einen anderen Zweigstand zeigen. Für diese Arbeitsversion den ausdrücklich benannten Release-Download verwenden, nicht den allgemeinen „Source code“-Download.
