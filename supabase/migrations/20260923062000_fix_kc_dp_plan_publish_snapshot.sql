-- KC DP2 -> PC-Manager Sollplan-Bruecke: Snapshot-Semantik vervollstaendigen.
-- Ein Aufruf von kc_dp_plan_publish beschreibt immer den VOLLSTAENDIGEN aktuell sichtbaren
-- Sollplan fuer org_id + event_id. Deshalb muessen auch bei p_rows = [] alte published-Zeilen
-- auf removed gesetzt werden. Gleichzeitig werden Zeilen, die aus dem 30-Tage-Fenster
-- herausfallen, nicht mehr dauerhaft als published stehen gelassen.

create or replace function public.kc_dp_plan_publish(
  p_org_id text,
  p_event_id text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_row jsonb;
  v_upserted integer := 0;
  v_source_id text;
  v_ids text[] := '{}';
begin
  if (select auth.uid()) is null then
    raise exception 'Anmeldung erforderlich';
  end if;

  if not exists (
    select 1
    from public.kc_dp_memberships m
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
      'published', 'dp2', 'KC_DP_PLAN_PUBLISHED_V1/0.2.0',
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
      source = excluded.source,
      source_version = excluded.source_version,
      payload = excluded.payload,
      checksum = excluded.checksum,
      published_at = excluded.published_at,
      updated_at = now();

    v_upserted := v_upserted + 1;
  end loop;

  -- Snapshot-Semantik: ALLE bislang published Zeilen dieser Veranstaltung, die im neuen
  -- Snapshot fehlen, werden entfernt. Bei [] ist v_ids leer und damit werden alle alten
  -- published Zeilen entfernt. So kann nie ein veralteter Plan in der Kasse stehen bleiben.
  update public.kc_dp_plan_published
  set status = 'removed', updated_at = now()
  where org_id = p_org_id
    and project_id = 'KC_DP'
    and event_id = trim(p_event_id)
    and status = 'published'
    and not (source_shift_id = any(v_ids));

  return jsonb_build_object(
    'ok', true,
    'received', jsonb_array_length(p_rows),
    'upserted', v_upserted,
    'eventId', trim(p_event_id)
  );
end;
$function$;
