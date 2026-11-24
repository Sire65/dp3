(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
const alive=r=>r&&!['deleted','cancelled','absent','failed','rejected'].includes(r.status);
const valid=r=>alive(r)&&Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.end>r.start;
const canonical=id=>K.personIdAliases?.[id]||id;
const ownSources=new Set(['club_app','self_service','form_import','paper_import','handwriting_import','member']);
const excluded=new Set(['KC-P-M0015','KC-P-M0004','KC-P-M0017']);
const cleanName=s=>String(s||'').normalize('NFC');
const zone=r=>({V:'front',H:'back',B:'neutral',Z:'special'}[r.wishZone]||r.zone||'neutral');
const areaMatch=(r,a)=>a==='all'||zone(r)===a||zone(r)==='neutral';
function permitted(p,date){return !!p&&p.active!==false&&!excluded.has(canonical(p.personId))&&K.personPlanningAllowed?.(p.personId)!==false&&(!date||!K.staffing?.isBlockedDate?.(p.personId,date));}
function own(r){return ownSources.has(r.source)&&r.plannerAdded!==true&&r.enteredByPlanner!==true&&r.wunschFremd!==true;}
function datesFor(o={}){
 const scope=o.scope||'all',selected=new Set(o.dates||[]),current=K.days?.[K.state?.dateIndex||0]?.date;
 return (K.days||[]).filter(d=>scope==='all'||scope==='current'&&d.date===current||scope==='selected'&&selected.has(d.date)||scope==='prep'&&d.type==='prep'||scope==='market'&&d.type==='market'||scope==='after'&&d.type==='after').slice().sort((a,b)=>a.date.localeCompare(b.date));
}
function union(rows){const spans=rows.filter(valid).map(r=>[r.start,r.end]).sort((a,b)=>a[0]-b[0]),out=[];for(const [a,b] of spans){const last=out.at(-1);if(last&&a<=last[1])last[1]=Math.max(b,last[1]);else out.push([a,b]);}return out;}
const hours=rows=>union(rows).reduce((s,[a,b])=>s+b-a,0);
function wishesFor(pid,date,area='all',onlyOwn=true){return (K.wishes||[]).filter(r=>valid(r)&&canonical(r.personId)===pid&&r.date===date&&(!onlyOwn||own(r))&&(r.wishType==='unavailable'||areaMatch(r,area)));}
function wishType(rows,t){const found=rows.filter(r=>r.scope==='day'&&r.wishType==='unavailable'||r.start<=t&&r.end>t);return ['unavailable','preferred','available','if_needed'].find(k=>found.some(r=>r.wishType===k))||'empty';}
function segments(rows,from=0,to=30){const cuts=[...new Set([from,to,...rows.flatMap(r=>r.scope==='day'&&r.wishType==='unavailable'?[from,to]:[r.start,r.end])])].filter(x=>x>=from&&x<=to).sort((a,b)=>a-b),out=[];for(let i=1;i<cuts.length;i++){const start=cuts[i-1],end=cuts[i],type=wishType(rows,(start+end)/2);if(type==='empty')continue;const last=out.at(-1);if(last&&last.type===type&&last.end===start)last.end=end;else out.push({start,end,type});}return out;}
function standby(pid,date,area){
 const entry=K.memberUxData?.assistantStandby?.[pid]?.[date];
 const explicit=entry?.answer==='yes'?(entry.slots||[]).filter(valid).map(s=>({...s,personId:pid,date})):[];
 // Bereitschaft im Sollplan ist eine eigene Sammlung, niemals Teil der Dienststunden.
 const planned=(K.standby||[]).filter(r=>valid(r)&&canonical(r.personId)===pid&&r.date===date&&areaMatch(r,area));
 return {own:union(explicit),planned:union(planned.length?planned:explicit)};
}
function makeDay(d,people,o){
 const ids=new Set(people.map(p=>p.personId)),allShifts=(K.visiblePlannedShifts?K.visiblePlannedShifts(d.date):(K.shifts||[]).filter(s=>s.layer==='planned')).filter(s=>valid(s)&&s.date===d.date&&ids.has(canonical(s.personId))&&areaMatch(s,o.area)&&permitted(people.find(p=>p.personId===canonical(s.personId)),d.date));
 const personRows=people.filter(p=>permitted(p,d.date)).map(p=>{
  const wishes=wishesFor(p.personId,d.date,o.area),parts=segments(wishes),shifts=allShifts.filter(s=>canonical(s.personId)===p.personId);
  return {id:p.personId,name:cleanName(p.name),ownSubmitted:(K.wishes||[]).some(r=>alive(r)&&canonical(r.personId)===p.personId&&own(r)),wishes:parts,shifts:shifts.map(s=>({start:s.start,end:s.end,zone:zone(s),breakMinutes:K.breaks?.plannedMinutes?.(s)||s.breakMinutes||0,breakSegments:(K.breaks?.segments?.(s)||s.breakSegments||[]).map(b=>({start:b.start,end:b.end}))})),wishHours:parts.filter(r=>r.type==='preferred').reduce((n,r)=>n+r.end-r.start,0),planHours:shifts.reduce((n,s)=>n+(K.breaks?.countedHours?.(s)??s.end-s.start),0),standby:standby(p.personId,d.date,o.area)};
 });
 const context=K.operationalContext?.forDay?.(d)||d;
 const cuts=new Set([8,23,d.start,d.end,...personRows.flatMap(p=>p.wishes.flatMap(r=>[r.start,r.end])),...allShifts.flatMap(s=>[s.start,s.end,...(K.breaks?.segments?.(s)||s.breakSegments||[]).flatMap(b=>[b.start,b.end])]),...(K.demandMatrix?.[d.date]||[]).flatMap(r=>[r.start,r.end]),...(context.program||[]).flatMap(p=>[Number(p.start)-Number(p.leadMinutes??30)/60,Number(p.end)+Number(p.lagMinutes??30)/60])]);
 for(let t=8;t<=23;t+=.25)cuts.add(t);
 const points=[...cuts].filter(t=>Number.isFinite(t)&&t>=0&&t<=30).sort((a,b)=>a-b),intervals=[];
 for(let i=1;i<points.length;i++){
  const start=points[i-1],end=points[i],t=(start+end)/2,inDay=t>=d.start&&t<d.end;
  const raw=inDay?(K.requirementFor?.(d,t)||{}):{},base=inDay?(K.baseRequirementFor?.(d,t)||raw):{};
  const req={total:Number(raw.total)||0,front:Number(raw.front)||0,back:Number(raw.back)||0},baseTotal=Number(base.total)||0;
  const available=allShifts.filter(s=>s.start<=t&&s.end>t&&!K.breaks?.isOnBreak?.(s,t)&&zone(s)!=='special'&&zone(s)!=='unassigned'),count=new Set(available.map(s=>canonical(s.personId))).size;
  const needed=o.area==='all'?req.total:req[o.area],wish=personRows.filter(p=>p.wishes.some(r=>r.type==='preferred'&&r.start<=t&&r.end>t)).length;
  const frontCount=new Set(available.filter(s=>zone(s)==='front').map(s=>canonical(s.personId))).size,backCount=new Set(available.filter(s=>zone(s)==='back').map(s=>canonical(s.personId))).size;
  intervals.push({start,end,req,baseTotal,extra:Math.max(0,req.total-baseTotal),needed,count,frontCount,backCount,wish,missing:Math.max(0,needed-count),over:Math.max(0,count-needed)});
 }
 const integrate=key=>intervals.reduce((n,s)=>n+s[key]*(s.end-s.start),0);
 const gaps=[];for(const s of intervals.filter(s=>s.missing)){const last=gaps.at(-1);if(last&&last.end===s.start&&last.missing===s.missing)last.end=s.end;else gaps.push({start:s.start,end:s.end,missing:s.missing});}
 return {date:d.date,type:d.type,start:d.start,end:d.end,people:personRows,intervals,gaps,demandHours:integrate('needed'),missingHours:integrate('missing'),overHours:integrate('over'),wishHours:personRows.reduce((n,p)=>n+p.wishHours,0),planHours:personRows.reduce((n,p)=>n+p.planHours,0)};
}
function build(options={}){
 const o={scope:'all',area:'all',personIds:null,...options},days=datesFor(o);
 if(!days.length)throw Error('Bitte mindestens einen Tag auswählen.');
 const canAll=K.auth?.has?.('roster.export.all')===true;
 const chosen=o.personIds?new Set(o.personIds.map(canonical)):null;
 const people=(K.people||[]).filter(p=>permitted(p)&&(!chosen||chosen.has(canonical(p.personId)))&&(canAll||canonical(p.personId)===canonical(K.currentUser?.personId))).map(p=>({...p,personId:canonical(p.personId)}));
 if(!people.length)throw Error('Bitte mindestens eine berechtigte Person auswählen.');
 const sync=K.cloudPrimary?.state;
 const result={at:new Date().toISOString(),build:window.KC_DP_BUILD||null,event:K.eventConfig?.name||'Weihnachtsmarkt Werne 2026',sourceLabel:sync?.version!=null?`Supabase-Stand V${sync.version}${sync.pending||sync.error?' · lokale Änderungen noch nicht bestätigt':''}`:'Geladener DP2-Arbeitsstand',area:o.area,filtered:!!chosen||o.area!=='all'||!canAll,accounting:K.breaks?.accountingLabel?.()||'Dienststunden ohne Bereitschaft',days:days.map(d=>makeDay(d,people,o))};
 result.people=people.map(p=>({id:p.personId,name:cleanName(p.name)}));
 // Ausschließlich freigegebene Druckfelder: keine Kommentare, Gesundheitsdaten oder Kontaktdaten.
 return result;
}
function suggestions(model,day){
 const sourceDay=K.days.find(d=>d.date===day.date);
 return day.gaps.map(g=>{
  const choices=[];
  for(const p of day.people){
   const all=wishesFor(p.id,day.date,model.area,false),cuts=[g.start,g.end,...all.flatMap(r=>[r.start,r.end])].filter(t=>t>=g.start&&t<=g.end).sort((a,b)=>a-b);
   if(cuts.some((t,i)=>i&&['empty','unavailable'].includes(wishType(all,(cuts[i-1]+t)/2))))continue;
   if(p.shifts.some(s=>s.start<g.end&&s.end>g.start))continue;
   const candidate={id:'',personId:p.id,date:day.date,start:g.start,end:g.end,zone:model.area==='all'?'neutral':model.area,layer:'planned',breakMinutes:0,status:'draft'};
   if(g.end-g.start>8||(K.validateShift?.(candidate)||[]).some(x=>x.level==='error'||x.level==='warn')||K.staffing?.isBlockedDate?.(p.id,sourceDay.date))continue;
   choices.push(p.name);
  }
  return {...g,choices};
 });
}
K.printData={build,datesFor,permitted,own,segments,wishType,hours,suggestions};
})();
