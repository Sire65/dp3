(function(){
  const K=window.KCDP=window.KCDP||{};
  K.notificationInbox=K.notificationInbox||[];
  K.notificationPreferences=K.notificationPreferences||{};
  const defaults={push:true,email:false,plan_published:true,shift_changed:true,swap_request:true,swap_resolved:true,replacement_request:true,standby_call:true,standby_activated:true,wish_deadline:true,actual_issue:true};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const fmtDate=iso=>new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'2-digit'}).format(new Date(iso+'T12:00:00'));
  const fmtTime=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h%1)*60)).padStart(2,'0')}`;
  function prefs(personId){return {...defaults,...(K.notificationPreferences[personId]||{})};}
  function setPrefs(personId,patch){if(personId!==K.currentUser?.personId&&!K.auth?.has('roster.notifications.manage')&&!K.auth?.has('*'))throw new Error('Benachrichtigungseinstellungen dürfen nur für die eigene Person geändert werden.');K.notificationPreferences[personId]={...prefs(personId),...patch};return prefs(personId);}
  function channelLive(name){return K.notificationChannelSafety?.isLive?.(name)===true;}
  function create({type,personIds,title,body,data={},priority='normal',channels=null}={}){
    const ids=[...new Set((personIds||[]).filter(Boolean))],created=[];
    for(const personId of ids){
      const p=prefs(personId);if(p[type]===false)continue;
      const n={id:`NOT-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,personId,type,title:String(title||'KC DP'),body:String(body||''),data:clone(data),priority,createdAt:new Date().toISOString(),readAt:null,channels:{inapp:'delivered',push:'not_requested',email:'not_requested'}};
      K.notificationInbox.push(n);created.push(n);

      if((channels?.push??p.push)&&K.pushAdapter?.send){
        if(!channelLive('push')){
          n.channels.push='preview_only';n.pushPreviewAt=new Date().toISOString();
        }else{
          n.channels.push='queued';Promise.resolve(K.pushAdapter.send(n,personId)).then(r=>{n.channels.push=r?.status||'sent';n.pushAt=new Date().toISOString();}).catch(e=>{n.channels.push='failed';n.pushError=e.message;});
        }
      }

      if((channels?.email??p.email)&&K.emailAdapter?.hasProvider?.()){
        const person=K.person(personId),email=person?.email||person?.contacts?.email;
        if(email){
          if(!channelLive('email')){
            n.channels.email='preview_only';n.emailPreviewAt=new Date().toISOString();
          }else{
            n.channels.email='queued';Promise.resolve(K.emailAdapter.send({to:email,subject:`KC DP – ${n.title}`,text:n.body})).then(()=>{n.channels.email='sent';n.emailAt=new Date().toISOString();}).catch(e=>{n.channels.email='failed';n.emailError=e.message;});
          }
        }else n.channels.email='missing_email';
      }
    }
    return created;
  }
  function unread(personId=K.currentUser?.personId){return K.notificationInbox.filter(n=>n.personId===personId&&!n.readAt).length;}
  function list(personId=K.currentUser?.personId){return K.notificationInbox.filter(n=>n.personId===personId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  function markRead(id,personId=K.currentUser?.personId){const n=K.notificationInbox.find(x=>x.id===id&&x.personId===personId);if(!n)throw new Error('Meldung nicht gefunden.');n.readAt=n.readAt||new Date().toISOString();return n;}
  function markAll(personId=K.currentUser?.personId){for(const n of K.notificationInbox)if(n.personId===personId&&!n.readAt)n.readAt=new Date().toISOString();return unread(personId);}
  function groupShifts(rows){const m=new Map();for(const s of rows||[]){if(!m.has(s.personId))m.set(s.personId,[]);m.get(s.personId).push(s);}return m;}
  function sig(s){return [s.date,s.start,s.end,s.zone,s.area,s.breakMinutes||0,JSON.stringify(s.breakSegments||[]),s.status||''].join('|');}
  function onPlanPublished(snapshot,previous){const all=K.people.filter(p=>p.active&&p.personType==='member').map(p=>p.personId);if(!previous){return create({type:'plan_published',personIds:all,title:`Sollplan V${snapshot.version} veröffentlicht`,body:`Der neue KC-Dienstplan V${snapshot.version} wurde veröffentlicht. Bitte persönlichen Dienstplan prüfen.`,data:{version:snapshot.version,route:'plan'},priority:'high'});}const oldBy=groupShifts(previous.shifts),newBy=groupShifts(snapshot.shifts),changed=[];for(const id of all){const a=(oldBy.get(id)||[]).map(sig).sort().join(';;'),b=(newBy.get(id)||[]).map(sig).sort().join(';;');if(a!==b)changed.push(id);}for(const id of changed){const p=K.person(id),rows=(newBy.get(id)||[]).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start),next=rows[0];create({type:'shift_changed',personIds:[id],title:`Dienstplan V${snapshot.version} geändert`,body:next?`${p?.name||''}: Bitte neue Dienste prüfen. Nächster Eintrag ${fmtDate(next.date)} ${fmtTime(next.start)}–${fmtTime(next.end)} Uhr.`:'Ihr bisheriger Dienst wurde aus dem veröffentlichten Plan entfernt. Bitte Plan prüfen.',data:{version:snapshot.version,route:'personal_plan',personId:id,date:next?.date||null},priority:'high'});}return changed;}
  function onSwapRequest(req){const ids=req.preferredReplacement?[req.preferredReplacement]:[];const shift=K.shifts.find(s=>s.id===req.shiftId);if(ids.length)create({type:'swap_request',personIds:ids,title:'Neue Tauschanfrage',body:'Für einen Dienst liegt eine Tauschanfrage vor. Bitte Anfrage in KC DP prüfen.',data:{requestId:req.id,shiftId:req.shiftId,date:shift?.date||null,route:'swap'},priority:'high'});}
  function onSwapResolved(req,shift){const ids=[req.requestedBy,req.replacementPersonId].filter(Boolean);create({type:'swap_resolved',personIds:ids,title:'Diensttausch entschieden',body:`Der Diensttausch wurde übernommen. Neuer Dienst: ${fmtDate(shift.date)} ${fmtTime(shift.start)}–${fmtTime(shift.end)} Uhr.`,data:{requestId:req.id,shiftId:shift.id,date:shift.date,personId:shift.personId,route:'personal_plan'},priority:'high'});}
  function standbyCall({personId,date,start,end,reason=''}){return create({type:'standby_call',personIds:[personId],title:'Bereitschaft wird benötigt',body:`Bitte Bereitschaft aktivieren: ${fmtDate(date)} ${fmtTime(start)}–${fmtTime(end)} Uhr.${reason?' Grund: '+reason:''}`,data:{date,start,end,route:'standby'},priority:'critical'});}
  function replacementRequest(req){return create({type:'replacement_request',personIds:[req.personId],title:'Kurzfristige Vertretungsanfrage',body:`Können Sie am ${fmtDate(req.date)} von ${fmtTime(req.start)}–${fmtTime(req.end)} Uhr übernehmen? Bereich: ${req.area}.${req.reason?' Grund: '+req.reason:''}`,data:{requestId:req.id,date:req.date,start:req.start,end:req.end,route:'replacement'},priority:'critical'});}
  function standbyActivated({personId,date,start,end,zone,area,reason=''}){return create({type:'standby_activated',personIds:[personId],title:'Bereitschaft als Einsatz aktiviert',body:`Ihre Bereitschaft wurde für ${fmtDate(date)} ${fmtTime(start)}–${fmtTime(end)} Uhr als ${zone==='front'?'Vorne':zone==='back'?'Hinten':'Dienst'} aktiviert (${area}).${reason?' Grund: '+reason:''}`,data:{date,start,end,route:'personal_plan'},priority:'critical'});}
  function wishDeadline({personIds,deadline}){return create({type:'wish_deadline',personIds,title:'Wunschfrist endet bald',body:`Wünsche können noch bis ${new Date(deadline).toLocaleString('de-DE')} geändert werden.`,data:{deadline,route:'wish'},priority:'normal'});}
  function actualIssue(req){return create({type:'actual_issue',personIds:[req.personId],title:'Istzeit-Korrekturantrag erfasst',body:'Ihre Meldung zur Istzeit wurde gespeichert und zur Prüfung vorgemerkt.',data:{requestId:req.id,actualId:req.actualId,route:'actual'},priority:'normal'});}
  K.notifications={version:'0.12.0-safety-gated',defaults,prefs,setPrefs,create,unread,list,markRead,markAll,onPlanPublished,onSwapRequest,onSwapResolved,replacementRequest,standbyCall,standbyActivated,wishDeadline,actualIssue};
})();
