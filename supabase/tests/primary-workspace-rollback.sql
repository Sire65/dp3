-- Standalone SQL assertions (not pgTAP). Run against the migrated schema; always rolls back.
begin;
do $test$
declare u uuid; org text; a jsonb; id uuid := gen_random_uuid(); env jsonb := '{"test":"encrypted-fixture"}'; rejected boolean := false;
begin
  select m.user_id,m.org_id into u,org from public.kc_dp_memberships m where m.active and m.role='admin' limit 1;
  if u is null then raise exception 'No admin fixture available'; end if;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'is_anonymous',false)::text,true);
  a:=public.kc_dp_workspace_read(org,'__KC_DP_PRIMARY_ROLLBACK_TEST__');
  if a->>'status'<>'empty' then raise exception 'Expected empty workspace'; end if;
  a:=public.kc_dp_workspace_save(org,'__KC_DP_PRIMARY_ROLLBACK_TEST__',id,0,env,0);
  if a->>'status'<>'ok' or (a->>'version')::int<>1 then raise exception 'First save failed'; end if;
  a:=public.kc_dp_workspace_save(org,'__KC_DP_PRIMARY_ROLLBACK_TEST__',id,0,env,0);
  if not (a->>'duplicate')::boolean then raise exception 'Retry not idempotent'; end if;
  a:=public.kc_dp_workspace_save(org,'__KC_DP_PRIMARY_ROLLBACK_TEST__',gen_random_uuid(),0,env,0);
  if a->>'status'<>'conflict' then raise exception 'Stale write accepted'; end if;
  a:=public.kc_dp_workspace_save(org,'__KC_DP_PRIMARY_ROLLBACK_TEST__',gen_random_uuid(),1,env,0);
  if (a->>'version')::int<>2 then raise exception 'Second save failed'; end if;
  a:=public.kc_dp_workspace_save(org,'__KC_DP_PRIMARY_ROLLBACK_TEST__',id,0,env,0);
  if (a->>'currentVersion')::int<>2 or (a->>'version')::int<>1 then raise exception 'Own retry confused with newer writer'; end if;
  begin perform public.kc_dp_workspace_save(org,'__KC_DP_PRIMARY_ROLLBACK_TEST__',id,0,'{"test":"different"}',0);
  exception when sqlstate '22023' then rejected:=true; end;
  if not rejected then raise exception 'ID reused with changed content'; end if; rejected:=false;
  begin perform public.kc_dp_workspace_save(org,'__KC_DP_PRIMARY_ROLLBACK_TEST__',gen_random_uuid(),null,env,0);
  exception when sqlstate '22023' then rejected:=true; end;
  if not rejected then raise exception 'Null version accepted'; end if; rejected:=false;
  begin perform public.kc_dp_workspace_read(org||'__not_a_member','__KC_DP_PRIMARY_ROLLBACK_TEST__');
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Cross-organization read allowed'; end if; rejected:=false;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  begin perform public.kc_dp_workspace_read(org,'__KC_DP_PRIMARY_ROLLBACK_TEST__');
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Unauthenticated read allowed'; end if;
  if has_table_privilege('authenticated','public.kc_dp_workspace_revisions','INSERT')
    or has_table_privilege('authenticated','public.kc_dp_workspace_revisions','SELECT')
    or has_function_privilege('anon','public.kc_dp_workspace_read(text,text)','EXECUTE') then
    raise exception 'Direct table access or anonymous RPC access allowed';
  end if;
  if (select count(*) from public.kc_dp_workspace_revisions where project_id='__KC_DP_PRIMARY_ROLLBACK_TEST__')<>2 then raise exception 'Unexpected revision count'; end if;
end $test$;
select 'PASS: first write, retry, stale version, next revision, own receipt vs foreign newer version, changed ID payload, null version, organization scope, unauthenticated access, direct access denied, exactly two revisions; transaction rolled back' as result;
rollback;
