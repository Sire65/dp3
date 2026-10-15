-- KICC-F-100 Phase 7/8: Zusagen zu Sondereinsätzen (mit Anreise) und Fahrgemeinschaften; Erinnerung nach 3 Tagen.
-- Zusagen schreibt die Club App über kc-club (service_role); DP2 liest per kc_dp_special_event_signups_list (Planer).
-- Fahrgemeinschaften legt der Planer in DP2 fest und veröffentlicht sie per kc_dp_carpools_publish (Snapshot je Einsatz);
-- die Club App zeigt sie den Beteiligten (service_role). Es werden nur Orte gespeichert, keine Adressen.
-- Rückweg: drop function public.kc_dp_carpools_publish(text,text,text,jsonb); drop function public.kc_dp_special_event_signups_list(text,text);
--   drop table public.kc_dp_hour_report_reminders; drop table public.kc_dp_carpools; drop table public.kc_dp_special_event_signups;

create table if not exists public.kc_dp_special_event_signups (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  event_id text not null,
  special_event_id text not null check (char_length(special_event_id) between 1 and 80),
  person_id text not null,
  antwort text not null check (antwort in ('ja', 'vielleicht', 'nein')),
  anreise text check (anreise is null or anreise in ('fahrer', 'mitfahrer', 'selbst')),
  plaetze integer not null default 0 check (plaetze between 0 and 8),       -- freie Plätze, nur bei anreise = fahrer
  startort text check (startort is null or char_length(startort) <= 60),     -- nur der Ort, keine Adresse
  bemerkung text check (bemerkung is null or char_length(bemerkung) <= 300),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  unique (org_id, event_id, special_event_id, person_id)
);
create index if not exists kc_dp_special_event_signups_event on public.kc_dp_special_event_signups (org_id, event_id, special_event_id);
alter table public.kc_dp_special_event_signups enable row level security;
revoke all privileges on table public.kc_dp_special_event_signups from anon;
revoke all privileges on table public.kc_dp_special_event_signups from authenticated;
grant select, insert, update on table public.kc_dp_special_event_signups to service_role;
drop policy if exists kc_dp_special_event_signups_deny_direct on public.kc_dp_special_event_signups;
create policy kc_dp_special_event_signups_deny_direct on public.kc_dp_special_event_signups for all to anon, authenticated using (false) with check (false);

create table if not exists public.kc_dp_carpools (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  event_id text not null,
  special_event_id text not null,
  source_id text not null check (char_length(source_id) between 1 and 80),
  fahrer_id text not null,
  mitfahrer text[] not null default '{}',
  startort text check (startort is null or char_length(startort) <= 60),
  status text not null default 'published' check (status in ('published', 'removed')),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (org_id, event_id, special_event_id, source_id),
  check (cardinality(mitfahrer) <= 8)
);
alter table public.kc_dp_carpools enable row level security;
revoke all privileges on table public.kc_dp_carpools from anon;
revoke all privileges on table public.kc_dp_carpools from authenticated;
grant select on table public.kc_dp_carpools to service_role;
drop policy if exists kc_dp_carpools_deny_direct on public.kc_dp_carpools;
create policy kc_dp_carpools_deny_direct on public.kc_dp_carpools for all to anon, authenticated using (false) with check (false);

-- Erinnerung nach Ablauf der Meldefrist: höchstens einmal je Person, Einsatz und Tag
create table if not exists public.kc_dp_hour_report_reminders (
  org_id text not null,
  event_id text not null,
  special_event_id text not null,
  work_date date not null,
  person_id text not null,
  erinnert_am timestamptz not null default now(),
  primary key (org_id, event_id, special_event_id, work_date, person_id)
);
alter table public.kc_dp_hour_report_reminders enable row level security;
revoke all privileges on table public.kc_dp_hour_report_reminders from anon;
revoke all privileges on table public.kc_dp_hour_report_reminders from authenticated;
grant select, insert on table public.kc_dp_hour_report_reminders to service_role;
drop policy if exists kc_dp_hour_report_reminders_deny_direct on public.kc_dp_hour_report_reminders;
create policy kc_dp_hour_report_reminders_deny_direct on public.kc_dp_hour_report_reminders for all to anon, authenticated using (false) with check (false);

create or replace function public.kc_dp_special_event_signups_list(p_org_id text, p_event_id text)
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
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'special_event_id', s.special_event_id, 'person_id', s.person_id,
      'antwort', s.antwort, 'anreise', s.anreise, 'plaetze', s.plaetze, 'startort', s.startort, 'bemerkung', s.bemerkung,
      'version', s.version, 'updated_at', s.updated_at) order by s.special_event_id, s.updated_at)
    from public.kc_dp_special_event_signups s where s.org_id = p_org_id and s.event_id = trim(p_event_id)), '[]'::jsonb);
