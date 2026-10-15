// KICC-F-100 Phase 7 (DP2-F-SE-07): Zusagen zu Sondereinsätzen und Fahrgemeinschaften.
// Mitglieder sagen zu (ja/vielleicht/nein) und geben die Anreise an: Ich fahre (freie Plätze) / Ich brauche eine
// Mitfahrgelegenheit / Ich komme anders hin – dazu nur den Startort (Auswahl, keine Adresse). Vorrangig werden
// Fahrgemeinschaften gebildet (Betreiber 2026-10-15): DP2 schlägt sie vor (gleicher Startort zuerst), der Planer
// übernimmt und veröffentlicht. Die Fahrtrolle (Fahrer/Mitfahrer) wird bei der Stundenmeldung vorbelegt.
// Transport austauschbar (AGENTS 18): K.signupTransport.save (Club App → kc-club) oder lokal.
(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const VERSION='0.1.0';
  const ANSWERS=['ja','vielleicht','nein'],TRAVEL=['fahrer','mitfahrer','selbst'],MAX_SEATS=8;
  K.specialEventSignups=Array.isArray(K.specialEventSignups)?K.specialEventSignups:[];
  K.carpools=Array.isArray(K.carpools)?K.carpools:[];
  // Startorte als austauschbare Auswahl (AGENTS 4/13) – nur Orte, keine Adressen.
  K.carpoolPlaces=Array.isArray(K.carpoolPlaces)?K.carpoolPlaces:['Werne','Hamm','Bergkamen','Kamen','Unna','Lünen','Selm','Bork','Nordkirchen','Ascheberg','Dortmund','Anderer Ort'];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const self=()=>K.currentUser?.personId||null;
  const name=id=>K.person?.(id)?.name||id;
  const listeners=new Set();const notify=()=>listeners.forEach(fn=>{try{fn()}catch(_){}});

  function normalize(input={}){
    const antwort=ANSWERS.includes(input.antwort)?input.antwort:null;
    const anreise=antwort&&antwort!=='nein'&&TRAVEL.includes(input.anreise)?input.anreise:null;
    const seats=Number(input.plaetze);
    return {antwort,anreise,plaetze:anreise==='fahrer'&&Number.isInteger(seats)?Math.max(0,Math.min(MAX_SEATS,seats)):0,
      startort:anreise&&anreise!=='selbst'&&K.carpoolPlaces.includes(input.startort)?input.startort:null,bemerkung:String(input.bemerkung||'').trim().slice(0,300)};
  }
  function validate(specialEventId,input){
    const e=[],ev=K.specialEventsCore?.get?.(specialEventId),n=normalize(input);
    if(!ev||ev.aktiv===false)e.push('Bitte einen Sondereinsatz aus der Liste wählen.');
    if(!n.antwort)e.push('Bitte angeben, ob du helfen kannst.');
    if(n.antwort&&n.antwort!=='nein'&&!n.anreise)e.push('Bitte angeben, wie du hinkommst.');
    if((n.anreise==='fahrer'||n.anreise==='mitfahrer')&&!n.startort)e.push('Bitte den Startort wählen.');
    return e;
  }
  function mine(specialEventId,personId=self()){return K.specialEventSignups.find(s=>s.specialEventId===specialEventId&&s.personId===personId)||null;}
  function forEvent(specialEventId){return K.specialEventSignups.filter(s=>s.specialEventId===specialEventId);}
  function counts(specialEventId){const l=forEvent(specialEventId);return {ja:l.filter(s=>s.antwort==='ja').length,vielleicht:l.filter(s=>s.antwort==='vielleicht').length,nein:l.filter(s=>s.antwort==='nein').length,fahrer:l.filter(s=>s.antwort!=='nein'&&s.anreise==='fahrer').length,mitfahrer:l.filter(s=>s.antwort!=='nein'&&s.anreise==='mitfahrer').length,plaetze:l.filter(s=>s.antwort!=='nein'&&s.anreise==='fahrer').reduce((n,s)=>n+Number(s.plaetze||0),0)};}

  function merge(rows){let n=0;for(const r of rows||[]){if(!r?.specialEventId||!r.personId)continue;const i=K.specialEventSignups.findIndex(x=>x.specialEventId===r.specialEventId&&x.personId===r.personId);if(i<0){K.specialEventSignups.push(clone(r));n++;}else if(Number(r.version||0)>=Number(K.specialEventSignups[i].version||0)){K.specialEventSignups[i]={...K.specialEventSignups[i],...clone(r)};n++;}}if(n)notify();return n;}
  function fromRemote(r){return {id:String(r.id||''),specialEventId:r.special_event_id||r.specialEventId,personId:r.person_id||r.personId,antwort:r.antwort,anreise:r.anreise||null,plaetze:Number(r.plaetze||0),startort:r.startort||null,bemerkung:r.bemerkung||'',version:Number(r.version||1),updatedAt:r.updated_at||r.updatedAt||null};}

  async function answer(specialEventId,input){
    if(!self())throw new Error('Bitte zuerst anmelden.');
    const errors=validate(specialEventId,input);if(errors.length)throw new Error(errors.join(' '));
    const n=normalize(input),old=mine(specialEventId);
    if(K.signupTransport?.save){const r=await K.signupTransport.save({specialEventId,...n});merge([r?.row?fromRemote(r.row):{specialEventId,personId:self(),...n,version:Number(old?.version||0)+1}]);return mine(specialEventId);}
    const row={id:old?.id||`SU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,specialEventId,personId:self(),...n,version:Number(old?.version||0)+1,updatedAt:new Date().toISOString()};
    merge([row]);K.recordAudit?.('special_event.signup',{entity:'special_event_signup',entityId:row.id,before:old?clone(old):null,after:row});
    K.sync?.enqueue?.({entity:'special_event_signup',operation:old?'update':'create',payload:clone(row),baseVersion:old?.version??null});
    try{await K.persistAll?.();}catch(_){}
    return row;
  }

  // Vorschlag: Fahrer mit freien Plätzen, Mitfahrer zuerst nach gleichem Startort, dann Rest auffüllen.
  function suggest(specialEventId){
    const l=forEvent(specialEventId).filter(s=>s.antwort!=='nein');
    const drivers=l.filter(s=>s.anreise==='fahrer').map(s=>({sourceId:`CP-${s.personId}`,fahrerId:s.personId,startort:s.startort,frei:Number(s.plaetze||0),mitfahrer:[]}));
    const riders=l.filter(s=>s.anreise==='mitfahrer').sort((a,b)=>(a.antwort==='ja'?0:1)-(b.antwort==='ja'?0:1)||String(name(a.personId)).localeCompare(String(name(b.personId)),'de'));
    const open=[];
    for(const r of riders){const same=drivers.filter(d=>d.startort===r.startort&&d.mitfahrer.length<d.frei).sort((a,b)=>(b.frei-b.mitfahrer.length)-(a.frei-a.mitfahrer.length))[0];if(same)same.mitfahrer.push(r.personId);else open.push(r);}
    const ohne=[];
    for(const r of open){const any=drivers.filter(d=>d.mitfahrer.length<d.frei).sort((a,b)=>(b.frei-b.mitfahrer.length)-(a.frei-a.mitfahrer.length))[0];if(any)any.mitfahrer.push(r.personId);else ohne.push(r.personId);}
    return {groups:drivers.map(({frei,...g})=>({...g,plaetze:frei})),ohneFahrt:ohne};
  }
  function carpoolsFor(specialEventId){return K.carpools.filter(c=>c.specialEventId===specialEventId&&c.status!=='removed');}
  function roleFor(specialEventId,personId){const c=carpoolsFor(specialEventId);if(c.some(x=>x.fahrerId===personId))return 'fahrer';if(c.some(x=>(x.mitfahrer||[]).includes(personId)))return 'mitfahrer';const s=mine(specialEventId,personId);return s?.anreise==='fahrer'?'fahrer':s?.anreise==='mitfahrer'?'mitfahrer':null;}
  function carpoolOf(specialEventId,personId=self()){return carpoolsFor(specialEventId).find(c=>c.fahrerId===personId||(c.mitfahrer||[]).includes(personId))||null;}

  async function saveCarpools(specialEventId,groups){
    K.auth?.require?.('roster.plan.edit','Sie dürfen Fahrgemeinschaften nicht festlegen.');
    const seen=new Set(),rows=[];
    for(const g of groups||[]){
      if(!g?.fahrerId)continue;const mit=[...new Set((g.mitfahrer||[]).filter(x=>x&&x!==g.fahrerId))];
      for(const p of [g.fahrerId,...mit]){if(seen.has(p))throw new Error(`${name(p)} ist in mehreren Fahrgemeinschaften.`);seen.add(p);}
      if(mit.length>MAX_SEATS)throw new Error(`Zu viele Mitfahrer bei ${name(g.fahrerId)}.`);
      rows.push({sourceId:g.sourceId||`CP-${g.fahrerId}`,specialEventId,fahrerId:g.fahrerId,mitfahrer:mit,startort:g.startort||null,status:'published'});
    }
    const before=clone(carpoolsFor(specialEventId));
    K.carpools=K.carpools.filter(c=>c.specialEventId!==specialEventId).concat(rows);
    K.recordAudit?.('special_event.carpools',{entity:'carpool',entityId:specialEventId,before,after:rows});
    K.sync?.enqueue?.({entity:'carpool_set',operation:'update',payload:{id:specialEventId,specialEventId,rows:clone(rows)},baseVersion:null});
    notify();try{await K.persistAll?.();}catch(_){}
    if(K.supabaseConnection?.publishCarpools)await K.supabaseConnection.publishCarpools({eventId:K.eventConfig?.eventId||'KC-WM-2026',specialEventId,rows});
    return rows;
  }
  async function pull(){
    if(!K.supabaseConnection?.signupsList)throw new Error('Supabase-Verbindung nicht bereit.');
    const rows=await K.supabaseConnection.signupsList({eventId:K.eventConfig?.eventId||'KC-WM-2026'});
    return {received:(rows||[]).length,changed:merge((rows||[]).map(fromRemote))};
  }
  function restore(saved){if(saved&&typeof saved==='object'){if(Array.isArray(saved.signups))K.specialEventSignups=saved.signups;if(Array.isArray(saved.carpools))K.carpools=saved.carpools;}notify();}
  function snapshot(){return clone({signups:K.specialEventSignups,carpools:K.carpools});}

  K.specialEventSignupsCore={VERSION,ANSWERS,TRAVEL,MAX_SEATS,normalize,validate,mine,forEvent,counts,answer,merge,fromRemote,suggest,carpoolsFor,carpoolOf,roleFor,saveCarpools,pull,restore,snapshot,onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
})();
