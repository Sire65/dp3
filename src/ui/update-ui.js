(function(){
  const K=window.KCDP=window.KCDP||{};
  const $=id=>document.getElementById(id);
  let overlay=null,currentManifest=null,currentReport=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function close(){overlay?.remove();overlay=null;}
  function shell(html){close();overlay=document.createElement('div');overlay.className='kc-update-overlay';overlay.innerHTML=`<div class="kc-update-card" role="dialog" aria-modal="true">${html}</div>`;document.body.appendChild(overlay);}
  function brand(){return `<div class="kc-update-brand"><img src="assets/kc-logo.svg" alt="Köcheclub Werne"><div><b>Köcheclub Werne · KC DP2</b><small>Sicheres Programm-Update</small></div></div>`;}
  function notes(m){const t=Array.isArray(m.releaseNotes)?m.releaseNotes.join(' · '):(m.releaseNotes||'Verbesserungen und Fehlerkorrekturen.');return esc(t);}
  function showAvailable(m){currentManifest=m;shell(`${brand()}<h2>Update gefunden</h2><p>Für KC DP2 steht eine neue Version bereit. Ihre Dienstplandaten werden dabei nicht gelöscht.</p><div class="kc-update-version"><span>Installierte Version <b>V${esc(K.updateManager.CURRENT_RELEASE)}</b></span><span>Neu <b>V${esc(m.version)}</b></span></div><div class="kc-update-notes">${notes(m)}</div><p class="kc-update-report-note">Die neue Version wird zuerst vollständig geladen und geprüft. Falls etwas fehlschlägt, bleibt die bisherige Version aktiv.</p><div class="kc-update-actions"><button class="kc-update-btn" id="kcUpdLater">Später</button><button class="kc-update-btn primary" id="kcUpdNow">Jetzt installieren</button></div>`);$('kcUpdLater').onclick=()=>{K.updateManager.snooze(m.version);close();};$('kcUpdNow').onclick=()=>startInstall(m);}
  function startInstall(m){shell(`${brand()}<h2>Update V${esc(m.version)} wird installiert</h2><p>Bitte KC DP2 während der Installation geöffnet lassen.</p><div class="kc-update-progress"><i id="kcUpdBar"></i></div><div class="kc-update-progress-meta"><span>Fortschritt</span><strong id="kcUpdPct">0 %</strong><span>Geladen</span><strong id="kcUpdBytes">0 B</strong><span>Restzeit</span><strong id="kcUpdEta">wird berechnet…</strong></div><div class="kc-update-phase" id="kcUpdPhase">Update wird vorbereitet…</div>`);K.updateManager.install(m);}
  function progress(d){if(!$('kcUpdBar'))return;const pct=Math.max(0,Math.min(100,Number(d.percent||0)));$('kcUpdBar').style.width=pct+'%';$('kcUpdPct').textContent=pct+' %';$('kcUpdBytes').textContent=`${K.updateManager.bytesText(d.downloaded)} / ${K.updateManager.bytesText(d.total)}`;$('kcUpdEta').textContent=d.phase==='activate'?'wenige Sekunden':K.updateManager.etaText(d.eta);$('kcUpdPhase').textContent=d.phase==='verify'?`Prüfe Datei ${d.index||''} von ${d.count||''}: ${d.file||''}`:d.phase==='activate'?'Dateien geprüft. Neue Version wird aktiviert…':`Lade Datei ${d.index||''} von ${d.count||''}: ${d.file||''}`;}
  function success(d){shell(`${brand()}<div class="kc-update-success">✓</div><h2>Update erfolgreich</h2><p>KC DP2 V${esc(d.version)} wurde vollständig geladen, geprüft und aktiviert.</p><div class="kc-update-actions"><button class="kc-update-btn primary" id="kcUpdRestart">KC DP2 neu starten</button></div>`);$('kcUpdRestart').onclick=()=>location.reload();}
  function failed(d){currentReport=d.report;shell(`${brand()}<h2>Update nicht abgeschlossen</h2><p>Die bisherige KC DP2-Version bleibt aktiv. Es wurden keine Dienstplandaten verändert.</p><div class="kc-update-error"><b>Fehler:</b><br>${esc(d.error?.message||'Unbekannter Updatefehler')}</div><p class="kc-update-report-note">Der technische Bericht enthält keine Wunschzeiten oder Dienstplaninhalte. Er enthält nur Update-Version, Browser-/Geräteinformationen und die Fehlermeldung.</p><div class="kc-update-actions"><button class="kc-update-btn" id="kcUpdClose">Schließen</button><button class="kc-update-btn" id="kcUpdDownload">Bericht herunterladen</button><button class="kc-update-btn primary" id="kcUpdSend">Fehlerbericht senden</button></div>`);$('kcUpdClose').onclick=close;$('kcUpdDownload').onclick=()=>K.updateManager.downloadReport(currentReport);$('kcUpdSend').onclick=async()=>{const b=$('kcUpdSend');b.disabled=true;b.textContent='Wird gesendet…';const r=await K.updateManager.reportFailure(currentReport);if(r.ok){b.textContent='✓ Bericht gesendet';setTimeout(close,1200);}else{b.textContent='Für später gespeichert';const p=document.createElement('div');p.className='kc-update-phase';p.textContent='Supabase war nicht erreichbar. Der Bericht wurde lokal vorgemerkt und wird bei der nächsten Online-Verbindung erneut gesendet.';b.closest('.kc-update-actions').before(p);}};}
  function toast(text){const x=document.createElement('div');x.className='kc-update-toast';x.textContent=text;document.body.appendChild(x);setTimeout(()=>x.remove(),2800);}
  window.addEventListener('KC_DP_UPDATE_AVAILABLE',e=>showAvailable(e.detail));
  window.addEventListener('KC_DP_UPDATE_PROGRESS',e=>progress(e.detail));
  window.addEventListener('KC_DP_UPDATE_SUCCESS',e=>success(e.detail));
  window.addEventListener('KC_DP_UPDATE_FAILED',e=>failed(e.detail));
  window.addEventListener('KC_DP_UPDATE_CURRENT',e=>toast(`KC DP2 V${e.detail.version} ist aktuell.`));
  window.addEventListener('KC_DP_UPDATE_CHECK_ERROR',e=>toast(`Updateprüfung nicht möglich: ${e.detail.message}`));
  K.updateUi={version:'0.19.37',showAvailable,checkNow:()=>K.updateManager.check({manual:true})};
})();

