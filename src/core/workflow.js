(function(){
  const K=window.KCDP;
  if(!K)throw new Error('KCDP model must load before workflow core');

  K.workflow=K.workflow||{
    status:'draft',
    currentVersion:0,
    publishedVersion:null,
    publishedAt:null,
    publishedBy:null,
    publishedFingerprint:null,
    revisionOpenedAt:null,
    revisionReason:null
  };
  K.planVersions=K.planVersions||[];
  K.acknowledgements=K.acknowledgements||[];
  K.swapRequests=K.swapRequests||[];
  K.currentUser=K.currentUser||{personId:K.people?.[0]?.personId||null,role:'planner',displayName:'Planer'};

  const clone=v=>JSON.parse(JSON.stringify(v));
  const ordered=(list,keys)=>list.map(x=>{
    const o={};keys.forEach(k=>o[k]=x[k]??null);return o;
  }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));

  K.currentPlanFingerprint=function(){
    const shifts=ordered(K.shifts.filter(s=>s.layer==='planned'),['id','personId','date','start','end','zone','area','breakMinutes','breakSegments','status','replacementForShiftId','absenceId']);
    const standby=ordered(K.standby.filter(s=>s.status!=='cancelled'),['id','personId','date','start','end','phone']);
    const breakConfig=K.breakConfig?{enabled:!!K.breakConfig.enabled,thresholds:K.breakConfig.thresholds,minSegmentMinutes:K.breakConfig.minSegmentMinutes,maxContinuousHours:K.breakConfig.maxContinuousHours,coverageImpact:!!K.breakConfig.coverageImpact,hoursAccounting:K.breakConfig.hoursAccounting,enforcement:K.breakConfig.enforcement}:null;
    return JSON.stringify({shifts,standby,breakConfig});
  };

  K.latestPublishedVersion=function(){
    if(!K.planVersions.length)return null;
    return [...K.planVersions].sort((a,b)=>b.version-a.version)[0]||null;
  };


  K.shiftPublicationState=function(shift){
    const latest=K.latestPublishedVersion();
    if(!latest)return 'draft';
    const old=latest.shifts.find(s=>s.id===shift.id);
    if(!old)return 'new';
    const keys=['personId','date','start','end','zone','area','breakMinutes','breakSegments','status','replacementForShiftId','absenceId'];
    return keys.some(k=>(old[k]??null)!==(shift[k]??null))?'changed':'unchanged';
  };

  K.visiblePlannedShifts=function(date=null){
    const canDraft=K.auth?.has?.('roster.plan.view_draft')||K.auth?.has?.('*');
    let rows;
    if(canDraft)rows=K.shifts.filter(s=>s.layer==='planned');
    else{const latest=K.latestPublishedVersion();rows=latest?latest.shifts:[];}
    const out=date?rows.filter(s=>s.date===date):rows;
    return clone(out);
  };

  K.publishedPlanFeed=function(){
    const latest=K.latestPublishedVersion();
    if(!latest)return {status:'none',version:null,publishedAt:null,shifts:[],standby:[]};
    return {status:'published',version:latest.version,publishedAt:latest.publishedAt,publishedBy:latest.publishedBy,quality:latest.quality,shifts:clone(latest.shifts),standby:clone(latest.standby)};
  };

  K.designerDutyFeed=function({asOf=new Date().toISOString()}={}){
    const latest=K.latestPublishedVersion();
    if(!latest)return {schema:'KC_DESIGNER_DUTY_FEED_V1',sourceStatus:'none',version:null,members:[]};
    const ref=new Date(asOf),today=ref.toISOString().slice(0,10),nowHour=ref.getHours()+ref.getMinutes()/60;
    const fmtDate=iso=>new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long'}).format(new Date(iso+'T12:00:00'));
    const fmtTime=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h%1)*60)).padStart(2,'0')}`;
    const shifts=latest.shifts.filter(s=>s.zone!=='special'&&!['cancelled','absent','failed','deleted'].includes(s.status)&&(s.date>today||(s.date===today&&s.end>nowHour))).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
    const members=K.people.filter(p=>p.active).map(p=>{
      const next=shifts.find(s=>s.personId===p.personId);const personView=K.personAdapter?.view?.(p.personId,'designer')||{personId:p.personId,displayName:p.name};
      return {personId:p.personId,publicDisplayName:personView.displayName,nextShift:next?{date:next.date,start:fmtTime(next.start),end:fmtTime(next.end),zone:next.zone,area:next.area,planVersion:latest.version,status:'published',formatted:`${fmtDate(next.date)}, ${fmtTime(next.start)}–${fmtTime(next.end)} Uhr`}:null};
    });
    return {schema:'KC_DESIGNER_DUTY_FEED_V1',sourceStatus:'published',version:latest.version,publishedAt:latest.publishedAt,members};
  };

  K.refreshWorkflowState=function(){
    const latest=K.latestPublishedVersion();
    if(!latest){
      K.workflow.status='draft';
      K.workflow.currentVersion=0;
      K.workflow.publishedVersion=null;
      K.workflow.publishedFingerprint=null;
      return K.workflow;
    }
    K.workflow.currentVersion=latest.version;
    K.workflow.publishedVersion=latest.version;
    K.workflow.publishedAt=latest.publishedAt;
    K.workflow.publishedBy=latest.publishedBy;
    K.workflow.publishedFingerprint=latest.fingerprint;
    const changed=K.currentPlanFingerprint()!==latest.fingerprint;
    if(changed){
      if(K.workflow.status!=='revision')K.workflow.revisionOpenedAt=new Date().toISOString();
      K.workflow.status='revision';
    }else{
      K.workflow.status='published';
      K.workflow.revisionOpenedAt=null;
      K.workflow.revisionReason=null;
    }
    return K.workflow;
  };

  K.workflowLabel=function(){
    K.refreshWorkflowState();
    if(K.workflow.status==='draft')return 'Entwurf';
    if(K.workflow.status==='revision')return `Revision offen · V${K.workflow.publishedVersion}`;
    return `Veröffentlicht · V${K.workflow.publishedVersion}`;
  };

  K.planPublicationCheck=function(){
    const days=K.days.map(day=>({day,evaluation:K.evaluateDay(day)}));
    const critical=days.reduce((n,x)=>n+x.evaluation.critical,0);
    const wishViolations=days.reduce((n,x)=>n+x.evaluation.wishViolations,0);
    const quality=Math.round(days.reduce((n,x)=>n+x.evaluation.quality,0)/Math.max(1,days.length));
    const underDays=days.filter(x=>x.evaluation.critical>0).map(x=>x.day.date);
    const openSwaps=K.swapRequests.filter(r=>r.status==='open').length;
    const pauseIssues=(K.breakConfig?.enabled&&K.breaks)?K.shifts.filter(s=>s.layer==='planned'&&!['cancelled','absent','failed','deleted'].includes(s.status)).flatMap(s=>K.breaks.compliance(s).issues.map(i=>({...i,shiftId:s.id,personId:s.personId,date:s.date}))):[];
    const pauseErrors=pauseIssues.filter(i=>i.level==='error').length;
    const pauseWarnings=pauseIssues.filter(i=>i.level!=='error').length;
    return {critical,wishViolations,quality,underDays,openSwaps,pauseIssues,pauseErrors,pauseWarnings,canPublish:pauseErrors===0};
  };

  K.publishPlan=function({publishedBy='Planer',reason=''}={}){
    K.auth?.require?.('roster.plan.publish','Sie dürfen keinen Sollplan veröffentlichen.');
    const check=K.planPublicationCheck();
    if(!check.canPublish)throw new Error(`Veröffentlichung blockiert: ${check.pauseErrors} Pausenregel-Fehler.`);
    if(check.critical>0&&!String(reason||'').trim())throw new Error(`Veröffentlichung enthält ${check.critical} kritische Besetzungsabweichungen. Bitte begründen Sie die bewusste Freigabe.`);
    const previousPublished=K.latestPublishedVersion();
    const version=(previousPublished?.version||0)+1;
    const fingerprint=K.currentPlanFingerprint();
    const snapshot={
      version,
      publishedAt:new Date().toISOString(),
      publishedBy,
      reason:String(reason||''),
      fingerprint,
      quality:check.quality,
      criticalAtPublication:check.critical,
      shifts:clone(K.shifts.filter(s=>s.layer==='planned')),
      breakConfig:clone(K.breakConfig||{}),
      standby:clone(K.standby.filter(s=>s.status!=='cancelled'))
    };
    K.planVersions.push(snapshot);
    K.recordAudit?.('plan.publish',{entity:'plan_version',entityId:String(version),after:{version,publishedBy,reason,quality:check.quality,critical:check.critical}});
    K.sync?.enqueue?.({entity:'plan_version',operation:'publish',payload:snapshot,baseVersion:version-1});
    K.notifications?.onPlanPublished?.(snapshot,previousPublished);
    K.pushAdapter?.publishPreview?.(snapshot).catch(e=>{K.pushAdapter.state.lastError='Nachtversand-Vorschau: '+e.message;});
    K.workflow={
      ...K.workflow,
      status:'published',currentVersion:version,publishedVersion:version,
      publishedAt:snapshot.publishedAt,publishedBy,publishedFingerprint:fingerprint,
      revisionOpenedAt:null,revisionReason:null
    };
    return snapshot;
  };

  K.markPlanSeen=function(personId){
    if(personId!==K.currentUser?.personId)K.auth?.require?.('roster.plan.publish','Sie dürfen nur Ihren eigenen Gesehen-Status setzen.');
    else K.auth?.require?.('roster.plan.mark_seen','Sie dürfen den Plan nicht bestätigen.');
    const latest=K.latestPublishedVersion();
    if(!latest)throw new Error('Noch kein veröffentlichter Sollplan vorhanden.');
    const existing=K.acknowledgements.find(a=>a.personId===personId&&a.version===latest.version);
    if(existing){existing.seenAt=new Date().toISOString();return existing;}
    const ack={id:`ACK-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,personId,version:latest.version,seenAt:new Date().toISOString()};
    K.acknowledgements.push(ack);return ack;
  };

  K.seenStats=function(){
    const latest=K.latestPublishedVersion();
    if(!latest)return {seen:0,total:K.people.filter(p=>p.active).length,version:null};
    const activeIds=new Set(K.people.filter(p=>p.active).map(p=>p.personId));
    const seen=new Set(K.acknowledgements.filter(a=>a.version===latest.version&&activeIds.has(a.personId)).map(a=>a.personId)).size;
    return {seen,total:activeIds.size,version:latest.version};
  };

  K.createSwapRequest=function({shiftId,requestedBy,note='',preferredReplacement=null}={}){
    K.auth?.require?.('roster.swap.request','Sie dürfen keine Tauschanfrage anlegen.');
    const shift=K.shifts.find(s=>s.id===shiftId&&s.layer==='planned');
    if(!shift)throw new Error('Soll-Dienst wurde nicht gefunden.');
    const actorId=K.currentUser?.personId||null;
    const canRequestForOthers=!!(K.auth?.has?.('roster.swap.resolve')||K.auth?.has?.('roster.plan.edit')||K.auth?.has?.('*'));
    if(!canRequestForOthers&&shift.personId!==actorId)throw new Error('Sie dürfen nur für Ihren eigenen Dienst eine Tauschanfrage anlegen.');
    if(!canRequestForOthers&&requestedBy&&requestedBy!==actorId)throw new Error('Die anfragende Person darf nicht verändert werden.');
    const req={
      id:`SWAP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      shiftId,requestedBy:canRequestForOthers?(requestedBy||shift.personId):actorId,note:String(note||''),preferredReplacement,
      status:'open',createdAt:new Date().toISOString(),resolvedAt:null,resolvedBy:null,replacementPersonId:null,version:1
    };
    K.swapRequests.push(req);
    K.recordAudit?.('swap.request',{entity:'swap_request',entityId:req.id,after:req,reason:req.note});
    K.sync?.enqueue?.({entity:'swap_request',operation:'create',payload:req,baseVersion:null});
    K.notifications?.onSwapRequest?.(req);return req;
  };

  K.resolveSwapRequest=function(requestId,{replacementPersonId,resolvedBy='Planer'}={}){
    K.auth?.require?.('roster.swap.resolve','Sie dürfen Tauschanfragen nicht auflösen.');
    const req=K.swapRequests.find(r=>r.id===requestId);
    if(!req)throw new Error('Tauschanfrage wurde nicht gefunden.');
    if(req.status!=='open')throw new Error('Tauschanfrage ist bereits abgeschlossen.');
    const shift=K.shifts.find(s=>s.id===req.shiftId);
    const person=K.person(replacementPersonId);
    if(!shift||!person)throw new Error('Dienst oder Ersatzperson fehlt.');
    const candidate={...shift,personId:replacementPersonId};
    const issues=K.validateShift(candidate);
    if(issues.some(i=>i.level==='error'))throw new Error(issues.find(i=>i.level==='error').text);
    const oldPersonId=shift.personId;
    const beforeShift=clone(shift),beforeReq=clone(req),baseVersion=Number(shift.version||0);
    shift.personId=replacementPersonId;shift.version=baseVersion+1;
    req.status='accepted';req.replacementPersonId=replacementPersonId;req.oldPersonId=oldPersonId;
    req.resolvedAt=new Date().toISOString();req.resolvedBy=resolvedBy;req.version=Number(req.version||0)+1;
    K.recordAudit?.('swap.resolve',{entity:'shift',entityId:shift.id,before:beforeShift,after:shift,reason:req.note||'Ersatz'});
    K.recordAudit?.('swap.request.resolve',{entity:'swap_request',entityId:req.id,before:beforeReq,after:req,reason:req.note||'Ersatz'});
    K.sync?.enqueue?.({entity:'shift',operation:'update',payload:clone(shift),baseVersion});
    K.sync?.enqueue?.({entity:'swap_request',operation:'update',payload:clone(req),baseVersion:Number(beforeReq.version||1)});
    K.refreshWorkflowState();K.notifications?.onSwapResolved?.(req,shift);
    return {request:req,shift,issues};
  };

  K.rejectSwapRequest=function(requestId,{resolvedBy='Planer',reason=''}={}){
    K.auth?.require?.('roster.swap.resolve','Sie dürfen Tauschanfragen nicht auflösen.');
    const req=K.swapRequests.find(r=>r.id===requestId);
    if(!req)throw new Error('Tauschanfrage wurde nicht gefunden.');
    const before=clone(req);req.status='rejected';req.resolvedAt=new Date().toISOString();req.resolvedBy=resolvedBy;req.resolutionNote=reason;req.version=Number(req.version||0)+1;
    K.recordAudit?.('swap.request.reject',{entity:'swap_request',entityId:req.id,before,after:req,reason});
    K.sync?.enqueue?.({entity:'swap_request',operation:'update',payload:clone(req),baseVersion:Number(before.version||1)});
    return req;
  };
})();
