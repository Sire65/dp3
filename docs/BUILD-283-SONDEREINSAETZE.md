# Build 283 RC – Sondereinsätze (KICC-F-100, DP2-F-SE-01)

Der Planer legt im Sollplan unter Menü „★ Sondereinsätze“ Einsätze außerhalb des Stands an (z. B. Grünkohl kochen im Krankenhaus, Abholung/Transport zum Tiefkühler, Getränke mischen zuhause). Der Termin darf offen sein (OFFEN → GEPLANT → FEST). Folge-Einsätze rücken automatisch mit (Abholung = Kochtermin + 2 Tage), wiederkehrende gelten an allen Markttagen. Veröffentlichung nach Supabase (kc_dp_special_events, nur Planerrollen schreiben). K.days bleibt unverändert. Test: tools/test-special-events.mjs.
