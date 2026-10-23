## Build 304 RC · 23.10.2026

Update mit vollständigem Dateiumfang prüfen: wartenden Worker ausdrücklich aktivieren, Cache-Vollständigkeit über ein gemeinsames Dateiverzeichnis statt einzelner Cache-Lesezugriffe prüfen. Laufende Aktivierung bei verlorener Antwort begrenzt nachverfolgen. Eigenständige Reparaturseite lädt die Update-Funktion ohne alten Programmcache und führt nach Erfolg zurück zu DP2. Keine Planungsdaten öffnen oder ändern.

## Build 303 RC · 23.10.2026

Bedarfsübersicht im PDF mit jedem Stundenbereich einzeln und wiederholten Bedarfszahlen statt Zusammenfassung gleicher Werte. Längere gespeicherte Zeiträume stündlich aufteilen, Teilstunden erhalten. Vollständige Tage nach Möglichkeit in einer Spalte halten; zusätzliche Seiten statt schmalerer Spalten. Tages- und Gesamtsummen unverändert, ausschließlich bestätigten gespeicherten Stand lesend verwenden.

## Build 302 RC · 23.10.2026

Update-Aktivierung: alten Worker ausdrücklich durch die aktuelle Registrierung ersetzen und das Protokoll vor dem Umschalten prüfen. Aktivierungsbeleg mit Cache und Vorgangskennung; verlorene Antwort anhand des eigenen gespeicherten Belegs prüfen. Bestätigung vor nichtkritischer Cache-Bereinigung senden. Fehlerbericht um tatsächliche Builds und Worker-Kennung erweitern. Keine Planungsdatenmigration.

## Build 301 RC · 23.10.2026

Bedarfsmatrix als PDF: Auswahl zwischen kompakter Gesamtübersicht und Tagesblättern, für alle, den aktuellen oder bestimmte Tage. Gleiche benachbarte Werte in der Übersicht zusammenfassen, Tages- und Gesamtsummen als Personalstunden. A4 quer mit Original-Logo, CD-Kopf und Fuß auf jeder Seite; Fortsetzung ohne abgeschnittene Zeilen. Im Arbeitsmodus ausschließlich bestätigten Supabase-Stand lesend verwenden; bei offenen Übertragungen oder verändertem Serverstand Druck blockieren. Keine Planungsdaten ändern.

## Build 300 RC · 23.10.2026

Planungsdaten für den Arbeitsmodus auf Supabase als führenden Speicher umstellen: verschlüsselte, versionierte Revisionen, atomarer Versionsvergleich, eigene Wiederholungsbelege. IndexedDB dient für neue Planungsänderungen nur als Ausfallsicherung; technische Anmeldedaten bleiben lokal. Umstellung mit geprüftem Ausgangsstand und ausdrücklicher Konfliktentscheidung. Neue Tabelle in Supabase und Neon vorbereitet und ins Sicherungsregister aufgenommen. Club-App-Eingänge erst nach zentraler Speicherbestätigung quittieren. Große verschlüsselte Datenpakete ohne Base64-Aufruflimit; tatsächliche Buildnummer im Kopf anzeigen.

## Build 299 RC · 21.10.2026

Konfliktfenster nach Datenmodell und Anwendung laden; Namespace auch bei frühem Laden sicher initialisieren. Reihenfolge im Test geprüft.

## Build 298 RC · 21.10.2026

Synchronisationskonflikte je Datensatz vergleichen und ausdrücklich entscheiden. Aktuelle lokale Werte statt alter Konfliktkopien verwenden; überholte Warteschlangenaufträge protokolliert stilllegen, damit sie Entscheidungen nicht erneut blockieren.

## Build 297 RC · 21.10.2026

Startschutz: keine Gesamtspeicherung und kein automatischer Manager-/Planabgleich vor vollständiger Wiederherstellung der Planungsdaten. Bedarfstag wird als ein vollständiger Vorgang übertragen; Rückmeldung unterscheidet lokale Sicherung und Supabase-Bestätigung.

## Build 296 RC · 21.10.2026

Bestätigte Bedarfswerte zusätzlich verschlüsselt sichern, beim Start wiederherstellen und gegen stilles Ersetzen durch abweichende Cloud-Matrizen schützen. Speicherbestätigung prüft die tatsächlich zurückgelesenen Werte.

