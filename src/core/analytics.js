(function(){
  const K=window.KCDP=window.KCDP||{};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const weekend=iso=>{const d=new Date(iso+'T12:00:00').getDay();return d===0||d===6};
  const duration=s=>K.breaks?.countedHours?.(s)??Math.max(0,Number(s.end)-Number(s.start));
  const overlap=(a,b,c,d)=>Math.max(a,c)<Math.min(b,d);
  const marketShift=s=>K.days.find(d=>d.date===s.date)?.type==='market';
  const rangeDates=(start,end)=>K.days.filter(d=>d.date>=start&&d.date<=end).map(d=>d.date);

  function viewRange(view=K.state.view,dateIndex=K.state.dateIndex){
    const current=K.days[dateIndex]||K.days[0];
    if(view==='day')return {start:current.date,end:current.date,label:current.date,dates:[current.date]};
    if(view==='week'){
      const wd=(new Date(current.date+'T12:00:00').getDay()+6)%7;
      const startIndex=Math.max(0,dateIndex-wd),days=K.days.slice(startIndex,startIndex+7);
      return {start:days[0].date,end:days[days.length-1].date,label:`${days[0].date} – ${days[days.length-1].date}`,dates:days.map(d=>d.date)};
    }
    return {start:K.days[0].date,end:K.days[K.days.length-1].date,label:`${K.days[0].date} – ${K.days[K.days.length-1].date}`,dates:K.days.map(d=>d.date)};
  }

  function wishFulfillment(personId,start,end){
    const wishes=K.wishes.filter(w=>w.personId===personId&&w.date>=start&&w.date<=end&&w.status!=='deleted');
    if(!wishes.length)return {score:100,fulfilled:0,total:0,violations:0,preferred:0};
    let weight=0,earned=0,violations=0,preferred=0;
    for(const w of wishes){
      const shifts=(K.visiblePlannedShifts?K.visiblePlannedShifts(w.date):K.shifts.filter(s=>s.layer==='planned'&&s.date===w.date)).filter(s=>s.personId===personId&&overlap(s.start,s.end,w.start,w.end));
      if(w.wishType==='unavailable'){
        weight+=4;if(!shifts.length)earned+=4;else violations++;
      }else if(w.wishType==='preferred'){
        weight+=3;preferred++;if(shifts.some(s=>s.start>=w.start&&s.end<=w.end))earned+=3;else if(shifts.length)earned+=1;
      }else if(w.wishType==='available'){
        weight+=2;if(shifts.length)earned+=2;
      }else if(w.wishType==='if_needed'){
        weight+=1;if(!shifts.length)earned+=1;else earned+=.5;
      }
    }
    return {score:weight?Math.round(earned/weight*100):100,fulfilled:Math.round(earned),total:weight,violations,preferred};
  }

  function personStats(personId,start,end){
    const p=K.person(personId);if(!p)return null;
    const planned=(K.visiblePlannedShifts?K.visiblePlannedShifts():K.shifts.filter(s=>s.layer==='planned')).filter(s=>s.personId===personId&&s.date>=start&&s.date<=end);
    const actual=(K.actualShifts||[]).filter(a=>a.personId===personId&&a.date>=start&&a.date<=end&&a.status!=='deleted');
    const standby=K.standby.filter(s=>s.personId===personId&&s.date>=start&&s.date<=end&&s.status!=='cancelled');
    const byZone={front:0,back:0,special:0,neutral:0};
    let evening=0,weekendShifts=0,marketShifts=0,prepHours=0,afterHours=0;
    planned.forEach(s=>{
      byZone[s.zone]=(byZone[s.zone]||0)+duration(s);
      const d=K.days.find(x=>x.date===s.date);
      if(d?.type==='prep')prepHours+=duration(s);
      if(d?.type==='after')afterHours+=duration(s);
      if(d?.type==='market')marketShifts++;
      if(weekend(s.date))weekendShifts++;
      if(s.end>18&&marketShift(s))evening++;
    });
    const plannedHours=planned.reduce((n,s)=>n+duration(s),0);
    const actualHours=actual.reduce((n,s)=>n+duration(s),0);
    const standbyHours=standby.reduce((n,s)=>n+Math.max(0,s.end-s.start),0);
    const wishes=wishFulfillment(personId,start,end);
    return {
      personId,name:p.name,personType:p.personType,skills:p.skills,
      plannedHours,actualHours,differenceHours:actualHours-plannedHours,
      frontHours:byZone.front||0,backHours:byZone.back||0,specialHours:byZone.special||0,neutralHours:byZone.neutral||0,
      prepHours,afterHours,standbyHours,shifts:planned.length,marketShifts,weekendShifts,eveningShifts:evening,
      wishScore:wishes.score,wishViolations:wishes.violations,preferredWishes:wishes.preferred
    };
  }

  function fairness(start,end){
    const rows=K.people.filter(p=>p.active&&p.personType!=='helper').map(p=>personStats(p.personId,start,end));
    const values=rows.map(r=>r.plannedHours);const avg=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
    const avgWeekend=rows.length?rows.reduce((n,r)=>n+r.weekendShifts,0)/rows.length:0;
    const avgEvening=rows.length?rows.reduce((n,r)=>n+r.eveningShifts,0)/rows.length:0;
    rows.forEach(r=>{
      const hoursPenalty=avg?Math.min(45,Math.abs(r.plannedHours-avg)/Math.max(1,avg)*45):0;
      const weekendPenalty=Math.min(20,Math.abs(r.weekendShifts-avgWeekend)*6);
      const eveningPenalty=Math.min(15,Math.abs(r.eveningShifts-avgEvening)*5);
      const wishPenalty=Math.max(0,(100-r.wishScore)*.2);
      r.fairnessScore=Math.max(0,Math.round(100-hoursPenalty-weekendPenalty-eveningPenalty-wishPenalty));
      r.hoursDelta=r.plannedHours-avg;
    });
    const overall=rows.length?Math.round(rows.reduce((n,r)=>n+r.fairnessScore,0)/rows.length):100;
    const spread=values.length?Math.max(...values)-Math.min(...values):0;
    return {rows,overall,averageHours:avg,spreadHours:spread,averageWeekend:avgWeekend,averageEvening:avgEvening};
  }

  function dayIssues(date){
    const d=K.days.find(x=>x.date===date);if(!d)return [];
    const e=K.evaluateDay(d),issues=[];
    if(e.critical)issues.push({severity:'critical',kind:'staffing',text:`${e.critical} kritische Besetzungsintervalle`,date});
    if(e.wishViolations)issues.push({severity:'warning',kind:'wish',text:`${e.wishViolations} Wunschkonflikt(e)`,date});
    if(e.over)issues.push({severity:'info',kind:'over',text:`${e.over} überbesetzte Intervalle`,date});
    return issues;
  }

  function dashboard(range=viewRange()){
    const evaluations=range.dates.map(date=>K.evaluateDay(K.days.find(d=>d.date===date)));
    const critical=evaluations.reduce((n,e)=>n+e.critical,0);
    const under=evaluations.reduce((n,e)=>n+e.under,0);
    const over=evaluations.reduce((n,e)=>n+e.over,0);
    const quality=evaluations.length?Math.round(evaluations.reduce((n,e)=>n+e.quality,0)/evaluations.length):100;
    const wishViolations=evaluations.reduce((n,e)=>n+e.wishViolations,0);
    const openSwaps=(K.swapRequests||[]).filter(r=>r.status==='open').length;
    const unresolvedActual=K.actual?.eventStats?.().unresolved||0;
    const syncConflicts=K.sync?.openConflicts?.()||0;
    const pending=K.sync?.pending?.()||0;
    const seen=K.seenStats?.()||{seen:0,total:0,version:null};
    const fair=fairness(range.start,range.end);
    const tasks=[];
    range.dates.forEach(date=>tasks.push(...dayIssues(date)));
    if(openSwaps)tasks.push({severity:'warning',kind:'swap',text:`${openSwaps} offene Tauschanfrage(n)`});
    if(unresolvedActual)tasks.push({severity:'warning',kind:'actual',text:`${unresolvedActual} ungeklärte Istzeit(en)`});
    if(syncConflicts)tasks.push({severity:'critical',kind:'sync',text:`${syncConflicts} Synchronisationskonflikt(e)`});
    if(pending)tasks.push({severity:'info',kind:'sync_pending',text:`${pending} Änderung(en) warten auf Sync`});
    if(seen.version&&seen.seen<seen.total)tasks.push({severity:'info',kind:'seen',text:`${seen.total-seen.seen} Person(en) haben V${seen.version} noch nicht als gesehen markiert`});
    return {range,critical,under,over,quality,wishViolations,fairness:fair,openSwaps,unresolvedActual,syncConflicts,pending,seen,tasks};
  }

  function eventStats(){
    const r=viewRange('total',K.state.dateIndex),people=K.people.filter(p=>p.active).map(p=>personStats(p.personId,r.start,r.end));
    return {range:r,people,fairness:fairness(r.start,r.end),dashboard:dashboard(r)};
  }

  K.analytics={version:'0.8.0',viewRange,rangeDates,personStats,wishFulfillment,fairness,dayIssues,dashboard,eventStats,clone};
})();
