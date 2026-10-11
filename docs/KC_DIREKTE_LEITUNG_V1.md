# KC Direkte Leitung in DP2 (Build 252, 11.10.2026)

Wunsch Hansi: „Hänge PC-Manager, Money Butler und dp2 an die Standleitung“ – dieselbe direkte Leitung wie die
Club-App (KC-CLUB-REALTIME). Feature-ID **KC-RT-PROGRAMME**.

## Was passiert
- Schreibt ein DP2-Gerät Änderungen in den gemeinsamen Abgleich (`kc_dp_sync_operations`), meldet die Datenbank
  über Supabase Realtime (Broadcast, kostenlos) **ein** Signal `abgleich` je Anweisung – **nur die Art, nie Inhalt**.
- Alle anderen angemeldeten DP2-Geräte holen dann sofort (`KCDP.autoSync.runNow`, gebündelt, nie parallel), statt bis
  zum nächsten Minutentakt zu warten. Der Minutentakt bleibt unverändert (darüber gehen auch eigene Änderungen hinaus).
- Den Kanalnamen liefert `kc_rt_programm_kanal('dp')` nur angemeldeten Mitgliedern mit aktiver DP-Mitgliedschaft.
  Anonym, abgemeldet oder offline: keine Leitung – DP2 arbeitet genau wie bisher.
- Adresse und öffentlicher Schlüssel kommen aus der DP2-Supabase-Einstellung (`integrationConfig`).

## Dateien
- `src/core/kc-direkte-leitung.js` – gemeinsamer Baustein (gleich wie `shared/kc-direkte-leitung.js` in Sire65/Kasse):
  Lebenszeichen 25 s, stumme Leitung (65 s) neu aufbauen, Neuverbinden 1 s … 60 s, nach jedem Verbinden nachholen.
- `src/core/direkte-leitung-dp.js` – DP2-Anschluss.
- Datenbank: Migration `supabase/migrations/20261011_kc_rt_programme.sql` in Sire65/Kasse (eingespielt über den Ablauf
  „Datenbank einspielen“ der Club-App). Gemeinsamer Monatszähler/Sparbremse mit der Club-App (ab 95 % keine Signale).
- Test: `tools/smoke-direkte-leitung.mjs` (Teil von `npm test`).

## Rückweg
`index.html`: die zwei `<script>`-Zeilen entfernen. Datenbank: Trigger `kc_rt_dp_abgleich` löschen.
