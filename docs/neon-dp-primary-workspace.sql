-- KC DP primary planning store. Append-only encrypted revisions; no direct client writes.
create table public.kc_dp_workspace_revisions (
  org_id text not null,
  project_id text not null,
  version bigint not null check (version > 0),
  operation_id uuid not null,
  actor_user_id uuid not null,
  legacy_seq bigint not null,
  envelope jsonb not null check (jsonb_typeof(envelope) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (org_id, project_id, version),
  unique (org_id, project_id, operation_id)
);

alter table public.kc_dp_workspace_revisions enable row level security;
revoke all on public.kc_dp_workspace_revisions from public;
