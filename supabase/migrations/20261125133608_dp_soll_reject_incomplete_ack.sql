do $migration$
declare
  v_definition text;
  v_anchor text := '  update public.kc_dp_soll_uebergabe set status = p_status';
  v_guard text := $guard$
  -- DP2_COMPLETION_GUARD_V1: partial/failed imports must stay open, including older clients.
  if p_status = 'uebernommen' and (
    jsonb_typeof(coalesce(p_ergebnis, '{}'::jsonb)) <> 'object'
    or (p_ergebnis ? 'complete' and p_ergebnis->'complete' is distinct from 'true'::jsonb)
    or (p_ergebnis ? 'skipped' and p_ergebnis->'skipped' is distinct from '0'::jsonb)
    or (p_ergebnis ? 'fehler' and p_ergebnis->'fehler' is distinct from '0'::jsonb)
    or (p_ergebnis ? 'remaining' and p_ergebnis->'remaining' is distinct from '0'::jsonb)
    or (p_ergebnis ? 'problems' and p_ergebnis->'problems' is distinct from '[]'::jsonb)
  ) then
    raise exception 'Unvollstaendige Uebernahme: offene oder fehlerhafte Eintraege zuerst klaeren.';
  end if;
$guard$;
begin
  select pg_get_functiondef('public.kc_dp_soll_uebergabe_ack(uuid,text,jsonb)'::regprocedure) into v_definition;
  if strpos(v_definition, 'DP2_COMPLETION_GUARD_V1') > 0 then return; end if;
  if md5(v_definition) <> '56e649dd03ca7b6d493f2ebfb5a1565c' or strpos(v_definition,v_anchor)=0 then
    raise exception 'RPC definition changed; review required before patching.';
  end if;
  execute replace(v_definition,v_anchor,v_guard || E'\n' || v_anchor);
end;
$migration$;
