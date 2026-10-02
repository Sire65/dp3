import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFile(path.join(root,p),'utf8');
const copy=v=>JSON.parse(JSON.stringify(v));
let count=0;
async function fixture(){
 const ctx=vm.createContext({window:{},console,setTimeout,clearTimeout,navigator:{onLine:true},document:{addEventListener(){},querySelector(){return null;}},KCSecureSync:{normalizeQueueItem:x=>({...x,operationId:'op-'+(++count),status:'pending'})}});
 for(const p of ['core/model','core/wish-contract','core/planning','core/auth','core/configuration','core/mobile-wish-matrix','adapters/sync','core/days-publish-bridge','core/club-wish-inbox','ui/simple-wish-assistant'])vm.runInContext(await read('src/'+p+'.js'),ctx,{filename:p});
 const K=ctx.window.KCDP;
 K.wishes=[];K.auditLog=[];K.memberUxData={};K.planSharing=[];K.currentUser={role:'admin',personId:K.people[1].personId};K.integrationConfig={supabase:{orgId:'KC_WERNE'}};
 const calls={ack:[],publish:[],persist:0},inbox=[];
 K.supabaseConnection={state:{userId:'test-admin'},currentMembership:async()=>({role:K.currentUser.role,active:true}),publishDays:async p=>{calls.publish.push(copy(p));return {ok:true};},wishInboxPending:async()=>copy(inbox),wishInboxAck:async p=>{calls.ack.push(copy(p));return {ok:true};}};
 K.persistAll=async()=>{calls.persist++;};
 K.multiDeviceTest={identity:async()=>({deviceId:'test-device'})};
 K.supabaseConnection.wishInboxClaim=async()=>({ok:true,claimToken:'test-claim'});
 K.supabaseConnection.wishInboxAckClaimed=args=>K.supabaseConnection.wishInboxAck(args);
 K.supabaseConnection.wishInboxRelease=async()=>({ok:true,released:true});
 K.supabaseConnection.wishInboxReceipt=async({id})=>{const row=inbox.find(i=>i.id===id);return row?{found:true,status:'offen',revision:row.revision}:{found:true,status:'uebernommen',takenRevision:1,takenClaim:'test-claim'};};
 const input={id:'receipt-1',eventId:'KC-WM-2026',source:'club_app',revision:1,personId:K.people[0].personId,entries:[],standby:{},shareWithColleagues:null,submittedAt:'2026-09-30T10:00:00Z'};
 const entry=(patch={})=>({date:'2026-12-04',start:11,end:17,wishType:'available',wishZone:'V',scope:'time',comment:'',...patch});
 const run=async e=>{inbox.splice(0,inbox.length,{...input,...e});const out=await K.clubWishInbox.runNow();const review=K.clubWishInbox.summary().reviews[0];if(review?.days.length&&!review.problems.length)out.results[0]=await K.clubWishInbox.resolve(review.id,Object.fromEntries(review.days.map(d=>[d.date,'replace'])));return out;};
 return {K,ctx,calls,inbox,input,entry,run};
}
{
 const {K,calls}=await fixture();let rows=K.daysPublishBridge.buildRows();assert.equal(rows.length,13);assert.equal(rows[2].open,12);assert.equal(rows[2].close,null);assert.deepEqual(copy(rows[2].demand[1]),{start:12,end:15,total:6,front:4,back:2});assert.equal(rows[0].demand[0].front,null);
 K.daySettings['2026-12-04']={...K.daySettings['2026-12-04'],start:10.5,open:11.5,close:22,end:22.5};
 K.demandMatrix['2026-12-04']=[{start:10.5,end:12.25,total:3,front:2,back:1},{start:12.25,end:13,total:3,front:2,back:1},{start:13,end:22.5,total:5,front:3,back:2}];
 rows=K.daysPublishBridge.buildRows();assert.equal(rows[2].start,10.5);assert.equal(K.days[2].open,11.5,'Twinkey and publication share effective days');assert.equal(rows[2].close,22);assert.deepEqual(copy(rows[2].demand[0]),{start:10.5,end:13,total:3,front:2,back:1});
 K.days=[];await K.daysPublishBridge.publishNow();assert.deepEqual(calls.publish[0].days,[]);assert.equal(calls.publish[0].eventId,'KC-WM-2026');
 K.currentUser.role='employee';await K.daysPublishBridge.publishNow();assert.equal(calls.publish.length,1);
 K.currentUser.role='admin';K.supabaseConnection.currentMembership=async()=>({role:'employee',active:true});assert.equal((await K.daysPublishBridge.publishNow()).reason,'role');
}
{
 const {K,calls,input,entry,run}=await fixture();
 K.wishes=[{...entry({date:'2026-12-05'}),id:'direct',personId:input.personId,source:'direct',status:'confirmed'},{...entry({start:12,end:15}),id:'old-club',personId:input.personId,source:'club_app',status:'confirmed'}];
 const original=copy(K.wishes[0]);
 K.planSharing=['can','wish','standby'].map(plan_kind=>({person_id:input.personId,plan_kind,allow_view:true,allow_copy:true}));
 const res=await run({entries:[entry({wishType:'preferred',start:12,end:15}),entry()],standby:{'2026-12-06':{answer:'yes',slots:[{start:17,end:20,wishZone:'B',reserve:false}]}},shareWithColleagues:true});
 assert.equal(res.results[0].added,2);assert.equal(res.results[0].replaced,1);assert.equal(res.results[0].skipped,0);assert.equal(res.results[0].problems.length,0);
 assert.deepEqual(copy(K.wishes.find(w=>w.id==='direct')),original);assert.equal(K.wishes.find(w=>w.id==='old-club').status,'deleted');assert.equal(K.memberUxData.assistantStandby[input.personId]['2026-12-06'].answer,'yes');assert.equal(K.planSharing.length,3);assert(K.planSharing.every(r=>r.person_id===input.personId&&r.allow_copy));assert.equal(calls.ack[0].status,'uebernommen');assert(calls.persist>=2);assert(K.syncOutbox.every(o=>o.status==='pending'));
 const before=copy(K.wishes);await K.clubWishInbox.runNow();assert.deepEqual(copy(K.wishes),before,'same revision does not import twice');
 await run({revision:2,entries:[],standby:{},shareWithColleagues:false});assert.equal(K.wishes.filter(w=>w.source==='club_app'&&w.status!=='deleted').length,0);assert.deepEqual(copy(K.memberUxData.assistantStandby[input.personId]),{});assert(K.planSharing.every(r=>r.allow_copy),'Consent must not modify local permissions');
}
{
 const {K,entry,run,calls}=await fixture();K.currentUser.role='duty_manager';await run({entries:[entry()]});assert.equal(calls.ack[0].status,'uebernommen');assert.throws(()=>K.mutations.saveWish({...entry(),personId:K.people[0].personId}),/nur eigene/,'duty manager does not gain general edit-others');
}
for(const mode of ['closed','published','inactive','unknown','excluded','member','server-member']){
 const {K,entry,run,input,calls}=await fixture();let personId=input.personId;
 if(mode==='closed')K.state.wishPhase='closed';if(mode==='published')K.workflow={status:'published'};if(mode==='inactive')K.people[0].active=false;if(mode==='unknown')personId='missing';if(mode==='excluded')K.personPlanningAllowed=()=>false;if(mode==='member')K.currentUser.role='employee';if(mode==='server-member')K.supabaseConnection.currentMembership=async()=>({role:'employee'});
 await run({entries:[entry()],personId});assert.equal(K.wishes.length,0,mode);assert.equal(calls.ack.length,mode.includes('member')?0:1);if(calls.ack.length)assert.equal(calls.ack[0].status,'abgelehnt');
}
{
 const {K,input,entry,run,calls}=await fixture();
 K.wishes=[{...entry(),id:'old',personId:input.personId,source:'club_app',status:'confirmed'}];const before=copy(K.wishes);
 K.supabaseConnection.wishInboxAck=async p=>{calls.ack.push(p);return {stale:true,ok:false};};
 assert.equal((await run({entries:[entry({end:19})],shareWithColleagues:true})).results[0].stale,true);
 assert.deepEqual(copy(K.wishes),before);assert.equal(K.syncOutbox.length,0);assert.equal(K.auditLog.length,0);assert.deepEqual(copy(K.planSharing),[]);
}
for(const failure of ['mutation','persist']){
 const {K,input,entry,run,calls}=await fixture();K.wishes=[{...entry(),id:'old',personId:input.personId,source:'club_app',status:'confirmed'}];const before=copy(K.wishes);
 if(failure==='mutation')K.mutations.saveWish=()=>{throw Error('mutation fail');};else K.persistAll=async()=>{if(calls.persist++===0)throw Error('disk full');};
 await assert.rejects(run({entries:[entry({end:18})]}));assert.deepEqual(copy(K.wishes),before);assert.equal(calls.ack.length,0);assert.equal(K.syncOutbox.length,0);assert.equal(K.auditLog.length,0);
}
{
 const {K,input,entry,run,inbox,calls}=await fixture();let fail=true;
 K.supabaseConnection.wishInboxAck=async p=>{calls.ack.push(p);if(fail)throw Error('ACK response lost');return {ok:true};};
 await assert.rejects(run({entries:[entry()]}));const saved=copy(K.wishes);assert(K.syncOutbox.every(o=>o.status==='club_pending'));assert.throws(()=>K.mutations.saveWish({...entry(),personId:input.personId}),/gesichert/);
 // Simulate a restart by serializing all durable application state and recreating modules.
 const restarted=await fixture();for(const key of ['wishes','memberUxData','syncOutbox','auditLog','planSharing'])restarted.K[key]=copy(K[key]);restarted.inbox.push(copy(inbox[0]));await restarted.K.clubWishInbox.runNow();assert.deepEqual(copy(restarted.K.wishes),saved);assert(restarted.K.syncOutbox.every(o=>o.status==='pending'));
 // Response lost after the server committed: no open row remains. Retain the saved wishes.
 inbox.length=0;await K.clubWishInbox.runNow();assert.deepEqual(copy(K.wishes),saved);assert(K.syncOutbox.every(o=>o.status==='pending'));assert.equal(calls.ack.length,1);
}
{
 const {K,entry,run,calls}=await fixture();let fail=true;K.supabaseConnection.wishInboxAck=async p=>{calls.ack.push(p);if(fail)throw Error('offline');return {ok:true};};
 await assert.rejects(run({entries:[entry()]}));fail=false;await run({revision:2,entries:[entry({end:20})]});await run({revision:2,entries:[entry({end:20})]});assert.equal(K.wishes.filter(w=>w.status!=='deleted').length,1);assert.equal(K.wishes.find(w=>w.status!=='deleted').end,20);assert(K.syncOutbox.every(o=>!String(o.payload.id).includes('receipt-1-1-')));
}
{
 const {K,input,entry,run}=await fixture();
 const standby={answer:'yes',slots:[{start:18,end:20,wishZone:'B',reserve:false}]};
 const signature=JSON.stringify([['available',true,'time',11,17,'V',standby]]);
 const reordered={slots:[{end:20,reserve:false,wishZone:'B',start:18}],answer:'yes'};
 const value=entry({onlyIfNeeded:true,assistantDay:{standby:reordered,completed:true,completedSignature:signature}});
 await run({entries:[value],standby:{'2026-12-04':reordered}});
 assert.equal(JSON.stringify(K.wishes[0].assistantDay.standby),JSON.stringify(standby));assert.equal(JSON.stringify(K.memberUxData.assistantStandby[input.personId]['2026-12-04']),JSON.stringify(standby));assert.equal(K.wishes[0].assistantDay.completedSignature,signature);assert.equal(K.wishes[0].onlyIfNeeded,true);
 const status=K.simpleWishAssistant.statusFor('2026-12-04',K.wishes);assert.equal(status.key,'complete',JSON.stringify(status));
}
{
 const {K,entry,run}=await fixture();await run({entries:[entry({wishType:'unavailable',scope:'day',start:11,end:23}),entry({wishType:'unavailable',start:12,end:13}),entry({date:'2026-12-05',wishType:'preferred'}),entry({date:'2026-12-06',wishType:'wrong'}),entry({date:'2026-12-07',end:null})]});
 assert.equal(K.wishes.length,0);assert.equal(K.clubWishInbox.summary().reviews[0].problems.length,4);
}
{
 const {K,entry,run,input}=await fixture();K.wishes=[{...entry(),id:'direct',personId:input.personId,source:'direct',status:'confirmed'}];await run({entries:[entry()]});assert.equal(K.wishes.length,1);assert.equal(K.wishes[0].source,'direct');
}
// Integration order and failure isolation use the real auto-sync module.
{
 const {K,input,entry,run}=await fixture();
 const denied=['can','wish','standby'].map(plan_kind=>({person_id:input.personId,plan_kind,allow_view:false,allow_copy:false}));K.planSharing=copy(denied);
 await run({entries:[entry()],shareWithColleagues:true});assert(K.planSharing.every(r=>!r.allow_view&&!r.allow_copy),'Inbox must not widen authoritative server consent');assert.equal(K.clubWishInbox.summary().lastResult.problems.length,0);
 assert.equal(K.memberUxData.colleagueSharing,undefined,'No local consent overlay');
}
{
 const {K,ctx}=await fixture(),order=[];K.integrationConfig.supabase.onlineSyncEnabled=true;K.sync.hasProvider=()=>true;K.supabaseConnection.ensureSession=async()=>{};K.sync.syncBoth=async()=>{order.push('sync');return {ok:true};};K.planManagerBridge={publishNow:async()=>{order.push('plan');throw Error('plan');}};K.daysPublishBridge.publishNow=async()=>{order.push('days');throw Error('days');};K.clubWishInbox.runNow=async()=>{order.push('inbox');};vm.runInContext(await read('src/core/auto-sync.js'),ctx);assert.equal((await K.autoSync.runNow()).ok,true);assert.deepEqual(order,['sync','plan','days','inbox']);
}
assert(!(await read('src/adapters/timeclock-supabase.js')).includes("||'WM-2026'"));
// Exercise the actual authenticated REST provider, not a reimplementation of its request shape.
{
 const requests=[],ctx=vm.createContext({window:{KCDP:{integrationConfig:{supabase:{url:'https://example.supabase.co',publishableKey:'sb_publishable_TEST_ONLY',orgId:'TEST_ORG',projectId:'KC_DP',authMode:'password'}}}},console,setTimeout,clearTimeout,AbortController,atob,fetch:async(url,opt)=>{requests.push({url,...opt,body:opt.body?JSON.parse(opt.body):null});return {ok:true,text:async()=>JSON.stringify(url.includes('pending')?[]:{ok:true})};}});
 vm.runInContext(await read('src/adapters/supabase-provider.js'),ctx);
 const P=ctx.window.KCDP.supabaseConnection;P.restoreSession({access_token:'test-session',expires_at:Date.now()/1000+3600,user:{id:'test-admin'}});
 await P.publishDays({days:[]});await P.wishInboxPending({eventId:'CUSTOM'});await P.wishInboxAck({id:'receipt',revision:3,status:'uebernommen',result:{added:2}});
 assert.deepEqual(requests[0].body,{p_org_id:'TEST_ORG',p_event_id:'KC-WM-2026',p_days:[]});assert.equal(requests[1].body.p_event_id,'CUSTOM');assert.deepEqual(requests[2].body,{p_id:'receipt',p_revision:3,p_status:'uebernommen',p_result:{added:2}});assert(requests.every(r=>r.headers.Authorization==='Bearer test-session'&&r.method==='POST'));await assert.rejects(P.wishInboxAck({status:'wrong'}));
 await P.wishInboxClaim({id:'receipt',revision:3,deviceId:'PC-A'});await P.wishInboxAckClaimed({id:'receipt',revision:3,status:'uebernommen',result:{added:2},claimToken:'claim-A'});await P.wishInboxRelease({id:'receipt',claimToken:'claim-A'});await P.wishInboxReceipt({id:'receipt'});
 assert(requests[3].url.endsWith('/kc_dp_wish_inbox_claim'));assert.deepEqual(requests[3].body,{p_id:'receipt',p_revision:3,p_device_id:'PC-A',p_minutes:10});
 assert(requests[4].url.endsWith('/kc_dp_wish_inbox_ack_claimed'));assert.deepEqual(requests[4].body,{p_id:'receipt',p_revision:3,p_status:'uebernommen',p_result:{added:2},p_claim_token:'claim-A'});
 assert.deepEqual(requests[5].body,{p_id:'receipt',p_claim_token:'claim-A'});assert.deepEqual(requests[6].body,{p_id:'receipt'});await assert.rejects(P.wishInboxAckClaimed({status:'wrong'}));
}
const version=JSON.parse(await read('release-version.json')),html=await read('index.html');assert(html.includes('window.KC_DP_BUILD='+version.build));assert.equal(JSON.parse(await read('package.json')).version,version.version+'-build'+version.build);
// A shared RPC simulator: different clients really compete for one server row.
function claimServer(initial){
 const row=copy(initial),stats={claims:0,acks:0,releases:0};let token=null,device=null,active=false,takenClaim=null,takenRevision=null,seq=0,status='offen';
 function attach(f,id){const K=f.K;K.multiDeviceTest={identity:async()=>({deviceId:id})};Object.assign(K.supabaseConnection,{
  wishInboxPending:async()=>status==='offen'?[copy(row)]:[],
  wishInboxClaim:async a=>{stats.claims++;if(status!=='offen'||a.revision!==row.revision)return {ok:false,stale:true};if(active&&device!==a.deviceId)return {ok:false,reason:'claimed',claimedByMe:true,claimedUntil:'2026-10-01T20:00:00Z'};if(!active)token='claim-'+(++seq);active=true;device=a.deviceId;return {ok:true,claimToken:token};},
  wishInboxAckClaimed:async a=>{stats.acks++;if(status!=='offen'||a.revision!==row.revision)return {ok:false,stale:true};if(a.claimToken!==token)return {ok:false,reason:'claim_lost'};status=a.status;takenClaim=token;takenRevision=a.revision;active=false;return {ok:true,sharingApplied:true,shareWithColleagues:true};},
  wishInboxRelease:async a=>{stats.releases++;if(token===a.claimToken){active=false;token=null;}return {ok:true};},
  wishInboxReceipt:async()=>({found:true,status,revision:row.revision,takenClaim,takenRevision})
 });}
 return {attach,stats,row,expire(){active=false;}};
}
{
 const a=await fixture(),b=await fixture(),server=claimServer({...a.input,entries:[a.entry()]});server.attach(a,'PC-A');server.attach(b,'PC-B');
 let unblock,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>unblock=r);a.K.persistAll=async()=>{entered();await gate;};
 const running=a.K.clubWishInbox.runNow();await ready;const out=await b.K.clubWishInbox.runNow();assert.equal(out.results[0].reason,'claimed');assert.equal(b.K.wishes.length,0);assert.equal(b.K.syncOutbox.length,0);assert.equal(server.stats.acks,0);unblock();await running;assert.equal(server.stats.acks,1);assert(a.K.clubWishInbox.summary().lastResult.sharingApplied);
}
for(const recovery of ['open','own-ack-lost','other-pc','claim-lost','deleted']){
 const a=await fixture(),server=claimServer({...a.input,entries:[a.entry()]});server.attach(a,'PC-A');const realAck=a.K.supabaseConnection.wishInboxAckClaimed;
 a.K.supabaseConnection.wishInboxAckClaimed=async args=>{if(recovery==='own-ack-lost')await realAck(args);throw Error('response lost');};
 await assert.rejects(a.K.clubWishInbox.runNow());assert(a.K.syncOutbox.every(o=>o.status==='club_pending'));
 const restart=await fixture();for(const key of ['wishes','memberUxData','syncOutbox','auditLog','planSharing'])restart.K[key]=copy(a.K[key]);server.attach(restart,'PC-A');
 if(recovery==='other-pc'||recovery==='claim-lost'){server.expire();const b=await fixture();server.attach(b,'PC-B');if(recovery==='other-pc')await b.K.clubWishInbox.runNow();else await b.K.supabaseConnection.wishInboxClaim({id:b.input.id,revision:1,deviceId:'PC-B'});}
 if(recovery==='deleted')restart.K.supabaseConnection.wishInboxReceipt=async()=>({found:false});
 await restart.K.clubWishInbox.runNow();
 if(['other-pc','claim-lost','deleted'].includes(recovery)){assert.equal(restart.K.wishes.length,0,recovery);assert.equal(restart.K.syncOutbox.length,0);assert(restart.K.clubWishInbox.summary().notices.some(n=>n.reason==='claim_lost'));}
 else {assert.equal(restart.K.wishes.length,1);assert(restart.K.syncOutbox.every(o=>o.status==='pending'));assert.equal(server.stats.acks,1,'recovery does not import or acknowledge twice');}
}
{
 const f=await fixture(),server=claimServer({...f.input,entries:[f.entry()]});server.attach(f,'PC-A');f.K.supabaseConnection.wishInboxAckClaimed=async()=>{throw Error('lost');};await assert.rejects(f.K.clubWishInbox.runNow());
 const extra={...f.entry({date:'2026-12-05'}),id:'fresh-other-day',personId:f.input.personId,source:'manual',status:'confirmed'};f.K.wishes.push(extra);f.K.memberUxData.assistantStandby[f.input.personId]['2026-12-05']={answer:'no',slots:[]};f.K.planSharing=[{person_id:f.input.personId,plan_kind:'can',allow_view:true,allow_copy:false}];
 server.expire();const b=await fixture();server.attach(b,'PC-B');await b.K.clubWishInbox.runNow();await f.K.clubWishInbox.runNow();
 assert.deepEqual(copy(f.K.wishes),[extra],'rollback retains independent newer day');assert.equal(f.K.memberUxData.assistantStandby[f.input.personId]['2026-12-05'].answer,'no');assert.equal(f.K.planSharing[0].allow_view,true);
}
{
 const f=await fixture();f.K.multiDeviceTest.identity=async()=>{f.K.supabaseConnection.state.userId='other-user';return {deviceId:'PC-A'};};await assert.rejects(f.run({entries:[f.entry()]}),/Anmeldung/);assert.equal(f.K.wishes.length,0);assert.equal(f.calls.ack.length,0);
}
{
 const f=await fixture(),server=claimServer({...f.input,entries:[f.entry()]});server.attach(f,'PC-A');const ack=f.K.supabaseConnection.wishInboxAckClaimed;f.K.supabaseConnection.wishInboxAckClaimed=async a=>{server.row.revision++;return ack(a);};
 await f.K.clubWishInbox.runNow();assert.equal(f.K.wishes.length,0);assert.equal(f.K.syncOutbox.length,0);
}
{
 const f=await fixture(),server=claimServer({...f.input,entries:[f.entry()]});server.attach(f,'PC-A');f.K.mutations.saveWish=()=>{throw Error('local failure');};await assert.rejects(f.K.clubWishInbox.runNow());assert.equal(server.stats.releases,1);assert.equal(server.stats.acks,0);assert.equal(f.K.wishes.length,0);
}
{
 const a=await fixture(),b=await fixture(),server=claimServer({...a.input,entries:[a.entry()]});server.attach(a,'PC-A');server.attach(b,'PC-B');await a.K.supabaseConnection.wishInboxClaim({id:a.input.id,revision:1,deviceId:'PC-A'});b.K.state.wishPhase='closed';await b.K.clubWishInbox.runNow();assert.equal(server.stats.acks,0);a.K.state.wishPhase='closed';await a.K.clubWishInbox.runNow();assert.equal(server.stats.acks,1);
}
{
 const f=await fixture();f.K.multiDeviceTest.identity=async()=>null;await assert.rejects(f.run({entries:[f.entry()]}),/Gerätekennung/);assert.equal(f.K.wishes.length,0);
}
// Explicit conflict decisions: never resolve these through the legacy helper.
{
 const {K,input,entry,inbox,calls}=await fixture();K.wishes=[{...entry(),id:'direct',personId:input.personId,source:'manual',status:'confirmed'}];inbox.push({...input,entries:[entry({end:18})]});await K.clubWishInbox.runNow();
 K.sync.hasProvider=()=>true;K.sync.pull=async()=>({conflicts:1});await assert.rejects(K.clubWishInbox.resolve(input.id,{'2026-12-04':'replace'}),/Synchronisationskonflikte/);assert.equal(calls.ack.length,0);
 K.sync.pull=async()=>{K.wishes[0].end=15;return {conflicts:0};};assert((await K.clubWishInbox.resolve(input.id,{'2026-12-04':'replace'})).needsReview);assert.equal(calls.ack.length,0);
}
{
 const {K,input,entry,inbox}=await fixture();K.wishes=['2026-12-04','2026-12-05'].map((date,i)=>({...entry({date}),id:'direct'+i,personId:input.personId,source:'manual',status:'confirmed'}));inbox.push({...input,entries:[entry({end:18}),entry({date:'2026-12-05',end:19})]});await K.clubWishInbox.runNow();await K.clubWishInbox.resolve(input.id,{'2026-12-04':'keep','2026-12-05':'replace'});const active=K.wishes.filter(w=>w.status!=='deleted');assert.equal(active.find(w=>w.date==='2026-12-04').end,17);assert.equal(active.find(w=>w.date==='2026-12-05').end,19);
}
for(const choice of ['keep','replace']){
 const {K,input,entry,inbox,calls}=await fixture();
 K.wishes=[{...entry(),id:'twinkey-direct',personId:input.personId,source:'assistant',status:'confirmed'}];
 K.memberUxData.assistantStandby={[input.personId]:{'2026-12-04':{answer:'yes',slots:[{start:19,end:21,wishZone:'B'}]}}};
 inbox.push({...input,entries:[entry({start:13,end:18})]});const before=copy(K.wishes);
 const out=await K.clubWishInbox.runNow();assert(out.results[0].needsReview);assert.equal(calls.ack.length,0);assert.deepEqual(copy(K.wishes),before);
 await K.clubWishInbox.resolve(input.id,{});assert.equal(calls.ack.length,0,'missing decision must not import');
 const result=await K.clubWishInbox.resolve(input.id,{'2026-12-04':choice});assert.equal(calls.ack.length,1);
 const active=K.wishes.filter(w=>w.status!=='deleted');assert.equal(active.length,1);assert.equal(active[0].start,choice==='keep'?11:13);
 assert.equal(!!K.memberUxData.assistantStandby[input.personId]['2026-12-04'],choice==='keep');
 assert.equal(result[choice==='keep'?'keptDays':'replacedDays'][0],'2026-12-04');
}
for(const changed of ['phone','dp2','standby']){
 const {K,input,entry,inbox,calls}=await fixture();K.wishes=[{...entry(),id:'direct',personId:input.personId,source:'manual',status:'confirmed'}];
 inbox.push({...input,entries:[entry({end:18})]});await K.clubWishInbox.runNow();
 if(changed==='phone'){inbox[0].revision=2;inbox[0].entries[0].end=20;}
 if(changed==='dp2')K.wishes[0].end=16;
 if(changed==='standby')K.memberUxData.assistantStandby={[input.personId]:{'2026-12-04':{answer:'no',slots:[]}}};
 const before=copy(K.wishes),out=await K.clubWishInbox.resolve(input.id,{'2026-12-04':'replace'});
 assert(out.needsReview,changed);assert.equal(calls.ack.length,0);assert.deepEqual(copy(K.wishes),before);
 assert(K.clubWishInbox.summary().reviews[0].problems[0].text.includes('inzwischen'));
}
{
 const {K,input,entry,inbox,calls}=await fixture();
 K.wishes=[{...entry(),id:'direct',personId:input.personId,source:'assistant',status:'confirmed'}];inbox.push({...input,entries:[entry({end:18})]});
 await K.clubWishInbox.runNow();const before=copy(K.wishes);K.supabaseConnection.wishInboxAck=async()=>({stale:true});
 await K.clubWishInbox.resolve(input.id,{'2026-12-04':'replace'});assert.deepEqual(copy(K.wishes),before,'stale acknowledgement restores direct Twinkey data');assert.equal(K.syncOutbox.length,0);
}
{
 const {K,input,entry,inbox,calls}=await fixture();inbox.push({...input,entries:[entry()]});await K.clubWishInbox.runNow();
 inbox[0]={...input,revision:2,entries:[]};await K.clubWishInbox.runNow();assert.equal(calls.ack.length,1,'empty newer snapshot must not silently delete');
 assert.equal(K.wishes.filter(w=>w.status!=='deleted').length,1);await K.clubWishInbox.resolve(input.id,{'2026-12-04':'replace'});assert.equal(K.wishes.filter(w=>w.status!=='deleted').length,0);
}
console.log('PASS Club-App: two-PC claims, same-login devices, own-token recovery, claim loss/release, authoritative sharing, provider RPCs, publication, conflict keep/replace, missing decisions, changed phone/DP2/readiness, explicit deletion, rollback including direct data, dedup, validation, roles, ACK recovery/restart, standby, sharing, Twinkey signature, auto-sync isolation, version and event ID.');
