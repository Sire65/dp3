(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
const state={inFlight:false,lastRunAt:null,lastResult:null,lastError:null};
function buildRows(){
 // The configuration applies overrides to the same day objects Twinkey reads.
 K.configuration.applyDaySettings();
 return K.days.map(day=>{
  const start=Number(day.start),end=Number(day.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>24||end<=start)throw Error('Ungültiger Tagesrahmen: '+day.date);
  const points=new Set([start,end]);
  for(let h=Math.ceil(start);h<end;h++)points.add(h);
  for(const row of K.configuration.ensureDemand(day.date))for(const t of [row.start,row.end])if(Number(t)>start&&Number(t)<end)points.add(Number(t));
  const edges=[...points].sort((a,b)=>a-b),demand=[];
  for(let i=0;i<edges.length-1;i++){
   const req=K.baseRequirementFor(day,edges[i]),row={start:edges[i],end:edges[i+1],total:Number(req.total||0),front:req.front==null?null:Number(req.front),back:req.back==null?null:Number(req.back)},last=demand.at(-1);
   if(last&&last.end===row.start&&['total','front','back'].every(k=>last[k]===row[k]))last.end=row.end;else demand.push(row);
  }
  return {date:day.date,type:day.type,start,end,open:day.type==='market'?(day.open??null):null,close:day.type==='market'?(day.close??null):null,preOpenMinutes:Number(day.preOpenMinutes||0),demand,program:(day.program||[]).map(p=>({title:p.title,start:p.start,end:p.end,impact:p.impact})),label:day.label||({prep:'Aufbau',market:'Markttag',after:'Nachbereitung'}[day.type]||'Tag')};
 });
}
async function planningMembership(){
 if(!['admin','planner','duty_manager'].includes(K.currentUser?.role))return null;
 const membership=await K.supabaseConnection.currentMembership();
 return membership?.active!==false&&['admin','planner','duty_manager'].includes(membership?.role)?membership:null;
}
async function publishNow(){
 if(state.inFlight)return {skipped:true,reason:'already_running'};
 state.inFlight=true;
 try{
  if(!await planningMembership())return {skipped:true,reason:'role'};
  const result=await K.supabaseConnection.publishDays({eventId:K.eventConfig?.eventId||'KC-WM-2026',days:buildRows()});
  if(result?.ok!==true)throw Error('Veröffentlichung der Tage wurde nicht bestätigt.');
  state.lastRunAt=new Date().toISOString();state.lastResult=result;state.lastError=null;return result;
 }catch(e){state.lastError=e.message;throw e;}finally{state.inFlight=false;}
}
K.daysPublishBridge={state,buildRows,publishNow,planningMembership};
})();
