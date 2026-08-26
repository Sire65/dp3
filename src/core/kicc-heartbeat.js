(function(){
  'use strict';
  const SCHEMA='kicc.program-heartbeat.v1';
  const PROGRAM_ID='kc-dp2';
  const NAME='KC DP2';
  const VERSION='0.20.0';
  const BUILD=String(window.KC_DP_BUILD||88);
  const INTERVAL_MS=30000;
  let errors=0;
  let tx=0;
  let lastSendAt=null;
  let lastError=null;

  function instanceId(){
    const key='kcdp.kicc.instance.v1';
    try{
      let id=localStorage.getItem(key);
      if(!id){id=(crypto.randomUUID?.()||('dp2-'+Date.now()+'-'+Math.random().toString(36).slice(2)));localStorage.setItem(key,id);}
      return id;
    }catch{return 'dp2-browser';}
  }
  const INSTANCE_ID=instanceId();
  function endpoint(){return window.KICC_PROGRAM_HEARTBEAT_ENDPOINT||null;}
  async function credentials(){
    try{
      if(typeof window.KICC_AUTH?.getProgramHeartbeatBridgeAuth==='function')return await window.KICC_AUTH.getProgramHeartbeatBridgeAuth()||{};
    }catch{}
    return {};
  }
  function heartbeat(latencyMs=null){
    return {
      schema:SCHEMA,programId:PROGRAM_ID,instanceId:INSTANCE_ID,name:NAME,deviceType:'WEB_APP',
      version:VERSION,build:BUILD,status:navigator.onLine?'ONLINE':'OFFLINE',measuredAt:new Date().toISOString(),
      latencyMs:Number.isFinite(latencyMs)?Math.max(0,Math.round(latencyMs)):null,trafficTx:tx,errorCount:errors,
      source:'PROGRAM_HEARTBEAT',trust:'SELF_REPORTED',
      message:document.visibilityState==='hidden'?'App im Hintergrund':'App aktiv'
    };
  }
  function emitLocal(hb){
    try{window.dispatchEvent(new CustomEvent('kicc:program-heartbeat',{detail:hb}));}catch{}
    try{const bc=new BroadcastChannel('kicc-program-heartbeat-v1');bc.postMessage(hb);bc.close();}catch{}
  }
  async function postRemote(hb){
    const url=endpoint();
    if(!url||!/^https:\/\//i.test(url))return {sent:false,reason:'REMOTE_NOT_CONFIGURED'};
    const auth=await credentials();
    if(!auth.authorization&&!auth.apikey)return {sent:false,reason:'AUTH_REQUIRED'};
    const envelope={schema:'kicc.remote-program-heartbeat.v1',nonce:(crypto.randomUUID?.()||String(Date.now())+Math.random()),sentAt:new Date().toISOString(),authState:'AUTHENTICATED',sourceId:INSTANCE_ID,heartbeat:hb};
    const headers={'content-type':'application/json','accept':'application/json'};
    if(auth.authorization)headers.authorization=auth.authorization;
    if(auth.apikey)headers.apikey=auth.apikey;
    const started=performance.now();
    const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(envelope),cache:'no-store',credentials:'omit'});
    if(!response.ok)throw new Error('Heartbeat HTTP '+response.status);
    tx+=1;lastSendAt=new Date().toISOString();lastError=null;
    return {sent:true,latencyMs:performance.now()-started};
  }
  async function send(){
    const started=performance.now();
    let hb=heartbeat();
    emitLocal(hb);
    try{
      const result=await postRemote(hb);
      if(result.sent){hb=heartbeat(result.latencyMs);emitLocal(hb);}
    }catch(error){errors+=1;lastError=error instanceof Error?error.message:String(error);}
    window.KC_DP_KICC_HEARTBEAT_STATE={programId:PROGRAM_ID,version:VERSION,build:BUILD,instanceId:INSTANCE_ID,lastAttemptAt:new Date().toISOString(),lastSendAt,lastError,remoteConfigured:Boolean(endpoint()),elapsedMs:Math.round(performance.now()-started)};
  }
  addEventListener('online',send);addEventListener('offline',send);addEventListener('visibilitychange',send);
  addEventListener('error',()=>{errors+=1;});addEventListener('unhandledrejection',()=>{errors+=1;});
  send();setInterval(send,INTERVAL_MS);
})();
