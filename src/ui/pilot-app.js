(function(){
 const K=window.KCDP=window.KCDP||{},P=K.pilotOnboarding;
 const ENDPOINT='https://ptblnpiroqftcvlsrhac.supabase.co/functions/v1/kc-dp-pilot';
 const TARGET_VERSION='0.19.51',PILOT_BUILD='0.19.51-auto4';
 const TOKEN_KEY='kc_dp_pilot_token_v01948',DEVICE_KEY='kc_dp_pilot_device_class_v01951';
 let deferredInstall=null,server=null,verified=false,flowRunning=false,installConfirmed=false,testSent=false,pollTimer=null,versionInventory=null,versionChecked=false,lastError=null,lastStep='start';
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 function token(){const u=new URL(location.href),t=u.searchParams.get('pilot');if(t&&t.length>=32)localStorage.setItem(TOKEN_KEY,t);return t||localStorage.getItem(TOKEN_KEY)||''}
 function deviceClass(){const q=new URL(location.href).searchParams.get('device');if(['pc','handy','tablet'].includes(q)){localStorage.setItem(DEVICE_KEY,q);return q}const v=localStorage.getItem(DEVICE_KEY)||'';return ['pc','handy','tablet'].includes(v)?v:''}
 function chooseDevice(v){if(!['pc','handy','tablet'].includes(v))return;localStorage.setItem(DEVICE_KEY,v);const u=new URL(location.href);u.searchParams.set('device',v);history.replaceState(null,'',u.toString());document.querySelectorAll('[data-pilot-device]').forEach(b=>b.classList.toggle('active',b.dataset.pilotDevice===v))}
 function deviceReport(){return `${deviceClass()||'unknown'}:${P.device()}`}
 function clearError(){const el=$('pilotError');el.classList.add('pilot-hidden');el.innerHTML=''}
 function friendlyError(e){const m=String(e?.message||e||'');if(/Erlauben|nicht genehmigt/i.test(m))return'Benachrichtigungen sind noch nicht erlaubt. Bitte noch einmal versuchen und „Erlauben“ wählen.';if(/Home-Bildschirm/i.test(m))return'KC DP2 muss zuerst vom Home-Bildschirm gestartet werden.';if(/Installationsdialog/i.test(m))return'Die Installation konnte noch nicht gestartet werden. Bitte noch einmal versuchen.';if(/Test-Push|Push konnte nicht|zugestellt/i.test(m))return'Die Testnachricht konnte gerade nicht gesendet oder bestätigt werden.';if(/Verbindung|fetch|HTTP|Netz/i.test(m))return'Die Verbindung zum DP2-Server hat gerade nicht funktioniert.';if(/Testzugang|Pilot-Link/i.test(m))return'Der persönliche Testzugang konnte nicht erkannt werden.';return'DP2 konnte diesen Schritt noch nicht abschließen.'}
 async function reportError(){if(!lastError||!navigator.onLine)return;const btn=$('pilotErrorReportBtn');if(btn)btn.disabled=true;try{await call('report_error',{step:lastStep,errorCode:lastError?.name||'client_error',errorMessage:String(lastError?.message||lastError).slice(0,300),userAgent:navigator.userAgent,online:navigator.onLine,targetVersion:TARGET_VERSION,pilotBuild:PILOT_BUILD});if(btn){btn.textContent='Meldung gesendet ✓';btn.disabled=true}}catch(_){if(btn){btn.textContent='Meldung senden';btn.disabled=false}const s=$('pilotErrorReportState');if(s)s.textContent='Meldung konnte gerade nicht gesendet werden.'}}
 function abortFlow(){clearError();hideNext();$('pilotDeviceChoice').classList.add('pilot-hidden');$('pilotSteps').classList.add('pilot-hidden');setIntro('Vorgang abgebrochen. Du kannst die Seite jetzt schließen.','warn')}
 function retryFlow(){clearError();setIntro('Wir versuchen es noch einmal …','success');if(!verified){boot();return}runAutoFlow(true)}
 function fail(e,step=lastStep){lastError=e;lastStep=step;const el=$('pilotError'),canReport=navigator.onLine;el.innerHTML=`<div><b>Das hat noch nicht geklappt.</b><div style="margin-top:6px">${esc(friendlyError(e))}</div><div class="pilot-actions" style="margin-top:12px;display:grid;gap:8px"><button type="button" id="pilotErrorRetryBtn" class="pilot-btn">Nochmal versuchen</button><button type="button" id="pilotErrorAbortBtn" class="pilot-btn secondary">Abbrechen</button>${canReport?'<button type="button" id="pilotErrorReportBtn" class="pilot-btn secondary">Meldung senden</button>':''}</div><div id="pilotErrorReportState" class="pilot-small" style="margin-top:8px"></div></div>`;el.classList.remove('pilot-hidden');$('pilotErrorRetryBtn').onclick=retryFlow;$('pilotErrorAbortBtn').onclick=abortFlow;if(canReport)$('pilotErrorReportBtn').onclick=reportError;setIntro('Ein Schritt hat nicht funktioniert. Du entscheidest, wie es weitergeht.','warn')}
 function setIntro(text,kind=''){$('pilotIntro').className='pilot-note'+(kind?' '+kind:'');$('pilotIntro').innerHTML=text}
 function standalone(){return P.installed()}
 function pushGranted(){return typeof Notification!=='undefined'&&Notification.permission==='granted'}
 function snapshot(){return P.snapshot()}
 function versionParts(v){return String(v||'').match(/\d+/g)?.slice(0,3).map(Number)||[]}
 function compareVersion(a,b){const aa=versionParts(a),bb=versionParts(b);for(let i=0;i<3;i++){const x=aa[i]||0,y=bb[i]||0;if(x!==y)return x>y?1:-1}return 0}
 function pilotVersionFromCacheKey(k){const m=String(k||'').match(/^kc-dp2-pilot-v(\d)(\d{2})(\d{2})/i);return m?`${Number(m[1])}.${Number(m[2])}.${Number(m[3])}`:''}
 function releaseVersionFromCacheKey(k){const m=String(k||'').match(/^kc-dp-release-(\d+\.\d+\.\d+)/i);return m?m[1]:''}
 async function call(action,payload={}){const t=token();if(!t)throw new Error('Persönlicher Testzugang fehlt.');const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:t,device:deviceReport(),deviceClass:deviceClass(),installed:standalone()||installConfirmed,notification:typeof Notification==='undefined'?'unsupported':Notification.permission,...payload})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`Pilot-Service HTTP ${r.status}`);return data}
 async function requestHandyPushPermissionNow(){
   lastStep='push_freigeben';
   if(deviceClass()!=='handy')return true;
   if(pushGranted())return true;
   if(P.device()==='ios'&&!standalone()){
     await call('heartbeat',{phase:'push_permission_deferred_ios',targetVersion:TARGET_VERSION,pilotBuild:PILOT_BUILD}).catch(()=>{});
     return true
   }
   if(typeof Notification==='undefined')throw new Error('Push-Freigabe ist auf diesem Handy nicht verfügbar.');
   setIntro('Push-Freigabe bestätigen …','success');
   const permission=await Notification.requestPermission();
   await call('heartbeat',{phase:'push_permission_first_screen',pushPermission:permission,targetVersion:TARGET_VERSION,pilotBuild:PILOT_BUILD}).catch(()=>{});
   if(permission!=='granted')throw new Error('Push wurde nicht genehmigt. Bitte „Erlauben“ wählen.');
   return true
 }
 async function detectExistingInstallation(){
   const s=snapshot(),out={targetVersion:TARGET_VERSION,pilotBuild:PILOT_BUILD,found:false,reliable:false,pilotVersion:'',mainVersion:'',hasPilotWorker:false,hasMainWorker:false,hasPushSubscription:false,standalone:standalone(),localInstalled:!!s.installedAt,disposition:'new'};
   if('serviceWorker'in navigator){
     try{
       const regs=await navigator.serviceWorker.getRegistrations();
       const pilotReg=regs.find(r=>{try{return new URL(r.scope).pathname.replace(/\/+$/,'').endsWith('/pilot')}catch(_){return false}})||null;
       const mainReg=regs.find(r=>{try{const p=new URL(r.scope).pathname.replace(/\/+$/,'');return p.endsWith('/Dienstplan')&&!p.endsWith('/pilot')}catch(_){return false}})||null;
       out.hasPilotWorker=!!pilotReg;out.hasMainWorker=!!mainReg;
       if(pilotReg){try{out.hasPushSubscription=!!(await pilotReg.pushManager.getSubscription())}catch(_){}}
     }catch(_){}
   }
   if('caches'in window){
     try{
       const keys=await caches.keys();
       const pilotVersions=keys.map(pilotVersionFromCacheKey).filter(Boolean).sort(compareVersion);
       const releaseVersions=keys.map(releaseVersionFromCacheKey).filter(Boolean).sort(compareVersion);
       out.pilotVersion=pilotVersions.at(-1)||'';out.mainVersion=releaseVersions.at(-1)||'';
       try{
         const c=await caches.open('kc-dp-release-meta-v1'),metaUrl=new URL('../__kc_dp_release_meta__',location.href).toString(),r=await c.match(metaUrl);
         if(r){const m=await r.json();if(m?.activeVersion)out.mainVersion=String(m.activeVersion)}
       }catch(_){}
     }catch(_){}
   }
   out.reliable=out.standalone||out.hasPushSubscription;
   out.found=out.reliable||out.hasPilotWorker||out.localInstalled||!!out.pilotVersion||out.hasMainWorker||!!out.mainVersion;
   const known=out.pilotVersion||'';
   out.disposition=out.reliable?(known&&compareVersion(known,TARGET_VERSION)<0?'update':'reuse'):'new';
   return out
 }
 async function reportVersionCheck(inv){
   P.markVersionChecked?.({targetVersion:TARGET_VERSION,pilotBuild:PILOT_BUILD,found:inv.found,reliable:inv.reliable,pilotVersion:inv.pilotVersion,mainVersion:inv.mainVersion,hasPushSubscription:inv.hasPushSubscription,disposition:inv.disposition});
   await call('heartbeat',{phase:'version_check',targetVersion:TARGET_VERSION,pilotBuild:PILOT_BUILD,existingInstalled:inv.reliable,existingFound:inv.found,pilotVersion:inv.pilotVersion||null,mainVersion:inv.mainVersion||null,hasPilotWorker:inv.hasPilotWorker,hasMainWorker:inv.hasMainWorker,hasPushSubscription:inv.hasPushSubscription,installDisposition:inv.disposition}).catch(()=>{})
 }
 async function ensureVersionCheck(){
   lastStep='versionspruefung';
   if(versionChecked&&versionInventory)return versionInventory;
   versionInventory=await detectExistingInstallation();versionChecked=true;await reportVersionCheck(versionInventory);
   if(versionInventory.reliable){
     installConfirmed=true;
     if(versionInventory.disposition==='update')setIntro(`Vorhandene KC DP2 Version ${esc(versionInventory.pilotVersion||'alt')} erkannt. Aktualisierung läuft automatisch …`,'success');
     else setIntro(`Vorhandene KC DP2 Installation erkannt${versionInventory.pilotVersion?' · V'+esc(versionInventory.pilotVersion):''}. Sie wird weiterverwendet.`,'success');
     try{const reg=await navigator.serviceWorker.register('../pilot-sw.js?v=0.19.51-auto4&kc_update=pilot-auto4',{scope:'./',updateViaCache:'none'});await reg.update().catch(()=>{});await navigator.serviceWorker.ready}catch(_){}
   }else if(versionInventory.mainVersion){setIntro(`KC DP2 V${esc(versionInventory.mainVersion)} wurde auf diesem Gerät gefunden. Der Install-Test prüft die Testumgebung weiter.`,'success')}
   return versionInventory
 }
 function saveSwContext(sw){return new Promise(resolve=>{if(!sw?.postMessage){resolve(false);return}const ch=new MessageChannel(),timer=setTimeout(()=>resolve(false),1200);ch.port1.onmessage=()=>{clearTimeout(timer);resolve(true)};sw.postMessage({type:'KC_DP_PILOT_CONTEXT',token:token(),deviceClass:deviceClass(),device:deviceReport(),targetVersion:TARGET_VERSION,pilotBuild:PILOT_BUILD},[ch.port2])})}
 function b64u(s){const pad='='.repeat((4-s.length%4)%4),raw=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/')),a=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);return a}
 function statusRows(){const s=snapshot(),installed=standalone()||installConfirmed||!!s.installedAt,rows=[['Gerät gewählt',!!deviceClass()],['Push genehmigt',pushGranted()||!!s.pushEnabledAt],['Version geprüft',versionChecked],['KC DP2 installiert',installed],['Test-Push bestätigt',!!s.testReceivedAt]];$('pilotSteps').classList.toggle('pilot-hidden',!deviceClass());$('pilotSteps').innerHTML=rows.map(([label,ok],i)=>`<div class="pilot-step ${ok?'ok':(!rows.slice(0,i).some(x=>!x[1])?'current':'')}"><span class="pilot-dot">${ok?'✓':i+1}</span><span>${esc(label)}</span></div>`).join('')}
 function hideNext(){$('pilotNext').classList.add('pilot-hidden')}
 function systemStep(title,text,handler,label='Weiter'){$('pilotNextTitle').textContent=title;$('pilotDeviceHelp').innerHTML=text;$('pilotNext').classList.remove('pilot-hidden');$('pilotContinueBtn').classList.remove('pilot-hidden');$('pilotContinueBtn').textContent=label;$('pilotContinueBtn').onclick=handler}
 async function recordInstalled(){lastStep='installation_pruefen';if(!(standalone()||installConfirmed))return false;const s=snapshot();if(!s.installedAt)P.markInstalled?.({version:TARGET_VERSION,pilotBuild:PILOT_BUILD});await call('installed',{installedVersion:TARGET_VERSION,pilotBuild:PILOT_BUILD,installDisposition:versionInventory?.disposition||'new',previousVersion:versionInventory?.pilotVersion||null}).catch(()=>{});statusRows();return true}
 async function ensurePush(userGesture=false){
   lastStep='push_anmelden';
   if(!('serviceWorker'in navigator)||!('PushManager'in window)||typeof Notification==='undefined')throw new Error('Web-Push wird von diesem Gerät nicht unterstützt.');
   if(Notification.permission!=='granted'){
     if(!userGesture){systemStep('Push genehmigen','',async()=>{clearError();hideNext();await ensurePush(true);await runAutoFlow(false)},'Push genehmigen');return false}
     const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Push wurde nicht genehmigt. Bitte „Erlauben“ wählen.');
   }
   if(!server?.vapidPublicKey)server=await call('bootstrap');
   const reg=await navigator.serviceWorker.register('../pilot-sw.js?v=0.19.51-auto4&kc_update=pilot-auto4',{scope:'./',updateViaCache:'none'});await navigator.serviceWorker.ready;
   let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(server.vapidPublicKey)});
   const sw=reg.active||navigator.serviceWorker.controller;await saveSwContext(sw);
   await call('subscribe',{subscription:sub.toJSON?sub.toJSON():sub,userAgent:navigator.userAgent,targetVersion:TARGET_VERSION,pilotBuild:PILOT_BUILD});P.markPushEnabled();statusRows();return true
 }
 async function pollServer(){lastStep='push_pruefen';clearInterval(pollTimer);let tries=0;pollTimer=setInterval(async()=>{tries++;try{const x=await call('bootstrap');server=x;if(['test_received','completed'].includes(String(x.status||''))){P.markTestReceived();clearInterval(pollTimer);pollTimer=null;finishUi();return}}catch(_){}if(tries>=20){clearInterval(pollTimer);pollTimer=null}},1500)}
 async function sendTest(){lastStep='test_push_senden';if(snapshot().testReceivedAt){finishUi();return true}if(testSent)return true;testSent=true;const out=await call('send_test');if(!(out.sent>0)){testSent=false;throw new Error('Test-Push konnte nicht zugestellt werden.')}setIntro('Installation abgeschlossen. Push-Empfang wird automatisch geprüft …','success');await pollServer();return true}
 function finishUi(){hideNext();clearError();$('pilotDeviceChoice').classList.add('pilot-hidden');$('pilotSteps').classList.add('pilot-hidden');$('pilotComplete').classList.remove('pilot-hidden');$('pilotCompleteMeta').textContent=`${deviceClass()==='pc'?'PC':deviceClass()==='tablet'?'Tablet':'Handy'} · KC DP2 V${TARGET_VERSION} · automatisch geprüft`;setIntro('✅ Test vollständig bestanden.','success')}
 async function requestInstallFromGesture(userGesture=false){
   lastStep='installation';
   const inv=await ensureVersionCheck();
   if(inv.reliable){installConfirmed=true;return recordInstalled()}
   if(standalone()){installConfirmed=true;return recordInstalled()}
   if(P.device()==='ios'){
     systemStep('KC DP2 installieren','Safari: Teilen → Zum Home-Bildschirm → Hinzufügen. Danach KC DP2 öffnen.',()=>{});$('pilotContinueBtn').classList.add('pilot-hidden');return false
   }
   if(!deferredInstall){systemStep('KC DP2 installieren','Im Browser einmal „App installieren“ bestätigen.',async()=>{clearError();if(!deferredInstall){fail(new Error('Installationsdialog ist noch nicht verfügbar. Browser-Menü → App installieren.'),'installation');return}$('pilotContinueBtn').disabled=true;try{await runAutoFlow(true)}finally{$('pilotContinueBtn').disabled=false}});return false}
   if(!userGesture){systemStep('KC DP2 installieren','Installationsdialog öffnen und einmal bestätigen.',async()=>{clearError();hideNext();await runAutoFlow(true)});return false}
   hideNext();const prompt=deferredInstall;deferredInstall=null;await prompt.prompt();const choice=await prompt.userChoice;if(choice?.outcome!=='accepted')throw new Error('Installation wurde nicht bestätigt.');setIntro('Installation wird abgeschlossen …','success');return true
 }
 async function runAutoFlow(userGesture=false){
   if(flowRunning||!verified||!deviceClass())return;flowRunning=true;clearError();statusRows();
   try{
     if(snapshot().testReceivedAt){finishUi();return}
     const inv=await ensureVersionCheck();statusRows();
     if(inv.reliable){installConfirmed=true;await recordInstalled()}
     else if(!(standalone()||installConfirmed)){
       if(P.device()==='ios'){await requestInstallFromGesture(userGesture);return}
       const started=await requestInstallFromGesture(userGesture);if(!started)return;
       await new Promise(r=>setTimeout(r,700));
       if(!(installConfirmed||standalone())){setIntro('Installation läuft. Der Test setzt sich automatisch fort …','success');return}
     }
     await recordInstalled();
     const pushOk=await ensurePush(userGesture);if(!pushOk)return;
     await sendTest();
   }catch(e){fail(e,lastStep)}finally{flowRunning=false;statusRows()}
 }
 async function boot(){
   lastStep='start';
   try{server=await call('bootstrap');verified=true;setIntro(`Hallo <b>${esc(server.firstName||'')}</b>. Gerät auswählen – danach läuft alles automatisch.`,'success');const dc=deviceClass();if(dc){chooseDevice(dc);$('pilotDeviceChoice').classList.add('pilot-hidden');if(dc==='handy'&&P.device()==='ios'&&standalone()&&!pushGranted()){systemStep('Push genehmigen','',async()=>{clearError();hideNext();await requestHandyPushPermissionNow();runAutoFlow(true)},'Push genehmigen');return}await ensureVersionCheck();if(standalone())installConfirmed=true;statusRows();runAutoFlow(false)}else statusRows();await call('heartbeat',{phase:'boot',targetVersion:TARGET_VERSION,pilotBuild:PILOT_BUILD}).catch(()=>{})}catch(e){fail(e,'start')}
 }
 document.querySelectorAll('[data-pilot-device]').forEach(b=>b.onclick=async()=>{if(!verified)return;clearError();chooseDevice(b.dataset.pilotDevice);try{if(b.dataset.pilotDevice==='handy')await requestHandyPushPermissionNow();$('pilotDeviceChoice').classList.add('pilot-hidden');setIntro('Vorhandene Version wird geprüft …','success');statusRows();await ensureVersionCheck();await call('heartbeat',{phase:'device_selected',selectedDeviceClass:deviceClass(),targetVersion:TARGET_VERSION,pilotBuild:PILOT_BUILD}).catch(()=>{});runAutoFlow(true)}catch(e){fail(e,lastStep)}});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;if(deviceClass()&&verified&&!standalone()&&!versionInventory?.reliable)systemStep('KC DP2 installieren','Installationsdialog öffnen und einmal bestätigen.',async()=>{clearError();hideNext();await runAutoFlow(true)})});
 window.addEventListener('appinstalled',async()=>{installConfirmed=true;deferredInstall=null;versionChecked=false;await ensureVersionCheck();await recordInstalled();setIntro('Installiert. Push wird automatisch eingerichtet …','success');runAutoFlow(false)});
 navigator.serviceWorker?.addEventListener?.('message',e=>{if(e.data?.type==='KC_DP_PILOT_PUSH_RECEIVED'&&e.data?.data?.type==='test'){P.markTestReceived();finishUi()}if(e.data?.type==='KC_DP_NOTIFICATION_OPEN'&&e.data?.data?.pilot&&e.data.data.type==='test'){P.markTestReceived();finishUi()}});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&deviceClass()&&verified){versionChecked=false;if(standalone())installConfirmed=true;runAutoFlow(false)}});
 boot();
})();
