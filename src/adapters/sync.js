(function(){
  const K=window.KCDP=window.KCDP||{};
  let provider=typeof window.KCDPSupabaseProvider==='function'?window.KCDPSupabaseProvider:null;
  let secretProvider=()=>K.storage?.secret||null;
  let remoteKeyContext=null,remoteKeyPromise=null;
  const listeners=new Set();
  const state={status:provider?'ready':'offline',lastSyncAt:null,lastCheckAt:null,lastError:null,cursor:null,maintenance:false,syncGeneration:null,syncNamespace:null,keyFingerprint:null,legacyPacketsArchived:0};
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
  async function ensureRemoteKey(){
    if(remoteKeyContext?.secret)return remoteKeyContext;
    if(remoteKeyPromise)return remoteKeyPromise;
    remoteKeyPromise=(async()=>{
      if(K.supabaseConnection?.getSyncKey){
        const key=await K.supabaseConnection.getSyncKey();
        if(!key?.secret||!key?.namespace)throw new Error('Der gemeinsame Projektschlüssel ist unvollständig.');
        remoteKeyContext={secret:key.secret,namespace:key.namespace,generation:Number(key.generation||1),fingerprint:key.fingerprint||null};
      }else{
        const secret=secretProvider?.();if(!secret)throw new Error('Remote-Sync ist gesperrt: kein Sitzungsschlüssel verfügbar.');
        remoteKeyContext={secret,namespace:'KC_DP',generation:1,fingerprint:null};
      }
      const previous=state.syncNamespace;
      state.syncGeneration=remoteKeyContext.generation;state.syncNamespace=remoteKeyContext.namespace;state.keyFingerprint=remoteKeyContext.fingerprint;
      if(previous&&previous!==remoteKeyContext.namespace){state.cursor=null;state.legacyPacketsArchived=Number(state.legacyPacketsArchived||0)+1;}
      return remoteKeyContext;
    })();
    try{return await remoteKeyPromise}finally{remoteKeyPromise=null}
  }
  async function toWireOperation(op){
    const key=await ensureRemoteKey();
    const envelope=await KCSecureSync.encryptEnvelope(op,{secret:key.secret,projectId:key.namespace,aad:'KC_DP_REMOTE_SYNC_V2'});
    return {contract:'KC_DP_SYNC_V1',operationId:op.operationId,entity:op.entity,entityId:op.payload?.id||op.payload?.date||op.entityId||op.operationId,operation:op.operation,baseVersion:op.baseVersion??null,localVersion:op.localVersion??null,syncNamespace:key.namespace,envelope};
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
    try{const key=await ensureRemoteKey(),res=await provider({action:'health',contract:'KC_DP_SYNC_V1',syncNamespace:key.namespace});emit('traffic',{direction:'rx'});if(res?.ok===false)throw new Error(res.message||'Remote-Healthcheck fehlgeschlagen.');setStatus(state.maintenance?'maintenance':'ready');return {ok:true,response:res||{ok:true},syncGeneration:key.generation,syncNamespace:key.namespace};}
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

  function collectionFor(entity){if(entity==='shift')return K.shifts;if(entity==='wish')return K.wishes;if(entity==='standby')return K.standby;if(entity==='member_shift_offer')return K.memberShiftOffers;return null;}
  function applyRemote(op){
    if(op.entity==='day_config'){const date=op.payload?.date||op.entityId;if(date)K.daySettings[date]=JSON.parse(JSON.stringify(op.payload));return;}
    if(op.entity==='demand_matrix'){if(op.payload?.date&&Array.isArray(op.payload.rows))K.demandMatrix[op.payload.date]=JSON.parse(JSON.stringify(op.payload.rows));return;}
    if(op.entity==='plan_day'&&Array.isArray(op.payload?.shifts)){K.shifts=K.shifts.filter(s=>!(s.date===op.payload.date&&s.layer==='planned'));K.shifts.push(...op.payload.shifts.map(x=>({...x})));return;}
    const list=collectionFor(op.entity);if(!list)return;const payload=op.payload||{},id=payload.id||op.entityId;if(!id)return;let local=list.find(x=>x.id===id);
    const pending=K.syncOutbox.some(x=>x.status!=='sent'&&x.entity===op.entity&&(x.payload?.id===id));if(pending){K.syncConflicts.push({id:`CON-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,operationId:op.operationId||null,entity:op.entity,local:local?JSON.parse(JSON.stringify(local)):null,remote:payload,detectedAt:new Date().toISOString(),status:'open',source:'pull'});return;}
    if(op.operation==='delete'||payload.status==='deleted'){if(local)Object.assign(local,payload,{status:'deleted'});else list.push({...payload,id,status:'deleted'});return;}
    if(local)Object.assign(local,payload);else list.push({...payload,id});
  }
  async function pull(){
    await requireTransport();if(!provider)throw new Error('Supabase-Provider ist nicht verbunden.');
    const key=await ensureRemoteKey();setStatus('syncing');emit('traffic',{direction:'tx'});
    try{const res=await provider({action:'pull',contract:'KC_DP_SYNC_V1',cursor:state.cursor,syncNamespace:key.namespace});emit('traffic',{direction:'rx'});let applied=0;for(const wire of res?.wireOperations||[]){const op=wire.envelope?await KCSecureSync.decryptEnvelope(wire.envelope,{secret:key.secret,projectId:key.namespace}):wire.operation;if(op){applyRemote(op);applied++;}}state.cursor=res?.cursor??state.cursor;state.lastSyncAt=new Date().toISOString();setStatus(state.maintenance?'maintenance':'ready');K.recordAudit?.('sync.pull',{entity:'sync',after:{applied,cursor:state.cursor,generation:key.generation}});return {applied,cursor:state.cursor,conflicts:K.syncConflicts.filter(x=>x.status==='open').length,generation:key.generation};}catch(e){setStatus('error',e.message);throw e;}
  }
  async function publishBaseline({confirmed=false}={}){
    K.auth?.require?.('roster.sync.run','Sie dürfen keinen Cloud-Ausgangsstand veröffentlichen.');
    if(!confirmed)throw new Error('Die Veröffentlichung des lokalen Planbestands wurde nicht bestätigt.');
    const role=String(K.currentUser?.role||'');if(!['admin','planner','duty_manager'].includes(role))throw new Error('Für den Cloud-Ausgangsstand ist eine Planungsrolle erforderlich.');
    const key=await ensureRemoteKey(),remote=await provider({action:'health',contract:'KC_DP_SYNC_V1',syncNamespace:key.namespace});
    if(Number(remote?.rows||0)>0)throw new Error('Die sichere Cloud-Generation enthält bereits Daten und wird nicht überschrieben.');
    let staged=0;
    for(const wish of K.wishes||[]){enqueue({entity:'wish',operation:'baseline',payload:JSON.parse(JSON.stringify(wish)),baseVersion:null});staged++;}
    for(const shift of K.shifts||[]){enqueue({entity:'shift',operation:'baseline',payload:JSON.parse(JSON.stringify(shift)),baseVersion:null});staged++;}
    for(const standby of K.standby||[]){enqueue({entity:'standby',operation:'baseline',payload:JSON.parse(JSON.stringify(standby)),baseVersion:null});staged++;}
    for(const [date,value] of Object.entries(K.daySettings||{})){enqueue({entity:'day_config',operation:'baseline',payload:{...JSON.parse(JSON.stringify(value)),date},baseVersion:null});staged++;}
    for(const [date,rows] of Object.entries(K.demandMatrix||{})){enqueue({entity:'demand_matrix',operation:'baseline',payload:{date,rows:JSON.parse(JSON.stringify(rows))},baseVersion:null});staged++;}
    await persistQueue();const pushed=await flush(),pulled=await pull();K.recordAudit?.('sync.baseline.publish',{entity:'sync',after:{staged,sent:pushed.sent,generation:key.generation,namespace:key.namespace}});return {staged,pushed,pulled,generation:key.generation};
  }
  async function syncBoth(){const pushed=await flush();const pulled=await pull();return {pushed,pulled};}
  K.sync={
    version:'0.16.0',state,
    setProvider(fn){provider=typeof fn==='function'?fn:null;setStatus(provider?'ready':'offline');},setSecretProvider(fn){secretProvider=typeof fn==='function'?fn:secretProvider;},resetRemoteKey(){remoteKeyContext=null;remoteKeyPromise=null;},hasProvider(){return !!provider;},
    publishBaseline,on(fn){if(typeof fn==='function')listeners.add(fn);return()=>listeners.delete(fn);},enqueue,healthCheck,flush,pull,syncBoth,resolveConflict,persistQueue,whenDurable:()=>durableWrite,
    restore({outbox=[],conflicts=[],meta={}}={}){K.syncOutbox=Array.isArray(outbox)?outbox:[];K.syncConflicts=Array.isArray(conflicts)?conflicts:[];Object.assign(state,meta||{});if(!provider&&state.status!=='maintenance')state.status='offline';emit('status');},
    snapshot(){return {outbox:K.syncOutbox,conflicts:K.syncConflicts,meta:{...state}};},
    pending(){return K.syncOutbox.filter(x=>x.status==='pending'||x.status==='sending').length;},openConflicts(){return K.syncConflicts.filter(x=>x.status==='open').length;}
  };
})();
