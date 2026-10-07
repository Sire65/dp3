# Build 263 RC – KC-DP-KLAPPBEREICH

Ausgang: Build 262 RC, d8976b9. Auftrag aus KC-Clubapp, Zweig claude/aenderungsmeldung, docs/DP2_CODEX_AUFTRAG_KLAPPBEREICHE.md (07.10.2026).

Ein gemeinsamer Baustein `src/ui/fold-sections.js` und `.css` gestaltet Klappbereiche mit Titel, 42×42px-Schloss und rotem Drehpfeil. Das Browserdreieck entfällt. Festgestellte Bereiche bleiben offen bzw. geschlossen; Antippen zeigt einen kurzen Hinweis. Freie Bereiche lassen sich auch unten mit „▴ Zuklappen“ schließen. Kurze bzw. verschachtelte Bereiche haben keinen unteren Knopf.

Benutzerwahl und Feststellung werden getrennt unter `kc_dp_klappe_<key>` und `kc_dp_fest_<key>` gespeichert. Alle Speicherzugriffe sind abgefangen. Kein Personen- oder Wunschdatum wird gespeichert. Twinkey setzt den Kalenderzustand über `K.foldSections.setOpen`, ohne eine Benutzerwahl zu speichern. Feststellung wird dabei respektiert. Der Observer bindet nachträglich gerenderte Bereiche genau einmal und schützt auch direkte programmatische open-Änderungen.

Die Mitgliederbereiche tragen feste Schlüssel: Twinkey-Hilfe, Anzeige einstellen, Tage, Tages-Zeitübersicht, Unterbrechungen, gesperrte Teammitglieder, Besetzungskacheln, Alternativen, Wunsch-/Alternativschritt, Mehr anzeigen, Freundesübernahme, Bemerkung und bisherige Angaben. Weitere DP2-details werden über ID bzw. strukturelle Position eingebunden; dynamische Überschriften werden nicht als Schlüssel verwendet. Innere Bereiche erhalten keinen unteren Knopf.

Beide Dateien sind in index.html und twinkey-test.html eingebunden. Geänderte UI-Dateien haben neue Cachekennungen. Datenformat, Fragen, Reihenfolge, Speicher-/Versandlogik und member-button-logic bleiben unverändert. Keine Datenbankänderung.

## Prüfung

`tools/test-fold-sections.mjs`: Schloss, Neuladen, unterer Knopf, verschachtelte Bereiche, 42px-Fingerfläche, aria-Zustände, Ablaufeingriff ohne Merken und gesperrter Speicher.

`tools/test-twinkey-optional.mjs` lädt jetzt den Baustein und prüft zusätzlich den festgestellten Kalender bei Tageswahl. Der vorhandene Ablauf einschließlich Unterbrechungen, Tageswechsel und Speicherung bleibt getestet, responsive bei 320/390/768/1280px.

## Übergabe an Claude

Bitte Build 263 aus codex/club-app-interface mit dem bestehenden Übernahme-Werkzeug übernehmen, Club-Version und Vertragstests aktualisieren. Build bleibt RC. Club-App 2.41.0 wurde laut Übergabe vorbereitet, nicht live; dieser DP2-Push veröffentlicht die Club-App nicht. Nach Übernahme besonders die tatsächliche Versandbestätigung mit Hansi testen. Zwei-PC-/Wiederherstellungsabnahme bleibt separat offen.
