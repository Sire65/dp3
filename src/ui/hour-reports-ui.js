// DP2-F-SE-03 Sonderstunden-Eingang – Planer-Dialog (Register Ist → Menü „★ Sonderstunden-Eingang“).
// Abholen aus der Club App, Sammelmeldungen ansehen, je Person oder alle bestätigen bzw. mit Grund ablehnen.
// Regeln und Buchung liegen in src/core/hour-reports.js (bestätigt = Ist über K.actual.saveActual).
(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=iso=>{try{return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso+'T12:00:00'))}catch(_){return iso}};
  const fmtTime=h=>{const v=Number(h),x=v>=24?v-24:v;return `${String(Math.floor(x)).padStart(2,'0')}:${String(Math.round(x%1*60)).padStart(2,'0')}${v>=24?' (+1 Tag)':''}`;};
  const hours=v=>Number(v||0).toLocaleString('de-DE',{maximumFractionDigits:2});
  const core=()=>K.hourReportsCore;
  const name=id=>K.person?.(id)?.name||id;
  const STATUS={gemeldet:'offen',bestaetigt:'bestätigt',abgelehnt:'abgelehnt',zurueckgezogen:'zurückgezogen'};
  let view='gemeldet',busy=false;

  function close(){document.getElementById('hrBackdrop')?.remove();}
  function status(t,bad=false){const el=document.getElementById('hrStatusLine');if(el){el.textContent=t;el.classList.toggle('bad',!!bad);}}
  const canPull=()=>!!K.supabaseConnection?.hourReportsPending;
  const canReopen=()=>K.actualWorkflow?.status==='closed'&&(K.auth?.has?K.auth.has('roster.actual.reopen'):false);

  function rowHtml(r){
    const w=core().warnings(r.id),open=r.status==='gemeldet'&&core().canDecide();
    return `<li class="hr-person" data-hr="${esc(r.id)}"><div><b>${esc(name(r.personId))}</b><small>${fmtTime(r.start)}–${fmtTime(r.end)}${r.breakMinutes?` · Pause ${r.breakMinutes} Min.`:''} · ${hours(core().hoursOf(r))} h</small>${w.map(x=>`<small class="hr-warn hr-${x.level}">${x.level==='error'?'⛔':x.level==='warn'?'⚠':'ℹ'} ${esc(x.text)}</small>`).join('')}${r.status==='abgelehnt'&&r.ablehngrund?`<small>Grund: ${esc(r.ablehngrund)}</small>`:''}</div>${open?`<div class="se-row-actions"><button type="button" class="ux-btn" data-hr-ok="${esc(r.id)}">✓ Bestätigen</button><button type="button" class="ux-btn secondary" data-hr-no="${esc(r.id)}">Ablehnen</button></div>`:`<span class="se-badge hr-${esc(r.status)}">${esc(STATUS[r.status]||r.status)}</span>`}</li>`;
  }
  function groupHtml(g){
    const f=g.first,title=f.specialEventTitle||K.specialEventsCore?.get?.(f.specialEventId)?.titel||'Sondereinsatz',total=g.rows.reduce((n,r)=>n+core().hoursOf(r),0),openRows=g.rows.filter(r=>r.status==='gemeldet'),note=g.rows.find(r=>r.bemerkung)?.bemerkung||'';
    return `<li class="se-item hr-group"><div><b>${esc(title)}</b><small>${esc(fmtDate(f.date))} · ${esc(core().activityLabel(f.taetigkeit))} · gemeldet von ${esc(name(f.gemeldetVon))}${g.rows.some(r=>r.verspaetet)?' · <span class="hr-late">verspätet</span>':''}</small>${note?`<small>„${esc(note)}“</small>`:''}<small>${g.rows.length} ${g.rows.length===1?'Person':'Personen'} · zusammen ${hours(total)} h</small></div>${openRows.length>1&&core().canDecide()?`<button type="button" class="ux-btn" data-hr-all="${esc(g.sammelId)}">✓ Alle bestätigen</button>`:'<span></span>'}<ul class="hr-people">${g.rows.map(rowHtml).join('')}</ul></li>`;
  }

  function render(){
    const body=document.getElementById('hrBody');if(!body||!core())return;
    const list=core().groups({status:view}),openCount=core().pending().length;
    body.innerHTML=`<div class="hr-tabs" role="tablist"><button type="button" role="tab" class="ux-btn ${view==='gemeldet'?'':'secondary'}" data-hr-view="gemeldet" aria-selected="${view==='gemeldet'}">Offen (${openCount})</button><button type="button" role="tab" class="ux-btn ${view==='erledigt'?'':'secondary'}" data-hr-view="erledigt" aria-selected="${view==='erledigt'}">Erledigt</button></div>${K.actualWorkflow?.status==='closed'?`<p class="hr-closed">Der Istplan ist abgeschlossen. Bestätigte Stunden werden als Nachtrag gebucht; dafür den Istplan mit Begründung wieder öffnen.${canReopen()?' <button type="button" class="ux-btn secondary" id="hrReopen">Für Nachtrag öffnen</button>':''}</p>`:''}${list.length?`<ul class="se-list">${list.map(groupHtml).join('')}</ul>`:`<p class="se-empty">${view==='gemeldet'?'Keine offenen Meldungen.':'Noch nichts entschieden.'}</p>`}`;
    body.querySelectorAll('[data-hr-view]').forEach(b=>b.onclick=()=>{view=b.dataset.hrView;render();});
    body.querySelectorAll('[data-hr-ok]').forEach(b=>b.onclick=()=>run(()=>core().decide(b.dataset.hrOk,{status:'bestaetigt'}),'Bestätigt – die Stunden stehen jetzt im Kontoauszug.'));
    body.querySelectorAll('[data-hr-no]').forEach(b=>b.onclick=()=>{const reason=window.prompt(`Warum wird die Meldung von ${name(core().groups({status:'alle'}).flatMap(g=>g.rows).find(r=>r.id===b.dataset.hrNo)?.personId)} abgelehnt?`,'');if(reason==null)return;run(()=>core().decide(b.dataset.hrNo,{status:'abgelehnt',reason}),'Abgelehnt.');});
    body.querySelectorAll('[data-hr-all]').forEach(b=>b.onclick=()=>run(async()=>{const r=await core().decideGroup(b.dataset.hrAll,{status:'bestaetigt'});if(r.failed.length)throw new Error(`${r.done.length} bestätigt, ${r.failed.length} nicht: ${r.failed.map(f=>`${name(f.personId)} – ${f.error}`).join('; ')}`);},'Alle bestätigt – die Stunden stehen jetzt im Kontoauszug.'));
    const reopen=document.getElementById('hrReopen');if(reopen)reopen.onclick=()=>{const reason=window.prompt('Begründung für das Wiederöffnen (Nachtrag Sonderstunden):','Nachtrag Sonderstunden');if(!reason)return;try{K.actual.reopenPlan({reason});render();status('Istplan für den Nachtrag geöffnet. Danach wieder abschließen.');}catch(e){status(e.message||String(e),true);}};
  }
  async function run(job,ok){if(busy)return;busy=true;status('Wird gespeichert …');try{await job();status(ok);}catch(e){status(e.message||String(e),true);}finally{busy=false;render();K.render?.();}}
  async function pull(){if(busy)return;busy=true;status('Meldungen werden abgeholt …');try{const r=await core().pull();status(`${r.received} offene Meldungen abgeholt.`);}catch(e){status('Nicht abgeholt: '+(e.message||e),true);}finally{busy=false;render();}}

  function open({fetch=true}={}){
    if(!core())return;close();
    const back=document.createElement('div');back.id='hrBackdrop';back.className='se-backdrop';
    back.innerHTML=`<section class="se-panel" role="dialog" aria-modal="true" aria-labelledby="hrTitle"><header class="se-head"><h2 id="hrTitle">★ Sonderstunden-Eingang</h2><button type="button" class="se-close" id="hrClose" aria-label="Schließen">×</button></header><p class="se-intro">Gemeldete Stunden zu Sondereinsätzen. Bestätigte Stunden werden als Ist gebucht und dem Stundenkonto „${esc(K.eventConfig?.name||'Weihnachtsmarkt')}“ gutgeschrieben.</p><div id="hrBody" class="se-body"></div><footer class="se-foot"><span id="hrStatusLine" class="se-status" role="status" aria-live="polite"></span>${canPull()?'<button type="button" class="ux-btn secondary" id="hrPull">⇩ Club-App-Meldungen abholen</button>':''}</footer></section>`;
    document.body.appendChild(back);
    back.addEventListener('click',e=>{if(e.target===back)close();});back.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    document.getElementById('hrClose').onclick=close;const p=document.getElementById('hrPull');if(p)p.onclick=pull;
    render();document.getElementById('hrClose').focus();
    if(fetch&&canPull())pull();
  }
  K.hourReportsUi={version:'0.1.0',open,close};
})();
