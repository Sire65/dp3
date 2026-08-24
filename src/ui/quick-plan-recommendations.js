(function(){
  const K=window.KCDP=window.KCDP||{};
  let scheduled=false,lastSignature='';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtTime=h=>`${String(Math.floor(Number(h))).padStart(2,'0')}:${String(Math.round((Number(h)%1)*60)).padStart(2,'0')}`;

  function currentDay(){return (K.days||[])[Number(K.state?.dateIndex||0)]||null;}
  function plannedFor(date){return (K.visiblePlannedShifts?K.visiblePlannedShifts(date):(K.shifts||[]).filter(s=>s.date===date&&s.layer==='planned')).filter(s=>!['cancelled','absent','failed','deleted'].includes(s.status));}
  function contextFor(day){
    const raw=Number(K.state?.inspectorHour),start=Number.isFinite(raw)&&raw>=Number(day.start)&&raw<Number(day.end)?raw:Number(day.start);
    const end=Math.min(Number(day.end),start+Math.max(1,Number(K.state?.step||30)/60));
    let zone=day.type==='market'?'front':'neutral';
    if(day.type==='market'&&typeof K.coverageAt==='function'){
      try{const c=K.coverageAt(day,start),fg=Math.max(0,Number(c.req?.front||0)-Number(c.front||0)),bg=Math.max(0,Number(c.req?.back||0)-Number(c.back||0));if(bg>fg)zone='back';}catch(_){}
    }
    const area=zone==='front'?'Verkauf':zone==='back'?'Hinten':'Vor-/Nachbereitung';
    return {day,start,end,zone,area,proposal:plannedFor(day.date)};
  }
  function signatureFor(drawer,list,context){return [context.day.date,context.start,context.end,context.zone,drawer.dataset.dayAvailabilityMode||'all',list.children.length,(K.people||[]).length,(K.shifts||[]).length,(K.wishes||[]).length,(K.absences||[]).length].join('|');}
  function removeDecoration(card){card.querySelector('.quick-plan-rank')?.remove();card.querySelector('.quick-plan-reason')?.remove();card.removeAttribute('data-recommendation-group');card.removeAttribute('data-recommendation-score');}
  function groupLabel(row,index){
    if(row.autoEligible)return `<span class="quick-plan-rank recommended">Empfehlung ${index+1}${Number.isFinite(row.score)?` · ${Math.round(row.score)} P`:''}</span>`;
    if(row.manualAllowed)return '<span class="quick-plan-rank manual">Nur manuell prüfen</span>';
    return '<span class="quick-plan-rank blocked">Fachlich gesperrt</span>';
  }
  function reasonText(row){
    if(row.autoEligible)return (row.reasons||[]).slice(0,3).join(' · ')||'Automatisch geeignet';
    return (row.blocked||[]).slice(0,3).map(x=>x.detail).join(' · ')||(row.manualAllowed?'Bewusste manuelle Abweichung erforderlich':'Harte Einsatzregel verhindert automatische Einplanung');
  }
  function apply(){
    scheduled=false;
    const drawer=document.getElementById('quickPlanDrawer'),list=document.getElementById('quickPlanList'),day=currentDay();
    if(!drawer||!list||!drawer.classList.contains('open')||!day||!K.plannerRecommendations?.recommendSlot)return;
    const context=contextFor(day),signature=signatureFor(drawer,list,context);if(signature===lastSignature&&list.querySelector('[data-recommendation-group]'))return;
    lastSignature=signature;
    let result;try{result=K.plannerRecommendations.recommendSlot(context);}catch(e){console.warn('KC DP2 Quick-Plan Empfehlung:',e);return;}
    const byId=new Map(result.all.map(r=>[r.personId,r])),rank=new Map(result.recommended.map((r,i)=>[r.personId,i]));
    const cards=[...list.querySelectorAll('[data-quick-person]')];
    for(const card of cards){
      removeDecoration(card);const row=byId.get(card.dataset.quickPerson);if(!row)continue;
      const group=row.autoEligible?'recommended':row.manualAllowed?'manual':'blocked';card.dataset.recommendationGroup=group;if(Number.isFinite(row.score))card.dataset.recommendationScore=String(row.score);
      const text=card.querySelector('div:first-child');if(!text)continue;
      text.insertAdjacentHTML('beforeend',groupLabel(row,rank.get(row.personId)??0));
      const reason=document.createElement('small');reason.className='quick-plan-reason';reason.textContent=reasonText(row);reason.title=reason.textContent;text.appendChild(reason);
    }
    const order=new Map(result.all.map((r,i)=>[r.personId,i]));cards.sort((a,b)=>(order.get(a.dataset.quickPerson)??9999)-(order.get(b.dataset.quickPerson)??9999)).forEach(card=>list.appendChild(card));
    let info=drawer.querySelector('#quickPlanRecommendationSummary');if(!info){info=document.createElement('div');info.id='quickPlanRecommendationSummary';info.className='quick-plan-recommendation-summary';const search=drawer.querySelector('#quickPlanSearch');search?.insertAdjacentElement('afterend',info);}
    const zone=context.zone==='front'?'Vorne':context.zone==='back'?'Hinten':'Allgemein';
    info.innerHTML=`<b>Planungsempfehlung · ${esc(zone)} ${fmtTime(context.start)}–${fmtTime(context.end)}</b><span>${result.recommended.length} automatisch geeignet · ${result.manualOverride.length} nur manuell · ${result.blocked.length} gesperrt. Rangfolge berücksichtigt dieselben Regeln wie der KI-Plan; die exakte Von/Bis-Zeit wird beim Anlegen erneut geprüft.</span>`;
    drawer.dataset.recommendationDate=day.date;
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply);}
  const observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.type==='childList'||m.type==='attributes'))schedule();});
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-day-availability-mode']});
  document.addEventListener('input',e=>{if(e.target?.id==='quickPlanSearch'){lastSignature='';setTimeout(schedule,0);}});
  document.addEventListener('click',e=>{if(e.target?.id==='prevDayBtn'||e.target?.id==='nextDayBtn'||e.target?.closest?.('[data-inspector-add],[data-inspector-available],[data-jump-date]')){lastSignature='';setTimeout(schedule,0);}});
  K.quickPlanRecommendationsUi={version:'0.19.42',refresh(){lastSignature='';schedule();},contextFor};
})();
