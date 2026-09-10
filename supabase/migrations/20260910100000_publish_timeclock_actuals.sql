create or replace function public.kc_dp_timeclock_publish(
  p_org_id text,
  p_event_id text,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_row jsonb;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_affected integer := 0;
  v_status text;
  v_source_id text;
begin
  if (select auth.uid()) is null then
    raise exception 'Anmeldung erforderlich';
  end if;
  if not exists (
    select 1 from public.kc_manager_memberships m
    where m.user_id = (select auth.uid())
      and m.org_id = p_org_id
      and m.active is true
      and m.role in ('admin','superadmin')
  ) then
    raise exception 'Keine aktive Manager-Adminberechtigung';
  end if;
  if coalesce(length(trim(p_event_id)),0) = 0 or length(p_event_id) > 64 then
    raise exception 'Veranstaltungs-ID fehlt oder ist zu lang';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'Istzeiten müssen als Liste mit höchstens 5000 Zeilen übergeben werden';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_source_id := nullif(trim(v_row->>'sourceEventId'),'');
    if v_source_id is null or length(v_source_id) > 240 then
      raise exception 'Eine Istzeit besitzt keine gültige Quellen-ID';
    end if;
    v_status := case v_row->>'status'
      when 'vollstaendig' then 'complete'
      when 'complete' then 'complete'
      when 'nur_kommen' then 'missing_end'
      when 'missing_end' then 'missing_end'
      when 'nur_gehen' then 'missing_start'
      when 'missing_start' then 'missing_start'
      when 'voided' then 'voided'
      else null
    end;
    if v_status is null then raise exception 'Unbekannter Buchungsstatus'; end if;
    if nullif(trim(v_row->>'memberNo'),'') is null and nullif(trim(v_row->>'personId'),'') is null then
      raise exception 'Mitgliedsnummer oder Personen-ID fehlt';
    end if;

    insert into public.kc_dp_timeclock_actuals(
      org_id, project_id, event_id, source_event_id, member_no, person_id,
      display_name, work_date, start_time, end_time, break_minutes, status,
      source, source_version, payload, checksum, published_at, updated_at
    ) values (
      p_org_id, 'KC_DP', trim(p_event_id), v_source_id,
      nullif(trim(v_row->>'memberNo'),''), nullif(trim(v_row->>'personId'),''),
      nullif(trim(v_row->>'name'),''), (v_row->>'date')::date,
      nullif(v_row->>'start','')::time, nullif(v_row->>'end','')::time,
      greatest(0,least(1440,coalesce((v_row->>'breakMinutes')::integer,0))), v_status,
      'pc_manager', 'KC_DUTY_ROSTER_ACTUALS_V1/0.4.0', v_row,
      md5(concat_ws('|',p_org_id,p_event_id,v_source_id,v_row->>'memberNo',v_row->>'personId',v_row->>'date',v_row->>'start',v_row->>'end',v_row->>'breakMinutes',v_status)),
      now(), now()
    ) on conflict (org_id,event_id,source_event_id) do nothing;
    get diagnostics v_affected = row_count;
    if v_affected = 1 then v_inserted := v_inserted + 1; else v_skipped := v_skipped + 1; end if;
  end loop;
  return jsonb_build_object('ok',true,'received',jsonb_array_length(p_rows),'inserted',v_inserted,'skipped',v_skipped,'eventId',p_event_id);
end;
$$;

revoke all on function public.kc_dp_timeclock_publish(text,text,jsonb) from public, anon;
grant execute on function public.kc_dp_timeclock_publish(text,text,jsonb) to authenticated;
comment on function public.kc_dp_timeclock_publish(text,text,jsonb) is 'Geschützter, idempotenter PC-Manager-Schreibweg für DP2-Istzeiten.';