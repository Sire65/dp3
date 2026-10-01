// Build 254: Ausdruck „Meine Angaben“ (ausgefüllter V12-Bogen) und Sperrtag ohne V/H/B beim Papierimport.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFile(path.join(root,p),'utf8');
const el=()=>({getContext:()=>({}),appendChild(){},setAttribute(){},style:{}});
const ctx=vm.createContext({window:{},console,setTimeout,clearTimeout,navigator:{onLine:true,userAgent:'node'},URL,Blob:class{},Intl,document:{addEventListener(){},querySelector(){return null},createElement:el,getElementById(){return null},head:{appendChild(){}},body:{appendChild(){}}}});
for(const p of ['core/model','core/wish-contract','core/mobile-wish-matrix','core/document-identity','core/personalized-forms','adapters/form-ocr'])vm.runInContext((await read('src/'+p+'.js')).replace(/^/,'var window=this.window;'),ctx,{filename:p});
const K=vm.runInContext('window.KCDP',ctx);
assert.ok(K.personalizedForms?.filledPdf&&K.personalizedForms._test.filledMatrixDoc,'filledPdf fehlt');
// 1) Papierimport: Sperrtag angekreuzt + V/H/B + Zeiten in derselben Zeile
const day={date:'2026-12-05',start:11,end:23};
const out=K.formOcr._test.wishesFromRecord({blockDay:true,zone:'V',canStart:14,canEnd:18,wishStart:15,wishEnd:17,blockConfidence:.9,fields:{}},'KC-P-X',day);
const sperr=out.find(w=>w.scope==='day');
assert.equal(sperr.wishZone,'B','Sperrtag darf keinen Einsatzbereich tragen');
assert.match(sperr.comment,/V\/H\/B „V“/,'Hinweis auf mitgeschriebenes V/H/B fehlt');
const dropped=out.filter(w=>w.conflict==='sperrtag');
assert.equal(dropped.length,2,'Kann- und Wunschzeit müssen sichtbar bleiben (nicht still verwerfen)');
assert.ok(dropped.every(w=>w.accepted===false&&/nicht übernommen/.test(w.comment)),'Konfliktzeilen dürfen nicht übernommen werden');
const review=K.formOcr._test.completeReview(out,'KC-P-X');
assert.ok(review.filter(w=>w.conflict).every(w=>w.accepted===false&&w.recognitionState==='conflict'),'Prüfung darf Konfliktzeilen nicht wieder freigeben');
// ohne Sperrtag unverändert: Bereich wird übernommen
const normal=K.formOcr._test.wishesFromRecord({blockDay:false,zone:'H',canStart:14,canEnd:18,fields:{}},'KC-P-X',day);
assert.equal(normal[0].wishZone,'H','normaler Tag: Einsatzbereich muss erhalten bleiben');
// 2) Ausgefüllter Bogen: Werte, Sperrtag ohne V/H/B, gleiche Spalten wie der leere V12-Bogen
const person={personId:'KC-P-X',name:'Test Person'},profile={profileId:'HP-TEST123456',periodId:'x'};
const rows=[{personId:'KC-P-X',date:'2026-12-04',start:14,end:18,wishType:'available',wishZone:'V'},{personId:'KC-P-X',date:'2026-12-04',start:15,end:17,wishType:'preferred',wishZone:'V',comment:'gern Glühwein'},
 {personId:'KC-P-X',date:'2026-12-05',start:11,end:23,wishType:'unavailable',scope:'day',wishZone:'H'},{personId:'KC-P-X',date:'2026-12-06',start:12,end:20,wishType:'if_needed',wishZone:'B',assistantDay:{standby:{answer:'yes',slots:[{start:20,end:23}]}}}];
const doc=K.personalizedForms._test.filledMatrixDoc(person,profile,[[true]],rows,new Date('2026-10-01T12:00:00Z'));
const zeile=d=>doc.html.split('<tr>').find(x=>x.startsWith('<td>'+d))||'';
assert.match(zeile('04.12.2026'),/<td>14:00<\/td><td>18:00<\/td><td>15:00<\/td><td>17:00<\/td>/,'Kann/Wunsch fehlen');
assert.match(zeile('04.12.2026'),/<td>V<\/td><td>gern Glühwein<\/td>/,'V/H/B oder Bemerkung fehlt');
assert.match(zeile('05.12.2026'),/<td>☒<\/td><td>☐<\/td><td><\/td>/,'Sperrtag: angekreuzt, V/H/B leer');
assert.match(zeile('06.12.2026'),/<td>☐<\/td><td>☒<\/td><td>B<\/td>/,'Nur wenn nötig fehlt');
assert.match(doc.html,/<td>06\.12\.2026<\/td><td>20:00<\/td><td>23:00<\/td>/,'Bereitschaft fehlt');
const spalten=h=>(h.match(/<table class="matrix-form-table"><thead><tr>(.*?)<\/tr>/)||[])[1];
const leer=K.personalizedForms._test.matrixDoc(person,profile,[[true]]);
assert.equal(spalten(doc.html),spalten(leer.html),'Spalten müssen dem leeren V12-Bogen entsprechen (QR/Einlesen)');
assert.equal(doc.tage,3);assert.equal(doc.gesperrt,1);assert.match(doc.fileName,/^KC_DP2_Meine_Wunschzeiten_Test-Person_HP-TEST123456\.pdf$/);
assert.match(leer.html,/Bei einem angekreuzten Sperrtag die übrige Zeile leer lassen/,'Hinweis auf dem leeren Bogen fehlt');
console.log('Wunsch-Ausdruck-Smoke OK: ausgefüllter V12-Bogen (Werte, Sperrtag ohne V/H/B, Bereitschaft, gleiche Spalten) und Papierimport ohne V/H/B am Sperrtag (nichts still verworfen).');
