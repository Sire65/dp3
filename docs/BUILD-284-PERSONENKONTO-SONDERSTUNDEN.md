# Build 284 RC – Sonderstunden im Personenkonto (KICC-F-100)

Bestätigte Sonderstunden (Ist mit Quelle self_report/specialEventId) erscheinen im persönlichen Kontoauszug mit Einsatzname (★), Quelle „Meldung“ und eigener Summe „davon Sondereinsätze“. Gemeldete, noch nicht bestätigte Stunden (K.hourReports, Status gemeldet) stehen getrennt und zählen nicht zur Summe (AGENTS 11). Der Standardzeitraum reicht bis zum letzten Sondereinsatz bzw. zur letzten Meldung (z. B. Kochtag im Januar). Twinkey „Meine erfassten Zeiten“ zeigt offene Meldungen. Test: tools/test-person-account-special.mjs.
