-- KC DP primary planning store. Append-only encrypted revisions; no direct client writes.
create table public.kc_dp_workspace_revisions (
  org_id text not null,
  project_id text not null,
  version bigint not null check (version > 0),
  operation_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  legacy_seq bigint not null,
  envelope jsonb not null check (jsonb_typeof(envelope) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (org_id, project_id, version),
  unique (org_id, project_id, operation_id)
);
alter table public.kc_dp_workspace_revisions enable row level security;
revoke all on public.kc_dp_workspace_revisions from public, anon, authenticated;

create function public.kc_dp_workspace_read(p_org_id text, p_project_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.kc_dp_workspace_revisions; legacy_head bigint;
begin
  if auth.uid() is null or not public.kc_dp_is_permanent_user() or not exists (
    select 1 from public.kc_dp_memberships m where m.user_id = auth.uid()
    and m.org_id = p_org_id and m.active and m.role in ('admin','planner','duty_manager')
  ) then raise exception 'Planning role required' using errcode = '42501'; end if;
  select * into r from public.kc_dp_workspace_revisions
    where org_id = p_org_id and project_id = p_project_id order by version desc limit 1;
  select coalesce(max(seq),0) into legacy_head from public.kc_dp_sync_operations
    where org_id = p_org_id and project_id = p_project_id;
  if r.version is null then return jsonb_build_object('status','empty','version',0,'legacySequence',legacy_head); end if;
  if legacy_head <> r.legacy_seq then return jsonb_build_object('status','legacy_changed','version',r.version); end if;
  return jsonb_build_object('status','ok','version',r.version,'envelope',r.envelope,
    'operationId',r.operation_id,'updatedAt',r.created_at);
end $$;

create function public.kc_dp_workspace_save(p_org_id text, p_project_id text,
  p_operation_id uuid, p_expected_version bigint, p_envelope jsonb, p_legacy_seq bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function public.kc_dp_workspace_read(text,text) from public, anon;
revoke all on function public.kc_dp_workspace_save(text,text,uuid,bigint,jsonb,bigint) from public, anon;
grant execute on function public.kc_dp_workspace_read(text,text) to authenticated;
grant execute on function public.kc_dp_workspace_save(text,text,uuid,bigint,jsonb,bigint) to authenticated;

-- The matching empty Neon table must be deployed first (docs/neon-dp-primary-workspace.sql).
insert into public.kc_db_mirror_table_rules
  (table_name,area,sensitivity,realtime_allowed,mirror_enabled,backup_enabled,note)
values ('kc_dp_workspace_revisions','KC DP','sensitive',false,true,true,
  'Build 300: verschlüsselte zentrale Planungsrevisionen, append-only; Neon-Struktur vorbereitet')
on conflict (table_name) do nothing;
insert into public.kc_neon_resume_tables(table_name) values ('kc_dp_workspace_revisions') on conflict do nothing;
