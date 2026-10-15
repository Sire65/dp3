-- DP2-F-SE-02/03 Stundenmeldungen zu Sondereinsätzen (KICC-F-100): Eingang Club-App → DP2.
-- Ein Kollege meldet für sich und weitere Kollegen (Sammelmeldung, je Person eine Zeile, gemeinsame sammel_id).
-- Club-App schreibt NUR über die Edge Function kc-club (service_role). DP2 holt offene Meldungen per
-- kc_dp_hour_reports_pending ab und entscheidet per kc_dp_hour_report_decide (nur Planungsrollen).
-- Gutschrift im Stundenkonto erst nach „bestaetigt“ (AGENTS 11: Unbestätigtes nie als OK).
-- Rein additiv. Rückweg: drop function public.kc_dp_hour_report_decide(uuid, text, text, text);
--   drop function public.kc_dp_hour_reports_pending(text, text); drop table public.kc_dp_hour_reports;

create table if not exists public.kc_dp_hour_reports (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  project_id text not null default 'KC_DP',
  event_id text not null,
  special_event_id text not null check (char_length(special_event_id) between 1 and 80),
  special_event_title text check (special_event_title is null or char_length(special_event_title) <= 120),
  sammel_id uuid not null,
  person_id text not null,
  gemeldet_von text not null,
  work_date date not null,
  start_h numeric(4,2) not null check (start_h >= 0 and start_h < 24),
  end_h numeric(4,2) not null check (end_h > 0 and end_h <= 30),          -- bis 30 = 06:00 Folgetag (Fahrt nach Hause)
  break_minutes integer not null default 0 check (break_minutes between 0 and 180),
  taetigkeit text not null check (char_length(taetigkeit) between 1 and 40),
  bemerkung text check (bemerkung is null or char_length(bemerkung) <= 500),
  status text not null default 'gemeldet' check (status in ('gemeldet', 'bestaetigt', 'abgelehnt', 'zurueckgezogen')),
  verspaetet boolean not null default false,                               -- Meldefrist 3 Tage überschritten
  source text not null default 'club_app' check (source in ('club_app', 'dp2')),
  gemeldet_am timestamptz not null default now(),
  entschieden_von uuid,
  entschieden_am timestamptz,
  ablehngrund text check (ablehngrund is null or char_length(ablehngrund) <= 500),
  actual_id text,                                                          -- DP2-Ist-Zeit, die bei Bestätigung entstand
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  check (end_h > start_h and end_h - start_h <= 16)
);
create index if not exists kc_dp_hour_reports_offen on public.kc_dp_hour_reports (org_id, event_id) where status = 'gemeldet';
create index if not exists kc_dp_hour_reports_person on public.kc_dp_hour_reports (org_id, person_id, work_date);
create index if not exists kc_dp_hour_reports_sammel on public.kc_dp_hour_reports (sammel_id);

alter table public.kc_dp_hour_reports enable row level security;
revoke all privileges on table public.kc_dp_hour_reports from anon;
revoke all privileges on table public.kc_dp_hour_reports from authenticated;
grant select, insert, update on table public.kc_dp_hour_reports to service_role;  -- Edge Function kc-club
-- Kein direkter Zugriff: Club-App über kc-club (service_role), DP2 nur über die Funktionen unten.
drop policy if exists kc_dp_hour_reports_deny_direct on public.kc_dp_hour_reports;
create policy kc_dp_hour_reports_deny_direct on public.kc_dp_hour_reports for all to anon, authenticated using (false) with check (false);
comment on table public.kc_dp_hour_reports is 'Stundenmeldungen zu Sondereinsätzen (Club-App → DP2). Schreiben nur kc-club (service_role); DP2 liest/entscheidet per kc_dp_hour_reports_pending / kc_dp_hour_report_decide. Contract KC_DP_HOUR_REPORTS_V1.';

create or replace function public.kc_dp_hour_reports_pending(p_org_id text, p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Anmeldung erforderlich'; end if;
  if not exists (select 1 from public.kc_dp_memberships m where m.user_id = (select auth.uid()) and m.org_id = p_org_id and m.active is true
                 and m.role in ('admin','planner','duty_manager')) then
    raise exception 'Keine aktive dp2-Planungsberechtigung';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'sammel_id', r.sammel_id, 'event_id', r.event_id, 'special_event_id', r.special_event_id,
      'special_event_title', r.special_event_title, 'person_id', r.person_id, 'gemeldet_von', r.gemeldet_von,
      'work_date', r.work_date, 'start_h', r.start_h, 'end_h', r.end_h, 'break_minutes', r.break_minutes,
      'taetigkeit', r.taetigkeit, 'bemerkung', r.bemerkung, 'status', r.status, 'verspaetet', r.verspaetet,
      'source', r.source, 'gemeldet_am', r.gemeldet_am, 'version', r.version) order by r.gemeldet_am)
    from public.kc_dp_hour_reports r where r.org_id = p_org_id and r.event_id = trim(p_event_id) and r.status = 'gemeldet'), '[]'::jsonb);
