import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const source=await readFile('src/adapters/cloud-primary.js','utf8');
const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
const data=n=>({wishes:[{id:'wish-real',start:n}],demandMatrix:{'2026-12-04':[{start:10,end:11,total:n}]},demandConfirmed:{},shifts:[]});
const network=()=>Object.assign(new Error('offline'),{transport:{online:false}});
function server(initial=data(3)){
  return {version:initial?1:0,data:initial,online:true,receipts:new Map(),calls:0,lost:false,
    async read(){if(!this.online)throw network();return this.version?{status:'ok',version:this.version,envelope:{value:{schema:'KC_DP_WORKSPACE_V1',data:copy(this.data)}}}:{status:'empty',version:0,legacySequence:0};},
    async save(ns,id,base,envelope){this.calls++;if(!this.online)throw network();if(this.receipts.has(id))return {...this.receipts.get(id),currentVersion:this.version,duplicate:true};if(base!==this.version)return {status:'conflict',currentVersion:this.version};this.version++;this.data=copy(envelope.value.data);const ack={status:'ok',version:this.version,currentVersion:this.version,operationId:id};this.receipts.set(id,ack);if(this.lost){this.lost=false;throw network();}return ack;}
  };
}
function client(remote,store=new Map()){
  if(!store.has('cloudPrimaryJoinedV1'))store.set('cloudPrimaryJoinedV1',{namespace:'KC_DP:G2'});const writes=[];const K={workMode:true,currentUser:{role:'admin'},syncConflicts:[],
    storage:{getMany:async keys=>keys.map(k=>copy(store.get(k))),putMany:async entries=>{for(const [k,v] of entries){writes.push(k);store.set(k,copy(v));}},get:async k=>copy(store.get(k)),put:async(k,v)=>{writes.push(k);store.set(k,copy(v));},remove:async k=>store.delete(k)},
    supabaseConnection:{getSyncKey:async()=>{if(!remote.online)throw network();return {secret:'fixture',namespace:'KC_DP:G2'};},workspaceLegacy:async()=>[],workspaceRead:()=>remote.read(),workspaceSave:(...args)=>remote.save(...args)}};
  vm.runInContext(source,vm.createContext({window:{KCDP:K},JSON,Date,crypto:{randomUUID},KCSecureSync:{encryptEnvelope:async value=>({value:copy(value)}),decryptEnvelope:async e=>copy(e.value)}}));
  return {api:K.cloudPrimary,K,writes,store};
}
const entries=n=>Object.entries({...data(n),integrationConfig:{secret:'DO_NOT_UPLOAD'},supabaseSession:{token:'DO_NOT_UPLOAD'}});
// Server first, ignoring a stale local planning copy; online saves never write a planning cache.
const remote=server(),a=client(remote,new Map([['wishes',[{start:99}]]]));
assert.equal((await a.api.load(['wishes']))[0][0].start,3);assert.equal(a.writes.length,0);
assert.equal((await a.api.save(entries(4))).confirmed,true);assert.equal(remote.data.wishes[0].start,4);assert.equal(remote.data.integrationConfig,undefined);assert.equal(remote.data.supabaseSession,undefined);assert.equal(a.writes.length,0);
const printable=await a.api.confirmedSnapshot();assert.equal(printable.version,2);printable.data.wishes[0].start=999;assert.equal(remote.data.wishes[0].start,4);
// Offline changes survive restart, remain unconfirmed, then replay with a version check.
remote.online=false;assert.equal((await a.api.save(entries(5))).offline,true);assert.equal(a.api.state.status,'offline');assert(a.store.has('cloudPrimaryPendingV1'));
await assert.rejects(a.api.confirmedSnapshot(),/zuerst/);const offlineRestart=client(remote,a.store);assert.equal((await offlineRestart.api.load(['wishes']))[0][0].start,5);assert.equal(offlineRestart.api.state.status,'offline');
await offlineRestart.api.save(entries(6));assert.equal(a.store.get('cloudPrimaryPendingV1').namespace,'KC_DP:G2');
remote.online=true;assert.equal((await offlineRestart.api.reconnect()).confirmed,true);assert.equal(remote.data.wishes[0].start,6);assert.equal(a.store.has('cloudPrimaryPendingV1'),false);
// Two PCs: only the PC with the current version succeeds. Rejected values stay in its rescue journal.
const b=client(remote),c=client(remote);await b.api.load(['wishes']);await c.api.load(['wishes']);await b.api.save(entries(7));await assert.rejects(c.api.save(entries(8)),/anderer PC/);assert.equal(remote.data.wishes[0].start,7);assert.equal(c.api.state.status,'conflict');assert(c.store.has('cloudPrimaryPendingV1'));
// Lost response after commit: retry uses the identical operation and does not insert twice.
const d=client(remote);await d.api.load(['wishes']);remote.lost=true;const before=remote.version;assert.equal((await d.api.save(entries(9))).offline,true);assert.equal(remote.version,before+1);const restarted=client(remote,d.store);await restarted.api.load(['wishes']);assert.equal(remote.version,before+1);assert.equal(restarted.api.state.status,'saved');
// A newer foreign write after a lost response is never reported as the authoritative own success.
const preview=await c.api.review();await c.api.resolve('remote',preview);assert.equal(c.api.state.status,'saved');assert(c.store.has('cloudPrimaryReviewedHistoryV1'));
const ca=client(remote),cb=client(remote);await ca.api.load(['wishes']);await cb.api.load(['wishes']);await ca.api.save(entries(12));await assert.rejects(cb.api.save(entries(13)));const captured=await cb.api.review();remote.version++;remote.data=data(14);await assert.rejects(cb.api.resolve('local',captured),/inzwischen/);const freshPreview=await cb.api.review();await cb.api.resolve('local',freshPreview);assert.equal(remote.data.wishes[0].start,13);
const e=client(remote);await e.api.load(['wishes']);remote.lost=true;await e.api.save(entries(10));remote.version++;remote.data=data(11);await assert.rejects(e.api.reconnect(),/anderer PC/);assert.equal(e.api.state.status,'conflict');assert.equal(remote.data.wishes[0].start,11);
// Missing backend, permissions, malformed acknowledgements, encryption errors are not an offline success.
const f=client(remote);await f.api.load(['wishes']);f.K.supabaseConnection.workspaceSave=async()=>{throw Object.assign(new Error('permission denied'),{status:403});};await assert.rejects(f.api.save(entries(12)),/permission denied/);assert.equal(f.api.state.status,'blocked');
const g=client(remote);await g.api.load(['wishes']);g.K.supabaseConnection.workspaceSave=async()=>({status:'ok'});await assert.rejects(g.api.save(entries(12)),/nicht eindeutig/);assert.equal(g.api.state.status,'blocked');
const h=client(remote);h.K.supabaseConnection.workspaceRead=async()=>{throw Object.assign(new Error('RPC missing'),{status:404});};await assert.rejects(h.api.load(['wishes']),/RPC missing/);assert.equal(h.api.state.status,'blocked');
// An empty database never receives defaults or a local plan without a reviewed, explicit initialization.
const fresh=client(server(null));await assert.rejects(fresh.api.load(['wishes']),e=>e.code==='MIGRATION_REQUIRED');await assert.rejects(fresh.api.save(entries(3)),/nicht freigegeben/);await assert.rejects(fresh.api.initialize(entries(3)),/nicht bestätigt/);
fresh.K.syncConflicts=[{status:'open'}];await assert.rejects(fresh.api.initialize(entries(3),{confirmed:true}),/Offene/);fresh.K.syncConflicts=[];await assert.rejects(fresh.api.initialize(entries(3),{confirmed:true}),/Serverbestand/);await fresh.api.inspectMigration();await fresh.api.initialize(entries(3),{confirmed:true});assert.equal(fresh.api.state.status,'saved');
const scoped=client(remote);scoped.K.supabaseConnection.state={userId:'admin-a'};await scoped.api.load(['wishes']);scoped.K.supabaseConnection.state.userId='admin-b';await assert.rejects(scoped.api.save(entries(15)),/Anmeldung/);
const noCache=client(server());noCache.K.supabaseConnection.workspaceRead=async()=>{throw network();};await assert.rejects(noCache.api.load(['wishes']),/offline/);
// Migration inventory reads every page and cannot silently omit other members' wishes.
const legacyServer=server(null),legacyClient=client(legacyServer);legacyServer.read=async()=>({status:'empty',version:0,legacySequence:501});const legacyRows=Array.from({length:501},(_,i)=>({seq:i+1,remote_version:i===500?2:1,envelope:{value:{entity:'wish',operation:'update',payload:{id:'server-'+(i===500?0:i),personId:'fixture-person-'+i,start:i===500?12:11,status:'confirmed'}}}}));legacyClient.K.supabaseConnection.workspaceLegacy=async(ns,after,before)=>legacyRows.filter(r=>r.seq>after&&r.seq<=before).slice(0,500);await assert.rejects(legacyClient.api.load(['wishes']),e=>e.code==='MIGRATION_REQUIRED');const inventory=await legacyClient.api.inspectMigration();assert.equal(inventory.collections.wishes.length,500);assert.equal(inventory.collections.wishes[0].start,12);await assert.rejects(legacyClient.api.initialize(entries(3),{confirmed:true}),/weitere Angaben/);const merged=entries(3).map(([k,v])=>[k,k==='wishes'?[...v,...inventory.collections.wishes]:v]);await legacyClient.api.initialize(merged,{confirmed:true});assert.equal(legacyServer.data.wishes.length,501);
const truncated=client(server(null));truncated.K.supabaseConnection.workspaceRead=async()=>({status:'empty',version:0,legacySequence:4});await assert.rejects(truncated.api.load(['wishes']));await assert.rejects(truncated.api.inspectMigration(),/unvollständig/);
const joining=client(remote,new Map([['wishes',[{id:'old-private-local',start:7}]],['syncOutbox',[{status:'pending',operationId:'old-pending'}]]]));joining.store.delete('cloudPrimaryJoinedV1');await assert.rejects(joining.api.load(['wishes','syncOutbox','syncConflicts']),e=>e.code==='JOIN_REQUIRED');assert.equal(joining.api.state.status,'join');const joinPreview=joining.api.joinPreview(),beforeJoin=remote.version;await joining.api.joinServer(joinPreview,{confirmed:true});assert.equal(remote.version,beforeJoin);assert.equal(joining.store.get('cloudPrimaryLegacyJoinV1').preview.local.wishes[0].start,7);assert.equal(joining.store.get('syncOutbox')[0].status,'workspace_archived');
console.log('PASS primary storage: server-first, online without planning cache, offline/restart/replay, two-PC CAS, lost acknowledgement idempotency, foreign newer revision, auth/schema/ack failures, migration review, credentials excluded.');
