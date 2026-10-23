(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{}, JOURNAL='cloudPrimaryPendingV1';
  const localOnly=new Set(['integrationConfig','supabaseSession','syncOutbox','syncConflicts','syncMeta','pushSubscriptions']);
  const state={status:'loading',version:null,pending:0,error:null,source:null};
  let queue=[],context=null,ready=false,tail=Promise.resolve(),lastData=null,journalNamespace=null,legacySequence=0,owner=null,ownerScope=null,migrationInventory=null,joinPreview=null;
  const clone=x=>JSON.parse(JSON.stringify(x));
  function enabled(){return !!K.workMode&&['admin','planner','duty_manager'].includes(K.currentUser?.role);}
  function fail(message,code){return Object.assign(new Error(message),{code});}
  function network(e){return !!e?.transport||e?.name==='AbortError'||[500,502,503,504].includes(e?.status);}
  function identity(){return K.supabaseConnection.state?.userId||null;}
  function scope(){const c=K.integrationConfig?.supabase||{};return JSON.stringify([c.url||'',c.orgId||'',c.projectId||'']);}
  function requireOwner(){if(identity()!==owner||scope()!==ownerScope){const e=fail('Die Anmeldung oder das Projekt hat gewechselt. Bitte den Serverstand neu laden.','OWNER_CHANGED');status('blocked',e);throw e;}}
  function status(value,error=null){state.status=value;state.error=error?.message||error;state.pending=queue.length;K.cloudPrimaryUi?.update?.();}
  async function key(){return context||(context=await K.supabaseConnection.getSyncKey());}
  async function read(){const c=await key();const row=await K.supabaseConnection.workspaceRead(c.namespace);
    if(row?.status==='legacy_changed')throw fail('Ein älterer DP2-PC hat nach der Umstellung Daten übertragen. Bitte diese Angaben prüfen; sie werden nicht überschrieben.','CONFLICT');
    if(row?.status==='empty'&&row.version===0){legacySequence=row.legacySequence;return {version:0,data:null};}
    if(row?.status!=='ok'||!Number.isSafeInteger(row.version)||row.version<1||!row.envelope)throw fail('Ungültige Antwort des zentralen Planungsspeichers.','BAD_ACK');
    const value=await KCSecureSync.decryptEnvelope(row.envelope,{secret:c.secret,projectId:c.namespace});
    if(value?.schema!=='KC_DP_WORKSPACE_V1'||!value.data||typeof value.data!=='object')throw fail('Zentraler Planungsstand ist nicht lesbar.','BAD_DATA');
    return {version:row.version,data:value.data};
  }
  async function durable(){await K.storage.put(JOURNAL,{schema:'KC_DP_OFFLINE_V1',owner,scope:ownerScope,namespace:context?.namespace||journalNamespace,version:state.version,queue:clone(queue)});}
  async function drain(){
    const hadOfflineJournal=queue.some(item=>item.durable);
    while(queue.length){const item=queue[0];if(item.baseVersion==null)item.baseVersion=state.version;
      const c=await key();if(!item.envelope)item.envelope=await KCSecureSync.encryptEnvelope({schema:'KC_DP_WORKSPACE_V1',data:item.data},{secret:c.secret,projectId:c.namespace,aad:'KC_DP_WORKSPACE_V1'});
      // An offline request is durably updated BEFORE retrying it. Its ID and ciphertext never change.
      if(item.durable)await durable();
      const ack=await K.supabaseConnection.workspaceSave(c.namespace,item.id,item.baseVersion,item.envelope,item.legacySequence??legacySequence);
      if(ack?.status==='conflict')throw fail('Ein anderer PC hat inzwischen gespeichert. Deine Eingaben bleiben gesichert; bitte die Stände vergleichen.','CONFLICT');
      if(ack?.status!=='ok'||ack.operationId!==item.id||ack.version!==item.baseVersion+1||!Number.isSafeInteger(ack.currentVersion))throw fail('Supabase hat das Speichern nicht eindeutig bestätigt.','BAD_ACK');
      queue.shift();state.version=ack.version;lastData=clone(item.data);
      if(ack.currentVersion!==ack.version){await durable();throw fail('Die eigene Speicherung wurde bestätigt, danach hat ein anderer PC gespeichert. Bitte Serverstand neu laden.','CONFLICT');}
    }
    if(hadOfflineJournal)await K.storage.remove(JOURNAL);status('saved');return {cloud:true,confirmed:true,version:state.version};
  }
  async function load(keys){
    owner=identity();ownerScope=scope();
    const stored=await K.storage.get(JOURNAL);
    if(stored?.schema==='KC_DP_OFFLINE_V1'){
      if(stored.owner!==owner||stored.scope!==ownerScope)throw fail('Die Ausfallsicherung gehört zu einer anderen Anmeldung oder einem anderen Projekt. Bitte deren Übertragung zuerst klären.','OWNER_CHANGED');
      queue=clone(stored.queue||[]);state.version=stored.version;
      journalNamespace=stored.namespace;
    }
    let remote;
    try{const c=await key();if(stored?.namespace&&stored.namespace!==c.namespace)throw fail('Die lokale Ausfallsicherung gehört zu einer anderen Datenbankgeneration.','GENERATION');remote=await read();}catch(e){
      if(!network(e)||!queue.length){status('blocked',e);throw e;}
      ready=true;state.source='journal';status('offline',e);return values(keys,queue.at(-1).data);
    }
    if(queue.length){
      try{await drain();remote=await read();}catch(e){state.source='journal';if(e.code==='CONFLICT'&&remote.version===0){ready=false;migrationInventory=null;status('migration',e);return values(keys,queue.at(-1).data);}ready=true;status(e.code==='CONFLICT'?'conflict':network(e)?'offline':'blocked',e);if(state.status==='blocked')throw e;return values(keys,queue.at(-1)?.data||lastData);}
    }
    state.version=remote.version;
    if(!remote.data){state.source='legacy';status('migration');throw fail('Die zentrale Arbeitsdatenbank benötigt einen geprüften Ausgangsstand. Vorhandene PC-Daten werden nicht automatisch übertragen oder gelöscht.','MIGRATION_REQUIRED');}
    const joined=await K.storage.get('cloudPrimaryJoinedV1');
    if(joined?.namespace!==context.namespace){
      const legacyValues=await K.storage.getMany(keys),legacy=Object.fromEntries(keys.map((k,i)=>[k,legacyValues[i]]).filter(([k])=>!localOnly.has(k)));
      if(['wishes','shifts','standby','syncOutbox','syncConflicts'].some(k=>Array.isArray(legacyValues[keys.indexOf(k)])&&legacyValues[keys.indexOf(k)].length)){
        joinPreview={remoteVersion:remote.version,remote:clone(remote.data),local:clone(legacy)};state.source='legacy';status('join');throw fail('Dieser PC hat noch einen bisherigen lokalen Planungsstand. Vor dem Laden des zentralen Stands muss er gesichert und bestätigt werden.','JOIN_REQUIRED');
      }
      await markJoined();
    }
    ready=true;state.source='server';lastData=clone(remote.data);status('saved');return values(keys,remote.data);
  }
  async function values(keys,data){return Promise.all(keys.map(k=>localOnly.has(k)?K.storage.get(k):clone(data?.[k]??null)));}
  function serial(fn){const next=tail.then(fn,fn);tail=next.catch(()=>{});return next;}
  function save(entries){return serial(async()=>{
    requireOwner();
    if(!ready||!Number.isSafeInteger(state.version)||state.version<1)throw fail('Zentraler Planungsstand ist noch nicht freigegeben.','NOT_READY');
    const data=Object.fromEntries(entries.filter(([k])=>!localOnly.has(k)).map(([k,v])=>[k,clone(v??null)]));
    if(state.status==='conflict'||state.status==='blocked'){queue.push({id:crypto.randomUUID(),baseVersion:null,data,durable:true});await durable();throw fail('Speicherkonflikt zuerst prüfen. Vorhandene Eingaben sind lokal gesichert.','CONFLICT');}
    queue.push({id:crypto.randomUUID(),baseVersion:queue.length?null:state.version,data,durable:false});status('saving');
    try{return await drain();}catch(e){
      queue.forEach(x=>x.durable=true);try{await durable();}catch(localError){status('blocked',localError);throw fail('Weder Serverbestätigung noch lokale Ausfallsicherung möglich. Dieses Fenster offen lassen: '+localError.message,'LOCAL_FAILURE');}
      status(e.code==='CONFLICT'?'conflict':network(e)?'offline':'blocked',e);
      if(state.status!=='offline')throw e;
      return {cloud:false,confirmed:false,offline:true,pending:queue.length};
    }
  });}
  function reconnect(){return serial(async()=>{
    requireOwner();
    if(!ready)return {skipped:true};if(state.status==='conflict'||state.status==='blocked')return {conflict:true};
    try{if(queue.length)return await drain();const remote=await read();if(remote.version!==state.version){status('conflict','Der Serverstand wurde von einem anderen PC geändert. Bitte neu laden, bevor du weiter eingibst.');return {conflict:true};}return {confirmed:true};}
    catch(e){status(network(e)?'offline':e.code==='CONFLICT'?'conflict':'blocked',e);throw e;}
  });}
  async function initialize(entries,{confirmed=false}={}){
    requireOwner();
    if(!confirmed||state.status!=='migration')throw fail('Ausgangsstand wurde nicht bestätigt.','NOT_READY');
    if((K.syncConflicts||[]).some(x=>x.status==='open'))throw fail('Offene PC-/Server-Konflikte müssen vor der Umstellung entschieden werden.','CONFLICT');
    if(!migrationInventory)throw fail('Den bisherigen Serverbestand vor der Übernahme prüfen.','MIGRATION_REVIEW');
    const present=Object.fromEntries(entries);
    for(const [collection,records] of Object.entries(migrationInventory.collections))for(const row of records){if(!(present[collection]||[]).some(local=>local.id===row.id))throw fail('Im Serverbestand sind weitere Angaben vorhanden. Diese zuerst ergänzen.','MIGRATION_REVIEW');}
    state.version=0;ready=true;
    const data=Object.fromEntries(entries.filter(([k])=>!localOnly.has(k)));data.migrationLegacyInventory=migrationInventory;
    queue=[{id:crypto.randomUUID(),baseVersion:0,legacySequence:migrationInventory.legacySequence,data:clone(data),durable:false}];
    try{const result=await drain();await markJoined();return result;}catch(e){ready=false;queue.forEach(x=>x.durable=true);await durable();status('blocked',e);throw e;}
  }
  async function markJoined(){
    const outbox=await K.storage.get('syncOutbox')||[],conflicts=await K.storage.get('syncConflicts')||[];
    await K.storage.putMany([['cloudPrimaryJoinedV1',{namespace:context.namespace,version:state.version,at:new Date().toISOString()}],['syncOutbox',outbox.map(op=>['pending','sending','conflict','club_pending'].includes(op.status)?{...op,status:'workspace_archived'}:op)],['syncConflicts',conflicts.map(c=>c.status==='open'?{...c,status:'workspace_archived'}:c)]]);
  }
  async function joinServer(preview,{confirmed=false}={}){
    requireOwner();if(!confirmed||state.status!=='join'||JSON.stringify(preview)!==JSON.stringify(joinPreview))throw fail('Der PC-Abgleich wurde nicht bestätigt.','NOT_READY');
    const remote=await read();if(remote.version!==preview.remoteVersion)throw fail('Der Serverstand hat sich inzwischen geändert. Bitte erneut laden und vergleichen.','CONFLICT');
    await K.storage.put('cloudPrimaryLegacyJoinV1',{at:new Date().toISOString(),owner,namespace:context.namespace,preview:clone(preview)});await markJoined();return {reload:true};
  }
  async function inspectMigration(){
    requireOwner();if(state.status!=='migration')throw fail('Keine offene Umstellung vorhanden.','NOT_READY');
    const remote=await read();if(remote.version!==0)throw fail('Ein anderer PC hat die Umstellung bereits durchgeführt. Bitte neu laden.','CONFLICT');
    const c=await key(),head=legacySequence,latest=new Map();let cursor=0,pages=0;
    while(cursor<head){if(++pages>100)throw fail('Der Serverbestand ist für diesen Prüflauf zu groß. Es wird nichts übertragen.','MIGRATION_REVIEW');
      const rows=await K.supabaseConnection.workspaceLegacy(c.namespace,cursor,head);if(!rows.length)throw fail('Der bisherige Serverbestand ist unvollständig gelesen worden.','BAD_DATA');
      for(const row of rows){const op=await KCSecureSync.decryptEnvelope(row.envelope,{secret:c.secret,projectId:c.namespace});if(!op?.entity||!op.payload)throw fail('Ein bisheriger Serverdatensatz konnte nicht zugeordnet werden.','BAD_DATA');const id=op.payload.id||op.payload.date||op.payload.personId||op.entityId;if(!id)throw fail('Serverdatensatz ohne Kennung.','BAD_DATA');latest.set(op.entity+':'+id,{...op,remoteVersion:row.remote_version});}
      const next=Number(rows.at(-1).seq);if(next<=cursor)throw fail('Serverbestand konnte nicht vollständig geprüft werden.','BAD_DATA');cursor=next;
    }
    const collections={wishes:[],shifts:[],standby:[]},map={wish:'wishes',shift:'shifts',standby:'standby'};
    for(const op of latest.values())if(map[op.entity]&&op.operation!=='delete'&&!['deleted','cancelled'].includes(op.payload.status))collections[map[op.entity]].push(clone(op.payload));
    migrationInventory={legacySequence:head,collections,latestOperations:[...latest.values()]};return clone(migrationInventory);
  }
  async function review(){requireOwner();if(state.status!=='conflict'||!queue.length)throw fail('Kein vergleichbarer Speicherkonflikt vorhanden.','NOT_READY');const remote=await read();return {remoteVersion:remote.version,remote:clone(remote.data),local:clone(queue.at(-1).data)};}
  function resolve(choice,preview){return serial(async()=>{
    requireOwner();if(!['local','remote'].includes(choice)||!preview||state.status!=='conflict')throw fail('Konfliktentscheidung fehlt.','NOT_READY');
    const now=await review();if(JSON.stringify(now)!==JSON.stringify(preview))throw fail('Die Stände wurden inzwischen geändert. Bitte erneut vergleichen.','CONFLICT');
    const history=await K.storage.get('cloudPrimaryReviewedHistoryV1')||[];
    await K.storage.put('cloudPrimaryReviewedHistoryV1',[...history,{at:new Date().toISOString(),choice,owner,version:state.version,queue:clone(queue),remoteVersion:now.remoteVersion}]);
    state.version=now.remoteVersion;
    if(choice==='remote'){queue=[];lastData=clone(now.remote);await K.storage.remove(JOURNAL);status('saved');return {reload:true};}
    queue=[{id:crypto.randomUUID(),baseVersion:now.remoteVersion,data:clone(now.local),durable:true}];await durable();
    try{return await drain();}catch(e){status(network(e)?'offline':e.code==='CONFLICT'?'conflict':'blocked',e);throw e;}
  });}
  async function confirmedSnapshot(){requireOwner();if(!ready||state.status!=='saved'||queue.length)throw fail('Bitte zuerst die Änderungen in Supabase speichern und offene Übertragungen bzw. Konflikte klären.','NOT_READY');const remote=await read();if(remote.version!==state.version)throw fail('Der Serverstand wurde inzwischen geändert. Bitte DP2 neu laden und danach drucken.','CONFLICT');return {data:clone(remote.data),version:remote.version};}
  K.cloudPrimary={enabled,active:()=>enabled()&&ready,state,load,save,reconnect,initialize,inspectMigration,joinPreview:()=>clone(joinPreview),joinServer,review,resolve,confirmedSnapshot,isNetworkError:network,localOnly};
})();