/* KC DP2 V0.19.55 – konsolidierter Anmelde-/Entsperrpfad */
(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  if(K.__authFlowConsolidated)return;
  K.__authFlowConsolidated=true;
  const flow=K.authFlow={version:'0.19.55-login-consolidation-1',pendingLogin:null,pendingPassword:null,steps:[]};
  const mark=(stage,detail='')=>{flow.steps.push({at:new Date().toISOString(),stage,detail:String(detail||'')});if(flow.steps.length>40)flow.steps.shift();try{K.databaseDiagnostics?.markStartup?.('auth-'+stage,String(detail||''));}catch(_){}};

  if(typeof K.roleUx?.ensureLogin==='function'){
    const baseEnsure=K.roleUx.ensureLogin.bind(K.roleUx);
    K.roleUx.ensureLogin=function(){
      if(K.memberAccess?.state?.status==='authenticated')return Promise.resolve(K.currentUser);
      if(flow.pendingLogin)return flow.pendingLogin;
      mark('login-request');
      flow.pendingLogin=Promise.resolve().then(()=>baseEnsure()).then(v=>{mark('login-complete',K.currentUser?.role||'');return v;}).catch(e=>{mark('login-error',e?.message||e);throw e;}).finally(()=>{flow.pendingLogin=null;});
      return flow.pendingLogin;
    };
  }

  if(typeof K.memberAccess?.signInPassword==='function'){
    const baseSignIn=K.memberAccess.signInPassword.bind(K.memberAccess);
    K.memberAccess.signInPassword=function(args){
      if(flow.pendingPassword)return flow.pendingPassword;
      const started=performance.now();mark('password-start');
      flow.pendingPassword=Promise.resolve().then(()=>baseSignIn(args)).then(v=>{mark('password-complete',`${Math.round(performance.now()-started)} ms`);return v;}).catch(e=>{mark('password-error',e?.message||e);throw e;}).finally(()=>{flow.pendingPassword=null;});
      return flow.pendingPassword;
    };
  }

  function localUnlockDialog(message=''){
    return new Promise(resolve=>{
      const back=document.getElementById('modalBackdrop'),modal=document.getElementById('modal');
      if(!back||!modal){resolve(false);return;}
      modal.classList.remove('wide');
      modal.innerHTML=`<h2>🔐 Lokale Daten entsperren</h2><div class="ai-summary"><b>Die KC-DP-Anmeldung ist bereits bestätigt.</b><br>Dieser Schlüssel gehört ausschließlich zur lokalen Verschlüsselung auf diesem Gerät und ist <b>nicht</b> Ihr Supabase-/KC-DP-Passwort.</div>${message?`<div id="kcUnlockRetryError" class="ai-summary" style="border-color:#ef4444;background:#fff1f2;color:#991b1b">${String(message).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>`:'<div id="kcUnlockRetryError"></div>'}<div class="field"><label>Sicherheitsschlüssel (mind. 16 Zeichen)</label><input id="kcUnlockRetrySecret" type="password" autocomplete="current-password" placeholder="Lokaler Sicherheitsschlüssel"></div><div class="modal-actions"><button class="primary" id="kcUnlockRetryBtn">Lokale Daten entsperren</button></div>`;
      back.classList.remove('hidden');document.body.classList.add('modal-open');
      const input=document.getElementById('kcUnlockRetrySecret'),err=document.getElementById('kcUnlockRetryError'),btn=document.getElementById('kcUnlockRetryBtn');
      const submit=()=>{try{K.storage.setSecret(input.value);back.classList.add('hidden');modal.innerHTML='';document.body.classList.remove('modal-open');mark('local-key-entered');resolve(true);}catch(e){if(err){err.className='ai-summary';err.style.cssText='border-color:#ef4444;background:#fff1f2;color:#991b1b';err.textContent=e.message;}}};
      btn.onclick=submit;input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});setTimeout(()=>input.focus(),40);
    });
  }

  if(typeof K.storage?.getMany==='function'&&!K.storage.__unlockRetryGuard){
    const baseGetMany=K.storage.getMany.bind(K.storage);
    K.storage.getMany=async function(keys,opt){
      for(;;){
        try{return await baseGetMany(keys,opt);}catch(e){
          const text=String(e?.message||e||'');
          if(!/falscher Schlüssel|Paketprüfung fehlgeschlagen|manipulierte Daten/i.test(text))throw e;
          mark('local-key-retry',text);K.storage.lock?.();
          const ok=await localUnlockDialog('Der eingegebene lokale Sicherheitsschlüssel passt nicht zu den gespeicherten Daten. Bitte erneut eingeben.');
          if(!ok)throw e;
        }
      }
    };
    Object.defineProperty(K.storage,'__unlockRetryGuard',{value:true,enumerable:false});
  }
})();

