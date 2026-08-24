(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const CAPTURE_KEY='kc_dp_diag_capture_v1';
  function persist(stage,detail){
    try{localStorage.setItem(CAPTURE_KEY,JSON.stringify({active:true,stage,detail:String(detail||''),at:new Date().toISOString(),build:String(K.VERSION||K.version||'0.19.55')}))}catch(_){}
  }
  function isDiagnosticsButton(e){return !!e.target?.closest?.('#kcDiagnosticsAdminEntry')}
  function route(e){
    if(!isDiagnosticsButton(e))return;
    persist('router-capture','Diagnosebutton vom exklusiven Watchdog-Router abgefangen');
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    const run=()=>{
      if(K.diagnosticsWatchdog?.run){persist('watchdog-dispatch','diagnosticsWatchdog.run wird gestartet');K.diagnosticsWatchdog.run();return;}
      persist('watchdog-missing','Diagnose-Watchdog ist nicht geladen');
      alert('Fehlerdiagnose kann nicht gestartet werden: Diagnose-Wächter ist nicht geladen. Bitte KC DP2 neu starten.');
    };
    setTimeout(run,0);
  }
  document.addEventListener('click',route,true);
  K.diagnosticsButtonRouter={version:'0.19.55-router-1',persist,route};
})();
