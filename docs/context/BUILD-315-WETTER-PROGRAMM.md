# Wetter und Bühnenprogramm in DP2 (Build 315)

## Betrieb

DP2 lädt Wetter und Programm unabhängig vom Personenabgleich. Die Zusatzdaten verändern weder Bedarfszahlen noch Wunsch-/Soll-/Istzeiten und lösen keine Speicherung des Arbeitsstands aus. Nach Anmeldung werden sie im Hintergrund gelesen; unter Bedarf gibt es zusätzlich „Wetter / Programm aktualisieren“.

Wetter: Open-Meteo, fester Standort Werne 51.6639/7.6337, Zeitzone Europe/Berlin. Ein Abruf enthält 16 Tage und Stundenwerte. Normal höchstens alle 30 Minuten; nach Fehler frühestens nach etwa einer Minute. Vorhersagen fehlen für weiter entfernte Termine ausdrücklich. Nach zwei Stunden gelten nicht aktualisierte Werte als veraltet. Es wird kein Personalzuschlag aus Sonnenschein oder Regen geraten; der Planer behält die Wetterbewertung. Quelle und Wetterstand stehen in der Bedarfssicht.

Programm: PC-Manager → Programm → Tagesprogramm → „Zentralen Stand prüfen“, dann „Für DP2 freigeben“. Für diesen Markt werden aktive Termine vom 02. bis 14.12.2026 übernommen. Die Freigabe bestätigt Anzahl und fehlende Endzeiten; ein leeres Programm wird nur nach ausdrücklicher Bestätigung freigegeben. Nach Änderungen erneut freigeben. DP2 prüft freigegebene Daten ungefähr jede Minute. Termine ohne Endzeit werden angezeigt, aber nicht als Besetzungsdauer gerechnet.

## Schutz

Die Freigabe benutzt die vorhandene RPC kc_manager_section_speichern mit erwarteter Version. Sie schreibt nur dienstplan_context und erhält andere Felder des bestehenden Payloads. Fremde neuere Freigaben erzeugen einen Konflikt; es gibt keine automatische Wiederholung mit neuer Versionsnummer. Es werden keine Rechte erweitert und keine Tabellen angelegt.

DP2 liest diese Sektion mit der vorhandenen Planer-/Admin-RLS. Freigabeformat KC_DP_CONTEXT_V1, Veranstaltung KC-WM-2026 und Zeitraum müssen passen. Eine Freigabe enthält Programm und Status in genau einem atomaren Schreibvorgang. Manuelle DP2-Programmbewertungen bleiben erhalten; eine lokale Bewertung mit gleichem Titel und Beginn hat Vorrang. Der alte gekoppelte Personen-/Kontextabgleich bleibt unverändert.

## Prüfung am 18.11.2026

- Echter Wetterabruf: 16 Tage / 384 Stunden bis 03.12.2026.
- Supabase-Probe in zurückgerollter Transaktion: berechtigter Manager kann freigeben und lesen, veraltete Version abgewiesen, fremder Benutzer darf weder lesen noch freigeben. Kein Testprogramm blieb gespeichert.
- DP2 test-operational-context.mjs: getrennte Abrufe, Vorschauhorizont, fehlendes Ende, ungültige/fremde Freigabe, Ausfall, veraltetes Wetter, manuelle Bewertungen, keine Planungsschreibzugriffe.
- DP2 test-operational-context-browser.mjs: 390px, Stundenwetter und Programm sichtbar, Bedienknopf mindestens 44px, nicht gespeicherte Bedarfsänderungen bleiben nach Aktualisierung erhalten.
- Kasse tests/dp2-program-publication.test.cjs: Echt-/Schulungsstand, aktuelle Anmeldung, Filter und atomare Versionierung.

Es wurden keine echten Programmpunkte erfunden oder aus dem Archiv 2025 übernommen. Ohne die erste Freigabe im PC-Manager meldet DP2 die fehlende Freigabe weiterhin sichtbar.
