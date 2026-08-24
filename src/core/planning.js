(function(){
  const K=window.KCDP;
  const round=(v,n=2)=>Math.round(v*10**n)/10**n;
  K.minutesToText=m=>`${Math.floor(m/60)}:${String(Math.round(m%60)).padStart(2,'0')}`;

  function durationHours(s){return K.breaks?.countedHours?.(s)??Math.max(0,Number(s.end)-Number(s.start));}
  function plannedActive(s){return K.staffing?.activeStatus?K.staffing.activeStatus(s):!['cancelled','absent','failed','deleted'].includes(s?.status);}
  K.isSpecialShift=function(s){return s?.zone==='special'||/^\s*z\s*[·\-:]/i.test(String(s?.area||''))||/(anderer ort|zu hause|zuhause|besorgung|transport|nachproduktion)/i.test(String(s?.area||''));};
  K.normalizeShiftClassification=function(candidate){const c={...candidate};if(K.isSpecialShift(c)){c.zone='special';if(!String(c.area||'').trim())c.area='Z · anderer Ort';else if(!/^\s*z\s*[·\-:]/i.test(c.area)&&!/(zuhause|zu hause)/i.test(c.area))c.area=`Z · ${c.area}`;}return c;};

  K.hoursForPerson=function(personId,date,layer='planned'){
    if(layer==='wish')return K.wishesFor(date).filter(w=>w.personId===personId&&w.wishType!=='unavailable').reduce((a,w)=>a+(w.end-w.start),0);
    if(layer==='actual')return (K.actualShifts||[]).filter(a=>a.personId===personId&&a.date===date&&a.status!=='deleted').reduce((n,a)=>n+durationHours(a),0);
    if(layer==='compare'){const actual=(K.actualShifts||[]).filter(a=>a.personId===personId&&a.date===date&&a.status!=='deleted').reduce((n,a)=>n+durationHours(a),0);return actual;}
    const src=(layer==='planned'&&K.visiblePlannedShifts)?K.visiblePlannedShifts(date):K.shifts.filter(s=>s.date===date&&s.layer===layer);return src.filter(s=>s.personId===personId&&plannedActive(s)).reduce((a,s)=>a+durationHours(s),0);
  };
  K.specialHoursForPerson=function(personId,date){
    return K.shifts.filter(s=>s.personId===personId&&s.date===date&&s.layer==='planned'&&K.isSpecialShift(s)&&plannedActive(s)).reduce((a,s)=>a+durationHours(s),0);
  };
  K.standbyHoursForPerson=function(personId,date){
    return K.standbyFor(date).filter(s=>s.personId===personId).reduce((a,s)=>a+(s.end-s.start),0);
  };
  K.hoursForRange=function(personId,startDate,endDate,layer='planned'){
    if(layer==='wish')return K.wishes.filter(w=>w.personId===personId&&w.date>=startDate&&w.date<=endDate&&w.status!=='deleted'&&w.wishType!=='unavailable').reduce((a,w)=>a+(w.end-w.start),0);
    if(layer==='actual'||layer==='compare')return (K.actualShifts||[]).filter(x=>x.personId===personId&&x.date>=startDate&&x.date<=endDate&&x.status!=='deleted').reduce((n,a)=>n+durationHours(a),0);
    const src=(layer==='planned'&&K.visiblePlannedShifts)?K.visiblePlannedShifts():K.shifts.filter(s=>s.layer===layer);return src.filter(s=>s.personId===personId&&s.date>=startDate&&s.date<=endDate&&plannedActive(s)).reduce((a,s)=>a+durationHours(s),0);
  };

  K.helperAvailable=function(person,date,start,end){
    if(!person||person.personType!=='helper')return true;
    return (person.availability||[]).some(a=>a.date===date&&a.start<=start&&a.end>=end);
  };

  K.wishCoverage=function(personId,date,start,end){
    const wishes=K.wishesFor(date).filter(w=>w.personId===personId&&Math.max(w.start,start)<Math.min(w.end,end));
    const unavailable=wishes.some(w=>w.wishType==='unavailable'&&w.start<=start&&w.end>=end);
    const preferred=wishes.some(w=>w.wishType==='preferred'&&w.start<=start&&w.end>=end);
    const available=wishes.some(w=>w.wishType==='available'&&w.start<=start&&w.end>=end);
    const ifNeeded=wishes.some(w=>w.wishType==='if_needed'&&w.start<=start&&w.end>=end);
    return {wishes,unavailable,preferred,available,ifNeeded};
  };
  K.wishTypeLabel=t=>({available:'Verfügbar',preferred:'Bevorzugt',if_needed:'Nur wenn nötig',unavailable:'Nicht verfügbar'})[t]||t;
  K.validateWish=function(candidate){
    const issues=[],person=K.person(candidate.personId),day=K.days.find(d=>d.date===candidate.date);
    if(!person||!person.active)issues.push({level:'error',text:'Mitarbeiter ist nicht aktiv.'});
    if(candidate.end<=candidate.start)issues.push({level:'error',text:'Ende muss nach Beginn liegen.'});
    if(!['available','preferred','if_needed','unavailable'].includes(candidate.wishType))issues.push({level:'error',text:'Unbekannter Wunschstatus.'});
    const overlap=K.wishes.filter(w=>w.id!==candidate.id&&w.personId===candidate.personId&&w.date===candidate.date&&w.status!=='deleted'&&Math.max(w.start,candidate.start)<Math.min(w.end,candidate.end));
    if(overlap.length)issues.push({level:'warn',text:'Überlappt einen weiteren Wunsch dieser Person.'});
    if(person&&!K.helperAvailable(person,candidate.date,candidate.start,candidate.end))issues.push({level:'warn',text:'Aushilfe ist laut Zeitmatrix nicht vollständig verfügbar.'});
    if(day&&(candidate.start<day.start-2||candidate.end>day.end+1))issues.push({level:'warn',text:'Wunsch liegt teilweise außerhalb des geplanten Tagesfensters.'});
    return issues;
  };

  K.coverageAt=function(day,time,override=null){
    let shifts=(K.visiblePlannedShifts?K.visiblePlannedShifts(day.date):K.shifts.filter(s=>s.date===day.date&&s.layer==='planned'));
    if(override){shifts=shifts.filter(s=>s.id!==override.id);shifts.push(override);}
    const allActive=shifts.filter(s=>s.start<=time&&s.end>time&&plannedActive(s));
    const special=allActive.filter(K.isSpecialShift);
    const active=allActive.filter(s=>!K.isSpecialShift(s));
    const req=K.requirementFor(day,time);
    const front=active.filter(s=>s.zone==='front').length;
    const back=active.filter(s=>s.zone==='back').length;
    const standby=K.standbyFor(day.date).filter(s=>s.start<=time&&s.end>time);
    return {req,total:active.length,front,back,special:special.length,active,specialActive:special,standby:standby.length,standbyActive:standby};
  };
  K.statusFor=function(req,actual){return actual<req?'bad':actual===req?'good':'over';};

  K.evaluateDay=function(day,override=null){
    const step=.25;let slots=0,ok=0,under=0,over=0,frontUnder=0,backUnder=0,standbyUnder=0;
    for(let t=day.start;t<day.end;t+=step){
      slots++;const c=K.coverageAt(day,t,override),isSimple=day.type!=='market';
      if(c.total<c.req.total)under++;else if(c.total>c.req.total)over++;else ok++;
      if(!isSimple){if(c.front<c.req.front)frontUnder++;if(c.back<c.req.back)backUnder++;}
      if(day.type==='market'&&c.standby<K.standbyRequirementFor(day,t))standbyUnder++;
    }
    const visibleBase=(K.visiblePlannedShifts?K.visiblePlannedShifts(day.date):K.shifts.filter(s=>s.date===day.date&&s.layer==='planned'));const base=(override?visibleBase.filter(s=>s.id!==override.id):visibleBase).concat(override?[override]:[]);
    const activeBase=base.filter(plannedActive);
    const personHours=activeBase.reduce((a,s)=>a+durationHours(s),0);
    const specialHours=activeBase.filter(K.isSpecialShift).reduce((a,s)=>a+durationHours(s),0);
    const totalReqHours=Array.from({length:Math.ceil((day.end-day.start)*4)},(_,i)=>K.requirementFor(day,day.start+i/4).total/4).reduce((a,b)=>a+b,0);
    const standHours=personHours-specialHours;
    const coverPct=totalReqHours?Math.min(150,Math.round(standHours/totalReqHours*100)):100;
    const critical=under+frontUnder+backUnder+standbyUnder;
    const wishViolations=activeBase.filter(s=>K.wishCoverage(s.personId,s.date,s.start,s.end).unavailable).length;
    const quality=Math.max(0,Math.min(100,Math.round(100-under*1.6-frontUnder*1.4-backUnder*1.4-standbyUnder*.7-over*.2-wishViolations*4)));
    return {slots,ok,under,over,frontUnder,backUnder,standbyUnder,personHours:round(personHours),standHours:round(standHours),specialHours:round(specialHours),totalReqHours:round(totalReqHours),coverPct,critical,wishViolations,quality};
  };

  K.validateShift=function(candidate){
    const person=K.person(candidate.personId),day=K.days.find(d=>d.date===candidate.date),issues=[];
    if(!person||!person.active)issues.push({level:'error',text:'Mitarbeiter ist nicht aktiv.'});
    if(candidate.end<=candidate.start)issues.push({level:'error',text:'Ende muss nach Beginn liegen.'});
    const overlaps=K.shifts.filter(s=>s.id!==candidate.id&&s.personId===candidate.personId&&s.date===candidate.date&&s.layer==='planned'&&plannedActive(s)&&Math.max(s.start,candidate.start)<Math.min(s.end,candidate.end));
    if(overlaps.length)issues.push({level:'error',text:'Überschneidung mit bestehendem Dienst.'});
    if(person&&!K.helperAvailable(person,candidate.date,candidate.start,candidate.end))issues.push({level:'warn',text:'Aushilfe ist laut Zeitmatrix in diesem Zeitraum nicht vollständig verfügbar.'});
    const wc=K.wishCoverage(candidate.personId,candidate.date,candidate.start,candidate.end);
    if(wc.unavailable)issues.push({level:'warn',text:'Dienst verletzt einen bestätigten „Nicht verfügbar“-Wunsch.'});
    else if(wc.ifNeeded)issues.push({level:'warn',text:'Mitarbeiter hat „nur wenn nötig“ angegeben.'});
    if(day&&candidate.start<day.start-2)issues.push({level:'warn',text:'Dienst beginnt deutlich vor dem geplanten Tagesfenster.'});
    if(day&&candidate.end>day.end+1)issues.push({level:'warn',text:'Dienst endet nach dem geplanten Tagesfenster.'});
    const hours=durationHours(candidate);
    if(hours>(person?.maxHours||8))issues.push({level:'warn',text:`Dienst überschreitet ${person?.maxHours||8} Std.`});
    return issues;
  };

  K.validateStandby=function(candidate){
    const p=K.person(candidate.personId),issues=[];
    if(!p||!p.active)issues.push({level:'error',text:'Person ist nicht aktiv.'});
    if(candidate.end<=candidate.start)issues.push({level:'error',text:'Ende muss nach Beginn liegen.'});
    const overlaps=K.standby.filter(s=>s.id!==candidate.id&&s.personId===candidate.personId&&s.date===candidate.date&&Math.max(s.start,candidate.start)<Math.min(s.end,candidate.end));
    if(overlaps.length)issues.push({level:'error',text:'Überschneidung mit weiterer Bereitschaft.'});
    const duty=K.shifts.filter(s=>s.personId===candidate.personId&&s.date===candidate.date&&s.layer==='planned'&&plannedActive(s)&&Math.max(s.start,candidate.start)<Math.min(s.end,candidate.end));
    if(duty.length)issues.push({level:'warn',text:'Person hat im Bereitschaftszeitraum bereits einen geplanten Dienst.'});
    if(p&&!K.helperAvailable(p,candidate.date,candidate.start,candidate.end))issues.push({level:'warn',text:'Aushilfe ist laut Zeitmatrix nicht vollständig verfügbar.'});
    if(!candidate.phone||candidate.phone==='nicht hinterlegt')issues.push({level:'warn',text:'Für die Bereitschaft ist keine Handynummer hinterlegt.'});
    return issues;
  };

  function skillScore(person,zone){
    const sk=(person.skills||'').toLowerCase();
    if(zone==='front')return sk.includes('vorne')||sk.includes('getränke')||sk.includes('flex')?30:-1000;
    if(zone==='back')return sk.includes('hinten')||sk.includes('küche')||sk.includes('flex')?30:-1000;
    return 10;
  }
  function wishScore(person,date,start,end){
    const w=K.wishCoverage(person.personId,date,start,end);
    if(w.unavailable)return -10000;
    if(w.preferred)return 45;
    if(w.available)return 25;
    if(w.ifNeeded)return -8;
    return 0;
  }
  function eventHours(personId,excludeDate=null){return K.shifts.filter(s=>s.personId===personId&&s.layer==='planned'&&plannedActive(s)&&(!excludeDate||s.date!==excludeDate)).reduce((a,s)=>a+durationHours(s),0);}
  function proposalOverlaps(list,personId,start,end){return list.some(s=>s.personId===personId&&Math.max(s.start,start)<Math.min(s.end,end));}

  K.aiProposal=function(day){
    const proposal=[],usage=new Map(K.people.map(p=>[p.personId,eventHours(p.personId,day.date)]));
    const block=K.state.step===15?.5:K.state.step===30?1:1;
    for(let start=day.start;start<day.end;start+=block){
      const end=Math.min(day.end,start+block),req=K.requirementFor(day,start);
      const needs=day.type==='market'?[['front',req.front],['back',req.back]]:[['neutral',req.total]];
      for(const [zone,need] of needs){
        let count=proposal.filter(s=>s.start<=start&&s.end>start&&s.zone===zone).length;
        while(count<need){
          const candidates=K.people.filter(p=>p.active&&K.helperAvailable(p,day.date,start,end)&&!proposalOverlaps(proposal,p.personId,start,end));
          const ranked=candidates.map(p=>{
            const sk=(p.skills||'').toLowerCase(),area=zone==='front'?(sk.includes('getränke')?'Getränke':'Verkauf'):zone==='back'?(sk.includes('küche')?'Küche':'Hinten'):'Vor-/Nachbereitung';
            const candidate={id:'',personId:p.personId,date:day.date,start,end,zone,area,breakMinutes:0,layer:'planned',status:'proposal'};
            const hardRules=K.staffing?.ruleIssues?.(candidate,{includeSoft:false}).filter(i=>i.level==='error')||[];
            const ws=wishScore(p,day.date,start,end),ss=skillScore(p,zone),used=usage.get(p.personId)||0;
            const daily=proposal.filter(s=>s.personId===p.personId).reduce((a,s)=>a+(s.end-s.start),0);
            const personalMax=K.staffing?.rulesFor?.(p.personId)?.maxDailyHours??p.maxHours??8;
            const maxPenalty=daily+block>personalMax?-500:0;
            const helperPenalty=p.personType==='helper'?-3:0;
            const fairnessPenalty=used*1.4;
            return {p,score:hardRules.length?-10000:ws+ss+maxPenalty+helperPenalty-fairnessPenalty};
          }).filter(x=>x.score>-900).sort((a,b)=>b.score-a.score||a.p.personId.localeCompare(b.p.personId));
          if(!ranked.length)break;
          const p=ranked[0].p,sk=(p.skills||'').toLowerCase();
          const area=zone==='front'?(sk.includes('getränke')?'Getränke':'Verkauf'):zone==='back'?(sk.includes('küche')?'Küche':'Hinten'):'Vor-/Nachbereitung';
          proposal.push({id:`AI-${Math.random().toString(36).slice(2)}`,personId:p.personId,date:day.date,start,end,zone,area,layer:'planned',breakMinutes:0,status:'proposal',proposalReason:'Sollmatrix + Wunsch + Qualifikation + persönliche Einsatzregeln + Fairness'});
          usage.set(p.personId,(usage.get(p.personId)||0)+(end-start));count++;
        }
      }
    }
    proposal.sort((a,b)=>a.personId.localeCompare(b.personId)||a.start-b.start);
    const merged=[];
    proposal.forEach(s=>{const last=merged[merged.length-1];if(last&&last.personId===s.personId&&last.date===s.date&&last.zone===s.zone&&last.area===s.area&&last.end===s.start)last.end=s.end;else merged.push({...s});});
    return merged;
  };

  K.scoreAiProposal=function(day,proposal){
    let preferred=0,available=0,ifNeeded=0,unavailable=0,helpers=0;
    proposal.forEach(s=>{const w=K.wishCoverage(s.personId,s.date,s.start,s.end);if(w.unavailable)unavailable++;else if(w.preferred)preferred++;else if(w.available)available++;else if(w.ifNeeded)ifNeeded++;if(K.person(s.personId)?.personType==='helper')helpers++;});
    return {preferred,available,ifNeeded,unavailable,helpers,total:proposal.length};
  };
})();
