create table public.kc_dp_plan_sharing (
 org_id text not null,
 person_id text not null,
 plan_kind text not null check(plan_kind in ('can','wish','standby')),
 allow_view boolean not null default false,
 allow_copy boolean not null default false,
 primary key(org_id,person_id,plan_kind),
 check(not allow_copy or allow_view)
);
alter table public.kc_dp_plan_sharing enable row level security;
revoke all on public.kc_dp_plan_sharing from anon,authenticated;
grant select,insert,update on public.kc_dp_plan_sharing to authenticated;
create policy sharing_read on public.kc_dp_plan_sharing for select to authenticated using (
 exists(select 1 from public.kc_dp_memberships m where m.user_id=(select auth.uid()) and m.org_id=kc_dp_plan_sharing.org_id and m.active)
);
create policy sharing_insert on public.kc_dp_plan_sharing for insert to authenticated with check (
 exists(select 1 from public.kc_dp_memberships m where m.user_id=(select auth.uid()) and m.org_id=kc_dp_plan_sharing.org_id and m.active and m.person_id=kc_dp_plan_sharing.person_id)
);
create policy sharing_update on public.kc_dp_plan_sharing for update to authenticated using (
 exists(select 1 from public.kc_dp_memberships m where m.user_id=(select auth.uid()) and m.org_id=kc_dp_plan_sharing.org_id and m.active and m.person_id=kc_dp_plan_sharing.person_id)
) with check (
 exists(select 1 from public.kc_dp_memberships m where m.user_id=(select auth.uid()) and m.org_id=kc_dp_plan_sharing.org_id and m.active and m.person_id=kc_dp_plan_sharing.person_id)
);