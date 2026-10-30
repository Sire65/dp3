import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile('supabase/migrations/20261030170000_dp_write_backup_readiness.sql','utf8');
const baseline=await readFile('supabase/migrations/20261023072200_dp_primary_workspace.sql','utf8');
const body=sql=>sql.match(/create(?:\s+or\s+replace)?\s+function\s+public\.kc_dp_workspace_save\b[\s\S]*?as\s+\$(\w*)\$([\s\S]*?)\$\1\$/i)?.[2];
const normalize=sql=>sql.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();
const current=body(migration),original=body(baseline);
assert(current&&original,'Both SQL function bodies must be available');
const gate=/if not exists \(select 1 from public\.kc_db_mirror_table_rules where table_name='kc_dp_workspace_revisions' and mirror_enabled and \(backup_enabled or write_backup_ready\)\)\s*then raise exception 'Backup preparation is not complete' using errcode='23514'; end if;/;
assert.match(current,gate,'Writing must require mirror admission plus verified backup readiness');
assert.equal(normalize(current.replace(gate,'')),normalize(original),'Authorization, limits, lock, CAS, identity receipt and append logic must remain unchanged');
assert.match(migration,/add column if not exists write_backup_ready boolean not null default false/,'New readiness must default to blocked');
assert.match(migration,/update public\.kc_db_mirror_table_rules set write_backup_ready=true,[\s\S]*?where table_name='kc_dp_workspace_revisions';/,'Only the reviewed DP2 registry row is admitted');
assert.doesNotMatch(migration,/set\s+backup_enabled\s*=/i,'Daily backup enrollment must not be changed');
assert.doesNotMatch(migration,/(?:update|delete from|truncate|alter table)\s+public\.kc_dp_workspace_revisions\b/i,'Existing encrypted planning revisions must not be changed');
assert.doesNotMatch(migration,/\b(?:grant|revoke)\b/i,'Existing RPC and table permissions must remain unchanged');
console.log('PASS workspace SQL: separate fail-closed write readiness, unchanged backup policy, exact original authorization/CAS/idempotency body, existing revisions and grants untouched.');
