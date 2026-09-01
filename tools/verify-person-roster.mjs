import fs from 'node:fs';
const window={};
new Function('window',fs.readFileSync(new URL('../src/core/model.js',import.meta.url),'utf8'))(window);
new Function('window',fs.readFileSync(new URL('../src/adapters/timeclock-import.js',import.meta.url),'utf8'))(window);
new Function('window',fs.readFileSync(new URL('../src/adapters/person-provider.js',import.meta.url),'utf8'))(window);
const K=window.KCDP;
const expected=[
 ['KC-0001','Marianne Bierkämper','KC-P-M0001','member'],['KC-0002','Reinhild Eggenstein','KC-P-M0002','member'],['KC-0003','Frank Brösel','KC-P-M0003','member'],
 ['KC-0005','Andrea Spahn','KC-P-M0005','member'],['KC-0006','Willfried Wittwer','KC-P-M0006','member'],['KC-0007','Anne Reinkober','KC-P-M0007','member'],
 ['KC-0008','Dieter Zander','KC-P-M0008','member'],['KC-0009','Klaus Zander','KC-P-M0009','member'],['KC-0010','Hans-Joachim Koch','KC-P-002','member'],
 ['KC-0011','Manfred Schoppmann','KC-P-M0011','member'],['KC-0012','Thomas Hess','KC-P-M0012','member'],['KC-0013','Karla Kazik','KC-P-M0015','member'],
 ['KC-0014','Ruth Kazik','KC-P-M0016','member'],['KC-0015','Steven Linley','KC-P-M0013','member'],['KC-0016','Peter Wördemann','KC-P-M0017','member'],
 ['KC-0017','Christina Brösel','KC-P-M0014','member'],['KC-0018','Leon Wördemann','KC-P-M0018','helper']
];
const errors=[];
for(const [nr,name,id,type] of expected){const p=K.people.find(x=>x.memberNo===nr);if(!p||p.name!==name||p.personId!==id||p.personType!==type)errors.push(`${nr}: ${JSON.stringify(p)}`);const booking=K.timeclockImport.normalizeRow({memberNo:nr,date:'2026-12-04',start:'11:00',end:'19:00'});if(booking.personId!==id)errors.push(`${nr}: Buchung -> ${booking.personId||'ohne Zuordnung'}`);}
for(const nr of ['KC-0004','KC-0019'])if(K.people.some(p=>p.memberNo===nr))errors.push(`${nr} darf nicht planbar sein`);
for(const id of ['KC-P-M0004','KC-P-M0019'])if(K.personPlanningAllowed(id)!==false)errors.push(`${id} ist nicht gesperrt`);
for(const type of ['guest','employee','Gast','Aushilfe','helper','unbekannt']){const p=K.personAdapter.validateRows([{personId:'TEST-'+type,name:'Test',personType:type}])[0];if(p.personType!=='helper')errors.push(`${type} wurde ${p.personType}`);}
K.shifts=[{personId:'KC-P-007'}];const migrated=K.personAdapter.migrateReferences();if(!migrated.changed||K.shifts[0].personId!=='KC-P-M0015')errors.push('Alt-ID-Migration fehlgeschlagen');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log(`Personenstand OK: ${expected.length} zentrale planbare Personen, 5 lokale Aushilfen, Ausschlüsse und Alt-ID-Migration geprüft.`);