(function(){
  const K=window.KCDP=window.KCDP||{};
  const ALL='*';
  const roles={
    employee:{label:'Mitarbeiter',permissions:[
      'roster.wish.view_all','roster.wish.edit_own','roster.plan.view_published','roster.actual.view_own',
      'roster.plan.mark_seen','roster.breaks.view','roster.swap.request','roster.rules.view_own','roster.replacement.respond','roster.actual.dispute_own','roster.analytics.view_own','roster.export.personal','roster.documents.personal','roster.notifications.view','roster.notifications.push'
    ]},
    planner:{label:'Planer',permissions:[
      'roster.wish.view_all','roster.wish.edit_own','roster.wish.edit_others',
      'roster.plan.view_draft','roster.plan.view_published','roster.plan.edit','roster.plan.publish','roster.plan.mark_seen',
      'roster.matrix.edit','roster.weather.override','roster.program.edit_impact','roster.standby.edit','roster.breaks.view','roster.breaks.edit','roster.swap.request','roster.swap.resolve','roster.rules.view','roster.rules.edit','roster.replacement.search','roster.replacement.assign','roster.replacement.request','roster.absence.manage',
      'roster.people.view','roster.people.sync','roster.sync.view','roster.sync.run','roster.actual.view_all','roster.actual.import','roster.analytics.view','roster.export.personal','roster.export.all','roster.documents.personal','roster.documents.generate','roster.documents.distribute','roster.notifications.view','roster.notifications.push','roster.notifications.manage'
    ]},
    duty_manager:{label:'Dienstverantwortlicher',permissions:[
      'roster.wish.view_all','roster.wish.edit_own','roster.plan.view_draft','roster.plan.view_published','roster.plan.edit',
      'roster.plan.mark_seen','roster.weather.override','roster.program.edit_impact','roster.standby.edit','roster.breaks.view','roster.breaks.edit','roster.swap.request','roster.swap.resolve','roster.rules.view','roster.rules.edit','roster.replacement.search','roster.replacement.assign','roster.replacement.request','roster.absence.manage','roster.people.view','roster.sync.view','roster.analytics.view','roster.export.personal','roster.documents.personal','roster.documents.generate','roster.notifications.view','roster.notifications.push'
    ]},
    time_auditor:{label:'Zeitprüfer',permissions:[
      'roster.plan.view_published','roster.actual.view_own','roster.actual.view_all','roster.actual.import','roster.actual.correct','roster.actual.close','roster.actual.dispute_own',
      'roster.plan.mark_seen','roster.breaks.view','roster.people.view','roster.sync.view','roster.analytics.view','roster.export.personal','roster.export.all','roster.documents.personal','roster.documents.generate','roster.notifications.view','roster.notifications.push'
    ]},
    read_only:{label:'Nur Lesen',permissions:['roster.wish.view_all','roster.plan.view_published','roster.plan.mark_seen','roster.breaks.view','roster.rules.view_own','roster.analytics.view_own','roster.export.personal','roster.documents.personal','roster.notifications.view','roster.notifications.push']},
    admin:{label:'Administrator',permissions:[ALL]}
  };

  K.currentUser=K.currentUser||{personId:K.people?.[0]?.personId||null,role:'planner',displayName:'Planer'};
  K.auditLog=K.auditLog||[];

  function roleDef(role){return roles[role]||roles.read_only;}
  function has(permission,user=K.currentUser){
    const perms=roleDef(user?.role).permissions;
    return perms.includes(ALL)||perms.includes(permission);
  }
  function own(personId,user=K.currentUser){return !!personId&&personId===user?.personId;}
  function canEditWish(personId,user=K.currentUser){return own(personId,user)?has('roster.wish.edit_own',user):has('roster.wish.edit_others',user);}
  function requirePermission(permission,message,user=K.currentUser){
    if(!has(permission,user))throw new Error(message||`Keine Berechtigung: ${permission}`);
    return true;
  }
  function requireWish(personId,user=K.currentUser){
    if(!canEditWish(personId,user))throw new Error('Sie dürfen nur eigene Wünsche ändern.');
    return true;
  }
  function audit(action,{entity='system',entityId=null,before=null,after=null,reason='',meta={}}={}){
    const row={
      id:`AUD-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      at:new Date().toISOString(),action,entity,entityId,
      actorPersonId:K.currentUser?.personId||null,actorRole:K.currentUser?.role||null,actorName:K.currentUser?.displayName||null,
      reason:String(reason||''),before:before==null?null:JSON.parse(JSON.stringify(before)),after:after==null?null:JSON.parse(JSON.stringify(after)),meta
    };
    K.auditLog.push(row);try{K.notifications?.onAudit?.(row)}catch(_){/* notification hook optional */}return row;
  }
  function queue(entity,operation,payload,baseVersion=null){
    if(K.sync?.enqueue)K.sync.enqueue({entity,operation,payload,baseVersion});
  }

  K.auth={
    version:'0.15.0',roles,roleDef,has,own,canEditWish,require:requirePermission,requireWish,
    setCurrentUser(user){
      if(!user||!roles[user.role])throw new Error('Ungültiger Benutzer oder Rolle.');
      K.currentUser={...K.currentUser,...user};
      audit('auth.user.changed',{entity:'session',entityId:K.currentUser.personId,after:K.currentUser});
      return K.currentUser;
    },
    effectivePermissions(user=K.currentUser){const p=roleDef(user?.role).permissions;return p.includes(ALL)?[ALL]:[...p];}
  };
  K.recordAudit=audit;

  K.mutations={
    saveShift(candidate,{existingId=candidate?.id||null,reason=''}={}){
      requirePermission('roster.plan.edit','Sie dürfen den Sollplan nicht bearbeiten.');K.locks?.requireEditable?.(candidate.date);
      candidate=K.normalizeShiftClassification?.(candidate)||candidate;
      const issues=K.validateShift(candidate);if(issues.some(i=>i.level==='error'))throw new Error(issues.find(i=>i.level==='error').text);
      let target=existingId?K.shifts.find(s=>s.id===existingId):null;const before=target?{...target}:null;
      if(target)Object.assign(target,candidate,{id:target.id,layer:'planned'});
      else{target={...candidate,id:candidate.id||`S-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,layer:'planned',status:candidate.status||'draft'};K.shifts.push(target);}
      const baseVersion=Number(target.version||0);target.version=baseVersion+1;
      audit(before?'shift.update':'shift.create',{entity:'shift',entityId:target.id,before,after:target,reason});
      queue('shift',before?'update':'create',target,baseVersion);
      K.refreshWorkflowState?.();return {record:target,issues};
    },
    deleteShift(id,{reason=''}={}){
      requirePermission('roster.plan.edit','Sie dürfen den Sollplan nicht bearbeiten.');
      const target=K.shifts.find(s=>s.id===id);if(!target)throw new Error('Dienst nicht gefunden.');K.locks?.requireEditable?.(target.date);const before={...target};target.status='deleted';target.deletedAt=new Date().toISOString();target.version=Number(target.version||0)+1;
      audit('shift.delete',{entity:'shift',entityId:id,before,after:target,reason});queue('shift','delete',target,before.version||null);K.refreshWorkflowState?.();return before;
    },
    replaceDayPlan(date,newShifts,{reason='KI-/Tagesplan-Vorschlag'}={}){
      requirePermission('roster.plan.edit','Sie dürfen den Sollplan nicht bearbeiten.');
      K.locks?.requireEditable?.(date);const before=K.shifts.filter(s=>s.date===date&&s.layer==='planned').map(s=>({...s}));
      K.shifts=K.shifts.filter(s=>!(s.date===date&&s.layer==='planned'));
      const added=(newShifts||[]).map(s=>({...s,id:s.id&&String(s.id).startsWith('S-')?s.id:`S-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,date,layer:'planned',status:'draft',version:Number(s.version||0)+1}));
      K.shifts.push(...added);audit('plan.day.replace',{entity:'plan_day',entityId:date,before,after:added,reason});queue('plan_day','replace',{date,shifts:added},null);K.refreshWorkflowState?.();return {before,added};
    },
    saveWish(candidate,{existingId=candidate?.id||null,reason=''}={}){
      requireWish(candidate.personId);
      const issues=K.validateWish(candidate);if(issues.some(i=>i.level==='error'))throw new Error(issues.find(i=>i.level==='error').text);
      let target=existingId?K.wishes.find(w=>w.id===existingId):null;const before=target?{...target}:null;
      if(target)Object.assign(target,candidate,{id:target.id});else{target={...candidate,id:candidate.id||`W-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,status:candidate.status||'confirmed'};K.wishes.push(target);}
      const baseVersion=Number(target.version||0);target.version=baseVersion+1;audit(before?'wish.update':'wish.create',{entity:'wish',entityId:target.id,before,after:target,reason});queue('wish',before?'update':'create',target,baseVersion);return {record:target,issues};
    },
    deleteWish(id,{reason=''}={}){
      const target=K.wishes.find(w=>w.id===id);if(!target)throw new Error('Wunsch nicht gefunden.');const before={...target};requireWish(before.personId);target.status='deleted';target.deletedAt=new Date().toISOString();target.version=Number(target.version||0)+1;
      audit('wish.delete',{entity:'wish',entityId:id,before,after:target,reason});queue('wish','delete',target,before.version||null);return before;
    },
    saveStandby(candidate,{existingId=candidate?.id||null,reason=''}={}){
      requirePermission('roster.standby.edit','Sie dürfen Bereitschaften nicht bearbeiten.');
      K.locks?.requireEditable?.(candidate.date);const issues=K.validateStandby(candidate);if(issues.some(i=>i.level==='error'))throw new Error(issues.find(i=>i.level==='error').text);
      let target=existingId?K.standby.find(s=>s.id===existingId):null;const before=target?{...target}:null;
      if(target)Object.assign(target,candidate,{id:target.id});else{target={...candidate,id:candidate.id||`B-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,status:candidate.status||'planned'};K.standby.push(target);}
      const baseVersion=Number(target.version||0);target.version=baseVersion+1;audit(before?'standby.update':'standby.create',{entity:'standby',entityId:target.id,before,after:target,reason});queue('standby',before?'update':'create',target,baseVersion);K.refreshWorkflowState?.();return {record:target,issues};
    },
    deleteStandby(id,{reason=''}={}){
      requirePermission('roster.standby.edit','Sie dürfen Bereitschaften nicht bearbeiten.');
      const target=K.standby.find(s=>s.id===id);if(!target)throw new Error('Bereitschaft nicht gefunden.');const before={...target};target.status='deleted';target.deletedAt=new Date().toISOString();target.version=Number(target.version||0)+1;
      audit('standby.delete',{entity:'standby',entityId:id,before,after:target,reason});queue('standby','delete',target,before.version||null);K.refreshWorkflowState?.();return before;
    }
  };
})();
