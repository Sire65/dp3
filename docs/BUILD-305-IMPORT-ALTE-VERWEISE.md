# Build 305 RC – Import und historische Personenverweise

Der Arbeitsmodus sperrte den Club-App-Eingang, weil referencedPersonIds auch gelöschte und stornierte historische Zeilen prüfte. Die Prüfung ignoriert jetzt ausschließlich status deleted/cancelled. Sie verändert keine Zeile. Aktive unbekannte Personen sperren weiterhin den vollständigen Verzeichniswechsel.

Test-work-mode: unbekannte aktive Person blockiert und erhält Wünsche, gelöschte/stornierte Zeilen mit lokalen Kennungen erlauben Verzeichnisabgleich bei unverändertem historischem Inhalt. Import nutzt weiterhin reguläre Claim-/Ack-/Versionsprüfung.
