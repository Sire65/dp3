# Build 270 RC – Arbeitsmodus ohne Testbestand

Basis Build 269, 51ada92. index.html aktiviert den Arbeitsmodus. model.js startet ohne Beispielbelegung, Wünsche, Bereitschaft, lokale Beispiel-Aushilfen und Beispielverfügbarkeit. Wetter und Bühnenprogramm werden nicht als vermeintlich echte Ausgangsdaten angezeigt. Testseite und Fixturetests behalten ihren ausdrücklich getrennten Beispielmodus.

Arbeitsdaten werden in KC_DP2_WORK_SECURE_V1 mit separater Projektkennung gespeichert. Der alte KC_DP3_SECURE_V020-Bestand bleibt unberührt. Keine automatische Löschung/Umdeutung alter W-*/S-*/B-IDs, da echte nachträgliche Änderungen nicht sicher unterscheidbar sind.

Im Supabase-Arbeitsmodus liest der vorhandene Provider das aktive operative Verzeichnis als zentrale Personenquelle. Die gesonderte Manager-Personenpublikation ist dafür nicht Voraussetzung; es wird keine Publikation vorgetäuscht. Host-/URL-Managerquellen behalten ihre bisherige Freigabeprüfung. Doppelte/ungültige Personen und fehlende referenzierte IDs werden weiterhin abgewiesen. Nach lokaler Wiederherstellung wird das Verzeichnis erneut abgeglichen; bis zur erfolgreichen Übernahme bleibt der Club-Eingang gesperrt. Testkonten und Kassen-Präsentationssimulation sind im Arbeitsmodus deaktiviert.

Keine Auth-Umgehung: Supabase prüft weiterhin E-Mail/Passwort. Eine abgewiesene Passwortanmeldung braucht korrekte Kontodaten oder den vorhandenen Wiederherstellungsweg. Live-Passwortanmeldung und Live-Import müssen am Planer-PC geprüft werden; automatisierte Fixturetests ersetzen das nicht.
