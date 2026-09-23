-- Haertet die neue Sollplan-Bruecke nach dem Supabase Advisor-Lauf.
-- Anonyme Nutzer duerfen die SECURITY-DEFINER-RPC nicht einmal formal aufrufen.
revoke execute on function public.kc_dp_plan_publish(text, text, jsonb) from public;
revoke execute on function public.kc_dp_plan_publish(text, text, jsonb) from anon;
grant execute on function public.kc_dp_plan_publish(text, text, jsonb) to authenticated;
grant execute on function public.kc_dp_plan_publish(text, text, jsonb) to service_role;

-- PC-Manager liest genau den veroeffentlichten Veranstaltungsplan in Datums-/Zeitreihenfolge.
create index if not exists kc_dp_plan_published_manager_view
  on public.kc_dp_plan_published (org_id, event_id, work_date, start_time, person_id)
  where status = 'published';
