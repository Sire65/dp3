(function(){
  const K=window.KCDP=window.KCDP||{};
  let provider=typeof window.KCDPSupabaseProvider==='function'?window.KCDPSupabaseProvider:null;
  let secretProvider=()=>K.storage?.secret||null;
  const listeners=new Set();
  const state={status:provider?'ready':'offline',lastSyncAt:null,lastCheckAt:null,lastError:null,cursor:null,maintenance:false};
  let durableWrite=Promise.resolve();
  K.syncOutbox=K.syncOutbox||[];K.syncConflicts=K.syncConflicts||[];

  function emit(type,detail={}){for(const fn of listeners){try{fn({type,state:{...state},...detail})}catch(_){}}}
  function setStatus(status,error=null){state.status=status;state.lastError=error?String(error):null;emit('status');}
  function makeOp({entity,operation,payload,baseVersion=null}){
    const normalized=KCSecureSync.normalizeQueueItem({entity,operation,payload:JSON.parse(JSON.stringify(payload)),baseVersion,contract:'KC_DP_SYNC_V1'});
    normalized.localVersion=Number(payload?.version||baseVersion||0);return normalized;
  }
  function persistQueue(){
    if(!K.storage?.unlocked)return durableWrite;
    const snapshot=JSON.parse(JSON.stringify(K.syncOutbox)),conflicts=JSON.parse(JSON.stringify(K.syncConflicts)),meta={...state};
    durableWrite=durableWrite.catch(()=>{}).then(()=>K.storage.putMany([['syncOutbox',snapshot],['syncConflicts',conflicts],['syncMeta',meta]],{force:true})).catch(e=>{state.lastError=`Lokale Warteschlange konnte nicht gesichert werden: ${e.message}`;emit('status');throw e;});
    return durableWrite;
  }
  function enqueue(input){const op=makeOp(input);K.syncOutbox.push(op);emit('queue',{operation:op});persistQueue().catch(()=>{});return op;}
  function due(op){return op.status==='pending'&&(!op.nextAttemptAt||new Date(op.nextAttemptAt).getTime()<=Date.now());}
  async function toWireOperation(op){
    const secret=secretProvider?.();if(!secret)throw new Error('Remote-Sync ist gesperrt: kein Sitzungsschlüssel verfügbar.');
    const envelope=await KCSecureSync.encryptEnvelope(op,{secret,projectId:'KC_DP',aad:'KC_DP_REMOTE_SYNC_V1'});
    return {contract:'KC_DP_SYNC_V1',operationId:op.operationId,entity:op.entity,entityId:op.payload?.id||op.payload?.date||op.entityId||op.operationId,operation:op.operation,baseVersion:op.baseVersion??null,localVersion:op.localVersion??null,envelope};
  }
  function transportAuthenticated(){
    if(!K.memberAccess?.configured?.())return true;
    return K.memberAccess?.state?.status==='authenticated'||K.supabaseConnection?.state?.authStatus==='authenticated';
  }
  async function requireTransport(){if(!K.memberAccess?.configured?.())return true;try{await K.supabaseConnection?.ensureSession?.();return true;}catch(_){if(transportAuthenticated())return true;throw new Error('Ihre Supabase-Sitzung ist nicht mehr aktiv. Bitte einmal abmelden und wieder anmelden.');}}
  async function healthCheck(){
    await requireTransport();state.lastCheckAt=new Date().toISOString();
    if(!provider){setStatus('offline','Supabase-Provider ist nicht verbunden.');return {ok:false,status:'offline'};}
    setStatus('checking');emit('traffic',{direction:'tx'});
    try{const res=await provider({action:'health',contract:'KC_DP_SYNC_V1'});emit('traffic',{direction:'rx'});if(res?.ok===false)throw new Error(res.message||'Remote-Healthcheck fehlgeschlagen.');setStatus(state.maintenance?'maintenance':'ready');return {ok:true,response:res||{ok:true}};}
    catch(e){setStatus('error',e.message);throw e;}
  }
  async function flush(){
    await requireTransport();if(!provider)throw new Error('Supabase-Provider ist nicht verbunden.');
    setStatus('syncing');let sent=0,conflicts=0,failed=0;
    for(const op of [...K.syncOutbox].filter(due)){
      op.status='sending';op.attempts=Number(op.attempts||0)+1;emit('traffic',{direction:'tx',operation:op});
      try{
        const wireOperation=await toWireOperation(op);
        const res=await provider({action:'push',contract:'KC_DP_SYNC_V1',wireOperation});emit('traffic',{direction:'rx',operation:op});
        if(res?.status==='conflict'){
          op.status='conflict';const c={id:`CON-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,operationId:op.operationId,entity:op.entity,local:op.payload,remote:res.remote||null,detectedAt:new Date().toISOString(),status:'open'};K.syncConflicts.push(c);conflicts++;continue;
        }
        op.status='sent';op.sentAt=new Date().toISOString();op.remoteVersion=res?.remoteVersion??null;sent++;
      }catch(e){op.status='pending';op.lastError=e.message;op.nextAttemptAt=KCSecureSync.nextRetry(op.attempts);failed++;}
    }
    K.syncOutbox=K.syncOutbox.filter(op=>op.status!=='sent');state.lastSyncAt=new Date().toISOString();setStatus(failed?'error':(state.maintenance?'maintenance':'ready'),failed?`${failed} Übertragung(en) fehlgeschlagen.`:null);
    await persistQueue();K.recordAudit?.('sync.flush',{entity:'sync',after:{sent,conflicts,failed,pending:K.syncOutbox.length}});return {sent,conflicts,failed,pending:K.syncOutbox.length};
  }
  function resolveConflict(id,choice){
    K.auth?.require?.('roster.sync.run','Sie dürfen Synchronisationskonflikte nicht auflösen.');const c=K.syncConflicts.find(x=>x.id===id);if(!c)throw new Error('Konflikt nicht gefunden.');
    if(!['local','remote'].includes(choice))throw new Error('Konfliktentscheidung muss local oder remote sein.');c.status='resolved';c.resolution=choice;c.resolvedAt=new Date().toISOString();
    if(choice==='local')enqueue({entity:c.entity,operation:'force_update',payload:c.local,baseVersion:c.remote?.version??null});else persistQueue().catch(()=>{});
    K.recordAudit?.('sync.conflict.resolve',{entity:'sync_conflict',entityId:id,reason:choice,after:c});return c;
  }

  function collectionFor(entity){if(entity==='shift')return K.shifts;if(entity==='wish')return K.wishes;if(entity==='standby')return K.standby;return null;}
  function applyRemote(op){
    if(op.entity==='day_config'){K.configuration?.updateDay?.(op.payload.date,op.payload);return;}
    if(op.entity==='demand_matrix'){if(op.payload?.date&&Array.isArray(op.payload.rows))K.demandMatrix[op.payload.date]=JSON.parse(JSON.stringify(op.payload.rows));return;}
    if(op.entity==='plan_day'&&Array.isArray(op.payload?.shifts)){K.shifts=K.shifts.filter(s=>!(s.date===op.payload.date&&s.layer==='planned'));K.shifts.push(...op.payload.shifts.map(x=>({...x})));return;}
    const list=collectionFor(op.entity);if(!list)return;const payload=op.payload||{},id=payload.id||op.entityId;if(!id)return;let local=list.find(x=>x.id===id);
    const pending=K.syncOutbox.some(x=>x.status!=='sent'&&x.entity===op.entity&&(x.payload?.id===id));if(pending){K.syncConflicts.push({id:`CON-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,operationId:op.operationId||null,entity:op.entity,local:local?JSON.parse(JSON.stringify(local)):null,remote:payload,detectedAt:new Date().toISOString(),status:'open',source:'pull'});return;}
    if(op.operation==='delete'||payload.status==='deleted'){if(local)Object.assign(local,payload,{status:'deleted'});else list.push({...payload,id,status:'deleted'});return;}
    if(local)Object.assign(local,payload);else list.push({...payload,id});
  }
  async function pull(){
    await requireTransport();if(!provider)throw new Error('Supabase-Provider ist nicht verbunden.');
    const secret=secretProvider?.();if(!secret)throw new Error('Remote-Sync ist gesperrt: kein Sitzungsschlüssel verfügbar.');setStatus('syncing');emit('traffic',{direction:'tx'});
    try{const res=await provider({action:'pull',contract:'KC_DP_SYNC_V1',cursor:state.cursor});emit('traffic',{direction:'rx'});let applied=0;for(const wire of res?.wireOperations||[]){const op=wire.envelope?await KCSecureSync.decryptEnvelope(wire.envelope,{secret,projectId:'KC_DP'}):wire.operation;if(op){applyRemote(op);applied++;}}state.cursor=res?.cursor??state.cursor;state.lastSyncAt=new Date().toISOString();setStatus(state.maintenance?'maintenance':'ready');K.recordAudit?.('sync.pull',{entity:'sync',after:{applied,cursor:state.cursor}});return {applied,cursor:state.cursor,conflicts:K.syncConflicts.filter(x=>x.status==='open').length};}catch(e){setStatus('error',e.message);throw e;}
  }
  async function syncBoth(){const pushed=await flush();const pulled=await pull();return {pushed,pulled};}
  K.sync={
    version:'0.16.0',state,
    setProvider(fn){provider=typeof fn==='function'?fn:null;setStatus(provider?'ready':'offline');},setSecretProvider(fn){secretProvider=typeof fn==='function'?fn:secretProvider;},hasProvider(){return !!provider;},
    on(fn){if(typeof fn==='function')listeners.add(fn);return()=>listeners.delete(fn);},enqueue,healthCheck,flush,pull,syncBoth,resolveConflict,persistQueue,whenDurable:()=>durableWrite,
    restore({outbox=[],conflicts=[],meta={}}={}){K.syncOutbox=Array.isArray(outbox)?outbox:[];K.syncConflicts=Array.isArray(conflicts)?conflicts:[];Object.assign(state,meta||{});if(!provider&&state.status!=='maintenance')state.status='offline';emit('status');},
    snapshot(){return {outbox:K.syncOutbox,conflicts:K.syncConflicts,meta:{...state}};},
    pending(){return K.syncOutbox.filter(x=>x.status==='pending'||x.status==='sending').length;},openConflicts(){return K.syncConflicts.filter(x=>x.status==='open').length;}
  };
})();
