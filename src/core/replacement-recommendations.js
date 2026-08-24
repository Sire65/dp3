(function(){
  const K=window.KCDP=window.KCDP||{};
  if(!K.staffing?.replacementSearch)return;
  const legacySearch=K.staffing.replacementSearch.bind(K.staffing);
  const inactive=new Set(['cancelled','absent','failed','deleted']);

  function dayFor(date){return (K.days||[]).find(d=>d.date===date)||null;}
  function activePlanned(date,excludeShiftId=null){
    return (K.shifts||[]).filter(s=>s.layer==='planned'&&s.date===date&&s.id!==excludeShiftId&&!inactive.has(s.status));
  }
  function standbyCover(personId,date,start,end){
    return (K.standby||[]).find(s=>s.status!=='cancelled'&&s.personId===personId&&s.date===date&&Number(s.start)<=Number(start)&&Number(s.end)>=Number(end))||null;
  }
  function eventHours(personId){return Number(K.staffing?.eventHours?.(personId)||0);}
  function blockedReason(row){
    const text=(row.blocked||[]).map(x=>x.detail).filter(Boolean).join(' · ');
    return text||K.plannerRecommendations?.explain?.(row)||'Für diesen Einsatz nicht verfügbar';
  }

  function sharedReplacementSearch({date,start,end,zone='front',area=null,excludePersonId=null,replacementForShiftId=null,mode='shift'}={}){
    if(mode==='standby')return legacySearch({date,start,end,zone,area,excludePersonId,replacementForShiftId,mode});
    K.auth?.require?.('roster.replacement.search','Sie dürfen keine Ersatz-/Lückensuche ausführen.');
    const day=dayFor(date);if(!day||!K.plannerRecommendations?.recommendSlot)return legacySearch({date,start,end,zone,area,excludePersonId,replacementForShiftId,mode});
    const targetArea=String(area||(zone==='front'?'Verkauf':zone==='back'?'Hinten':'Vor-/Nachbereitung'));
    const proposal=activePlanned(date,replacementForShiftId);
    const result=K.plannerRecommendations.recommendSlot({day,start:Number(start),end:Number(end),zone,area:targetArea,proposal});
    const candidates=[],blocked=[];
    for(const row of result.all){
      if(row.personId===excludePersonId)continue;
      if(!row.autoEligible){blocked.push({personId:row.personId,name:row.name,reason:blockedReason(row),codes:(row.blocked||[]).map(x=>x.code),manualOverride:!!row.manualAllowed});continue;}
      const standby=standbyCover(row.personId,date,start,end),plannedHours=eventHours(row.personId),reasons=[...(row.reasons||[])];
      let score=Number(row.score||0);
      if(standby){score+=90;reasons.unshift('bereits in Bereitschaft');}
      candidates.push({personId:row.personId,name:row.name,personType:row.personType,score:Math.round(score*100)/100,reasons,standbyId:standby?.id||null,plannedHours,basePlannerScore:Number(row.score||0),source:'planner-engine-v0.19.42'});
    }
    candidates.sort((a,b)=>b.score-a.score||a.plannedHours-b.plannedHours||String(a.name||'').localeCompare(String(b.name||''),'de')||String(a.personId).localeCompare(String(b.personId)));
    return {date,start,end,zone,area:targetArea,mode,replacementForShiftId,candidates,blocked,engineVersion:'0.19.42',source:'shared-planner-recommendations'};
  }

  K.staffing.replacementSearch=sharedReplacementSearch;
  K.replacementRecommendations={version:'0.19.42',search:sharedReplacementSearch,legacyStandbySearch:legacySearch};
})();