## Build 295 RC · 21.10.2026

Bedarfsbearbeitung: Kästchen „Wie vor“ ab der zweiten Stundenzeile übernimmt einmalig Gesamt, Vorne und Hinten aus der vorigen Zeile. Fingertaugliche Bedienfläche; manuelle Änderungen entfernen den Haken.

## Build 294 RC · 21.10.2026

Bedarf speichern ordnet Zeilen anhand Datum und Zeitabschnitt statt Listenposition zu. Alle Eingaben werden vor dem ersten Schreiben geprüft; bei Fehlern bleibt der Editor offen.

## Build 293 RC · 21.10.2026

Bedarfsmatrix ergänzt fehlende Stunden bei erweitertem Tagesfenster. Bestehende Bedarfswerte bleiben erhalten.

## Build 263 RC – Klappbereiche wie in der Club-App (07.10.2026)

- Gemeinsamer Baustein: Schloss, Drehpfeil, gemerkter Zustand und „▴ Zuklappen“; Fingerflächen mindestens 42px.
- Mitgliederbereiche: Hilfe, Anzeige, Tage, Tagesübersicht, Unterbrechungen, Team-Sperrtage, Besetzung, Alternativen, Wunschschritt, Mehr anzeigen, Freundeszeiten und Bemerkungen.
- Twinkeys Kalendersteuerung respektiert Feststellung und überschreibt keine gemerkte Benutzerwahl. Keine Änderung an Datenformat oder Versand.
- Browserprüfungen für Feststellung, Neuladen, blockierten Speicher und den bestehenden Twinkey-Ablauf. Details: docs/BUILD-263-KLAPPBEREICHE.md.

## Build 262 RC – persönliche Handschrift-Ziffern (06.10.2026)

- Handschriftprofile: einzelne Ziffern aus PNG/JPG anlernen, prüfen, verschlüsselt speichern und exportieren/importieren. Foto-Erkennung berücksichtigt passende persönliche Ziffernvorlagen; widersprüchliche Ergebnisse bleiben unsicher.
- Bestehende Matrix-OCR und manuelle Prüfung bleiben erhalten. Keine automatische Übernahme, kein Buchstaben-/Freitexttraining. Klaus-Profil wird getrennt bereitgestellt, nicht öffentlich in den Programmdateien verteilt.

## Build 261 RC – KC-DP-PK-GRAFIK (06.10.2026)

- Personenkonto: standardmäßig zusätzliche Grafikseite je Person mit Tagesstunden, Gesamtbalken und Zeitspuren; im Druckdialog abschaltbar. Tabellen und Auswertung bleiben unverändert.
- Fehlende Buchungen sind schraffiert und als „fehlt“ markiert; Ist-Gesamtdifferenzen bleiben dann offen. Ohne Wunsch erscheint ein Hinweis, ohne erfundene Stunden.
- Mehr als 14 aktive Tage werden auf weitere Grafikseiten verteilt. Seitenzählung, QR und Schwarz-Weiß-Lesbarkeit bleiben erhalten. Keine Plandaten verändert.

## Build 260 RC – 06.10.2026

KC-DP-WUNSCH-SPERRE-OPTIONAL und KC-DP-TWINKEY-KLAPPBEREICHE: Tagesfrage Ja/Nein/Unbekannt, freiwillige Unterbrechungen innerhalb der Kann-Zeit, vorhandene Sperrzeiten unverändert. Zehn Tageskacheln in zwei Spalten, zugeklappte Zeitübersicht, Sprung zur Eingabe und Andere Tage mit Entwurfsprüfung. Details: docs/BUILD-260-TWINKEY-OPTIONAL.md.

## Build 259 RC – 02.10.2026

Abgleich mit dem vollständigen Auftrag: KC-DP-TWINKEY-SPERRTAG-OHNE-BEREITSCHAFT und KC-DP-TWINKEY-VERSANDMELDUNG. Sperrtage ohne Bereitschaftszeile und mit zentraler Bereinigung alter Daten beim Speichern. Versanddialog erst am endgültigen Ausstieg; genauer Fehlertext. Details: docs/BUILD-259-AUFTRAGSABGLEICH.md.

