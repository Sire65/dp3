# Build 290 RC – Vorläufige Einteilung und Abgleich der Sondereinsätze (DP2-F-SE-08, KICC-F-100)

- Sondereinsätze 0.2.0: Feld **vorgesehen** (nur aktive Mitglieder, höchstens 30) – der Planer teilt vorläufig ein; wird mit veröffentlicht (payload) und in der Club App angezeigt.
- **Abgleich** (`pull`): DP2 liest den veröffentlichten Stand (`kc_dp_special_events`, RLS nur DP2-Mitglieder) und nimmt neue bzw. neuere Einsätze auf; lokal Neueres bleibt, entfernt wird nichts. Beim Öffnen von „★ Sondereinsätze“ automatisch; **Veröffentlichen gleicht vorher ab** und bricht ab, wenn das nicht geht – so gehen in Supabase eingetragene Einsätze nie verloren.
- Planer-Dialog: Auswahl „Vorgesehen (vorläufig)“, Anzeige „👥 vorgesehen: …“ in der Liste.
- Twinkey: beim Melden sind die vorgesehenen Kollegen vorausgewählt (abwählbar, „(vorgesehen)“); bei „Bei einem Sondereinsatz helfen“ steht „Du bist vorgesehen (vorläufig)“.
- Tests: neu `tools/test-special-events-planned.mjs`, `test-twinkey-hours` erweitert.
- Anlass (Betreiber, 2026-10-15): Grünkohl kochen 28.11.2026 (Willfried, Steven, Manfred), Abholung 29.12.2026 (Frank, Willfried), vorläufig geplant.
