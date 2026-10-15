-- DP2-F-SE-01 Sondereinsätze (KICC-F-100, Phase 1): DP2 veröffentlicht seine Sondereinsätze hierher
-- (Grünkohl kochen, Abholung/Transport, Getränke zuhause …). Gelesen von DP2-Mitgliedern des Vereins und
-- später serverseitig von der Club App (kc-club, Service-Rolle) für Twinkey „Sonderstunden melden“.
-- Rein additiv – fasst keine bestehende Tabelle/Funktion an.
-- Rückweg: drop function public.kc_dp_special_events_publish(text, text, jsonb); drop table public.kc_dp_special_events;

create table if not exists public.kc_dp_special_events (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  project_id text not null default 'KC_DP',
  event_id text not null,
  source_id text not null,
  titel text not null check (char_length(titel) between 1 and 120),
  ort text check (ort is null or char_length(ort) <= 120),
  art text not null check (char_length(art) between 1 and 40),
  termin_status text not null default 'OFFEN' check (termin_status in ('OFFEN', 'GEPLANT', 'FEST')),
  datum_von date,
  datum_bis date,
  folgt_auf text,
  abstand_tage integer check (abstand_tage is null or abstand_tage between 0 and 60),
  wiederkehrend text check (wiederkehrend is null or wiederkehrend in ('markttage')),
  bemerkung text check (bemerkung is null or char_length(bemerkung) <= 500),
  status text not null default 'published' check (status in ('published', 'removed')),
  source_version text,
  payload jsonb not null,
  checksum text not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, event_id, source_id),
  check (datum_bis is null or datum_von is null or datum_bis >= datum_von)
);

create index if not exists kc_dp_special_events_lookup
  on public.kc_dp_special_events (org_id, event_id, status);

alter table public.kc_dp_special_events enable row level security;
revoke all privileges on table public.kc_dp_special_events from anon;
revoke insert, update, delete, truncate on table public.kc_dp_special_events from authenticated;

-- Lesen: jedes aktive DP2-Mitglied des Vereins (Mitglieder sollen die Einsätze in Twinkey sehen).
create policy kc_dp_special_events_member_read
  on public.kc_dp_special_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.kc_dp_memberships m
      where m.user_id = (select auth.uid())
        and m.org_id = kc_dp_special_events.org_id
        and m.active is true
    )
  );

-- Schreiben nur über diese Funktion (SECURITY DEFINER, prüft die Planungsrolle selbst – Muster kc_dp_plan_publish).
-- Was im Stapel fehlt, wird weich auf status='removed' gesetzt.
create or replace function public.kc_dp_special_events_publish(p_org_id text, p_event_id text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_row jsonb;
  v_upserted integer := 0;
  v_source_id text;
  v_ids text[] := '{}';
begin
  if (select auth.uid()) is null then
    raise exception 'Anmeldung erforderlich';
  end if;
  if not exists (
    select 1 from public.kc_dp_memberships m
    where m.user_id = (select auth.uid())
      and m.org_id = p_org_id
      and m.active is true
      and m.role in ('admin','planner','duty_manager')
  ) then
    raise exception 'Keine aktive dp2-Planungsberechtigung';
  end if;
  if coalesce(length(trim(p_event_id)), 0) = 0 or length(p_event_id) > 64 then
    raise exception 'Veranstaltungs-ID fehlt oder ist zu lang';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'Die Sondereinsätze müssen als Liste mit höchstens 500 Zeilen übergeben werden';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_source_id := nullif(trim(v_row->>'sourceId'), '');
    if v_source_id is null or length(v_source_id) > 80 then
      raise exception 'Ein Sondereinsatz besitzt keine gültige Quellen-ID';
    end if;
    v_ids := v_ids || v_source_id;

    insert into public.kc_dp_special_events (
      org_id, project_id, event_id, source_id, titel, ort, art, termin_status, datum_von, datum_bis,
      folgt_auf, abstand_tage, wiederkehrend, bemerkung, status, source_version, payload, checksum,
      published_at, updated_at
    ) values (
      p_org_id, 'KC_DP', trim(p_event_id), v_source_id,
      trim(v_row->>'titel'), nullif(trim(v_row->>'ort'), ''), trim(v_row->>'art'),
      coalesce(nullif(v_row->>'terminStatus', ''), 'OFFEN'),
      nullif(v_row->>'datumVon', '')::date, nullif(v_row->>'datumBis', '')::date,
      nullif(trim(v_row->>'folgtAuf'), ''), nullif(v_row->>'abstandTage', '')::integer,
      nullif(v_row->>'wiederkehrend', ''), nullif(trim(v_row->>'bemerkung'), ''),
      'published', 'KC_DP_SPECIAL_EVENTS_V1/0.1.0', v_row,
      md5(concat_ws('|', p_org_id, p_event_id, v_source_id, v_row->>'version', v_row->>'terminStatus', v_row->>'datumVon', v_row->>'datumBis')),
      now(), now()
    )
    on conflict (org_id, event_id, source_id) do update set
      titel = excluded.titel,
      ort = excluded.ort,
      art = excluded.art,
      termin_status = excluded.termin_status,
      datum_von = excluded.datum_von,
      datum_bis = excluded.datum_bis,
      folgt_auf = excluded.folgt_auf,
      abstand_tage = excluded.abstand_tage,
      wiederkehrend = excluded.wiederkehrend,
      bemerkung = excluded.bemerkung,
      status = 'published',
      payload = excluded.payload,
      checksum = excluded.checksum,
      updated_at = now();
    v_upserted := v_upserted + 1;
  end loop;

  update public.kc_dp_special_events
  set status = 'removed', updated_at = now()
  where org_id = p_org_id
    and event_id = trim(p_event_id)
    and status = 'published'
    and not (source_id = any(v_ids));

  return jsonb_build_object('ok', true, 'received', jsonb_array_length(p_rows), 'upserted', v_upserted, 'eventId', p_event_id);
end;
$function$;

revoke all on function public.kc_dp_special_events_publish(text,text,jsonb) from public, anon;
grant execute on function public.kc_dp_special_events_publish(text, text, jsonb) to authenticated;
