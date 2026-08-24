(function(){
  const K=window.KCDP=window.KCDP||{};
  const MODE_KEY='kcDp.phoneDayMode';
  let applying=false,queued=false,observer=null,pendingPerson=null,bootObserver=null,listenersInstalled=false;

  const isPhone=()=>K.deviceUX?.isPhone?.()===true && window.matchMedia('(max-width:600px)').matches;
  const currentDay=()=>K.day?.()||K.days?.[K.state?.dateIndex||0]||null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getMode=()=>{try{return localStorage.getItem(MODE_KEY)==='bars'?'bars':'list';}catch(_){return'list';}};
  const setMode=m=>{try{localStorage.setItem(MODE_KEY,m);}catch(_){}};

  function firstName(person){
    const raw=String(person?.firstName||person?.name||'').trim();
    let first=raw.split(/\s+/)[0]||'–';
    if(first.includes('-')&&first.length>9)first=first.split('-')[0];
    return first;
  }
  function compactTime(value){
    const n=Number(value);
    if(!Number.isFinite(n))return'–';
    const total=Math.round(n*60),h=Math.floor(total/60)%24,m=total%60;
    return m?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`:String(h).padStart(2,'0');
  }
  const span=s=>`${compactTime(s.start)}–${compactTime(s.end)}`;

  function sourceForDay(day){
    const layer=K.state?.layer||'planned';
    if(!day)return[];
    if(layer==='actual')return (K.actualShifts||[]).filter(s=>s.date===day.date&&s.status!=='deleted').map(s=>({...s,_phoneKind:'actual'}));
    if(layer==='compare'){
      const planned=(K.visiblePlannedShifts?K.visiblePlannedShifts(day.date):(K.shifts||[]).filter(s=>s.date===day.date&&s.layer==='planned')).map(s=>({...s,_phoneKind:'planned'}));
      const actual=(K.actualShifts||[]).filter(s=>s.date===day.date&&s.status!=='deleted').map(s=>({...s,_phoneKind:'actual'}));
      return planned.concat(actual);
    }
    if(layer==='wish')return (K.wishesFor?K.wishesFor(day.date):(K.wishes||[]).filter(s=>s.date===day.date&&s.status!=='deleted')).map(s=>({...s,_phoneKind:'wish'}));
    return (K.visiblePlannedShifts?K.visiblePlannedShifts(day.date):(K.shifts||[]).filter(s=>s.date===day.date&&s.layer===layer))
      .filter(s=>!['deleted','cancelled','failed'].includes(s.status))
      .map(s=>({...s,_phoneKind:'planned'}));
  }

  function layerLabel(){
    return ({planned:'Soll',wish:'Wunsch',actual:'Ist',compare:'Soll/Ist'})[K.state?.layer]||'Tag';
  }
  function dayLabel(day){
    if(!day?.date)return'Tagesansicht';
    try{
      const x=new Date(day.date+'T12:00:00');
      const wd=new Intl.DateTimeFormat('de-DE',{weekday:'long'}).format(x);
      const dm=new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit'}).format(x);
      return `${wd}, ${dm}`;
    }catch(_){return day.date;}
  }
  function detailLabel(day){
    if(!day)return'';
    const type=day.type==='market'?'Markttag':day.type==='prep'?'Vorbereitung':'Nachbereitung';
    if(day.open!=null)return `${type} · Öffnung ${compactTime(day.open)} Uhr`;
    return `${type} · ${compactTime(day.start)}–${compactTime(day.end)} Uhr`;
  }

  function buildRows(day){
    const records=sourceForDay(day);
    const people=new Map((K.people||[]).map(p=>[p.personId,p]));
    const grouped=new Map();
    for(const s of records){
      if(!s?.personId)continue;
      if(!grouped.has(s.personId))grouped.set(s.personId,[]);
      grouped.get(s.personId).push(s);
    }
    const standby=(K.standbyFor?K.standbyFor(day.date):(K.standby||[]).filter(s=>s.date===day.date&&!['cancelled','deleted'].includes(s.status)));
    for(const s of standby){
      if(!grouped.has(s.personId))grouped.set(s.personId,[]);
    }

    const rows=[...grouped.entries()].map(([personId,items])=>{
      const person=people.get(personId)||{personId,name:'Unbekannt'};
      items.sort((a,b)=>Number(a.start)-Number(b.start)||Number(a.end)-Number(b.end));
      const ready=standby.filter(s=>s.personId===personId).sort((a,b)=>Number(a.start)-Number(b.start));
      const earliest=Math.min(...items.map(x=>Number(x.start)).concat(ready.map(x=>Number(x.start))).filter(Number.isFinite));
      return {person,items,ready,earliest:Number.isFinite(earliest)?earliest:99};
    }).sort((a,b)=>a.earliest-b.earliest||firstName(a.person).localeCompare(firstName(b.person),'de'));

    return rows.map(({person,items,ready})=>{
      const layer=K.state?.layer||'planned';
      let times='';
      if(layer==='compare'){
        const soll=items.filter(x=>x._phoneKind==='planned'),ist=items.filter(x=>x._phoneKind==='actual');
        times=`S ${soll.length?soll.map(span).join(' · '):'–'} / I ${ist.length?ist.map(span).join(' · '):'–'}`;
      }else{
        times=items.length?items.map(span).join(' · '):(ready.length?'nur Bereitschaft':'–');
      }
      const badges=[];
      if(person.personType==='helper')badges.push('<span class="kc-phone-badge helper">Aushilfe</span>');
      if(items.some(x=>x.zone==='special'||K.isSpecialShift?.(x)))badges.push('<span class="kc-phone-badge special">Z</span>');
      if(items.some(x=>x.status==='absent'))badges.push('<span class="kc-phone-badge absent">Ausfall</span>');
      if(ready.length)badges.push(`<span class="kc-phone-badge standby">B ${esc(ready.map(span).join(' · '))}</span>`);
      return `<button type="button" class="kc-phone-day-row" data-kc-phone-person="${esc(person.personId)}"><span class="kc-phone-day-person">${esc(firstName(person))}</span><span class="kc-phone-day-duty"><span class="kc-phone-day-times">${esc(times)}</span>${badges.length?`<span class="kc-phone-day-sub">${badges.join('')}</span>`:''}</span></button>`;
    }).join('');
  }

  function statusInfo(day,recordsCount){
    if(!day)return{html:'',critical:0};
    if(K.state?.layer==='wish')return{html:`<strong>${recordsCount} Wunsch${recordsCount===1?'':'zeiten'}</strong><span>für diesen Tag</span>`,critical:0};
    let critical=0;
    try{critical=Number(K.evaluateDay?.(day)?.critical||0);}catch(_){}
    const cls=critical?'warn':'ok',txt=critical?`⚠ ${critical} kritische Lücke${critical===1?'':'n'}`:'✓ Keine kritische Lücke';
    return{html:`<strong>${recordsCount} Einsatz${recordsCount===1?'':'zeiten'}</strong><span class="${cls}">${txt}</span>`,critical};
  }

  function restoreNames(){
    document.querySelectorAll('[data-kc-phone-full-name]').forEach(el=>{
      el.textContent=el.dataset.kcPhoneFullName||el.textContent;
      delete el.dataset.kcPhoneFullName;
    });
  }
  function compactPlannerNames(){
    document.querySelectorAll('.person-row[data-person]').forEach(row=>{
      const el=row.querySelector('.person-name'),p=K.person?.(row.dataset.person);
      if(!el||!p)return;
      if(!el.dataset.kcPhoneFullName)el.dataset.kcPhoneFullName=p.name||el.textContent||'';
      el.textContent=firstName(p);
    });
    document.querySelectorAll('.standby-row[data-standby-row]').forEach(row=>{
      const b=row.querySelector('.standby-person b');
      if(!b)return;
      const entry=(K.standby||[]).find(x=>x.id===row.dataset.standbyRow),p=entry&&K.person?.(entry.personId);
      if(p){
        if(!b.dataset.kcPhoneFullName)b.dataset.kcPhoneFullName=p.name||b.textContent||'';
        b.textContent=firstName(p);
      }
    });
  }

  function ensureShell(main,day){
    let shell=main.querySelector(':scope > .kc-phone-day-shell');
    if(!shell){
      shell=document.createElement('section');
      shell.className='kc-phone-day-shell';
      shell.setAttribute('aria-label','Vereinfachte Handy-Tagesansicht');
      main.prepend(shell);
    }
    const mode=getMode(),records=sourceForDay(day),rows=buildRows(day),status=statusInfo(day,records.length);
    shell.innerHTML=`
      <div class="kc-phone-day-nav">
        <button type="button" data-kc-phone-nav="-1" aria-label="Vorheriger Tag">‹</button>
        <div class="kc-phone-day-title"><b>${esc(dayLabel(day))}</b><small>${esc(detailLabel(day))} · ${esc(layerLabel())}</small></div>
        <button type="button" data-kc-phone-nav="1" aria-label="Nächster Tag">›</button>
      </div>
      <div class="kc-phone-day-switch" role="group" aria-label="Handyansicht">
        <button type="button" data-kc-phone-mode="list" class="${mode==='list'?'active':''}" aria-pressed="${mode==='list'}">Liste</button>
        <button type="button" data-kc-phone-mode="bars" class="${mode==='bars'?'active':''}" aria-pressed="${mode==='bars'}">Balken</button>
      </div>
      <div class="kc-phone-day-status">${status.html}</div>
      <div class="kc-phone-day-list">${rows||'<div class="kc-phone-day-empty">Für diesen Tag sind noch keine Einsätze eingetragen.</div>'}</div>`;
    document.body.classList.toggle('kc-phone-list-mode',mode==='list');

    shell.querySelectorAll('[data-kc-phone-nav]').forEach(btn=>btn.onclick=()=>{
      const dir=Number(btn.dataset.kcPhoneNav),native=document.getElementById(dir<0?'prevDayBtn':'nextDayBtn');
      if(native)native.click();
      else if(K.state&&Array.isArray(K.days)){
        K.state.dateIndex=Math.max(0,Math.min(K.days.length-1,(K.state.dateIndex||0)+dir));
        K.render?.();
      }
    });
    shell.querySelectorAll('[data-kc-phone-mode]').forEach(btn=>btn.onclick=()=>{
      const next=btn.dataset.kcPhoneMode==='bars'?'bars':'list';
      setMode(next);document.body.classList.toggle('kc-phone-list-mode',next==='list');
      queueApply();
    });
    shell.querySelectorAll('[data-kc-phone-person]').forEach(btn=>btn.onclick=()=>{
      pendingPerson=btn.dataset.kcPhonePerson;
      setMode('bars');document.body.classList.remove('kc-phone-list-mode');
      queueApply();
    });
  }

  function scrollPending(){
    if(!pendingPerson)return;
    const id=pendingPerson;pendingPerson=null;
    requestAnimationFrame(()=>{
      const row=[...document.querySelectorAll('.person-row[data-person]')].find(x=>x.dataset.person===id);
      row?.scrollIntoView?.({block:'center',inline:'nearest',behavior:'smooth'});
    });
  }

  function apply(){
    queued=false;
    if(applying)return;
    applying=true;
    try{
      const phone=isPhone(),day=currentDay(),main=document.getElementById('mainView');
      const dayPlanner=phone&&main&&K.state?.view==='day'&&!K.state?.mobileMode&&!!main.querySelector('.planner-wrap');
      document.body.classList.toggle('kc-phone-day-active',!!dayPlanner);
      if(!dayPlanner){
        document.body.classList.remove('kc-phone-list-mode');
        main?.querySelector(':scope > .kc-phone-day-shell')?.remove();
        restoreNames();
        return;
      }
      compactPlannerNames();
      ensureShell(main,day);
      scrollPending();
    }finally{applying=false;}
  }
  function queueApply(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(apply);
  }
  function installListeners(){
    if(listenersInstalled)return;
    listenersInstalled=true;
    window.addEventListener('resize',queueApply,{passive:true});
    window.addEventListener('orientationchange',queueApply,{passive:true});
    document.addEventListener('click',e=>{
      if(e.target.closest('#viewTabs,#layerTabs,#dateBtn,#prevDayBtn,#nextDayBtn'))setTimeout(queueApply,0);
    },true);
  }
  function waitForMain(){
    if(bootObserver||document.getElementById('mainView'))return;
    const root=document.body||document.documentElement;
    if(!root)return;
    bootObserver=new MutationObserver(()=>{
      if(!document.getElementById('mainView'))return;
      bootObserver.disconnect();bootObserver=null;start();
    });
    bootObserver.observe(root,{childList:true,subtree:true});
  }
  function start(){
    installListeners();
    const main=document.getElementById('mainView');
    if(!main){waitForMain();return false;}
    if(bootObserver){bootObserver.disconnect();bootObserver=null;}
    if(observer&&observer._kcMain!==main){observer.disconnect();observer=null;}
    if(!observer){
      observer=new MutationObserver(()=>{if(!applying)queueApply();});
      observer._kcMain=main;
      observer.observe(main,{childList:true,subtree:false});
    }
    queueApply();
    return true;
  }

  K.phoneDayUx={version:'0.19.40',start,refresh:queueApply,apply:queueApply,getMode,setMode,firstName};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();