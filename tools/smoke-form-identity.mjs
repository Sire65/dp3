// Build 266 KC-DP-FORMULARE-EINHEITLICH: QR mit Dokumentart, Zuordnung auch über die Mitglieds-ID (Club-App-Bögen),
// nur ausfüllbare Wunschbögen werden eingelesen, anderer Zeitraum wird sichtbar gemeldet.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..'),read=f=>readFile(path.join(root,f),'utf8');
const [ocr,photo,forms]=await Promise.all([read('src/adapters/form-ocr.js'),read('src/adapters/photo-recognition.js'),read('src/core/personalized-forms.js')]);
const days=[{date:'2026-12-02',start:8,end:18,type:'prep'},{date:'2026-12-14',start:8,end:15,type:'after'}];
const K={people:[{personId:'KC-P-M0014',name:'Test Person',formProfileId:'HP-ABCDEF123456'},{personId:'KC-P-LOCAL-01',name:'Lokal'}],days};
const ctx={window:{KCDP:K},document:{},console,setTimeout,Intl,Date,JSON,Math,Number,String,Promise,Error,Array,Object,Set,Map,RegExp};ctx.window.window=ctx.window;vm.createContext(ctx);
vm.runInContext(ocr,ctx);vm.runInContext(forms,ctx);vm.runInContext(photo,ctx);
const id=K.formOcr._test.identityFromRaw,q=o=>JSON.stringify({schema:'KCDP-FORM-PROFILE-1',...o});
assert.equal(id(q({profileId:'HP-ABCDEF123456',periodId:'2026-12-02_2026-12-14'})).personId,'KC-P-M0014','HP-Profil-ID');
assert.equal(id(q({profileId:'KC-P-M0014'})).personId,'KC-P-M0014','Club-App: Mitglieds-ID als Profil-ID');
assert.equal(id(q({profileId:'KC-P-LOCAL-01'})).personId,'KC-P-LOCAL-01','auch Mitglieds-IDs in anderem Format');
assert.equal(id(q({profileId:'HP-ABCDEF123456'})).kind,'wish-matrix-v12','alter QR ohne Art = Wunschbogen V12');
assert.equal(id(q({profileId:'HP-ABCDEF123456',kind:'handwriting-v1'})).kind,'handwriting-v1');
assert.equal(id('Text ohne Code').status,'unrecognized');
// profileFor schreibt die Art in den QR
const P=K.personalizedForms;assert.equal(JSON.parse(P.profileFor(K.people[0]).payload).kind,'wish-matrix-v12');
for(const [k,v] of Object.entries({filled:'wish-filled-v12',handwriting:'handwriting-v1',excel:'wish-excel-v6',konto:'person-account-v1'}))assert.equal(JSON.parse(P.profileFor(K.people[0],k).payload).kind,v,k);
// Einlesen: andere Dokumentarten werden abgelehnt, anderer Zeitraum gemeldet
const lauf=async identity=>{K.formOcr.analyze=async()=>({rows:[],notes:[],identity});K.formOcr.completeReview=rows=>rows;return K.photoRecognition.analyze({},{personId:'KC-P-M0014'});};
await assert.rejects(lauf({status:'matched',personId:'KC-P-M0014',kind:'handwriting-v1',periodId:'2026-12-02_2026-12-14'}),/Handschriftprobe/);
await assert.rejects(lauf({status:'matched',personId:'KC-P-M0014',kind:'club-bestaetigung-v1'}),/Bestätigung/);
const alt=await lauf({status:'matched',personId:'KC-P-M0014',kind:'wish-matrix-v12',periodId:'2025-12-01_2025-12-14'});assert.ok(alt.notes.some(n=>/anderen Zeitraum/.test(n)),'anderer Zeitraum gemeldet');
const ok=await lauf({status:'matched',personId:'KC-P-M0014',kind:'wish-matrix-v12',periodId:'2026-12-02_2026-12-14'});assert.ok(!ok.notes.some(n=>/Zeitraum/.test(n)),'passender Zeitraum ohne Warnung');
const aus=await lauf({status:'matched',personId:'KC-P-M0014',kind:'wish-filled-v12',periodId:'2026-12-02_2026-12-14'});assert.ok(aus.notes.some(n=>/gespeicherter Angaben/.test(n)));
console.log('Formular-Identität OK: QR mit Dokumentart, Mitglieds-ID-Zuordnung, nur Wunschbögen, Zeitraum geprüft');
