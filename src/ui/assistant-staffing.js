(function(){
'use strict';
const K=window.KCDP,valid=r=>r&&!['deleted','cancelled','failed','absent'].includes(r.status),complete=r=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.end>r.start;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tm=h=>String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round(h%1*60)).padStart(2,'0');
const label=z=>({front:'Vorne',back:'Hinten',total:'Gesamter Bereich',flex:'Bereich noch offen',special:'Z-Dienst'}[z]);
const intro='Trage deine Zeiten wie gewohnt ein. DP2 zeigt dir zusätzlich, wo noch Hilfe benötigt wird und welche Bereiche wann und mit wie vielen Personen bereits besetzt sind.';
function overview(date,draft=null){
 const d=K.days.find(x=>x.date===date);if(!d||!K.wishDemand)return [];
 const own=K.currentUser?.personId,all=(K.wishes||[]).filter(valid),rows=all.filter(x=>x.date===date&&!(draft!==null&&x.personId===own)).concat((draft||[]).filter(x=>x.date===date&&valid(x))).filter(complete);
 const shifts=(K.shifts||[]).filter(x=>valid(x)&&x.layer==='planned'&&x.date===date&&complete(x));
 const program=(d.program||[]).map(p=>({date,start:Number(p.start)-Number(p.leadMinutes??30)/60,end:Number(p.end)+Number(p.lagMinutes??30)/60}));
 const points=K.wishDemand.points(date,d.start,d.end,rows.concat(shifts,program)),result=[];
 for(let i=1;i<points.length;i++){
  const start=points[i-1],end=points[i],t=(start+end)/2,req=K.requirementFor?.(d,t)||K.wishDemand.requirement(date,t),inside=r=>r.start<=t&&r.end>t;
  const planned=shifts.filter(inside),plannedIds=new Set(planned.map(x=>x.personId));
  const wishes=rows.filter(x=>x.wishType==='preferred'&&inside(x)&&!plannedIds.has(x.personId)&&!rows.some(b=>b.personId===x.personId&&b.wishType==='unavailable'&&(b.scope==='day'||inside(b))));
  const people=new Map();
  for(const [kind,list] of [['planned',planned],['wish',wishes]])for(const r of list){
   const z=K.wishDemand.zone(kind==='planned'?{zone:r.zone||r.wishZone}:r),previous=people.get(r.personId);
   if(previous){if(previous.zone!==z)previous.zone='flex';previous.records.push(r);}
   else people.set(r.personId,{personId:r.personId,zone:z,kind,records:[r]});
  }
  const entries=[...people.values()],zones=d.type==='market'||Number.isFinite(req?.front)||Number.isFinite(req?.back)?['front','back']:['total'];
  const areas=zones.map(zone=>{
   const members=entries.filter(p=>zone==='total'?p.zone!=='special':p.zone===zone),needed=req?.[zone],count=members.length;
   return {zone,needed,count,planned:members.filter(p=>p.kind==='planned').length,wishes:members.filter(p=>p.kind==='wish').length,people:members,status:!Number.isFinite(needed)?'unknown':count<needed?'gap':count===needed?'full':'over',missing:Number.isFinite(needed)?needed-count:null};
  });
  const flexible=zones.includes('total')?[]:entries.filter(p=>p.zone==='flex'),special=entries.filter(p=>p.zone==='special');
  const key=JSON.stringify([areas,flexible,special,rows.filter(r=>r.personId===own&&inside(r))]),last=result.at(-1);
  if(last&&last.end===start&&last.key===key)last.end=end;else result.push({date,start,end,areas,flexible,special,key});
 }
 return result;
}
function highlights(date,draft){
 const parts=overview(date,draft),own=(draft||[]).filter(r=>complete(r)&&['available','if_needed'].includes(r.wishType)),list=parts.filter(p=>!own.length||own.some(r=>Math.max(r.start,p.start)<Math.min(r.end,p.end))).flatMap(p=>p.areas.map(a=>({p,a})));
 return '<div class="as-highlights"><b>Besetzung auf einen Blick</b>'+['gap','over','full'].map(status=>{const item=list.find(x=>x.a.status===status);return item?'<span>'+label(item.a.zone)+' · '+tm(item.p.start)+'–'+tm(item.p.end)+': '+(status==='gap'?(item.p.flexible.length?'Bereichszuteilung offen':item.a.missing+' gesucht'):status==='over'?-item.a.missing+' mehr als benötigt':'Bedarf gedeckt')+'</span>':'';}).join('')+'</div>';
}
function dayHint(date){
 const parts=overview(date),gap=parts.flatMap(p=>p.areas.filter(a=>a.status==='gap').map(a=>({p,a}))).sort((a,b)=>b.a.missing-a.a.missing||a.p.start-b.p.start)[0];
 if(gap)return (gap.a.missing<=gap.p.flexible.length?'Zuteilung offen: ':'Hilfe gesucht: ')+label(gap.a.zone)+' · '+tm(gap.p.start)+'–'+tm(gap.p.end);
 if(!parts.length||parts.some(p=>p.areas.some(a=>a.status==='unknown')))return 'Besetzungsbedarf noch nicht vollständig hinterlegt';
 return parts.some(p=>p.areas.some(a=>a.status==='over'))?'Bereits mehr Einträge als benötigt':'Bedarf durch Dienste / Wünsche gedeckt';
}
function suggestions(date,draft){
 const own=K.currentUser?.personId,person=K.person?.(own);if(!person||person.active===false)return [];
 const rows=draft.filter(complete),can=rows.filter(x=>x.wishType==='available'),out=[];
 for(const p of overview(date,draft))for(const a of p.areas){
  if(a.status!=='gap'||a.missing<=p.flexible.length)continue;
  const zone=a.zone==='total'?'neutral':a.zone,wishZone=zone==='front'?'V':zone==='back'?'H':'B';
  if(K.staffing?.qualificationOk&&zone!=='neutral'&&!K.staffing.qualificationOk(person,zone))continue;
  let covered=p.start;for(const c of can.filter(c=>K.wishDemand.zone(c)==='flex'||a.zone==='total'||K.wishDemand.zone(c)===zone).sort((a,b)=>a.start-b.start))if(c.start<=covered&&c.end>covered)covered=c.end;
  if(covered<p.end||p.end-p.start<.5)continue;
  const candidate={personId:own,date,start:p.start,end:p.end,wishZone,zone,layer:'planned',breakMinutes:0,status:'draft'};
  if(rows.some(r=>['unavailable','if_needed'].includes(r.wishType)&&Math.max(r.start,p.start)<Math.min(r.end,p.end)))continue;
  const overlapping=rows.filter(r=>r.wishType==='preferred'&&Math.max(r.start,p.start)<Math.min(r.end,p.end));
  if(overlapping.some(r=>K.wishDemand.zone(r)===zone||K.wishDemand.zone(r)==='flex'||a.zone==='total'))continue;
  if(overlapping.length&&!overlapping.every(r=>p.areas.some(area=>area.zone===K.wishDemand.zone(r)&&['full','over'].includes(area.status))))continue;
  candidate.replace=overlapping.length>0;
  if((K.shifts||[]).some(r=>valid(r)&&r.layer==='planned'&&r.personId===own&&r.date===date&&Math.max(r.start,p.start)<Math.min(r.end,p.end)))continue;
  if((K.validateShift?.(candidate)||[]).some(x=>x.level==='error')||(K.staffing?.ruleIssues?.(candidate,{includeSoft:true})||[]).some(x=>x.level==='error'))continue;
  out.push({...candidate,missing:Math.max(0,a.missing-p.flexible.length)});
 }
 return out.sort((a,b)=>Number(b.replace)-Number(a.replace)||b.missing-a.missing||a.start-b.start).slice(0,3);
}
function personText(p){
 const name=K.person?.(p.personId),who=p.personId===K.currentUser?.personId?'Du':name?.pseudoName||name?.name||p.personId;
 return esc(who)+' · '+[...new Set(p.records.map(r=>tm(r.start)+'–'+tm(r.end)))].join(', ');
}
function peopleHtml(people,kind){
 const list=people.filter(p=>p.kind===kind);
 return '<p class="as-people"><b>'+(kind==='planned'?'Im Sollplan':'Wünsche')+':</b> '+(list.length?list.map(personText).join('; '):'Noch keine')+'</p>';
}
function render(date,draft,step){
 const parts=overview(date,draft),selected=draft.filter(r=>complete(r)&&['available','if_needed'].includes(r.wishType)),filtered=selected.length&&!['availability','offdays'].includes(step);
 const relevant=filtered?parts.filter(p=>selected.some(r=>Math.max(r.start,p.start)<Math.min(r.end,p.end))):parts;
 const offers=['can','wish','zone'].includes(step)?suggestions(date,draft):[];
 let html='<section class="as-overview" aria-label="Besetzung und offene Zeiten"><h2>Wo wird noch Hilfe gebraucht?</h2><p class="as-context">'+(filtered?'Zeitfenster innerhalb deiner Kannzeit.':'Übersicht für diesen Tag.')+' Aktuell geladener Stand · Wünsche sind noch keine feste Einteilung.</p>';
 if(offers.length)html+='<div class="as-offers"><b>Das passt zu deiner Kannzeit</b>'+offers.map(g=>'<button type="button" class="ux-btn secondary" data-as-start="'+g.start+'" data-as-end="'+g.end+'" data-as-zone="'+g.wishZone+'">'+label(g.zone==='neutral'?'total':g.zone)+' · '+tm(g.start)+'–'+tm(g.end)+' · '+g.missing+' gesucht<br>'+(g.replace?'Wunsch hierhin ändern':'Als Wunsch ergänzen')+'</button>').join('')+'<small>Deine Kannzeit bleibt erhalten. „Wunsch hierhin ändern“ ersetzt nur die Wunschzeit im angezeigten Zeitfenster.</small></div>';
 html+=relevant.length?relevant.map(p=>'<article class="as-period"><h3>'+tm(p.start)+'–'+tm(p.end)+' Uhr</h3><div class="as-areas">'+p.areas.map(a=>'<section class="as-area as-'+a.status+'"><div class="as-area-head"><b>'+label(a.zone)+'</b><strong>'+(a.status==='gap'?(p.flexible.length?a.missing+' noch zuzuordnen':a.missing+' gesucht'):a.status==='full'?'✓ Bedarf gedeckt':a.status==='over'?-a.missing+' mehr als benötigt':'Bedarf unbekannt')+'</strong></div><p class="as-count">'+(Number.isFinite(a.needed)?a.count+' von '+a.needed+' Personen':'Keine Bedarfszahl')+' · '+a.planned+' geplant + '+a.wishes+' Wünsche</p>'+(a.people.length?peopleHtml(a.people,'planned')+peopleHtml(a.people,'wish'):'<p class="as-people">Noch niemand eingetragen.</p>')+'</section>').join('')+'</div>'+(p.flexible.length?'<p class="as-flex"><b>Bereich noch offen:</b> '+p.flexible.map(x=>personText(x)+' ('+(x.kind==='planned'?'Sollplan':'Wunsch')+')').join('; ')+'. Diese Personen sind oben keinem Bereich zugerechnet.</p>':'')+(p.special.length?'<p class="as-flex"><b>Z-Dienst:</b> '+p.special.map(x=>personText(x)+' ('+(x.kind==='planned'?'Sollplan':'Wunsch')+')').join('; ')+'</p>':'')+'</article>').join(''):'<p>Für diese Zeiten ist noch keine Besetzungsübersicht verfügbar. Du kannst deine Verfügbarkeit trotzdem angeben.</p>';
 return html+'<p class="as-context">Jede Person zählt je Zeitfenster einmal. Ein geplanter Dienst ersetzt dabei den Wunsch derselben Person. Die verbindliche Einteilung macht der Planer.</p></section>';
}
K.assistantStaffing={overview,suggestions,render,dayHint,highlights,intro};
})();

