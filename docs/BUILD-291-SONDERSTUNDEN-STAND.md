# Build 291 RC – Sonderstunden mit Stand in „Meine erfassten Zeiten“ (KICC-F-100)

- Twinkey „Meine erfassten Zeiten“ zeigt eigene Sonderstunden-Meldungen mit Stand: **gemeldet** (zählt noch nicht), **✓ bestätigt – gutgeschrieben**, **✖ nicht gutgeschrieben** mit Grund (zählt nicht). Oben die Summe „★ Sonderstunden: … Std. gutgeschrieben · … Std. gemeldet“.
- Bestätigte Meldungen, die in DP2 schon als Ist-Zeit gebucht sind, erscheinen nicht doppelt. In der Club App (keine Ist-Zeiten) erscheint die bestätigte Meldung selbst.
- Knopf-Logik: „Meine erfassten Zeiten“ ist auch dann wählbar, wenn es nur Sonderstunden-Meldungen gibt (vorher in der Club App immer gesperrt, weil dort keine Stempelzeiten geladen werden).
- Tests: `test-twinkey-hours` erweitert (bestätigt, abgelehnt mit Grund, keine Doppelung, Summe).
