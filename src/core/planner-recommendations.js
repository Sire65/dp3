(function(){
  const K=window.KCDP=window.KCDP||{};
  const hardCodes=new Set(['inactive','invalid_slot','helper_unavailable','absence','qualification','proposal_overlap','forbidden_date','earliest_start','latest_end','zone_restricted','area_restricted','max_daily','max_event','min_rest']);
  const manualOverrideCodes=new Set(['wish_unavailable']);

  function requireEngine(){if(!K.plannerEngine?.eligibility||!K.plannerEngine?.scoreCandidate)throw new Error('Planungs-Engine V0.19.42 ist nicht geladen.');}
  function normalizeContext(input={}){
    const day=input.day||K.day?.();if(!day?.date)throw new Error('Planungstag fehlt.');
    const start=Number(input.start??day.start),end=Number(input.end??Math.min(day.end,start+4));
    if(!(end>start))throw new Error('Endzeit muss nach der Startzeit liegen.');
    const zone=input.zone||(day.type==='market'?'front':'neutral');
    const area=String(input.area||(zone==='front'?'Verkauf':zone==='back'?'Hinten':'Vor-/Nachbereitung'));
    return {day,start,end,zone,area,proposal:Array.isArray(input.proposal)?input.proposal:[]};
  }
  function classifyBlocked(blocked=[]){
    const codes=blocked.map(x=>x.code),absolute=codes.filter(c=>hardCodes.has(c)),manualOnly=codes.filter(c=>manualOverrideCodes.has(c));
    return {codes,absolute,manualOnly,autoEligible:codes.length===0,manualAllowed:absolute.length===0&&manualOnly.length>0};
  }
  function recommendSlot(input={}){
    requireEngine();const context=normalizeContext(input),rows=[];
    for(const person of (K.people||[]).filter(p=>p?.active)){
      const gate=K.plannerEngine.eligibility(person,context),classification=classifyBlocked(gate.blocked||[]);
      let score=null,reasons=[];
      if(gate.eligible){const ranked=K.plannerEngine.scoreCandidate(person,context);score=ranked.score;reasons=ranked.reasons||[];}
      else if(classification.manualAllowed){reasons=['bewusste manuelle Abweichung erforderlich'];}
      rows.push({personId:person.personId,name:person.name,personType:person.personType,skills:person.skills||'',score,autoEligible:classification.autoEligible,manualAllowed:classification.manualAllowed,blocked:gate.blocked||[],reasons});
    }
    rows.sort((a,b)=>{
      if(a.autoEligible!==b.autoEligible)return a.autoEligible?-1:1;
      if(a.manualAllowed!==b.manualAllowed)return a.manualAllowed?-1:1;
      const as=Number.isFinite(a.score)?a.score:-Infinity,bs=Number.isFinite(b.score)?b.score:-Infinity;
      return bs-as||String(a.name||'').localeCompare(String(b.name||''),'de')||String(a.personId).localeCompare(String(b.personId));
    });
    return {context:{date:context.day.date,start:context.start,end:context.end,zone:context.zone,area:context.area},recommended:rows.filter(x=>x.autoEligible),manualOverride:rows.filter(x=>!x.autoEligible&&x.manualAllowed),blocked:rows.filter(x=>!x.autoEligible&&!x.manualAllowed),all:rows};
  }
  function explain(row){
    if(row.autoEligible)return row.reasons.length?row.reasons.join(' · '):'automatisch geeignet';
    if(row.manualAllowed)return `Nur manuell: ${(row.blocked||[]).map(x=>x.detail).join(' · ')}`;
    return `Gesperrt: ${(row.blocked||[]).map(x=>x.detail).join(' · ')}`;
  }

  K.plannerRecommendations={version:'0.19.42',recommendSlot,classifyBlocked,explain,hardCodes:[...hardCodes],manualOverrideCodes:[...manualOverrideCodes]};
})();