/* KC DP2 V0.19.55 – Tiefenkonsolidierung Login/Logout und erster lokaler Schlüssel */
(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  if(K.__sessionFlowDeepGuard)return;
  K.__sessionFlowDeepGuard=true;
  const flow=K.authFlow=K.authFlow||{steps:[]};
  const mark=(stage,detail='')=>{try{flow.steps=flow.steps||[];flow.steps.push({at:new Date().toISOString(),stage,detail:String(detail||'')});if(flow.steps.length>80)flow.steps.shift();K.loginTrace?.add?.(stage,'info',detail);}catch(_){}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function validateCurrentSecret(){
    const probeKeys=['supabaseSession','peopleSnapshot','workflow','shifts','eventConfig'];
    for(const key of probeKeys){
      let row=null;
      try{row=await K.storage?._rawGet?.(key);}catch(_){row=null;}
      if(!row?.envelope)continue;
      try{
        if(row.envelope.format==='KC_DP_LOCAL_V2'&&typeof K.storage?._decryptFast==='function')await K.storage._decryptFast(row.envelope);
        else if(window.KCSecureSync?.decryptEnvelope)await window.KCSecureSync.decryptEnvelope(row.envelope,{secret:K.storage.secret,projectId:'KC_DP'});
        return true;
      }catch(e){throw new Error('Der lokale Sicherheitsschlüssel passt nicht zu den auf diesem Gerät gespeicherten Daten.');}
    }
    return true;
  }

  function installPrimaryUnlockValidator(){
    const bind=()=>{
      const modal=document.getElementById('modal'),btn=document.getElementById('unlockBtn'),input=document.getElementById('unlockSecret');
      const h2=modal?.querySelector('h2');
      if(!btn||!input||!/Dieses Gerät entsperren/i.test(h2?.textContent||'')||btn.dataset.kcDeepUnlock==='1')return;
      btn.dataset.kcDeepUnlock='1';
      const original=btn.onclick;
      btn.onclick=async ev=>{
        ev?.preventDefault?.();
        if(btn.dataset.kcBusy==='1')return;
        btn.dataset.kcBusy='1';const old=btn.textContent;btn.disabled=true;btn.textContent='Schlüssel wird geprüft …';
        let errorBox=modal.querySelector('#kcPrimaryUnlockError');
        if(!errorBox){errorBox=document.createElement('div');errorBox.id='kcPrimaryUnlockError';errorBox.className='ai-summary';errorBox.style.display='none';input.closest('.field')?.before(errorBox);}
        try{
          K.storage.setSecret(input.value);
          await validateCurrentSecret();
          mark('local-key-valid','Lokaler Schlüssel vor Fortsetzung geprüft');
          if(typeof original==='function')original.call(btn,ev);
        }catch(e){
          K.storage.lock?.();
          errorBox.style.display='block';errorBox.style.borderColor='#ef4444';errorBox.style.background='#fff1f2';errorBox.style.color='#991b1b';errorBox.textContent=esc(e?.message||e);
          input.value='';input.focus();mark('local-key-invalid',e?.message||e);
        }finally{
          btn.dataset.kcBusy='0';if(btn.isConnected){btn.disabled=false;btn.textContent=old;}
        }
      };
    };
    const obs=new MutationObserver(()=>bind());obs.observe(document.body,{subtree:true,childList:true});bind();
  }

  function installCleanSignOut(){
    const ma=K.memberAccess;if(!ma||typeof ma.signOut!=='function'||ma.signOut.__kcDeepLogout)return;
    const original=ma.signOut.bind(ma);
    const wrapped=async function(){
      if(flow.pendingSignOut)return flow.pendingSignOut;
      mark('logout-start','Abmeldung gestartet');
      flow.pendingLogin=null;flow.pendingPassword=null;
      flow.pendingSignOut=(async()=>{
        try{await ma.setRememberHint?.(false);}catch(_){}
        try{if(K.storage?.unlocked)await K.storage.remove?.('supabaseSession');}catch(_){}
        let remote=null;
        try{
          remote=Promise.resolve().then(()=>original());
          await Promise.race([remote,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Logout-Netzwerk-Timeout')),4500))]);
        }catch(e){
          mark('logout-network-fallback',e?.message||e);
          try{await K.supabaseConnection?.clearSession?.();}catch(_){}
          try{K.session?.logout?.('KC-DP Abmeldung lokal abgeschlossen');}catch(_){}
          remote?.catch?.(()=>{});
        }
        try{if(K.storage?.unlocked)await K.storage.remove?.('supabaseSession');}catch(_){}
        try{await ma.setRememberHint?.(false);}catch(_){}
        if(ma.state){ma.state.status='signed_out';ma.state.user=null;ma.state.membership=null;ma.state.firstAccess=false;ma.state.remember=false;}
        mark('logout-complete','Lokale Sitzung und Merker entfernt');
        return true;
      })().finally(()=>{flow.pendingSignOut=null;});
      return flow.pendingSignOut;
    };
    wrapped.__kcDeepLogout=true;ma.signOut=wrapped;
  }

  installPrimaryUnlockValidator();
  installCleanSignOut();
  K.sessionFlowDeepGuard={version:'0.19.55-deep-session-1',validateCurrentSecret,installPrimaryUnlockValidator,installCleanSignOut};
})();

/* KC DP2 V0.19.55 – bestätigte Identität über Entsperren/Laden stabil halten */
(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  if(K.__postLoginIdentityGuard)return;
  K.__postLoginIdentityGuard=true;
  const flow=K.authFlow=K.authFlow||{steps:[]};
  const guard={accepted:false,snapshot:null,acceptedAt:0,logout:false,startupComplete:false};
  const mark=(stage,detail='')=>{try{K.loginTrace?.add?.(stage,'info',detail);flow.steps=flow.steps||[];flow.steps.push({at:new Date().toISOString(),stage,detail:String(detail||'')});if(flow.steps.length>100)flow.steps.shift();}catch(_){}};

  function capture(){
    const u=K.currentUser;
    if(!u?.personId)return false;
    guard.snapshot={personId:u.personId,role:u.role||K.memberAccess?.state?.user?.role||'employee',displayName:u.displayName||K.memberAccess?.state?.user?.displayName||''};
    guard.accepted=true;guard.acceptedAt=Date.now();guard.logout=false;
    mark('identity-captured',`${guard.snapshot.personId} · ${guard.snapshot.role}`);
    return true;
  }

  function restore(reason='startup'){
    if(!guard.accepted||guard.logout||!guard.snapshot?.personId)return false;
    const tokenFn=K.supabaseConnection?.hasAccessToken;
    if(typeof tokenFn==='function'&&!tokenFn.call(K.supabaseConnection))return false;
    const s=guard.snapshot;
    try{K.auth?.setCurrentUser?.({personId:s.personId,role:s.role,displayName:s.displayName});}catch(_){}
    try{
      const ma=K.memberAccess;
      if(ma?.state){ma.state.status='authenticated';ma.state.user={...(ma.state.user||{}),personId:s.personId,role:s.role,displayName:s.displayName};}
    }catch(_){}
    try{K.session?.adoptAuthenticatedUser?.({personId:s.personId,role:s.role,displayName:s.displayName,provider:'supabase'});}catch(_){}
    mark('identity-restored',reason);
    return !!K.currentUser?.personId;
  }

  if(typeof K.memberAccess?.signInPassword==='function'&&!K.memberAccess.signInPassword.__kcIdentityHold){
    const base=K.memberAccess.signInPassword.bind(K.memberAccess);
    const wrapped=async function(args){const out=await base(args);capture();return out;};
    wrapped.__kcIdentityHold=true;K.memberAccess.signInPassword=wrapped;
  }

  if(typeof K.roleUx?.ensureLogin==='function'&&!K.roleUx.ensureLogin.__kcIdentityHold){
    const base=K.roleUx.ensureLogin.bind(K.roleUx);
    const wrapped=function(){
      if(K.memberAccess?.state?.status==='authenticated'&&K.currentUser?.personId)return Promise.resolve(K.currentUser);
      if(restore('ensureLogin-reentry'))return Promise.resolve(K.currentUser);
      return base();
    };
    wrapped.__kcIdentityHold=true;K.roleUx.ensureLogin=wrapped;
  }

  if(typeof K.roleUx?.afterDataLoaded==='function'&&!K.roleUx.afterDataLoaded.__kcIdentityHold){
    const base=K.roleUx.afterDataLoaded.bind(K.roleUx);
    const wrapped=function(){
      if((!K.currentUser?.personId||K.memberAccess?.state?.status!=='authenticated')&&guard.accepted&&!guard.logout)restore('afterDataLoaded');
      guard.startupComplete=true;mark('startup-auth-complete',K.currentUser?.personId||'kein Benutzer');
      return base();
    };
    wrapped.__kcIdentityHold=true;K.roleUx.afterDataLoaded=wrapped;
  }

  if(typeof K.memberAccess?.signOut==='function'&&!K.memberAccess.signOut.__kcIdentityHold){
    const base=K.memberAccess.signOut.bind(K.memberAccess);
    const wrapped=async function(...args){
      guard.logout=true;guard.accepted=false;guard.snapshot=null;guard.acceptedAt=0;mark('identity-cleared','Explizite Abmeldung');
      try{return await base(...args);}finally{try{K.storage?.lock?.();}catch(_){}guard.startupComplete=false;}
    };
    wrapped.__kcIdentityHold=true;K.memberAccess.signOut=wrapped;
  }

  if(K.memberAccess?.state?.status==='authenticated'&&K.currentUser?.personId)capture();
  K.postLoginIdentityGuard={version:'0.19.55-identity-hold-1',state:guard,capture,restore};
})();
