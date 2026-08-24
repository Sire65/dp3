(function(){
  const K=window.KCDP=window.KCDP||{};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const activeStatus=s=>!['cancelled','absent','failed','deleted'].includes(s?.status);
  const dur=s=>K.breaks?.countedHours?.(s)??Math.max(0,Number(s.end)-Number(s.start));
  const fmtTime=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h%1)*60)).padStart(2,'0')}`;

  K.personRules=K.personRules||{};
  K.absences=K.absences||[];
  K.replacementRequests=K.replacementRequests||[];

  function defaults(person){
    return {
      personId:person.personId,
      maxDailyHours:Number(person.maxHours||8),
      maxEventHours:null,
      earliestStart:null,
      latestEnd:null,
      forbiddenDates:[],
      allowedZones:['front','back','special','neutral'],
      allowedAreas:[],
      enforceAllowedAreas:false,
      preferredAreas:[],
      preferredZone:null,
      preferredArea:'',
      avoidLateAfter:null,
      minRestHours:null,
      notes:'',
      updatedAt:null,
      updatedBy:null
    };
  }
  function rulesFor(personId){
    const p=K.person(personId);if(!p)return null;
    return {...defaults(p),...(K.personRules[personId]||{}),personId};
  }
  function canViewRules(personId){return K.auth?.has?.('roster.rules.view')||K.auth?.has?.('*')||(K.auth?.has?.('roster.rules.view_own')&&K.auth?.own?.(personId));}
  function setRules(personId,patch,{reason='Einsatzregeln geändert'}={}){
    K.auth?.require?.('roster.rules.edit','Sie dürfen persönliche Einsatzregeln nicht bearbeiten.');
    const p=K.person(personId);if(!p)throw new Error('Person nicht gefunden.');
    const before=rulesFor(personId),next={...before,...clone(patch),personId,updatedAt:new Date().toISOString(),updatedBy:K.currentUser?.displayName||null};
    if(next.maxDailyHours!=null&&Number(next.maxDailyHours)<=0)throw new Error('Maximale Tagesstunden müssen größer als 0 sein.');
    if(next.maxEventHours!=null&&Number(next.maxEventHours)<=0)throw new Error('Maximale Veranstaltungsstunden müssen größer als 0 sein.');
    if(next.earliestStart!=null&&next.latestEnd!=null&&Number(next.latestEnd)<=Number(next.earliestStart))throw new Error('Spätestes Ende muss nach dem frühesten Beginn liegen.');
    if(next.preferredZone!=null&&!['front','back','special','neutral'].includes(next.preferredZone))throw new Error('Unbekannte Standard-Dienstklasse.');
    K.personRules[personId]=next;
    K.recordAudit?.('person.rules.update',{entity:'person_rules',entityId:personId,before,after:next,reason});
    K.sync?.enqueue?.({entity:'person_rules',operation:'update',payload:next,baseVersion:null});
    return clone(next);
  }

  function qualificationOk(person,zone){
    if(!person)return false;if(zone==='neutral'||zone==='special')return true;
    const sk=String(person.skills||'').toLowerCase();
    if(zone==='front')return sk.includes('vorne')||sk.includes('getränke')||sk.includes('flex');
    if(zone==='back')return sk.includes('hinten')||sk.includes('küche')||sk.includes('flex');
    return true;
  }
  function dailyHours(personId,date,excludeId=null){return K.shifts.filter(s=>s.layer==='planned'&&activeStatus(s)&&s.personId===personId&&s.date===date&&s.id!==excludeId).reduce((n,s)=>n+dur(s),0);}
  function eventHours(personId,excludeId=null){return K.shifts.filter(s=>s.layer==='planned'&&activeStatus(s)&&s.personId===personId&&s.id!==excludeId).reduce((n,s)=>n+dur(s),0);}
  function dateTime(date,h){return new Date(`${date}T00:00:00`).getTime()+Number(h)*3600000;}
  function restIssues(personId,candidate,rules){
    const min=Number(rules.minRestHours);if(!Number.isFinite(min)||min<=0)return [];
    const start=dateTime(candidate.date,candidate.start),end=dateTime(candidate.date,candidate.end),out=[];
    const others=K.shifts.filter(s=>s.layer==='planned'&&activeStatus(s)&&s.personId===personId&&s.id!==candidate.id);
    for(const s of others){
      const ss=dateTime(s.date,s.start),se=dateTime(s.date,s.end);
      if(se<=start){const gap=(start-se)/3600000;if(gap<min)out.push({level:'error',code:'min_rest',text:`Mindestruhezeit ${min} Std. unterschritten (${gap.toFixed(1)} Std.).`});}
      else if(end<=ss){const gap=(ss-end)/3600000;if(gap<min)out.push({level:'error',code:'min_rest',text:`Mindestruhezeit ${min} Std. unterschritten (${gap.toFixed(1)} Std.).`});}
    }
    return out;
  }
  function ruleIssues(candidate,{includeSoft=true}={}){
    const p=K.person(candidate.personId),r=rulesFor(candidate.personId),issues=[];if(!p||!r)return issues;
    const h=dur(candidate),dayHours=dailyHours(candidate.personId,candidate.date,candidate.id)+h,eventTotal=eventHours(candidate.personId,candidate.id)+h,existing=K.shifts.find(s=>s.id===candidate.id),sameOwner=existing&&existing.personId===candidate.personId&&existing.date===candidate.date,oldDayHours=sameOwner?dailyHours(existing.personId,existing.date,existing.id)+dur(existing):0,oldEventTotal=sameOwner?eventHours(existing.personId,existing.id)+dur(existing):0;
    if(!qualificationOk(p,candidate.zone))issues.push({level:'error',code:'qualification',text:`Qualifikation für ${candidate.zone==='front'?'Vorne':'Hinten'} fehlt.`});
    if(r.maxDailyHours!=null&&dayHours>Number(r.maxDailyHours)+1e-9&&(!sameOwner||dayHours>oldDayHours+1e-9))issues.push({level:'error',code:'max_daily',text:`Persönliche Höchstzeit an diesem Tag: maximal ${r.maxDailyHours} Std. Nach dieser Änderung wären ${dayHours.toFixed(1)} Std. geplant. Bitte den Balken verkürzen oder einen anderen Dienst dieses Tages anpassen.`});
    if(r.maxEventHours!=null&&eventTotal>Number(r.maxEventHours)+1e-9&&(!sameOwner||eventTotal>oldEventTotal+1e-9))issues.push({level:'error',code:'max_event',text:`Persönliche Höchstzeit für die Veranstaltung: maximal ${r.maxEventHours} Std. Nach dieser Änderung wären ${eventTotal.toFixed(1)} Std. geplant. Bitte den Balken verkürzen oder andere Dienste dieser Person anpassen.`});
    if(r.earliestStart!=null&&candidate.start<Number(r.earliestStart))issues.push({level:'error',code:'earliest_start',text:`Darf laut Einsatzregel nicht vor ${fmtTime(Number(r.earliestStart))} Uhr beginnen.`});
    if(r.latestEnd!=null&&candidate.end>Number(r.latestEnd))issues.push({level:'error',code:'latest_end',text:`Darf laut Einsatzregel nicht nach ${fmtTime(Number(r.latestEnd))} Uhr eingesetzt werden.`});
    if((r.forbiddenDates||[]).includes(candidate.date))issues.push({level:'error',code:'forbidden_date',text:'Für diesen Tag ist eine persönliche Einsatzsperre hinterlegt.'});
    if(Array.isArray(r.allowedZones)&&r.allowedZones.length&&!r.allowedZones.includes(candidate.zone))issues.push({level:'error',code:'zone_restricted',text:'Diese Dienstklasse ist laut persönlicher Einsatzregel nicht erlaubt.'});
    if(Array.isArray(r.allowedAreas)&&r.allowedAreas.length&&!r.allowedAreas.includes(candidate.area))issues.push({level:r.enforceAllowedAreas?'error':'warn',code:'area_restricted',text:`Bereich „${candidate.area}“ liegt außerhalb der persönlichen Bereichsregel.`});
    issues.push(...restIssues(candidate.personId,candidate,r));
    if(includeSoft&&r.avoidLateAfter!=null&&candidate.end>Number(r.avoidLateAfter))issues.push({level:'warn',code:'late_preference',text:`Persönliche Präferenz: möglichst nicht nach ${fmtTime(Number(r.avoidLateAfter))} Uhr.`});
    if(includeSoft&&Array.isArray(r.preferredAreas)&&r.preferredAreas.length&&candidate.area&&!r.preferredAreas.includes(candidate.area))issues.push({level:'warn',code:'preferred_area',text:'Anderer Bereich als persönliche Präferenz.'});
    return issues;
  }
  function ruleSummary(personId){
    const r=rulesFor(personId);if(!r)return 'Keine Einsatzregeln';
    const parts=[`max. ${r.maxDailyHours} h/Tag`];
    if(r.maxEventHours!=null)parts.push(`max. ${r.maxEventHours} h gesamt`);
    if(r.earliestStart!=null)parts.push(`ab ${fmtTime(Number(r.earliestStart))}`);
    if(r.latestEnd!=null)parts.push(`bis ${fmtTime(Number(r.latestEnd))}`);
    if(r.minRestHours!=null)parts.push(`${r.minRestHours} h Ruhezeit`);
    if((r.forbiddenDates||[]).length)parts.push(`${r.forbiddenDates.length} Sperrtag(e)`);
    if((r.preferredAreas||[]).length)parts.push(`bevorzugt ${r.preferredAreas.join(', ')}`);
    if(r.preferredZone)parts.push(`Standard ${r.preferredZone==='special'?'Z':r.preferredZone==='front'?'V':r.preferredZone==='back'?'H':'Vor-/Nachbereitung'}${r.preferredArea?' · '+r.preferredArea:''}`);
    return parts.join(' · ');
  }

  function overlap(personId,date,start,end,excludeId=null){return K.shifts.some(s=>s.layer==='planned'&&activeStatus(s)&&s.personId===personId&&s.date===date&&s.id!==excludeId&&Math.max(s.start,start)<Math.min(s.end,end));}
  function standbyCover(personId,date,start,end){return K.standby.find(s=>s.status!=='cancelled'&&s.personId===personId&&s.date===date&&s.start<=start&&s.end>=end)||null;}
  function wishPoints(personId,date,start,end){const w=K.wishCoverage(personId,date,start,end);if(w.unavailable)return {blocked:true,points:-10000,label:'Nicht verfügbar'};if(w.preferred)return {blocked:false,points:45,label:'Bevorzugt'};if(w.available)return {blocked:false,points:25,label:'Verfügbar'};if(w.ifNeeded)return {blocked:false,points:-8,label:'Nur wenn nötig'};return {blocked:false,points:0,label:'kein Wunsch'};}
  function replacementSearch({date,start,end,zone='front',area=null,excludePersonId=null,replacementForShiftId=null,mode='shift'}={}){
    K.auth?.require?.('roster.replacement.search','Sie dürfen keine Ersatz-/Lückensuche ausführen.');
    const candidates=[],blocked=[];
    for(const p of K.people.filter(p=>p.active&&p.personId!==excludePersonId)){
      const reasons=[],candidate={id:replacementForShiftId||'',personId:p.personId,date,start,end,zone:mode==='standby'?'neutral':zone,area:area||((zone==='front')?'Verkauf':zone==='back'?'Hinten':'Vor-/Nachbereitung'),breakMinutes:0};
      if(mode!=='standby'&&overlap(p.personId,date,start,end,replacementForShiftId)){blocked.push({personId:p.personId,name:p.name,reason:'bereits anderweitig eingeteilt'});continue;}
      if(mode==='standby'&&K.standby.some(s=>s.status!=='cancelled'&&s.personId===p.personId&&s.date===date&&Math.max(s.start,start)<Math.min(s.end,end))){blocked.push({personId:p.personId,name:p.name,reason:'bereits in Bereitschaft'});continue;}
      if(!K.helperAvailable(p,date,start,end)){blocked.push({personId:p.personId,name:p.name,reason:'Aushilfe außerhalb Zeitmatrix'});continue;}
      const wp=wishPoints(p.personId,date,start,end);if(wp.blocked){blocked.push({personId:p.personId,name:p.name,reason:'Wunsch: nicht verfügbar'});continue;}
      let errors=[];if(mode!=='standby')errors=ruleIssues(candidate,{includeSoft:false}).filter(i=>i.level==='error');
      else{const r=rulesFor(p.personId);if((r.forbiddenDates||[]).includes(date))errors.push({text:'persönliche Einsatzsperre'});if(r.earliestStart!=null&&start<Number(r.earliestStart))errors.push({text:'vor frühestem Beginn'});if(r.latestEnd!=null&&end>Number(r.latestEnd))errors.push({text:'nach spätestem Ende'});}
      if(errors.length){blocked.push({personId:p.personId,name:p.name,reason:errors[0].text});continue;}
      let score=100+wp.points;reasons.push(wp.label);
      if(mode!=='standby'){
        if(qualificationOk(p,zone)){score+=35;reasons.push('Qualifikation passt');}
        const sby=standbyCover(p.personId,date,start,end);if(sby){score+=90;reasons.push('bereits in Bereitschaft');}
        const r=rulesFor(p.personId);if((r.preferredAreas||[]).includes(candidate.area)){score+=15;reasons.push('bevorzugter Bereich');}
        if(r.avoidLateAfter!=null&&end>Number(r.avoidLateAfter)){score-=15;reasons.push('später als Präferenz');}
        score-=eventHours(p.personId)*1.2;
      }else{
        score-=eventHours(p.personId)*.8;reasons.push('für Bereitschaft verfügbar');
      }
      if(p.personType==='helper'){score-=4;reasons.push('Aushilfe');}
      candidates.push({personId:p.personId,name:p.name,personType:p.personType,score:Math.round(score),reasons,standbyId:standbyCover(p.personId,date,start,end)?.id||null,plannedHours:eventHours(p.personId)});
    }
    candidates.sort((a,b)=>b.score-a.score||a.plannedHours-b.plannedHours||a.name.localeCompare(b.name,'de'));
    return {date,start,end,zone,area,mode,replacementForShiftId,candidates,blocked};
  }

  function markShiftAbsent(shiftId,{reason,type='short_notice'}={}){
    K.auth?.require?.('roster.absence.manage','Sie dürfen Ausfälle nicht erfassen.');
    const shift=K.shifts.find(s=>s.id===shiftId&&s.layer==='planned');if(!shift)throw new Error('Soll-Dienst nicht gefunden.');if(!String(reason||'').trim())throw new Error('Für einen Ausfall ist eine Begründung erforderlich.');
    if(shift.status==='absent')return K.absences.find(a=>a.shiftId===shiftId&&a.status!=='closed')||null;
    const before=clone(shift),baseVersion=Number(shift.version||0),row={id:`ABS-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,shiftId,personId:shift.personId,date:shift.date,start:shift.start,end:shift.end,zone:shift.zone,area:shift.area,type,status:'replacement_needed',reason:String(reason),createdAt:new Date().toISOString(),createdBy:K.currentUser?.displayName||null,replacementShiftId:null,version:1};
    shift.status='absent';shift.absenceId=row.id;shift.version=baseVersion+1;K.absences.push(row);
    K.recordAudit?.('shift.absent',{entity:'shift',entityId:shift.id,before,after:shift,reason});
    K.sync?.enqueue?.({entity:'shift',operation:'update',payload:clone(shift),baseVersion});
    K.sync?.enqueue?.({entity:'absence',operation:'create',payload:clone(row),baseVersion:null});K.refreshWorkflowState?.();
    return row;
  }
  function closeAbsenceForReplacement(replacement){
    if(!replacement.replacementForShiftId)return;const a=K.absences.find(x=>x.shiftId===replacement.replacementForShiftId&&x.status!=='closed');if(a){const before=clone(a),baseVersion=Number(a.version||1);a.status='replacement_found';a.replacementShiftId=replacement.id;a.resolvedAt=new Date().toISOString();a.resolvedBy=K.currentUser?.displayName||null;a.version=baseVersion+1;K.recordAudit?.('absence.replacement_found',{entity:'absence',entityId:a.id,before,after:a,reason:'Ersatzdienst verknüpft'});K.sync?.enqueue?.({entity:'absence',operation:'update',payload:clone(a),baseVersion});}
  }
  function assignReplacement({personId,date,start,end,zone='front',area='Verkauf',replacementForShiftId=null,reason='',standbyId=null}={}){
    K.auth?.require?.('roster.replacement.assign','Sie dürfen keinen Ersatz einsetzen.');if(!String(reason||'').trim())throw new Error('Für kurzfristigen Ersatz ist eine Begründung erforderlich.');
    const candidate={personId,date,start,end,zone,area,layer:'planned',breakMinutes:0,status:'draft',source:'replacement',replacementForShiftId:replacementForShiftId||null};
    const issues=K.validateShift(candidate);const error=issues.find(i=>i.level==='error');if(error)throw new Error(error.text);
    if(standbyId)return activateStandby(standbyId,{start,end,zone,area,reason,replacementForShiftId});
    const out=K.mutations.saveShift(candidate,{reason:`Ersatz: ${reason}`});out.record.source='replacement';out.record.replacementForShiftId=replacementForShiftId||null;closeAbsenceForReplacement(out.record);K.refreshWorkflowState?.();return {...out,activatedStandby:false};
  }
  function activateStandby(standbyId,{start,end,zone='front',area='Verkauf',reason='',replacementForShiftId=null}={}){
    K.auth?.require?.('roster.replacement.assign','Sie dürfen Bereitschaft nicht als Ersatz aktivieren.');if(!String(reason||'').trim())throw new Error('Für die Aktivierung ist eine Begründung erforderlich.');
    const b=K.standby.find(x=>x.id===standbyId&&x.status!=='cancelled');if(!b)throw new Error('Bereitschaft nicht gefunden.');if(start<b.start||end>b.end||end<=start)throw new Error('Aktivierungszeit muss innerhalb der Bereitschaft liegen.');
    const candidate={id:'',personId:b.personId,date:b.date,start,end,zone,area,layer:'planned',breakMinutes:0,status:'draft',source:'standby_activation',replacementForShiftId:replacementForShiftId||null};const issues=K.validateShift(candidate),error=issues.find(i=>i.level==='error');if(error)throw new Error(error.text);
    const beforeStandby=clone(b),beforeShifts=K.shifts.length,idx=K.standby.findIndex(x=>x.id===b.id);K.standby.splice(idx,1);const parts=[];
    if(b.start<start)parts.push({...b,id:`B-${Date.now()}-A-${Math.random().toString(36).slice(2,5)}`,end:start,version:Number(b.version||0)+1});
    if(end<b.end)parts.push({...b,id:`B-${Date.now()}-B-${Math.random().toString(36).slice(2,5)}`,start:end,version:Number(b.version||0)+1});
    K.standby.push(...parts);const shift={...candidate,id:`S-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,version:1};K.shifts.push(shift);closeAbsenceForReplacement(shift);
    K.recordAudit?.('standby.activate',{entity:'standby_activation',entityId:b.id,before:{standby:beforeStandby},after:{shift,remainingStandby:parts},reason});K.sync?.enqueue?.({entity:'standby_activation',operation:'activate',payload:{standbyId:b.id,shift,remainingStandby:parts,reason},baseVersion:b.version||null});K.notifications?.standbyActivated?.({personId:b.personId,date:b.date,start,end,zone,area,reason});K.refreshWorkflowState?.();
    return {record:shift,issues,activatedStandby:true,remainingStandby:parts,beforeShifts};
  }
  function createReplacementRequest({personId,date,start,end,zone='front',area='Verkauf',reason='',replacementForShiftId=null}={}){
    K.auth?.require?.('roster.replacement.request','Sie dürfen keine Vertretungsanfrage senden.');if(!K.person(personId))throw new Error('Ersatzperson nicht gefunden.');if(!String(reason||'').trim())throw new Error('Für die Anfrage ist ein Grund erforderlich.');
    const row={id:`REP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,personId,date,start,end,zone,area,reason:String(reason),replacementForShiftId,status:'open',createdAt:new Date().toISOString(),createdBy:K.currentUser?.displayName||null,response:null};K.replacementRequests.push(row);K.recordAudit?.('replacement.request',{entity:'replacement_request',entityId:row.id,after:row,reason});K.sync?.enqueue?.({entity:'replacement_request',operation:'create',payload:row,baseVersion:null});K.notifications?.replacementRequest?.(row);return clone(row);
  }
  function respondReplacementRequest(id,{personId=K.currentUser?.personId,accept,note=''}={}){
    K.auth?.require?.('roster.replacement.respond','Sie dürfen auf Vertretungsanfragen nicht antworten.');const r=K.replacementRequests.find(x=>x.id===id);if(!r)throw new Error('Vertretungsanfrage nicht gefunden.');if(r.personId!==personId||personId!==K.currentUser?.personId)throw new Error('Sie dürfen nur Ihre eigene Vertretungsanfrage beantworten.');if(r.status!=='open')throw new Error('Vertretungsanfrage ist bereits beantwortet.');const before=clone(r),baseVersion=Number(r.version||1);r.status=accept?'accepted':'declined';r.response={accept:!!accept,note:String(note||''),at:new Date().toISOString()};r.version=baseVersion+1;K.recordAudit?.('replacement.respond',{entity:'replacement_request',entityId:r.id,before,after:r});K.sync?.enqueue?.({entity:'replacement_request',operation:'update',payload:clone(r),baseVersion});return clone(r);
  }

  const baseValidate=K.validateShift;
  K.validateShift=function(candidate){const issues=baseValidate(candidate);for(const i of ruleIssues(candidate))if(!issues.some(x=>x.code===i.code&&x.text===i.text))issues.push(i);return issues;};

  K.staffing={version:'0.11.3',activeStatus,rulesFor,canViewRules,setRules,ruleIssues,ruleSummary,qualificationOk,dailyHours,eventHours,replacementSearch,markShiftAbsent,assignReplacement,activateStandby,createReplacementRequest,respondReplacementRequest,standbyCover};
})();
