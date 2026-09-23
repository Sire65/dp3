-- Aufraeumen des manuellen KC-Dienstplan-Minitests.
-- Es werden nur die vier eindeutig markierten Testzeilen angefasst.
update public.kc_dp_plan_published
set status='removed', updated_at=now()
where org_id='KC_WERNE'
  and event_id='KC-WM-2026'
  and source_shift_id like 'KC-TEST-KASSE-%'
  and source='manual_test';

select source_shift_id, status, updated_at
from public.kc_dp_plan_published
where org_id='KC_WERNE'
  and event_id='KC-WM-2026'
  and source_shift_id like 'KC-TEST-KASSE-%'
order by source_shift_id;
