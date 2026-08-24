(function(){
  const K=window.KCDP=window.KCDP||{};
  const EPS=1e-9;
  const inactiveAbsenceStates=new Set(['closed','cancelled','deleted','resolved']);

  function dayBy(input){
    if(input&&typeof input==='object'&&input.date)return input;
    const date=typeof input==='string'?input:null;
    if(date)return (K.days||[]).find(d=>d.date===date)||null;
    return (K.days||[])[Number(K.state?.dateIndex||0)]||null;
  }
  function activePlannedHours(personId,date){
    if(typeof K.hoursForPerson==='function')return Number(K.hoursForPerson(personId,date,'planned')||0);
    return (K.shifts||[]).filter(s=>s.personId===personId&&s.date===date&&s.layer==='planned'&&!['cancelled','absent','failed','deleted'].includes(s.status)).reduce((n,s)=>n+Math.max(0,Number(s.end)-Number(s.start)),0);
  }
  function activeEventHours(personId){
    if(typeof K.staffing?.eventHours==='function')return Number(K.staffing.eventHours(personId)||0);
    return (K.shifts||[]).filter(s=>s.personId===personId&&s.layer==='planned'&&!['cancelled','absent','failed','deleted'].includes(s.status)).reduce((n,s)=>n+Math.max(0,Number(s.end)-Number(s.start)),0);
  }
  function hasActiveAbsence(personId,date){
    return (K.absences||[]).some(a=>a.personId===personId&&a.date===date&&!inactiveAbsenceStates.has(String(a.status||'').toLowerCase()));
  }
  function unavailableIntervals(personId,date,start,end){
    const rows=(typeof K.wishesFor==='function'?K.wishesFor(date):(K.wishes||[]).filter(w=>w.date===date))
      .filter(w=>w.personId===personId&&w.status!=='deleted'&&w.wishType==='unavailable')
      .map(w=>({start:Math.max(start,Number(w.start)),end:Math.min(end,Number(w.end))}))
      .filter(x=>x.end>x.start+EPS)
      .sort((a,b)=>a.start-b.start||a.end-b.end);
    const merged=[];
    for(const row of rows){
      const last=merged[merged.length-1];
      if(last&&row.start<=last.end+EPS)last.end=Math.max(last.end,row.end);
      else merged.push({...row});
    }
    return merged;
  }
  function fullyUnavailableByWish(personId,date,start,end){
    const merged=unavailableIntervals(personId,date,start,end);
    if(!merged.length)return false;
    let cursor=start;
    for(const x of merged){
      if(x.start>cursor+EPS)return false;
      cursor=Math.max(cursor,x.end);
      if(cursor>=end-EPS)return true;
    }
    return cursor>=end-EPS;
  }
  function helperHasWindow(person,date,start,end){
    if(person.personType!=='helper')return true;
    return (person.availability||[]).some(a=>a.date===date&&Math.max(Number(a.start),start)<Math.min(Number(a.end),end)-EPS);
  }
  function ruleWindow(personId,day){
    const r=K.staffing?.rulesFor?.(personId)||{};
    const start=Math.max(Number(day.start),r.earliestStart==null?Number(day.start):Number(r.earliestStart));
    const end=Math.min(Number(day.end),r.latestEnd==null?Number(day.end):Number(r.latestEnd));
    return {rules:r,start,end,hasWindow:end>start+EPS};
  }
  function evaluate(person,inputDay=null){
    const day=dayBy(inputDay),reasons=[];
    if(!day?.date)return {available:false,reasons:['Planungstag fehlt'],day:null};
    if(!person||!person.active)reasons.push('Person ist nicht aktiv');
    if(person&&hasActiveAbsence(person.personId,day.date))reasons.push('Für diesen Tag als abwesend/krank gemeldet');
    if(person&&fullyUnavailableByWish(person.personId,day.date,Number(day.start),Number(day.end)))reasons.push('Für den gesamten Planungstag „nicht verfügbar“');
    if(person&&!helperHasWindow(person,day.date,Number(day.start),Number(day.end)))reasons.push('Aushilfe hat an diesem Tag kein Zeitfenster');
    if(person){
      const rw=ruleWindow(person.personId,day),r=rw.rules;
      if((r.forbiddenDates||[]).includes(day.date))reasons.push('Persönliche Einsatzsperre für diesen Tag');
      if(!rw.hasWindow)reasons.push('Kein zulässiges Einsatzfenster innerhalb des Tages');
      const daily=activePlannedHours(person.personId,day.date);
      if(r.maxDailyHours!=null&&daily>=Number(r.maxDailyHours)-EPS)reasons.push('Maximale Tagesstunden bereits ausgeschöpft');
      const event=activeEventHours(person.personId);
      if(r.maxEventHours!=null&&event>=Number(r.maxEventHours)-EPS)reasons.push('Maximale Veranstaltungsstunden bereits ausgeschöpft');
    }
    return {available:reasons.length===0,reasons,day:{date:day.date,start:Number(day.start),end:Number(day.end)}};
  }
  function list(inputDay=null){
    const day=dayBy(inputDay),rows=(K.people||[]).filter(p=>p?.active).map(person=>({person,...evaluate(person,day)}));
    return {day,available:rows.filter(x=>x.available),blocked:rows.filter(x=>!x.available),all:rows};
  }
  K.dayAvailability={version:'0.19.42',evaluate,list,fullyUnavailableByWish,hasActiveAbsence};
})();
