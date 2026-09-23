-- Manueller KC-Dienstplan-Minitest fuer PC-Manager -> Kassen
-- KEINE echten Sollplan-Daten werden veraendert.
-- Voraussetzung fuer einen stabilen Test: DP2 waehrend der wenigen Testminuten geschlossen lassen,
-- da ein echter DP2-Publish als vollstaendiger Snapshot diese Testzeilen korrekt wieder entfernt.
--
-- Erwartete Anzeige an der Kasse (Datum = lokaler Tag Europe/Berlin):
-- Bibi     09:00-11:00  Vorne
-- Einhorn  10:00-13:00  Hinten
-- Bambi    11:30-14:30  Kasse
-- Balu     12:00-16:00  Bereitschaft

do $$
begin
  if exists (
    select 1
    from public.kc_dp_plan_published
    where org_id='KC_WERNE'
      and event_id='KC-WM-2026'
      and status='published'
      and source_shift_id not like 'KC-TEST-KASSE-%'
  ) then
    raise exception 'Minitest abgebrochen: Es existieren bereits echte veroeffentlichte Schichten.';
  end if;
end $$;

insert into public.kc_dp_plan_published (
  org_id, project_id, event_id, source_shift_id, person_id,
  work_date, start_time, end_time, break_minutes, zone, area,
  status, source, source_version, payload, checksum, published_at, updated_at
)
values
  ('KC_WERNE','KC_DP','KC-WM-2026','KC-TEST-KASSE-01','KC-P-M0005',
   (now() at time zone 'Europe/Berlin')::date,'09:00'::time,'11:00'::time,0,'V','Vorne',
   'published','manual_test','KC_MANUAL_KASSE_MINITEST_V1',
   '{"test":true,"label":"Bibi / Vorne"}'::jsonb,
   md5('KC-TEST-KASSE-01|'||(now() at time zone 'Europe/Berlin')::date::text),
   now(),now()),
  ('KC_WERNE','KC_DP','KC-WM-2026','KC-TEST-KASSE-02','KC-P-M0007',
   (now() at time zone 'Europe/Berlin')::date,'10:00'::time,'13:00'::time,0,'H','Hinten',
   'published','manual_test','KC_MANUAL_KASSE_MINITEST_V1',
   '{"test":true,"label":"Einhorn / Hinten"}'::jsonb,
   md5('KC-TEST-KASSE-02|'||(now() at time zone 'Europe/Berlin')::date::text),
   now(),now()),
  ('KC_WERNE','KC_DP','KC-WM-2026','KC-TEST-KASSE-03','KC-P-M0014',
   (now() at time zone 'Europe/Berlin')::date,'11:30'::time,'14:30'::time,0,'V','Kasse',
   'published','manual_test','KC_MANUAL_KASSE_MINITEST_V1',
   '{"test":true,"label":"Bambi / Kasse"}'::jsonb,
   md5('KC-TEST-KASSE-03|'||(now() at time zone 'Europe/Berlin')::date::text),
   now(),now()),
  ('KC_WERNE','KC_DP','KC-WM-2026','KC-TEST-KASSE-04','KC-P-M0004',
   (now() at time zone 'Europe/Berlin')::date,'12:00'::time,'16:00'::time,0,'B','Bereitschaft',
   'published','manual_test','KC_MANUAL_KASSE_MINITEST_V1',
   '{"test":true,"label":"Balu / Bereitschaft"}'::jsonb,
   md5('KC-TEST-KASSE-04|'||(now() at time zone 'Europe/Berlin')::date::text),
   now(),now())
on conflict (org_id,event_id,source_shift_id) do update set
  person_id=excluded.person_id,
  work_date=excluded.work_date,
  start_time=excluded.start_time,
  end_time=excluded.end_time,
  break_minutes=excluded.break_minutes,
  zone=excluded.zone,
  area=excluded.area,
  status='published',
  source=excluded.source,
  source_version=excluded.source_version,
  payload=excluded.payload,
  checksum=excluded.checksum,
  published_at=excluded.published_at,
  updated_at=excluded.updated_at;

select source_shift_id, person_id, work_date, start_time, end_time, area, status
from public.kc_dp_plan_published
where org_id='KC_WERNE'
  and event_id='KC-WM-2026'
  and source_shift_id like 'KC-TEST-KASSE-%'
order by start_time;
