(function(){
  const K=window.KCDP=window.KCDP||{};
  const EPS=1e-9;
  const labels={inactive:'Person nicht aktiv',invalid_slot:'Ungültiges Zeitintervall',helper_unavailable:'Aushilfe außerhalb Zeitmatrix',wish_unavailable:'Bestätigt nicht verfügbar',absence:'Krank/abwesend',qualification:'Qualifikation fehlt',proposal_overlap:'Zeitliche Überschneidung',forbidden_date:'Einsatzsperre',earliest_start:'Zu früher Beginn',latest_end:'Zu spätes Ende',zone_restricted:'Dienstklasse nicht erlaubt',area_restricted:'Bereich nicht erlaubt',max_daily:'Tagesstunden überschritten',max_event:'Veranstaltungsstunden überschritten',min_rest:'Ruhezeit unterschritten',break_rule:'Pausenregel verletzt'};
  const zoneLabel=z=>z==='front'?'Vorne':z==='back'?'Hinten':z==='neutral'?'Allgemein':String(z||'Bereich');
  const round2=n=>Math.round(Number(n||0)*100)/100;

  function compressGaps(gaps=[]){
    const rows=(gaps||[]).map(g=>({time:Number(g.time),zone:g.zone,missing:Number(g.missing||0)})).sort((a,b)=>String(a.zone).localeCompare(String(b.zone))||a.time-b.time),out=[];
    for(const g of rows){const last=out[out.length-1];if(last&&last.zone===g.zone&&last.missing===g.missing&&Math.abs(last.end-g.time)<.251){last.end=round2(g.time+.25);}else out.push({zone:g.zone,start:g.time,end:round2(g.time+.25),missing:g.missing});}
    return out;
  }
  function proposalDistribution(proposal=[]){
    const map=new Map();for(const s of proposal){const h=Math.max(0,Number(s.end)-Number(s.start));map.set(s.personId,(map.get(s.personId)||0)+h);}
    const rows=[...map].map(([personId,hours])=>({personId,name:K.person?.(personId)?.name||personId,hours:round2(hours)})).sort((a,b)=>b.hours-a.hours||String(a.name).localeCompare(String(b.name),'de'));
    if(!rows.length)return {rows,min:0,max:0,spread:0,average:0};const values=rows.map(x=>x.hours),sum=values.reduce((a,b)=>a+b,0);return {rows,min:Math.min(...values),max:Math.max(...values),spread:round2(Math.max(...values)-Math.min(...values)),average:round2(sum/values.length)};
  }
  function audit(day,proposal=[]){
    if(!day?.date)throw new Error('Planungstag fehlt.');if(!K.plannerEngine?.validateProposal)throw new Error('Planner-Engine fehlt.');
    const validation=K.plannerEngine.validateProposal(day,proposal),explain=K.plannerEngine.explainProposal?.(day,proposal)||{},gaps=compressGaps(validation.gaps),hard=(validation.hardViolations||[]).map(v=>({...v,label:labels[v.code]||v.code,personName:v.personId?(K.person?.(v.personId)?.name||v.personId):''})),distribution=proposalDistribution(proposal),warnings=[];
    if(Number(explain.ifNeeded||0)>0)warnings.push(`${explain.ifNeeded} Dienst(e) nutzen „nur wenn nötig“`);
    if(Number(explain.helpers||0)>0)warnings.push(`${explain.helpers} Aushilfe(n) im Vorschlag`);
    if(distribution.spread>6)warnings.push(`Stundenstreuung im Tagesvorschlag ${distribution.spread.toFixed(1).replace('.',',')} Std.`);
    const ready=hard.length===0&&gaps.length===0;
    return {version:'0.19.42',day:day.date,ready,status:ready?'ready':'blocked',statusLabel:ready?'Übernahme fachlich freigegeben':'Übernahme fachlich blockiert',totalShifts:proposal.length,hardViolations:hard,gaps,rawGapCount:(validation.gaps||[]).length,warnings,distribution,wishes:{preferred:Number(explain.preferred||0),available:Number(explain.available||0),ifNeeded:Number(explain.ifNeeded||0),unavailable:Number(explain.unavailable||0)},helpers:Number(explain.helpers||0),checkedAt:new Date().toISOString()};
  }
  K.plannerAudit={version:'0.19.42',audit,compressGaps,proposalDistribution,labels};
})();
