(function(){
'use strict';
const K=window.KCDP,detail=K.wishAssistant,M=()=>K.mobileWishMatrix,$=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tm=h=>Number.isFinite(h)?String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round(h%1*60)).padStart(2,'0'):'';
const zlabel=z=>({V:'Vorne',H:'Hinten',B:'Beides',front:'Vorne',back:'Hinten',total:'Gesamt'}[z]||z);
const valid=r=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.start>=0&&r.end<=24&&r.end>r.start;
const active=r=>!['deleted','cancelled','failed','absent'].includes(r.status);
const overlap=(a,b)=>a.start<b.end&&a.end>b.start;
const dateLabel=d=>new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long'}).format(new Date(d+'T12:00:00'));
let owner=null,date=null,stored=[],baseline='',blocks=[],times=[],blockMode='none',step='days',dirty=false,busy=false,accepted='',alternativeIndex=0;
const self=()=>K.currentUser?.personId,day=()=>K.days.find(d=>d.date===date);
function editable(){try{M().assertEditable(owner);return owner===self();}catch{return false;}}
function shell(html,tip){
 K.roleUx.matrixShell('<main class="wa-root sw-root">'+K.chefCompanion.helper(tip)+'<section class="wa-question">'+html+'</section></main>');
 K.chefCompanion.wireQuiet();K.twinkey?.bind(tip,'guided-'+(date||'days')+'-'+step);window.scrollTo({top:0,behavior:'instant'});
}
function start(message=''){
 owner=self();date=null;step='days';dirty=false;busy=false;
 shell('<h1>Wähle deinen Tag</h1>'+(message?'<p role="status" class="ux-goodbox">'+esc(message)+'</p>':'')+
 '<div class="wa-daygrid">'+K.days.map(d=>'<button class="wa-day" data-day="'+d.date+'"><b>'+dateLabel(d.date)+'</b><span>'+(M().rows(owner,d.date).some(w=>w.scope==='day'&&w.wishType==='unavailable')?'Tag gesperrt':M().rows(owner,d.date).length?'✓ Angaben vorhanden':'Noch offen')+'</span></button>').join('')+'</div><button class="ux-btn secondary" id="swExit">Zurück</button>',
 'Wähle einen Tag. Wir prüfen zuerst deine Sperren und danach deine Wunschzeiten.');
 document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>open(b.dataset.day));$('swExit').onclick=()=>K.roleUx.openTimes();
}
function open(value){
 owner=self();date=value;stored=clone(M().rows(owner,date));baseline=JSON.stringify(stored);
 blocks=stored.filter(w=>w.wishType==='unavailable'&&w.scope!=='day').map(w=>({start:w.start,end:w.end}));
 blockMode=stored.some(w=>w.wishType==='unavailable'&&w.scope==='day')?'day':blocks.length?'time':'none';
 const prefs=stored.filter(w=>w.wishType==='preferred');
 times=stored.filter(w=>w.wishType==='preferred'||w.wishType==='if_needed'||w.wishType==='available'&&!prefs.some(p=>p.start===w.start&&p.end===w.end)).map(w=>({start:w.start,end:w.end,wishZone:w.wishZone||'B',only:w.wishType!=='preferred',reserve:w.wishType==='if_needed'}));
 if(!times.length)times=[{start:null,end:null,wishZone:'B',only:false}];
 step='blocks';dirty=false;busy=false;accepted='';render();
}
function record(r,type,scope='time'){
 const old=stored.find(w=>w.wishType===type&&(w.scope||'time')===scope&&w.start===r.start&&w.end===r.end&&(w.wishZone||'B')===(r.wishZone||'B'));
 return {...(old||{}),id:old?.id||'',personId:owner,date,start:r.start,end:r.end,wishType:type,wishZone:r.wishZone||'B',scope,status:'confirmed',source:old?.source||'guided_assistant',comment:old?.comment||'',...(stored[0]?.assistantDay?{assistantDay:clone(stored[0].assistantDay)}:{})};
}
function rows(){
 if(blockMode==='day')return [record({start:day().start,end:day().end,wishZone:'B'},'unavailable','day')];
 const out=blockMode==='time'?blocks.map(b=>record({...b,wishZone:'B'},'unavailable')):[];
 for(const t of times){out.push(record(t,t.reserve?'if_needed':'available'));if(!t.only&&!t.reserve)out.push(record(t,'preferred'));}
 return out.filter((r,i,a)=>a.findIndex(x=>x.start===r.start&&x.end===r.end&&x.wishType===r.wishType&&x.wishZone===r.wishZone&&x.scope===r.scope)===i);
}
function blockErrors(){return blockMode==='time'&&(!blocks.length||blocks.some(b=>!valid(b)))?['Bitte jede Sperrzeit vollständig mit gültigem Beginn und Ende eintragen.']:[];}
function timeErrors(){
 if(blockMode==='day')return [];
 const errors=blockErrors();
 if(!times.length||times.some(t=>!valid(t)))errors.push('Bitte für jeden Zeitraum gültige Von- und Bis-Zeiten eingeben.');
 for(const t of times.filter(valid)){
  const b=blockMode==='time'&&blocks.find(b=>valid(b)&&overlap(t,b));
  if(b)errors.push('Du hast '+tm(b.start)+'–'+tm(b.end)+' Uhr gesperrt. Bitte passe deine Zeit oder die Sperre an.');
  if((K.shifts||[]).some(s=>active(s)&&s.layer==='planned'&&s.personId===owner&&s.date===date&&overlap(s,t)))errors.push('Für '+tm(t.start)+'–'+tm(t.end)+' Uhr hast du bereits einen geplanten Dienst.');
 }
 if(!errors.length)errors.push(...M().validate(rows()));
 return [...new Set(errors)];
}
function coverage(){
 if(blockMode==='day')return [];
 const result=[],all=K.assistantStaffing.overview(date,rows().filter(r=>r.wishType!=='preferred'));
 times.forEach((t,index)=>{if(t.only||t.reserve||!valid(t))return;
  for(const p of all){if(!overlap(t,p))continue;
   const key=t.wishZone==='V'?'front':t.wishZone==='H'?'back':'total';
   const selected=key==='total'?p.areas:p.areas.filter(a=>a.zone===key);
   const needed=selected.length&&selected.every(a=>Number.isFinite(a.needed))?selected.reduce((n,a)=>n+a.needed,0):null;
   const count=selected.reduce((n,a)=>n+a.count,0)+(key==='total'?p.flexible.length:0);
   const start=Math.max(t.start,p.start),end=Math.min(t.end,p.end),status=needed===null?'unknown':count>=needed?'full':'gap';
   const prev=result.at(-1),people=JSON.stringify(selected.flatMap(a=>a.people.map(x=>[x.personId,x.kind])));
   if(prev&&prev.index===index&&prev.end===start&&prev.count===count&&prev.needed===needed&&prev.people===people)prev.end=end;
   else result.push({index,start,end,wishZone:t.wishZone,status,count,needed,people});
  }
 });
 return result;
}
const fingerprint=()=>JSON.stringify(coverage());
function acceptOrCheck(){
 const errors=timeErrors();if(errors.length)return error(errors.join(' '));
 step='check';render();
}
function alternatives(index){
 const t=times[index];if(!t)return [];
 const base=rows().filter(r=>r.wishType!=='preferred');
 // Consider other time windows explicitly; choosing one is an affirmative new availability.
 const probe=base.filter(r=>r.wishType==='unavailable').concat(base.filter(r=>['available','if_needed'].includes(r.wishType)));
 return K.assistantStaffing.suggestions(date,probe,Infinity,true)
  .filter(g=>!(g.start===t.start&&g.end===t.end&&g.wishZone===t.wishZone)&&!times.some((other,i)=>i!==index&&valid(other)&&overlap(other,g)))
  .sort((a,b)=>Number(!(a.start===t.start&&a.end===t.end))-Number(!(b.start===t.start&&b.end===t.end))||Math.abs(a.start-t.start)-Math.abs(b.start-t.start)||Math.abs((a.end-a.start)-(t.end-t.start))-Math.abs((b.end-b.start)-(t.end-t.start)))
  .slice(0,3);
}
function timeFields(r,i,kind,disabled=false){return '<div class="wa-timepair"><label>Von<input type="time" step="900" data-list="'+kind+'" data-i="'+i+'" data-field="start" value="'+tm(r.start)+'" '+(disabled?'disabled':'')+'></label><label>Bis<input type="time" step="900" data-list="'+kind+'" data-i="'+i+'" data-field="end" value="'+tm(r.end)+'" '+(disabled?'disabled':'')+'></label></div>';}
function team(){
 const parts=K.assistantStaffing.overview(date,stored);
 return '<div id="swTeam" hidden><p>Aktuell geladener Stand · gespeicherte Wünsche und geplante Dienste getrennt.</p>'+parts.map(p=>'<article class="sw-covered"><b>'+tm(p.start)+'–'+tm(p.end)+' Uhr</b>'+p.areas.map(a=>'<p><b>'+zlabel(a.zone)+'</b> · Bedarf '+(a.needed??'unbekannt')+' · '+a.planned+' geplant · '+a.wishes+' Wünsche<br>'+a.people.map(x=>esc(K.person(x.personId)?.pseudoName||K.person(x.personId)?.name||x.personId)+' · '+x.records.map(r=>tm(r.start)+'–'+tm(r.end)).join(', ')+' ('+(x.kind==='planned'?'geplant':'Wunsch')+')').join('<br>')+'</p>').join('')+(p.flexible.length?'<p>Bereich offen: '+p.flexible.map(x=>esc(K.person(x.personId)?.name||x.personId)+' ('+(x.kind==='planned'?'geplant':'Wunsch')+')').join(', ')+'</p>':'')+'</article>').join('')+'</div>';
}
function render(){
 const titles={blocks:'Zuerst: Gibt es Sperren?',times:'Wann möchtest du helfen?',check:'So passt deine Wunschzeit',alternatives:'Hier wird noch Hilfe gebraucht',review:'Prüfen und abgeben'};
 let html='<span class="wa-eyebrow">ZEITEN EINTRAGEN</span><h1>'+titles[step]+'</h1><p>'+dateLabel(date)+'</p>';
 if(step==='blocks'){
  html+='<label class="sw-check"><input type="checkbox" id="swDayBlock" '+(blockMode==='day'?'checked':'')+'>Ganzer Tag gesperrt</label><label class="sw-check"><input type="checkbox" id="swTimeBlock" '+(blockMode==='time'?'checked':'')+' '+(blockMode==='day'?'disabled':'')+'>Bestimmte Zeiten gesperrt</label>';
  if(blockMode==='none')html+='<p>✓ Keine Sperre. Mit Weiter gelangst du zu deinen Zeiten.</p>';
  if(blockMode==='time')html+=blocks.map((b,i)=>'<div class="wa-slot">'+timeFields(b,i,'blocks')+'<button type="button" class="wa-remove" data-remove-block="'+i+'">Sperrzeit entfernen</button></div>').join('')+'<button class="ux-btn secondary" id="swAddBlock">Weitere Sperrzeit</button>';
  if(blockMode==='day')html+='<p>Dieser Tag wird vollständig gesperrt. Zeit- und Bereichseingaben sind deaktiviert.</p><fieldset disabled class="sw-disabled">'+timeFields({start:day().start,end:day().end},0,'disabled',true)+'<label>Bereich<select disabled><option>Keine Einteilung</option></select></label></fieldset>';
 }else if(step==='times'){
  html+='<p>'+(blockMode==='time'?'Gesperrt: '+blocks.map(b=>tm(b.start)+'–'+tm(b.end)).join(', ')+' Uhr':'Keine Sperren für diesen Tag.')+' <button class="ux-btn secondary" id="swEditBlocks">Sperren ändern</button></p>';
  html+=times.map((t,i)=>'<div class="wa-slot"><b>Zeitraum '+(i+1)+'</b>'+timeFields(t,i,'times')+'<label>Bereich<select data-zone="'+i+'">'+['B','V','H'].map(z=>'<option value="'+z+'" '+(t.wishZone===z?'selected':'')+'>'+zlabel(z)+'</option>').join('')+'</select></label><label class="sw-check"><input type="checkbox" data-only="'+i+'" '+(t.only?'checked':'')+' '+(t.reserve?'disabled':'')+'>Nur möglich, kein fester Wunsch</label>'+(t.reserve?'<p>Als „nur wenn nötig“ gespeichert.</p>':'')+'<p data-time-error="'+i+'" role="status"></p>'+(times.length>1?'<button class="wa-remove" data-remove-time="'+i+'">Zeitraum entfernen</button>':'')+'</div>').join('')+'<button class="ux-btn secondary" id="swAddTime">Weitere Zeit für diesen Tag</button>';
 }else if(step==='check'){
  const c=coverage(),full=c.filter(p=>p.status==='full');
  html+=c.map(p=>'<p class="'+(p.status==='full'?'ux-warningbox':'ux-goodbox')+'"><b>'+tm(p.start)+'–'+tm(p.end)+' · '+zlabel(p.wishZone)+'</b><br>'+(p.status==='full'?'Bedarf bereits gedeckt ('+p.count+' von '+p.needed+' eingetragen).':p.status==='gap'?'Hier fehlen noch '+(p.needed-p.count)+' Personen.':'Bedarf noch nicht eindeutig hinterlegt.')+'</p>').join('')||'<p>Deine Zeiten werden als mögliche Verfügbarkeit eingetragen.</p>';
  html+='<p>Die Prüfung berücksichtigt geplante Dienste und andere Wünsche. Wünsche sind noch keine feste Einteilung.</p>';
  if(full.length)html+='<p><b>Möchtest du deinen Wunsch trotzdem eintragen?</b></p><button class="ux-btn primary" id="swKeep">Ja, Wunsch behalten</button><button class="ux-btn secondary" id="swAlternatives">Andere Möglichkeit zeigen</button>';
 }else if(step==='alternatives'){
  const options=alternatives(alternativeIndex),t=times[alternativeIndex];
  html+='<p>Für '+tm(t.start)+'–'+tm(t.end)+' Uhr · '+zlabel(t.wishZone)+'.</p><p>Ein Klick ersetzt diesen Wunschzeitraum durch die angebotene Zeit und den Bereich. Andere Zeitfenster wählst du damit ausdrücklich als verfügbar.</p>';
  html+=options.length?options.map((g,i)=>'<button class="sw-card" data-alt="'+i+'"><b>'+tm(g.start)+'–'+tm(g.end)+' · '+zlabel(g.wishZone)+'</b><span>'+g.missing+' gesucht</span><strong>Als eigene Zeit übernehmen</strong></button>').join(''):'<p>Keine passende freie Alternative gefunden. Du kannst eine eigene Zeit eingeben oder deinen Wunsch behalten.</p>';
  html+='<button class="ux-btn secondary" id="swOwn">Eigene Zeit ändern</button>';
 }else{
  html+=K.mobileMatrixUi.summary(rows())+'<p>Erst mit „Angaben speichern“ werden deine Änderungen gespeichert.</p>';
  if(blockMode==='day'&&stored.some(w=>w.wishType!=='unavailable'))html+='<p class="ux-warningbox">Die Tagessperre ersetzt deine bisherigen Zeitangaben für diesen Tag.</p>';
 }
 html+='<div id="swError" role="alert"></div><button class="ux-btn secondary" id="swTeamToggle" aria-expanded="false" aria-controls="swTeam">Bisherige Besetzung anzeigen</button>'+team()+'<div class="wa-actions"><button class="ux-btn secondary" id="swBack">Zurück</button>'+(!(step==='check'&&coverage().some(p=>p.status==='full'))&&step!=='alternatives'?'<button class="ux-btn primary" id="swNext">'+(step==='review'?'Angaben speichern':step==='blocks'&&blockMode==='day'?'Sperrtag übernehmen':'Weiter')+'</button>':'')+'</div>';
 shell(html,{blocks:'Zuerst prüfen wir deine Sperren. Danach trägst du deine Zeiten ein.',times:'Gib deine eigene Zeit ein. Weitere Zeiträume kannst du ergänzen.',check:'Prüfe die Besetzung. Auch bei gedecktem Bedarf kannst du deinen Wunsch behalten.',alternatives:'Wähle eine Alternative. Zeit und Bereich werden direkt übernommen.',review:'Prüfe deine Angaben. Erst mit Speichern werden sie abgegeben.'}[step]);
 bind();
}
function error(msg){$('swError').textContent=msg;$('swError').className='ux-warningbox';}
function changed(){dirty=true;accepted='';}
function bind(){
 $('swTeamToggle').onclick=()=>{const el=$('swTeam');el.hidden=!el.hidden;$('swTeamToggle').setAttribute('aria-expanded',String(!el.hidden));};
 if($('swDayBlock'))$('swDayBlock').onchange=e=>{blockMode=e.target.checked?'day':blocks.length?'time':'none';changed();render();};
 if($('swTimeBlock'))$('swTimeBlock').onchange=e=>{blockMode=e.target.checked?'time':'none';if(blockMode==='time'&&!blocks.length)blocks.push({start:null,end:null});changed();render();};
 if($('swAddBlock'))$('swAddBlock').onclick=()=>{blocks.push({start:null,end:null});changed();render();};
 document.querySelectorAll('[data-remove-block]').forEach(b=>b.onclick=()=>{blocks.splice(Number(b.dataset.removeBlock),1);if(!blocks.length)blockMode='none';changed();render();});
 document.querySelectorAll('[data-list]').forEach(e=>e.onchange=()=>{const list=e.dataset.list==='blocks'?blocks:times,r=list[Number(e.dataset.i)];if(!r)return;const v=e.value.split(':');r[e.dataset.field]=e.value?Number(v[0])+Number(v[1])/60:null;changed();if(step==='times'){const b=blockMode==='time'&&blocks.find(b=>valid(b)&&valid(r)&&overlap(b,r)),el=document.querySelector('[data-time-error="'+e.dataset.i+'"]');el.textContent=b?'Du hast '+tm(b.start)+'–'+tm(b.end)+' Uhr gesperrt. Bitte Zeit oder Sperre ändern.':'';el.className=b?'ux-warningbox':'';}});
 document.querySelectorAll('[data-zone]').forEach(e=>e.onchange=()=>{times[Number(e.dataset.zone)].wishZone=e.value;changed();});
 document.querySelectorAll('[data-only]').forEach(e=>e.onchange=()=>{times[Number(e.dataset.only)].only=e.target.checked;changed();});
 if($('swEditBlocks'))$('swEditBlocks').onclick=()=>{step='blocks';render();};
 if($('swAddTime'))$('swAddTime').onclick=()=>{times.push({start:null,end:null,wishZone:'B',only:false});changed();render();};
 document.querySelectorAll('[data-remove-time]').forEach(b=>b.onclick=()=>{times.splice(Number(b.dataset.removeTime),1);changed();render();});
 if($('swKeep'))$('swKeep').onclick=()=>{accepted=fingerprint();step='review';render();};
 if($('swAlternatives'))$('swAlternatives').onclick=()=>{alternativeIndex=coverage().find(p=>p.status==='full').index;step='alternatives';render();};
 if($('swOwn'))$('swOwn').onclick=()=>{step='times';render();};
 const offers=step==='alternatives'?alternatives(alternativeIndex):[];
 document.querySelectorAll('[data-alt]').forEach(b=>b.onclick=()=>{
  if(!editable())return error('Die Anmeldung oder Wunschphase hat sich geändert.');
  const g=offers[Number(b.dataset.alt)],fresh=alternatives(alternativeIndex).find(x=>x.start===g.start&&x.end===g.end&&x.wishZone===g.wishZone);
  if(!fresh)return error('Diese Alternative ist nicht mehr frei. Bitte erneut prüfen.');
  times[alternativeIndex]={start:g.start,end:g.end,wishZone:g.wishZone,only:false};changed();acceptOrCheck();
 });
 $('swBack').onclick=()=>{if(busy)return;if(step==='blocks'){if(!dirty||confirm('Ungespeicherte Angaben verwerfen?'))start();}else{step=step==='times'?'blocks':step==='review'&&blockMode==='day'?'blocks':'times';render();}};
 if($('swNext'))$('swNext').onclick=()=>{
  if(busy)return;if(!editable())return error('Die Anmeldung oder Wunschphase hat sich geändert.');
  if(step==='blocks'){const errors=blockErrors();if(errors.length)return error(errors.join(' '));step=blockMode==='day'?'review':'times';render();}
  else if(step==='times')acceptOrCheck();
  else if(step==='check'){accepted=fingerprint();step='review';render();}
  else save();
 };
}
async function save(){
 if(!editable())return error('Die Anmeldung oder Wunschphase hat sich geändert.');
 const errors=timeErrors();if(errors.length)return error(errors.join(' '));
 if(blockMode!=='day'&&coverage().some(p=>p.status==='full')&&accepted!==fingerprint()){step='check';render();return error('Die Besetzung hat sich geändert. Bitte erneut entscheiden.');}
 busy=true;$('swNext').disabled=true;
 try{await M().save(owner,[date],rows(),baseline,{reviewedDemand:true});busy=false;start('Deine Angaben sind gespeichert.');}catch(e){busy=false;error(e.message);$('swNext').disabled=false;}
}
document.addEventListener('click',e=>{if(!document.querySelector('.sw-root')||!e.target.closest?.('[data-nav],#uxUserMenu'))return;if(busy||(dirty&&!confirm('Ungespeicherte Angaben verwerfen?'))){e.preventDefault();e.stopImmediatePropagation();}else dirty=false;},true);
K.simpleWishAssistant={start,open};K.wishAssistant={...detail,start,open};
})();

