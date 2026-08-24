(function(){
  const K=window.KCDP=window.KCDP||{};
  K.actualShifts=K.actualShifts||[];
  K.actualImportBatches=K.actualImportBatches||[];
  K.actualCorrectionRequests=K.actualCorrectionRequests||[];
  K.actualPlanVersions=K.actualPlanVersions||[];
  K.actualConfig=K.actualConfig||{toleranceMinutes:{match:5,notice:15,deviation:30}};
  K.actualWorkflow=K.actualWorkflow||{status:'open',closedAt:null,closedBy:null,closeReason:null,version:0,reopenedAt:null,reopenedBy:null};

  const clone=v=>JSON.parse(JSON.stringify(v));
  const minutes=(end,start,breakMinutes=0)=>{const gross=Math.max(0,Math.round((Number(end)-Number(start))*60));return K.breakConfig?.hoursAccounting==='deducted'?Math.max(0,gross-Math.max(0,Number(breakMinutes)||0)):gross;};
  const overlapMinutes=(a,b)=>Math.max(0,Math.round((Math.min(a.end,b.end)-Math.max(a.start,b.start))*60));
  const sameDay=(a,b)=>a.date===b.date&&a.personId===b.personId;
  const plannedActive=s=>!['cancelled','absent','failed','deleted'].includes(s?.status);

  function statusFromDelta(startDelta,endDelta,durationDelta){
    const cfg=K.actualConfig.toleranceMinutes||{match:5,notice:15,deviation:30};
    const max=Math.max(Math.abs(startDelta||0),Math.abs(endDelta||0),Math.abs(durationDelta||0));
    if(max<=cfg.match)return 'match';
    if(max<=cfg.notice)return 'within_tolerance';
    if(max<=cfg.deviation)return 'deviation';
    return 'critical_deviation';
  }

  function plannedCandidates(actual){
    return K.shifts.filter(s=>s.layer==='planned'&&plannedActive(s)&&sameDay(s,actual));
  }

  function matchCandidate(actual){
    const candidates=plannedCandidates(actual);
    if(!candidates.length)return {planned:null,method:'none',score:null,ambiguous:false};
    const ranked=candidates.map(s=>{
      const ov=overlapMinutes(actual,s);
      const startDiff=Math.abs(Math.round((actual.start-s.start)*60));
      const endDiff=Math.abs(Math.round((actual.end-s.end)*60));
      // overlap is strongest signal; smaller start/end delta breaks ties.
      const score=ov*10-startDiff-endDiff;
      return {s,ov,startDiff,endDiff,score};
    }).sort((a,b)=>b.score-a.score);
    if(ranked.length>1&&ranked[0].score===ranked[1].score)return {planned:null,method:'ambiguous',score:ranked[0].score,ambiguous:true,candidates:ranked.slice(0,3).map(x=>x.s.id)};
    const best=ranked[0];
    // No overlap: only accept a close same-day record within 2 hours from planned start.
    if(best.ov===0&&best.startDiff>120)return {planned:null,method:'none',score:best.score,ambiguous:false};
    return {planned:best.s,method:best.ov>0?'overlap':'nearest',score:best.score,ambiguous:false};
  }

  function comparison(actual){
    const planned=actual.linkedShiftId?K.shifts.find(s=>s.id===actual.linkedShiftId):null;
    if(!planned)return {status:'no_plan',planned:null,actual,plannedMinutes:0,actualMinutes:minutes(actual.end,actual.start,actual.breakMinutes),differenceMinutes:null,startDeltaMinutes:null,endDeltaMinutes:null};
    const plannedMinutes=minutes(planned.end,planned.start,planned.breakMinutes),actualMinutes=minutes(actual.end,actual.start,actual.breakMinutes);
    const startDeltaMinutes=Math.round((actual.start-planned.start)*60),endDeltaMinutes=Math.round((actual.end-planned.end)*60),differenceMinutes=actualMinutes-plannedMinutes;
    return {status:statusFromDelta(startDeltaMinutes,endDeltaMinutes,differenceMinutes),planned,actual,plannedMinutes,actualMinutes,differenceMinutes,startDeltaMinutes,endDeltaMinutes};
  }

  function linkRecord(actual,{forceShiftId=null}={}){
    if(forceShiftId){actual.linkedShiftId=forceShiftId;actual.matchMethod='manual';}
    else if(!actual.linkedShiftId){const m=matchCandidate(actual);if(m.planned){actual.linkedShiftId=m.planned.id;actual.matchMethod=m.method;}else{actual.matchMethod=m.method;actual.matchCandidates=m.candidates||[];}}
    const planned=actual.linkedShiftId?K.shifts.find(s=>s.id===actual.linkedShiftId):null;
    if(planned){actual.zone=planned.zone;actual.area=planned.area;}
    else{actual.zone=actual.zone||'unassigned';actual.area=actual.area||'Nicht zugeordnet';}
    const c=comparison(actual);actual.comparison={status:c.status,plannedShiftId:c.planned?.id||null,plannedMinutes:c.plannedMinutes,actualMinutes:c.actualMinutes,differenceMinutes:c.differenceMinutes,startDeltaMinutes:c.startDeltaMinutes,endDeltaMinutes:c.endDeltaMinutes};
    return actual;
  }

  function missingPlanned(date=null){
    const planned=K.shifts.filter(s=>s.layer==='planned'&&plannedActive(s)&&(!date||s.date===date));
    const linked=new Set(K.actualShifts.filter(a=>!date||a.date===date).map(a=>a.linkedShiftId).filter(Boolean));
    return planned.filter(s=>!linked.has(s.id));
  }

  function dayStats(date){
    const rows=K.actualShifts.filter(a=>a.date===date&&a.status!=='deleted').map(a=>{linkRecord(a);return a;});
    const comps=rows.map(comparison),planned=K.shifts.filter(s=>s.date===date&&s.layer==='planned'&&plannedActive(s));
    const plannedMinutes=planned.reduce((n,s)=>n+minutes(s.end,s.start,s.breakMinutes),0),actualMinutes=rows.reduce((n,a)=>n+minutes(a.end,a.start,a.breakMinutes),0);
    return {
      date,planned:planned.length,actual:rows.length,matched:comps.filter(c=>c.planned).length,
      noPlan:comps.filter(c=>c.status==='no_plan').length,noActual:missingPlanned(date).length,
      within:comps.filter(c=>c.status==='match'||c.status==='within_tolerance').length,
      deviations:comps.filter(c=>c.status==='deviation').length,
      critical:comps.filter(c=>c.status==='critical_deviation').length,
      plannedMinutes,actualMinutes,differenceMinutes:actualMinutes-plannedMinutes,
      unresolved:comps.filter(c=>['no_plan','critical_deviation'].includes(c.status)).length+missingPlanned(date).length
    };
  }

  function eventStats(){
    const days=K.days.map(d=>dayStats(d.date));
    return days.reduce((a,d)=>({
      planned:a.planned+d.planned,actual:a.actual+d.actual,matched:a.matched+d.matched,noPlan:a.noPlan+d.noPlan,noActual:a.noActual+d.noActual,
      deviations:a.deviations+d.deviations,critical:a.critical+d.critical,plannedMinutes:a.plannedMinutes+d.plannedMinutes,actualMinutes:a.actualMinutes+d.actualMinutes,
      unresolved:a.unresolved+d.unresolved
    }),{planned:0,actual:0,matched:0,noPlan:0,noActual:0,deviations:0,critical:0,plannedMinutes:0,actualMinutes:0,unresolved:0});
  }

  function validateActual(candidate){
    const issues=[],p=K.person(candidate.personId);
    if(!p||!p.active)issues.push({level:'error',text:'Person ist nicht aktiv oder unbekannt.'});
    if(!candidate.date)issues.push({level:'error',text:'Datum fehlt.'});
    if(!(Number.isFinite(candidate.start)&&Number.isFinite(candidate.end))||candidate.end<=candidate.start)issues.push({level:'error',text:'Ist-Ende muss nach Ist-Beginn liegen.'});
    if(Number(candidate.breakMinutes||0)<0)issues.push({level:'error',text:'Pause darf nicht negativ sein.'});
    const overlap=K.actualShifts.filter(a=>a.id!==candidate.id&&a.personId===candidate.personId&&a.date===candidate.date&&a.status!=='deleted'&&Math.max(a.start,candidate.start)<Math.min(a.end,candidate.end));
    if(overlap.length)issues.push({level:'warn',text:'Überlappt eine weitere Istzeit dieser Person.'});
    return issues;
  }

  function saveActual(candidate,{reason='',source=candidate.source||'manual_correction',importBatchId=candidate.importBatchId||null}={}){
    K.auth?.require?.(source==='file_import'||source==='timeclock'?'roster.actual.import':'roster.actual.correct','Sie dürfen Istzeiten nicht bearbeiten.');
    if(K.actualWorkflow.status==='closed')throw new Error('Der Istplan ist abgeschlossen. Vor Änderungen muss er administrativ wieder geöffnet werden.');
    const issues=validateActual(candidate);if(issues.some(i=>i.level==='error'))throw new Error(issues.find(i=>i.level==='error').text);
    let target=candidate.id?K.actualShifts.find(a=>a.id===candidate.id):null;const before=target?clone(target):null;
    if(target)Object.assign(target,candidate,{id:target.id});else{target={...candidate,id:candidate.id||`A-${Date.now()}-${Math.random().toString(36).slice(2,6)}`};K.actualShifts.push(target);}
    target.source=source;target.importBatchId=importBatchId;target.status=target.status||'recorded';target.version=Number(target.version||0)+1;target.updatedAt=new Date().toISOString();
    if(!target.original){target.original={start:target.start,end:target.end,breakMinutes:Number(target.breakMinutes||0),source};}
    linkRecord(target);
    K.recordAudit?.(before?'actual.update':'actual.create',{entity:'actual_shift',entityId:target.id,before,after:target,reason});
    K.sync?.enqueue?.({entity:'actual_shift',operation:before?'update':'create',payload:target,baseVersion:before?.version||null});
    return {record:target,issues,comparison:target.comparison};
  }

  function importRows(rows,{batchName='Istzeitimport',source='file_import',fileMeta={}}={}){
    K.auth?.require?.('roster.actual.import','Sie dürfen keine Istzeiten importieren.');
    if(K.actualWorkflow.status==='closed')throw new Error('Der Istplan ist abgeschlossen.');
    const batch={id:`IB-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name:batchName,source,fileMeta,createdAt:new Date().toISOString(),createdBy:K.currentUser?.personId||null,total:rows.length,accepted:0,rejected:0,status:'processing'};
    K.actualImportBatches.push(batch);const results=[];
    for(const row of rows){
      try{const duplicate=K.actualShifts.find(a=>a.status!=='deleted'&&a.personId===row.personId&&a.date===row.date&&a.start===row.start&&a.end===row.end&&Number(a.breakMinutes||0)===Number(row.breakMinutes||0));if(duplicate){results.push({ok:true,skipped:true,row:duplicate,comparison:comparison(duplicate),issues:[{level:'info',text:'Identischer Istzeit-Datensatz bereits vorhanden.'}]});batch.skipped=Number(batch.skipped||0)+1;continue;}const out=saveActual({...row,source,importBatchId:batch.id},{reason:`Import ${batch.name}`,source,importBatchId:batch.id});results.push({ok:true,row:out.record,comparison:out.comparison,issues:out.issues});batch.accepted++;}
      catch(e){results.push({ok:false,row,error:e.message});batch.rejected++;}
    }
    batch.status=batch.rejected?'review':'imported';batch.completedAt=new Date().toISOString();
    K.recordAudit?.('actual.import.batch',{entity:'actual_import_batch',entityId:batch.id,after:batch,meta:{accepted:batch.accepted,rejected:batch.rejected}});
    K.sync?.enqueue?.({entity:'actual_import_batch',operation:'create',payload:batch,baseVersion:null});
    return {batch,results};
  }

  function correctActual(id,patch,{reason}={}){
    K.auth?.require?.('roster.actual.correct','Sie dürfen Istzeiten nicht korrigieren.');
    if(!String(reason||'').trim())throw new Error('Für eine Istzeitkorrektur ist ein Grund erforderlich.');
    const row=K.actualShifts.find(a=>a.id===id);if(!row)throw new Error('Istzeit nicht gefunden.');
    const before=clone(row),candidate={...row,...patch,correctedAt:new Date().toISOString(),correctedBy:K.currentUser?.personId||null,correctionReason:String(reason)};
    const out=saveActual(candidate,{reason:String(reason),source:'manual_correction',importBatchId:row.importBatchId||null});
    out.record.original=before.original||{start:before.start,end:before.end,breakMinutes:before.breakMinutes||0,source:before.source};
    return out;
  }


  function relinkActual(id,shiftId,{reason=''}={}){
    K.auth?.require?.('roster.actual.correct','Sie dürfen Istzeiten nicht zuordnen.');if(K.actualWorkflow.status==='closed')throw new Error('Der Istplan ist abgeschlossen.');if(!String(reason||'').trim())throw new Error('Für eine manuelle Soll-/Ist-Zuordnung ist ein Grund erforderlich.');
    const row=K.actualShifts.find(a=>a.id===id);if(!row)throw new Error('Istzeit nicht gefunden.');const before=clone(row),planned=shiftId?K.shifts.find(s=>s.id===shiftId&&s.layer==='planned'):null;if(shiftId&&!planned)throw new Error('Soll-Dienst nicht gefunden.');if(planned&&(planned.personId!==row.personId||planned.date!==row.date))throw new Error('Soll-Dienst gehört nicht zur selben Person und demselben Datum.');
    row.linkedShiftId=planned?.id||null;row.matchMethod=planned?'manual':'manual_unlinked';if(planned){row.zone=planned.zone;row.area=planned.area;}else{row.zone='unassigned';row.area='Nicht zugeordnet';}linkRecord(row);row.version=Number(row.version||0)+1;K.recordAudit?.('actual.relink',{entity:'actual_shift',entityId:id,before,after:row,reason});K.sync?.enqueue?.({entity:'actual_shift',operation:'update',payload:row,baseVersion:before.version||null});return row;
  }

  function createCorrectionRequest(actualId,{personId=K.currentUser?.personId,proposedStart=null,proposedEnd=null,note=''}={}){
    const actual=K.actualShifts.find(a=>a.id===actualId);if(!actual)throw new Error('Istzeit nicht gefunden.');
    if(personId!==K.currentUser?.personId)K.auth?.require?.('roster.actual.correct','Sie dürfen nur eigene Istzeiten reklamieren.');
    else K.auth?.require?.('roster.actual.dispute_own','Sie dürfen keine Abweichung melden.');
    if(actual.personId!==personId&&!K.auth?.has('roster.actual.correct'))throw new Error('Sie dürfen nur eigene Istzeiten reklamieren.');
    const req={id:`ACR-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,actualId,personId,proposedStart,proposedEnd,note:String(note||''),status:'open',createdAt:new Date().toISOString(),createdBy:K.currentUser?.personId||null,version:1};
    K.actualCorrectionRequests.push(req);K.recordAudit?.('actual.correction.request',{entity:'actual_correction_request',entityId:req.id,after:req});K.sync?.enqueue?.({entity:'actual_correction_request',operation:'create',payload:clone(req),baseVersion:null});K.notifications?.actualIssue?.(req);return req;
  }

  function resolveCorrectionRequest(id,{accept=false,reason=''}={}){
    K.auth?.require?.('roster.actual.correct','Sie dürfen Korrekturanträge nicht bearbeiten.');
    const req=K.actualCorrectionRequests.find(r=>r.id===id);if(!req)throw new Error('Korrekturantrag nicht gefunden.');if(req.status!=='open')throw new Error('Korrekturantrag ist bereits abgeschlossen.');
    const before=clone(req),baseVersion=Number(req.version||1);
    if(accept){const patch={};if(Number.isFinite(req.proposedStart))patch.start=req.proposedStart;if(Number.isFinite(req.proposedEnd))patch.end=req.proposedEnd;correctActual(req.actualId,patch,{reason:reason||req.note||'Korrekturantrag akzeptiert'});req.status='accepted';}
    else req.status='rejected';req.resolutionReason=String(reason||'');req.resolvedAt=new Date().toISOString();req.resolvedBy=K.currentUser?.personId||null;req.version=baseVersion+1;K.recordAudit?.('actual.correction.resolve',{entity:'actual_correction_request',entityId:req.id,before,after:req,reason:req.resolutionReason});K.sync?.enqueue?.({entity:'actual_correction_request',operation:'update',payload:clone(req),baseVersion});return req;
  }

  function closePlan({reason='',closedBy=K.currentUser?.displayName||'Zeitprüfer'}={}){
    K.auth?.require?.('roster.actual.close','Sie dürfen den Istplan nicht abschließen.');
    const stats=eventStats();
    if(stats.unresolved&&!String(reason||'').trim())throw new Error(`Es bestehen ${stats.unresolved} ungeklärte Soll-/Ist-Fälle. Zum Abschluss ist ein Begründungstext erforderlich.`);
    const version=Number(K.actualWorkflow.version||0)+1,snapshot={version,closedAt:new Date().toISOString(),closedBy,reason:String(reason||''),stats,actualShifts:clone(K.actualShifts),correctionRequests:clone(K.actualCorrectionRequests),breakConfig:clone(K.breakConfig||{})};
    K.actualPlanVersions.push(snapshot);K.actualWorkflow={...K.actualWorkflow,status:'closed',closedAt:snapshot.closedAt,closedBy,closeReason:snapshot.reason,version};
    K.recordAudit?.('actual.plan.close',{entity:'actual_plan_version',entityId:String(version),after:{version,closedBy,reason:snapshot.reason,stats}});K.sync?.enqueue?.({entity:'actual_plan_version',operation:'close',payload:snapshot,baseVersion:version-1});return snapshot;
  }

  function reopenPlan({reason='',reopenedBy=K.currentUser?.displayName||'Administrator'}={}){
    K.auth?.require?.('roster.actual.reopen','Sie dürfen einen abgeschlossenen Istplan nicht wieder öffnen.');if(K.actualWorkflow.status!=='closed')throw new Error('Istplan ist nicht abgeschlossen.');if(!String(reason||'').trim())throw new Error('Wiederöffnung erfordert eine Begründung.');
    K.actualWorkflow={...K.actualWorkflow,status:'review',reopenedAt:new Date().toISOString(),reopenedBy,reopenReason:String(reason)};K.recordAudit?.('actual.plan.reopen',{entity:'actual_plan',reason,after:K.actualWorkflow});return K.actualWorkflow;
  }

  function coverageAt(day,time){
    const active=K.actualShifts.filter(a=>a.date===day.date&&a.status!=='deleted'&&a.start<=time&&a.end>time).map(a=>{linkRecord(a);return a;});
    const special=active.filter(a=>a.zone==='special'),unassigned=active.filter(a=>a.zone==='unassigned'),stand=active.filter(a=>a.zone!=='special'&&a.zone!=='unassigned'),req=K.requirementFor(day,time);
    return {req,total:stand.length,front:stand.filter(a=>a.zone==='front').length,back:stand.filter(a=>a.zone==='back').length,special:special.length,unassigned:unassigned.length,active:stand,specialActive:special,unassignedActive:unassigned};
  }

  K.actual={version:'0.7.0',minutes,overlapMinutes,statusFromDelta,matchCandidate,linkRecord,comparison,missingPlanned,dayStats,eventStats,validateActual,saveActual,importRows,correctActual,relinkActual,createCorrectionRequest,resolveCorrectionRequest,closePlan,reopenPlan,coverageAt};
})();
