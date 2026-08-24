(function(){
  const K=window.KCDP=window.KCDP||{};
  const ADMIN=new Set(['admin']);
  const PRIV=new Set(['planner','duty_manager','admin']);
  let applyScheduled=false;
  function role(){return String(K.currentUser?.role||'')}
  function diagOpen(){return !!document.getElementById('kcDiagOverlay')}
  function clearLegacyDiagnosticsState(){
    try{localStorage.removeItem('kc_dp_diag_capture_freeze_v1')}catch(_){}
    try{localStorage.removeItem('kc_dp_diag_controller_v5_active')}catch(_){}
    document.getElementById('kcDiagCaptureReport')?.remove();
    document.getElementById('kcDiagWatchdogOverlay')?.remove();
  }
  function closeSettingsBeforeDiagnostics(){
    const back=document.getElementById('modalBackdrop'),modal=document.getElementById('modal');
    back?.classList.add('hidden');
    if(modal){modal.innerHTML='';modal.classList.remove('wide')}
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
  }
  function installEarlyDiagnosticsGate(){
    if(window.__KC_DP_DIAG_EARLY_GATE)return;
    window.__KC_DP_DIAG_EARLY_GATE=true;
    window.addEventListener('click',e=>{
      const btn=e.target?.closest?.('#kcDiagnosticsAdminEntryDirect,#kcDiagnosticsAdminEntry');
      if(!btn)return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      clearLegacyDiagnosticsState();
      closeSettingsBeforeDiagnostics();
      setTimeout(()=>{
        try{
          const ok=K.diagnosticsCenter?.open?.();
          if(ok===false)alert('Fehlerdiagnose konnte nicht geöffnet werden.');
        }catch(err){
          alert(`Fehlerdiagnose konnte nicht geöffnet werden: ${err?.message||err}`);
        }
      },0);
    },true);
  }
  function installNotificationGate(){
    if(window.__KC_DP_NOTIFICATION_GATE)return;
    window.__KC_DP_NOTIFICATION_GATE=true;
    window.addEventListener('click',e=>{
      const btn=e.target?.closest?.('#notificationBtn');
      if(!btn||K.notifications?.list)return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      const existing=document.querySelector('script[data-kcdp-notification-reload="1"]');
      if(existing)return;
      const s=document.createElement('script');
      s.src='src/core/notifications.js?v=0.19.55-notify-list-guard-1';
      s.async=false;
      s.dataset.kcdpNotificationReload='1';
      s.onload=()=>{
        if(K.notifications?.list)setTimeout(()=>btn.click(),0);
        else document.getElementById('messageText')&&(document.getElementById('messageText').textContent='Benachrichtigungen konnten nicht geladen werden.');
      };
      s.onerror=()=>{document.getElementById('messageText')&&(document.getElementById('messageText').textContent='Benachrichtigungsmodul konnte nicht geladen werden.');};
      document.head.appendChild(s);
    },true);
  }
  function ensureSupabaseCloseX(){
    if(diagOpen())return;
    const modal=document.getElementById('modal');
    if(!modal)return;
    const title=modal.querySelector('h2')?.textContent?.trim()||'';
    if(title!=='Supabase / KC Sync')return;
    if(document.getElementById('kcSupabaseCloseX'))return;
    modal.style.position='relative';
    const x=document.createElement('button');
    x.id='kcSupabaseCloseX';
    x.type='button';
    x.textContent='×';
    x.setAttribute('aria-label','Supabase/KC-Sync-Fenster schließen');
    x.title='Schließen';
    Object.assign(x.style,{position:'absolute',right:'18px',top:'16px',width:'52px',height:'52px',borderRadius:'14px',border:'1px solid #d8c9c1',background:'#fff',color:'#111',fontSize:'36px',lineHeight:'44px',zIndex:'20',touchAction:'manipulation'});
    x.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      const close=document.getElementById('dbClose');
      if(close)close.click();
      else{
        document.getElementById('modalBackdrop')?.classList.add('hidden');
        modal.innerHTML='';modal.classList.remove('wide');
        document.body.classList.remove('modal-open');
      }
    });
    modal.appendChild(x);
  }
  function ensureSaveState(){
    if(diagOpen())return;
    const right=document.querySelector('.top-right');if(!right||document.getElementById('kcSaveState'))return;
    const x=document.createElement('div');x.id='kcSaveState';x.className='kc-save-state';x.setAttribute('role','status');x.innerHTML='<span>✓</span><span>Daten gespeichert</span>';right.insertBefore(x,right.firstChild);
  }
  function updateSaveState(){
    if(diagOpen())return;
    const x=document.getElementById('kcSaveState');if(!x)return;
    const sup=document.getElementById('supabaseStatusLed'),idb=document.getElementById('idbStatusLed');
    const bad=sup?.classList.contains('error')&&idb?.classList.contains('error');const warn=sup?.classList.contains('error')&&!bad;
    x.classList.toggle('bad',!!bad);x.classList.toggle('warn',!!warn);
    x.innerHTML=bad?'<span>⚠</span><span>Speicher prüfen</span>':warn?'<span>●</span><span>Lokal gespeichert</span>':'<span>✓</span><span>Daten gespeichert</span>';
  }
  function roleUx(){
    if(diagOpen())return;
    const r=role();document.body.classList.toggle('kc-tech-simple',!ADMIN.has(r));ensureSaveState();updateSaveState();
    ['photoBtn','actualImportBtn','pauseToggleBtn'].forEach(id=>document.getElementById(id)?.classList.add('kc-secondary-tool'));
    const search=document.getElementById('globalSearch');if(search)search.placeholder='Mitglied oder Dienst suchen…';
    const more=document.getElementById('moreBtn');if(more)more.title='Auswertung, Druck, Export und weitere Werkzeuge';
    const settings=document.getElementById('settingsBtn');if(settings)settings.title=ADMIN.has(r)?'Einstellungen und Administration':'Einstellungen';
    if(!PRIV.has(r))document.querySelectorAll('#aiPlanBtn,#photoBtn,#actualImportBtn,#pauseToggleBtn,#publishBtn,#quickPlanBtn,#addShiftBtn,#checkBtn,#emailCenterBtn').forEach(x=>x.classList.add('hidden'));
  }
  function humanize(){
    if(diagOpen())return;
    document.querySelectorAll('.db-label').forEach(x=>{if(x.textContent==='IDX')x.title='Lokaler Gerätespeicher';if(x.textContent==='SUP')x.title='Cloud-Synchronisierung'});
    const m=document.getElementById('messageText');if(m&&/kompakte Plansteuerung|V0\.17\.10|V0\.19\.42|V0\.19\.51|V0\.19\.52|V0\.19\.53|V0\.19\.54|V0\.19\.55/.test(m.textContent||''))m.textContent='KC DP2 V0.20.0 – Dienstplanung bereit.';
    document.title='KC DP2 V0.20.0 · Köcheclub Werne';
  }
  function loadModule(src,key){if(window[key])return;const marker=`script[data-kcdp-module="${key}"]`;if(document.querySelector(marker))return;const s=document.createElement('script');s.src=src;s.async=false;s.dataset.kcdpModule=key;document.head.appendChild(s)}
  function loadV01955Modules(){
    loadModule('src/core/document-identity.js?v=0.19.55-s0','KCDP_DOC_ID');
    loadModule('src/core/email-inbox.js?v=0.19.55-s1','KCDP_EMAIL_CORE');
    loadModule('src/core/inbound-wish-import.js?v=0.19.55-s2','KCDP_INBOUND_IMPORT');
    loadModule('src/ui/email-center.js?v=0.19.55-s1','KCDP_EMAIL_CENTER');
    loadModule('src/ui/session-diagnostics-guard.js?v=0.19.69-close-only-2','KCDP_SESSION_DIAG_GUARD');
    loadModule('src/ui/supabase-session-guard.js?v=0.19.55-single-flight-led-2','KCDP_SUPABASE_SESSION_GUARD')
  }
  function apply(){if(diagOpen())return;roleUx();humanize();updateSaveState();ensureSupabaseCloseX()}
  function scheduleApply(){
    if(diagOpen()||applyScheduled)return;
    applyScheduled=true;
    requestAnimationFrame(()=>{applyScheduled=false;apply()});
  }
  const obs=new MutationObserver(scheduleApply);
  clearLegacyDiagnosticsState();
  installEarlyDiagnosticsGate();
  installNotificationGate();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{loadV01955Modules();apply();obs.observe(document.body,{childList:true,subtree:true})},{once:true});
  else{loadV01955Modules();apply();obs.observe(document.body,{childList:true,subtree:true})}
  window.addEventListener('KC_DP_MANAGER_AUTO_SYNC',updateSaveState);
  K.kcUxPolish={version:'0.19.55-notification-list-guard-1',apply,updateSaveState,loadV01955Modules,clearLegacyDiagnosticsState,installEarlyDiagnosticsGate,installNotificationGate,ensureSupabaseCloseX};
})();
