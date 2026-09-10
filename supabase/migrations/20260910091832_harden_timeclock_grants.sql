revoke all privileges on table public.kc_dp_timeclock_actuals from anon;
revoke all privileges on table public.kc_dp_timeclock_receipts from anon;

revoke all privileges on table public.kc_dp_timeclock_actuals from authenticated;
grant select on table public.kc_dp_timeclock_actuals to authenticated;

revoke all privileges on table public.kc_dp_timeclock_receipts from authenticated;
grant select, insert on table public.kc_dp_timeclock_receipts to authenticated;