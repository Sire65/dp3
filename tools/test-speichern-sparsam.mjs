// KC-DP-SPEICHERN-SPARSAM (13.11.2026): Planungsstände gepackt speichern (A) und schnelle Änderungsfolgen bündeln (B).
// Aufruf: node tools/test-speichern-sparsam.mjs
import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {webcrypto} from 'node:crypto';

// ---------- A: gepackt verschlüsseln ----------
const ctx=vm.createContext({window:{crypto:webcrypto},crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob,Date,CompressionStream,DecompressionStream});
const w=ctx.window;vm.runInContext(await readFile('src/core/security-core.js','utf8'),ctx);
const S=w.KCSecureSync,opt={secret:'fixture-not-a-real-secret',projectId:'KC_DP:TEST',aad:'KC_DP_WORKSPACE_V1'};
// realistischer Planungsstand: viele gleichartige Datensätze (Testdaten, keine echten Personen)
const tage=Array.from({length:40},(_,d)=>({date:`2026-12-${String(d%28+1).padStart(2,'0')}`,shifts:Array.from({length:30},(_,i)=>({id:`s-${d}-${i}`,personId:`KC-P-T${String(i).padStart(4,'0')}`,start:'10:30',end:'18:00',zone:'B',status:'planned'}))}));
const value={schema:'KC_DP_WORKSPACE_V1',data:{days:tage,wishes:Array.from({length:300},(_,i)=>({id:`w-${i}`,personId:`KC-P-T${i%60}`,date:'2026-12-05',from:'11:00',to:'15:00',kind:'avai',comment:'Testwunsch Ä Ö Ü ß'}))}};
const v1=await S.encryptEnvelope(value,opt),v2=await S.encryptEnvelope(value,{...opt,compress:true});
assert.equal(v1.format,'KC_SECURE_SYNC_V1');assert.equal(v1.compression,undefined);
assert.equal(v2.format,'KC_SECURE_SYNC_V2');assert.equal(v2.compression,'gzip');
const faktor=v1.ciphertext.length/v2.ciphertext.length;assert(faktor>5,`gepackt nur ${faktor.toFixed(1)}-mal kleiner`);
assert.deepEqual(JSON.parse(JSON.stringify(await S.decryptEnvelope(v2,opt))),value,'gepackter Stand kommt unverändert zurück');
assert.deepEqual(JSON.parse(JSON.stringify(await S.decryptEnvelope(v1,opt))),value,'alte ungepackte Fassungen (V1) bleiben lesbar');
await assert.rejects(S.decryptEnvelope({...v2,format:'KC_SECURE_SYNC_V1',compression:undefined},opt),/Paketprüfung/,'Packmerkmal entfernt → abgelehnt');
await assert.rejects(S.decryptEnvelope({...v1,format:'KC_SECURE_SYNC_V2',compression:'gzip'},opt),/Paketprüfung/,'Packmerkmal hinzugefügt → abgelehnt');
await assert.rejects(S.decryptEnvelope({...v2,compression:'brotli'},opt),/Packart/);
await assert.rejects(S.decryptEnvelope(v2,{...opt,projectId:'anders'}));
await assert.rejects(S.decryptEnvelope({...v2,ciphertext:'AAAA'+v2.ciphertext.slice(4)},opt),/Paketprüfung/);
// Browser ohne CompressionStream: speichert wie bisher ungepackt (V1)
const alt=vm.createContext({window:{crypto:webcrypto},crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob,Date});vm.runInContext(await readFile('src/core/security-core.js','utf8'),alt);
const ohne=await alt.window.KCSecureSync.encryptEnvelope(value,{...opt,compress:true});assert.equal(ohne.format,'KC_SECURE_SYNC_V1');
assert.deepEqual(JSON.parse(JSON.stringify(await S.decryptEnvelope(ohne,opt))),value);
await assert.rejects(alt.window.KCSecureSync.decryptEnvelope(v2,opt),/nicht öffnen/,'alter Browser meldet klar statt Datenmüll');
// Der zentrale Planungsspeicher packt
assert.match(await readFile('src/adapters/cloud-primary.js','utf8'),/aad:'KC_DP_WORKSPACE_V1',compress:true/);
console.log(`PASS A gepackt: ${faktor.toFixed(1)}-mal kleiner, Rundweg, V1 lesbar, Packmerkmal geschützt, Rückfall ohne CompressionStream.`);

// ---------- B: schnelle Änderungsfolgen bündeln ----------
const source=await readFile('src/ui/app.js','utf8'),part=source.slice(source.indexOf('let persistRunning='),source.indexOf('function day(){'));
let cloud=0,listener={};
const K={planningDataReady:true,days:[],shifts:[],wishes:[],standby:[],people:[],storage:{putMany:async()=>({written:1})},recovery:{checkpoint:async()=>{}},cloudPrimary:{enabled:()=>true,save:async()=>{cloud++;return {confirmed:true};}}};
vm.runInContext(part,vm.createContext({K,traffic:()=>{},setIdbStatus:()=>{},updateUndoRedoUI:()=>{},msg:()=>{},undoAction:null,Promise,setTimeout,addEventListener:(n,f)=>{listener[n]=f}}));
const warte=ms=>new Promise(r=>setTimeout(r,ms));
// 1) einzelne Änderung: sofort gespeichert (keine Pause)
let t=Date.now();await K.persistAll();assert.equal(cloud,1);assert(Date.now()-t<1000,'erste Änderung ohne Wartezeit');
// 2) fünf schnelle Änderungen im Abstand von 0,5 s direkt danach → zusammen EIN weiterer Stand
const laeufe=[];for(let i=0;i<5;i++){laeufe.push(K.persistAll());await warte(500);}await Promise.all(laeufe);
assert.equal(cloud,2,`5 schnelle Änderungen → 1 Speicherung (gezählt ${cloud-1})`);
// 3) Seite wird verlassen: Pause endet sofort
t=Date.now();const p=K.persistAll();await warte(100);assert.equal(typeof listener.pagehide,'function');listener.pagehide();await p;
assert.equal(cloud,3);assert(Date.now()-t<1500,'beim Verlassen ohne Wartezeit gespeichert');
console.log('PASS B gebündelt: Einzeländerung sofort, schnelle Folge zusammengefasst, Verlassen beendet die Pause.');
