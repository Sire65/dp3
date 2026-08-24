(function(){
 const K=window.KCDP=window.KCDP||{};
 const state={identity:null,devices:[],runs:[],conflicts:[],busy:false,lastError:null};
 const clone=v=>JSON.parse(JSON.stringify(v));
 async function identity(){
   if(state.identity)return state.identity;
   let saved=null;try{saved=await K.storage?.get?.('multiDeviceIdentity');}catch(_){}
   if(!saved?.deviceId){saved={deviceId:crypto.randomUUID(),deviceName:K.databaseDiagnostics?.snapshot?.().state?.deviceName||navigator.platform||'KC-DP Gerät',createdAt:new Date().toISOString()};await K.storage?.put?.('multiDeviceIdentity',saved,{force:true});}
   state.identity=saved;return saved;
 }
 function deviceId(){return state.identity?.deviceId||null;}
 async function register(){const id=await identity();const rows=await K.supabaseConnection.registerDevice({device_id:id.deviceId,device_name:id.deviceName,platform:navigator.userAgentData?.platform||navigator.platform||'Browser',app_version:K.VERSION,status:'online',capabilities:{offlineQueue:true,encryptedEnvelope:true,conflictJournal:true}});return rows?.[0]||id;}
 async function refresh(){await register();[state.devices,state.runs,state.conflicts]=await Promise.all([K.supabaseConnection.listDevices(),K.supabaseConnection.listSyncTests(),K.supabaseConnection.listServerConflicts()]);return snapshot();}
 async function rename(name){const id=await identity();id.deviceName=String(name||'').trim()||id.deviceName;await K.storage.put('multiDeviceIdentity',id,{force:true});return register();}
 async function createRun(){const id=await identity(),probe=`SYNC-TEST-${Date.now()}`;const rows=await K.supabaseConnection.createSyncTest({title:'KC-DP Zwei-Geräte-Test',status:'waiting_second_device',current_step:'second_device',device_a:id.deviceId,probe_entity_id:probe,results:{deviceARegistered:true,createdAt:new Date().toISOString()}});await refresh();return rows?.[0];}
 async function joinRun(runId){const id=await identity();await K.supabaseConnection.updateSyncTest(runId,{device_b:id.deviceId,status:'running',current_step:'online_roundtrip',results:{joinedBy:id.deviceName,joinedAt:new Date().toISOString()}});return refresh();}
 async function queueOfflineProbe(runId){const run=state.runs.find(x=>x.id===runId);if(!run)throw new Error('Testlauf nicht gefunden.');const op=K.sync.enqueue({entity:'sync_test',operation:'update',baseVersion:null,payload:{id:run.probe_entity_id,runId,deviceId:deviceId(),value:`offline-${Date.now()}`,version:1}});await K.sync.whenDurable();await K.supabaseConnection.updateSyncTest(runId,{current_step:'offline_queued',results:{offlineQueued:true,operationId:op.operationId,queuedAt:new Date().toISOString()}});return op;}
 async function queueConflictProbe(runId){const run=state.runs.find(x=>x.id===runId);if(!run)throw new Error('Testlauf nicht gefunden.');const op=K.sync.enqueue({entity:'sync_test',operation:'update',baseVersion:0,payload:{id:run.probe_entity_id,runId,deviceId:deviceId(),value:`parallel-${Date.now()}`,version:1}});await K.sync.whenDurable();await K.supabaseConnection.updateSyncTest(runId,{status:'conflict_ready',current_step:'send_both_devices',results:{conflictChangeQueued:true,deviceId:deviceId(),queuedAt:new Date().toISOString()}});return op;}
 async function sendQueued(runId){const result=await K.sync.syncBoth();await K.supabaseConnection.updateSyncTest(runId,{status:result.pushed.failed?'failed':'passed',current_step:result.pushed.failed?'retry_required':'completed',completed_at:result.pushed.failed?null:new Date().toISOString(),results:{sent:result.pushed.sent,received:result.pulled.applied,conflicts:result.pulled.conflicts,pending:result.pushed.pending,checkedAt:new Date().toISOString()}});await refresh();return result;}
 function snapshot(){return clone({...state,identity:state.identity});}
 K.multiDeviceTest={version:'0.19.37',state,identity,deviceId,register,refresh,rename,createRun,joinRun,queueOfflineProbe,queueConflictProbe,sendQueued,snapshot};
 identity().catch(e=>state.lastError=e.message);
})();