## Build 258 RC – 02.10.2026

Ganzer Sperrtag entfernt Bereitschaft mit Hinweis. Erfolgsmeldung beim Abschluss nur nach bestätigtem Versand, bleibt bis OK stehen; bei Fehlern bleiben Angaben erhalten und der Abschluss kann erneut versucht werden. Details: docs/BUILD-258-TWINKEY-VERSAND.md.

# Build 257 RC – Twinkey übersichtlicher (02.10.2026)

KC-DP-TWINKEY-EINFACH, zweiter Schritt (Wunsch Hansi vor Wilfrieds Live-Test): Sperr-Frage mit drei klaren Antworten („✓ Ich kann an diesem Tag“, „Ganzer Tag gesperrt“, „Nur zeitweise gesperrt“) – „Weiter“ ist ohne Antwort gesperrt; nur noch ein „Zurück“ je Schritt; „Bisherige Besetzung anzeigen“ nur noch bei der Wunschzeit als Link; Tageszusammenfassung zeigt zuerst die Einträge des Tages, Stundenüberblick/Durchschnitt/Drucken zugeklappt; Tageskacheln kompakt (Mi., 2.12. · Aufbau · 08:00–18:00) mit Statusfarbe grün/gelb/grau; „Überspringen“ auf dem Willkommensbildschirm entfällt (doppelt zu „Ohne Assistent“, das jetzt auch den Ton abschaltet); „Jetzt beenden“ statt überlaufendem „Ohne Übersicht beenden“. Begriffe (Kann-Zeit)/(Wunschzeit) bleiben wie auf Papiermatrix und Excel. Details: docs/BUILD-257-TWINKEY-UEBERSICHT.md.

# Build 256 RC – Twinkey einfacher und fehlersicher (02.10.2026)

KC-DP-TWINKEY-EINFACH (Wunsch Hansi nach UX-Prüfung des Club-App-Wegs): Tagesliste zeigt „x von 13 Tagen fertig“ und einen Knopf zum nächsten offenen Tag; nach dem Speichern geht es direkt zum nächsten offenen Tag. „Fertig“ fragt nach, wenn noch Tage ohne fertige Angabe sind. Kann-Zeit ist nicht mehr mit dem ganzen Tag vorausgefüllt (bewusst per „Ganze freie Zeit übernehmen“ oder Von/Bis). Bei der Wunschzeit ist „Weiter“ gesperrt, bis eine der drei Möglichkeiten gewählt ist. Beim Antippen eines Tages erscheint „Diesen Tag eintragen“/„Angaben bearbeiten“ sofort sichtbar. Details: docs/BUILD-256-TWINKEY-EINFACH.md.

# Build 255 RC – Reservierter Club-App-Wunscheingang (02.10.2026)

Reservierung vor lokalem Eintragen, Bestätigung mit gespeichertem Token, Wiederanlauf anhand des eigenen Serverbelegs und Rückrollen bei verlorener Reservierung. Direkte Tagesangaben werden weiter vor dem Überschreiben verglichen; fremde Reservierung wird sichtbar und nicht als Erfolg gemeldet. Kollegenfreigaben bleiben Serverdaten. Details und noch offene Freigabetests: docs/BUILD-255-WUNSCH-SPERRE.md.

# Build 250 RC – Club-App-Schnittstelle (30.09.2026)

Tagesrahmen/Bedarfe als vollständigen Snapshot veröffentlichen; personengebundene Club-App-Wünsche über vorhandene RPCs prüfen, ersetzen und quittieren. Direkt in DP2 erfasste Wünsche bleiben erhalten. Bereitschaft, Nur-wenn-nötig und Twinkeys Fertig-Signatur werden übernommen. Wiederanlauf, veraltete Revision und Rollback sind abgedeckt.

Event-ID-Fallback für Istzeiten: KC-WM-2026. Status und Probleme im E-Mail-Center. Zentraler Versionsvertrag: release-version.json.

RC, nicht FINAL: Live-Handtest und zentrale Kollegenfreigabe offen; Details und Backend-Übergabe in docs/BUILD-250-CLUB-APP.md. Keine produktiven Schreibtests oder Datenbankänderungen.
