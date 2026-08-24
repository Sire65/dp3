(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const state={status:'signed_out',user:null,membership:null,remember:true,firstAccess:false,lastError:null};
  const roleMap={member:'employee',employee:'employee',planner:'planner',duty_manager:'duty_manager',time_auditor:'time_auditor',admin:'admin',read_only:'read_only'};
  const testDefs={
    'KC-TEST-001':'Testmitglied Anna Berger',
    'KC-TEST-002':'Testmitglied Bernd König'
  };
  function ensureTestPeople(){if(!Array.isArray(K.people))return;for(const [personId,name] of Object.entries(testDefs)){if(K.person?.(personId))continue;K.people.push({personId,name,skills:'TEST · Vorne · Hinten · Flex',personType:'member',active:true,expanded:false,maxHours:8,pseudoName:'TEST',phone:'nicht hinterlegt',preferences:{},availability:[],testAccount:true});}}
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  function normalizeRole(role){return roleMap[String(role||'').toLowerCase()]||'employee';}
  function publicConfig(){const c=K.integrations?.snapshot?.().supabase||K.integrationConfig?.supabase||{};return {url:c.url||'',publishableKey:c.publishableKey||'',orgId:c.orgId||'KC_WERNE',projectId:c.projectId||'KC_DP'};}
  async function bootstrapDb(){return new Promise((resolve,reject)=>{const q=indexedDB.open('KC_DP_BOOTSTRAP',1);q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains('public_config'))db.createObjectStore('public_config',{keyPath:'key'});};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async function bootstrapPut(key,value){const db=await bootstrapDb();return new Promise((resolve,reject)=>{const tx=db.transaction('public_config','readwrite');tx.objectStore('public_config').put({key,value,updatedAt:new Date().toISOString()});tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
  async function bootstrapGet(key){const db=await bootstrapDb();return new Promise((resolve,reject)=>{const tx=db.transaction('public_config','readonly'),q=tx.objectStore('public_config').get(key);q.onsuccess=()=>resolve(q.result?.value);q.onerror=()=>reject(q.error);});}
  async function setRememberHint(v){state.remember=!!v;try{await bootstrapPut('remember_auth',!!v);}catch(_){}return !!v;}
  async function rememberedHint(){try{return !!(await bootstrapGet('remember_auth'));}catch(_){return false;}}
  async function cachePublicConfig(){try{const c=publicConfig();if(!(c.url&&c.publishableKey))return false;const db=await bootstrapDb();return await new Promise((resolve,reject)=>{const tx=db.transaction('public_config','readwrite');tx.objectStore('public_config').put({key:'supabase',value:c,updatedAt:new Date().toISOString()});tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}catch(_){return false;}}
  async function restorePublicConfig(){try{const db=await bootstrapDb(),row=await new Promise((resolve,reject)=>{const tx=db.transaction('public_config','readonly'),q=tx.objectStore('public_config').get('supabase');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});const c=row?.value;if(c?.url&&c?.publishableKey){K.integrations?.update?.('supabase',{url:c.url,publishableKey:c.publishableKey,orgId:c.orgId||'KC_WERNE',projectId:c.projectId||'KC_DP',authMode:'password'});K.supabaseConnection?.configureIfPossible?.();return true;}}catch(_){}return false;}
  function configured(){const c=publicConfig();return /^https:\/\//.test(c.url)&&String(c.publishableKey||'').trim().length>20;}
  async function applyRemoteIdentity(){
    const sb=K.supabaseConnection;if(!sb?.hasAccessToken?.())throw new Error('Keine gültige Supabase-Anmeldung.');
    const m=await sb.currentMembership();if(!m?.active)throw new Error('Dieser KC-DP-Zugang ist nicht aktiv.');
    const personId=m.person_id||m.personId||null;if(/^KC-TEST-00[12]$/.test(String(personId||'')))ensureTestPeople();const p=personId?K.person?.(personId):null;
    if(!personId||!p)throw new Error('Der Anmeldung ist noch kein KC-DP-Mitglied zugeordnet. Bitte den Administrator informieren.');
    const role=normalizeRole(m.role),displayName=m.display_name||p.name;
    K.auth.setCurrentUser({personId,role,displayName});
    state.user={id:sb.state.userId,personId,displayName,email:m.email||'',phone:m.phone||'',role};state.membership=clone(m);state.status='authenticated';state.lastError=null;
    K.session?.adoptAuthenticatedUser?.({personId,role,displayName,provider:'supabase'});
    return clone(state.user);
  }
  async function signInPassword({email,password,remember=true}){
    if(!configured())throw new Error('Supabase-Anmeldung ist noch nicht eingerichtet.');state.status='authenticating';state.remember=!!remember;
    try{await K.supabaseConnection.signInWithPassword({email,password});const u=await applyRemoteIdentity();await setRememberHint(remember);return u;}catch(e){state.status='signed_out';state.lastError=e.message;throw e;}
  }
  async function sendFirstAccessCode({email='',phone='',channel='email'}){
    if(!configured())throw new Error('Supabase-Anmeldung ist noch nicht eingerichtet.');state.status='verifying';
    if(channel==='email'){await K.supabaseConnection.sendOtp({email,shouldCreateUser:false});state.firstAccess={channel,email};}
    else {await K.supabaseConnection.sendOtp({phone,channel:channel==='whatsapp'?'whatsapp':'sms',shouldCreateUser:false});state.firstAccess={channel,phone};}
    return true;
  }
  async function verifyFirstAccessCode({token}){
    const x=state.firstAccess;if(!x)throw new Error('Bitte zuerst einen Sicherheitscode anfordern.');
    if(x.channel==='email')await K.supabaseConnection.verifyOtp({email:x.email,token,type:'email'});
    else await K.supabaseConnection.verifyOtp({phone:x.phone,token,type:'sms'});
    const u=await applyRemoteIdentity();state.firstAccess={...x,verified:true};await setRememberHint(true);return u;
  }
  async function setInitialPassword(password){if(String(password||'').length<8)throw new Error('Das Passwort muss mindestens 8 Zeichen lang sein.');await K.supabaseConnection.updatePassword(password);state.firstAccess=false;return true;}
  async function requestPasswordReset(email){if(!configured())throw new Error('Supabase-Anmeldung ist noch nicht eingerichtet.');return K.supabaseConnection.requestPasswordReset(email,location.origin+location.pathname+'?password-recovery=1');}
  function consumeRecoverySessionFromUrl(){try{const hash=new URLSearchParams(String(location.hash||'').replace(/^#/,'')),type=hash.get('type'),access=hash.get('access_token');if(type!=='recovery'||!access)return false;K.supabaseConnection.restoreSession({access_token:access,refresh_token:hash.get('refresh_token')||'',expires_in:Number(hash.get('expires_in')||3600),token_type:hash.get('token_type')||'bearer'});history.replaceState({},document.title,location.pathname+'?password-recovery=1');return true;}catch(_){return false;}}
  async function finishPasswordRecovery(password){if(String(password||'').length<8)throw new Error('Das Passwort muss mindestens 8 Zeichen lang sein.');await K.supabaseConnection.updatePassword(password);await K.supabaseConnection.signOut();await setRememberHint(false);return true;}
  async function persistSessionIfNeeded(){if(!K.storage?.unlocked)return false;if(state.remember&&K.supabaseConnection?.hasAccessToken?.()){await K.supabaseConnection.persistSession?.();return true;}try{await K.storage.remove('supabaseSession');}catch(_){}return false;}
  async function restore(){await restorePublicConfig();if(!configured())return null;try{if(K.supabaseConnection?.hasAccessToken?.())return await applyRemoteIdentity();}catch(_){await K.supabaseConnection?.clearSession?.();}return null;}
  async function provisionMemberAccess({personId,displayName,email='',phone='',role='employee'}={}){
    if(K.currentUser?.role!=='admin')throw new Error('Nur Administratoren dürfen Benutzerzugänge verwalten.');
    if(!configured())throw new Error('Supabase ist noch nicht vollständig eingerichtet.');
    return K.supabaseConnection.provisionMemberAccess({personId,displayName,email,phone,role});
  }
  async function deactivateMemberAccess(personId){
    if(K.currentUser?.role!=='admin')throw new Error('Nur Administratoren dürfen Benutzerzugänge verwalten.');
    if(!configured())throw new Error('Supabase ist noch nicht vollständig eingerichtet.');
    return K.supabaseConnection.deactivateMemberAccess(personId);
  }
  async function provisionTestMember({personId,displayName,email,temporaryPassword}={}){
    if(K.currentUser?.role!=='admin')throw new Error('Nur Administratoren dürfen Testzugänge verwalten.');
    if(!/^KC-TEST-00[12]$/.test(String(personId||'')))throw new Error('Ungültige KC-DP-Testperson.');
    if(!configured())throw new Error('Supabase ist noch nicht vollständig eingerichtet.');
    return K.supabaseConnection.provisionTestMember({personId,displayName,email,temporaryPassword});
  }
  async function removeTestMember(personId){
    if(K.currentUser?.role!=='admin')throw new Error('Nur Administratoren dürfen Testzugänge verwalten.');
    if(!/^KC-TEST-00[12]$/.test(String(personId||'')))throw new Error('Ungültige KC-DP-Testperson.');
    if(!configured())throw new Error('Supabase ist noch nicht vollständig eingerichtet.');
    return K.supabaseConnection.removeTestMember(personId);
  }
  async function signOut(){state.status='signed_out';state.user=null;state.membership=null;state.firstAccess=false;await setRememberHint(false);try{await K.supabaseConnection?.signOut?.();}catch(_){await K.supabaseConnection?.clearSession?.();}K.session?.logout?.('KC-DP Abmeldung');return true;}
  function localTestLogin({personId,role='employee'}={}){if(!(location.hostname==='127.0.0.1'||location.hostname==='localhost'||location.protocol==='file:'))throw new Error('Lokaler Prüfzugang ist nur auf diesem Gerät verfügbar.');const p=K.person(personId||K.people?.[0]?.personId);if(!p)throw new Error('Person nicht gefunden.');K.auth.setCurrentUser({personId:p.personId,role:normalizeRole(role),displayName:p.name});K.session?.adoptAuthenticatedUser?.({personId:p.personId,role:normalizeRole(role),displayName:p.name,provider:'local-test'});state.status='authenticated';state.user={personId:p.personId,role:normalizeRole(role),displayName:p.name,localTest:true};return clone(state.user);}
  K.memberAccess={version:'0.18.0',state,normalizeRole,configured,publicConfig,cachePublicConfig,restorePublicConfig,setRememberHint,rememberedHint,persistSessionIfNeeded,consumeRecoverySessionFromUrl,finishPasswordRecovery,restore,signInPassword,sendFirstAccessCode,verifyFirstAccessCode,setInitialPassword,requestPasswordReset,applyRemoteIdentity,provisionMemberAccess,deactivateMemberAccess,provisionTestMember,removeTestMember,signOut,localTestLogin};
})();
