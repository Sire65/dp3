(function(){
 const K=window.KCDP=window.KCDP||{};
 let session=null;
 const state={status:'offline',authStatus:'signed_out',userId:null,lastError:null,lastHealthAt:null,lastPushAt:null,lastPullAt:null,lastAuthAt:null};
 const RAW_TIMEOUT_MS=12000;
 function cfg(){return K.integrationConfig?.supabase||{};}
 function normalizeUrl(v){return String(v||'').trim().replace(/\/$/,'');}
 function decodeJwt(key){try{const p=String(key).split('.')[1];if(!p)return null;const pad='='.repeat((4-p.length%4)%4),s=atob((p+pad).replace(/-/g,'+').replace(/_/g,'/'));return JSON.parse(s);}catch(_){return null;}}
 function decodeJwtRole(key){return decodeJwt(key)?.role||null;}
 function validateConfig(c=cfg()){
   const url=normalizeUrl(c.url),key=String(c.publishableKey||'').trim();
   if(!url||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))throw new Error('Gültige Supabase Project URL fehlt.');
   if(!key)throw new Error('Supabase Publishable Key fehlt.');
   if(/^sb_secret_/i.test(key)||decodeJwtRole(key)==='service_role')throw new Error('Secret-/service_role-Schlüssel dürfen niemals im KC-DP-Browser verwendet werden.');
   if(!(/^sb_publishable_/i.test(key)||key.split('.').length===3))throw new Error('Bitte Publishable Key (oder Legacy anon während Migration) verwenden.');
   if(!c.orgId||!c.projectId)throw new Error('Organisation/Projekt fehlen.');
   return {...c,url,publishableKey:key,authMode:c.authMode||'anonymous'};
 }
 function sessionValid(){return !!(session?.access_token&&Number(session.expires_at||0)>Math.floor(Date.now()/1000)+45);}
 async function saveSession(){try{if(K.storage?.unlocked)await K.storage.put('supabaseSession',session||null);}catch(e){state.lastError='Session konnte nicht verschlüsselt gespeichert werden: '+e.message;}}
 function applySession(s){session=s&&s.access_token?{access_token:String(s.access_token),refresh_token:String(s.refresh_token||''),expires_at:Number(s.expires_at||Math.floor(Date.now()/1000)+Number(s.expires_in||3600)),token_type:s.token_type||'bearer',user:s.user||null}:null;state.userId=session?.user?.id||decodeJwt(session?.access_token)?.sub||null;state.authStatus=session?'authenticated':'signed_out';state.lastAuthAt=session?new Date().toISOString():state.lastAuthAt;return !!session;}
 function publicHeaders(extra={}){const c=validateConfig();return {apikey:c.publishableKey,'Content-Type':'application/json','Accept':'application/json',...extra};}
 function dataHeaders(extra={}){if(!session?.access_token)throw new Error('Supabase Auth-Sitzung fehlt.');return {...publicHeaders(extra),Authorization:'Bearer '+session.access_token};}
 async function transportDiagnosis(url){
   const d={at:new Date().toISOString(),online:typeof navigator==='undefined'?null:navigator.onLine,protocol:typeof location==='undefined'?'unknown':location.protocol,origin:typeof location==='undefined'?'unknown':location.origin,secureContext:typeof isSecureContext==='undefined'?null:!!isSecureContext,projectNoCors:false,projectCors:false,detail:''};
   try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),RAW_TIMEOUT_MS);try{const r=await fetch(url+'/auth/v1/settings?kc_dp_transport='+Date.now(),{method:'GET',mode:'no-cors',cache:'no-store',signal:controller.signal});d.projectNoCors=!!r;}finally{clearTimeout(timer);}}
   catch(e){d.noCorsError=e.message||String(e);}
   if(d.projectNoCors){d.detail='Supabase-Domain ist grundsätzlich erreichbar, aber der normale CORS/API-Aufruf wird vom Browser blockiert. KC DP über den lokalen Webserver (http://127.0.0.1) starten.';}
   else if(d.online===false){d.detail='Das Gerät meldet keine Internetverbindung.';}
   else{d.detail='Auch ein headerloser Netzwerk-Test erreicht die Supabase-Domain nicht. Project URL, DNS, Firewall/Virenscanner oder Supabase-Projektstatus prüfen.';}
   state.transport=d;return d;
 }
 async function raw(path,opt={},authenticated=false){
   const c=validateConfig(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),RAW_TIMEOUT_MS);let r;
   try{
     r=await fetch(c.url+path,{...opt,mode:opt.mode||'cors',cache:opt.cache||'no-store',signal:opt.signal||controller.signal,headers:authenticated?dataHeaders(opt.headers||{}):publicHeaders(opt.headers||{})});
     state.transport={...(state.transport||{}),at:new Date().toISOString(),projectCors:true,protocol:typeof location==='undefined'?'unknown':location.protocol,origin:typeof location==='undefined'?'unknown':location.origin,secureContext:typeof isSecureContext==='undefined'?null:!!isSecureContext};
   }catch(e){
     const timedOut=e?.name==='AbortError';
     const d=timedOut?{at:new Date().toISOString(),online:typeof navigator==='undefined'?null:navigator.onLine,projectNoCors:false,projectCors:false,detail:'Zeitüberschreitung – keine Antwort vom Server.'}:await transportDiagnosis(c.url);
     state.transport=d;
     const hint=timedOut?' Zeitüberschreitung – keine Antwort vom Server.':(d.projectNoCors?' Die Browser-Verbindung wird blockiert. Bitte KC DP2 über den lokalen Server starten.':` ${d.detail}`);
     const x=new Error(`KC Sync ist nicht erreichbar.${hint}`);x.cause=e;x.transport=d;throw x;
   }finally{clearTimeout(timer);}
   let data=null;const text=await r.text();try{data=text?JSON.parse(text):null;}catch(_){data=text;}if(!r.ok){const m=typeof data==='string'?data:(data?.msg||data?.message||data?.error_description||data?.hint||'Request fehlgeschlagen'),code=String(data?.code||data?.error_code||r.headers.get('sb-error-code')||''),source=`${code} ${m}`;let friendly=m;if(/invalid login credentials|invalid_credentials|email or password/i.test(source)){friendly='E-Mail-Adresse oder Passwort ist falsch.';}else if(/email not confirmed|email_not_confirmed/i.test(source)){friendly='Die E-Mail-Adresse wurde noch nicht bestätigt.';}else if(/otp.*expired|token.*expired|expired.*token/i.test(source)){friendly='Der Sicherheitscode oder Link ist abgelaufen. Bitte einen neuen anfordern.';}else if(/rate limit|too many requests|over_email_send_rate_limit/i.test(source)){friendly='Zu viele Versuche. Bitte kurz warten und danach erneut versuchen.';}else if(/weak password|password.*least/i.test(source)){friendly='Das Passwort erfüllt die Sicherheitsanforderungen noch nicht.';}else if(/INVALID_API_KEY|wrong key|no suitable key/i.test(source)){friendly='Die KC-Sync-Konfiguration passt nicht zur hinterlegten Projektadresse.';}else if(/permission denied|42501/i.test(source)){friendly='Ihre Rolle hat für diesen Bereich keine Berechtigung.';}else if(r.status===401){friendly='Die Anmeldung ist abgelaufen oder ungültig. Bitte erneut anmelden.';}else if(r.status===403){friendly='Ihre Rolle ist für diese Funktion nicht berechtigt.';}if(/anonymous.*disabled|anonymous sign.?ins.*disabled|signup.*disabled/i.test(String(m)))friendly='Diese Anmeldeart ist deaktiviert. Bitte E-Mail-Adresse und Passwort verwenden.';if(/captcha/i.test(String(m)))friendly='Die Sicherheitsprüfung konnte nicht bestätigt werden. Bitte erneut versuchen.';const e=new Error(friendly);e.status=r.status;e.data=data;e.code=code;throw e;}return {data,response:r};}
 async function signInAnonymously({captchaToken=null}={}){
   validateConfig();state.status='authenticating';state.authStatus='authenticating';
   try{
     const body={data:{app:'KC_DP',org_id:cfg().orgId,project_id:cfg().projectId},gotrue_meta_security:{captcha_token:captchaToken||null}};
     const {data}=await raw('/auth/v1/signup',{method:'POST',body:JSON.stringify(body)},false);
     if(!data?.access_token)throw new Error('Supabase hat keine Auth-Sitzung geliefert. Prüfen Sie, ob anonyme Anmeldung im Projekt aktiviert ist.');
     applySession(data);await saveSession();state.status='authenticated';state.lastError=null;return {ok:true,userId:state.userId,expiresAt:session.expires_at};
   }catch(e){applySession(null);state.status='error';state.authStatus='error';state.lastError=e.message;throw e;}
 }
 async function signInWithPassword({email='',phone='',password=''}){
   validateConfig();state.status='authenticating';state.authStatus='authenticating';
   const body=phone?{phone:String(phone).trim(),password:String(password)}:{email:String(email).trim(),password:String(password)};
   try{const {data}=await raw('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify(body)},false);if(!data?.access_token)throw new Error('Supabase hat keine Auth-Sitzung geliefert.');applySession(data);await saveSession();state.status='authenticated';state.authStatus='authenticated';state.lastError=null;return {ok:true,userId:state.userId};}catch(e){applySession(null);state.status='error';state.authStatus='error';state.lastError=e.message;throw e;}
 }
 async function sendOtp({email='',phone='',channel='sms',shouldCreateUser=false}={}){
   validateConfig();const body=email?{email:String(email).trim(),create_user:!!shouldCreateUser}:{phone:String(phone).trim(),channel:channel==='whatsapp'?'whatsapp':'sms',create_user:!!shouldCreateUser};
   await raw('/auth/v1/otp',{method:'POST',body:JSON.stringify(body)},false);return {ok:true,channel:email?'email':body.channel};
 }
 async function verifyOtp({email='',phone='',token='',type='email'}={}){
   validateConfig();const body=email?{email:String(email).trim(),token:String(token).trim(),type:'email'}:{phone:String(phone).trim(),token:String(token).trim(),type:type==='whatsapp'?'sms':type};
   const {data}=await raw('/auth/v1/verify',{method:'POST',body:JSON.stringify(body)},false);if(!data?.access_token)throw new Error('Sicherheitscode konnte nicht bestätigt werden.');applySession(data);await saveSession();state.status='authenticated';state.authStatus='authenticated';return {ok:true,userId:state.userId};
 }
 async function requestPasswordReset(email,redirectTo=''){
   validateConfig();const body={email:String(email).trim()};if(redirectTo)body.redirect_to=redirectTo;await raw('/auth/v1/recover',{method:'POST',body:JSON.stringify(body)},false);return {ok:true};
 }
 async function updatePassword(password){await ensureSession();try{const {data}=await api('/auth/v1/user',{method:'PUT',body:JSON.stringify({password:String(password)})});return {ok:true,user:data};}catch(e){if(e?.code==='same_password'||/new password should be different/i.test(e?.message||''))throw new Error('Das neue Passwort muss sich vom bisherigen Passwort unterscheiden.');throw e;}}
 async function currentMembership(){await ensureSession();const c=validateConfig(),uid=state.userId;if(!uid)throw new Error('Supabase Benutzer-ID fehlt.');const {data}=await api(`/rest/v1/kc_dp_memberships?select=org_id,user_id,role,active,person_id,display_name,email,phone&org_id=eq.${encodeURIComponent(c.orgId)}&user_id=eq.${encodeURIComponent(uid)}&active=is.true&limit=1`,{method:'GET'});const row=Array.isArray(data)?data[0]:null;if(!row)throw new Error('Keine aktive KC-DP-Mitgliedschaft gefunden.');return row;}
 async function signOut(){try{if(session?.access_token)await raw('/auth/v1/logout',{method:'POST'},true);}finally{await clearSession();state.status='signed_out';state.authStatus='signed_out';}return true;}
 async function provisionMemberAccess({personId,displayName,email='',phone='',role='employee'}={}){
   await ensureSession();const c=validateConfig();const {data}=await api('/functions/v1/kc-dp-user-admin',{method:'POST',body:JSON.stringify({action:'provision',orgId:c.orgId,personId,displayName,email,phone,role})});
   if(!data?.ok)throw new Error(data?.detail||data?.error||'Benutzerzugang konnte nicht eingerichtet werden.');return data;
 }
 async function deactivateMemberAccess(personId){
   await ensureSession();const c=validateConfig();const {data}=await api('/functions/v1/kc-dp-user-admin',{method:'POST',body:JSON.stringify({action:'deactivate',orgId:c.orgId,personId})});
   if(!data?.ok)throw new Error(data?.detail||data?.error||'Benutzerzugang konnte nicht deaktiviert werden.');return data;
 }
 async function provisionTestMember({personId,displayName,email,temporaryPassword}={}){
   await ensureSession();const c=validateConfig();const {data}=await api('/functions/v1/kc-dp-user-admin',{method:'POST',body:JSON.stringify({action:'provision_test',orgId:c.orgId,personId,displayName,email,temporaryPassword})});
   if(!data?.ok)throw new Error(data?.detail||data?.error||'Testzugang konnte nicht eingerichtet werden.');return data;
 }
 async function removeTestMember(personId){
   await ensureSession();const c=validateConfig();const {data}=await api('/functions/v1/kc-dp-user-admin',{method:'POST',body:JSON.stringify({action:'remove_test',orgId:c.orgId,personId})});
   if(!data?.ok)throw new Error(data?.detail||data?.error||'Testzugang konnte nicht entfernt werden.');return data;
 }
 async function sendClientReport(report){
   await ensureSession();const c=validateConfig();const payload={orgId:c.orgId,projectId:c.projectId,report};const {data}=await api('/functions/v1/kc-dp-client-report',{method:'POST',body:JSON.stringify(payload)});if(!data?.ok)throw new Error(data?.detail||data?.error||'Fehlerbericht konnte nicht gesendet werden.');return data;
 }
 async function refreshSession(){
   if(!session?.refresh_token)throw new Error('Kein Supabase Refresh-Token vorhanden.');state.authStatus='refreshing';
   try{const {data}=await raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})},false);if(!data?.access_token)throw new Error('Supabase Session-Refresh fehlgeschlagen.');applySession(data);await saveSession();state.authStatus='authenticated';return true;}catch(e){applySession(null);state.authStatus='error';state.lastError=e.message;throw e;}
 }
 async function ensureSession(){
   if(sessionValid())return session;
   if(session?.refresh_token){try{await refreshSession();return session;}catch(_){/* controlled re-auth */}}
   const mode=validateConfig().authMode;
   if(mode==='anonymous'){await signInAnonymously();return session;}
   throw new Error('Keine gültige Supabase-Auth-Sitzung. Bitte anmelden oder Auth-Token übernehmen.');
 }
 async function api(path,opt={}){await ensureSession();return raw(path,opt,true);}
 async function provider(req){const c=validateConfig();try{
   if(req.action==='health'){state.status='checking';const {data}=await api(`/rest/v1/kc_dp_sync_operations?select=seq,operation_id&org_id=eq.${encodeURIComponent(c.orgId)}&project_id=eq.${encodeURIComponent(c.projectId)}&limit=1`,{method:'GET'});state.status='ready';state.lastHealthAt=new Date().toISOString();state.lastError=null;return {ok:true,rows:Array.isArray(data)?data.length:0,userId:state.userId};}
   if(req.action==='push'){state.status='syncing';const w=req.wireOperation||{},body={p_org_id:c.orgId,p_project_id:c.projectId,p_operation_id:w.operationId,p_entity:w.entity,p_entity_id:w.entityId||w.operationId,p_operation:w.operation,p_base_version:w.baseVersion==null?null:Number(w.baseVersion),p_envelope:w.envelope,p_device_id:K.multiDeviceTest?.deviceId?.()||null};const {data}=await api('/rest/v1/rpc/kc_dp_push_operation',{method:'POST',body:JSON.stringify(body)});state.status='ready';state.lastPushAt=new Date().toISOString();return data||{status:'ok'};}
   if(req.action==='pull'){state.status='syncing';const cursor=Number(req.cursor||0),path=`/rest/v1/kc_dp_sync_operations?select=seq,operation_id,envelope,remote_version&org_id=eq.${encodeURIComponent(c.orgId)}&project_id=eq.${encodeURIComponent(c.projectId)}&seq=gt.${cursor}&order=seq.asc&limit=500`,{data}=await api(path,{method:'GET'}),rows=Array.isArray(data)?data:[];state.status='ready';state.lastPullAt=new Date().toISOString();return {wireOperations:rows.map(r=>({operationId:r.operation_id,envelope:r.envelope,remoteVersion:r.remote_version})),cursor:rows.length?rows[rows.length-1].seq:cursor};}
   throw new Error('Unbekannte Supabase-Aktion.');
  }catch(e){state.status='error';state.lastError=e.message;throw e;}}
 function configure(patch={}){K.integrations?.update?.('supabase',patch);validateConfig();K.sync?.setProvider?.(provider);state.status='configured';return {...cfg(),publishableKey:cfg().publishableKey?'***gesetzt***':''};}
 function configureIfPossible(){try{validateConfig();K.sync?.setProvider?.(provider);state.status=sessionValid()?'authenticated':'configured';return true;}catch(_){K.sync?.setProvider?.(null);state.status='offline';return false;}}
 function setAccessToken(token){const t=String(token||'').trim();if(!t){return false;}const jwt=decodeJwt(t);applySession({access_token:t,refresh_token:'',expires_at:Number(jwt?.exp||Math.floor(Date.now()/1000)+3600),user:jwt?.sub?{id:jwt.sub}:null});saveSession();return true;}
 function restoreSession(s){applySession(s);return !!session;}
 async function clearSession(){applySession(null);try{if(K.storage?.unlocked)await K.storage.remove('supabaseSession');}catch(_){}return true;}
 async function test(){await ensureSession();return provider({action:'health'});}
 async function testProject(){const r=await raw('/auth/v1/settings',{method:'GET'},false);return {ok:true,status:r.response.status,settings:r.data};}
 async function probeDatabase(){await ensureSession();const c=validateConfig();const {data,response}=await api(`/rest/v1/kc_dp_sync_operations?select=seq&org_id=eq.${encodeURIComponent(c.orgId)}&project_id=eq.${encodeURIComponent(c.projectId)}&limit=1`,{method:'GET'});return {ok:true,status:response.status,detail:`kc_dp_sync_operations erreichbar · ${Array.isArray(data)?data.length:0} Zeile(n)`};}
 async function probeRls(){await ensureSession();try{const {data}=await api('/rest/v1/rpc/kc_dp_connection_probe',{method:'POST',body:JSON.stringify({p_org_id:validateConfig().orgId,p_project_id:validateConfig().projectId})});const row=Array.isArray(data)?data[0]:data;return {ok:!!row?.rls_ok,role:row?.membership_role||null,userId:row?.auth_user_id||state.userId,detail:row?.rls_ok?`RLS aktiv · Rolle ${row.membership_role||'–'}`:'RLS aktiv, aber keine KC-DP-Mitgliedschaft für diese Sitzung'};}catch(e){if(/404|not found|Could not find the function|PGRST202/i.test(e.message))throw new Error('KC-DP RLS-Prüffunktion fehlt. Bitte Supabase SQL V0.17.4 ausführen.');throw e;}}
 async function probeRoundtrip(){await ensureSession();const c=validateConfig(),nonce=`diag_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;try{const {data}=await api('/rest/v1/rpc/kc_dp_diagnostic_roundtrip',{method:'POST',body:JSON.stringify({p_org_id:c.orgId,p_project_id:c.projectId,p_nonce:nonce})});const row=Array.isArray(data)?data[0]:data;if(!row?.ok)throw new Error(row?.detail||'Roundtrip nicht bestätigt.');return {ok:true,detail:`Schreib-/Lese-/Löschtest erfolgreich · ${row.server_ms??'–'} ms`,serverMs:row.server_ms??null};}catch(e){if(/404|not found|Could not find the function|PGRST202/i.test(e.message))throw new Error('KC-DP Synchronisations-Testfunktion fehlt. Bitte Supabase SQL V0.17.4 ausführen.');throw e;}}
 async function rest(table,{method='GET',query='',body=null,prefer='return=representation'}={}){const opt={method,headers:{Prefer:prefer}};if(body!==null)opt.body=JSON.stringify(body);return (await api(`/rest/v1/${table}${query}`,opt)).data;}
 async function registerDevice(row){const c=validateConfig();return rest('kc_dp_devices',{method:'POST',query:'?on_conflict=org_id,project_id,device_id',prefer:'resolution=merge-duplicates,return=representation',body:{org_id:c.orgId,project_id:c.projectId,...row,user_id:state.userId,last_seen_at:new Date().toISOString()}});}
 async function listDevices(){const c=validateConfig();return rest('kc_dp_devices',{query:`?select=device_id,user_id,device_name,platform,app_version,status,last_seen_at,capabilities&org_id=eq.${encodeURIComponent(c.orgId)}&project_id=eq.${encodeURIComponent(c.projectId)}&order=last_seen_at.desc`});}
 async function createSyncTest(row){const c=validateConfig();return rest('kc_dp_sync_test_runs',{method:'POST',body:{org_id:c.orgId,project_id:c.projectId,...row}});}
 async function listSyncTests(){const c=validateConfig();return rest('kc_dp_sync_test_runs',{query:`?select=*&org_id=eq.${encodeURIComponent(c.orgId)}&project_id=eq.${encodeURIComponent(c.projectId)}&order=updated_at.desc&limit=20`});}
 async function updateSyncTest(id,patch){return rest('kc_dp_sync_test_runs',{method:'PATCH',query:`?id=eq.${encodeURIComponent(id)}`,body:{...patch,updated_at:new Date().toISOString()}});}
 async function listServerConflicts(){const c=validateConfig();return rest('kc_dp_sync_conflicts',{query:`?select=id,entity,entity_id,operation_id,device_id,base_version,remote_version,status,detected_at,resolved_at&org_id=eq.${encodeURIComponent(c.orgId)}&project_id=eq.${encodeURIComponent(c.projectId)}&order=detected_at.desc&limit=50`});}
 async function resolveServerConflict(id,status,resolution={}){return rest('kc_dp_sync_conflicts',{method:'PATCH',query:`?id=eq.${encodeURIComponent(id)}`,body:{status,resolution,resolved_at:new Date().toISOString()}});}
 K.supabaseConnection={version:'0.19.55-hotfix1',contract:'KC_DP_SUPABASE_SYNC_V1',state,configure,configureIfPossible,setAccessToken,restoreSession,persistSession:saveSession,sessionSnapshot:()=>session?JSON.parse(JSON.stringify(session)):null,clearSession,hasAccessToken:()=>!!session?.access_token,signInAnonymously,signInWithPassword,sendOtp,verifyOtp,requestPasswordReset,updatePassword,currentMembership,provisionMemberAccess,deactivateMemberAccess,provisionTestMember,removeTestMember,sendClientReport,signOut,refreshSession,ensureSession,test,testProject,probeDatabase,probeRls,probeRoundtrip,registerDevice,listDevices,createSyncTest,listSyncTests,updateSyncTest,listServerConflicts,resolveServerConflict,transportDiagnosis,provider,validateConfig};
 configureIfPossible();
})();
