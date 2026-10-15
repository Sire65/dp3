// DP2-F-SE-01 Sondereinsätze: Termin offen, Folgedatum, Markttage, Prüfregeln, Veröffentlichungszeilen.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const context=vm.createContext({window:{},document:{readyState:'complete',write:()=>{}},console,setTimeout,clearTimeout,structuredClone});
for(const file of ['src/core/model.js','src/core/auth.js','src/core/configuration.js','src/core/special-events.js']){
  vm.runInContext(await readFile(path.join(root,file),'utf8'),context,{filename:file});
}
const K=context.window.KCDP,S=K.specialEventsCore;
const audit=[];K.recordAudit=(action,meta)=>audit.push({action,...meta});
const queued=[];K.sync={enqueue:op=>queued.push(op)};
assert.equal(S.VERSION,'0.1.0');
const daysBefore=JSON.stringify(K.days);

// Termin noch offen: kein Datum nötig, kein Datum wirksam.
const kochen=S.create({titel:'Grünkohl kochen',ort:'Krankenhaus Dortmund',art:'kochen'});
assert.equal(kochen.terminStatus,'OFFEN');
assert.equal(kochen.effective.datumVon,null);
assert.deepEqual([...kochen.effective.dates],[]);
assert.equal(kochen.eventId,'KC-WM-2026','Stundenkonto ist die Veranstaltung aus eventConfig');

// Abholung folgt dem Kochen nach 2 Tagen – solange offen, ebenfalls ohne Datum.
const abholung=S.create({titel:'Grünkohl abholen Dortmund → Tiefkühler Hamm',art:'transport',folgtAuf:kochen.id,abstandTage:2});
assert.equal(abholung.effective.terminStatus,'OFFEN');
assert.equal(abholung.effective.datumVon,null);

// Kochtermin wird fest → Abholung rückt automatisch mit.
S.setTermin(kochen.id,{terminStatus:'FEST',datumVon:'2027-01-12'});
assert.equal(S.get(abholung.id).effective.datumVon,'2027-01-14');
assert.equal(S.get(abholung.id).effective.terminStatus,'FEST');
S.setTermin(kochen.id,{terminStatus:'FEST',datumVon:'2027-01-19'});
assert.equal(S.get(abholung.id).effective.datumVon,'2027-01-21','Verschobener Kochtermin verschiebt die Abholung');
assert.equal(S.get(abholung.id).datumVon,null,'Folgedatum wird berechnet, nicht gespeichert');

// Monatswechsel und Kette über zwei Stufen.
S.setTermin(kochen.id,{terminStatus:'GEPLANT',datumVon:'2027-01-30'});
const einlagern=S.create({titel:'Kontrolle Tiefkühler',art:'sonstiges',folgtAuf:abholung.id,abstandTage:1});
assert.equal(S.get(abholung.id).effective.datumVon,'2027-02-01');
assert.equal(S.get(einlagern.id).effective.datumVon,'2027-02-02');
assert.equal(S.get(einlagern.id).effective.terminStatus,'GEPLANT');

// Getränke: wiederkehrend an allen Markttagen.
const getraenke=S.create({titel:'Getränke mischen zuhause + Anlieferung',art:'vorbereitung_zuhause',wiederkehrend:'markttage'});
const markttage=[...K.days.filter(d=>d.type==="market").map(d=>d.date)];
assert.deepEqual([...getraenke.effective.dates],markttage);
assert.equal(getraenke.effective.terminStatus,'FEST');

// Prüfregeln.
assert.throws(()=>S.create({titel:'',art:'kochen'}),/Titel/);
assert.throws(()=>S.create({titel:'X',art:'erfunden'}),/Art aus der Liste/);
assert.throws(()=>S.create({titel:'X',art:'kochen',terminStatus:'FEST'}),/Datum/);
assert.throws(()=>S.create({titel:'X',art:'kochen',datumVon:'2027-01-10',datumBis:'2027-01-09'}),/Enddatum/);
assert.throws(()=>S.create({titel:'X',art:'kochen',datumVon:'2027-02-30'}),/Datum/,'Ungültiges Datum wird verworfen');
assert.throws(()=>S.create({titel:'X',art:'transport',folgtAuf:'SE-gibt-es-nicht',abstandTage:2}),/Vorgänger/);
assert.throws(()=>S.create({titel:'X',art:'transport',folgtAuf:kochen.id,abstandTage:99}),/Abstand/);
assert.throws(()=>S.update(kochen.id,{folgtAuf:einlagern.id,abstandTage:1}),/Kreis/,'Zyklus wird verhindert');
assert.throws(()=>S.deactivate(kochen.id,{reason:'abgesagt'}),/Folge-Einsätze/,'Vorgänger mit aktiven Folgen kann nicht beendet werden');
assert.throws(()=>S.deactivate(einlagern.id),/Grund/);
S.deactivate(einlagern.id,{reason:'nicht nötig'});
assert.equal(S.list().some(e=>e.id===einlagern.id),false);
assert.equal(S.list({includeInactive:true}).some(e=>e.id===einlagern.id),true,'Beendete Einsätze bleiben nachvollziehbar');

// Audit, Sync, Version.
assert.ok(audit.some(a=>a.action==='special_event.create'));
assert.ok(audit.some(a=>a.action==='special_event.update'&&a.before&&a.after));
assert.ok(queued.every(q=>q.entity==='special_event'));
assert.ok(S.get(kochen.id).version>=4);

// Veröffentlichung: nur aktive, mit wirksamem Datum.
const rows=S.publishRows();
assert.equal(rows.length,3);
assert.equal(rows.find(r=>r.sourceId===abholung.id).datumVon,'2027-02-01');
assert.equal(rows.some(r=>r.sourceId===einlagern.id),false);

// Rechte: ohne Planungsrecht kein Anlegen.
const has=K.auth.has;K.auth.require=(perm,msg)=>{if(perm==='roster.plan.edit')throw new Error(msg);};
assert.throws(()=>S.create({titel:'X',art:'kochen'}),/nicht bearbeiten/);
K.auth.has=has;delete K.auth.require;

// Wiederherstellen und Markttage unberührt.
const snap=S.snapshot();S.restore([]);assert.equal(S.list().length,0);S.restore(snap);assert.equal(S.list().length,3);
assert.equal(JSON.stringify(K.days),daysBefore,'K.days bleibt unverändert');
console.log('✓ Sondereinsätze: Termin offen, Folgedatum, Markttage, Prüfregeln, Audit, Veröffentlichung');
