(function(){
  const K=window.KCDP=window.KCDP||{};
  function isPlannerProposal(rows,options){
    return (Array.isArray(rows)&&rows.some(s=>s?.status==='proposal'||/^AI-/i.test(String(s?.id||''))))||/\bKI\b|Vorschlagsplan/i.test(String(options?.reason||''));
  }
  function summary(v){
    const hard=v?.hardViolations?.length||0,gaps=v?.gaps?.length||0;
    const details=[];
    if(hard)details.push(`${hard} harte Regelverletzung${hard===1?'':'en'}`);
    if(gaps)details.push(`${gaps} ungedeckte Besetzungszeit${gaps===1?'':'en'}`);
    return details.join(' · ')||'Vorschlag ist nicht freigabefähig';
  }
  function assertApplicable(date,rows){
    if(!K.plannerEngine?.validateProposal)throw new Error('KI-Planer-Prüfung ist nicht geladen. Der Vorschlag wird aus Sicherheitsgründen nicht übernommen.');
    const day=(K.days||[]).find(d=>d.date===date);if(!day)throw new Error('Planungstag für KI-Vorschlag nicht gefunden.');
    const validation=K.plannerEngine.validateProposal(day,rows||[]);
    const hard=validation?.hardViolations?.length||0;
    if(hard){const e=new Error(`KI-Vorschlag nicht übernommen: ${summary(validation)}. Bitte Regeln/Besetzung prüfen und neu berechnen.`);e.code='KC_PLANNER_APPLY_BLOCKED';e.validation=validation;throw e;}
    // Ungedeckte Besetzungszeiten dürfen als unfertiger Soll-Entwurf übernommen werden.
    // Sie werden anschließend in „Plan verbessern“ sichtbar und müssen vor der Freigabe gelöst werden.
    return validation;
  }
  function install(){
    const m=K.mutations;if(!m?.replaceDayPlan)return false;
    if(m.__kcPlannerGuardV01942)return true;
    const base=m.replaceDayPlan.bind(m);
    m.replaceDayPlan=function(date,rows,options={}){
      if(isPlannerProposal(rows,options))assertApplicable(date,rows);
      return base(date,rows,options);
    };
    Object.defineProperty(m,'__kcPlannerGuardV01942',{value:true,enumerable:false,configurable:false});
    return true;
  }
  K.plannerApplicationGuard={version:'0.19.55-draft-gaps-1',install,assertApplicable,isPlannerProposal};
  if(!install()){
    let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>=50)clearInterval(timer);},20);
  }
})();

(function(){
  if(window.__kcAdminPushSettingsLoaded)return;window.__kcAdminPushSettingsLoaded=true;
  const css='src/ui/admin-push-settings.css?v=0.19.51-adminpush-1';
  if(!document.querySelector(`link[href^="src/ui/admin-push-settings.css"]`)){const l=document.createElement('link');l.rel='stylesheet';l.href=css;document.head.appendChild(l)}
  const load=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src^="${src.split('?')[0]}"]`))return resolve(true);const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>resolve(true);s.onerror=()=>reject(new Error('Admin-Push-Erweiterung konnte nicht geladen werden.'));document.head.appendChild(s)});
  load('src/adapters/admin-push-settings.js?v=0.19.51-adminpush-1').then(()=>load('src/ui/admin-push-settings.js?v=0.19.51-adminpush-1')).catch(e=>console.warn(e.message));
})();
