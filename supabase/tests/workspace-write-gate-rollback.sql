-- Contract check: no planning writes; transaction is rolled back.
begin;
set local statement_timeout='10s';
do $test$
declare function_oid oid := 'public.kc_dp_workspace_save(text,text,uuid,bigint,jsonb,bigint)'::regprocedure;
begin
  if exists(select 1 from (values
    (false,false,false,false),(false,false,true,false),
    (false,true,false,false),(false,true,true,false),
    (true,false,false,false),(true,false,true,true),
    (true,true,false,true),(true,true,true,true)
  ) t(mirror_enabled,backup_enabled,write_backup_ready,expected)
  where (mirror_enabled and (backup_enabled or write_backup_ready)) is distinct from expected)
  then raise exception 'Write readiness truth table failed';end if;
  if not exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='kc_db_mirror_table_rules' and column_name='write_backup_ready'
    and is_nullable='NO' and column_default='false')
  then raise exception 'Missing fail-closed readiness column';end if;
  if not exists(select 1 from public.kc_db_mirror_table_rules
    where table_name='kc_dp_workspace_revisions' and mirror_enabled and (backup_enabled or write_backup_ready))
  then raise exception 'DP2 writes are still blocked';end if;
  if has_function_privilege('anon',function_oid,'EXECUTE')
    or not has_function_privilege('authenticated',function_oid,'EXECUTE')
  then raise exception 'Unexpected RPC permissions';end if;
  if has_table_privilege('authenticated','public.kc_dp_workspace_revisions','INSERT,UPDATE,DELETE')
    or not (select relrowsecurity from pg_class where oid='public.kc_dp_workspace_revisions'::regclass)
  then raise exception 'Workspace table protection changed';end if;
  begin
    perform public.kc_dp_workspace_save('KC_DP_GATE_TEST_ONLY','fixture',
      '00000000-0000-4000-8000-000000000306'::uuid,0,'{}'::jsonb,0);
    raise exception 'Missing planning membership was accepted';
  exception when insufficient_privilege then null;
  end;
end $test$;
rollback;
select 'PASS: readiness truth table, false default, live admission, role gate, RPC grants and RLS/direct-write denial; rolled back' as result;
