# Build 253 RC – Club-App-Schnittstelle und PDF-/QR-Korrekturen zusammengeführt

## Herkunft

Merge (ohne Zurücksetzen oder Umschreiben des Verlaufs) des Hauptzweigs `main` (Build 250 `0ea8683`, Build 251 `d3031ee`)
in `codex/club-app-interface` (Stand `a12769d`, Build 252 RC). Freigabe Hansi am 01.10.2026.

Erhalten aus dem Codex-Zweig: Mitglieder-Button-Logik mit Sperrgründen (251 RC + Nachtrag), Twinkey-Hinweise am gesperrten
Weiter, Konfliktprüfung je Tag vor der Club-App-Übernahme (252 RC), Club-App-Schnittstelle (250 RC).

Übernommen aus dem Hauptzweig:
- `src/adapters/pdf.js` (Build 250): Original-Kochmütze statt Ersatzzeichnung, „ “ ” … € • als echte WinAnsi-Zeichen,
  Ankreuzkästchen/Haken über die PDF-Standardschrift ZapfDingbats, QR oben rechts 78 statt 55 pt.
- `twinkey-test.html` (Build 251): lädt document-identity, qrcode-generator, personalized-forms und pdf.js, damit
  „Meine Unterlagen“ (Papiermatrix, Handschriftprobe) in der Twinkey-Seite und damit in der Club-App funktioniert.

## Nummernlage

Die Hauptzweig-Builds 250/251 und die RC-Builds 250–252 tragen gleiche Nummern für verschiedene Inhalte. Build 253 RC
fasst beide Linien zusammen; die Release-Notizen nennen beide (Hauptzweig-Einträge mit „(Hauptzweig)“).

## Prüfung

Siehe Commit-Nachricht und Übergabe in der Club-App (`dp2/QUELLE.json`).

## Offen (nicht abgeschlossen)

Live-Handtest mit Hansi, zentrale Kollegenfreigabe und eine serverseitige Claim-/Versionsprüfung für gleichzeitig
importierende DP2-PCs (siehe docs/BUILD-252-KONFLIKTPRUEFUNG.md). Der Stand ist deshalb RC, nicht FINAL.
