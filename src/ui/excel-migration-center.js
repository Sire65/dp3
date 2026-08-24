(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const clean=v=>String(v??'').replace(/\u00a0/g,' ').trim();
const norm=v=>clean(v).toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const fmtDate=iso=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso+'T12:00:00'));
const fmtTime=h=>`${String(Math.floor(Number(h))).padStart(2,'0')}:${String(Math.round((Number(h)%1)*60)).padStart(2,'0')}`;
const typeLabel=t=>({available:'Kann',preferred:'Wunsch',if_needed:'Nur wenn nötig',unavailable:'Sperrzeit / Sperrtag'})[t]||t;
let batches=[];
function members(){return (K.people||[]).filter(p=>p.active&&p.personType==='member'&&!p.testAccount);}
function extractIdentity(matrix,fileName=''){
  const rows=Array.isArray(matrix)?matrix:[];
  let name=clean(rows?.[3]?.[3]),personId=clean(rows?.[3]?.[7]),email=clean(rows?.[4]?.[3]),source=(name||personId)?'template_cells':'';
  const keyMap={name:['name','mitglied','mitarbeiter','person','vor und nachname','vorname nachname'],id:['id','mitglied id','mitglieds id','person id','personid','kc id'],email:['email','e mail','e mail adresse']};
  for(let r=0;r<Math.min(rows.length,12);r++)for(let c=0;c<Math.min((rows[r]||[]).length,12);c++){
    const key=norm(rows[r][c]);if(!key)continue;const value=clean(rows[r][c+1]);if(!value)continue;
    if(!name&&keyMap.name.includes(key)){name=value;source='metadata_row';}
    if(!personId&&keyMap.id.includes(key)){personId=value;source='metadata_row';}
    if(!email&&keyMap.email.includes(key)){email=value;source='metadata_row';}
  }
  if(!personId){const m=String(fileName||'').match(/_(KC-[A-Za-z0-9-]+)(?:\.[^.]+)?$/i);if(m){personId=m[1];source=source||'filename';}}
  return {name,personId,email,source:source||'missing'};
}
function resolvePerson(identity,people=members()){
  const id=clean(identity?.personId),name=norm(identity?.name),email=norm(identity?.email);
  if(id){const exact=people.find(p=>String(p.personId)===id);if(exact)return {person:exact,method:'person_id',ambiguous:false};}
  if(email){const hits=people.filter(p=>norm(p.email)===email);if(hits.length===1)return {person:hits[0],method:'email',ambiguous:false};if(hits.length>1)return {person:null,method:'email',ambiguous:true,candidates:hits};}
  if(name){const hits=people.filter(p=>norm(p.name)===name);if(hits.length===1)return {person:hits[0],method:'name',ambiguous:false};if(hits.length>1)return {person:null,method:'name',ambiguous:true,candidates:hits};}
  return {person:null,method:id?'unknown_id':'missing',ambiguous:false,candidates:[]};
}
function entryKey(personId,e){return [personId,e.date,Number(e.start).toFixed(4),Number(e.end).toFixed(4),e.wishType].join('|');}
function existingKeys(){return new Set((K.wishes||[]).filter(w=>w.status!=='deleted').map(w=>entryKey(w.personId,w)));}
function classifyEntries(personId,entries,keys=existingKeys()){
  const seen=new Set(),fresh=[],duplicates=[],withinFileDuplicates=[];
  for(const e of entries||[]){const key=entryKey(personId,e);if(seen.has(key)){withinFileDuplicates.push(e);continue}seen.add(key);if(keys.has(key))duplicates.push(e);else fresh.push(e);}
  return {fresh,duplicates,withinFileDuplicates};
}
async function sha256(buffer){const hash=await crypto.subtle.digest('SHA-256',buffer);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function workbookMatrix(file){
  if(/\.csv$/i.test(file.name))return {matrix:K.wishImport.parseDelimited(await file.text()),fingerprint:await sha256(await file.arrayBuffer())};
  if(!window.XLSX)throw new Error('Excel-Komponente ist nicht geladen. Bitte DP2 einmal online öffnen und erneut versuchen.');
  const buffer=await file.arrayBuffer(),wb=XLSX.read(buffer,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});
  return {matrix,fingerprint:await sha256(buffer)};
}
async function prepareFile(file){
  const {matrix,fingerprint}=await workbookMatrix(file),identity=extractIdentity(matrix,file.name),resolved=resolvePerson(identity),parsed=K.wishImport.normalizeMatrix(matrix),prior=(K.memberUxData?.excelMigrations||[]).find(x=>x.fingerprint===fingerprint);
  const batch={id:`MIG-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,fileName:file.name,fingerprint,identity,resolved,parsed,manualPersonId:'',prior,readError:null};
  if(resolved.person)batch.classification=classifyEntries(resolved.person.personId,parsed.entries);
  return batch;
}
function effectivePerson(batch){return batch.resolved?.person||members().find(p=>p.personId===batch.manualPersonId)||null;}
function refreshClassification(batch){const p=effectivePerson(batch);batch.classification=p?classifyEntries(p.personId,batch.parsed?.entries||[]):null;return batch.classification;}
function canImport(batch){const p=effectivePerson(batch),errors=(batch.parsed?.issues||[]).filter(x=>x.level==='error');if(!p||errors.length||batch.prior)return false;if(batch.identity?.personId&&batch.resolved?.person&&batch.manualPersonId&&batch.manualPersonId!==batch.resolved.person.personId)return false;return (refreshClassification(batch)?.fresh||[]).length>0;}
function renderBatch(batch){
  if(batch.readError)return `<article class="ux-card"><h3>${esc(batch.fileName)}</h3><div class="ux-warningbox">⛔ Datei konnte nicht gelesen werden: ${esc(batch.readError)}</div></article>`;
  const p=effectivePerson(batch),issues=batch.parsed?.issues||[],errors=issues.filter(x=>x.level==='error'),warnings=issues.filter(x=>x.level==='warning'),c=refreshClassification(batch),explicitKnown=!!batch.resolved?.person&&!!batch.identity?.personId;
  const selector=!p||(!explicitKnown&&batch.resolved?.method!=='person_id')?`<div class="ux-field"><label>Mitglied zuordnen${batch.identity?.personId?' · Datei-ID '+esc(batch.identity.personId):''}</label><select data-mig-person="${batch.id}"><option value="">– Mitglied auswählen –</option>${members().map(x=>`<option value="${esc(x.personId)}" ${batch.manualPersonId===x.personId?'selected':''}>${esc(x.name)} · ${esc(x.personId)}</option>`).join('')}</select></div>`:'';
  const state=batch.prior?'⛔ Diese identische Datei wurde bereits importiert.':errors.length?`⛔ ${errors.length} Fehler in den Zeitangaben.`:!p?'⛔ Mitglied noch nicht eindeutig zugeordnet.':c?.fresh?.length?`✓ ${c.fresh.length} neue Angabe(n) bereit.`:'ℹ Keine neuen Angaben; alles bereits vorhanden.';
  return `<article class="ux-card" data-mig-card="${batch.id}"><h3>${esc(batch.fileName)}</h3><p><b>Erkannt:</b> ${esc(batch.identity?.name||'Name fehlt')} · ${esc(batch.identity?.personId||'ID fehlt')}${p?`<br><b>Ziel:</b> ${esc(p.name)} · ${esc(p.personId)}`:''}</p>${selector}<div class="ux-statgrid"><div class="ux-stat"><b>${batch.parsed?.entries?.length||0}</b><small>erkannt</small></div><div class="ux-stat"><b>${c?.fresh?.length||0}</b><small>neu</small></div><div class="ux-stat"><b>${(c?.duplicates?.length||0)+(c?.withinFileDuplicates?.length||0)}</b><small>Dubletten</small></div></div><div class="${errors.length||!p||batch.prior?'ux-warningbox':'ux-goodbox'}" style="margin-top:10px">${state}</div>${warnings.length?`<div class="ux-note" style="margin-top:8px">${warnings.map(x=>`⚠ Zeile ${x.rowNumber}: ${esc(x.text)}`).join('<br>')}</div>`:''}${errors.length?`<div class="ux-warningbox" style="margin-top:8px">${errors.map(x=>`⛔ Zeile ${x.rowNumber}: ${esc(x.text)}`).join('<br>')}</div>`:''}${c?.fresh?.length?`<details style="margin-top:10px"><summary>${c.fresh.length} neue Zeitangaben anzeigen</summary>${c.fresh.map(e=>`<div style="margin:5px 0">${fmtDate(e.date)} · ${fmtTime(e.start)}–${fmtTime(e.end)} · <b>${esc(typeLabel(e.wishType))}</b></div>`).join('')}</details>`:''}</article>`;
}
function render(){
  const root=document.getElementById('kcdpUxRoot');if(!root)return;
  root.innerHTML=`<main class="ux-shell"><div class="ux-pagebar"><button class="ux-btn secondary" id="uxMigBack">←</button><div><h1>Alte Excel-Wunschlisten übernehmen</h1><p>Mehrere Dateien einlesen · Person prüfen · Dubletten vermeiden · erst dann speichern.</p></div></div><section class="ux-card"><input id="uxMigFiles" type="file" accept=".xlsx,.xls,.csv,text/csv" multiple style="display:none"><button class="ux-btn primary" id="uxMigChoose">Dateien auswählen</button><div class="ux-note" style="margin-top:10px">Personalisierte KC-DP2-Dateien werden über Name/ID automatisch zugeordnet. Bei alten Dateien ohne ID muss die Person einmal ausgewählt werden. Eine identische Datei wird nicht ein zweites Mal übernommen.</div></section><div id="uxMigList">${batches.map(renderBatch).join('')}</div>${batches.length?`<div class="ux-sticky"><span>${batches.filter(canImport).length} Datei(en) importierbar</span><button class="ux-btn primary" id="uxMigApply" ${batches.some(canImport)?'':'disabled'}>Alle geprüften neuen Angaben übernehmen</button></div>`:''}</main>`;
  document.getElementById('uxMigBack').onclick=()=>K.roleUx?.showRoleHome?.();
  document.getElementById('uxMigChoose').onclick=()=>document.getElementById('uxMigFiles').click();
  document.getElementById('uxMigFiles').onchange=async e=>{const files=[...(e.target.files||[])];if(!files.length)return;const button=document.getElementById('uxMigChoose');button.disabled=true;button.textContent='Dateien werden geprüft …';for(const file of files){try{batches.push(await prepareFile(file));}catch(err){batches.push({id:`ERR-${Date.now()}-${Math.random()}`,fileName:file.name,identity:{},resolved:{},parsed:{entries:[],issues:[]},readError:err.message});}}render();};
  document.querySelectorAll('[data-mig-person]').forEach(s=>s.onchange=()=>{const b=batches.find(x=>x.id===s.dataset.migPerson);if(b){b.manualPersonId=s.value;refreshClassification(b);render();}});
  const apply=document.getElementById('uxMigApply');if(apply)apply.onclick=applyAll;
}
async function applyAll(){
  const eligible=batches.filter(canImport);if(!eligible.length)return;
  const total=eligible.reduce((n,b)=>n+(refreshClassification(b)?.fresh?.length||0),0);if(!confirm(`${total} neue Wunschangabe(n) aus ${eligible.length} Datei(en) übernehmen?`))return;
  let done=0;const task=K.longTask?.start?.({title:'Excel-Migration läuft',total:Math.max(1,total+1),label:'Geprüfte Wunschlisten werden einsortiert …',showAfter:0});
  K.memberUxData=K.memberUxData||{};K.memberUxData.excelMigrations=Array.isArray(K.memberUxData.excelMigrations)?K.memberUxData.excelMigrations:[];
  for(const b of eligible){const p=effectivePerson(b),c=refreshClassification(b);for(const e of c.fresh){K.mutations.saveWish({...e,personId:p.personId,source:'excel_migration',comment:e.comment||`Alt-Excel geprüft · ${b.fileName}`,confidence:1,status:'confirmed'},{reason:`Alt-Excel ${b.fileName} → ${p.name}`});task?.update(++done,`${p.name} · ${fmtDate(e.date)} wird übernommen …`);}K.memberUxData.excelMigrations.push({fingerprint:b.fingerprint,fileName:b.fileName,personId:p.personId,entryCount:c.fresh.length,at:new Date().toISOString()});}
  await K.persistAll?.();task?.finish(`${total} Wunschangabe(n) übernommen`);batches=[];alert(`${total} neue Wunschangabe(n) wurden geprüft und richtig zugeordnet übernommen.`);K.roleUx?.showRoleHome?.();
}
function open(){if(K.currentUser?.role!=='admin')throw new Error('Nur Administratoren dürfen Alt-Excel-Dateien gesammelt migrieren.');batches=[];render();}
function inject(){
  if(K.currentUser?.role!=='admin'||document.getElementById('uxExcelMigrationOpen'))return;
  const heading=[...document.querySelectorAll('#kcdpUxRoot h1')].find(x=>x.textContent.trim()==='Administration');if(!heading)return;
  const grid=document.querySelector('#kcdpUxRoot .ux-grid');if(!grid)return;
  const card=document.createElement('section');card.className='ux-card';card.style.gridColumn='1/-1';card.innerHTML='<div class="ux-card-action"><div class="ux-card-icon">📥</div><div class="ux-card-copy"><h3>Alte Excel-Wunschlisten übernehmen</h3><p>Eingesammelte Dateien gesammelt einlesen, automatisch Personen zuordnen und Dubletten verhindern.</p></div><button class="ux-btn primary" id="uxExcelMigrationOpen">Migration öffnen</button></div>';grid.appendChild(card);card.querySelector('#uxExcelMigrationOpen').onclick=open;
}
new MutationObserver(()=>inject()).observe(document.body,{subtree:true,childList:true});
setTimeout(inject,0);
K.excelMigrationCenter={version:'0.19.51-migration1',open,extractIdentity,resolvePerson,classifyEntries,entryKey,prepareFile,canImport};
})();
