(function(){
  const K=window.KCDP=window.KCDP||{};
  let installed=false,launcherVisible=false,selectedArea=null,lastBodyMode='',roleObserver=null,bodyObserver=null;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roleRoot=()=>document.getElementById('kcdpUxRoot');
  const bodyMode=()=>document.body.classList.contains('ux-login')?'login':document.body.classList.contains('ux-legacy')?'legacy':document.body.classList.contains('ux-role')?'role':'other';
  const replacementRoute=()=>{const q=new URLSearchParams(location.search);return q.get('route')==='replacement'&&!!q.get('request');};
  const canEdit=()=>!!(K.auth?.has?.('roster.plan.edit')||K.auth?.has?.('*'));

  function setUxMode(mode){
    document.body.classList.remove('ux-login','ux-role','ux-legacy');
    document.body.classList.add(mode==='legacy'?'ux-legacy':mode==='login'?'ux-login':'ux-role');
  }
  function clearPlanMode(){
    K.state&&(K.state.readOnlyMode=false);
    document.body.classList.remove('kc-readonly-mode');
    $('kcPlanModeBadge')?.remove();
  }
  function planModeBadge(mode){
    let b=$('kcPlanModeBadge');
    if(!b){b=document.createElement('div');b.id='kcPlanModeBadge';b.className='kc-plan-mode-badge';document.body.appendChild(b);}
    b.className=`kc-plan-mode-badge ${mode}`;
    b.textContent=mode==='view'?'👁 Nur ansehen':'✏ Bearbeiten';
  }
  function legacyReturn(){
    let b=$('uxLegacyReturn');
    if(!b){b=document.createElement('button');b.id='uxLegacyReturn';b.className='ux-legacy-return';document.body.appendChild(b);}
    b.style.display='block';b.textContent='← Startauswahl';b.onclick=showLauncher;return b;
  }
  function hideLegacyReturn(){const b=$('uxLegacyReturn');if(b)b.style.display='none';}

  function wishDeadlineChip(){
    const phase=K.wishPhaseGuard?.state?.()||{};
    const deadline=phase.deadline||K.state?.wishDeadline||null;
    if(!deadline)return '<span class="kc-wish-deadline-chip green" role="status" aria-label="Wunschphase offen, keine Frist hinterlegt"><i aria-hidden="true"></i>Offen · keine Frist</span>';
    let d;
    try{d=new Date(`${deadline}T23:59:59`);}catch(_){d=null;}
    const fmt=()=>{try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit'}).format(new Date(`${deadline}T12:00:00`));}catch(_){return String(deadline)}};
    if(phase.phase==='closed'||phase.published)return `<span class="kc-wish-deadline-chip red" role="status" aria-label="Wunschphase geschlossen"><i aria-hidden="true"></i>Geschlossen</span>`;
    const days=d&&!Number.isNaN(d.getTime())?Math.ceil((d.getTime()-Date.now())/86400000):99;
    const tone=days<=0?'red':days<=6?'orange':days<=14?'yellow':'green';
    const label=days<=0?`Frist ${fmt()}`:`bis ${fmt()}`;
    return `<span class="kc-wish-deadline-chip ${tone}" role="status" aria-label="Wunschphase ${label}"><i aria-hidden="true"></i>${label}</span>`;
  }

  function launcherHtml(){
    const user=K.currentUser||{},role=K.auth?.roleDef?.(user.role),edit=canEdit();
    return `<div class="kc-start-choice-shell"><section class="kc-start-choice-card" aria-labelledby="kcStartChoiceTitle">
      <div class="kc-start-choice-brand"><img src="assets/kc-logo.svg" alt="Köcheclub Werne"><div><strong>Köcheclub Werne</strong><small>KC DP2 · Dienstplanung</small></div></div>
      <div class="kc-start-choice-head"><h1 id="kcStartChoiceTitle">Was möchten Sie tun?</h1><p>Wählen Sie den passenden Bereich. Im Modus <b>„Dienstplan ansehen“</b> kann nichts versehentlich verändert werden.</p></div>
      <div class="kc-start-choice-grid">
        <button type="button" class="kc-start-choice-option primary" id="kcChoiceView"><span class="kc-start-choice-icon">👁</span><span class="kc-start-choice-copy"><b>Dienstplan ansehen</b><span>Gesamten Dienstplan sicher lesen und durch die Tage blättern. Keine Änderungen möglich.</span></span></button>
        ${edit?'<button type="button" class="kc-start-choice-option" id="kcChoiceEdit"><span class="kc-start-choice-icon">✏️</span><span class="kc-start-choice-copy"><b>Dienstplan bearbeiten</b><span>Dienste einplanen, verschieben und den Sollplan bearbeiten. Nur für berechtigte Planer.</span></span></button>':''}
        <button type="button" class="kc-start-choice-option" id="kcChoiceMine"><span class="kc-start-choice-icon">👤</span><span class="kc-start-choice-copy"><b>Meine Dienste</b><span>Nur die eigenen Einsatzzeiten und den persönlichen Plan übersichtlich anzeigen.</span></span></button>
        <button type="button" class="kc-start-choice-option" id="kcChoiceWish"><span class="kc-start-choice-icon">📝</span><span class="kc-start-choice-copy"><span class="kc-start-choice-titleline"><b>Wunschplan</b>${wishDeadlineChip()}</span><span>Eigene Wunschzeiten ansehen und – solange freigegeben – eintragen oder ändern.</span></span></button>
      </div>
      <div class="kc-start-choice-footer"><span>Angemeldet als <b>${esc(user.displayName||'Benutzer')}</b>${role?.label?` · ${esc(role.label)}`:''}</span><button type="button" class="kc-start-choice-logout" id="kcChoiceLogout">Abmelden</button></div>
    </section></div>`;
  }

  function showLauncher(){
    if(!K.currentUser?.personId||replacementRoute())return;
    launcherVisible=true;selectedArea='launcher';clearPlanMode();hideLegacyReturn();
    document.body.classList.remove('kc-phone-day-active','kc-phone-list-mode');setUxMode('role');
    const root=roleRoot();if(!root)return;root.innerHTML=launcherHtml();
    $('kcChoiceView').onclick=()=>openLegacy('view');
    if($('kcChoiceEdit'))$('kcChoiceEdit').onclick=()=>openLegacy('edit');
    $('kcChoiceMine').onclick=()=>openPersonal('plan');
    $('kcChoiceWish').onclick=()=>openPersonal('wish');
    $('kcChoiceLogout').onclick=async()=>{try{await K.memberAccess?.signOut?.();location.reload();}catch(e){alert('Abmelden nicht möglich: '+e.message);}};
    ensureChoiceReturn();
  }

  function syncLegacyView(){
    const dayBtn=document.querySelector('#viewTabs button[data-view="day"]'),plannedBtn=document.querySelector('#layerTabs button[data-layer="planned"]');
    if(dayBtn&&!dayBtn.classList.contains('active'))dayBtn.click();
    if(plannedBtn&&!plannedBtn.classList.contains('active'))plannedBtn.click();
    K.roleUx?.refreshLegacy?.();
  }
  function refreshPhoneDay(){
    if(!K.deviceUX?.isPhone?.())return;
    Promise.resolve(K.deviceUX?.loadPhoneDayAssets?.()).catch(()=>false).finally(()=>{
      K.phoneDayUx?.start?.();
      K.phoneDayUx?.refresh?.();
    });
  }
  function openLegacy(mode){
    if(mode==='edit'&&!canEdit()){showLauncher();return;}
    launcherVisible=false;selectedArea=mode;K.state&&(K.state.readOnlyMode=mode==='view');
    document.body.classList.toggle('kc-readonly-mode',mode==='view');setUxMode('legacy');legacyReturn();planModeBadge(mode);
    if(K.state){K.state.view='day';K.state.layer='planned';K.state.mobileMode=false;}
    syncLegacyView();refreshPhoneDay();
    setTimeout(()=>{syncLegacyView();refreshPhoneDay();},40);
  }

  function openPersonal(kind){
    launcherVisible=false;selectedArea=kind;clearPlanMode();hideLegacyReturn();setUxMode('role');
    if(typeof K.roleUx?.employeeHome!=='function'){K.roleUx?.showRoleHome?.();return;}
    K.roleUx.employeeHome();
    const id=kind==='wish'?'uxStartTimes':'uxMyPlan',btn=$(id);
    if(btn)btn.click();else K.roleUx?.showRoleHome?.();
    ensureChoiceReturn();
  }

  function ensureChoiceReturn(){
    const existing=$('kcStartChoiceReturn');
    if(launcherVisible||bodyMode()!=='role'){existing?.remove();return;}
    if(existing)return;
    const b=document.createElement('button');b.id='kcStartChoiceReturn';b.className='kc-start-choice-return';b.textContent='← Auswahl';b.onclick=showLauncher;document.body.appendChild(b);
  }

  function isReadonly(){return !!K.state?.readOnlyMode&&document.body.classList.contains('ux-legacy');}
  const blockedClickSelector='#settingsBtn,#aiPlanBtn,#photoBtn,#actualImportBtn,#pauseToggleBtn,#moreBtn,#addShiftBtn,#quickPlanBtn,#publishBtn,#undoBtn,#redoBtn,#addStandbyInline,#addWishInline,[data-inspector-add],.inspector-gap-btn';
  const blockedPointerSelector='.shift,.wish-bar,.standby-bar,.timeline-cell';
  const blockedContextSelector='.shift,.wish-bar,.standby-bar,.timeline-cell,.person-cell';
  function guardPointer(e){if(!isReadonly())return;if(e.target.closest(blockedPointerSelector))e.stopImmediatePropagation();}
  function guardDbl(e){if(!isReadonly())return;if(e.target.closest('.shift,.wish-bar,.standby-bar')){e.preventDefault();e.stopImmediatePropagation();}}
  function guardContext(e){if(!isReadonly())return;if(e.target.closest(blockedContextSelector)){e.preventDefault();e.stopImmediatePropagation();}}
  function guardClick(e){if(!isReadonly())return;if(e.target.closest(blockedClickSelector)){e.preventDefault();e.stopImmediatePropagation();}}
  function guardKeys(e){
    if(!isReadonly())return;
    const selected=!!K.state?.selectedShiftId,undo=(e.ctrlKey||e.metaKey)&&['z','y'].includes(String(e.key).toLowerCase()),shiftKey=selected&&['ArrowLeft','ArrowRight','Delete','Backspace'].includes(e.key);
    if(undo||shiftKey){e.preventDefault();e.stopImmediatePropagation();}
  }

  function installGuards(){
    document.addEventListener('pointerdown',guardPointer,true);
    document.addEventListener('dblclick',guardDbl,true);
    document.addEventListener('contextmenu',guardContext,true);
    document.addEventListener('click',guardClick,true);
    document.addEventListener('keydown',guardKeys,true);
  }

  function installRoleHook(){
    if(installed||!K.roleUx?.afterDataLoaded)return false;
    installed=true;
    const base=K.roleUx.afterDataLoaded;
    K.roleUx.afterDataLoaded=function(...args){
      const deepLink=replacementRoute(),out=base.apply(this,args);
      if(!deepLink)setTimeout(showLauncher,0);
      return out;
    };
    K.startChoice={version:'0.19.55-wish-deadline-chip-1',show:showLauncher,openView:()=>openLegacy('view'),openEdit:()=>openLegacy('edit'),openMine:()=>openPersonal('plan'),openWish:()=>openPersonal('wish'),isReadonly};
    const root=roleRoot();
    if(root){roleObserver=new MutationObserver(()=>ensureChoiceReturn());roleObserver.observe(root,{childList:true,subtree:false});}
    lastBodyMode=bodyMode();
    bodyObserver=new MutationObserver(()=>{
      const next=bodyMode();
      if(lastBodyMode==='login'&&next==='role'&&!replacementRoute())setTimeout(showLauncher,0);
      lastBodyMode=next;ensureChoiceReturn();
    });
    bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('kc-dp-wish-phase-changed',()=>{if(launcherVisible)showLauncher();});
    if(document.readyState!=='loading'&&bodyMode()==='role'&&K.currentUser?.personId&&!replacementRoute())setTimeout(showLauncher,0);
    return true;
  }

  installGuards();
  let tries=0;const timer=setInterval(()=>{tries++;if(installRoleHook()||tries>500)clearInterval(timer);},10);
})();