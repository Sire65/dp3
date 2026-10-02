# Build 256 RC – Twinkey einfacher und fehlersicher (02.10.2026)

KC-DP-TWINKEY-EINFACH (Wunsch Hansi nach UX-Prüfung des Club-App-Wegs): Tagesliste zeigt „x von 13 Tagen fertig“ und einen Knopf zum nächsten offenen Tag; nach dem Speichern geht es direkt zum nächsten offenen Tag. „Fertig“ fragt nach, wenn noch Tage ohne fertige Angabe sind. Kann-Zeit ist nicht mehr mit dem ganzen Tag vorausgefüllt (bewusst per „Ganze freie Zeit übernehmen“ oder Von/Bis). Bei der Wunschzeit ist „Weiter“ gesperrt, bis eine der drei Möglichkeiten gewählt ist. Beim Antippen eines Tages erscheint „Diesen Tag eintragen“/„Angaben bearbeiten“ sofort sichtbar. Details: docs/BUILD-256-TWINKEY-EINFACH.md.

# Build 255 RC – Reservierter Club-App-Wunscheingang (02.10.2026)

Reservierung vor lokalem Eintragen, Bestätigung mit gespeichertem Token, Wiederanlauf anhand des eigenen Serverbelegs und Rückrollen bei verlorener Reservierung. Direkte Tagesangaben werden weiter vor dem Überschreiben verglichen; fremde Reservierung wird sichtbar und nicht als Erfolg gemeldet. Kollegenfreigaben bleiben Serverdaten. Details und noch offene Freigabetests: docs/BUILD-255-WUNSCH-SPERRE.md.

# Build 250 RC – Club-App-Schnittstelle (30.09.2026)

Tagesrahmen/Bedarfe als vollständigen Snapshot veröffentlichen; personengebundene Club-App-Wünsche über vorhandene RPCs prüfen, ersetzen und quittieren. Direkt in DP2 erfasste Wünsche bleiben erhalten. Bereitschaft, Nur-wenn-nötig und Twinkeys Fertig-Signatur werden übernommen. Wiederanlauf, veraltete Revision und Rollback sind abgedeckt.

Event-ID-Fallback für Istzeiten: KC-WM-2026. Status und Probleme im E-Mail-Center. Zentraler Versionsvertrag: release-version.json.

RC, nicht FINAL: Live-Handtest und zentrale Kollegenfreigabe offen; Details und Backend-Übergabe in docs/BUILD-250-CLUB-APP.md. Keine produktiven Schreibtests oder Datenbankänderungen.
