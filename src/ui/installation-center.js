(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{},roles=new Set(['planner','duty_manager','admin']),LOAD_TIMEOUT_MS=12000;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const allowed=()=>roles.has(String(K.currentUser?.role||''));
  const fmt=v=>v?new Date(v).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'}):'–';
  const compact=()=>matchMedia('(max-width:900px), (pointer:coarse) and (max-width:1200px)').matches;
  const withTimeout=(p,ms,label)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`${label} hat nicht geantwortet.`)),ms))]);
  const deviceLabel=v=>({handy:'Handy',tablet:'Tablet',pc:'PC',unknown:'Unbekannt'})[String(v||'unknown')]||String(v||'–');
  const platformLabel=v=>({ios:'iOS',android:'Android',windows:'Windows',macos:'macOS',linux:'Linux',unknown:'Unbekannt'})[String(v||'unknown').toLowerCase()]||String(v||'–');
  const accessLabel=v=>({none:'Kein Zugang',test:'Testzugang',member:'Mitglied'})[String(v||'none')]||String(v||'–');
  function statusInfo(r){
    const s=String(r.status||'');
    if(s==='completed')return ['✅','Abgeschlossen','ok'];
    if(s==='test_received')return ['✅','Installiert · Push OK','ok'];
    if(s==='push_enabled')return ['🟢','Installiert · Push aktiv','ok'];
    if(s==='installed')return ['🟢','Installiert','ok'];
    if(s==='failed')return ['🔴','Fehler','error'];
    if(s==='revoked')return ['⚫','Gesperrt','muted'];
    return ['🟡','Offen','warn'];
  }
  function close(){document.getElementById('kcInstallOverlay')?.remove()}
  async function open(){
    if(!allowed()||!K.installationHistory)return;
    let host=document.getElementById('kcInstallOverlay');
    if(!host){host=document.createElement('div');host.id='kcInstallOverlay';host.className='kc-install-overlay';document.body.appendChild(host)}
    host.scrollTop=0;
    host.innerHTML=`<button id="kcInstallFloatingClose" type="button" aria-label="Installationshistorie schließen" title="Schließen" style="position:fixed;right:18px;top:calc(env(safe-area-inset-top, 0px) + 18px);z-index:260001;width:56px;height:56px;border:1px solid #d8c9c1;border-radius:16px;background:#fff;color:#111;font-size:34px;line-height:48px;box-shadow:0 4px 14px rgba(0,0,0,.18);touch-action:manipulation">×</button><div class="kc-install-card">
      <div class="kc-install-head"><div><h2>📲 Installationshistorie</h2><p>KC DP2 · Wer hat wann auf welchem Gerät installiert?</p></div><button id="kcInstallClose" aria-label="Schließen">✕</button></div>
      <div class="kc-install-toolbar">
        <button id="kcInstallBack" type="button" aria-label="Zurück zum KC-DP2-Programm">← Zurück zum Programm</button>
        <label>Anzeige <select id="kcInstallFilter"><option value="installed">Erfolgreich installiert</option><option value="all">Alle</option><option value="push">Push erfolgreich</option><option value="handy">Handy</option><option value="tablet">Tablet</option><option value="pc">PC</option><option value="none">Ohne Zugang</option></select></label>
        <button id="kcInstallReload">Aktualisieren</button>
      </div>
      <div id="kcInstallSummary"></div>
      <div id="kcInstallTable">Lade Installationen …</div>
      <div id="kcInstallUpdated" class="kc-install-updated"></div>
    </div>`;
    host.querySelector('#kcInstallFloatingClose').onclick=close;
    host.querySelector('#kcInstallClose').onclick=close;
    host.querySelector('#kcInstallBack').onclick=close;
    let allRows=[],loading=false;
    function filtered(){
      const f=host.querySelector('#kcInstallFilter').value;
      if(f==='all')return allRows;
      if(f==='installed')return allRows.filter(r=>!!r.installed_at);
      if(f==='push')return allRows.filter(r=>!!r.test_received_at);
      if(['handy','tablet','pc'].includes(f))return allRows.filter(r=>r.device_type===f);
      if(f==='none')return allRows.filter(r=>r.access_mode==='none');
      return allRows;
    }
    function summary(){
      const installed=allRows.filter(r=>r.installed_at),push=allRows.filter(r=>r.test_received_at);
      const n=t=>installed.filter(r=>r.device_type===t).length;
      host.querySelector('#kcInstallSummary').innerHTML=`<div class="kc-install-stats">
        <div><b>${installed.length}</b><span>installiert</span></div>
        <div><b>${n('handy')}</b><span>Handys</span></div>
        <div><b>${n('tablet')}</b><span>Tablets</span></div>
        <div><b>${n('pc')}</b><span>PCs</span></div>
        <div><b>${push.length}</b><span>Push-Test OK</span></div>
      </div>`;
    }
    function cards(rows,thost){
      thost.className='kc-install-card-list';
      thost.innerHTML=rows.length?rows.map(r=>{const [icon,label,cls]=statusInfo(r);return `<article class="kc-install-mobile-card ${cls}">
        <div class="kc-install-mobile-top"><span>${icon} ${esc(label)}</span><span>${esc(deviceLabel(r.device_type))} · ${esc(platformLabel(r.platform))}</span></div>
        <h3>${esc(r.display_name||r.person_id||'Unbekannt')}</h3>
        <p><b>Installiert:</b> ${fmt(r.installed_at)}<br><b>Version:</b> ${esc(r.app_version||'–')}<br><b>Push freigegeben:</b> ${fmt(r.push_enabled_at)}<br><b>Push-Test:</b> ${fmt(r.test_received_at)}<br><b>Zugang:</b> ${esc(accessLabel(r.access_mode))}<br><b>Abgeschlossen:</b> ${fmt(r.completed_at)}</p>
      </article>`}).join(''):'<p class="kc-install-empty">Keine Installationen für diesen Filter.</p>';
    }
    function render(){
      summary();
      const rows=filtered(),thost=host.querySelector('#kcInstallTable');
      thost.className='';
      if(compact()){cards(rows,thost);return}
      const columns=[
        {key:'status',label:'Status',render:r=>{const [i,l,c]=statusInfo(r);return `<span class="kc-install-status ${c}">${i} ${esc(l)}</span>`}},
        {key:'display_name',label:'Person',render:r=>`<b>${esc(r.display_name||r.person_id||'–')}</b>`},
        {key:'installed_at',label:'Installiert am',render:r=>fmt(r.installed_at)},
        {key:'device_type',label:'Gerät',render:r=>esc(deviceLabel(r.device_type))},
        {key:'platform',label:'System',render:r=>esc(platformLabel(r.platform))},
        {key:'app_version',label:'Version'},
        {key:'push_enabled_at',label:'Push erlaubt',render:r=>r.push_enabled_at?`✅ ${fmt(r.push_enabled_at)}`:'–'},
        {key:'test_received_at',label:'Push-Test',render:r=>r.test_received_at?`✅ ${fmt(r.test_received_at)}`:'–'},
        {key:'access_mode',label:'Zugang',render:r=>esc(accessLabel(r.access_mode))},
        {key:'completed_at',label:'Abschluss',render:r=>fmt(r.completed_at)}
      ];
      if(K.tableCore)K.tableCore.create(thost,{rows,columns,selectable:false,tableClass:'kc-install-table',filterPlaceholder:'Installationen filtern …',countLabel:n=>`${n} Installationen`,initialSort:'installed_at',initialDir:-1});
      else cards(rows,thost);
    }
    async function load(){
      if(loading)return;loading=true;
      const reload=host.querySelector('#kcInstallReload');reload.disabled=true;reload.textContent='Lade …';
      try{
        if(!navigator.onLine)throw new Error('Dieses Gerät ist offline.');
        allRows=await withTimeout(K.installationHistory.adminList(500),LOAD_TIMEOUT_MS,'Installationshistorie');
        render();
        host.querySelector('#kcInstallUpdated').textContent=`Stand: ${new Date().toLocaleString('de-DE')}`;
      }catch(e){
        host.querySelector('#kcInstallTable').innerHTML=`<div class="kc-install-load-error"><b>Installationshistorie konnte nicht geladen werden.</b><p>${esc(e.message)}</p><button id="kcInstallRetry">Nochmal versuchen</button></div>`;
        host.querySelector('#kcInstallRetry')?.addEventListener('click',load);
      }finally{loading=false;reload.disabled=false;reload.textContent='Aktualisieren'}
    }
    host.querySelector('#kcInstallReload').onclick=load;
    host.querySelector('#kcInstallFilter').onchange=render;
    const mq=matchMedia('(max-width:900px), (pointer:coarse) and (max-width:1200px)');mq.addEventListener?.('change',render);
    await load();
  }
  function inject(){
    if(!allowed()||document.getElementById('kcInstallationAdminEntry'))return;
    const modal=document.getElementById('modal');
    if(!modal||modal.classList.contains('hidden'))return;
    const b=document.createElement('button');b.id='kcInstallationAdminEntry';b.type='button';b.className='kc-install-admin-entry';b.textContent='📲 Installationshistorie';b.title='Erfolgreiche KC-DP2-Installationen nach Gerät und Zeitpunkt';b.onclick=open;modal.appendChild(b);
  }
  // Eine alte Installationsansicht darf beim Wiederherstellen/Wiederaufnehmen der PWA
  // nicht automatisch über dem bereits gestarteten Dienstplan stehen bleiben.
  window.addEventListener('pagehide',close);
  window.addEventListener('pageshow',close);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')close()});
  window.addEventListener('pagereveal',close);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',close,{once:true});else close();
  document.getElementById('settingsBtn')?.addEventListener('click',()=>setTimeout(inject,100));
  new MutationObserver(()=>inject()).observe(document.body,{subtree:true,childList:true});
  K.installationCenter={version:'0.19.55-install-back-resume-3',open,close,allowed};
})();
