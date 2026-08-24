(function(){
  const K=window.KCDP=window.KCDP||{};
  let mode='all',suppressAllReset=false,scheduled=false,lastApplySignature='';

  function currentDay(){return (K.days||[])[Number(K.state?.dateIndex||0)]||null;}
  function invalidate(){lastApplySignature='';}
  function scheduleApply(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;ensureButtons();applyFilter();});}
  function ensureButtons(){
    document.querySelectorAll('.inspector-head-actions').forEach(head=>{
      const plus=head.querySelector('[data-inspector-add]');if(!plus||head.querySelector('[data-inspector-available]'))return;
      const button=document.createElement('button');
      button.type='button';button.className='inspector-available';button.dataset.inspectorAvailable='';
      button.textContent='✓';button.title='Nur heute verfügbare Mitarbeiter und Aushilfen';
      button.setAttribute('aria-label','Nur heute verfügbare Mitarbeiter und Aushilfen einplanen');
      button.onclick=e=>{
        e.preventDefault();e.stopPropagation();mode='available';suppressAllReset=true;invalidate();
        plus.click();scheduleApply();
      };
      head.insertBefore(button,plus);
    });
  }
  function availability(){
    const day=currentDay();if(!day||!K.dayAvailability?.list)return {day,available:new Set(),blocked:new Map()};
    const result=K.dayAvailability.list(day),available=new Set(result.available.map(x=>x.person.personId)),blocked=new Map(result.blocked.map(x=>[x.person.personId,x.reasons]));
    return {day,available,blocked,result};
  }
  function summaryHost(drawer,list){
    let box=drawer.querySelector('#quickPlanAvailabilitySummary');
    if(!box){box=document.createElement('div');box.id='quickPlanAvailabilitySummary';box.className='quick-plan-availability-summary';list.parentNode.insertBefore(box,list);}
    return box;
  }
  function signature(drawer,list,day){
    const search=drawer.querySelector('#quickPlanSearch')?.value||'',ids=[...list.querySelectorAll('[data-quick-person]')].map(x=>x.dataset.quickPerson).join(',');
    return [mode,day?.date||'',search,ids,(K.wishes||[]).length,(K.absences||[]).length,(K.shifts||[]).length,(K.people||[]).length].join('|');
  }
  function setText(el,text){if(el&&el.textContent!==text)el.textContent=text;}
  function applyFilter(){
    const drawer=document.getElementById('quickPlanDrawer'),list=document.getElementById('quickPlanList');if(!drawer||!list)return;
    const day=currentDay(),sig=signature(drawer,list,day);if(sig===lastApplySignature)return;lastApplySignature=sig;
    const h2=drawer.querySelector('.quick-plan-head h2'),p=drawer.querySelector('.quick-plan-head p'),cards=[...list.querySelectorAll('[data-quick-person]')];
    if(mode!=='available'){
      cards.forEach(card=>{if(card.hidden)card.hidden=false;if(card.hasAttribute('data-day-filtered'))card.removeAttribute('data-day-filtered');if(card.hasAttribute('title'))card.removeAttribute('title');});
      drawer.querySelector('#quickPlanAvailabilitySummary')?.remove();
      setText(h2,'＋ Mitarbeiter einplanen');setText(p,'Person antippen und Zeit im Raster ziehen.');
      drawer.dataset.dayAvailabilityMode='all';return;
    }
    const {available,blocked}=availability();if(!day)return;
    let visible=0;
    cards.forEach(card=>{
      const id=card.dataset.quickPerson,ok=available.has(id);if(card.hidden===ok)card.hidden=!ok;
      if(ok){visible++;if(card.hasAttribute('data-day-filtered'))card.removeAttribute('data-day-filtered');if(card.hasAttribute('title'))card.removeAttribute('title');}
      else{card.dataset.dayFiltered='true';const why=(blocked.get(id)||[]).join(' · ');if(card.title!==why)card.title=why;}
    });
    const box=summaryHost(drawer,list),date=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(day.date+'T12:00:00')),html=`<b>✓ Nur heute verfügbar</b><span>${date} · ${visible} passende Person${visible===1?'':'en'} angezeigt. Krank/abwesend, ganztägig nicht verfügbar, gesperrt oder ohne Aushilfen-Zeitfenster werden ausgeblendet.</span>`;
    if(box.innerHTML!==html)box.innerHTML=html;
    setText(h2,'✓ Heute verfügbare einplanen');setText(p,'Nur Personen mit mindestens einem möglichen Einsatzfenster an diesem Tag.');
    drawer.dataset.dayAvailabilityMode='available';
    let empty=list.querySelector('.quick-plan-filter-empty');
    if(!visible){if(!empty){empty=document.createElement('div');empty.className='quick-plan-empty quick-plan-filter-empty';list.appendChild(empty);}setText(empty,'Für diesen Tag ist aktuell keine weitere passende Person verfügbar.');}
    else empty?.remove();
  }

  document.addEventListener('click',e=>{
    const plus=e.target.closest?.('[data-inspector-add]');if(!plus)return;
    if(suppressAllReset)suppressAllReset=false;else mode='all';invalidate();setTimeout(scheduleApply,0);
  });
  document.addEventListener('input',e=>{if(e.target?.id==='quickPlanSearch'){invalidate();setTimeout(scheduleApply,0);}});
  document.addEventListener('click',e=>{if(e.target?.id==='prevDayBtn'||e.target?.id==='nextDayBtn'||e.target?.closest?.('[data-jump-date]')){invalidate();setTimeout(scheduleApply,0);}});
  const observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.type==='childList'||m.type==='characterData'))scheduleApply();});
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ensureButtons();
  K.dayAvailabilityUi={version:'0.19.42',setMode(value){mode=value==='available'?'available':'all';invalidate();scheduleApply();},mode(){return mode;},refresh(){invalidate();scheduleApply();}};
})();
