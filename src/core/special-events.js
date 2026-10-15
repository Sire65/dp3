// DP2-F-SE-01 Sondereinsätze (KICC-F-100, Phase 1): Einsätze außerhalb des Stands, deren Stunden dem
// Stundenkonto der Veranstaltung (z. B. Weihnachtsmarkt) gutgeschrieben werden – z. B. Grünkohl kochen im
// Krankenhaus, Abholung und Transport zum Tiefkühler, Getränke mischen zuhause.
// Termin darf offen sein (OFFEN → GEPLANT → FEST). Ein Einsatz kann einem anderen mit Abstand in Tagen folgen
// („Abholung = Kochtermin + 2 Tage“); sein Datum wird immer aus dem Vorgänger berechnet, nie doppelt gespeichert.
// Rein additiv: K.days, Bedarf und Standbesetzung bleiben unverändert.
// Build 290 (DP2-F-SE-08): vorläufige Einteilung „vorgesehen“ (nur Mitglieder) und Abgleich mit dem veröffentlichten Stand
// in Supabase (pull), damit dort eingetragene Einsätze beim nächsten Veröffentlichen nicht verloren gehen.
(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const VERSION='0.2.0';
  const TERMIN=['OFFEN','GEPLANT','FEST'];
  const RECURRING=['markttage'];
  const MAX_FOLLOW_DEPTH=10,MAX_GAP_DAYS=60,MAX_PLANNED=30,MAX_TITLE=120,MAX_PLACE=120,MAX_NOTE=500;
  K.specialEvents=Array.isArray(K.specialEvents)?K.specialEvents:[];
  // Auswahl statt Freitext (AGENTS 13); austauschbare Liste statt fest verdrahteter Logik (AGENTS 4).
  K.specialEventKinds=Array.isArray(K.specialEventKinds)?K.specialEventKinds:[
    {id:'kochen',label:'Kochen'},
    {id:'transport',label:'Abholung / Transport'},
    {id:'vorbereitung_zuhause',label:'Vorbereitung zuhause'},
    {id:'einkauf',label:'Einkauf / Besorgung'},
    {id:'aufbau_abbau',label:'Aufbau / Abbau'},
    {id:'sonstiges',label:'Sonstiges'}
  ];

  const clone=v=>JSON.parse(JSON.stringify(v));
  const text=(v,max)=>String(v??'').trim().slice(0,max);
  const isoDate=v=>{const s=String(v||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const d=new Date(s+'T12:00:00Z');return Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==s?null:s;};
  const addDays=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const daysBetween=(a,b)=>Math.round((new Date(b+'T12:00:00Z')-new Date(a+'T12:00:00Z'))/86400000);
  const byId=id=>K.specialEvents.find(e=>e.id===id)||null;
  const kindLabel=id=>K.specialEventKinds.find(k=>k.id===id)?.label||id;
  const nowIso=()=>new Date().toISOString();
  const actor=()=>K.currentUser?.personId||null;
  const requireEdit=()=>K.auth?.require?.('roster.plan.edit','Sie dürfen Sondereinsätze nicht bearbeiten.');

  function normalize(input={}){
    const gap=Number(input.abstandTage);
    return {
      titel:text(input.titel,MAX_TITLE),
      ort:text(input.ort,MAX_PLACE),
      art:text(input.art,40)||'sonstiges',
      terminStatus:TERMIN.includes(String(input.terminStatus||'').toUpperCase())?String(input.terminStatus).toUpperCase():'OFFEN',
      datumVon:isoDate(input.datumVon),
      datumBis:isoDate(input.datumBis),
      folgtAuf:text(input.folgtAuf,80)||null,
      abstandTage:input.folgtAuf?(Number.isInteger(gap)?gap:0):null,
      wiederkehrend:RECURRING.includes(input.wiederkehrend)?input.wiederkehrend:null,
      bemerkung:text(input.bemerkung,MAX_NOTE),
      vorgesehen:[...new Set((Array.isArray(input.vorgesehen)?input.vorgesehen:[]).map(v=>String(v??'').trim()).filter(Boolean))]
    };
  }

  // Eingegebenes, aber ungültiges Datum nie stillschweigend verwerfen.
  function badDates(input={}){return ['datumVon','datumBis'].filter(k=>input[k]!=null&&String(input[k]).trim()!==''&&!isoDate(input[k])).length?['Bitte ein gültiges Datum angeben.']:[];}

  // Liefert Vorgänger-Kette; wirft bei Zyklus oder fehlendem Vorgänger.
  function chain(ev,list=K.specialEvents){
    const seen=new Set([ev.id]),out=[];let cur=ev;
    while(cur.folgtAuf){
      if(seen.has(cur.folgtAuf))throw new Error('Sondereinsätze dürfen sich nicht im Kreis aufeinander beziehen.');
      const parent=list.find(e=>e.id===cur.folgtAuf);
      if(!parent)throw new Error('Der Vorgänger-Einsatz wurde nicht gefunden.');
      out.push(parent);seen.add(parent.id);cur=parent;
      if(out.length>MAX_FOLLOW_DEPTH)throw new Error('Zu viele verkettete Sondereinsätze.');
    }
    return out;
  }

  function validate(ev,list=K.specialEvents){
    const errors=[];
    if(!ev.titel)errors.push('Bitte einen Titel angeben.');
    if(!K.specialEventKinds.some(k=>k.id===ev.art))errors.push('Bitte eine Art aus der Liste wählen.');
    if((ev.vorgesehen||[]).length>MAX_PLANNED)errors.push(`Höchstens ${MAX_PLANNED} Personen vorsehen.`);
    if((K.people||[]).length){const bad=(ev.vorgesehen||[]).filter(id=>{const p=K.person?.(id)||(K.people||[]).find(x=>x.personId===id);return !p||p.active===false||(p.personType&&p.personType!=='member');});if(bad.length)errors.push(`Nur aktive Mitglieder können vorgesehen werden (${bad.join(', ')}).`);}
    if(ev.folgtAuf&&ev.wiederkehrend)errors.push('Ein Einsatz kann nicht gleichzeitig wiederkehrend sein und einem anderen folgen.');
    if(ev.folgtAuf){
      if(!Number.isInteger(ev.abstandTage)||ev.abstandTage<0||ev.abstandTage>MAX_GAP_DAYS)errors.push(`Der Abstand muss zwischen 0 und ${MAX_GAP_DAYS} Tagen liegen.`);
      try{chain(ev,list.some(e=>e.id===ev.id)?list.map(e=>e.id===ev.id?ev:e):[...list,ev]);}catch(e){errors.push(e.message);}
    }else if(!ev.wiederkehrend){
      if(ev.terminStatus==='FEST'&&!ev.datumVon)errors.push('Ein fester Termin braucht ein Datum.');
      if(ev.datumBis&&!ev.datumVon)errors.push('Bitte zuerst das Anfangsdatum angeben.');
      if(ev.datumVon&&ev.datumBis&&ev.datumBis<ev.datumVon)errors.push('Das Enddatum liegt vor dem Anfangsdatum.');
    }
    return errors;
  }

  // Wirksamer Termin: bei Folge-Einsätzen aus dem Vorgänger berechnet, bei wiederkehrenden aus den Markttagen.
  function effective(ev,list=K.specialEvents){
    if(ev.wiederkehrend==='markttage'){
      const dates=(K.days||[]).filter(d=>d.type==='market').map(d=>d.date).sort();
      return {terminStatus:dates.length?'FEST':'OFFEN',datumVon:dates[0]||null,datumBis:dates.at(-1)||null,dates,derivedFrom:null};
    }
    if(!ev.folgtAuf){
      const von=ev.datumVon||null,bis=ev.datumBis||von;
      return {terminStatus:ev.terminStatus,datumVon:von,datumBis:bis,dates:von?range(von,bis):[],derivedFrom:null};
    }
    let parents;try{parents=chain(ev,list);}catch(_){return {terminStatus:'OFFEN',datumVon:null,datumBis:null,dates:[],derivedFrom:null,error:true};}
    const root=parents.at(-1),gap=[ev,...parents.slice(0,-1)].reduce((n,x)=>n+Number(x.abstandTage||0),0),base=effective(root,list);
    if(!base.datumVon)return {terminStatus:base.terminStatus,datumVon:null,datumBis:null,dates:[],derivedFrom:ev.folgtAuf};
    const von=addDays(base.datumVon,gap);
    return {terminStatus:base.terminStatus,datumVon:von,datumBis:von,dates:[von],derivedFrom:ev.folgtAuf};
  }
  function range(a,b){if(!a)return[];const out=[];const n=Math.min(Math.max(0,daysBetween(a,b||a)),366);for(let i=0;i<=n;i++)out.push(addDays(a,i));return out;}

  function view(ev){return {...clone(ev),artLabel:kindLabel(ev.art),effective:effective(ev)};}

  function record(action,ev,before,reason){
    K.recordAudit?.(`special_event.${action}`,{entity:'special_event',entityId:ev.id,before:before||null,after:clone(ev),reason:reason||''});
    K.sync?.enqueue?.({entity:'special_event',operation:action==='create'?'create':'update',payload:clone(ev),baseVersion:before?Number(before.version||0):null});
    notify();
  }
  const listeners=new Set();
  function notify(){listeners.forEach(fn=>{try{fn()}catch(_){}});}

  function create(input,{reason=''}={}){
    requireEdit();
    const ev={id:`SE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,eventId:K.eventConfig?.eventId||'KC-WM-2026',...normalize(input),aktiv:true,version:1,createdAt:nowIso(),createdBy:actor(),updatedAt:nowIso(),updatedBy:actor()};
    const errors=[...badDates(input),...validate(ev)];if(errors.length)throw new Error(errors.join(' '));
    K.specialEvents.push(ev);record('create',ev,null,reason);return view(ev);
  }

  function update(id,patch,{reason=''}={}){
    requireEdit();
    const ev=byId(id);if(!ev)throw new Error('Sondereinsatz nicht gefunden.');
    const before=clone(ev),merged={...ev,...normalize({...ev,...patch})};
    if(patch.folgtAuf===null||patch.folgtAuf===''){merged.folgtAuf=null;merged.abstandTage=null;}
    const errors=[...badDates(patch),...validate(merged)];if(errors.length)throw new Error(errors.join(' '));
    Object.assign(ev,merged,{version:Number(ev.version||1)+1,updatedAt:nowIso(),updatedBy:actor()});
    record('update',ev,before,reason);return view(ev);
  }

  function setTermin(id,{terminStatus,datumVon,datumBis}={},opts={}){return update(id,{terminStatus,datumVon,datumBis},opts);}

  function deactivate(id,{reason=''}={}){
    requireEdit();
    if(!String(reason).trim())throw new Error('Zum Beenden eines Sondereinsatzes ist ein Grund erforderlich.');
    const ev=byId(id);if(!ev)throw new Error('Sondereinsatz nicht gefunden.');
    const children=K.specialEvents.filter(e=>e.aktiv&&e.folgtAuf===id);
    if(children.length)throw new Error(`Zuerst die Folge-Einsätze anpassen: ${children.map(c=>c.titel).join(', ')}.`);
    const before=clone(ev);Object.assign(ev,{aktiv:false,version:Number(ev.version||1)+1,updatedAt:nowIso(),updatedBy:actor(),endReason:String(reason).trim()});
    record('deactivate',ev,before,reason);return view(ev);
  }

  function list({includeInactive=false}={}){
    return K.specialEvents.filter(e=>includeInactive||e.aktiv).map(view).sort((a,b)=>String(a.effective.datumVon||'9999').localeCompare(String(b.effective.datumVon||'9999'))||a.titel.localeCompare(b.titel,'de'));
  }

  // Zeilen für kc_dp_special_events_publish – nur aktive Einsätze, wirksamer Termin wird mitgeliefert.
  function publishRows(){
    return K.specialEvents.filter(e=>e.aktiv).map(e=>{const x=effective(e);return {sourceId:e.id,titel:e.titel,ort:e.ort,art:e.art,terminStatus:x.terminStatus,datumVon:x.datumVon,datumBis:x.datumBis,folgtAuf:e.folgtAuf,abstandTage:e.abstandTage,wiederkehrend:e.wiederkehrend,bemerkung:e.bemerkung,vorgesehen:[...(e.vorgesehen||[])],version:e.version};});
  }
  async function publish(){
    K.auth?.require?.('roster.plan.publish','Sie dürfen Sondereinsätze nicht veröffentlichen.');
    if(!K.supabaseConnection?.publishSpecialEvents)throw new Error('Supabase-Verbindung nicht bereit.');
    // Vorher abgleichen: Einsätze, die nur im veröffentlichten Stand stehen, sonst beim Veröffentlichen entfernt.
    if(K.supabaseConnection?.specialEventsList){try{await pull();}catch(e){throw new Error('Vor dem Veröffentlichen konnte der veröffentlichte Stand nicht abgeglichen werden: '+(e.message||e));}}
    const rows=publishRows(),eventId=K.eventConfig?.eventId||'KC-WM-2026';
    const result=await K.supabaseConnection.publishSpecialEvents({eventId,rows});
    K.recordAudit?.('special_event.publish',{entity:'special_event',entityId:eventId,after:{count:rows.length}});
    return result;
  }

  // Veröffentlichte Zeile (kc_dp_special_events) → lokaler Einsatz. Maßgeblich ist die übergebene Zeile (payload).
  function fromRemote(row){
    const p=row?.payload&&typeof row.payload==='object'?row.payload:{},n=normalize({...p,terminStatus:p.terminStatus||row.termin_status,datumVon:p.folgtAuf||p.wiederkehrend?null:(p.datumVon??row.datum_von),datumBis:p.folgtAuf||p.wiederkehrend?null:(p.datumBis??row.datum_bis)});
    return {id:String(row.source_id||p.sourceId||''),eventId:row.event_id||K.eventConfig?.eventId||'KC-WM-2026',...n,aktiv:true,version:Math.max(1,Number(p.version||1)),createdAt:row.published_at||nowIso(),createdBy:null,updatedAt:row.updated_at||nowIso(),updatedBy:null,source:'supabase'};
  }
  // Nimmt neue und neuere veröffentlichte Einsätze auf; lokal Neueres bleibt. Entfernt nie etwas (lokaler Stand führt).
  async function pull(){
    if(!K.supabaseConnection?.specialEventsList)throw new Error('Supabase-Verbindung nicht bereit.');
    const rows=await K.supabaseConnection.specialEventsList({eventId:K.eventConfig?.eventId||'KC-WM-2026'});
    let added=0,updated=0;
    for(const row of rows||[]){
      const ev=fromRemote(row);if(!ev.id||!ev.titel)continue;
      const local=byId(ev.id);
      if(!local){K.specialEvents.push(ev);added++;K.recordAudit?.('special_event.pull',{entity:'special_event',entityId:ev.id,before:null,after:clone(ev)});}
      else if(ev.version>Number(local.version||1)){const before=clone(local);Object.assign(local,{...ev,aktiv:local.aktiv,createdAt:local.createdAt,createdBy:local.createdBy});updated++;K.recordAudit?.('special_event.pull',{entity:'special_event',entityId:ev.id,before,after:clone(local)});}
    }
    if(added||updated){notify();try{await K.persistAll?.();}catch(_){}}
    return {received:(rows||[]).length,added,updated};
  }
  function plannedFor(personId){return list().filter(e=>(e.vorgesehen||[]).includes(personId));}

  function restore(saved){if(Array.isArray(saved))K.specialEvents=saved.filter(e=>e&&e.id&&e.titel);notify();return K.specialEvents.length;}
  function snapshot(){return clone(K.specialEvents);}

  K.specialEventsCore={VERSION,TERMIN,RECURRING,normalize,validate,effective,create,update,setTermin,deactivate,list,get:id=>{const e=byId(id);return e?view(e):null;},dependents:id=>K.specialEvents.filter(e=>e.aktiv&&e.folgtAuf===id).map(view),kindLabel,publishRows,publish,fromRemote,pull,plannedFor,MAX_PLANNED,restore,snapshot,onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
})();
