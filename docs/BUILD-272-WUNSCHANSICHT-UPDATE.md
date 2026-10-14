# Build 272 RC – Wunsch-Wochenansicht und lokales Update

Woche/Gesamt lesen im Wunschplan die echten Wunschdaten statt Soll-Diensten. Kann-/Wunschzeiten, Nur-wenn-nötig und Sperren werden getrennt beschriftet, bevorzugte Stunden als Intervallunion gezählt. Ein Bestandshinweis zeigt Personen-/Angabenzahl. Soll/Ist-Vergleich bleibt unverändert. Keine Änderung oder Rücksetzung der Arbeitsdatenbank und keine Änderung der neun Eingänge.

Lokale HTTP-Installation bezieht das Manifest und die nach SHA-256 geprüften Runtime-Dateien aus codex/club-app-interface. Beide Update-Prüfer nutzen denselben Kanal. Der Service Worker aktiviert den fertigen Cache und bedient danach die lokale Adresse aus diesem Cache. Seine Metadaten werden bei der Cache-Bereinigung ausdrücklich erhalten (vorher versehentlich selbst gelöscht). Die erste lokale Aktivierung benötigt keinen vorherigen Remote-Startcache. Die installierte Worker-Engine kommt einmalig mit diesem Paket; zukünftige Worker-Protokolländerungen benötigen gesonderte Kompatibilitätsprüfung.

Prüfung: echte lokale HTTP-/Chrome-Service-Worker-Umgebung mit simuliertem Remote-Kanal: falscher Hash aktiviert nichts, erfolgreicher Download wird nach Reload statt alter Festplattendatei ausgeführt, neun verschlüsselte Wunschdatensätze bleiben unverändert. Wunschansichtstest mit neun Personen in Woche/Gesamt prüft Zeitarten, Unionstunden und unveränderte Sollansicht. Keine produktiven Tokens oder Mitgliederdaten im Test/Release.

Bei file:// → HTTP müssen vorhandene Daten bewusst mit der geprüften Sicherungsfunktion übertragen werden; diese Ursprungsgrenze kann ein Webprogramm nicht heimlich umgehen. Anleitung liegt im Paket. Vor echter paralleler Mehr-PC-Planung bleiben Live-Handtest und Wiederherstellungsprüfung offen. RC.
