(function(){
'use strict';
const K=window.KCDP,detail=K.wishAssistant,M=()=>K.mobileWishMatrix,$=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tm=h=>Number.isFinite(h)?String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round(h%1*60)).padStart(2,'0'):'';
const zlabel=z=>({V:'Vorne',H:'Hinten',B:'Beides',Z:'Vorbereitung zuhause / außerhalb des Stands',special:'Vorbereitung außerhalb des Stands',front:'Vorne',back:'Hinten',total:'Gesamt'}[z]||z);
const valid=r=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.start>=0&&r.end<=24&&r.end>r.start;
const active=r=>!['deleted','cancelled','failed','absent'].includes(r.status);
const overlap=(a,b)=>a.start<b.end&&a.end>b.start;
const dateLabel=d=>new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long'}).format(new Date(d+'T12:00:00'));
let owner=null,date=null,stored=[],baseline='',blocks=[],can=[],times=[],blockMode='none',step='days',dirty=false,busy=false,accepted='',alternativeIndex=0,history=[],lastStep=null,standby={answer:null,slots:[]};
const self=()=>K.currentUser?.personId,day=()=>K.days.find(d=>d.date===date);
function editable(){try{M().assertEditable(owner);return owner===self();}catch{return false;}}
function shell(html,tip){
 K.roleUx.matrixShell('<main class="wa-root sw-root">'+K.chefCompanion.helper(tip)+'<section class="wa-question">'+html+'</section></main>');
 K.chefCompanion.wireQuiet();K.twinkey?.bind(tip,'guided-'+(date||'days')+'-'+step);window.scrollTo({top:0,behavior:'instant'});
}
function start(message=''){
 history=[];lastStep=null;owner=self();date=null;step='days';dirty=false;busy=false;
 shell('<h1>Wähle deinen Tag</h1>'+(message?'<p role="status" class="ux-goodbox">'+esc(message)+'</p>':'')+
 '<div class="wa-daygrid">'+K.days.map(d=>'<button class="wa-day" data-day="'+d.date+'"><b>'+dateLabel(d.date)+'</b>'+entrySummary(M().rows(owner,d.date))+'</button>').join('')+'</div><button class="ux-btn secondary" id="swExit">Zurück</button>',
 'Wähle einen Tag. Wir prüfen zuerst deine Sperren, dann deine Verfügbarkeit (Kann-Zeit) und deine bevorzugte Zeit (Wunschzeit).');
 document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>open(b.dataset.day));$('swExit').onclick=()=>K.roleUx.openTimes();
}
function open(value){
 history=[];lastStep=null;owner=self();date=value;stored=clone(M().rows(owner,date));baseline=JSON.stringify(stored);
 standby=clone(detail.standbyFor(owner,date));
 blocks=stored.filter(w=>w.wishType==='unavailable'&&w.scope!=='day').map(w=>({start:w.start,end:w.end}));
 blockMode=stored.some(w=>w.wishType==='unavailable'&&w.scope==='day')?'day':blocks.length?'time':'none';
 can=stored.filter(w=>['available','if_needed'].includes(w.wishType)).map(w=>({start:w.start,end:w.end,wishZone:w.wishZone||'B',reserve:w.wishType==='if_needed'}));
 times=stored.filter(w=>w.wishType==='preferred').map(w=>({start:w.start,end:w.end,wishZone:w.wishZone||'B'}));
 if(!can.length)can=[{start:day().start,end:day().end,wishZone:'B'}];
 step='blocks';dirty=false;busy=false;accepted='';render();
}
function record(r,type,scope='time'){
 const old=stored.find(w=>w.wishType===type&&(w.scope||'time')===scope&&w.start===r.start&&w.end===r.end&&(w.wishZone||'B')===(r.wishZone||'B'));
 return {...(old||{}),id:old?.id||'',personId:owner,date,start:r.start,end:r.end,wishType:type,wishZone:r.wishZone||'B',scope,status:'confirmed',source:old?.source||'guided_assistant',comment:old?.comment||'',...(stored[0]?.assistantDay?{assistantDay:clone(stored[0].assistantDay)}:{})};
}
function rows(){
 if(blockMode==='day')return [{...record({start:day().start,end:day().end,wishZone:'B'},'unavailable','day'),assistantDay:{standby:{answer:'no',slots:[]}}}];
 const out=blockMode==='time'?blocks.map(b=>record({...b,wishZone:'B'},'unavailable')):[];
 for(const t of can)out.push(record(t,t.reserve?'if_needed':'available'));
 for(const t of times)out.push(record(t,'preferred'));
 return out.map(r=>({...r,assistantDay:{...(r.assistantDay||{}),standby:clone(standby)}})).filter((r,i,a)=>a.findIndex(x=>x.start===r.start&&x.end===r.end&&x.wishType===r.wishType&&x.wishZone===r.wishZone&&x.scope===r.scope)===i);
}
function blockErrors(){return blockMode==='time'&&(!blocks.length||blocks.some(b=>!valid(b)))?['Bitte jede Sperrzeit vollständig mit gültigem Beginn und Ende eintragen.']:[];}
function timeErrors(){
 if(blockMode==='day')return [];
 const errors=canErrors();
 if(times.some(t=>!valid(t)))errors.push('Bitte für jeden Zeitraum gültige Von- und Bis-Zeiten eingeben.');
 for(const t of times.filter(valid)){
  const b=blockMode==='time'&&blocks.find(b=>valid(b)&&overlap(t,b));
  if(b)errors.push('Du hast '+tm(b.start)+'–'+tm(b.end)+' Uhr gesperrt. Bitte passe deine Zeit oder die Sperre an.');
 }
 if(!errors.length)errors.push(...M().validate(rows()));
 return [...new Set(errors)];
}
function coverage(){
 if(blockMode==='day')return [];
 const result=[],all=K.assistantStaffing.overview(date,rows().filter(r=>r.wishType!=='preferred'));
 times.forEach((t,index)=>{if(t.wishZone==='Z'||t.only||t.reserve||!valid(t))return;
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
 step=standby.answer?'check':'standby';render();
}
function alternatives(index){
 const t=times[index];if(!t||t.wishZone==='Z')return [];
 const base=rows().filter(r=>r.wishType!=='preferred');
 // Consider other time windows explicitly; choosing one is an affirmative new availability.
 const probe=base.filter(r=>r.wishType==='unavailable').concat(base.filter(r=>['available','if_needed'].includes(r.wishType)));
 return K.assistantStaffing.suggestions(date,probe,Infinity,true)
  .filter(g=>!standby.slots.some(b=>standby.answer==='yes'&&overlap(b,g))&&!(g.start===t.start&&g.end===t.end&&g.wishZone===t.wishZone)&&!times.some((other,i)=>i!==index&&valid(other)&&overlap(other,g)))
  .sort((a,b)=>Number(!(a.start===t.start&&a.end===t.end))-Number(!(b.start===t.start&&b.end===t.end))||Math.abs(a.start-t.start)-Math.abs(b.start-t.start)||Math.abs((a.end-a.start)-(t.end-t.start))-Math.abs((b.end-b.start)-(t.end-t.start)))
  .slice(0,4);
}

function entrySummary(list){
 if(!list.length)return '<span>Noch keine Angaben</span>';
 return '<span class="sw-entry-grid">'+list.map(w=>'<span class="sw-entry">'+(w.scope==='day'&&w.wishType==='unavailable'?'Sperrtag':tm(w.start)+'–'+tm(w.end)+' Uhr = '+(w.end-w.start).toLocaleString('de-DE')+' Stunden <b>'+({available:'(Kann-Zeit)',preferred:'(Wunschzeit)',if_needed:'(Kann-Zeit · nur wenn nötig)',unavailable:'(Sperrzeit)'}[w.wishType]||'')+'</b>'+(w.wishType!=='unavailable'?' · '+esc(zlabel(w.wishZone||'B')):''))+'</span>').join('')+'</span>'+((list[0]?.assistantDay?.standby?.answer==='yes')?'<p>'+esc(detail.standbyText(list[0].assistantDay.standby))+'</p>':'');
}
function stats(preview=true){
 const s=K.assistantHours.calculate(owner,preview?date:null,preview?rows():null),fmt=n=>n.toLocaleString('de-DE',{maximumFractionDigits:2});
 return '<section class="sw-hours"><h2>Dein Stundenüberblick'+(preview?' · Vorschau':'')+'</h2><div class="sw-grid">'+s.daily.map(d=>'<article class="sw-entry"><b>'+dateLabel(d.date)+'</b><span>'+fmt(d.can)+' h (Kann-Zeit)</span><span>'+fmt(d.wish)+' h (Wunschzeit)</span><span>'+fmt(d.planned)+' h geplant</span><span>'+fmt(d.standby)+' h Bereitschaft</span>'+(d.reserve?'<span>'+fmt(d.reserve)+' h nur wenn nötig</span>':'')+'</article>').join('')+'</div><p><b>Gesamt: '+fmt(s.totals.can)+' h (Kann-Zeit) · '+fmt(s.totals.wish)+' h (Wunschzeit) · '+fmt(s.totals.planned)+' h geplant · '+fmt(s.totals.standby)+' h Bereitschaft</b></p><p>Berechnung (Wunschzeit): '+s.daily.map(d=>fmt(d.wish)).join(' + ')+' = '+fmt(s.totals.wish)+' Stunden.</p><p>Überlappungen zählen je Person und Kategorie einmal; Sperrzeiten sind bei Kann-/Wunschzeiten abgezogen. Geplante Zeitfenster werden ohne Pausenabzug angezeigt. Die Kategorien werden nicht addiert.</p><h2>Vergleich im ausgewählten Planungszeitraum</h2><p>'+(s.memberCount?s.memberCount+' aktive Mitglieder mit Kann-/Wunschangaben: '+fmt(s.teamWish)+' Wunschstunden ÷ '+s.memberCount+' = <b>'+fmt(s.average)+' Stunden im Durchschnitt</b>.':'Noch keine Kann-/Wunschangaben aktiver Mitglieder.')+(preview?' Einschließlich deiner aktuellen Vorschau.':'')+' Orientierung, keine Vorgabe.</p></section>';
}
function slotTeam(g){
 const parts=K.assistantStaffing.overview(date,stored).filter(p=>overlap(p,g)),people=new Map();
 for(const p of parts)for(const x of p.areas.flatMap(a=>a.people).concat(p.flexible,p.special||[])){
  const key=x.personId+'|'+x.zone+'|'+x.kind;
  if(!people.has(key))people.set(key,{...x,records:[]});
  for(const r of x.records)if(!people.get(key).records.some(a=>a.start===r.start&&a.end===r.end))people.get(key).records.push(r);
 }
 const count=z=>{const n=parts.map(p=>p.areas.find(a=>a.zone===z)?.count||0);return !n.length?'0':Math.min(...n)===Math.max(...n)?String(n[0]):Math.min(...n)+'–'+Math.max(...n);};
 return {short:count('front')+' V / '+count('back')+' H',html:[...people.values()].map(x=>'<p><b>'+esc(K.person(x.personId)?.pseudoName||K.person(x.personId)?.name||x.personId)+'</b> · '+zlabel(x.zone)+'<br>'+x.records.map(r=>tm(r.start)+'–'+tm(r.end)).join(', ')+' Uhr · '+(x.kind==='planned'?'geplant':'Wunsch')+'</p>').join('')||'<p>Noch niemand eingetragen.</p>'};
}
function timeFields(r,i,kind,disabled=false){
 const options=field=>{
  const selected=r[field],range=[],other=[],values=new Set(Array.from({length:49},(_,i)=>i/2));
  if(Number.isFinite(selected))values.add(selected);
  for(const n of [...values].sort((a,b)=>a-b)){const option='<option value="'+n+'" '+(selected===n?'selected':'')+'>'+tm(n)+'</option>'; (n>=day().start&&n<=day().end?range:other).push(option);}
  return '<option value="">Bitte wählen</option><optgroup label="Tagesrahmen '+tm(day().start)+'–'+tm(day().end)+'">'+range.join('')+'</optgroup><optgroup label="Weitere Uhrzeiten">'+other.join('')+'</optgroup>';
 };
 return '<div class="wa-timepair">'+['start','end'].map(field=>'<label>'+(field==='start'?'Von':'Bis')+'<select data-list="'+kind+'" data-i="'+i+'" data-field="'+field+'" '+(disabled?'disabled':'')+'>'+options(field)+'</select></label>').join('')+'</div>';
}
function canErrors(){
 const errors=blockErrors();if(!can.length||can.some(t=>!valid(t)))errors.push('Bitte gültige Uhrzeiten für die (Kann-Zeit) wählen.');
 for(const t of can.filter(valid)){const b=blockMode==='time'&&blocks.find(b=>valid(b)&&overlap(t,b));if(b)errors.push('Du hast '+tm(b.start)+'–'+tm(b.end)+' Uhr gesperrt. Bitte (Kann-Zeit) oder Sperre ändern.');}
 return errors;
}
function inputRows(list,kind){
 const name=kind==='can'?'(Kann-Zeit)':'(Wunschzeit)';
 return '<div class="sw-grid">'+list.map((t,i)=>'<article class="wa-slot"><b>Zeitraum '+(i+1)+' '+name+'</b>'+timeFields(t,i,kind)+'<label>Einsatzbereich<select data-zone="'+i+'" data-kind="'+kind+'">'+['B','V','H','Z'].map(z=>'<option value="'+z+'" '+(t.wishZone===z?'selected':'')+'>'+zlabel(z)+'</option>').join('')+'</select></label>'+(t.reserve?'<p>Nur wenn nötig (Kann-Zeit)</p>':'')+'<p data-time-error="'+kind+'-'+i+'" role="status"></p>'+(list.length>1?'<button class="wa-remove" data-remove="'+kind+'" data-i="'+i+'">Zeitraum entfernen</button>':'')+'</article>').join('')+'</div>';
}

function team(){
 const parts=K.assistantStaffing.overview(date,stored);
 return '<div id="swTeam" hidden><p>Aktuell geladener Stand · gespeicherte Wünsche und geplante Dienste getrennt.</p>'+parts.map(p=>'<article class="sw-covered"><b>'+tm(p.start)+'–'+tm(p.end)+' Uhr</b>'+p.areas.map(a=>'<p><b>'+zlabel(a.zone)+'</b> · Bedarf '+(a.needed??'unbekannt')+' · '+a.planned+' geplant · '+a.wishes+' Wünsche<br>'+a.people.map(x=>esc(K.person(x.personId)?.pseudoName||K.person(x.personId)?.name||x.personId)+' · '+x.records.map(r=>tm(r.start)+'–'+tm(r.end)).join(', ')+' ('+(x.kind==='planned'?'geplant':'Wunsch')+')').join('<br>')+'</p>').join('')+(p.flexible.length?'<p>Bereich offen: '+p.flexible.map(x=>esc(K.person(x.personId)?.name||x.personId)+' ('+(x.kind==='planned'?'geplant':'Wunsch')+')').join(', ')+'</p>':'')+'</article>').join('')+'</div>';
}
function plannedNotice(){
 const shifts=(K.shifts||[]).filter(s=>active(s)&&s.layer==='planned'&&s.personId===owner&&s.date===date&&times.some(t=>valid(t)&&overlap(s,t)));
 return shifts.length?'<p class="ux-goodbox">Bereits geplant: '+shifts.map(s=>tm(s.start)+'–'+tm(s.end)+' Uhr · Einsatzbereich '+esc(zlabel(s.zone))).join('; ')+'. Deine (Wunschzeit) darf sich damit überschneiden. Der geplante Dienst bleibt unverändert.</p>':'';
}
function render(){
 const readinessIssue=['check','review'].includes(step)&&blockMode!=='day'?standbyErrors():[];
 if(readinessIssue.length)step='standby';
 if(lastStep&&lastStep!==step)history.push(lastStep);lastStep=step;
 const titles={blocks:'Zuerst: Gibt es Sperren?',can:'In welchem kompletten Zeitraum könntest du helfen? (Kann-Zeit)',standby:'Kannst du zusätzlich Bereitschaft übernehmen?',wish:'Wann möchtest du helfen? (Wunschzeit)',check:'So passt deine Zeit (Wunschzeit)',alternatives:'Hier wird noch Hilfe gebraucht',review:'Deine Zusammenfassung'};
 let html='<h1>'+titles[step]+'</h1><p>'+dateLabel(date)+'</p>';
 if(step==='blocks'){
 html+='<div class="sw-grid"><label class="sw-check"><input type="checkbox" id="swDayBlock" '+(blockMode==='day'?'checked':'')+'>Ganzer Tag gesperrt</label><label class="sw-check"><input type="checkbox" id="swTimeBlock" '+(blockMode==='time'?'checked':'')+' '+(blockMode==='day'?'disabled':'')+'>Bestimmter Zeitraum gesperrt</label></div>';
 if(blockMode==='time')html+=blocks.map((b,i)=>'<article class="wa-slot">'+timeFields(b,i,'blocks')+'<button data-remove-block="'+i+'">Sperrzeit entfernen</button></article>').join('')+'<button class="ux-btn secondary" id="swAddBlock">Weitere Sperrzeit</button>';
 if(blockMode==='day')html+='<p>Dieser Tag ist vollständig gesperrt.</p><fieldset disabled>'+timeFields({start:day().start,end:day().end},0,'disabled',true)+'</fieldset>';
 }else if(step==='can'||step==='wish'){
 html+=step==='can'?'<p>(Kann-Zeit): Das ist deine gesamte Verfügbarkeit. Deine Wunschzeit kannst du danach eintragen. Der Tagesrahmen ist als Vorschlag eingestellt.</p><button class="ux-btn secondary" id="swEditBlocks">Sperren ändern</button>':'<p>(Wunschzeit): In diesem Teil deiner Kann-Zeit möchtest du bevorzugt eingesetzt werden.</p>'+entrySummary(can.map(t=>({...t,wishType:'available'})))+'<div class="sw-grid"><button class="ux-btn secondary" id="swSame">Kann-Zeit als Wunsch übernehmen</button><button class="ux-btn secondary" id="swNone">Ohne Wunschzeit weiter</button></div>';
 html+=inputRows(step==='can'?can:times,step==='can'?'can':'times');
 html+='<div class="sw-grid"><button class="ux-btn secondary" id="swAddTime">'+(step==='wish'&&!times.length?'Eigene Wunschzeit eingeben':'Weitere Zeit für den Tag')+'</button>'+teamButton()+'</div>';
 }else if(step==='standby'){
 html+='<p>Bereitschaft bedeutet: Du hältst dich zusätzlich zum Einspringen bereit. Sie zählt nicht als Arbeitszeit oder Standbesetzung.</p><div class="sw-grid"><button class="ux-btn secondary" id="swNoStandby">Nein, keine Bereitschaft</button><button class="ux-btn secondary" id="swYesStandby">Ja, zu bestimmten Zeiten</button></div>';
 if(standby.answer==='yes')html+=standby.slots.map((r,i)=>'<article class="wa-slot">'+timeFields(r,i,'standby')+'<button data-remove-standby="'+i+'">Bereitschaft entfernen</button></article>').join('')+'<button class="ux-btn secondary" id="swAddStandby">Weitere Bereitschaft</button>';
 }else if(step==='check'){
 const c=coverage(),full=c.some(p=>p.status==='full');
 html+='<section class="ux-goodbox" id="swOwnWish"><h2>Deine eigene Wunschzeit</h2>'+ (times.length?times.map(t=>'<p><strong>'+tm(t.start)+'–'+tm(t.end)+' Uhr (Wunschzeit)</strong><br>Einsatzbereich '+esc(zlabel(t.wishZone))+'</p>').join(''):'<p>Keine (Wunschzeit) angegeben.</p>')+'</section><p>Hier siehst du die Besetzung innerhalb deiner (Wunschzeit). Möchtest du dir ansehen, wo noch Hilfe benötigt wird? Dann kannst du deine Zeit noch ändern. Klicke auf den Pfeil einer Kachel, um die Personenbesetzung zu sehen.</p><div class="sw-grid">'+c.map(p=>{const s=slotTeam(p);return '<details class="sw-covered"><summary><b>'+tm(p.start)+'–'+tm(p.end)+' Uhr · Besetzung</b><span>Einsatzbereich '+zlabel(p.wishZone)+' · '+s.short+'</span><span>'+(p.status==='full'?'Bereits besetzt: '+p.count+' / '+p.needed:p.status==='gap'?'Noch '+(p.needed-p.count)+' gesucht':'Bedarf unbekannt')+'</span></summary>'+s.html+'<button class="ux-btn secondary" data-help="'+p.index+'">Hilfebedarf ansehen</button></details>';}).join('')+'</div>';
 if(times.some(t=>t.wishZone==='Z'))html+='<p>Vorbereitung außerhalb des Stands zählt zu deinen Stunden, aber nicht zur Standbesetzung.</p>';
 if(!times.length)html+='<p>Deine (Kann-Zeit) wird ohne zusätzlichen Wunsch gespeichert.</p>';
 html+='<p>Wünsche sind noch keine feste Einteilung. Öffne eine Kachel, um Namen und Zeiten zu sehen.</p>';
 if(!full&&times.some(t=>t.wishZone!=='Z'))html+='<div class="sw-grid"><button class="ux-btn secondary" id="swAlternatives">Hilfebedarf ansehen</button><button class="ux-btn secondary" id="swOwn">Wunschzeit ändern</button></div>';
 if(full)html+='<p>Möchtest du deine (Wunschzeit) trotzdem eintragen?</p><div class="sw-grid"><button class="ux-btn primary" id="swKeep">Ja, Wunsch behalten · Fertig</button><button class="ux-btn secondary" id="swAlternatives">Alternativen anzeigen</button></div>';
 }else if(step==='alternatives'){
 html+=(alternatives(alternativeIndex).length?'':'<p>Keine passende freie Alternative gefunden. Du kannst deine eigene Zeit ändern oder zurückgehen und den Wunsch behalten.</p>')+(times.length>1?'<label>Welche (Wunschzeit) möchtest du ändern?<select id="swAlternativeTime">'+times.map((t,i)=>'<option value="'+i+'" '+(i===alternativeIndex?'selected':'')+'>'+tm(t.start)+'–'+tm(t.end)+' · '+zlabel(t.wishZone)+'</option>').join('')+'</select></label>':'')+'<p>Öffne eine Zeitkachel und prüfe, ob die Zeit für dich passt.</p><div class="sw-grid">'+alternatives(alternativeIndex).map((g,i)=>{const s=slotTeam(g);return '<details class="sw-covered"><summary><b>'+tm(g.start)+'–'+tm(g.end)+' (Wunschzeit)</b><span>Einsatzbereich '+zlabel(g.wishZone)+' · '+s.short+'</span><span>'+g.missing+' gesucht</span></summary>'+s.html+'<p>Möchtest du lieber diese Zeit übernehmen?</p><p>Falls sie außerhalb deiner (Kann-Zeit) liegt, wird diese dafür ergänzt.</p><button class="ux-btn primary" data-alt="'+i+'">Ja, Zeit übernehmen</button></details>';}).join('')+'</div><button class="ux-btn secondary" id="swOwn">Eigene Zeit ändern</button>';
 }else html+=(blockMode==='day'&&stored.some(w=>w.wishType!=='unavailable')?'<p class="ux-warningbox">Die Tagessperre ersetzt deine bisherigen Zeitangaben für diesen Tag.</p>':'')+entrySummary(rows())+stats()+'<p>Erst mit „Angaben speichern“ werden die Änderungen übernommen.</p>';
 html+=(['wish','check','review'].includes(step)?plannedNotice():'');
 html+='<div id="swError" role="alert"></div>'+(step==='can'||step==='wish'?'':teamButton())+team()+'<div class="wa-actions"><button class="ux-btn secondary" id="swBack">Zurück</button>'+(!(step==='check'&&coverage().some(p=>p.status==='full'))&&step!=='alternatives'?'<button class="ux-btn primary" id="swNext">'+(step==='review'?'Angaben speichern':step==='check'?'Fertig':'Weiter')+'</button>':'')+'</div>';
 shell(html,titles[step]);bind();if(readinessIssue.length)error(readinessIssue.join(' '));
}
function teamButton(){return '<button class="ux-btn secondary" id="swTeamToggle" aria-expanded="false" aria-controls="swTeam">Bisherige Besetzung anzeigen</button>';}
function clearWarning(){ $('swWarning')?.remove();const box=$('swError');if(box){box.replaceChildren();box.className='';} }
function error(msg){
 const box=$('swError');if(!box)return;box.textContent=msg;box.className='ux-warningbox';box.tabIndex=-1;
 const read=document.createElement('button');read.type='button';read.className='ux-btn secondary';read.textContent='Meldung gelesen';read.onclick=clearWarning;box.append(document.createElement('br'),read);
 $('swWarning')?.remove();const badge=document.createElement('button');badge.id='swWarning';badge.type='button';badge.className='ux-btn secondary';badge.textContent='⚠ Meldung';badge.setAttribute('aria-label','Wichtige Meldung anzeigen');badge.onclick=()=>{box.scrollIntoView({behavior:'smooth',block:'center'});box.focus({preventScroll:true});badge.remove();};document.querySelector('.chef-helper b')?.insertAdjacentElement('afterend',badge);
}
function changed(){dirty=true;accepted='';}
function bind(){
 if($('swNoStandby'))$('swNoStandby').onclick=()=>{standby={answer:'no',slots:[]};changed();step='check';render();};
 if($('swYesStandby'))$('swYesStandby').onclick=()=>{standby.answer='yes';if(!standby.slots.length)standby.slots.push({start:null,end:null});changed();render();};
 if($('swAddStandby'))$('swAddStandby').onclick=()=>{standby.slots.push({start:null,end:null});changed();render();};
 document.querySelectorAll('[data-remove-standby]').forEach(b=>b.onclick=()=>{standby.slots.splice(Number(b.dataset.removeStandby),1);changed();render();});
 $('swTeamToggle').onclick=()=>{const el=$('swTeam');el.hidden=!el.hidden;$('swTeamToggle').setAttribute('aria-expanded',String(!el.hidden));};
 if($('swDayBlock'))$('swDayBlock').onchange=e=>{blockMode=e.target.checked?'day':blocks.length?'time':'none';changed();render();};
 if($('swTimeBlock'))$('swTimeBlock').onchange=e=>{blockMode=e.target.checked?'time':'none';if(blockMode==='time'&&!blocks.length)blocks.push({start:null,end:null});changed();render();};
 if($('swAddBlock'))$('swAddBlock').onclick=()=>{blocks.push({start:null,end:null});changed();render();};
 document.querySelectorAll('[data-remove-block]').forEach(b=>b.onclick=()=>{blocks.splice(Number(b.dataset.removeBlock),1);if(!blocks.length)blockMode='none';changed();render();});
 document.querySelectorAll('[data-list]').forEach(e=>e.onchange=()=>{const list=e.dataset.list==='blocks'?blocks:e.dataset.list==='can'?can:e.dataset.list==='standby'?standby.slots:times,r=list[Number(e.dataset.i)];if(!r)return;r[e.dataset.field]=e.value===''?null:Number(e.value);changed();if(step==='can'||step==='wish'){const errors=step==='can'?canErrors():timeErrors();const el=document.querySelector('[data-time-error="'+e.dataset.list+'-'+e.dataset.i+'"]');el.textContent=errors.join(' ');if(errors.length)error(errors.join(' '));else clearWarning();}});
 document.querySelectorAll('[data-zone]').forEach(e=>e.onchange=()=>{(e.dataset.kind==='can'?can:times)[Number(e.dataset.zone)].wishZone=e.value;changed();});
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{(b.dataset.remove==='can'?can:times).splice(Number(b.dataset.i),1);changed();render();});
 if($('swEditBlocks'))$('swEditBlocks').onclick=()=>{step='blocks';render();};
 if($('swAddTime'))$('swAddTime').onclick=()=>{(step==='can'?can:times).push({start:day().start,end:day().end,wishZone:'B'});changed();render();};
 if($('swSame'))$('swSame').onclick=()=>{times=can.filter(t=>!t.reserve).map(t=>({start:t.start,end:t.end,wishZone:t.wishZone}));changed();acceptOrCheck();};
 if($('swNone'))$('swNone').onclick=()=>{times=[];changed();acceptOrCheck();};
 if($('swKeep'))$('swKeep').onclick=()=>{accepted=fingerprint();step='review';render();};
 if($('swAlternatives'))$('swAlternatives').onclick=()=>{alternativeIndex=coverage().find(p=>p.status==='full')?.index??times.findIndex(t=>t.wishZone!=='Z');step='alternatives';render();};
 if($('swOwn'))$('swOwn').onclick=()=>{step='wish';render();};
 document.querySelectorAll('[data-help]').forEach(b=>b.onclick=()=>{alternativeIndex=Number(b.dataset.help);step='alternatives';render();});
 if($('swAlternativeTime'))$('swAlternativeTime').onchange=e=>{alternativeIndex=Number(e.target.value);render();};
 const offers=step==='alternatives'?alternatives(alternativeIndex):[];
 document.querySelectorAll('[data-alt]').forEach(b=>b.onclick=()=>{
 if(!editable())return error('Die Anmeldung oder Wunschphase hat sich geändert.');
 const g=offers[Number(b.dataset.alt)],fresh=alternatives(alternativeIndex).find(x=>x.start===g.start&&x.end===g.end&&x.wishZone===g.wishZone);
 if(!fresh)return error('Diese Alternative ist nicht mehr frei. Bitte erneut prüfen.');
 if(!can.some(t=>!t.reserve&&t.start<=g.start&&t.end>=g.end&&(t.wishZone==='B'||t.wishZone===g.wishZone)))can.push({start:g.start,end:g.end,wishZone:g.wishZone});
 times[alternativeIndex]={start:g.start,end:g.end,wishZone:g.wishZone};changed();acceptOrCheck();
 });
 $('swBack').onclick=()=>{if(busy)return;if(history.length){step=history.pop();lastStep=step;render();}else if(!dirty||confirm('Ungespeicherte Angaben verwerfen?'))start();};
 if($('swNext'))$('swNext').onclick=()=>{
 if(busy)return;if(!editable())return error('Die Anmeldung oder Wunschphase hat sich geändert.');
 if(step==='blocks'){const errors=blockErrors();if(errors.length)return error(errors.join(' '));step=blockMode==='day'?'review':'can';render();}
 else if(step==='can'){const errors=canErrors();if(errors.length)return error(errors.join(' '));step='wish';render();}
 else if(step==='wish')acceptOrCheck();
 else if(step==='standby'){const errors=standbyErrors();if(errors.length)return error(errors.join(' '));step='check';render();}
 else if(step==='check'){accepted=fingerprint();step='review';render();}
 else save();
 };
}
function dayFinished(){
 step='done';lastStep=null;history=[];
 shell('<button class="ux-btn secondary" id="swDoneBack">Zurück</button><h1>Dein Tag ist gespeichert</h1><p>'+dateLabel(date)+'</p><p>Bist du fertig oder möchtest du weitere Zeiten erfassen?</p><div class="sw-grid"><button class="ux-btn secondary" id="swMore">Weitere Zeiten erfassen</button><button class="ux-btn primary" id="swFinish">Fertig</button></div>','Dein Tag ist gespeichert. Wie möchtest du weitermachen?');
 $('swDoneBack').onclick=()=>{history=blockMode==='day'?['blocks']:['blocks','can','wish','standby','check'];step='review';lastStep='review';render();};$('swMore').onclick=()=>start();$('swFinish').onclick=()=>finishOverview(false);
}
function finishOverview(show){
 step='finish';
 shell('<button class="ux-btn secondary" id="swFinishBack">Zurück</button><h1>'+(show?'Deine Gesamtübersicht':'Möchtest du deine Gesamtübersicht ansehen?')+'</h1>'+(show?'<p>Gespeicherte Angaben für alle Tage im ausgewählten Planungszeitraum.</p>'+K.days.map(d=>'<section><h2>'+dateLabel(d.date)+'</h2>'+entrySummary(M().rows(owner,d.date))+'</section>').join('')+stats(false):'<p>Alle Tage mit deinen Zeiten, Tagesstunden, Gesamtstunden und dem bisherigen Durchschnitt.</p>')+'<div class="sw-grid">'+(show?'<button class="ux-btn secondary" id="swMore">Weitere Zeiten erfassen</button>':'<button class="ux-btn secondary" id="swOverview">Gesamtübersicht anzeigen</button>')+'<button class="ux-btn primary" id="swLeave">'+(show?'Fertig · Assistent verlassen':'Ohne Übersicht beenden')+'</button></div>','Deine Angaben sind gespeichert. Vor dem Beenden kannst du alle Tage zusammen ansehen.');
 $('swFinishBack').onclick=()=>show?finishOverview(false):dayFinished();
 if($('swOverview'))$('swOverview').onclick=()=>finishOverview(true);if($('swMore'))$('swMore').onclick=()=>start();$('swLeave').onclick=()=>{dirty=false;K.roleUx.openTimes();};
}
function standbyErrors(){
 if(blockMode==='day')return [];
 if(!standby.answer)return ['Bitte die tägliche Frage zur Bereitschaft beantworten.'];
 if(standby.answer!=='yes')return [];
 if(!standby.slots.length||standby.slots.some(r=>!valid(r)))return ['Bitte gültige Bereitschaftszeiten eingeben.'];
 const occupied=can.concat(times,blockMode==='time'?blocks:[],(K.shifts||[]).filter(s=>active(s)&&s.layer==='planned'&&s.personId===owner&&s.date===date));
 return standby.slots.some((r,i)=>occupied.some(t=>valid(t)&&overlap(r,t))||standby.slots.some((t,j)=>j!==i&&overlap(r,t)))?['Bereitschaft überschneidet sich mit Kann-Zeit, Wunschzeit, Sperrzeit, geplantem Dienst oder einer weiteren Bereitschaft. Bitte einen getrennten Zeitraum wählen.']:[];
}
async function save(){
 if(!editable())return error('Die Anmeldung oder Wunschphase hat sich geändert.');
 const errors=timeErrors().concat(standbyErrors());if(errors.length)return error(errors.join(' '));
 if(blockMode!=='day'&&coverage().some(p=>p.status==='full')&&accepted!==fingerprint()){step='check';render();return error('Die Besetzung hat sich geändert. Bitte erneut entscheiden.');}
 busy=true;$('swNext').disabled=true;
 try{await M().save(owner,[date],rows(),baseline,{reviewedDemand:true});busy=false;dirty=false;stored=clone(M().rows(owner,date));baseline=JSON.stringify(stored);dayFinished();}catch(e){busy=false;error(e.message);$('swNext').disabled=false;}
}
document.addEventListener('click',e=>{if(!document.querySelector('.sw-root')||!e.target.closest?.('[data-nav],#uxUserMenu'))return;if(busy||(dirty&&!confirm('Ungespeicherte Angaben verwerfen?'))){e.preventDefault();e.stopImmediatePropagation();}else dirty=false;},true);
K.simpleWishAssistant={start,open};K.wishAssistant={...detail,start,open};
})();

