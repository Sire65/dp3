(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  if(K.__updateBuildGuardInstalled)return;
  K.__updateBuildGuardInstalled=true;

  const CURRENT_RELEASE=String(K.updateManager?.CURRENT_RELEASE||K.APP_RELEASE||'0.20.0');
  const CURRENT_BUILD=Number(window.KC_DP_BUILD||0);
  const MANIFEST_URL='update-manifest.json';
  const SNOOZE_MS=12*60*60*1000;
  const state={lastCheckAt:null,lastSeenBuild:null,lastError:null};

  function semver(v){return String(v||'0').replace(/^v/i,'').split('.').map(x=>Number.parseInt(x,10)||0).slice(0,3).concat([0,0,0]).slice(0,3);}
  function cmpVersion(a,b){const A=semver(a),B=semver(b);for(let i=0;i<3;i++){if(A[i]>B[i])return 1;if(A[i]<B[i])return -1;}return 0;}
  function safeGet(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}}
  function safeSet(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function snoozed(version,build){const x=safeGet('kc_dp_update_snooze');return !!(x&&x.version===version&&Number(x.build||0)===Number(build||0)&&Date.now()-Number(x.at||0)<SNOOZE_MS);}
  function snooze(version,build=state.lastSeenBuild||CURRENT_BUILD){safeSet('kc_dp_update_snooze',{version,build:Number(build||0),at:Date.now()});}

  async function fetchManifest(){
    if(!/^https?:$/.test(location.protocol))throw new Error('Updateprüfung benötigt die Web-Version über HTTPS/HTTP.');
    const r=await fetch(`${MANIFEST_URL}?kc_build_check=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error(`Update-Manifest nicht erreichbar (HTTP ${r.status}).`);
    const m=await r.json();
    if(!m||!m.version||!Array.isArray(m.files))throw new Error('Update-Manifest ist unvollständig.');
    return m;
  }

  function isNewerBuild(m){
    const vc=cmpVersion(m.version,CURRENT_RELEASE);
    if(vc>0)return true;
    if(vc<0)return false;
    return Number(m.build||0)>CURRENT_BUILD;
  }

  async function check({manual=false}={}){
    state.lastCheckAt=new Date().toISOString();state.lastError=null;
    try{
      const m=await fetchManifest();
      state.lastSeenBuild=Number(m.build||0);
      if(isNewerBuild(m)){
        const detail={...m,build:Number(m.build||0),currentBuild:CURRENT_BUILD};
        if(manual||!snoozed(m.version,m.build))window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_AVAILABLE',{detail}));
        return {available:true,manifest:detail};
      }
      if(manual)window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_CURRENT',{detail:{version:CURRENT_RELEASE,build:CURRENT_BUILD}}));
      return {available:false,manifest:m};
    }catch(error){
      state.lastError=error.message;
      if(manual)window.dispatchEvent(new CustomEvent('KC_DP_UPDATE_CHECK_ERROR',{detail:{message:error.message}}));
      return {available:false,error};
    }
  }

  function schedule(){
    setTimeout(()=>check(),1800);
    setInterval(()=>check(),30*60*1000);
    window.addEventListener('online',()=>check());
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){const last=Date.parse(state.lastCheckAt||0)||0;if(Date.now()-last>60000)check();}});
  }

  if(K.updateManager){K.updateManager.snooze=(version)=>snooze(version,state.lastSeenBuild||CURRENT_BUILD);}
  K.updateBuildGuard={version:'1.0.1',CURRENT_RELEASE,CURRENT_BUILD,state,check,isNewerBuild,snooze};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
