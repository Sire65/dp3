// Build 308 · Istplan-Abschluss erreicht die Club App: kc_dp_days_publish schickt je Tag istStatus/istClosedAt,
// closePlan und reopenPlan veröffentlichen sofort neu. Offline, Supabase nachgebildet.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const noNet=()=>{throw new Error('Kein Netzaufruf im Test erlaubt');};
const ctx=vm.createContext({window:{},console,setTimeout,clearTimeout,fetch:noNet,navigator:{onLine:true},document:{addEventListener(){},querySelector(){return null;}}});
for(const p of ['core/model','core/planning','core/auth','core/configuration','core/actual','core/days-publish-bridge'])vm.runInContext(await fs.readFile(path.join(root,'src/'+p+'.js'),'utf8'),ctx,{filename:p});
const K=ctx.window.KCDP,calls=[];
K.recordAudit=()=>{};K.sync={enqueue(){}};K.currentUser={role:'admin',personId:K.people[0].personId,displayName:'Admin'};
K.supabaseConnection={currentMembership:async()=>({role:'admin',active:true}),publishDays:async p=>{calls.push(JSON.parse(JSON.stringify(p)));return {ok:true};}};
const flush=()=>new Promise(r=>setTimeout(r,0));
let rows=K.daysPublishBridge.buildRows();
assert.ok(rows.every(r=>r.istStatus==='open'&&r.istClosedAt===null),'Offen: alle Tage open');
// Abschluss am 08.12. 23:30 Berlin (= 22:30Z): Tage bis 08.12. closed, danach open.
const closedAt='2026-12-08T22:30:00.000Z';
K.actual.closePlan({reason:'Test'});K.actualWorkflow.closedAt=closedAt;
await flush();assert.equal(calls.length,1,'closePlan veröffentlicht sofort');
rows=K.daysPublishBridge.buildRows();
for(const r of rows){if(r.date<='2026-12-08'){assert.equal(r.istStatus,'closed',r.date);assert.equal(r.istClosedAt,closedAt);}else{assert.equal(r.istStatus,'open',r.date);assert.equal(r.istClosedAt,null);}}
assert.equal(K.daysPublishBridge.istStatusFor('2026-12-08').istStatus,'closed','Berlin-Datum, nicht UTC-Datum');
await K.daysPublishBridge.publishNow();assert.ok(calls.at(-1).days.find(d=>d.date==='2026-12-02').istStatus==='closed');
K.actual.reopenPlan({reason:'Nachtrag'});await flush();
assert.equal(calls.length,3,'reopenPlan veröffentlicht sofort');assert.ok(calls.at(-1).days.every(d=>d.istStatus==='open'),'Nach Wiederöffnen alle open');
// Veröffentlichungsfehler bricht closePlan nicht ab.
K.supabaseConnection.publishDays=async()=>{throw new Error('offline');};K.actual.closePlan({reason:'Test 2'});await flush();assert.equal(K.actualWorkflow.status,'closed');
console.log('✓ Istplan-Abschluss: istStatus/istClosedAt je Tag, sofort neu veröffentlicht bei Abschluss und Wiederöffnen');
