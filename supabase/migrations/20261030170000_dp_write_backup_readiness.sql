-- KC_DP_WRITE_GATE_V2: table admission is independent of daily snapshot enrollment.
-- Verified beforehand: Supabase and Neon both contain revisions 1..28 with checksum
-- 5a925197206ed8a18ce206b44a4ecd3d. No workspace payload is changed by this migration.
do $guard$ begin
 if md5(pg_get_functiondef('public.kc_dp_workspace_save(text,text,uuid,bigint,jsonb,bigint)'::regprocedure)) <> 'd96fc610db2bb2d2207c774ca438acb0' then
 raise exception 'Workspace save function changed; review before applying.';end if;
 if not exists(select 1 from public.kc_db_mirror_table_rules where table_name='kc_dp_workspace_revisions' and mirror_enabled) then
 raise exception 'Workspace mirror admission missing.';end if;
end $guard$;
alter table public.kc_db_mirror_table_rules add column if not exists write_backup_ready boolean not null default false;
comment on column public.kc_db_mirror_table_rules.write_backup_ready is
'Write admission after verified recovery preparation; independent of backup_enabled daily snapshot enrollment. Not a statement about the latest backup run.';
update public.kc_db_mirror_table_rules set write_backup_ready=true,
 note=case when position('KC_DP_WRITE_GATE_V2' in coalesce(note,''))>0 then note else coalesce(note,'')||' · KC_DP_WRITE_GATE_V2: Schreibfreigabe nach geprüftem Spiegelbestand separat von täglicher Snapshot-Auswahl' end,
 updated_at=now() where table_name='kc_dp_workspace_revisions';
CREATE OR REPLACE FUNCTION public.kc_dp_workspace_save(p_org_id text, p_project_id text, p_operation_id uuid, p_expected_version bigint, p_envelope jsonb, p_legacy_seq bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_version bigint; prior public.kc_dp_workspace_revisions; legacy_head bigint; baseline_seq bigint;
begin
  if auth.uid() is null or not public.kc_dp_is_permanent_user() or not exists (
    select 1 from public.kc_dp_memberships m where m.user_id = auth.uid()
    and m.org_id = p_org_id and m.active and m.role in ('admin','planner','duty_manager')
  ) then raise exception 'Planning role required' using errcode = '42501'; end if;
  if p_expected_version is null or p_expected_version < 0 or p_operation_id is null
    or p_legacy_seq is null or p_project_id is null or length(p_project_id) not between 1 and 100
    or p_envelope is null or jsonb_typeof(p_envelope) <> 'object'
    or octet_length(p_envelope::text) > 20000000
  then raise exception 'Invalid workspace request' using errcode = '22023'; end if;

  if not exists (select 1 from public.kc_db_mirror_table_rules where table_name='kc_dp_workspace_revisions' and mirror_enabled and (backup_enabled or write_backup_ready)) then raise exception 'Backup preparation is not complete' using errcode='23514'; end if;
  -- Locks the empty workspace too: two initial writers cannot both create version 1.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id || chr(31) || p_project_id, 0));
  select coalesce(max(version),0) into current_version from public.kc_dp_workspace_revisions
    where org_id = p_org_id and project_id = p_project_id;
  select coalesce(max(seq),0) into legacy_head from public.kc_dp_sync_operations
    where org_id = p_org_id and project_id = p_project_id;
  select legacy_seq into baseline_seq from public.kc_dp_workspace_revisions
    where org_id = p_org_id and project_id = p_project_id order by version desc limit 1;
  select * into prior from public.kc_dp_workspace_revisions
    where org_id = p_org_id and project_id = p_project_id and operation_id = p_operation_id;
  if found then
    if prior.actor_user_id <> auth.uid() or prior.envelope <> p_envelope then
      raise exception 'Operation identity mismatch' using errcode = '22023';
    end if;
    return jsonb_build_object('status','ok','version',prior.version,'currentVersion',current_version,
      'operationId',p_operation_id,'duplicate',true);
  end if;
  if current_version <> p_expected_version or legacy_head <> coalesce(baseline_seq,p_legacy_seq) then
    return jsonb_build_object('status','conflict','currentVersion',current_version);
  end if;
  insert into public.kc_dp_workspace_revisions(org_id,project_id,version,operation_id,actor_user_id,envelope,legacy_seq)
    values(p_org_id,p_project_id,current_version+1,p_operation_id,auth.uid(),p_envelope,coalesce(baseline_seq,p_legacy_seq));
  return jsonb_build_object('status','ok','version',current_version+1,'currentVersion',current_version+1,
    'operationId',p_operation_id,'duplicate',false);
end $function$
