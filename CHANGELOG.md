## Build 323 RC – Dienstplan-Druck mit Filtern

Neuer Einstieg „Druck / PDF“: eigene Wünsche, Sollplan, Gesamt, Einsatzplan, Regelmatrix mit Besetzung und Programm-Zuschlag, Soll-/Wunschstunden, Lücken und Planungsvorschläge. Zeitraum, Tage, Personen/Einzelplan, V/H, Bereitschaft, Matrixzeilen und Zusatzblätter auswählbar. A4 quer, ein Blatt oder zwei Blätter breit mit Überlappung. Ganze Tagesblöcke, Logo, Stand, Seitenzählung; komprimierte Vektor-PDFs ohne Verläufe. Eigene Wünsche aus belegten Mitgliedsquellen; keine Kommentare oder Gesundheitsangaben; Ausfälle ausgeblendet. Bereitschaft zählt nie als Dienstzeit. Reine Ausgabe, keine Planänderung oder Club-App-Aktualisierung.

## Build 322 RC – Sichere Club-App-Sollplan-Übernahme

Fehlerhafte Übergaben lösen keine Löschung bestehender Dienste aus, auch bei ungültigen Personen- oder Übernahmeschlüsseln. Jede Änderung am DP2-Sollstand, Ist-Bezug oder Tauschanfragen nach der Vorschau verlangt einen neuen Vergleich. Tests für ungültige Zeiten, Schlüssel, unbekannte Personen sowie erneute Änderungen an bereits geschützten Diensten. Keine Änderung an echten Planungsdaten.

## Build 321 RC – Sollplan aus der Club-App übernehmen (KC-DP-SOLL-UEBERGABE)

- Neues Modul `src/core/club-soll-inbox.js`: Die Club-App übergibt ihren berechneten Sollplan als vollständigen Stand (`kc_dp_soll_uebergabe_pending`/`_ack`, Tabelle und RPCs im Club-App-Repo). Im Sollplan erscheint für Planer „📥 Plan aus der Club-App übernehmen“ bzw. „📥 Änderungen aus der Club-App: … neu · … geändert · … entfällt“ (Abruf beim Öffnen des Sollplans, höchstens alle 5 Minuten).
- Vorschau je Zeile: ➕ neu, ✏️ geändert, ➖ entfällt, ＝ unverändert, ⛔ nicht übernehmbar (unbekannte oder nicht planbare Person, kein Veranstaltungstag, Prüfung des Dienstes, Überschneidung mit einem DP2-Dienst). Übernommene Dienste, die in DP2 geändert wurden, Ist-Zeiten, eine Tauschanfrage oder einen anderen Status haben, zeigt sie als ⚠️ mit Wahl „DP2 behalten“ (Standard) oder „Club-Stand übernehmen“. Von Hand in DP2 angelegte Dienste werden nie verändert. Hat die Club-App zu einer Person/einem Tag nichts übergeben (Person dort nicht eindeutig, Tag nicht veröffentlicht, ausgenommen), erscheint der vorhandene Club-Dienst als „➖ entfällt? – Grund“ mit Standard „behalten“. Hinweis und Abruf nur im Register Sollplan.
- „Übernehmen“ legt Entwürfe mit `planningSource: 'club_import'` und `sourceImportKey` an, ändert/entfernt nur Club-Dienste auf dem normalen Weg (`K.mutations.saveShift`/`deleteShift`), als eine Einheit mit Rücknahme bei Fehlern, und bestätigt danach an die Club-App. „Verwerfen“ ändert nichts. Pause nach DP2-Regel (Pausenvorschlag).
- Veröffentlichung an PC-Manager/Kasse unverändert (Auto-Sync, `kc_dp_plan_publish`).
- Neuer Test `tools/test-club-soll-inbox.mjs` (in `npm run test:smoke`).

## Build 320 RC – Ganze Sollbalken verschieben

Verschieben erhält die Dienstdauer, auch an Tagesgrenzen. Kein stilles Kürzen an gespeicherten Kann-Grenzen. Außerhalb der Kann-Zeit erfordert das Ablegen eine ausdrückliche Bestätigung, ohne Wünsche zu ändern; Überschneidungs- und Rechteprüfung bleiben aktiv. Randgriffe ändern weiterhin die Dauer.

