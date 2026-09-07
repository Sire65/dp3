(function(){
'use strict';
const K=window.KCDP,detail=K.wishAssistant,M=()=>K.mobileWishMatrix,$=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tm=h=>String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round(h%1*60)).padStart(2,'0'),zone=z=>({V:'Vorne',H:'Hinten',B:'Beides',front:'Vorne',back:'Hinten',total:'Gesamter Bereich'}[z]||z);
const dateText=date=>new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long'}).format(new Date(date+'T12:00:00'));
let date=null,draft=[],baseline='',owner=null,mode='cards',dirty=false,busy=false,limit=3,lastPick=null;
const valid=r=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.end>r.start;
const own=()=>K.currentUser?.personId;
function editable(){try{M().assertEditable(owner||own());return true;}catch{return false;}}
function shell(content,tip){
 K.roleUx.matrixShell('<main class="wa-root sw-root">'+K.chefCompanion.helper(tip)+'<section class="wa-question">'+content+'</section></main>');
 K.chefCompanion.wireQuiet();K.twinkey?.bind(tip,'simple-'+(date||'days')+'-'+mode);
 window.scrollTo({top:0,behavior:'instant'});
}
function heading(title){return '<div class="wa-heading"><div><span class="wa-eyebrow">ZEITEN EINTRAGEN</span><h1>'+title+'</h1>'+(date?'<p>'+dateText(date)+'</p>':'')+'</div></div>';}
function start(message=''){
 owner=own();date=null;dirty=false;mode='cards';
 shell(heading('Wähle deinen Tag')+(message?'<p class="ux-goodbox" role="status">'+esc(message)+'</p>':'')+
 '<div class="wa-daygrid">'+K.days.map(d=>{const rows=M().rows(owner,d.date);return '<button class="wa-day" data-day="'+d.date+'"><b>'+dateText(d.date)+'</b><span>'+ (rows.some(r=>r.wishType==='unavailable'&&r.scope==='day')?'Tag gesperrt':rows.length?'✓ Zeiten eingetragen':'Noch offen')+'</span></button>';}).join('')+'</div><button class="ux-btn secondary" id="swExit">Zurück</button>',
 'Wähle zuerst einen Tag. Danach zeige ich dir, wo noch Hilfe gebraucht wird.');
 document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>open(b.dataset.day));$('swExit').onclick=()=>K.roleUx.openTimes();
}
function open(value){
 owner=own();date=value;draft=JSON.parse(JSON.stringify(M().rows(owner,date)));baseline=JSON.stringify(draft);dirty=false;busy=false;limit=3;lastPick=null;mode=draft.length?'selected':'cards';render();
}
function offers(){return K.assistantStaffing.suggestions(date,draft,Infinity,true).sort((a,b)=>Number(b.replace)-Number(a.replace)||Number(a.needsCan)-Number(b.needsCan)||b.missing-a.missing||a.start-b.start);}
function needsHelpText(g){const p=K.assistantStaffing.overview(date,draft).find(p=>p.start===g.start&&p.end===g.end),a=p?.areas.find(a=>a.zone===(g.zone==='neutral'?'total':g.zone));return a?a.planned+' geplant · '+a.wishes+' Wünsche':'Aktuell geladener Stand';}
function offerButton(g,i){return '<button class="sw-card" data-offer="'+i+'"><b>'+tm(g.start)+'–'+tm(g.end)+' Uhr · '+zone(g.wishZone)+'</b><strong>'+g.missing+' '+(g.missing===1?'Platz frei':'Plätze frei')+'</strong><span>'+needsHelpText(g)+'</span><span class="sw-card-action">'+(g.replace?'Diesen Bereich wählen':'Diese Zeit wählen')+'</span></button>';}
function fullRows(){
 return K.assistantStaffing.overview(date,draft).flatMap(p=>p.areas.filter(a=>['full','over'].includes(a.status)).map(a=>'<p>'+tm(p.start)+'–'+tm(p.end)+' · '+zone(a.zone)+' · '+(a.status==='over'?'mehr Einträge als benötigt':'Bedarf gedeckt')+' <small>('+a.planned+' geplant · '+a.wishes+' Wünsche)</small></p>'));
}
function team(){return '<details class="sw-team"><summary>Wer ist schon dabei?</summary>'+K.assistantStaffing.overview(date,draft).map(p=>'<p><b>'+tm(p.start)+'–'+tm(p.end)+'</b><br>'+p.areas.map(a=>zone(a.zone)+': '+(a.people.length?a.people.map(x=>esc(K.person(x.personId)?.pseudoName||K.person(x.personId)?.name||x.personId)+' ('+(x.kind==='planned'?'geplant':'Wunsch')+')').join(', '):'noch niemand')).join('<br>')+(p.flexible.length?'<br>Bereich offen: '+p.flexible.map(x=>esc(K.person(x.personId)?.name||x.personId)).join(', '):'')+'</p>').join('')+'</details>';}
function recommendation(){
 const over=K.assistantStaffing.overview(date,draft).some(p=>p.areas.some(a=>Number.isFinite(a.needed)&&a.people.filter(x=>x.personId!==owner).length>=a.needed&&draft.some(r=>r.wishType==='preferred'&&r.start<p.end&&r.end>p.start&&(r.wishZone==='V'?'front':r.wishZone==='H'?'back':'total')===a.zone)));
 const g=offers()[0];return over?'<aside class="sw-alternative"><b>Für deine Wunschzeit ist der Bedarf bereits gedeckt.</b>'+(g?'<p>Hier könntest du noch helfen:</p>'+offerButton(g,0):'<p>Aktuell ist keine passende freie Alternative hinterlegt. Deine eigene Zeit kann trotzdem eingetragen werden.</p>')+'</aside>':'';
}
function render(){
 const options=offers(),blocked=draft.some(r=>r.wishType==='unavailable'&&r.scope==='day');
 let html=heading(mode==='cards'?'Wann möchtest du helfen?':mode==='own'?'Deine eigene Zeit':mode==='review'?'Prüfen und abgeben':'Deine Auswahl');
 if(mode==='cards'){
  const full=fullRows();
  html+='<div class="sw-switch"><b>Passende Zeit wählen</b><button class="ux-btn secondary" id="swOwn">Eigene Zeit eingeben</button></div><h2>Hier wird noch Hilfe gebraucht</h2>'+
   (options.length?'<div class="sw-cards">'+options.slice(0,limit).map(offerButton).join('')+'</div>':'<p>'+(blocked?'Dieser Tag ist für dich gesperrt. Unter „Weitere Angaben“ kannst du die Sperre ändern.':'Aktuell gibt es keinen passenden freien Vorschlag. Du kannst deine eigene Zeit angeben.')+'</p>')+
   (options.length>limit?'<button class="ux-btn secondary" id="swMore">Weitere Zeiten zeigen</button>':'')+
   (full.length?'<div class="sw-covered"><b>Bereits ausreichend eingetragen</b>'+full.slice(0,2).join('')+(full.length>2?'<details><summary>Weitere gedeckte Zeiten</summary>'+full.slice(2).join('')+'</details>':'')+'</div>':'')+team();
 }else if(mode==='own'){
  html+='<div class="wa-timepair"><label>Von<input id="swFrom" type="time" step="900"></label><label>Bis<input id="swTo" type="time" step="900"></label></div><label>Bereich<select id="swZone"><option value="B">Beides</option><option value="V">Vorne</option><option value="H">Hinten</option></select></label><label class="sw-check"><input type="checkbox" id="swPossible">Nur möglich, kein fester Wunsch</label><button class="ux-btn primary" id="swUseOwn">Diese Zeit übernehmen</button>';
 }else{
  html+=K.mobileMatrixUi.summary(draft);
  if(dirty)html+='<p class="sw-draft">✓ Übernommen · noch nicht gespeichert</p>';
  if(mode==='selected'){
   if(lastPick)html+='<label class="sw-check"><input type="checkbox" id="swOnly" '+(lastPick.only?'checked':'')+'>Nur möglich, kein fester Wunsch</label>';
   html+=recommendation()+'<div class="sw-secondary"><button class="ux-btn secondary" id="swCards">Weitere Zeit wählen</button><button class="ux-btn secondary" id="swOwn">Eigene Zeit eingeben</button></div>';
  }
  html+='<p>Die verbindliche Einteilung macht der Planer.</p>';
 }
 html+='<div id="swInline" role="status"></div><div id="swError" role="alert"></div><details class="sw-extra"><summary>Weitere Angaben</summary><button class="ux-btn secondary" id="swAdvanced">Sperrzeiten, Bereitschaft oder Angaben bearbeiten</button><button class="ux-btn secondary" id="swOff">Diesen Tag sperren</button></details><div class="wa-actions"><button class="ux-btn secondary" id="swBack">Zurück</button>'+(['selected','review'].includes(mode)?'<button class="ux-btn primary" id="swNext">'+(mode==='review'?'Angaben abgeben':'Weiter')+'</button>':'')+'</div>';
 shell(html,mode==='cards'?'Freie Plätze stehen oben. Wähle eine Zeit oder gib deine eigenen Uhrzeiten ein.':mode==='own'?'Trage deine Uhrzeiten ein. Ich zeige dir danach bei Bedarf eine freie Alternative.':mode==='review'?'Prüfe deine Angaben. Erst mit Abgeben werden sie gespeichert.':'Deine Auswahl ist übernommen. Du kannst weitergehen oder noch eine Zeit ergänzen.');
 document.querySelectorAll('[data-offer]').forEach(b=>b.onclick=()=>pick(options[Number(b.dataset.offer)]));
 if($('swOwn'))$('swOwn').onclick=()=>{mode='own';render();};
 if($('swCards'))$('swCards').onclick=()=>{mode='cards';render();};
 if($('swMore'))$('swMore').onclick=()=>{limit+=3;render();};
 if($('swUseOwn'))$('swUseOwn').onclick=()=>{
  const parse=id=>{const v=$(id).value;if(!v)return NaN;const [h,m]=v.split(':').map(Number);return h+m/60;};
  const g={date,start:parse('swFrom'),end:parse('swTo'),wishZone:$('swZone').value};
  if(!valid(g))return error('Bitte gültige Von- und Bis-Zeiten eingeben.');
  apply(g,$('swPossible').checked,false);
 };
 if($('swOnly'))$('swOnly').onchange=e=>{
  if(!editable())return error('Die Wunschphase ist nicht mehr offen.');
  const g=lastPick;draft=[...g.beforeToggle];
  if(!e.target.checked){const wish=make(g,'preferred');draft.push(wish);}g.only=e.target.checked;dirty=true;render();
 };
 $('swAdvanced').onclick=()=>{if(!editable())return error('Die Wunschphase ist geschlossen.');detail.openDraft(date,draft);};
 $('swOff').onclick=()=>{if(!editable())return error('Die Wunschphase ist geschlossen.');if(draft.length&&!confirm('Vorhandene Angaben für diesen Tag durch eine Tagessperre ersetzen?'))return;const d=K.days.find(d=>d.date===date);draft=[{...make({date,start:d.start,end:d.end,wishZone:'B'},'unavailable'),scope:'day'}];dirty=true;lastPick=null;mode='review';render();};
 $('swBack').onclick=()=>{if(mode==='own'||mode==='review'){mode='selected';render();}else if(mode==='cards'&&draft.length){mode='selected';render();}else if(!dirty||confirm('Ungespeicherte Auswahl verwerfen?'))start();};
 if($('swNext'))$('swNext').onclick=()=>{if(mode==='review')save();else{mode='review';render();}};
}
function error(message){$('swError').textContent=message;$('swError').className='ux-warningbox';}
function make(g,type){return {id:'',personId:owner,date,start:g.start,end:g.end,wishZone:g.wishZone||'B',wishType:type,scope:'time',status:'confirmed',source:'guided_assistant',comment:''};}
function pick(g){
 if(!g||!editable()||owner!==own())return error('Die Auswahl ist nicht mehr verfügbar.');
 const fresh=offers().find(x=>x.start===g.start&&x.end===g.end&&x.wishZone===g.wishZone);
 if(!fresh)return error('Die Besetzung hat sich geändert. Bitte die Auswahl erneut öffnen.');
 if(fresh.needsCan&&draft.some(r=>r.wishType==='available'&&valid(r))){
  $('swInline').innerHTML='<p>Diese Zeit erweitert deine bisherige Verfügbarkeit.</p><button class="ux-btn primary" id="swConfirm">Ja, ich kann auch dann helfen</button><button class="ux-btn secondary" id="swCancelPick">Abbrechen</button>';
  $('swConfirm').onclick=()=>{const current=offers().find(x=>x.start===g.start&&x.end===g.end&&x.wishZone===g.wishZone);if(!current)return error('Die Besetzung hat sich geändert. Bitte erneut wählen.');apply(current,false,true);};
  $('swCancelPick').onclick=()=>{$('swInline').innerHTML='';};return;
 }
 apply(fresh,false,true);
}
function apply(g,only,replace){
 if(!editable()||owner!==own())return error('Die Wunschphase oder Anmeldung hat sich geändert.');
 if(draft.some(r=>['unavailable','if_needed'].includes(r.wishType)&&(r.scope==='day'||r.start<g.end&&r.end>g.start)))return error('Diese Zeit überschneidet sich mit einer Sperre oder „nur wenn nötig“. Bitte zuerst unter Weitere Angaben prüfen.');
 if((K.shifts||[]).some(r=>r.personId===owner&&r.date===date&&r.layer==='planned'&&!['deleted','cancelled','failed','absent'].includes(r.status)&&r.start<g.end&&r.end>g.start))return error('Hier hast du bereits einen geplanten Dienst.');
 const next=[];
 for(const r of draft){
  if(replace&&!only&&r.wishType==='preferred'&&r.start<g.end&&r.end>g.start){if(r.start<g.start)next.push({...r,end:g.start});if(r.end>g.end)next.push({...r,id:r.start<g.start?'':r.id,start:g.end});}else next.push({...r});
 }
 let cursor=g.start;for(const r of draft.filter(r=>r.wishType==='available').sort((a,b)=>a.start-b.start)){if(r.end<=cursor||r.start>=g.end)continue;if(r.start>cursor)next.push(make({...g,start:cursor,end:Math.min(g.end,r.start),wishZone:'B'},'available'));cursor=Math.max(cursor,r.end);}
 if(cursor<g.end)next.push(make({...g,start:cursor,wishZone:'B'},'available'));
 const added=!only&&!next.some(r=>r.wishType==='preferred'&&r.start===g.start&&r.end===g.end&&r.wishZone===g.wishZone)?make(g,'preferred'):null;
 if(added)next.push(added);
 const errors=M().validate(next);if(errors.length)return error(errors.join(' '));
 draft=next;lastPick=(added||only)&&!g.replace?{...g,only,wish:added}:null;
 // Object identity tracks only this new preference, never other unsaved rows with empty IDs.
 if(lastPick)lastPick.beforeToggle=draft.filter(r=>r!==added);
 dirty=true;mode='selected';render();
}
async function save(){
 if(busy)return;if(!editable()||owner!==own())return error('Die Anmeldung oder Wunschphase hat sich geändert.');
 busy=true;$('swNext').disabled=true;
 try{await M().save(owner,[date],draft,baseline,{reviewedDemand:true});busy=false;start('Deine Angaben sind gespeichert.');}catch(e){busy=false;error(e.message);$('swNext').disabled=false;}
}
document.addEventListener('click',e=>{if(!document.querySelector('.sw-root')||!e.target.closest?.('[data-nav],#uxUserMenu'))return;if(busy||(dirty&&!confirm('Ungespeicherte Auswahl verwerfen?'))){e.preventDefault();e.stopImmediatePropagation();}else dirty=false;},true);
K.simpleWishAssistant={start,open};
K.wishAssistant={...detail,start,open};
})();

