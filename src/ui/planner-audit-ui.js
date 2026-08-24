(function(){
  const K=window.KCDP=window.KCDP||{};
  let scheduled=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtTime=h=>`${String(Math.floor(Number(h))).padStart(2,'0')}:${String(Math.round((Number(h)%1)*60)).padStart(2,'0')}`;
  function currentDay(){return (K.days||[])[Number(K.state?.dateIndex||0)]||null;}
  function details(audit){
    const rows=[];
    for(const v of audit.hardViolations.slice(0,4))rows.push(`<li><b>${esc(v.label)}</b>${v.personName?` · ${esc(v.personName)}`:''}${v.detail?` · ${esc(v.detail)}`:''}</li>`);
    for(const g of audit.gaps.slice(0,4))rows.push(`<li><b>Besetzungslücke ${esc(g.zone==='front'?'Vorne':g.zone==='back'?'Hinten':'Allgemein')}</b> · ${fmtTime(g.start)}–${fmtTime(g.end)} · ${g.missing} fehlend</li>`);
    for(const w of audit.warnings.slice(0,3))rows.push(`<li><b>Hinweis</b> · ${esc(w)}</li>`);
    return rows.length?`<ul>${rows.join('')}</ul>`:'<p class="planner-audit-oktext">Keine harte Regelverletzung und keine offene Besetzungslücke.</p>';
  }
  function refresh(){
    scheduled=false;const apply=document.getElementById('aiApply'),modal=document.getElementById('modal'),day=currentDay();if(!apply||!modal||!day||!K.plannerAudit?.audit)return null;
    const proposal=K.plannerEngine?.lastResult?.day===day.date?K.plannerEngine.lastResult.shifts:[];let audit;try{audit=K.plannerAudit.audit(day,proposal);}catch(e){console.warn('KC DP2 Planner Audit UI:',e);return null;}
    let panel=document.getElementById('plannerAuditPanel');if(!panel){panel=document.createElement('section');panel.id='plannerAuditPanel';panel.className='planner-audit-panel';modal.querySelector('.modal-actions')?.insertAdjacentElement('beforebegin',panel);}
    panel.classList.toggle('ready',audit.ready);panel.classList.toggle('blocked',!audit.ready);panel.dataset.auditStatus=audit.status;
    panel.innerHTML=`<div class="planner-audit-head"><div><small>Automatische Schlussprüfung</small><b>${esc(audit.statusLabel)}</b></div><span class="planner-audit-badge">${audit.ready?'✓ FREI':'⛔ BLOCKIERT'}</span></div><div class="planner-audit-kpis"><span>Harte Fehler <b>${audit.hardViolations.length}</b></span><span>Lücken <b>${audit.gaps.length}</b></span><span>Dienste <b>${audit.totalShifts}</b></span><span>Ø Std. <b>${audit.distribution.average.toFixed(1).replace('.',',')}</b></span></div>${details(audit)}<div class="planner-audit-foot">Wünsche: ${audit.wishes.preferred} bevorzugt · ${audit.wishes.available} verfügbar · ${audit.wishes.ifNeeded} nur wenn nötig · ${audit.wishes.unavailable} nicht verfügbar. Die Übernahme wird beim Klick zusätzlich erneut in der Fachschicht validiert.</div>`;
    if(!audit.ready){if(apply.dataset.auditPreviousDisabled==null)apply.dataset.auditPreviousDisabled=apply.disabled?'1':'0';apply.disabled=true;apply.dataset.auditBlocked='true';apply.title='Übernahme blockiert: Erst harte Regelverletzungen und Besetzungslücken beheben.';}
    else if(apply.dataset.auditBlocked==='true'){apply.disabled=apply.dataset.auditPreviousDisabled==='1';delete apply.dataset.auditBlocked;delete apply.dataset.auditPreviousDisabled;apply.title='Als Soll-Entwurf übernehmen';}
    K.plannerAuditUi.last=audit;return audit;
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(refresh);}
  const observer=new MutationObserver(m=>{if(m.some(x=>x.type==='childList'))schedule();});observer.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('click',e=>{if(e.target?.id==='aiPlanBtn')setTimeout(schedule,0);});
  K.plannerAuditUi={version:'0.19.42',refresh,last:null};
})();
