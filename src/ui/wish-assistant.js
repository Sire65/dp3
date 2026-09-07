(function(){
'use strict';
const K=window.KCDP,$=id=>document.getElementById(id),M=()=>K.mobileWishMatrix;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tm=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round(h%1*60)).padStart(2,'0')}`;
const dt=d=>new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long'}).format(new Date(d+'T12:00:00'));
const clone=x=>JSON.parse(JSON.stringify(x));
let state=null,step='availability',busy=false,dirty=false,owner=null,expected='',originalAll=[];
const self=()=>K.currentUser?.personId;
const day=()=>K.days.find(d=>d.date===state.date);
const editable=()=>self()&&K.state.wishPhase==='open'&&K.workflow?.status!=='published'&&K.auth?.canEditWish(self());
function standbyFor(personId,date){return M().rows(personId,date).filter(w=>w.assistantDay?.standby).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0]?.assistantDay.standby||{answer:null,slots:[]};}
function standbyText(s){if(!s?.answer)return 'Bereitschaft noch nicht angegeben';return s.answer==='no'?'Keine Bereitschaft':`Bereitschaft zum Einspringen: ${(s.slots||[]).map(x=>tm(x.start)+'–'+tm(x.end)).join(', ')} Uhr · noch keine Einteilung`;}
function standbyHtml(record){return record?.assistantDay?.standby?`<div class="wa-standby-note"><b>${esc(standbyText(record.assistantDay.standby))}</b></div>`:'';}
function load(date){
 const rows=M().rows(self(),date),can=rows.filter(w=>['available','if_needed'].includes(w.wishType)),pref=rows.filter(w=>w.wishType==='preferred'),off=rows.some(w=>w.wishType==='unavailable'&&w.scope==='day');
 return {date,status:off?'no':can.length?(can.every(w=>w.wishType==='if_needed')?'reserve':'yes'):null,can:clone(can),pref:clone(pref),wishAnswer:rows[0]?.assistantDay?.wishAnswer||(pref.length?'custom':null),blocks:clone(rows.filter(w=>w.wishType==='unavailable'&&w.scope!=='day')),blockAnswer:rows[0]?.assistantDay?.blockAnswer||(rows.some(w=>w.wishType==='unavailable'&&w.scope!=='day')?'yes':null),standby:clone(standbyFor(self(),date)),zone:can[0]?.wishZone||'B',applyZone:false,applyNote:false,note:rows[0]?.comment||'',offDates:[date]};
}
function rowsFor(s){
 const personId=owner||self(),meta={version:1,wishAnswer:s.wishAnswer,blockAnswer:s.blockAnswer,standby:clone(s.status==='no'||s.standby.answer==='no'?{answer:'no',slots:[]}:s.standby)};
 const base={personId,status:'confirmed',source:'guided_assistant',confidence:1,comment:s.note,assistantDay:meta};
 if(s.status==='unknown')return [];
 if(s.status==='no')return K.days.filter(d=>s.offDates.includes(d.date)).map(d=>({...base,date:d.date,start:d.start,end:d.end,wishType:'unavailable',scope:'day',wishZone:'B'}));
 return [...s.can,...(s.can.every(w=>w.wishType==='if_needed')||s.wishAnswer==='none'?[]:s.wishAnswer==='all'?s.can.filter(w=>w.wishType==='available').map(w=>({start:w.start,end:w.end,wishType:'preferred',wishZone:w.wishZone,comment:w.comment})):s.pref),...(s.blockAnswer==='no'?[]:s.blocks)].map(w=>({...w,...base,comment:s.applyNote?s.note:w.comment||'',id:w.id||'',date:s.date,scope:'time',wishZone:w.wishType==='unavailable'?'B':s.applyZone?s.zone:w.wishZone||s.zone}));
}
function errorsFor(s){
 if(s.status==='unknown')return [];
 const errors=M().validate(rowsFor(s));
 if(s.status!=='no'&&!s.can.length)errors.push('Bitte mindestens eine Kann-Zeit auswählen.');
 if(s.status!=='no'&&!s.standby.answer)errors.push('Bitte die Frage zur Bereitschaft beantworten.');
 if(s.status!=='no'&&s.standby.answer==='yes'){
  if(!s.standby.slots.length)errors.push('Bitte einen Bereitschaftszeitraum auswählen.');
  for(const x of s.standby.slots){if(!Number.isFinite(x.start)||!Number.isFinite(x.end)||x.start<0||x.end>24||x.start>=x.end)errors.push('Die Bereitschaft braucht gültige Von-/Bis-Zeiten.');if(s.blockAnswer!=='no'&&s.blocks.some(b=>Math.max(b.start,x.start)<Math.min(b.end,x.end)))errors.push('Bereitschaft und Sperrzeit überschneiden sich. Bitte anpassen.');}
 }
 return [...new Set(errors)];
}
function shell(html){K.roleUx.matrixShell(`<main class="wa-root">${html}</main>`);K.chefCompanion?.decorate(document.querySelector('.wa-root'),state?step:null,state?state.date+'-'+step:'days');document.body.scrollTo({top:0,behavior:'instant'});window.scrollTo({top:0,behavior:'instant'});}
function start(message=''){
 if(!self())return K.roleUx.showRoleHome();state=null;dirty=false;busy=false;owner=self();
 shell(`<div class="wa-heading"><button class="ux-btn secondary" id="waExit" aria-label="Zu den Eingabemöglichkeiten">←</button><div><span class="wa-eyebrow">ZEITEN MIT ASSISTENTEN</span><h1>Wann möchtest du helfen?</h1><p>${esc(K.assistantStaffing?.intro||"Trage deine Zeiten wie gewohnt ein.")}</p></div></div>${message?`<p role="status" class="ux-goodbox">${esc(message)}</p>`:''}<p class="wa-event">${esc(K.eventConfig?.name||'Aktueller Wunschplan')}</p>${editable()?'':'<p class="ux-warningbox">Die Wunschphase ist geschlossen. Deine Angaben kannst du in der Tagesübersicht ansehen.</p>'}<div class="wa-daygrid">${K.days.map(d=>`<button class="wa-day" data-wa-day="${d.date}" ${editable()?'':'disabled'}><b>${dt(d.date)}</b><span>${tm(d.start)}–${tm(d.end)} Uhr</span>${K.mobileMatrixUi.summary(M().rows(self(),d.date))}<small class="as-dayhint">${esc(K.assistantStaffing?.dayHint(d.date)||"")}</small>${M().rows(self(),d.date).length?`<small>${esc(standbyText(standbyFor(self(),d.date)))}</small>`:''}<strong>${M().rows(self(),d.date).length?'Angaben prüfen / ändern':'Diesen Tag ausfüllen'} →</strong></button>`).join('')}</div><button class="ux-btn primary" id="waSummary">Fertig? Meine Auswertung</button><button class="ux-btn secondary" id="waOverview">Meine gesamte Tagesübersicht</button>`);
 $('waSummary').onclick=()=>K.chefCompanion.finish();$('waExit').onclick=()=>K.roleUx.openTimes();$('waOverview').onclick=()=>K.mobileMatrixUi.overview();
 document.querySelectorAll('[data-wa-day]').forEach(b=>b.onclick=()=>open(b.dataset.waDay));
}
function open(date){if(!editable())return start();owner=self();state=load(date);originalAll=clone(M().rows(owner));expected=JSON.stringify(originalAll.filter(w=>w.date===date));step='availability';dirty=false;busy=false;expandedTimes.clear();render();}
const sequence=()=>state.status==='no'?['availability','offdays','review']:state.status==='unknown'?['availability','review']:['availability','can',...(state.can.length&&state.can.every(w=>w.wishType==='if_needed')?[]:['wish']),'blocks','standby','zone','review'];
const choice=(key,value,title,sub='')=>`<button type="button" class="wa-choice ${value===readChoice(key)?'chosen':''}" data-choice="${key}" data-value="${value}" aria-pressed="${value===readChoice(key)}"><b>${title}</b>${sub?`<span>${sub}</span>`:''}</button>`;
function readChoice(key){if(key==='status'&&state.status==='reserve')return 'yes';return key==='standby'?state.standby.answer:state[key];}
const expandedTimes=new Set();
function limits(key){const d=day();return key==='pref'&&state.can.length?{start:Math.min(...state.can.map(x=>x.start).filter(Number.isFinite)),end:Math.max(...state.can.map(x=>x.end).filter(Number.isFinite))}:d;}
function slotsHtml(key,slots){const bound=limits(key);return `<p class="wa-timehint">Rahmenzeit ${tm(day().start)}–${tm(day().end)} Uhr. Wähle deine Uhrzeiten und bestätige sie mit Weiter.</p><div class="wa-slots">${slots.map((x,i)=>`<div class="wa-slot"><div class="wa-timepair">${['start','end'].map(f=>`<label>${f==='start'?'Von':'Bis'}<select data-slot-key="${key}" data-slot-index="${i}" data-slot-field="${f}" aria-label="${key==='can'?'Kann':key==='pref'?'Wunsch':key==='blocks'?'Sperrzeit':'Bereitschaft'} ${i+1} ${f==='start'?'von':'bis'}">${timeOptions(x[f],f,key,i,x)}</select></label>`).join('')}</div>${key==='can'?`<label class="wa-reserve-check"><input type="checkbox" data-reserve-index="${i}" ${x.wishType==='if_needed'?'checked':''}> Nur wenn nötig</label>`:''}<button type="button" class="ux-btn secondary wa-other-time" data-other-time="${key}:${i}">${expandedTimes.has(key+':'+i)?'Zeiten im Tagesrahmen zeigen':'Andere Uhrzeit wählen'}</button><button class="wa-remove" type="button" data-remove="${key}" data-index="${i}">Zeitraum entfernen</button></div>`).join('')}</div><button type="button" class="ux-btn secondary" data-add="${key}">+ Weiterer Zeitraum</button>`;}
function timeOptions(value,field,key,index,row){const bound=limits(key),full=expandedTimes.has(key+':'+index),lo=full?0:bound.start,hi=full?24:bound.end,nums=new Set(Array.from({length:49},(_,i)=>i/2).filter(n=>n>=lo&&n<=hi&&(field==='end'?(!Number.isFinite(row.start)||n>row.start):n<24)));if(Number.isFinite(value))nums.add(value);return `<option value="">${field==='start'?'Ab '+tm(bound.start):'Bis'} · auswählen</option>`+[...nums].sort((a,b)=>a-b).map(n=>`<option value="${n}" ${n===value?'selected':''}>${tm(n)}${n===24?' · Mitternacht':''}</option>`).join('');}
function currentSummary(){
 const stored=M().rows(owner,state.date),complete=x=>Number.isFinite(x.start)&&Number.isFinite(x.end)&&x.end>x.start;
 const rows=state.status==='unknown'?stored:rowsFor(state).filter(complete);
 return `<h2>Deine Zeiten</h2>${K.mobileMatrixUi.summary(rows)}<small>${esc(standbyText(state.standby))}</small><p class="wa-draft-status">${dirty?'Noch nicht gespeichert':'Bisher gespeicherte Angaben'}</p>${K.assistantStaffing?.highlights(state.date,rows)||''}`;
}
function updateSummary(){const el=$('waCurrentSummary');if(el)el.innerHTML=currentSummary();const demand=$('waDemandLive');if(demand){demand.innerHTML=staffingHtml();bindStaffing();}}
function staffingHtml(){return K.assistantStaffing?.render(state.date,state.status==='unknown'?M().rows(owner,state.date):rowsFor(state),step)||'';}
function bindStaffing(){
 document.querySelectorAll('[data-as-start]').forEach(b=>b.onclick=()=>{
  if(busy||!editable()||self()!==owner)return error('Die Anmeldung oder Wunschphase hat sich geändert. Bitte erneut öffnen.');
  const draft=rowsFor(state),g=K.assistantStaffing.suggestions(state.date,draft).find(x=>x.start===Number(b.dataset.asStart)&&x.end===Number(b.dataset.asEnd)&&x.wishZone===b.dataset.asZone);
  if(!g){updateSummary();return error('Die Besetzung oder deine Angaben haben sich geändert. Bitte den aktuellen Vorschlag prüfen.');}
  const old=draft.filter(w=>w.wishType==='preferred'),next=[];
  for(const w of old){
   if(Math.max(w.start,g.start)>=Math.min(w.end,g.end)){next.push(w);continue;}
   if(w.start<g.start)next.push({...w,end:g.start});
   if(w.end>g.end)next.push({...w,id:w.start<g.start?'':w.id,start:g.end});
  }
  state.can=draft.filter(w=>['available','if_needed'].includes(w.wishType));
  state.pref=[...next,{start:g.start,end:g.end,wishType:'preferred',wishZone:g.wishZone}];
  state.applyZone=false;state.wishAnswer='custom';dirty=true;render();
  const feedback=$('waStaffingStatus');feedback.textContent='Wunschzeit angepasst: '+tm(g.start)+'–'+tm(g.end)+' Uhr · '+(g.wishZone==='V'?'Vorne':g.wishZone==='H'?'Hinten':'Beides')+'. Noch nicht gespeichert.';
  feedback.focus();
 });
}
function friendHtml(){return `<details class="wa-friend"><summary>Zeiten von einem Freund verwenden</summary><label>Freund auswählen<select id="waFriend"><option value="">Bitte auswählen</option>${K.people.filter(p=>p.active!==false&&p.personId!==self()).map(p=>`<option value="${esc(p.personId)}">${esc(p.name)}</option>`).join('')}</select></label><div id="waFriendPreview"></div></details>`;}
function body(){
 const d=day();
 if(step==='availability')return `<h1>Kannst du an diesem Tag helfen?</h1><div class="wa-choices">${choice('status','yes','Ja, ich kann helfen')}${choice('status','no','Nein, an diesem Tag nicht','Den ganzen Tag sperren.')}${choice('status','unknown','Das weiß ich noch nicht','Den Tag vorerst offen lassen.')}</div>${M().rows(owner,state.date).length?``:''}`;
 if(step==='offdays')return `<h1>Gilt die Sperre auch für weitere Tage?</h1><p>Wähle alle Tage aus, an denen du nicht helfen kannst.</p><div class="wa-choices">${K.days.map(x=>`<label class="wa-check"><input type="checkbox" data-offdate="${x.date}" ${state.offDates.includes(x.date)?'checked':''} ${x.date===state.date?'disabled':''}><span>${dt(x.date)}</span></label>`).join('')}</div><p>Vor dem Speichern zeigen wir dir die betroffenen Angaben.</p>`;
 if(step==='can')return `<h1>Von wann bis wann könntest du helfen? (Kannzeit)</h1><p>Das ist dein möglicher Zeitraum. Deine Lieblingszeit folgt als Nächstes.</p><div class="wa-presets"><button type="button" class="ux-btn secondary" id="waWhole">Gesamte Rahmenzeit · ${tm(d.start)}–${tm(d.end)}</button><button type="button" class="ux-btn secondary" id="waPrevious">Wie am vorherigen Tag</button></div>${slotsHtml('can',state.can)}${friendHtml()}`;
 if(step==='wish')return `<h1>Welche Zeit wäre dir am liebsten? (Wunschzeit)</h1><p>Du kannst helfen: ${state.can.map(x=>tm(x.start)+'–'+tm(x.end)).join(', ')} Uhr.</p><div class="wa-choices">${choice('wishAnswer','all','Genau diese Zeiten')}${choice('wishAnswer','custom','Ich wünsche mir einen kürzeren Zeitraum')}${choice('wishAnswer','none','Keine besondere Wunschzeit')}</div>${state.wishAnswer==='custom'?slotsHtml('pref',state.pref):''}`;
 if(step==='blocks')return `<h1>Gibt es Zeiten, in denen du nicht kannst? (Sperrzeit)</h1><p>Zum Beispiel wegen eines Termins oder einer Unterbrechung.</p><div class="wa-choices">${choice('blockAnswer','no','Nein, keine Unterbrechung')}${choice('blockAnswer','yes','Ja, ich möchte Zeiten sperren')}</div>${state.blockAnswer==='yes'?slotsHtml('blocks',state.blocks):''}`;
 if(step==='standby')return `<h1>Könntest du als Bereitschaft einspringen?</h1><p>Du hältst dich zum Einspringen bereit. Das ist ein zusätzliches Angebot und noch kein geplanter Dienst.</p><div class="wa-choices">${choice('standby','no','Nein, keine Bereitschaft')}${choice('standby','yes','Ja, zu bestimmten Zeiten')}</div>${state.standby.answer==='yes'?`<button type="button" class="ux-btn secondary" id="waStandbyWhole">Gesamte Rahmenzeit · ${tm(d.start)}–${tm(d.end)}</button>${slotsHtml('standby',state.standby.slots)}`:''}`;
 if(step==='zone')return `<h1>Wo möchtest du helfen?</h1><div class="wa-choices">${choice('zone','V','Vorne')}${choice('zone','H','Hinten')}${choice('zone','B','Beides · vorne und hinten')}</div><details ${state.note?'open':''}><summary>Möchtest du noch etwas ergänzen?</summary><label>Bemerkung (freiwillig)<textarea id="waNote" rows="3">${esc(state.note)}</textarea></label></details>`;
 const rows=rowsFor(state),errors=errorsFor(state);
 return `<h1>Passt das so für dich?</h1>${state.status==='unknown'?'<p>Dieser Tag bleibt vorerst offen. Falls bereits Angaben vorhanden sind, werden diese nicht geändert.</p>':`${state.status==='no'?state.offDates.map(date=>`<h2>${dt(date)}</h2><p>Ganzer Tag gesperrt.</p>${M().rows(owner,date).length?`<details><summary>Diese bisherigen Angaben werden ersetzt</summary>${K.mobileMatrixUi.summary(M().rows(owner,date))}</details>`:''}`).join(''):K.mobileMatrixUi.summary(rows)}<p class="wa-readiness">${esc(standbyText(state.status==='no'?{answer:'no'}:state.standby))}</p>${state.note?`<p>Bemerkung: ${esc(state.note)}</p>`:''}`}<section class="wa-review-edit"><h2>Eine Antwort ändern</h2><div class="wa-editlinks">${sequence().filter(s=>s!=='review').map(s=>`<button type="button" class="ux-btn secondary" data-edit="${s}">${({availability:'Tag',can:'Kann-Zeit',wish:'Wunsch',blocks:'Sperrzeiten',standby:'Bereitschaft',zone:'Bereich',offdays:'Sperrtage'})[s]} ändern</button>`).join('')}</div></section>${errors.length?`<div class="ux-warningbox">${errors.map(esc).join('<br>')}</div>`:''}<p>Deine Angaben gehen in den Wunschplan. Die feste Einteilung macht anschließend der Planer.</p>`;
}
function render(){
 const seq=sequence(),index=seq.indexOf(step),content=body(),title=content.match(/^<h1>[\s\S]*?<\/h1>/)?.[0]||'';
 shell(`<div class="wa-heading"><button type="button" class="ux-btn secondary" id="waCancel" aria-label="Assistenten verlassen">×</button><div><span class="wa-eyebrow">ZEITEN MIT ASSISTENTEN</span><p>${dt(state.date)} · ${esc(K.eventConfig?.name||'Wunschplan')}</p></div></div><div class="wa-progress"><span>Schritt ${index+1} von ${seq.length}</span><progress max="${seq.length}" value="${index+1}" aria-label="Fortschritt"></progress></div><section class="wa-question" aria-live="polite">${title}${step!=='review'?`<aside id="waCurrentSummary" class="wa-existing" aria-live="polite">${currentSummary()}</aside>`:''}${content.slice(title.length)}<div id="waStaffingStatus" role="status" tabindex="-1"></div><div id="waDemandLive">${staffingHtml()}</div><div id="waError" role="alert" tabindex="-1"></div><div class="wa-actions"><button type="button" class="ux-btn secondary" id="waBack">Zurück</button><button type="button" class="ux-btn primary" id="waNext">${step==='review'?(state.status==='unknown'?'Tag offen lassen':'Angaben speichern'):'Weiter →'}</button></div></section>`);
 $('waCancel').onclick=()=>{if(!busy&&(!dirty||confirm('Assistenten verlassen und ungespeicherte Änderungen verwerfen?')))start()};
 $('waBack').onclick=()=>{if(busy)return;if(index===0){$('waCancel').click();return}step=seq[index-1];render()};
 $('waNext').onclick=()=>advance();bindStaffing();
 document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{
  if(busy)return;
  dirty=true;const key=b.dataset.choice,value=b.dataset.value;
  if(key==='standby'){state.standby.answer=value;if(value==='yes'&&!state.standby.slots.length)state.standby.slots=[{start:null,end:null}];}
  else{state[key]=value;if(key==='status'&&['yes','reserve'].includes(value)){if(!state.can.length)state.can=[{start:null,end:null,wishType:value==='reserve'?'if_needed':'available',wishZone:state.zone}];}if(key==='zone')state.applyZone=true;}
  if(key==='wishAnswer'&&value==='all')state.pref=state.can.filter(w=>w.wishType==='available').map(w=>({start:w.start,end:w.end,wishType:'preferred',wishZone:w.wishZone}));
  if(key==='wishAnswer'&&value==='custom'&&!state.pref.length)state.pref=[{start:null,end:null,wishType:'preferred',wishZone:state.zone}];
  if(key==='blockAnswer'&&value==='yes'&&!state.blocks.length)state.blocks=[{start:null,end:null,wishType:'unavailable'}];render();
  const needsTimes=(key==='wishAnswer'&&value==='custom')||(key==='blockAnswer'&&value==='yes')||(key==='standby'&&value==='yes');
  if(!needsTimes)advance();
 });
 document.querySelectorAll('[data-slot-key]').forEach(e=>e.onchange=()=>{dirty=true;const list=e.dataset.slotKey==='standby'?state.standby.slots:state[e.dataset.slotKey];list[Number(e.dataset.slotIndex)][e.dataset.slotField]=e.value===''?null:Number(e.value);if(e.dataset.slotField==='start'){const end=document.querySelector(`[data-slot-key="${e.dataset.slotKey}"][data-slot-index="${e.dataset.slotIndex}"][data-slot-field="end"]`);end.innerHTML=timeOptions(list[Number(e.dataset.slotIndex)].end,'end',e.dataset.slotKey,Number(e.dataset.slotIndex),list[Number(e.dataset.slotIndex)]);}updateSummary()});
 document.querySelectorAll('[data-reserve-index]').forEach(e=>e.onchange=()=>{dirty=true;state.can[Number(e.dataset.reserveIndex)].wishType=e.checked?'if_needed':'available';state.status=state.can.every(w=>w.wishType==='if_needed')?'reserve':'yes';render()});
 document.querySelectorAll('[data-other-time]').forEach(b=>b.onclick=()=>{const key=b.dataset.otherTime;expandedTimes.has(key)?expandedTimes.delete(key):expandedTimes.add(key);render()});
 document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{dirty=true;const key=b.dataset.add,list=key==='standby'?state.standby.slots:state[key];list.push({start:null,end:null,wishType:key==='can'?(state.status==='reserve'?'if_needed':'available'):key==='pref'?'preferred':'unavailable',wishZone:state.zone});render()});
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{dirty=true;const key=b.dataset.remove,list=key==='standby'?state.standby.slots:state[key];list.splice(Number(b.dataset.index),1);render()});
 document.querySelectorAll('[data-offdate]').forEach(e=>e.onchange=()=>{dirty=true;state.offDates=e.checked?[...new Set([...state.offDates,e.dataset.offdate])]:state.offDates.filter(d=>d!==e.dataset.offdate)});
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{step=b.dataset.edit;render()});
 if($('waWhole'))$('waWhole').onclick=()=>{dirty=true;state.can=[{start:day().start,end:day().end,wishType:state.status==='reserve'?'if_needed':'available',wishZone:state.zone}];render()};
 if($('waPrevious'))$('waPrevious').onclick=()=>{const prev=K.days[K.days.findIndex(d=>d.date===state.date)-1],rows=prev?M().rows(owner,prev.date).filter(w=>['available','if_needed'].includes(w.wishType)):[];if(!rows.length)return error('Am vorherigen Tag sind noch keine Kann-Zeiten eingetragen.');dirty=true;state.can=rows.map(w=>({start:w.start,end:w.end,wishType:state.status==='reserve'?'if_needed':'available',wishZone:w.wishZone}));render()};
 if($('waStandbyWhole'))$('waStandbyWhole').onclick=()=>{dirty=true;state.standby.slots=[{start:day().start,end:day().end}];render()};
 if($('waNote'))$('waNote').oninput=e=>{dirty=true;state.applyNote=true;state.note=e.target.value;updateSummary()};
 if($('waFriend'))$('waFriend').onchange=e=>{const id=e.target.value,rows=M().rows(id,state.date),can=rows.filter(w=>['available','if_needed'].includes(w.wishType));$('waFriendPreview').innerHTML=id?`<h2>${esc(K.person(id)?.name)}</h2>${K.mobileMatrixUi.summary(rows)}<p>Übernommen werden Kann- und Wunschzeiten. Deine Sperren und Bereitschaft beantwortest du selbst.</p><button type="button" class="ux-btn secondary" id="waUseFriend" ${can.length?'':'disabled'}>Diese Kann- und Wunschzeiten verwenden</button>`:'';if($('waUseFriend'))$('waUseFriend').onclick=()=>{dirty=true;const copy=w=>({start:w.start,end:w.end,wishType:w.wishType,wishZone:w.wishZone||'B',sourcePersonId:id,sourceWishId:w.id});state.can=can.map(copy);state.pref=rows.filter(w=>w.wishType==='preferred').map(copy);state.status=state.can.every(w=>w.wishType==='if_needed')?'reserve':'yes';state.wishAnswer=state.pref.length?'custom':null;render()};};
}
function error(text){$('waError').className='ux-warningbox';$('waError').textContent=text;$('waError').focus();}
function advance(){
 if(busy)return;
 if(!editable()||self()!==owner)return error('Die Anmeldung oder Wunschphase hat sich geändert. Bitte erneut öffnen.');
 if(step==='availability'&&!state.status)return error('Bitte eine Antwort auswählen.');
 const list=step==='can'?state.can:step==='wish'&&state.wishAnswer==='custom'?state.pref:step==='blocks'&&state.blockAnswer==='yes'?state.blocks:step==='standby'&&state.standby.answer==='yes'?state.standby.slots:null;
 if(list&&(!list.length||list.some(w=>!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.end<=w.start)))return error('Bitte Von und Bis auswählen. Das Ende muss nach dem Beginn liegen.');
 if(step==='wish'&&!state.wishAnswer||step==='blocks'&&!state.blockAnswer||step==='standby'&&!state.standby.answer)return error('Bitte eine Antwort auswählen.');
 if(step==='review')return save();
 const seq=sequence();step=seq[seq.indexOf(step)+1];render();
}
async function save(){
 if(state.status==='unknown')return start('Der Tag bleibt offen. Bisherige Angaben wurden nicht verändert.');
 const errors=errorsFor(state);if(errors.length)return error(errors.join(' '));
 busy=true;document.querySelectorAll('.wa-root button').forEach(b=>b.disabled=true);
 try{
  const dates=state.status==='no'?state.offDates:[state.date],rows=rowsFor(state),baseline=dates.length===1&&dates[0]===state.date?expected:JSON.stringify(originalAll.filter(w=>dates.includes(w.date)));
  await M().save(owner,dates,rows,baseline,{reviewedDemand:true});dirty=false;
  const next=K.days[K.days.findIndex(d=>d.date===state.date)+1],pending=K.sync?.snapshot?.()?.outbox?.filter(x=>x.status!=='sent').length;
  step='done';shell(`<section class="wa-question wa-done"><span class="wa-eyebrow">GESCHAFFT</span><h1>Deine Angaben sind gespeichert.</h1><p>${dates.length===1?dt(state.date):dates.length+' Tage'}</p>${K.mobileMatrixUi.summary(rows)}<p>${esc(standbyText(rows[0]?.assistantDay?.standby))}</p><p>${pending?'Die Übertragung zum gemeinsamen Wunschplan steht noch aus. Sie läuft über die normale Synchronisierung.':'Die Angaben wurden im Programm gespeichert. Der Verbindungsstatus zeigt die Übertragung zum gemeinsamen Wunschplan.'}</p><div class="wa-actions">${next?'<button class="ux-btn primary" id="waNextDay">Nächsten Tag ausfüllen</button>':''}<button class="ux-btn primary" id="waFinish">Fertig? Meine Auswertung</button><button class="ux-btn secondary" id="waAgain">Diesen Tag noch einmal ändern</button><button class="ux-btn secondary" id="waDone">Anderen Tag auswählen</button></div></section>`);
  if($('waNextDay'))$('waNextDay').onclick=()=>open(next.date);$('waAgain').onclick=()=>open(state.date);$('waDone').onclick=()=>start();$('waFinish').onclick=()=>K.chefCompanion.finish();
 }catch(e){error(e.message);document.querySelectorAll('.wa-root button').forEach(b=>b.disabled=false);}finally{busy=false;}
}
document.addEventListener('click',e=>{if(!document.querySelector('.wa-root #waCancel')||!e.target.closest?.('[data-nav],#uxUserMenu'))return;if(busy||(dirty&&!confirm('Ungespeicherte Angaben verwerfen und die Seite verlassen?'))){e.preventDefault();e.stopImmediatePropagation();}else dirty=false;},true);
K.wishAssistant={openSuggestion(g){open(g.date);state.pref.push({start:g.start,end:g.end,wishType:"preferred",wishZone:g.zone==="front"?"V":g.zone==="back"?"H":"B"});state.wishAnswer="custom";dirty=true;step="review";render();},start,open,rowsFor,errorsFor,standbyFor,standbyText,standbyHtml};
})();