## Build 319 RC – Einheitliche Personenampel in Soll und Ist

Gleichzeitige Personen statt Schichtdatensätze zählen. Stunden bei Beginn, Ende und Pausen aufteilen; Gesamtampel ausschließlich nach Gesamtbedarf. V/H/B separat und mit denselben Anzeigeoptionen wie im Wunschplan. Bildschirm, Vorschau und Matrixdruck verwenden dieselbe Auswertung. Keine Änderung an Planungsdaten.

## Build 318 RC – V/H/B ausblenden und Bereichsfarben zuschalten

- Zwei gemerkte Anzeige-Schalter neben der Bereitschafts-Schaltfläche: V/H/B ein-/ausblenden und Bereiche separat farbig prüfen.
- Gesamtampel bleibt rein personenabhängig. Ein gemeinsamer B-Pool wird bei der Bereichsprüfung nur einmal verwendet; keine Dienstzuweisung.
- PDF berücksichtigt die gewählte Ansicht.

## Build 317 RC – Personenampel nach Gesamtanzahl

- Rot = weniger, Grün = genau passend, Gelb = mehr Personen als Gesamtbedarf. V/H/B-Verteilung beeinflusst die Ampel nicht.
- Kann-/Bedarf-Zeile und Gesamtbewertung färben sich entsprechend; Reserve und Bereitschaft bleiben separat.
- Browser prüft sichtbare CSS-Farbwechsel bei geänderter Personenanzahl. PDF-Legende angepasst.

## Build 316 RC – Besetzungsstatistik ohne irreführende Bereichslücken

- Gemeinsamer B-Pool, jede Person einmal, Reserve getrennt. Rot nur bei tatsächlicher Nichtabdeckbarkeit; gelb für offene Zuteilung oder Vorbehalt.
- Teilzeiten, Sperren und ausdrücklich gemeldete Bereitschaft werden korrekt berücksichtigt. Details pro Zeitabschnitt per Klick.
- PDF unter dem Wunschplan verwendet dieselbe Statistik. Bedarfszahlen und Dienstzeiten werden nicht verändert.

## Build 315 RC – Wetter und Bühnenprogramm laden

- Wettervorhersagen für Werne und freigegebenes Tagesprogramm werden unabhängig vom Personenabgleich geladen.
- Stundenwetter, Programmstatus, fehlende Endzeiten und Aktualisieren-Knopf unter Bedarf.
- Bedarfszahlen, Dienstzeiten und offene Eingaben bleiben beim Abruf erhalten. Programmfreigabe im PC-Manager mit vorhandenem serverseitigem Versionsschutz.

## Build 314 RC – Update-Dienst ohne blockierende Wartung

- Aktivierung wartet nicht mehr auf Netzwerk-Downloads oder Cachewartung. Der vorhandene geprüfte Programmstand bleibt bis zum bestätigten Wechsel erhalten.
- Regression: Update aus vorhandenem Cache auch bei nicht erreichbarem Manifest; neun verschlüsselte Wunschdatensätze bleiben erhalten.

## Build 313 RC – Geprüfte Planübernahmen und gemeinsames Stempelbuch

- Neues gemeinsames Stempelbuch für App- und Kassenzeiten, unvollständige Paare, Quellenhinweise und explizite Prüfung spontaner Einsätze.
- Importquittung erst nach bestätigter zentraler Speicherung.
- Sollzeiten lassen sich nicht als Istbuchung speichern. Istzeiten kommen weiterhin aus Erfassung, Kassenimport oder geprüften Rückmeldungen.
- Die Sammelübernahme übernimmt nur Wunschzeiten ohne Warnung und blockiert mehr als acht Stunden am Stück.
- Die Update-Prüfung unterscheidet lokale Vorschau und installierten Webstand.

## Build 310 RC · Planungsstände sparsam speichern (13.11.2026)

