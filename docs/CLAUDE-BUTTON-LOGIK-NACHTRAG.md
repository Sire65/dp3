# Übergabe an Claude – Nachtrag zu Build 251 RC

Bitte den neuesten Commit des Branches `codex/club-app-interface` mit dem vorhandenen Übernahme-Werkzeug in die Club-App übernehmen und die Prüfsummen in `dp2/QUELLE.json` erneuern. Die Versionsnummer bleibt Build 251 RC; für diese Ergänzung ist der neue Commit maßgeblich, nicht mehr `f893f5d`.

## Änderung

`src/ui/member-button-logic.js` ergänzt den gesperrten Weiter-Button in Twinkey um einen sichtbaren und per ARIA zugeordneten Grund:

- Begrüßung: „Bitte mit oder ohne Twinkey wählen.“
- Aufgabenauswahl: „Bitte zuerst eine Aufgabe wählen.“

Nach einer Auswahl verschwindet der Hinweis und der bestehende Übergang funktioniert weiterhin. Der Browsertest in `tools/test-member-button-logic.mjs` prüft den Hinweis in der Aufgabenauswahl. Das Update-Manifest wurde neu erzeugt.

## Bewertung der beiden anderen Hinweise

- `uxTwinkey` bleibt bei geschlossener Wunschphase aktiv: Twinkey führt auch zu Ansichten und Unterlagen. Die einzelnen Schreibaktionen werden weiterhin gesperrt.
- `uxTeamPlan` bleibt ohne eingetragene Kollegen aktiv: Die Ansicht zeigt auch offenen Personalbedarf. Eine leere Namensliste macht diese Ansicht nicht unbrauchbar.

## Validierung und Datenstatus

Mitglieder-Button-Test, Twinkey-Browsertest und Release-Prüfung mit 294 Dateien erfolgreich. Bitte nach der Übernahme auch die Begrüßung und Aufgabenauswahl in der Club-App prüfen, einschließlich mobiler Darstellung und Aktualisierung zwischengespeicherter Dateien.

Keine Backend-Änderung und keine Übernahme oder Quittierung von Stevens Eingang durch diesen Nachtrag. Die Anzeige seiner 13 Angaben in der Club-App bestätigt noch keine Übernahme in den DP2-Plan. Die zentrale Kollegenfreigabe und der Live-Handtest bleiben offen.
