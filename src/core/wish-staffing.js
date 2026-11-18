(function(){
'use strict';const K=window.KCDP;
const alive=w=>w&&!['deleted','cancelled','rejected','absent','failed'].includes(w.status);
const valid=w=>alive(w)&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start;
const types=['preferred','available','if_needed'];
const range=values=>({min:Math.min(...values),max:Math.max(...values)});
function personOk(id,date){const p=K.person?.(id);return (!K.person||!!p&&p.active!==false)&&K.personPlanningAllowed?.(id)!==false&&!K.staffing?.isBlockedDate?.(id,date);}
function pool(people){return{total:people.length,front:people.filter(p=>p.zone==='V').length,back:people.filter(p=>p.zone==='H').length,flex:people.filter(p=>p.zone==='B').length};}
function assess(people,req,simple){const p=pool(people),frontGap=simple?0:Math.max(0,req.front-p.front),backGap=simple?0:Math.max(0,req.back-p.back),missing=Math.max(0,req.total-p.total,frontGap+backGap-p.flex);return{...p,frontGap,backGap,missing,assign:!simple&&missing===0&&(frontGap+backGap)>0,surplus:Math.max(0,p.total-req.total)};}
function interval(day,start,end){
 const rows=(K.wishesFor?.(day.date)||K.wishes?.filter(w=>w.date===day.date)||[]).filter(alive),mid=(start+end)/2,active=rows.filter(w=>valid(w)&&w.start<=mid&&w.end>mid),blocked=id=>rows.some(w=>w.personId===id&&w.wishType==='unavailable'&&(w.scope==='day'||valid(w)&&w.start<=mid&&w.end>mid));
 const ids=new Set(active.filter(w=>types.includes(w.wishType)).map(w=>w.personId)),people=[];let conflicts=0;
 for(const id of ids){if(!personOk(id,day.date)||blocked(id))continue;const own=rows.filter(w=>w.personId===id),canAll=own.filter(w=>valid(w)&&['available','if_needed'].includes(w.wishType)),at=active.filter(w=>w.personId===id),can=at.filter(w=>['available','if_needed'].includes(w.wishType)),wish=at.filter(w=>w.wishType==='preferred'),basis=canAll.length?can:wish;
 if(!basis.length){if(wish.length)conflicts++;continue;}
 const zones=new Set(basis.map(w=>String(w.wishZone||'B').toUpperCase()).filter(z=>['V','H','B'].includes(z)));if(!zones.size)continue;
 const regularBasis=basis.filter(w=>w.wishType!=='if_needed'&&w.onlyIfNeeded!==true),regularZones=new Set(regularBasis.map(w=>String(w.wishZone||'B').toUpperCase()).filter(z=>['V','H','B'].includes(z))),code=z=>z.has('B')||z.has('V')&&z.has('H')?'B':z.has('V')?'V':'H',allZone=code(zones),conditional=regularZones.size===0,zone=conditional?allZone:code(regularZones);
 people.push({personId:id,name:K.person?.(id)?.name||id,zone,allZone,conditional,preferred:wish.some(w=>String(w.wishZone||'B').toUpperCase()!=='Z')});
 }
 const raw=K.requirementFor(day,mid),req={total:Number(raw.total)||0,front:raw.front==null?null:Number(raw.front)||0,back:raw.back==null?null:Number(raw.back)||0},simple=day.type!=='market'||req.front===null||req.back===null,regular=people.filter(p=>!p.conditional),reserve=people.filter(p=>p.conditional),normal=assess(regular,req,simple),all=assess(people.map(p=>({...p,zone:p.allZone})),req,simple);
 const areaStatus=all.missing>0?'missing':normal.missing>0?'reserve':normal.assign?'assignment':'covered';
 const status=normal.total<req.total?'under':normal.total>req.total?'over':'exact';
 const offers=K.memberUxData?.assistantStandby||{},standby=Object.entries(offers).filter(([id,days])=>personOk(id,day.date)&&!blocked(id)&&days?.[day.date]?.answer==='yes'&&(days[day.date].slots||[]).some(s=>valid(s)&&s.start<=mid&&s.end>mid)).map(([id])=>id);
 return{start,end,req,simple,people,regular,reserve,normal,all,status,areaStatus,preferred:regular.filter(p=>p.preferred).length,standby:standby.length,standbyPeople:standby,conflicts};
}
function slot(day,start,end=Math.min(start+1,day.end)){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('Ungültiger Auswertungszeitraum.');
 const cuts=new Set([start,end]),add=n=>{if(Number.isFinite(n)&&n>start&&n<end)cuts.add(n)};
 for(const w of K.wishesFor?.(day.date)||K.wishes?.filter(w=>w.date===day.date)||[]){if(valid(w)){add(w.start);add(w.end)}}
 for(const byDate of Object.values(K.memberUxData?.assistantStandby||{}))for(const s of byDate?.[day.date]?.slots||[]){if(valid(s)){add(s.start);add(s.end)}}
 for(const row of K.demandMatrix?.[day.date]||[]){add(Number(row.start));add(Number(row.end))}
 const context=K.operationalContext?.forDay(day)||day;for(const p of context.program||[]){add(Number(p.start)-Number(p.leadMinutes??30)/60);add(Number(p.end)+Number(p.lagMinutes??30)/60)}
 // Coverage and demand may change inside a displayed hour. Never merge people who were not there together.
 for(let n=Math.ceil(start*4)/4;n<end;n+=.25)add(n);
 const bounds=[...cuts].sort((a,b)=>a-b),parts=[],rank={exact:0,over:1,under:2};
 for(let i=0;i<bounds.length-1;i++){const p=interval(day,bounds[i],bounds[i+1]),key=JSON.stringify([p.req,p.people,p.standbyPeople,p.conflicts,p.status]),previous=parts.at(-1);if(previous?.key===key)previous.end=p.end;else parts.push({...p,key});}
 const status=parts.reduce((best,p)=>rank[p.status]>rank[best]?p.status:best,'exact'),counts={};
 for(const key of ['total','front','back','flex'])counts[key]=range(parts.map(p=>p.normal[key]));
 counts.preferred=range(parts.map(p=>p.preferred));counts.reserve=range(parts.map(p=>p.reserve.length));counts.standby=range(parts.map(p=>p.standby));
 const req={};for(const key of ['total','front','back'])req[key]=range(parts.map(p=>Number(p.req[key])||0));
 return{date:day.date,start,end,parts,counts,req,status,simple:parts.every(p=>p.simple),missing:Math.max(0,...parts.map(p=>p.req.total-p.normal.total)),surplus:Math.max(0,...parts.map(p=>p.normal.total-p.req.total)),areaMissing:Math.max(...parts.map(p=>p.all.missing)),reserveNeeded:Math.max(...parts.map(p=>p.normal.missing)),conflicts:Math.max(...parts.map(p=>p.conflicts))};
}
K.wishStaffing={interval,slot};
})();
