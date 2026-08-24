(function(){
  const K=window.KCDP=window.KCDP||{};
  const managerSource=s=>/pc_manager|supabase_core_manager|manager/i.test(String(s||''));
  function dayBy(input){if(input?.date)return input;if(typeof input==='string')return (K.days||[]).find(d=>d.date===input)||null;return (K.days||[])[Number(K.state?.dateIndex||0)]||null;}
  function snapshot(inputDay=null){
    const day=dayBy(inputDay),ps=K.personAdapter?.state||{},ms=K.pcManagerConnection?.state||{},as=K.managerAutoSync?.state||{},autoEnabled=K.integrationConfig?.pcManager?.autoSync===true,peopleAuthoritative=managerSource(ps.source)&&ps.status==='ready',managerReady=ms.status==='ready',managerPartial=ms.status==='partial'||ms.status==='blocked',weather=day?.weather||{},program=Array.isArray(day?.program)?day.program:[],weatherSource=String(weather.source||''),weatherManager=managerSource(weatherSource)||(managerReady&&!!weather.fetchedAt),programManager=managerReady&&program.length>0;
    const people={status:ps.status||'unknown',source:ps.source||'unknown',records:Number(ps.records??K.people?.length??0),authoritative:peopleAuthoritative,lastSyncAt:ps.lastSyncAt||null,block:ps.lastBlock||null};
    const manager={status:ms.status||'offline',mode:ms.mode||null,source:ms.lastSource||null,lastSyncAt:ms.lastSyncAt||null,block:ms.lastBlock||null,ready:managerReady,partial:managerPartial};
    const autoSync={enabled:autoEnabled,status:autoEnabled?(as.status||'idle'):'disabled',lastAttemptAt:as.lastAttemptAt||null,lastSuccessAt:as.lastSuccessAt||null,lastReason:as.lastReason||null,lastError:as.lastError||null,persisted:!!as.persisted};
    const context={status:managerReady?'manager':managerPartial?'partial':'local',weather:{present:!!Object.keys(weather).length,source:weatherSource||'lokal',manager:weatherManager},program:{count:program.length,manager:programManager},authoritative:managerReady&&(weatherManager||programManager)};
    const overall=peopleAuthoritative&&managerReady?'authoritative':peopleAuthoritative||managerPartial?'mixed':'local';
    return {version:'0.19.42',day:day?.date||null,overall,people,manager,autoSync,context,checkedAt:new Date().toISOString()};
  }
  function label(s){return s.overall==='authoritative'?'PC-Manager/KC-Core führend':s.overall==='mixed'?'Gemischte Datenquellen':'Lokaler Fallback aktiv';}
  K.sourceHealth={version:'0.19.42',snapshot,label,managerSource};
})();
