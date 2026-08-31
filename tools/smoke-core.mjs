import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const context=vm.createContext({window:{},console,setTimeout,clearTimeout,structuredClone});
for(const file of ['src/core/model.js','src/core/auth.js','src/core/planning.js','src/core/staffing.js','src/core/breaks.js','src/core/planner-engine.js','src/core/workflow.js']){
  vm.runInContext(await readFile(path.join(root,file),'utf8'),context,{filename:file});
}
const K=context.window.KCDP;
assert.equal(K.VERSION,'0.20.0');
assert.equal(K.breaks.requiredMinutes({start:8,end:14}),0,'Genau sechs Stunden benötigen nach ArbZG-Preset keine Pause');
assert.equal(K.breaks.requiredMinutes({start:8,end:14.25}),30,'Mehr als sechs Stunden benötigen 30 Minuten Pause');
assert.equal(K.breaks.requiredMinutes({start:8,end:17.25}),45,'Mehr als neun Stunden benötigen 45 Minuten Pause');
const person=K.people[0];
const overlap={id:'TEST',personId:person.personId,date:'2026-12-04',start:12,end:13,zone:'front',area:'Verkauf',layer:'planned',status:'draft',breakMinutes:0};
assert(K.validateShift(overlap).some(x=>x.level==='error'&&/berschneidung/i.test(x.text)),'Überlappung muss blockiert werden');
const long={id:'LONG',personId:person.personId,date:'2026-12-05',start:11,end:18,zone:'front',area:'Verkauf',layer:'planned',status:'draft',breakMinutes:0};
assert(K.breaks.compliance(long).issues.some(x=>x.code==='break_missing'),'Fehlende Pause muss erkannt werden');
const deleteCandidate=K.shifts.find(x=>x.layer==='planned'&&x.status!=='deleted');
const deletedId=deleteCandidate.id;
K.mutations.deleteShift(deletedId,{reason:'Dynamischer Löschregressionstest'});
assert.equal(K.shifts.find(x=>x.id===deletedId).status,'deleted','Löschung muss revisionssicher als deleted gespeichert werden');
assert(!K.visiblePlannedShifts(deleteCandidate.date).some(x=>x.id===deletedId),'Gelöschter Soll-Dienst darf direkt nach dem Renderfilter nicht mehr sichtbar sein');
const day=K.days.find(x=>x.date==='2026-12-04');
const evaluation=K.evaluateDay(day);
assert(Number.isFinite(evaluation.quality)&&evaluation.slots>0,'Tagesbewertung muss berechenbar sein');
console.log('Core-Smoke-Test OK: Pausen, Überschneidung und Tagesbewertung');
