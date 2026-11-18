import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
assert(html.includes('<script defer src="src/adapters/common-stamp-inbox.js'),'stempelbuch follows deferred provider startup');
assert(html.indexOf('src/adapters/timeclock-supabase.js')<html.indexOf('src/adapters/common-stamp-inbox.js'));
const source=await fs.readFile(new URL('../src/adapters/common-stamp-inbox.js',import.meta.url),'utf8');
const K={timeclockSupabase:{pendingRows:async()=>[{sourceRecordId:'legacy'}],acknowledge:async()=>({saved:1})},
 supabaseConnection:{ensureSession:async()=>{},sessionSnapshot:()=>({access_token:'test-token'})},
 integrationConfig:{supabase:{url:'https://test.invalid',orgId:'TEST',publishableKey:'test-public'}},
 eventConfig:{eventId:'KC-WM-2026'},days:[{date:'2026-12-02'},{date:'2026-12-14'}],actualShifts:[]};
let reply=[];
vm.runInNewContext(source,{window:{KCDP:K},Intl,Date,URL,AbortSignal,fetch:async(url,opt)=>{
 assert.match(url,/rpc\/kc_dp_stempel_paare_liste$/);assert.equal(JSON.parse(opt.body).p_org_id,'TEST');
 return {ok:true,json:async()=>reply};
}});
const pair={kommen_id:'C',gehen_id:null,person_id:'P',member_no:'KC-9999',work_date:'2026-12-02',kommen:'2026-12-02T09:00:00Z',gehen:null,pause_min:0,status:'missing_end',quelle_kommen:'kasse',quelle_gehen:null};
reply=[pair];let rows=await K.timeclockSupabase.pendingRows();assert.equal(rows.length,2);assert.equal(rows[1].end,null);
reply=[{...pair,gehen_id:'G',gehen:'2026-12-02T13:00:00Z',status:'complete',quelle_gehen:'app'}];
rows=await K.timeclockSupabase.pendingRows();const row=rows[1];assert.equal(row.sourceRecordId,'stamp:C');assert.equal(row.start,10);assert.equal(row.end,14);assert.equal(row.stampMeta.goingSource,'app');
K.actualShifts=[{...row,status:'recorded'}];assert.equal((await K.timeclockSupabase.pendingRows()).length,1,'confirmed pair must not be offered again');
reply=[{...reply[0],gehen:'2026-12-02T14:00:00Z'}];assert.equal((await K.timeclockSupabase.pendingRows()).length,2,'changed pair requires another review');
const night=K.commonStampInbox.normalize({...pair,kommen:'2026-12-02T22:00:00Z',gehen:'2026-12-03T00:00:00Z'});assert.equal(night.start,23);assert.equal(night.end,25);
const ui=await fs.readFile(new URL('../src/ui/app.js',import.meta.url),'utf8');const at=ui.indexOf('const out=K.actual.importRows(selected');const part=ui.slice(at,at+1600);assert(part.indexOf('await K.persistAll()')<part.indexOf('timeclockSupabase.acknowledge'));
assert(part.includes('saved?.confirmed!==true'),'offline receipt must stay unacknowledged');
console.log('PASS common stamps: missing end -> complete, mixed sources, no duplicates, changed pair, overnight, persistence before acknowledgement.');
