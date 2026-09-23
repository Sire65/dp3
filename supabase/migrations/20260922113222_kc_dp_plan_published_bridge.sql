
-- Gegenrichtung zu kc_dp_timeclock_actuals: dp2 veroeffentlicht seinen Sollplan hierher,
-- der Manager liest ihn und reicht ihn (pseudonymisiert) an die Kassen weiter.
-- Rein additiv - fasst keine bestehende Tabelle/Funktion an.

create table if not exists public.kc_dp_plan_published (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  project_id text not null default 'KC_DP',
  event_id text not null,
  source_shift_id text not null,
  person_id text not null,
  work_date date not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0,
  zone text,
  area text,
  status text not null default 'published',
  source text not null default 'dp2',
  source_version text,
  payload jsonb not null,
  checksum text not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, event_id, source_shift_id)
);

create index if not exists kc_dp_plan_published_lookup
  on public.kc_dp_plan_published (org_id, work_date, status);

alter table public.kc_dp_plan_published enable row level security;

-- Nur aktive Manager-Admins duerfen lesen - dieselbe Rollenpruefung wie bei den bestehenden
-- Manager-eigenen Tabellen, gespiegelt (dort liest dp2 vom Manager, hier liest der Manager
-- von dp2).
create policy kc_dp_plan_published_manager_read
  on public.kc_dp_plan_published
  for select
  to authenticated
  using (
    exists (
      select 1 from public.kc_manager_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = kc_dp_plan_published.org_id
        and m.active is true
        and m.role in ('admin', 'superadmin')
    )
  );

-- Veroeffentlichungsfunktion: dp2 ruft sie auf (SECURITY DEFINER, prueft die Berechtigung
-- selbst, da RLS fuer INSERT/UPDATE bewusst keine eigene Policy bekommt - genau das Muster
-- von kc_dp_timeclock_publish, nur fuer die umgekehrte Richtung).
-- Upsert statt "on conflict do nothing": ein Sollplan aendert sich (Zeiten, Absagen), anders
-- als abgeschlossene Ist-Buchungen, die unveraenderlich sind.
-- Alles aus diesem Aufruf, was zu diesem org_id/event_id/work_date-Bereich gehoert aber NICHT
-- im aktuellen Stapel steckt, wird auf status='removed' gesetzt (weiche Loeschung) - so bleibt
-- eine inzwischen gestrichene Schicht nicht faelschlich weiter sichtbar.
create or replace function public.kc_dp_plan_publish(p_org_id text, p_event_id text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_row jsonb;
  v_upserted integer := 0;
  v_source_id text;
  v_min_date date;
  v_max_date date;
  v_ids text[] := '{}';
begin
  if (select auth.uid()) is null then
    raise exception 'Anmeldung erforderlich';
  end if;
  if not exists (
    select 1 from public.kc_dp_memberships m
    where m.user_id = (select auth.uid())
      and m.org_id = p_org_id
      and m.active is true
      and m.role in ('admin', 'planner', 'duty_manager')
  ) then
    raise exception 'Keine aktive dp2-Planungsberechtigung';
  end if;
  if coalesce(length(trim(p_event_id)), 0) = 0 or length(p_event_id) > 64 then
    raise exception 'Veranstaltungs-ID fehlt oder ist zu lang';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'Der Sollplan muss als Liste mit hoechstens 5000 Zeilen uebergeben werden';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_source_id := nullif(trim(v_row->>'sourceShiftId'), '');
    if v_source_id is null or length(v_source_id) > 240 then
      raise exception 'Eine Schicht besitzt keine gueltige Quellen-ID';
    end if;
    if nullif(trim(v_row->>'personId'), '') is null then
      raise exception 'Personen-ID fehlt';
    end if;
    if (v_row->>'date') is null then
      raise exception 'Datum fehlt';
    end if;

    v_ids := v_ids || v_source_id;
    v_min_date := least(coalesce(v_min_date, (v_row->>'date')::date), (v_row->>'date')::date);
    v_max_date := greatest(coalesce(v_max_date, (v_row->>'date')::date), (v_row->>'date')::date);

    insert into public.kc_dp_plan_published (
      org_id, project_id, event_id, source_shift_id, person_id, work_date,
      start_time, end_time, break_minutes, zone, area, status, source, source_version,
      payload, checksum, published_at, updated_at
    ) values (
      p_org_id, 'KC_DP', trim(p_event_id), v_source_id, trim(v_row->>'personId'),
      (v_row->>'date')::date,
      (v_row->>'start')::time, (v_row->>'end')::time,
      greatest(0, least(1440, coalesce((v_row->>'breakMinutes')::integer, 0))),
      nullif(trim(v_row->>'zone'), ''), nullif(trim(v_row->>'area'), ''),
      'published', 'dp2', 'KC_DP_PLAN_PUBLISHED_V1/0.1.0',
      v_row,
      md5(concat_ws('|', p_org_id, p_event_id, v_source_id, v_row->>'personId', v_row->>'date', v_row->>'start', v_row->>'end')),
      now(), now()
    )
    on conflict (org_id, event_id, source_shift_id) do update set
      person_id = excluded.person_id,
      work_date = excluded.work_date,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      break_minutes = excluded.break_minutes,
      zone = excluded.zone,
      area = excluded.area,
      status = 'published',
      payload = excluded.payload,
      checksum = excluded.checksum,
      updated_at = now();
    v_upserted := v_upserted + 1;
  end loop;

  -- Weiche Loeschung: alles im selben org_id/event_id/Datumsbereich, was jetzt nicht mehr
  -- im Stapel steckt, gilt als aus dem Sollplan entfernt.
  if v_min_date is not null then
    update public.kc_dp_plan_published
    set status = 'removed', updated_at = now()
    where org_id = p_org_id
      and event_id = trim(p_event_id)
      and work_date between v_min_date and v_max_date
      and status = 'published'
      and not (source_shift_id = any(v_ids));
  end if;

  return jsonb_build_object('ok', true, 'received', jsonb_array_length(p_rows), 'upserted', v_upserted, 'eventId', p_event_id);
end;
$function$;

grant execute on function public.kc_dp_plan_publish(text, text, jsonb) to authenticated;