end;
$function$;
revoke all on function public.kc_dp_special_event_signups_list(text,text) from public, anon;
grant execute on function public.kc_dp_special_event_signups_list(text, text) to authenticated;

-- Planer veröffentlicht die Fahrgemeinschaften eines Einsatzes (vollständiger Stand; Fehlendes wird entfernt)
create or replace function public.kc_dp_carpools_publish(p_org_id text, p_event_id text, p_special_event_id text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare v_row jsonb; v_ids text[] := '{}'; v_n integer := 0; v_src text;
begin
  if (select auth.uid()) is null then raise exception 'Anmeldung erforderlich'; end if;
  if not exists (select 1 from public.kc_dp_memberships m where m.user_id = (select auth.uid()) and m.org_id = p_org_id and m.active is true
                 and m.role in ('admin','planner','duty_manager')) then
    raise exception 'Keine aktive dp2-Planungsberechtigung';
  end if;
  if coalesce(length(trim(p_special_event_id)), 0) = 0 then raise exception 'Sondereinsatz fehlt'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 100 then raise exception 'Höchstens 100 Fahrgemeinschaften'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_src := nullif(trim(v_row->>'sourceId'), '');
    if v_src is null or nullif(trim(v_row->>'fahrerId'), '') is null then raise exception 'Fahrgemeinschaft ohne Kennung oder Fahrer'; end if;
    v_ids := v_ids || v_src;
    insert into public.kc_dp_carpools (org_id, event_id, special_event_id, source_id, fahrer_id, mitfahrer, startort, status, version, updated_at)
    values (p_org_id, trim(p_event_id), trim(p_special_event_id), v_src, trim(v_row->>'fahrerId'),
            coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_row->'mitfahrer', '[]'::jsonb)) x), '{}'),
            nullif(trim(v_row->>'startort'), ''), 'published', 1, now())
    on conflict (org_id, event_id, special_event_id, source_id) do update set
      fahrer_id = excluded.fahrer_id, mitfahrer = excluded.mitfahrer, startort = excluded.startort, status = 'published',
      version = public.kc_dp_carpools.version + 1, updated_at = now();
    v_n := v_n + 1;
  end loop;
  update public.kc_dp_carpools set status = 'removed', updated_at = now()
   where org_id = p_org_id and event_id = trim(p_event_id) and special_event_id = trim(p_special_event_id)
     and status = 'published' and not (source_id = any (v_ids));
  return jsonb_build_object('ok', true, 'upserted', v_n);
end;
$function$;
revoke all on function public.kc_dp_carpools_publish(text,text,text,jsonb) from public, anon;
grant execute on function public.kc_dp_carpools_publish(text, text, text, jsonb) to authenticated;

insert into public.kc_core_data_contract (data_area, app_id, is_owner, may_read, may_write, tables_hint, note, contract_version, created_at, updated_at)
values
  ('sondereinsatz_zusagen', 'KC_CLUBAPP', true, true, true, 'kc_dp_special_event_signups, kc_dp_carpools, kc_dp_hour_report_reminders',
   'Club-App speichert Zusagen (Anreise, Plätze, Startort ohne Adresse), zeigt Fahrgemeinschaften, erinnert nach der Meldefrist', 'KC_DP_SIGNUPS_V1', now(), now()),
  ('sondereinsatz_zusagen', 'KC_DP', false, true, true, 'kc_dp_special_event_signups, kc_dp_carpools',
   'DP2 liest Zusagen (kc_dp_special_event_signups_list) und veröffentlicht Fahrgemeinschaften (kc_dp_carpools_publish)', 'KC_DP_SIGNUPS_V1', now(), now())
on conflict (data_area, app_id) do nothing;
insert into public.kc_db_mirror_table_rules(table_name, area, sensitivity, realtime_allowed, mirror_enabled, backup_enabled, note, updated_at) values
  ('kc_dp_special_event_signups', 'KC DP', 'sensitive', false, true, true, 'Zusagen zu Sondereinsätzen – gespiegelt und gesichert', now()),
  ('kc_dp_carpools', 'KC DP', 'sensitive', false, true, true, 'Fahrgemeinschaften – gespiegelt und gesichert', now()),
  ('kc_dp_hour_report_reminders', 'KC DP', 'normal', false, true, true, 'Erinnerungen Meldefrist – gespiegelt und gesichert', now())
on conflict (table_name) do nothing;
insert into public.kc_neon_resume_tables(table_name, captured_at)
select t, now() from unnest(array['kc_dp_special_event_signups', 'kc_dp_carpools', 'kc_dp_hour_report_reminders']) t
where not exists (select 1 from public.kc_neon_resume_tables x where x.table_name = t);
