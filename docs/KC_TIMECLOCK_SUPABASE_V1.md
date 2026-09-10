# KC TimeClock Supabase V1

DP2 liest geprüfte Istzeiten aus `public.kc_dp_timeclock_actuals`. Der PC-Manager wird später als eigener, geschützter Schreiber angebunden; Browser-Mitglieder dürfen diese Tabelle nicht verändern.

Pflichtfelder je abgeschlossener Buchung: `org_id`, `project_id`, `event_id`, `source_event_id`, `member_no` oder `person_id`, `work_date`, `start_time`, `end_time`. Optional sind `display_name`, `break_minutes`, `source`, `source_version`, `payload` und `published_at`. `status` ist `complete`, `missing_start`, `missing_end` oder `voided`.

DP2 zeigt neue Datensätze Planern und Administratoren zunächst als Prüfvorschau. Unvollständige oder überschneidende Zeiten werden nicht übernommen. Nach erfolgreicher oder als identisches Duplikat erkannter Übernahme schreibt DP2 einen Beleg in `public.kc_dp_timeclock_receipts`. Dadurch wird derselbe Datensatz nicht erneut angeboten.

Manuelle CSV-/JSON- und Dateiimporte bleiben unabhängig davon erhalten. Das Ereignis wird über `KCDP.eventConfig.eventId` zugeordnet; ohne Konfiguration gilt `WM-2026`.
Der PC-Manager schreibt ausschließlich über die authentifizierte Funktion `kc_dp_timeclock_publish`. Sie akzeptiert nur aktive Manager-Admins, höchstens 5000 Zeilen je Aufruf und verwendet Quellen-IDs zur doppelten sicheren Übertragung.
