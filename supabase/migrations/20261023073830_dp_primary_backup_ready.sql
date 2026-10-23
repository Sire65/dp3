-- Explicit approval received 23.10.2026; matching Neon production table verified.
update public.kc_db_mirror_table_rules set mirror_enabled=true,backup_enabled=true,note='Build 300: verschlüsselte Planungsrevisionen; Neon-Produktionsstruktur geprüft und freigegeben',updated_at=now() where table_name='kc_dp_workspace_revisions';
