(function(){
  const K=window.KCDP=window.KCDP||{};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const origBase=K.baseRequirementFor;
  K.eventConfig=K.eventConfig||{eventId:'KC-WM-2026',name:'Weihnachtsmarkt Werne 2026',timezone:'Europe/Berlin',status:'planning'};
  K.daySettings=K.daySettings||{};
  K.demandMatrix=K.demandMatrix||{};
  const dayByDate=date=>K.days.find(d=>d.date===date);
  function normalizeNullableTime(v){if(v===''||v==null)return null;const n=Number(v);if(!Number.isFinite(n)||n<0||n>=24)throw new Error('Ungültige Uhrzeit.');return n;}
  function ensureDay(date){const d=dayByDate(date);if(!d)throw new Error('Tag nicht gefunden.');if(!K.daySettings[date])K.daySettings[date]={date,start:d.start,end:d.end,open:d.open,close:d.close,preOpenMinutes:d.preOpenMinutes||0,reserveMinutes:d.type==='market'?60:0,notes:''};else if(K.daySettings[date].reserveMinutes==null)K.daySettings[date].reserveMinutes=d.type==='market'?60:0;return K.daySettings[date];}
  function intervalDefaults(date){const d=dayByDate(date);if(!d)return[];const list=[];for(let h=d.start;h<d.end;h++){const r=origBase(d,h);list.push({start:h,end:h+1,total:Number(r.total||0),front:r.front==null?null:Number(r.front),back:r.back==null?null:Number(r.back),requiredRoles:[]});}return list;}
  function ensureDemand(date){if(!Array.isArray(K.demandMatrix[date])||!K.demandMatrix[date].length)K.demandMatrix[date]=intervalDefaults(date);return K.demandMatrix[date];}
  K.days.forEach(d=>{ensureDay(d.date);ensureDemand(d.date);});
  function applyDaySettings(){for(const d of K.days){const s=ensureDay(d.date);d.start=Number(s.start);d.end=Number(s.end);d.open=s.open==null?null:Number(s.open);d.close=s.close==null?null:Number(s.close);d.preOpenMinutes=Number(s.preOpenMinutes||0);d.reserveMinutes=Math.max(0,Number(s.reserveMinutes||0));d.notes=String(s.notes||'');}}
  applyDaySettings();
  K.baseRequirementFor=(day,hour)=>{const rows=ensureDemand(day.date);const row=rows.find(r=>hour>=Number(r.start)&&hour<Number(r.end));if(row)return {total:Number(row.total||0),front:row.front==null?null:Number(row.front),back:row.back==null?null:Number(row.back),requiredRoles:clone(row.requiredRoles||[])};return origBase(day,hour);};
  K.requirementFor=(day,hour)=>{
    const base=K.baseRequirementFor(day,hour);
    if(day.type!=='market')return {...base,baseTotal:base.total,weatherExtra:0,programExtra:0,explanation:['Basis '+base.total]};
    let front=Number(base.front||0),back=Number(base.back||0);const explanation=[`Basis ${base.total} (${front}V/${back}H)`];
    const wf=Number(day.weather?.factor||1);let weatherExtra=0;if(wf!==1){weatherExtra=Math.round(base.total*(wf-1));if(weatherExtra>0)front+=weatherExtra;else if(weatherExtra<0){let rem=Math.abs(weatherExtra);while(rem>0&&front>0){front--;rem--;}while(rem>0&&back>0){back--;rem--;}}explanation.push(`Wetter ${weatherExtra>=0?'+':''}${weatherExtra}`);}
    let programExtra=0;for(const p of day.program||[]){const lead=Number(p.leadMinutes??30)/60,lag=Number(p.lagMinutes??30)/60;if(hour>=Number(p.start)-lead&&hour<Number(p.end)+lag){const fd=Number(p.frontDelta??(p.impact==='+++'?2:p.impact==='++'||p.impact==='+'?1:0)),bd=Number(p.backDelta??(p.impact==='+++'||p.impact==='++'?1:0));front+=fd;back+=bd;programExtra+=fd+bd;explanation.push(`${p.title} +${fd}V/+${bd}H`);}}
    front=Math.max(0,front);back=Math.max(0,back);return {total:front+back,front,back,baseTotal:base.total,weatherExtra,programExtra,requiredRoles:clone(base.requiredRoles||[]),explanation};
  };
  K.configuration={
    version:'0.16.0',
    ensureDay,ensureDemand,
    updateEvent(patch){K.eventConfig={...K.eventConfig,...clone(patch||{})};K.recordAudit?.('config.event.update',{entity:'event_config',entityId:K.eventConfig.eventId,after:K.eventConfig});return K.eventConfig;},
    updateDay(date,patch){const s=ensureDay(date),before=clone(s),next={...s,...clone(patch||{})};next.start=Number(next.start);next.end=Number(next.end);next.open=normalizeNullableTime(next.open);next.close=normalizeNullableTime(next.close);next.preOpenMinutes=Math.max(0,Number(next.preOpenMinutes||0));next.reserveMinutes=Math.min(180,Math.max(0,Number(next.reserveMinutes||0)));if(!(next.end>next.start))throw new Error('Tagesende muss nach Tagesbeginn liegen.');if(next.open!=null&&next.open<next.start)throw new Error('Öffnung liegt vor dem Tagesfenster.');if(next.close!=null&&next.close<=Number(next.open??next.start))throw new Error('Schließzeit muss nach Öffnung liegen.');K.daySettings[date]=next;applyDaySettings();K.recordAudit?.('config.day.update',{entity:'day_config',entityId:date,before,after:next});K.sync?.enqueue?.({entity:'day_config',operation:'update',payload:next,baseVersion:null});return next;},
    setDemandInterval(date,start,end,req){const rows=ensureDemand(date),before=clone(rows);start=Number(start);end=Number(end);if(!(end>start))throw new Error('Bedarfsintervall ungültig.');const total=Math.max(0,Number(req.total||0)),front=req.front==null?null:Math.max(0,Number(req.front)),back=req.back==null?null:Math.max(0,Number(req.back));if(front!=null&&back!=null&&front+back!==total)throw new Error('Gesamt muss V + H entsprechen.');const idx=rows.findIndex(r=>Number(r.start)===start&&Number(r.end)===end);const row={start,end,total,front,back,requiredRoles:clone(req.requiredRoles||[])};if(idx>=0)rows[idx]=row;else rows.push(row);rows.sort((a,b)=>a.start-b.start);K.recordAudit?.('config.demand.update',{entity:'demand_matrix',entityId:date,before,after:rows});K.sync?.enqueue?.({entity:'demand_matrix',operation:'update',payload:{date,rows:clone(rows)},baseVersion:null});return row;},
    copyDemand(fromDate,toDate){K.demandMatrix[toDate]=clone(ensureDemand(fromDate));K.recordAudit?.('config.demand.copy',{entity:'demand_matrix',entityId:toDate,reason:`Kopie von ${fromDate}`,after:K.demandMatrix[toDate]});return K.demandMatrix[toDate];},
    resetDemand(date){K.demandMatrix[date]=intervalDefaults(date);return K.demandMatrix[date];},
    snapshot(){return {eventConfig:clone(K.eventConfig),daySettings:clone(K.daySettings),demandMatrix:clone(K.demandMatrix)};},
    restore(s){if(s?.eventConfig)K.eventConfig=clone(s.eventConfig);if(s?.daySettings)K.daySettings=clone(s.daySettings);if(s?.demandMatrix)K.demandMatrix=clone(s.demandMatrix);applyDaySettings();K.days.forEach(d=>ensureDemand(d.date));return this.snapshot();}
  };
})();
