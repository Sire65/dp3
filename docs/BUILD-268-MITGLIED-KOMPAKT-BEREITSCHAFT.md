# Build 268 RC – KC-DP-MITGLIED-KOMPAKT · KC-DP-BEREITSCHAFT-GENERELL

Ausgang: Build 267 RC, c8d014b. Wunsch Hansi (12.10.2026) nach der Eingabe der Dienste mit Christina in der Club-App.

**1. Startfrage „Bereitschaft generell“** (`chef-companion.js`, Bildschirm „Sollen Kollegen deine Zeiten sehen dürfen?“)
- Neu: „Bist du generell bereit, auch Bereitschaftsdienste zu übernehmen? (z. B. an Tagen ohne Standdienst)“
- Große Ja/Nein-Felder. Die Antwort ist Pflicht, sonst geht es nicht weiter.
- Gespeichert als `K.memberUxData.standbyGeneral[personId] = {allow, updatedAt}`.

**2. Tägliche Bereitschaftsfrage nur bei „Ja“** (`simple-wish-assistant.js`, `standbyEnabled`)
- Bei „Nein“ entfällt die Frage „Kannst du zusätzlich Bereitschaft übernehmen?“ an den Tagen.
- Ausnahme: An Tagen mit schon angebotener Bereitschaft bleibt die Frage, damit sie änderbar bleibt. Es geht nichts still verloren.
- Ohne Antwort (alter Stand) bleibt alles wie bisher.

**3. „Nur wenn nötig“**
- Bei der Kann-Zeit (und Bereitschaft) ist es jetzt ein auffälliges Feld: orange Rahmen, großes Kästchen und Erklärung „Ich helfe in dieser Zeit nur, wenn sonst niemand da ist.“
- Bei der Wunschzeit ist das ausgegraute Kästchen entfernt. Gilt die Kann-Zeit als „nur wenn nötig“, steht dort ein kurzer Hinweis.
- Daten und Regeln sind unverändert: `if_needed` und Vererbung gelten wie bisher.

**4. Kompakt auf dem Handy** (neu `src/ui/member-compact.css`, ≤ 700 px)
- Twinkey-Kasten in der Tageseingabe nur noch als schmale Zeile (Ton/Anzeige). Die Frage steht direkt darunter als Überschrift.
- Kleinere Überschrift, weniger Abstände.

**5. Club-Eingang** (`club-wish-inbox.js`)
- Übernimmt `standbyGeneral` (true/false; null = nicht beantwortet → nichts ändern) nach `memberUxData.standbyGeneral`.
- Der Rückweg (rollback) stellt den alten Wert wieder her.
- Server: neue Spalte `kc_dp_wish_inbox.standby_general`, `kc_dp_wish_inbox_pending` liefert zusätzlich `standbyGeneral` (rückwärtskompatibel).

**Offen für die Planung (Codex):** Den generellen Stand beim Planen von Bereitschaften berücksichtigen, also Mitglieder mit „Nein“ nicht für Bereitschaft vorschlagen. Die Daten liegen ab diesem Build in `memberUxData.standbyGeneral`.

## Prüfung
- Neu `tools/smoke-member-compact.mjs` (in `test:smoke`).
- `npm run test:smoke` grün.
- Club-App: Ablauf im Handy-Format durchgespielt (Startfrage, Tagesfrage entfällt bei „Nein“, Kann-Zeit mit auffälligem Feld).
