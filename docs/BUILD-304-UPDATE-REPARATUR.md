# Build 304 RC – Update-Reparatur

Bericht LXIKBH: installiert302, Ziel303, Protokoll2 erkannt, dennoch keine Aktivierungsbestätigung. Dieser Bericht allein beweist nicht den blockierenden Einzelschritt.

Erweiterter Browsertest mit316 Dateien statt4: Ein neuer Worker blieb reproduzierbar installed/waiting. Explizite Nachricht KC_DP_ACTIVATE_WORKER ruft skipWaiting auf; Test danach grün. Die Vollständigkeitsprüfung nutzt cache.keys einmal statt316 einzelner Cache-Abfragen. Bei verlorenem Ack zeigt die Statusantwort die aktuelle Aktivierungsphase; der Updater wartet begrenzt auf seinen eigenen Beleg. Fremde Belege bleiben abgewiesen.

update-reparieren.html?kc_update=1 lädt den Updater direkt aus dem lokalen Programmordner. Keine Planungsspeicher werden geöffnet. Vorher offene Bearbeitungen speichern. Nach Erfolg führt der Neustart ausdrücklich zu index.html statt wieder auf die Reparaturseite. Kein Löschen von IndexedDB oder anderen Nutzerdaten.

Tests: test-local-update mit316 Dateien, alter Worker, verlorene Antwort, fremde Quittung und9 erhaltene verschlüsselte Wünsche. test-update-repair prüft Einstieg/Installation/Neustart auf390px und unveränderte lokale Daten ohne Planungsspeicher. Live-Abnahme durch den Benutzer noch offen.
