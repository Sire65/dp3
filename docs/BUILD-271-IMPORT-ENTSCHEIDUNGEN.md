# Build 271 RC – Importentscheidungen deutlich kennzeichnen

Basis Build 270, e1e11e4. Club-App-Tagesvergleich zeigt die Zahl offener Entscheidungen, auffällige orange Tagesrahmen, einen Hinweis direkt an jeder fehlenden Auswahl und einen Sprung mit Fokus zur nächsten offenen Entscheidung. Erledigte Entscheidungen tragen Häkchen und klaren Text. Der gesperrte Übernahmeknopf erklärt den Grund; echte Validierungsprobleme bleiben blockierend. Es werden keine Entscheidungen automatisch getroffen.

Christinas leere Bereitschaftsantworten am 02./14.12. (`answer:null, slots:[]`) sind neutral, keine ungültigen Angebote. Der Import meldet dafür keinen Fehler und bewahrt eine vorhandene Bereitschaft. Null-Antworten mit wirklichen Slots, ungültige Zeitfenster und andere Widersprüche bleiben blockierend. Die Vergleichsansicht beschriftet unbekannte Bereitschaft ausdrücklich statt einer leeren Zeile.

Zusatztests: neutraler Eingang wird bestätigt, bestehende Bereitschaft bleibt nach bewusstem Ersetzen erhalten, unbekannte Antwort mit Slots bleibt gesperrt. Browsertest prüft zwei offene Entscheidungen, Rahmen/Fortschritt, Fokus zum nächsten Feld und Freigabe erst nach allen Antworten. Bisherige Claim-/Rollback-/Konfliktprüfungen bleiben erhalten.

Arbeitsdatenbank bleibt KC_DP2_WORK_SECURE_V1, keine erneute Trennung, keine Löschung vorhandener Imports. Keine Änderungen an Supabase-Mitgliederdaten. E-Mail-Bereich-Fehler wird sprachlich vom separat funktionierenden Club-App-Eingang getrennt.
