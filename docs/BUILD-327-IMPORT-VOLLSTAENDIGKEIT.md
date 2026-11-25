# Build 327 RC · Vollständigkeit der Club-App-Übernahme

## Nachgewiesene Ursache

Eine Sollplan-Übernahme speicherte gültige Änderungen, übersprang aber fehlerhafte Positionen und bestätigte trotzdem den gesamten Eingang als `uebernommen`. Daraufhin verschwanden die restlichen Positionen aus dem offenen Eingang. Ein alter `lastApplied`-Merker konnte außerdem eine stille Vollquittung trotz weiterhin bestehender Fehler auslösen.

Persönliche Zeitgrenzen bleiben fachliche Regeln. Die Reparatur hebt sie nicht automatisch an. Unterschiedliche Vorgaben in den beiden Programmen und Konflikte mit neueren Wunschangaben müssen durch den Planer geklärt werden.

## Korrektur

- Teilübernahme speichert gültige Positionen, merkt aber `lastPartial` und lässt die Übergabe offen. `lastApplied` wird erst bei fehlerfreier Bearbeitung gesetzt.
- Kein Auto-Ack bei Fehlern, auch wenn ein älterer Client dieselbe ID schon als `lastApplied` gespeichert hat.
- Warnung „Nur teilweise“, verbleibende Anzahl und Knopf „Offene Einträge neu prüfen“. Der Eingangshinweis zeigt Fehler statt „keine Änderungen“.
- Serverfunktion `kc_dp_soll_uebergabe_ack` lehnt unvollständige Ergebnisse ab. Migration `20261125133608_dp_soll_reject_incomplete_ack.sql` wurde unter dieser von Supabase vergebenen Version angewendet. Die Definition wird vor dem Einfügen des Guards per Hash geprüft; Rollen, Besitzer, Grants und Authentifizierungsprüfung bleiben bestehen. Ein zweites Anwenden ist wirkungslos.
- Eine betroffene jüngste Teilübernahme kann kontrolliert per Vergleich von ID, Status, Zeitpunkt und Fehlerzahl wieder geöffnet werden. Ergebnis und vorheriger Übernahmezeitpunkt/-benutzer bleiben im Reparaturprotokoll erhalten. Dienste, Wünsche und persönliche Regeln werden dabei nicht geändert.

## Prüfung

Erweiterte Tests `test-club-soll-inbox.mjs` mit synthetischen Personen: gültiger Teil, geschützte Löschung, wiederholter Abruf, alter lastApplied-Merker, keine Dubletten und vollständiger Abschluss nach Klärung der Testgrenze.

Neuer Browsertest `test-club-soll-partial-browser.mjs`: sichtbare Warnung und Restzähler, erneute Vorschau, kein Teil-/Auto-Ack und vollständiger Abschluss.

Servertest in einer zurückgerollten Transaktion: sieben unvollständige Ergebnisvarianten werden abgewiesen; gültige Wiederholung bleibt kompatibel; keine Testdatenänderung. ACL und search_path entsprechen der ursprünglichen Funktion.

Solange fachliche Entscheidungen offen sind, bleibt der Eingang offen. Wunschplan, Sollplan und Bereitschaft sind getrennte Eingänge. Dieses Dokument und die reproduzierbaren Tests enthalten keine persönlichen Einsatzpläne.
