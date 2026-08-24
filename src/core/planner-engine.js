(function(){
  const K=window.KCDP=window.KCDP||{};
  const EPS=1e-9;
  const ACTIVE=s=>!['cancelled','absent','failed','deleted'].includes(s?.status);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const round4=v=>Math.round(Number(v)*10000)/10000;
  const toMinutes=h=>Math.round(Number(h)*60);
  const dateMs=(date,h)=>new Date(`${date}T00:00:00`).getTime()+Number(h)*3600000;

  function grossHours(s){return Math.max(0,Number(s.end)-Number(s.start));}
  function countedHours(s){return K.breaks?.countedHours?.(s)??grossHours(s);}
  function plannerStep(){const configured=Math.max(15,Number(K.state?.step||30));return configured>=60?1:.5;}
  function validationStep(){return .25;}

  function activePeople(){return (K.people||[]).filter(p=>p&&p.active);}
  function otherDayShifts(date){return (K.shifts||[]).filter(s=>s.layer==='planned'&&ACTIVE(s)&&s.date!==date);}
  function eventHoursExcludingDay(personId,date){return otherDayShifts(date).filter(s=>s.personId===personId).reduce((n,s)=>n+countedHours(s),0);}
  function proposalHours(proposal,personId){return proposal.filter(s=>s.personId===personId).reduce((n,s)=>n+grossHours(s),0);}
  function overlaps(proposal,personId,start,end){return proposal.some(s=>s.personId===personId&&Math.max(Number(s.start),start)<Math.min(Number(s.end),end)-EPS);}

  function qualified(person,zone){
    if(!person)return false;
    if(zone==='neutral'||zone==='special')return true;
    const sk=String(person.skills||'').toLowerCase();
    if(zone==='front')return sk.includes('vorne')||sk.includes('getränke')||sk.includes('flex');
    if(zone==='back')return sk.includes('hinten')||sk.includes('küche')||sk.includes('flex');
    return false;
  }
  function defaultArea(person,zone){
    const r=K.staffing?.rulesFor?.(person.personId)||{},preferred=String(r.preferredArea||'').trim(),sk=String(person.skills||'').toLowerCase();
    if(preferred&&((zone==='front'&&/verkauf|getränke/i.test(preferred))||(zone==='back'&&/küche|hinten/i.test(preferred))||(zone==='neutral'&&!/^\s*z\s*[·\-:]/i.test(preferred))))return preferred;
    if(zone==='front')return sk.includes('getränke')?'Getränke':'Verkauf';
    if(zone==='back')return sk.includes('küche')?'Küche':'Hinten';
    if(zone==='special')return preferred||'Z · anderer Ort';
    return 'Vor-/Nachbereitung';
  }
  function wishState(personId,date,start,end){return K.wishCoverage?.(personId,date,start,end)||{unavailable:false,preferred:false,available:false,ifNeeded:false,wishes:[]};}
  function activeAbsence(personId,date,start,end){return (K.absences||[]).some(a=>a.personId===personId&&a.date===date&&!['closed','cancelled','deleted'].includes(a.status)&&Math.max(Number(a.start??start),start)<Math.min(Number(a.end??end),end)-EPS);}

  function restViolation(personId,candidate,rules,targetDate){
    const min=Number(rules?.minRestHours);if(!Number.isFinite(min)||min<=0)return null;
    const cs=dateMs(candidate.date,candidate.start),ce=dateMs(candidate.date,candidate.end);
    for(const s of otherDayShifts(targetDate).filter(x=>x.personId===personId)){
      const ss=dateMs(s.date,s.start),se=dateMs(s.date,s.end);
      if(se<=cs){const gap=(cs-se)/3600000;if(gap+EPS<min)return {code:'min_rest',detail:`Mindestruhezeit ${min} Std. unterschritten (${gap.toFixed(1)} Std.)`};}
      else if(ce<=ss){const gap=(ss-ce)/3600000;if(gap+EPS<min)return {code:'min_rest',detail:`Mindestruhezeit ${min} Std. unterschritten (${gap.toFixed(1)} Std.)`};}
    }
    return null;
  }

  function eligibility(person,{day,start,end,zone,area,proposal=[]}={}){
    const blocked=[];
    if(!person||!person.active)blocked.push({code:'inactive',detail:'Person ist nicht aktiv'});
    if(!day||!day.date||!(end>start))blocked.push({code:'invalid_slot',detail:'Ungültiges Planungsintervall'});
    if(blocked.length)return {eligible:false,blocked};
    if(person.personType==='helper'&&!K.helperAvailable?.(person,day.date,start,end))blocked.push({code:'helper_unavailable',detail:'Aushilfe außerhalb der Zeitmatrix'});
    const wish=wishState(person.personId,day.date,start,end);if(wish.unavailable)blocked.push({code:'wish_unavailable',detail:'Bestätigter Wunsch: nicht verfügbar'});
    if(activeAbsence(person.personId,day.date,start,end))blocked.push({code:'absence',detail:'Ausfall/Abwesenheit für diesen Zeitraum erfasst'});
    if(!qualified(person,zone))blocked.push({code:'qualification',detail:`Qualifikation für ${zone==='front'?'Vorne':zone==='back'?'Hinten':zone} fehlt`});
    if(overlaps(proposal,person.personId,start,end))blocked.push({code:'proposal_overlap',detail:'Im Vorschlag bereits zeitgleich eingesetzt'});
    const r=K.staffing?.rulesFor?.(person.personId)||{};
    if((r.forbiddenDates||[]).includes(day.date))blocked.push({code:'forbidden_date',detail:'Persönliche Einsatzsperre für diesen Tag'});
    if(r.earliestStart!=null&&start+EPS<Number(r.earliestStart))blocked.push({code:'earliest_start',detail:'Beginn liegt vor der persönlichen Freigabe'});
    if(r.latestEnd!=null&&end>Number(r.latestEnd)+EPS)blocked.push({code:'latest_end',detail:'Ende liegt nach der persönlichen Freigabe'});
    if(Array.isArray(r.allowedZones)&&r.allowedZones.length&&!r.allowedZones.includes(zone))blocked.push({code:'zone_restricted',detail:'Dienstklasse laut Einsatzregel nicht erlaubt'});
    if(r.enforceAllowedAreas&&Array.isArray(r.allowedAreas)&&r.allowedAreas.length&&!r.allowedAreas.includes(area))blocked.push({code:'area_restricted',detail:'Bereich laut harter Einsatzregel nicht erlaubt'});
    const projectedDay=proposalHours(proposal,person.personId)+(end-start);
    if(r.maxDailyHours!=null&&projectedDay>Number(r.maxDailyHours)+EPS)blocked.push({code:'max_daily',detail:`Maximal ${r.maxDailyHours} Std. pro Tag`});
    const projectedEvent=eventHoursExcludingDay(person.personId,day.date)+projectedDay;
    if(r.maxEventHours!=null&&projectedEvent>Number(r.maxEventHours)+EPS)blocked.push({code:'max_event',detail:`Maximal ${r.maxEventHours} Std. für die Veranstaltung`});
    const rest=restViolation(person.personId,{personId:person.personId,date:day.date,start,end},r,day.date);if(rest)blocked.push(rest);
    return {eligible:blocked.length===0,blocked,wish,rules:r,projectedDay,projectedEvent};
  }

  function scoreCandidate(person,{day,start,end,zone,area,proposal=[]}={}){
    const gate=eligibility(person,{day,start,end,zone,area,proposal});if(!gate.eligible)return {eligible:false,score:-Infinity,reasons:[],blocked:gate.blocked};
    let score=100;const reasons=[];const w=gate.wish;
    if(w.preferred){score+=50;reasons.push('Wunsch bevorzugt');}
    else if(w.available){score+=30;reasons.push('Wunsch verfügbar');}
    else if(w.ifNeeded){score-=18;reasons.push('nur wenn nötig');}
    else reasons.push('kein Zeitwunsch');
    if(qualified(person,zone)){score+=25;reasons.push('Qualifikation passt');}
    const r=gate.rules||{};
    if(r.preferredZone===zone){score+=12;reasons.push('bevorzugte Dienstklasse');}
    if((r.preferredAreas||[]).includes(area)||r.preferredArea===area){score+=12;reasons.push('bevorzugter Bereich');}
    if(r.avoidLateAfter!=null&&end>Number(r.avoidLateAfter)+EPS){score-=14;reasons.push('später als Präferenz');}
    if(person.personType==='helper'){score-=4;reasons.push('Aushilfe');}
    const existing=eventHoursExcludingDay(person.personId,day.date),projected=proposalHours(proposal,person.personId);
    score-=(existing+projected)*1.8;
    const adjacent=proposal.some(s=>s.personId===person.personId&&s.zone===zone&&s.area===area&&(Math.abs(Number(s.end)-start)<EPS||Math.abs(Number(s.start)-end)<EPS));
    if(adjacent){score+=22;reasons.push('zusammenhängender Dienst');}
    return {eligible:true,score:Math.round(score*100)/100,reasons,blocked:[],projectedDay:gate.projectedDay,projectedEvent:gate.projectedEvent};
  }

  function rankCandidates(context){
    return activePeople().map(person=>{const area=defaultArea(person,context.zone),rank=scoreCandidate(person,{...context,area});return {person,area,...rank};})
      .filter(x=>x.eligible)
      .sort((a,b)=>b.score-a.score||a.projectedDay-b.projectedDay||a.projectedEvent-b.projectedEvent||String(a.person.personId).localeCompare(String(b.person.personId)));
  }

  function assignNeed({day,start,end,zone,need,proposal}){
    let active=proposal.filter(s=>s.zone===zone&&s.start<=start+EPS&&s.end>=end-EPS).length;
    let guard=0;
    while(active<need&&guard++<activePeople().length+2){
      const ranked=rankCandidates({day,start,end,zone,proposal});if(!ranked.length)break;
      const best=ranked[0],shift={id:`AI-${day.date}-${best.person.personId}-${toMinutes(start)}-${zone}`,personId:best.person.personId,date:day.date,start:round4(start),end:round4(end),zone,area:best.area,layer:'planned',breakMinutes:0,breakSegments:[],status:'proposal',proposalScore:best.score,proposalReason:best.reasons.join(' · ')};
      proposal.push(shift);active++;
    }
    return active;
  }

  function mergeContiguous(input){
    const sorted=input.map(clone).sort((a,b)=>String(a.personId).localeCompare(String(b.personId))||a.start-b.start||String(a.zone).localeCompare(String(b.zone))||String(a.area).localeCompare(String(b.area)));
    const out=[];
    for(const s of sorted){const last=out[out.length-1];if(last&&last.personId===s.personId&&last.date===s.date&&last.zone===s.zone&&last.area===s.area&&Math.abs(Number(last.end)-Number(s.start))<EPS){last.end=s.end;last.proposalScore=Math.max(Number(last.proposalScore||0),Number(s.proposalScore||0));last.proposalReason=last.proposalReason||s.proposalReason;}else out.push({...s});}
    return out;
  }
  function applyBreaks(input){return input.map(s=>K.breaks?.applySuggested?K.breaks.applySuggested({...s}):{...s});}

  function coverageFor(day,time,shifts){
    const all=shifts.filter(s=>s.start<=time+EPS&&s.end>time+EPS&&ACTIVE(s));
    const available=all.filter(s=>!(K.breaks?.isOnBreak?.(s,time)));
    const stand=available.filter(s=>!K.isSpecialShift?.(s));
    const req=K.requirementFor(day,time);
    return {req,total:stand.length,front:stand.filter(s=>s.zone==='front').length,back:stand.filter(s=>s.zone==='back').length};
  }
  function validateProposal(day,shifts){
    const hardViolations=[],gaps=[];
    const byPerson=new Map();for(const s of shifts){if(!byPerson.has(s.personId))byPerson.set(s.personId,[]);byPerson.get(s.personId).push(s);}
    for(const [personId,list] of byPerson){
      const p=K.person(personId);if(!p||!p.active){hardViolations.push({code:'inactive',personId});continue;}
      const r=K.staffing?.rulesFor?.(personId)||{},dayHours=list.reduce((n,s)=>n+countedHours(s),0),eventHours=eventHoursExcludingDay(personId,day.date)+dayHours;
      if(r.maxDailyHours!=null&&dayHours>Number(r.maxDailyHours)+EPS)hardViolations.push({code:'max_daily',personId,actual:dayHours,limit:Number(r.maxDailyHours)});
      if(r.maxEventHours!=null&&eventHours>Number(r.maxEventHours)+EPS)hardViolations.push({code:'max_event',personId,actual:eventHours,limit:Number(r.maxEventHours)});
      const sorted=list.slice().sort((a,b)=>a.start-b.start);for(let i=1;i<sorted.length;i++)if(sorted[i].start<sorted[i-1].end-EPS)hardViolations.push({code:'proposal_overlap',personId});
      for(const s of list){
        const area=s.area||defaultArea(p,s.zone),gate=eligibility(p,{day,start:s.start,end:s.end,zone:s.zone,area,proposal:list.filter(x=>x!==s)});
        for(const b of gate.blocked.filter(x=>!['proposal_overlap','max_daily','max_event'].includes(x.code)))hardViolations.push({code:b.code,personId,shiftId:s.id,detail:b.detail});
        const bc=K.breaks?.compliance?.(s);if(bc?.issues?.some(i=>i.level==='error'))hardViolations.push({code:'break_rule',personId,shiftId:s.id,detail:bc.issues.find(i=>i.level==='error').text});
      }
    }
    const step=validationStep();
    for(let t=day.start;t<day.end-EPS;t+=step){const c=coverageFor(day,t,shifts);if(day.type==='market'){if(c.front<c.req.front)gaps.push({time:round4(t),zone:'front',missing:c.req.front-c.front});if(c.back<c.req.back)gaps.push({time:round4(t),zone:'back',missing:c.req.back-c.back});}else if(c.total<c.req.total)gaps.push({time:round4(t),zone:'neutral',missing:c.req.total-c.total});}
    return {ok:hardViolations.length===0&&gaps.length===0,hardViolations,gaps};
  }

  function repair(day,shifts,maxRounds=3){
    let current=applyBreaks(mergeContiguous(shifts));
    for(let round=0;round<maxRounds;round++){
      const v=validateProposal(day,current);if(v.ok||!v.gaps.length)return {shifts:current,validation:v,rounds:round};
      const additions=[];
      for(const gap of v.gaps){const start=gap.time,end=Math.min(day.end,start+validationStep());for(let n=0;n<gap.missing;n++){const combined=current.concat(additions),ranked=rankCandidates({day,start,end,zone:gap.zone,proposal:combined});if(!ranked.length)break;const best=ranked[0];additions.push({id:`AI-R${round}-${day.date}-${best.person.personId}-${toMinutes(start)}-${gap.zone}`,personId:best.person.personId,date:day.date,start,end,zone:gap.zone,area:best.area,layer:'planned',breakMinutes:0,breakSegments:[],status:'proposal',proposalScore:best.score,proposalReason:`Lückenreparatur · ${best.reasons.join(' · ')}`});}}
      if(!additions.length)return {shifts:current,validation:v,rounds:round};
      current=applyBreaks(mergeContiguous(current.concat(additions)));
    }
    return {shifts:current,validation:validateProposal(day,current),rounds:maxRounds};
  }

  function buildProposal(day){
    if(!day||!day.date)throw new Error('Planungstag fehlt.');
    const proposal=[],step=plannerStep();
    for(let start=day.start;start<day.end-EPS;start+=step){
      const end=Math.min(day.end,start+step),req=K.requirementFor(day,start);
      const needs=day.type==='market'?[['front',Number(req.front||0)],['back',Number(req.back||0)]]:[['neutral',Number(req.total||0)]];
      for(const [zone,need] of needs)assignNeed({day,start,end,zone,need,proposal});
    }
    const repaired=repair(day,proposal,3),shifts=repaired.shifts.sort((a,b)=>String(a.personId).localeCompare(String(b.personId))||a.start-b.start||String(a.zone).localeCompare(String(b.zone)));
    const result={day:day.date,shifts,validation:repaired.validation,repairRounds:repaired.rounds,generatedAt:new Date().toISOString(),engineVersion:'0.19.42'};
    K.plannerEngine.lastResult=result;return result;
  }

  function explainProposal(day,proposal){
    const validation=validateProposal(day,proposal),wish={preferred:0,available:0,ifNeeded:0,unavailable:0},helpers=new Set();
    for(const s of proposal){const w=wishState(s.personId,s.date,s.start,s.end);if(w.unavailable)wish.unavailable++;else if(w.preferred)wish.preferred++;else if(w.available)wish.available++;else if(w.ifNeeded)wish.ifNeeded++;if(K.person(s.personId)?.personType==='helper')helpers.add(s.personId);}
    return {valid:validation.ok,gaps:validation.gaps.length,hardViolations:validation.hardViolations.length,preferred:wish.preferred,available:wish.available,ifNeeded:wish.ifNeeded,unavailable:wish.unavailable,helpers:helpers.size,total:proposal.length};
  }

  K.plannerEngine={version:'0.19.42',eligibility,scoreCandidate,rankCandidates,buildProposal,validateProposal,explainProposal,coverageFor,mergeContiguous,lastResult:null};
  K.aiProposal=function(day){return buildProposal(day).shifts;};
  K.scoreAiProposal=function(day,proposal){const x=explainProposal(day,proposal);return {preferred:x.preferred,available:x.available,ifNeeded:x.ifNeeded,unavailable:x.unavailable,helpers:x.helpers,total:x.total,valid:x.valid,gaps:x.gaps,hardViolations:x.hardViolations};};
})();
