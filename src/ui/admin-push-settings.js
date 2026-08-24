(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const EVENT_KEYS=new Set(['install_success','install_error']);
  let settingsWindowUntil=0,lastData=null,saving=false;
  const allowed=()=>String(K.currentUser?.role||'')==='admin';
  function close(){document.getElementById('kcAdminPushSettingsOverlay')?.remove()}
  function shell(){
    let host=document.getElementById('kcAdminPushSettingsOverlay');
    if(!host){host=document.createElement('div');host.id='kcAdminPushSettingsOverlay';host.className='kc-install-overlay';document.body.appendChild(host)}
    host.innerHTML=`<div class="kc-admin-push-card"><div class="kc-admin-push-head"><div><h2>🔔 Admin-Push-Ereignisse</h2><p>Festlegen, wann KC DP2 automatisch eine Admin-Push senden soll.</p></div><button id="kcApsClose" type="button" aria-label="Schließen">✕</button></div><div id="kcApsBody" class="kc-admin-push-body"><div class="kc-admin-push-loading">Einstellungen werden geladen …</div></div></div>`;
    host.onclick=e=>{if(e.target===host)close()};host.querySelector('#kcApsClose').onclick=close;return host;
  }
  function eventRow({key,label,severity,enabled,masterActive}){
    const info=key==='install_success'?'Du erhältst eine Meldung, sobald eine Installation vollständig erfolgreich abgeschlossen wurde.':'Du erhältst eine Meldung, wenn ein Installationsvorgang als fehlgeschlagen erkannt wird.';
    const icon=severity==='error'?'🔴':'🟢';
    return `<div class="kc-admin-push-event"><div class="kc-admin-push-event-text"><b>${icon} ${esc(label)}</b><span>${esc(info)}</span></div><label class="kc-switch"><input type="checkbox" data-admin-push-event="${esc(key)}" ${enabled?'checked':''} ${masterActive?'':'disabled'}><span></span></label></div>`
  }
  function render(host,data){
    lastData=data||{};const active=!!data?.active,events=(Array.isArray(data?.events)?data.events:[]).filter(e=>EVENT_KEYS.has(String(e?.key||'')));
    host.querySelector('#kcApsBody').innerHTML=`<div class="kc-admin-push-summary"><div><b>Admin-Pushs</b><span>${active?'aktiv':'ausgeschaltet'}</span></div><div><b>Push-Ziel</b><span>${Number(data?.activeEndpoints||0)} aktives Gerät${Number(data?.activeEndpoints||0)===1?'':'e'}</span></div><div><b>Speicherung</b><span>serverseitig</span></div></div><div class="kc-admin-push-master"><div><b>Alle Admin-Pushs</b><span>Hauptschalter. Einzelne Ereignisse bleiben gespeichert.</span></div><label class="kc-switch master"><input id="kcApsMaster" type="checkbox" ${active?'checked':''}><span></span></label></div><div class="kc-admin-push-events ${active?'':'disabled'}">${events.map(e=>eventRow({...e,masterActive:active})).join('')||'<p>Keine Push-Ereignisse verfügbar.</p>'}</div><div class="kc-admin-push-foot"><span id="kcApsState">${data?.updatedAt?'Zuletzt gespeichert: '+new Date(data.updatedAt).toLocaleString('de-DE'):'Bereit'}</span><button id="kcApsReload" type="button">Aktualisieren</button></div>`;
    const master=host.querySelector('#kcApsMaster');
    async function change(patch,control){
      if(saving)return; saving=true; const state=host.querySelector('#kcApsState'); if(state)state.textContent='Speichere …';
      try{const next=await K.adminPushSettings.set(patch);render(host,next)}catch(_){if(control)control.checked=!control.checked;if(state)state.textContent='Einstellung konnte nicht gespeichert werden.';saving=false;return}
      saving=false;
    }
    master.onchange=()=>change({active:master.checked},master);
    host.querySelectorAll('[data-admin-push-event]').forEach(x=>x.onchange=()=>{
      const key=x.dataset.adminPushEvent;if(key==='install_success')change({successEnabled:x.checked},x);else if(key==='install_error')change({errorEnabled:x.checked},x)
    });
    host.querySelector('#kcApsReload').onclick=()=>load(host);
  }
  async function load(host){
    try{const data=await K.adminPushSettings.get();render(host,data)}catch(_){host.querySelector('#kcApsBody').innerHTML='<div class="kc-admin-push-error"><b>Einstellungen konnten nicht geladen werden.</b><p>Bitte Verbindung prüfen oder neu anmelden.</p><button id="kcApsRetry" type="button">Nochmal versuchen</button></div>';host.querySelector('#kcApsRetry').onclick=()=>load(host)}
  }
  async function open(){if(!allowed())return;const host=shell();if(!K.adminPushSettings){host.querySelector('#kcApsBody').innerHTML='<div class="kc-admin-push-error"><b>Push-Steuerung ist noch nicht bereit.</b><p>Bitte KC DP2 einmal neu öffnen.</p></div>';return}await load(host)}
  function inject(){
    if(!allowed()||Date.now()>settingsWindowUntil)return;
    const modal=document.getElementById('modal'),back=document.getElementById('modalBackdrop');
    if(!modal||back?.classList.contains('hidden')||document.getElementById('kcAdminPushSettingsEntry'))return;
    const b=document.createElement('button');b.id='kcAdminPushSettingsEntry';b.type='button';b.className='kc-push-admin-entry';b.textContent='🔔 Admin-Push-Ereignisse';b.onclick=open;modal.appendChild(b)
  }
  function install(){document.getElementById('settingsBtn')?.addEventListener('click',()=>{settingsWindowUntil=Date.now()+1800;setTimeout(inject,60);setTimeout(inject,300)});new MutationObserver(()=>inject()).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']})}
  document.addEventListener('DOMContentLoaded',install);
  K.adminPushSettingsUi={version:'1.0',open,allowed};
})();