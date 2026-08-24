(function(){
  const K=window.KCDP=window.KCDP||{};
  let provider=typeof window.KCDPPCManagerProvider==='function'?window.KCDPPCManagerProvider:null;
  const plain=v=>String(v??'').replace(/[<>&"'`]/g,'').replace(/[\u0000-\u001F\u007F]/g,'').trim();
  const state={status:provider?'ready':'offline',source:provider?'pc_manager':'local_snapshot',lastSyncAt:null,lastError:null,lastBlock:null,records:K.people?.length||0};

  function normalize(row){
    const personId=String(row?.personId||row?.person_id||'').trim();if(!personId)throw new Error('personId fehlt.');
    const name=plain(row.name||row.clearName||row.displayName||row.display_name||'');if(!name)throw new Error(`Klarname fehlt für ${personId}.`);
    const helper=row.personType==='helper'||row.person_type==='helper'||row.isHelper===true||row.helper===true;
    return {
      personId,name,pseudoName:row.pseudoName==null?null:plain(row.pseudoName),personType:helper?'helper':'member',active:row.active!==false,
      skills:plain(Array.isArray(row.skills)?row.skills.join(' · '):(row.skills||row.qualifications||'')),
      phone:plain(row.phone||row.mobile||'nicht hinterlegt'),email:plain(row.email||row.contacts?.email||''),roles:Array.isArray(row.roles)?row.roles.map(plain):[],allowedAreas:Array.isArray(row.allowedAreas)?row.allowedAreas.map(plain):[],maxHours:Number(row.maxHours|| (helper?6:8)),
      availability:Array.isArray(row.availability)?row.availability.map(a=>({date:a.date,start:Number(a.start),end:Number(a.end)})):[],
      preferences:row.preferences&&typeof row.preferences==='object'?row.preferences:{},expanded:false
    };
  }
  function validateRows(rows){
    if(!Array.isArray(rows))throw new Error('PC-Manager muss eine Personenliste liefern.');
    const ids=new Set(),out=[];for(const raw of rows){const r=normalize(raw);if(ids.has(r.personId))throw new Error(`Doppelte personId: ${r.personId}`);ids.add(r.personId);out.push(r);}return out;
  }
  function referencedPersonIds(){
    const ids=new Set();
    const scan=list=>{for(const row of Array.isArray(list)?list:[]){const id=String(row?.personId||row?.person_id||'').trim();if(id)ids.add(id);}};
    scan(K.shifts);scan(K.wishes);scan(K.standby);scan(K.actualShifts);scan(K.replacements);scan(K.memberUxData?.colleaguePreferences);
    return [...ids].sort();
  }
  function publicationMeta(snapshot={}){
    const p=snapshot?.publication?.people||snapshot?.meta?.peoplePublication||snapshot?.peoplePublication||{};
    return {published:p.published===true||p.status==='published',complete:p.complete===true,version:Number(p.version||0)||null,raw:p};
  }
  function assessAuthoritativeSnapshot(rows,snapshot={}){
    let normalized;try{normalized=validateRows(rows);}catch(e){return {ok:false,code:'INVALID_PEOPLE',reason:e.message,missingPersonIds:[],normalized:null};}
    const publication=publicationMeta(snapshot);
    if(!publication.published||!publication.complete)return {ok:false,code:'NOT_PUBLISHED_COMPLETE',reason:'PC-Manager-Personendaten sind noch nicht vollständig freigegeben.',missingPersonIds:[],publication,normalized:null};
    const incoming=new Set(normalized.map(p=>p.personId));
    const missing=referencedPersonIds().filter(id=>!incoming.has(id));
    if(missing.length)return {ok:false,code:'REFERENCED_PERSON_MISSING',reason:`PC-Manager-Snapshot fehlt für verwendete personId: ${missing.join(', ')}`,missingPersonIds:missing,publication,normalized:null};
    if(!normalized.length&&(K.people||[]).length)return {ok:false,code:'EMPTY_REPLACEMENT',reason:'Leerer PC-Manager-Snapshot darf vorhandene Personendaten nicht ersetzen.',missingPersonIds:[],publication,normalized:null};
    return {ok:true,code:'READY',reason:null,missingPersonIds:[],publication,normalized};
  }
  function commitRows(normalized,{source='pc_manager'}={}){
    const localById=new Map((K.people||[]).map(p=>[p.personId,p]));
    K.people=normalized.map(p=>({...p,expanded:localById.get(p.personId)?.expanded||false}));
    state.status='ready';state.source=source;state.lastSyncAt=new Date().toISOString();state.lastError=null;state.lastBlock=null;state.records=K.people.length;
    return K.people;
  }
  function applySnapshot(rows,{source='pc_manager'}={}){return commitRows(validateRows(rows),{source});}
  function applyAuthoritativeSnapshot(rows,{source='pc_manager',snapshot={}}={}){
    const assessment=assessAuthoritativeSnapshot(rows,snapshot);
    if(!assessment.ok){state.status='blocked';state.lastError=null;state.lastBlock={at:new Date().toISOString(),code:assessment.code,reason:assessment.reason,missingPersonIds:assessment.missingPersonIds};return {applied:false,...assessment,people:K.people};}
    const people=commitRows(assessment.normalized,{source});
    return {applied:true,code:'APPLIED',publication:assessment.publication,people};
  }
  K.personAdapter={
    version:'0.19.42',state,
    setProvider(fn){provider=typeof fn==='function'?fn:null;state.status=provider?'ready':'offline';state.source=provider?'pc_manager':'local_snapshot';},
    hasProvider(){return !!provider;},validateRows,referencedPersonIds,publicationMeta,assessAuthoritativeSnapshot,applySnapshot,applyAuthoritativeSnapshot,
    async sync(){
      K.auth?.require?.('roster.people.sync','Sie dürfen Mitarbeiterdaten nicht synchronisieren.');
      if(!provider)throw new Error('PC-Manager-Provider ist nicht verbunden.');state.status='syncing';
      try{const res=await provider({action:'listPeople',contract:'KC_PERSON_REF_V1'});const rows=Array.isArray(res)?res:res?.people;const out=applyAuthoritativeSnapshot(rows,{source:'pc_manager',snapshot:Array.isArray(res)?{}:res});if(!out.applied){K.recordAudit?.('people.sync_blocked',{entity:'people',after:{code:out.code,missingPersonIds:out.missingPersonIds}});return out;}K.recordAudit?.('people.sync',{entity:'people',after:{count:out.people.length,source:'pc_manager'}});return out;}
      catch(e){state.status='error';state.lastError=e.message;throw e;}
    },
    view(personId,context='roster'){
      const p=K.person(personId);if(!p)return null;
      if(context==='pos')return {personId:p.personId,displayName:p.pseudoName||p.personId,personType:p.personType,active:p.active};
      if(context==='designer')return {personId:p.personId,displayName:p.name,active:p.active};
      if(context==='manager')return {personId:p.personId,name:p.name,pseudoName:p.pseudoName,personType:p.personType,active:p.active,skills:p.skills,phone:p.phone,email:p.email,roles:p.roles,allowedAreas:p.allowedAreas,availability:p.availability};
      return {personId:p.personId,displayName:p.name,personType:p.personType,active:p.active,skills:p.skills};
    },
    test(){const rows=validateRows(K.people||[]);return {ok:true,count:rows.length,helpers:rows.filter(p=>p.personType==='helper').length,pseudonyms:rows.filter(p=>p.pseudoName).length,referenced:referencedPersonIds().length};}
  };
})();
