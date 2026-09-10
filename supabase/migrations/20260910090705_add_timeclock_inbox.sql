-- KC DP2: sicherer Eingang fuer freigegebene Istzeiten aus dem PC-Manager.
create table if not exists public.kc_dp_timeclock_actuals (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  project_id text not null default 'KC_DP',
  event_id text not null,
  source_event_id text not null,
  member_no text,
  person_id text,
  display_name text,
  work_date date not null,
  start_time time,
  end_time time,
  break_minutes integer not null default 0 check (break_minutes >= 0 and break_minutes <= 1440),
  status text not null default 'complete' check (status in ('complete','missing_start','missing_end','voided')),
  source text not null default 'pc_manager',
  source_version text,
  payload jsonb not null default '{}'::jsonb,
  checksum text not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id,event_id,source_event_id),
  unique (org_id,event_id,checksum)
);
create index if not exists kc_dp_timeclock_actuals_lookup on public.kc_dp_timeclock_actuals(org_id,project_id,event_id,work_date);
alter table public.kc_dp_timeclock_actuals enable row level security;

create table if not exists public.kc_dp_timeclock_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  project_id text not null default 'KC_DP',
  source_actual_id uuid not null references public.kc_dp_timeclock_actuals(id) on delete restrict,
  imported_by uuid not null default auth.uid(),
  imported_at timestamptz not null default now(),
  local_actual_id text,
  result text not null default 'imported' check (result in ('imported','skipped_duplicate','rejected')),
  unique (org_id,project_id,source_actual_id)
);
alter table public.kc_dp_timeclock_receipts enable row level security;

grant select on public.kc_dp_timeclock_actuals to authenticated;
grant select,insert on public.kc_dp_timeclock_receipts to authenticated;
revoke insert,update,delete on public.kc_dp_timeclock_actuals from anon,authenticated;
revoke all on public.kc_dp_timeclock_receipts from anon;
revoke update,delete on public.kc_dp_timeclock_receipts from authenticated;

drop policy if exists kc_dp_timeclock_actuals_planner_read on public.kc_dp_timeclock_actuals;
create policy kc_dp_timeclock_actuals_planner_read on public.kc_dp_timeclock_actuals
for select to authenticated using (
  exists(select 1 from public.kc_dp_memberships m
    where m.user_id=(select auth.uid()) and m.org_id=kc_dp_timeclock_actuals.org_id
      and m.active is true and m.role in ('admin','planner','duty_manager'))
);
drop policy if exists kc_dp_timeclock_receipts_planner_read on public.kc_dp_timeclock_receipts;
create policy kc_dp_timeclock_receipts_planner_read on public.kc_dp_timeclock_receipts
for select to authenticated using (
  exists(select 1 from public.kc_dp_memberships m
    where m.user_id=(select auth.uid()) and m.org_id=kc_dp_timeclock_receipts.org_id
      and m.active is true and m.role in ('admin','planner','duty_manager'))
);
drop policy if exists kc_dp_timeclock_receipts_planner_insert on public.kc_dp_timeclock_receipts;
create policy kc_dp_timeclock_receipts_planner_insert on public.kc_dp_timeclock_receipts
for insert to authenticated with check (
  imported_by=(select auth.uid()) and
  exists(select 1 from public.kc_dp_memberships m
    where m.user_id=(select auth.uid()) and m.org_id=kc_dp_timeclock_receipts.org_id
      and m.active is true and m.role in ('admin','planner','duty_manager'))
);
comment on table public.kc_dp_timeclock_actuals is 'Freigegebene PC-Manager-Istzeiten; Schreiben erfolgt spaeter ueber den geschuetzten Manager-Weg.';
comment on table public.kc_dp_timeclock_receipts is 'Idempotente DP2-Uebernahmebestaetigungen fuer Istzeiten.';