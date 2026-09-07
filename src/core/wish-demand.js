(function(){
'use strict';const K=window.KCDP;
const active=x=>x&&!['deleted','cancelled','failed','absent'].includes(x.status),overlap=(a,b)=>a.date===b.date&&Math.max(+a.start,+b.start)<Math.min(+a.end,+b.end);
const zone=w=>({V:'front',H:'back',Z:'special',B:'flex',front:'front',back:'back',special:'special',neutral:'flex'}[w.wishZone||w.zone]||'flex');
function source(options={}){const dates=options.replaceDates||[],own=options.personId||K.currentUser?.personId;return (K.wishes||[]).filter(x=>active(x)&&!(dates.includes(x.date)&&x.personId===own)).concat(options.draft||[]).filter(x=>active(x)&&x!==options.omit&&!(options.omit?.id&&x.id===options.omit.id));}
function points(date,start,end,rows=[]){const d=K.days.find(x=>x.date===date),step=Math.max(.25,Math.min(1,(Number(K.state?.step)||30)/60)),p=[start,end,...(K.demandMatrix?.[date]||[]).flatMap(x=>[+x.start,+x.end]),...rows.filter(x=>x.date===date).flatMap(x=>[+x.start,+x.end])];for(let t=d?.start??start;t<end;t+=step)p.push(t);return [...new Set(p.filter(x=>Number.isFinite(x)&&x>=start&&x<=end))].sort((a,b)=>a-b);}
function requirement(date,t){const d=K.days.find(x=>x.date===date);if(!d)return null;return K.baseRequirementFor?.(d,t)||K.requirementFor?.(d,t)||null;}
function evaluate(w,options={}){
 const rows=source({...options,omit:options.omit||w}),p=points(w.date,+w.start,+w.end,rows),parts=[];
 for(let i=1;i<p.length;i++){
  const start=p[i-1],end=p[i],t=(start+end)/2,req=requirement(w.date,t),byPerson=new Map();
  const blocks=rows.filter(x=>x.date===w.date&&x.wishType==='unavailable'&&(x.scope==='day'||(+x.start<=t&&+x.end>t)));
  for(const r of rows.filter(x=>x.date===w.date&&x.wishType==='preferred'&&+x.start<=t&&+x.end>t&&!blocks.some(b=>b.personId===x.personId))){const old=byPerson.get(r.personId);if(!old)byPerson.set(r.personId,{...r,countZone:zone(r)});else if(old.countZone!==zone(r))old.countZone='flex';}
  const people=[...byPerson.values()],counts={front:0,back:0,flex:0,special:0};people.forEach(x=>counts[x.countZone]++);counts.total=people.filter(x=>x.countZone!=='special').length;
  const z=zone(w),target=z==='flex'?'total':z,needed=req?.[target],current=counts[target],status=z==='special'||!Number.isFinite(needed)?'unknown':current<needed?'gap':current===needed?'full':'over';
  parts.push({start,end,req,counts,after:{...counts,total:counts.total+(z==='special'?0:1),[target]:current+1},status,people});
 }
 const hours=parts.reduce((n,p)=>n+(p.status==='gap'?p.end-p.start:0),0),duration=+w.end-+w.start;
 return{candidate:w,parts,gapHours:hours,rating:!parts.length||parts.some(p=>p.status==='unknown')?'unbekannt':hours===duration?'Sehr passend':hours>0?'Teilweise passend':'Nicht empfohlen',hasFull:parts.some(x=>['full','over'].includes(x.status))};
}
function available(w,rows){const can=rows.filter(x=>x.personId===w.personId&&x.date===w.date&&x.wishType==='available'&&(zone(x)==='flex'||zone(w)==='flex'||zone(x)===zone(w))).sort((a,b)=>a.start-b.start);let end=w.start;for(const r of can)if(r.start<=end&&r.end>end)end=r.end;if(end<w.end)return false;
 if(rows.some(x=>x.personId===w.personId&&x.wishType==='unavailable'&&(x.scope==='day'?x.date===w.date:overlap(x,w))))return false;
 if((K.shifts||[]).some(x=>active(x)&&x.layer==='planned'&&x.personId===w.personId&&overlap(x,w)))return false;
 return !(K.validateShift?.({...w,id:'',layer:'planned',zone:zone(w)==='flex'?'neutral':zone(w),breakMinutes:0})||[]).some(x=>x.level==='error');}
function alternatives(w,options={}){
 if(zone(w)==='special')return[];const rows=source({...options,omit:options.omit||w}),out=[],duration=w.end-w.start;
 for(const d of K.days){const p=points(d.date,d.start,d.end,rows.concat(K.shifts||[]));let run=null;const runs=[];
 for(let i=1;i<p.length;i++){const candidate={...w,id:'',date:d.date,start:p[i-1],end:p[i]},check=evaluate(candidate,{...options,omit:options.omit||w});if(available(candidate,rows)&&check.parts.every(x=>x.status==='gap')){if(run&&run.end===candidate.start)run.end=candidate.end;else{run={...candidate};runs.push(run)}}else run=null;}
 for(const r of runs){if(r.end-r.start<.5)continue;const start=Math.max(r.start,Math.min(w.start,r.end-Math.min(duration,r.end-r.start))),candidate={...r,start,end:Math.min(r.end,start+duration)};if(candidate.date===w.date&&candidate.start===w.start&&candidate.end===w.end)continue;if(!available(candidate,rows))continue;const check=evaluate(candidate,{...options,omit:options.omit||w});out.push({...candidate,rating:Math.abs(candidate.end-candidate.start-duration)<.01?'Sehr passend':'Passend',missing:Math.min(...check.parts.map(x=>(x.req?.[zone(w)==='flex'?'total':zone(w)]||0)-x.counts[zone(w)==='flex'?'total':zone(w)]))});}
 }
 return out.sort((a,b)=>(a.date!==w.date)-(b.date!==w.date)||Math.abs(a.start-w.start)-Math.abs(b.start-w.start)||Math.abs(a.end-a.start-duration)-Math.abs(b.end-b.start-duration)||a.date.localeCompare(b.date)||a.start-b.start).slice(0,3);
}
K.wishDemand={evaluate,alternatives,points,requirement,zone};
})();