end;
$function$;
revoke all on function public.kc_dp_hour_reports_pending(text,text) from public, anon;
grant execute on function public.kc_dp_hour_reports_pending(text, text) to authenticated;

-- Planer entscheidet: nur solange die Meldung noch offen ist (sonst stale → DP2 lädt neu).
create or replace function public.kc_dp_hour_report_decide(p_id uuid, p_status text, p_reason text default '', p_actual_id text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare v_org text; v_n integer; v_version integer;
begin
  if (select auth.uid()) is null then raise exception 'Anmeldung erforderlich'; end if;
  select org_id into v_org from public.kc_dp_hour_reports where id = p_id;
  if v_org is null then raise exception 'Meldung nicht gefunden'; end if;
  if not exists (select 1 from public.kc_dp_memberships m where m.user_id = (select auth.uid()) and m.org_id = v_org and m.active is true
                 and m.role in ('admin','planner','duty_manager')) then
    raise exception 'Keine aktive dp2-Planungsberechtigung';
  end if;
  if p_status not in ('bestaetigt', 'abgelehnt') then raise exception 'Status muss bestaetigt oder abgelehnt sein'; end if;
  if p_status = 'abgelehnt' and coalesce(length(trim(p_reason)), 0) = 0 then raise exception 'Für eine Ablehnung ist ein Grund erforderlich'; end if;
  update public.kc_dp_hour_reports
     set status = p_status, entschieden_von = (select auth.uid()), entschieden_am = now(),
         ablehngrund = case when p_status = 'abgelehnt' then left(trim(p_reason), 500) else null end,
         actual_id = case when p_status = 'bestaetigt' then left(p_actual_id, 120) else null end,
         version = version + 1, updated_at = now()
   where id = p_id and status = 'gemeldet'
  returning version into v_version;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n = 1, 'stale', v_n = 0, 'id', p_id, 'status', p_status, 'version', v_version);
end;
$function$;
revoke all on function public.kc_dp_hour_report_decide(uuid,text,text,text) from public, anon;
grant execute on function public.kc_dp_hour_report_decide(uuid, text, text, text) to authenticated;

-- Datenvertrag + Spiegel/Sicherung (wie Wunsch-Eingang)
insert into public.kc_core_data_contract (data_area, app_id, is_owner, may_read, may_write, tables_hint, note, contract_version, created_at, updated_at)
values
  ('stunden_eingang', 'KC_CLUBAPP', true, true, true, 'kc_dp_hour_reports, kc_dp_special_events',
   'Club-App liefert Stundenmeldungen zu Sondereinsätzen (Sammelmeldung) an und zeigt den Status', 'KC_DP_HOUR_REPORTS_V1', now(), now()),
  ('stunden_eingang', 'KC_DP', false, true, true, 'kc_dp_hour_reports',
   'DP2 holt ab (kc_dp_hour_reports_pending), bestätigt/lehnt ab (kc_dp_hour_report_decide) und bucht bestätigte Stunden als Ist', 'KC_DP_HOUR_REPORTS_V1', now(), now())
on conflict (data_area, app_id) do nothing;
insert into public.kc_db_mirror_table_rules(table_name, area, sensitivity, realtime_allowed, mirror_enabled, backup_enabled, note, updated_at) values
  ('kc_dp_special_events', 'KC DP', 'normal', false, true, true, 'DP2 Sondereinsätze (veröffentlicht) – gespiegelt und gesichert', now()),
  ('kc_dp_hour_reports', 'KC DP', 'sensitive', false, true, true, 'Stundenmeldungen Club-App → DP2 – gespiegelt und gesichert', now())
on conflict (table_name) do nothing;
insert into public.kc_neon_resume_tables(table_name, captured_at)
select t, now() from unnest(array['kc_dp_special_events', 'kc_dp_hour_reports']) t
where not exists (select 1 from public.kc_neon_resume_tables x where x.table_name = t);
