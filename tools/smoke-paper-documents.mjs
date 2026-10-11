// Build 267 KC-DP-PLANERPAPIERE-QR: Leerplan, Papierplanung und persönlicher Dienstplan tragen einen QR (KCDP-DOC-1);
// DP2 erkennt das Papier beim Einlesen, meldet veraltete Dienstpläne und übernimmt nichts still.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..'),read=f=>readFile(path.join(root,f),'utf8');
const [ident,paper,ocr,photo,docs,exp,staff,pdf,index]=await Promise.all(['src/core/document-identity.js','src/core/paper-documents.js','src/adapters/form-ocr.js','src/adapters/photo-recognition.js','src/core/documents.js','src/core/export.js','src/ui/paper-staffing.js','src/adapters/pdf.js','index.html'].map(read));
const K={people:[{personId:'KC-P-M0014',name:'Christina Test'}],days:[{date:'2026-12-02'},{date:'2026-12-14'}],latestPublishedVersion:()=>({version:5})};
const ctx={window:{KCDP:K},document:{},console,crypto:globalThis.crypto,setTimeout,Intl,Date,JSON,Math,Number,String,Promise,Error,Array,Object,Set,Map,RegExp,Uint8Array};ctx.window.window=ctx.window;vm.createContext(ctx);
for(const s of [ident,paper,ocr,photo])vm.runInContext(s,ctx);
const P=K.paperDocuments,dec=raw=>JSON.parse(raw);
// Payload je Art
const leer=dec(P.payload('empty-plan-v1',{date:'2026-12-04'}));assert.equal(leer.schema,'KCDP-DOC-1');assert.equal(leer.docType,'empty-plan-v1');assert.equal(leer.date,'2026-12-04');assert.equal(leer.periodId,'2026-12-04_2026-12-04');assert.ok(!('personId' in leer),'leere Felder entfallen');
const pap=dec(P.payload('paper-staffing-v1',{date:'2026-12-05'}));assert.equal(pap.docType,'paper-staffing-v1');
const pers=dec(P.payload('personal-plan-v1',{personId:'KC-P-M0014',periodId:'2026-12-02_2026-12-14',version:4}));assert.equal(pers.personId,'KC-P-M0014');assert.equal(pers.version,'4');
assert.throws(()=>P.payload('irgendwas',{}),/Unbekannte Papierart/);
// Erkennen: veraltet / aktuell / Leerplan / Papierplanung
const alt=P.recognize(P.payload('personal-plan-v1',{personId:'KC-P-M0014',periodId:'2026-12-02_2026-12-14',version:4}));assert.equal(alt.outdated,true);assert.match(alt.text,/Christina Test/);assert.match(alt.text,/veraltet, aktuell ist V5/);
const neu=P.recognize(P.payload('personal-plan-v1',{personId:'KC-P-M0014',periodId:'2026-12-02_2026-12-14',version:5}));assert.equal(neu.outdated,false);assert.match(neu.text,/aktuell\./);
const unv=P.recognize(P.payload('personal-plan-v1',{personId:'KC-P-M0014',periodId:'2026-12-02_2026-12-14'}));assert.equal(unv.outdated,false);assert.match(unv.text,/nicht veröffentlicht/);
assert.match(P.recognize(P.payload('empty-plan-v1',{date:'2026-12-04'})).text,/Leerplan vom 04\.12\.2026.*Ist-Erfassung/);
assert.match(P.recognize(P.payload('paper-staffing-v1',{date:'2026-12-05'})).text,/Papierplanung vom 05\.12\.2026/);
assert.equal(P.recognize(K.documentIdentity.encode({docType:'wish_matrix'})),null,'fremde Dokumentart wird nicht als Planer-Papier erkannt');
assert.equal(P.recognize('kein json'),null);
// Platzhalter und Ausfüllen
const ph=P.placeholder('empty-plan-v1',{date:'2026-12-04'});assert.match(ph,/class="doc-qr" data-kc-qr="\{&quot;schema&quot;:&quot;KCDP-DOC-1&quot;/);assert.match(ph,/data-kc-qr-label="LEERPLAN · 04\.12\.2026"/);
K.personalizedForms={qrFor:async()=>[[1,0],[0,1]]};
const el={attrs:{'data-kc-qr':'{"x":1}','data-kc-qr-label':'L'},getAttribute(n){return this.attrs[n]},innerHTML:''},el2={...el,attrs:{...el.attrs},getAttribute:el.getAttribute,innerHTML:''};
assert.equal(await P.fillRoot({querySelectorAll:()=>[el,el2]}),2);assert.match(el.innerHTML,/<svg viewBox="0 0 2 2"/);assert.match(el.innerHTML,/<b>L<\/b>/);assert.match(el2.innerHTML,/<svg/);
K.personalizedForms={qrFor:async()=>{throw new Error('kein QR')}};const el3={...el,attrs:{'data-kc-qr':'{"y":2}'},getAttribute:el.getAttribute,innerHTML:''};await P.fillRoot({querySelectorAll:()=>[el3]});assert.match(el3.innerHTML,/QR-Code fehlt/,'Fehler wird sichtbar, nie still');
// Einlesen: Planer-Papier wird erkannt und abgewiesen, Wunschbögen unverändert
const id=K.formOcr._test.identityFromRaw(P.payload('personal-plan-v1',{personId:'KC-P-M0014',periodId:'2026-12-02_2026-12-14',version:4}));assert.equal(id.status,'document');assert.equal(id.document.outdated,true);assert.equal(id.kind,'personal-plan-v1');
assert.equal(K.formOcr._test.identityFromRaw(K.documentIdentity.encode({docType:'wish_matrix'})).status,'unrecognized');
assert.equal(K.formOcr._test.identityFromRaw(JSON.stringify({schema:'KCDP-FORM-PROFILE-1',profileId:'KC-P-M0014'})).status,'matched','Wunschbogen weiterhin erkannt');
K.formOcr.analyze=async()=>({rows:[],notes:[],identity:id});K.formOcr.completeReview=rows=>rows;
await assert.rejects(K.photoRecognition.analyze({},{personId:'KC-P-M0014'}),/Erkannt: Persönlicher Dienstplan.*veraltet.*kein Wunschbogen/);
// Einbau in Leerplan, persönlichen Dienstplan, Papierplanung, Browserdruck und PDF
assert.match(docs,/qr:i=>\(\{kind:'empty-plan-v1',meta:\{date:tage\[i\]\}\}\)/,'Leerplan: QR je Tag');
assert.match(docs,/kind:'personal-plan-v1'/,'persönlicher Dienstplan mit QR');
assert.match(docs,/K\.paperDocuments\.placeholder\(q\.kind,q\.meta\)/);
assert.match(staff,/'paper-staffing-v1'/);assert.match(staff,/paperDocuments\?\.fillRoot\?\.\(w\.document\)/);
assert.match(exp,/paperDocuments\?\.fillRoot\?\.\(root\)/);
assert.match(pdf,/data-kc-qr/);
assert.ok(index.indexOf('src/core/paper-documents.js')>0&&index.indexOf('src/core/paper-documents.js')<index.indexOf('src/core/documents.js'),'paper-documents.js vor documents.js geladen');
console.log('Planer-Papiere OK: QR auf Leerplan, Papierplanung und Dienstplan, Erkennung beim Einlesen, veraltete Pläne gemeldet');
