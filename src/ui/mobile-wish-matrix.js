(function(){
'use strict';
const K=window.KCDP,M=()=>K.mobileWishMatrix,$=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tm=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round(h%1*60)).padStart(2,'0')}`;
const dt=d=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(d+'T12:00:00'));
const label=w=>w.wishType==='unavailable'?(w.scope==='day'?'Sperrtag':'Sperrzeit'):({available:'Kann',preferred:'Wunsch',if_needed:'Kann · nur wenn notwendig'}[w.wishType]||w.wishType);
const zone=w=>({V:'Vorne',H:'Hinten',B:'Beides'}[w.wishZone||'B']);
const summary=list=>list.length?`<div class="mm-summary">${list.map(w=>`<span class="mm-chip ${esc(w.wishType)}"><b>${esc(label(w))}</b> ${w.scope==='day'?'ganztägig':`${tm(w.start)}–${tm(w.end)}`}${w.wishType!=='unavailable'?` · ${zone(w)}`:''}</span>`).join('')}</div>`:'<p class="mm-empty">Noch keine Angaben für diesen Tag.</p>';
let friendId='',date=null;
const self=()=>K.currentUser?.personId;
const editable=()=>K.state.wishPhase==='open'&&K.workflow?.status!=='published'&&K.auth?.canEditWish(self());
const shell=html=>{K.roleUx.matrixShell(`<div class="mm-root">${html}</div>`);document.body.scrollTo({top:0,behavior:"instant"});window.scrollTo({top:0,behavior:"instant"});};
const people=()=>K.people.filter(p=>p.active!==false&&p.personId!==self()).sort((a,b)=>a.name.localeCompare(b.name,'de'));
const datesOptions=selected=>K.days.map(d=>`<option value="${d.date}" ${selected===d.date?'selected':''}>${dt(d.date)}</option>`).join('');
function friendSelect(){return `<label class="mm-select">Mit Freund vergleichen<select id="mmFriend"><option value="">Kein Freund ausgewählt</option>${people().map(p=>`<option value="${esc(p.personId)}" ${friendId===p.personId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`;}
function friendPanel(day){const p=K.person(friendId);return p?`<aside class="mm-friend"><h3>${esc(p.name)} · ${dt(day)}</h3><p>Wunschangaben, noch keine feste Einteilung.</p>${summary(M().rows(friendId,day))}<button class="ux-btn secondary" type="button" id="mmFriendCopy">Zeiten auswählen und übernehmen</button></aside>`:'';}
function overview(message=''){
 if(!K.days.length)return;
 shell(`<div class="ux-pagebar"><button class="ux-btn secondary" id="mmBack" aria-label="Zurück">←</button><div><h1>Mein Wunschplan</h1><p>${esc(K.eventConfig?.name||'')} · Tag auswählen und Angaben bearbeiten.</p></div></div>${message?`<p class="ux-goodbox" role="status">${esc(message)}</p>`:''}${!editable()?'<p class="ux-warningbox">Die Wunschphase ist geschlossen. Ihre Angaben bleiben lesbar.</p>':''}<section class="ux-card">${friendSelect()}${editable()&&M().rows(self()).length?'<button class="ux-btn primary" id="mmSubmit">Wünsche abgeben</button>':''}<div class="mm-days">${K.days.map(d=>`<article class="mm-day"><header><h2>${dt(d.date)}</h2><span>${d.type==='prep'?'Vorbereitung':d.type==='after'?'Nachbereitung':'Markt'} · ${tm(d.start)}–${tm(d.end)}</span></header><h3>Meine Angaben</h3>${summary(M().rows(self(),d.date))}${K.wishAssistant?.standbyHtml?.(M().rows(self(),d.date).find(w=>w.assistantDay))||''}${friendId?`<div class="mm-friend-inline"><h3>${esc(K.person(friendId)?.name)}</h3>${summary(M().rows(friendId,d.date))}</div>`:''}<button class="ux-btn ${M().rows(self(),d.date).length?'secondary':'primary'}" data-mm-day="${d.date}">${editable()?(M().rows(self(),d.date).length?'Angaben bearbeiten':'Tag ausfüllen'):'Tag ansehen'}</button></article>`).join('')}</div></section>`);
 if($('mmSubmit'))$('mmSubmit').onclick=async()=>{try{M().assertEditable(self());K.memberUxData=K.memberUxData||{};K.memberUxData.wishSubmittedAt=K.memberUxData.wishSubmittedAt||{};K.memberUxData.wishSubmittedAt[self()]=new Date().toISOString();await K.persistAll();overview('Ihre Wünsche wurden abgegeben.');}catch(e){overview('Abgabe fehlgeschlagen: '+e.message)}};
 $('mmBack').onclick=()=>K.roleUx.showRoleHome();$('mmFriend').onchange=e=>{friendId=e.target.value;overview()};
 document.querySelectorAll('[data-mm-day]').forEach(b=>b.onclick=()=>entry(b.dataset.mmDay));
}
function entry(day){
 date=day;const personId=self(),original=M().rows(personId,day),snapshot=JSON.stringify(original),allOriginal=JSON.parse(JSON.stringify(M().rows(personId))),d=K.days.find(x=>x.date===day);
 if(!d)return overview();
 let draft=original.filter(w=>w.scope!=='day').map(w=>({...w})),dayOff=original.some(w=>w.scope==='day'&&w.wishType==='unavailable'),offNote=original.find(w=>w.scope==='day')?.comment||'',dirty=false,busy=false;
 const leave=fn=>{if(!busy&&(!dirty||confirm('Ungespeicherte Änderungen verwerfen?')))fn()};
 const inputTime=h=>h==null?'':tm(h);
 function render(){
 shell(`<div class="ux-pagebar"><button class="ux-btn secondary" id="mmEntryBack" aria-label="Zur Tagesübersicht">←</button><div><h1>${dt(day)}</h1><p>Rahmenzeit ${tm(d.start)}–${tm(d.end)} · ${esc(K.eventConfig?.name||'Wunschplan')}</p></div></div><div class="mm-layout"><section class="ux-card"><form id="mmForm"><fieldset class="mm-fields" ${editable()?'':'disabled'}><label class="mm-toggle"><input id="mmOff" type="checkbox" ${dayOff?'checked':''}><span><b>Ganzer Tag gesperrt</b><small>An diesem Tag kann ich nicht helfen.</small></span></label><div ${dayOff?'':'hidden'} id="mmOffFields"><label class="mm-select">Sperrtag bis einschließlich<select id="mmOffEnd">${K.days.filter(x=>x.date>=day).map(x=>`<option value="${x.date}">${dt(x.date)}</option>`).join('')}</select></label><p id="mmRangeInfo">Dieser Tag wird vollständig gesperrt. Vorhandene Zeiten werden ersetzt.</p><label class="mm-select">Bemerkung<textarea id="mmOffNote" rows="2">${esc(offNote)}</textarea></label><div id="mmRangePreview"></div></div><div ${dayOff?'hidden':''} id="mmTimeFields">${[['available','1 · Kann von–bis','Wann kann ich grundsätzlich helfen?'],['preferred','2 · Wunsch von–bis','Optional: meine bevorzugte Zeit innerhalb der Kann-Zeit.'],['unavailable','3 · Sperrzeit von–bis','Optional: in dieser Zeit kann ich nicht helfen.']].map(([type,title,help])=>`<section class="mm-section"><h2>${title}</h2><p>${help}</p><div>${draft.map((w,i)=>({w,i})).filter(({w})=>type==='available'?['available','if_needed'].includes(w.wishType):w.wishType===type).map(({w,i})=>`<div class="mm-interval" data-mm-row="${i}"><div class="mm-timepair"><label>Von<input data-field="start" type="time" step="60" value="${inputTime(w.start)}" required></label><label>Bis<input data-field="end" type="time" step="60" value="${inputTime(w.end===24?0:w.end)}" required></label></div><label class="mm-midnight"><input data-field="midnight" type="checkbox" ${w.end===24?'checked':''}> Bis Mitternacht (24:00)</label>${type==='available'?`<label class="mm-toggle"><input data-field="reserve" type="checkbox" ${w.wishType==='if_needed'?'checked':''}><span>Nur wenn notwendig <small>Reserve bei zusätzlichem Personalbedarf.</small></span></label>`:''}${type!=='unavailable'?`<label class="mm-select">Einsatzbereich<select data-field="wishZone">${[['B','Beides · vorne und hinten'],['V','Vorne'],['H','Hinten']].map(([v,l])=>`<option value="${v}" ${(w.wishZone||'B')===v?'selected':''}>${l}</option>`).join('')}</select></label>`:''}<details ${w.comment?'open':''}><summary>Bemerkung${w.comment?' vorhanden':' ergänzen'}</summary><textarea data-field="comment" rows="2" aria-label="Bemerkung zu ${esc(label(w))}">${esc(w.comment||'')}</textarea></details><button class="ux-btn ghost" type="button" data-remove="${i}">Zeitraum entfernen</button></div>`).join('')}</div><button type="button" class="ux-btn secondary" data-add="${type}">+ ${type==='available'?'Kann-Zeit':type==='preferred'?'Wunschzeit':'Sperrzeit'} hinzufügen</button></section>`).join('')}</div></fieldset><div id="mmError" role="alert" tabindex="-1"></div>${editable()?`<div class="mm-actions"><button class="ux-btn primary" id="mmSave" type="submit">Tag speichern</button><button class="ux-btn secondary" id="mmSaveNext" type="submit">Speichern & nächster Tag</button></div>`:''}</form></section><div><section class="ux-card">${friendSelect()}<div id="mmFriendPanel">${friendPanel(day)}</div></section><details class="ux-card"><summary>Hilfe zu den Angaben</summary><p>Kann ist Ihr möglicher Zeitraum. Wunsch liegt darin. Sperren haben Vorrang. „Nur wenn notwendig“ gilt für den jeweiligen Kann-Zeitraum.</p><p>Leere Tage bleiben offen und gelten nicht automatisch als verfügbar.</p></details></div></div>`);
 if(dayOff)document.querySelectorAll('#mmTimeFields input,#mmTimeFields select,#mmTimeFields textarea').forEach(e=>e.disabled=true);
 $('mmEntryBack').onclick=()=>leave(()=>overview());
 $('mmFriend').onchange=e=>{friendId=e.target.value;$('mmFriendPanel').innerHTML=friendPanel(day);wireFriend()};wireFriend();
 $('mmOff').onchange=e=>{dayOff=e.target.checked;dirty=true;render()};
 $('mmOffNote').oninput=e=>{offNote=e.target.value;dirty=true};
 $('mmOffEnd').onchange=()=>{dirty=true;const days=K.days.filter(x=>x.date>=day&&x.date<=$('mmOffEnd').value);$('mmRangeInfo').textContent=`${days.length} Tag(e) werden vollständig gesperrt. Die folgenden vorhandenen Angaben werden ersetzt:`;$('mmRangePreview').innerHTML=days.map(x=>`<h4>${dt(x.date)}</h4>${summary(M().rows(personId,x.date))}`).join('')};
 document.querySelectorAll('[data-mm-row]').forEach(el=>{
  const w=draft[Number(el.dataset.mmRow)];el.querySelectorAll('[data-field]').forEach(input=>input.oninput=()=>{dirty=true;const f=input.dataset.field;if(f==='reserve')w.wishType=input.checked?'if_needed':'available';else if(f==='midnight'){w.end=input.checked?24:null;el.querySelector('[data-field=end]').value=input.checked?'00:00':'';}else if(f==='start'||f==='end'){const v=input.value;w[f]=v?Number(v.slice(0,2))+Number(v.slice(3))/60:null;if(f==='end')el.querySelector('[data-field=midnight]').checked=false;}else w[f]=input.value;});
 });
 document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{dirty=true;draft.push({personId,date:day,start:null,end:null,wishType:b.dataset.add,wishZone:'B',scope:'time',comment:'',source:'self_service',status:'confirmed'});render()});
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{dirty=true;draft.splice(Number(b.dataset.remove),1);render()});
 $('mmForm').onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const end=dayOff?$('mmOffEnd').value:day,days=K.days.filter(x=>x.date>=day&&x.date<=end),dates=days.map(x=>x.date);
  let expected=snapshot;
  if(dates.length>1)expected=JSON.stringify(allOriginal.filter(w=>dates.includes(w.date)));
  const list=dayOff?days.map(x=>({personId,date:x.date,start:x.start,end:x.end,wishType:'unavailable',scope:'day',wishZone:'B',comment:offNote,source:'self_service',status:'confirmed'})):draft;
  try{
   busy=true;$('mmSave').disabled=true;$('mmSaveNext').disabled=true;
   await M().save(personId,dates,list,expected);dirty=false;
   const next=K.days[K.days.findIndex(x=>x.date===end)+1];
   if(e.submitter?.id==='mmSaveNext'&&next)entry(next.date);else overview(`${days.length>1?days.length+' Tage':dt(day)} gespeichert.`);
  }catch(err){$('mmError').textContent=err.message;$('mmError').className='ux-warningbox';$('mmError').focus();$('mmSave').disabled=false;$('mmSaveNext').disabled=false;}finally{busy=false;}
 };
 }
 function wireFriend(){if($('mmFriendCopy'))$('mmFriendCopy').onclick=()=>leave(()=>friend(friendId,day));}
 render();
}
function search(){
 shell(`<div class="ux-pagebar"><button class="ux-btn secondary" id="mmSearchBack" aria-label="Zurück">←</button><h1>Von Freund übernehmen</h1></div><section class="ux-card"><label class="mm-select">Freund suchen<input id="mmSearch" type="search" placeholder="Name eingeben"></label><label class="mm-select">Tag für die Vorschau<select id="mmSearchDay">${datesOptions(date||K.days[0]?.date)}</select></label><div id="mmSearchResults"></div></section>`);
 const run=()=>{date=$('mmSearchDay').value;const q=$('mmSearch').value.toLocaleLowerCase('de');$('mmSearchResults').innerHTML=people().filter(p=>p.name.toLocaleLowerCase('de').includes(q)).map(p=>`<button class="ux-person-result mm-search-result" data-friend="${esc(p.personId)}"><b>${esc(p.name)}</b>${summary(M().rows(p.personId,date))}</button>`).join('')||'<p>Kein passender Freund gefunden.</p>';document.querySelectorAll('[data-friend]').forEach(b=>b.onclick=()=>friend(b.dataset.friend,date))};
 $('mmSearchBack').onclick=()=>overview();$('mmSearch').oninput=run;$('mmSearchDay').onchange=run;run();
}
function friend(id,day=date||K.days[0]?.date){
 friendId=id;date=day;const p=K.person(id);if(!p)return search();const rows=M().rows(id,day);
 shell(`<div class="ux-pagebar"><button class="ux-btn secondary" id="mmFriendBack" aria-label="Zur Freundesauswahl">←</button><div><h1>${esc(p.name)}</h1><p>Zeiten ansehen und als eigene Vorlage auswählen.</p></div></div><section class="ux-card"><label class="mm-select">Tag<select id="mmCopyDay">${datesOptions(day)}</select></label><div class="mm-compare"><div><h2>${esc(p.name)}</h2>${rows.length?rows.map(w=>`<label class="mm-copy-row"><input type="checkbox" data-copy-id="${esc(w.id)}" ${['available','preferred'].includes(w.wishType)?'checked':''} ${editable()?'':'disabled'}><span>${summary([w])}</span></label>`).join(''):'<p>Für diesen Tag noch keine Angaben.</p>'}<p>Kann und Wunsch sind vorausgewählt. Reserve und Sperren bitte nur auswählen, wenn diese auch für Sie gelten.</p></div><div><h2>Meine bisherigen Angaben</h2>${summary(M().rows(self(),day))}<button class="ux-btn secondary" id="mmOwnEdit">Eigene Tagesmatrix öffnen</button></div></div><div id="mmCopyPreview" aria-live="polite"></div><div class="mm-actions"><button class="ux-btn primary" id="mmCopyApply" ${editable()?'':'disabled'}>Auswahl übernehmen</button></div><div id="mmCopyError" role="alert"></div></section>`);
 const ids=()=>[...document.querySelectorAll('[data-copy-id]:checked')].map(e=>e.dataset.copyId);
 const preview=()=>{const out=M().copyPreview(id,ids());$('mmCopyPreview').innerHTML=`<h3>Ihre zusätzlichen Angaben nach der Übernahme</h3>${summary(out.add)}${out.skipped?`<p>${out.skipped} bereits vorhandene Angabe(n) werden übersprungen.</p>`:''}${out.errors.length?`<div class="ux-warningbox">${out.errors.map(esc).join('<br>')}<p>Passen Sie die Auswahl an oder bearbeiten Sie Ihre Tagesmatrix.</p></div>`:''}`;$('mmCopyApply').disabled=!editable()||!out.add.length||!!out.errors.length};
 $('mmFriendBack').onclick=search;$('mmCopyDay').onchange=e=>friend(id,e.target.value);$('mmOwnEdit').onclick=()=>entry(day);
 document.querySelectorAll('[data-copy-id]').forEach(e=>e.onchange=preview);preview();
 $('mmCopyApply').onclick=async()=>{const b=$('mmCopyApply');b.disabled=true;try{const out=await M().copy(id,ids());overview(`${out.add.length} Angabe(n) von ${p.name} übernommen. Sie können Ihre Zeiten jetzt anpassen.`)}catch(err){$('mmCopyError').textContent=err.message;preview()}};
}
K.mobileMatrixUi={overview,entry,search,friend,summary};
})();
