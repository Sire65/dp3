// DP2-F-SE-01 Sondereinsätze – Planer-Dialog (Register Sollplan → Menü „★ Sondereinsätze“).
// Nur Oberfläche; Regeln, Termine und Folgedatum liegen in src/core/special-events.js.
(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=iso=>{if(!iso)return'';try{return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso+'T12:00:00'))}catch(_){return iso}};
  const STATUS={OFFEN:'Termin offen',GEPLANT:'Termin geplant',FEST:'Termin fest'};
  const core=()=>K.specialEventsCore;
  const canEdit=()=>K.auth?.has?K.auth.has('roster.plan.edit'):true;
  const canPublish=()=>(K.auth?.has?K.auth.has('roster.plan.publish'):true)&&!!K.supabaseConnection?.publishSpecialEvents;
  let editing=null;

  function close(){document.getElementById('seBackdrop')?.remove();editing=null;}
  function status(textValue,bad=false){const el=document.getElementById('seStatus');if(el){el.textContent=textValue;el.classList.toggle('bad',!!bad);}}
  async function persist(){try{await K.persistAll?.();}catch(e){status('Gespeichert, aber lokal nicht gesichert: '+(e.message||e),true);}}

  function terminText(e){
    const x=e.effective;
    if(e.wiederkehrend==='markttage')return x.datumVon?`an allen Markttagen (${fmt(x.datumVon)} – ${fmt(x.datumBis)})`:'an allen Markttagen';
    if(e.folgtAuf){const p=core().get(e.folgtAuf);const rel=`${e.abstandTage} ${e.abstandTage===1?'Tag':'Tage'} nach „${esc(p?.titel||'?')}“`;return x.datumVon?`${fmt(x.datumVon)} · ${rel}`:rel;}
    if(!x.datumVon)return'noch kein Datum';
    return x.datumBis&&x.datumBis!==x.datumVon?`${fmt(x.datumVon)} – ${fmt(x.datumBis)}`:fmt(x.datumVon);
  }

  function listHtml(){
    const items=core().list();
    if(!items.length)return'<p class="se-empty">Noch keine Sondereinsätze angelegt. Beispiele: Grünkohl kochen, Abholung und Transport, Getränke mischen zuhause.</p>';
    return `<ul class="se-list">${items.map(e=>`<li class="se-item" data-se="${esc(e.id)}"><div><b>${esc(e.titel)}</b>${e.ort?`<span class="se-ort">${esc(e.ort)}</span>`:''}<small>${esc(e.artLabel)} · ${terminText(e)}</small></div><span class="se-badge se-${e.effective.terminStatus.toLowerCase()}">${STATUS[e.effective.terminStatus]}</span>${canEdit()?`<div class="se-row-actions"><button type="button" class="ux-btn secondary" data-se-edit="${esc(e.id)}">✎ Bearbeiten</button><button type="button" class="ux-btn secondary" data-se-end="${esc(e.id)}">Beenden</button></div>`:''}</li>`).join('')}</ul>`;
  }

  function formHtml(e){
    const v=e||{titel:'',ort:'',art:'kochen',terminStatus:'OFFEN',datumVon:'',datumBis:'',folgtAuf:'',abstandTage:2,wiederkehrend:null,bemerkung:''};
    const mode=v.wiederkehrend==='markttage'?'markttage':v.folgtAuf?'folgt':'eigen';
    const parents=core().list().filter(x=>!e||x.id!==e.id);
    return `<form id="seForm" class="se-form" novalidate>
      <h3>${e?'Sondereinsatz bearbeiten':'Neuer Sondereinsatz'}</h3>
      <label>Titel<input id="seTitel" maxlength="120" required value="${esc(v.titel)}" placeholder="z. B. Grünkohl kochen"></label>
      <label>Ort<input id="seOrt" maxlength="120" value="${esc(v.ort)}" placeholder="z. B. Krankenhaus Dortmund"></label>
      <label>Art<select id="seArt">${K.specialEventKinds.map(k=>`<option value="${esc(k.id)}" ${k.id===v.art?'selected':''}>${esc(k.label)}</option>`).join('')}</select></label>
      <fieldset class="se-mode"><legend>Termin</legend>
        <label><input type="radio" name="seMode" value="eigen" ${mode==='eigen'?'checked':''}> Eigener Termin</label>
        <label><input type="radio" name="seMode" value="folgt" ${mode==='folgt'?'checked':''} ${parents.length?'':'disabled'}> Folgt auf einen anderen Einsatz</label>
        <label><input type="radio" name="seMode" value="markttage" ${mode==='markttage'?'checked':''}> An allen Markttagen</label>
      </fieldset>
      <div class="se-part" data-part="eigen">
        <label>Stand<select id="seStatusSel">${Object.entries(STATUS).map(([k,l])=>`<option value="${k}" ${k===v.terminStatus?'selected':''}>${l}</option>`).join('')}</select></label>
        <label>Von<input type="date" id="seVon" value="${esc(v.datumVon||'')}"></label>
        <label>Bis (freiwillig)<input type="date" id="seBis" value="${esc(v.datumBis||'')}"></label>
      </div>
      <div class="se-part" data-part="folgt">
        <label>Vorgänger<select id="seFolgt">${parents.map(p=>`<option value="${esc(p.id)}" ${p.id===v.folgtAuf?'selected':''}>${esc(p.titel)}</option>`).join('')}</select></label>
        <label>Tage danach<input type="number" id="seAbstand" min="0" max="60" step="1" value="${esc(v.abstandTage??2)}"></label>
        <p class="se-hint">Das Datum rückt automatisch mit, sobald der Vorgänger einen Termin hat.</p>
      </div>
      <div class="se-part" data-part="markttage"><p class="se-hint">Gilt für jeden Markttag, z. B. Getränke mischen zuhause und anliefern.</p></div>
      <label>Bemerkung (freiwillig)<textarea id="seBemerkung" maxlength="500" rows="2">${esc(v.bemerkung||'')}</textarea></label>
      <div class="se-actions"><button type="submit" class="ux-btn">${e?'Änderung speichern':'Sondereinsatz anlegen'}</button>${e?'<button type="button" class="ux-btn secondary" id="seCancel">Abbrechen</button>':''}</div>
    </form>`;
  }

  function syncParts(){const mode=document.querySelector('input[name="seMode"]:checked')?.value||'eigen';document.querySelectorAll('.se-part').forEach(p=>p.hidden=p.dataset.part!==mode);}

  function readForm(){
    const mode=document.querySelector('input[name="seMode"]:checked')?.value||'eigen',val=id=>document.getElementById(id)?.value??'';
    const base={titel:val('seTitel'),ort:val('seOrt'),art:val('seArt'),bemerkung:val('seBemerkung')};
    if(mode==='folgt')return {...base,folgtAuf:val('seFolgt'),abstandTage:Number(val('seAbstand')),wiederkehrend:null,terminStatus:'OFFEN',datumVon:null,datumBis:null};
    if(mode==='markttage')return {...base,folgtAuf:null,wiederkehrend:'markttage',terminStatus:'FEST',datumVon:null,datumBis:null};
    return {...base,folgtAuf:null,wiederkehrend:null,terminStatus:val('seStatusSel'),datumVon:val('seVon')||null,datumBis:val('seBis')||null};
  }

  function render(){
    const body=document.getElementById('seBody');if(!body)return;
    body.innerHTML=`${listHtml()}${canEdit()?formHtml(editing?core().get(editing):null):'<p class="se-hint">Sondereinsätze legt der Planer an.</p>'}`;
    body.querySelectorAll('[data-se-edit]').forEach(b=>b.onclick=()=>{editing=b.dataset.seEdit;render();document.getElementById('seTitel')?.focus();});
    body.querySelectorAll('[data-se-end]').forEach(b=>b.onclick=async()=>{const e=core().get(b.dataset.seEnd);const reason=window.prompt(`Warum wird „${e?.titel}“ beendet?`,'');if(reason==null)return;try{core().deactivate(b.dataset.seEnd,{reason});await persist();status('Sondereinsatz beendet.');render();}catch(err){status(err.message||String(err),true);}});
    body.querySelectorAll('input[name="seMode"]').forEach(r=>r.onchange=syncParts);syncParts();
    const cancel=document.getElementById('seCancel');if(cancel)cancel.onclick=()=>{editing=null;render();};
    const form=document.getElementById('seForm');
    if(form)form.onsubmit=async ev=>{ev.preventDefault();try{const data=readForm();const saved=editing?core().update(editing,data,{reason:'Planer-Dialog'}):core().create(data,{reason:'Planer-Dialog'});editing=null;await persist();render();status(`Gespeichert: ${saved.titel}.`);}catch(err){status(err.message||String(err),true);}};
  }

  function open(){
    if(!core())return;
    close();
    const back=document.createElement('div');back.id='seBackdrop';back.className='se-backdrop';
    back.innerHTML=`<section class="se-panel" role="dialog" aria-modal="true" aria-labelledby="seTitle"><header class="se-head"><h2 id="seTitle">★ Sondereinsätze</h2><button type="button" class="se-close" id="seClose" aria-label="Schließen">×</button></header><p class="se-intro">Einsätze außerhalb des Stands, deren Stunden dem Stundenkonto „${esc(K.eventConfig?.name||'Weihnachtsmarkt')}“ gutgeschrieben werden. Der Termin darf noch offen sein.</p><div id="seBody" class="se-body"></div><footer class="se-foot"><span id="seStatus" class="se-status" role="status" aria-live="polite"></span>${canPublish()?'<button type="button" class="ux-btn secondary" id="sePublish">⇧ Für Mitglieder veröffentlichen</button>':''}</footer></section>`;
    document.body.appendChild(back);
    back.addEventListener('click',e=>{if(e.target===back)close();});
    back.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    document.getElementById('seClose').onclick=close;
    const pub=document.getElementById('sePublish');
    if(pub)pub.onclick=async()=>{pub.disabled=true;status('Wird veröffentlicht …');try{const r=await core().publish();status(`Veröffentlicht: ${r?.upserted??0} Sondereinsätze.`);}catch(err){status('Nicht veröffentlicht: '+(err.message||err),true);}finally{pub.disabled=false;}};
    render();
    document.getElementById('seClose').focus();
  }

  K.specialEventsUi={version:'0.1.0',open,close};
})();