- Der zentrale Planungsstand wird vor dem Verschlüsseln gepackt (gzip, Format `KC_SECURE_SYNC_V2`, Packmerkmal in den geprüften Zusatzdaten). Ältere Fassungen (V1) bleiben lesbar; Browser ohne `CompressionStream` speichern wie bisher ungepackt.
- Schnelle Änderungsfolgen werden gebündelt: Liegt die letzte Speicherung weniger als 20 s zurück, sammelt DP2 kurz (3 s Ruhe, höchstens 12 s) und speichert einen Stand. Einzelne Änderungen speichern sofort; beim Verlassen der Seite endet die Pause sofort.
- Anlass: Am 12.11.2026 entstanden 78 volle Fassungen (je 1,4–1,7 MB) an einem Abend. Die Wünsche der Mitglieder (Club-App-Eingang) sind davon nicht betroffen.
- Neuer Test `tools/test-speichern-sparsam.mjs` (in `npm run test:smoke`).

## Build 309 RC · Weniger Datenbankanfragen

- Hintergrundabgleich und technische Verkehrsmeldungen gebündelt, unveränderte Sollpläne seltener an den PC Manager gesendet.
- Kleinere Datei für die Original-Kochmütze.

## Build 308 RC · 08.11.2026

Istplan-Abschluss erreicht die Club App: `kc_dp_days_publish` schickt je Tageszeile `istStatus` ('closed'|'open') und `istClosedAt` (aus dem Abschlusszeitpunkt; Tage bis einschließlich zum Abschlussdatum in Europe/Berlin gelten als abgeschlossen). Abschließen und Wiederöffnen veröffentlichen die Tage sofort neu; ein Fehler dabei bricht den Abschluss nicht ab, der Auto-Sync holt es nach. Die Club App liest `payload->>istStatus` und fragt für abgeschlossene Tage nicht mehr nach Ist-Zeiten. 5-Minuten-Abruf der Ist-Rückmeldungen bleibt.

## Build 307 RC · 08.11.2026

Ist-Rückmeldung nach dem Dienst (Vorgabe Hansi): Die Club App fragt nach jedem geplanten Dienst, ob die Sollzeit als Ist übernommen wird. DP2 liest die Antworten ausschließlich über `kc_dp_rueckmeldungen_liste` und entscheidet über `kc_dp_rueckmeldung_entscheiden`. „Passt“ und kleine Abweichungen zählen sofort (Quelle `self_confirm`/`self_change`, Original = Soll), Abweichungen ab 15 Minuten, „nicht da“ und Buchungskorrekturen bestätigt der Planer (Ablehnung nur mit Grund). Je Rückmeldung genau eine Ist-Zeit; neue Version aktualisiert sie. Planer-Korrektur, Kasse/Stempeluhr/Import haben Vorrang, ein späterer Import legt die Selbstauskunft still. Bestätigtes „nicht da“ gilt nicht als fehlende Buchung. Kontoauszug zeigt ✅ bestätigt, ✏️ geändert, ⏳ wartet (nicht in der Summe), 🚫 nicht da, ❌ abgelehnt und ⏳ keine Antwort; Summen nur aus gezählten Ist-Zeiten. Neuer Planer-Dialog „Ist-Rückmeldungen der Mitglieder“ mit Auswertung „Stimmung & Besetzung“ je Tag und Bereich; Abholen im Auto-Sync höchstens alle 5 Minuten. Keine Migration in DP2 (Tabelle und RPCs im Club-App-Repo).

## Build 306 RC · 30.10.2026

Schreibfreigabe im Backend unabhängig von der Auswahl für tägliche Neon-Snapshots prüfen; bestehende Spar-Einstellung beibehalten. Planerrechte, Verschlüsselung, Versionsvergleich und Übernahmebelege bleiben unverändert. Die beiden ausgeschiedenen Testkennungen werden auch über ihre alten Alias-IDs nicht erneut als planbare Personen angelegt. Reale Wünsche und Bedarfsmatrix werden durch das Programmupdate nicht migriert.

## Build 305 RC · 29.10.2026

Mitgliederabgleich: gelöschte oder stornierte historische Zeilen zählen nicht mehr als aktive Personenverweise. Dadurch können veraltete lokale Kennungen aus gelöschten Einträgen den Club-App-Eingang nicht blockieren. Aktive unbekannte Personen blockieren weiterhin; keine Datensätze löschen oder umschlüsseln.

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
