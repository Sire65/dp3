(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const ACTIVE_KEY='kc_dp_diag_controller_v5_active';
  const TRACE_KEY='kc_dp_diag_controller_v5_trace';
  const CAPTURE_KEY='kc_dp_diag_capture_freeze_v1';
  const DATA_TIMEOUT_MS=10000;
  const STABILITY_MS=5000;
  const FRAME_FALLBACK_MS=350;
  let busy=false;
  const now=()=>new Date().toISOString();
  function readTrace(){try{const x=JSON.parse(localStorage.getItem(TRACE_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return []}}
  function writeTrace(rows){try{localStorage.setItem(TRACE_KEY,JSON.stringify(rows.slice(-40)))}catch(_){}}
  function mark(stage,detail=''){
    const row={at:now(),stage:String(stage),detail:String(detail||'')};
    const rows=readTrace();rows.push(row);writeTrace(rows);
    try{localStorage.setItem(ACTIVE_KEY,JSON.stringify({active:true,stage:row.stage,detail:row.detail,at:row.at,version:'v5.4'}))}catch(_){}
    return row;
  }
  function complete(){
    try{localStorage.setItem(ACTIVE_KEY,JSON.stringify({active:false,stage:'complete',detail:'Diagnose vollständig geladen und 5 Sekunden stabil reagiert',at:now(),version:'v5.4'}))}catch(_){}
    try{localStorage.removeItem(CAPTURE_KEY)}catch(_){}
  }
  function readActive(){try{return JSON.parse(localStorage.getItem(ACTIVE_KEY)||'null')}catch(_){return null}}
  function closeSettings(){
    mark('settings-close:begin');
    const back=document.getElementById('modalBackdrop'),modal=document.getElementById('modal');
    back?.classList.add('hidden');
    if(modal){modal.innerHTML='';modal.classList.remove('wide')}
    document.body.classList.remove('modal-open');document.documentElement.classList.remove('modal-open');
    mark('settings-close:end');
  }
  function nextFrameOrTask(timeoutMs=FRAME_FALLBACK_MS){
    return new Promise(resolve=>{
      let done=false,timer=null;
      const finish=source=>{if(done)return;done=true;if(timer)clearTimeout(timer);resolve(source)};
      timer=setTimeout(()=>finish('task-fallback'),Math.max(50,Number(timeoutMs)||FRAME_FALLBACK_MS));
      try{
        requestAnimationFrame(()=>requestAnimationFrame(()=>finish('raf')));
      }catch(_){
        setTimeout(()=>finish('task-fallback'),0);
      }
    });
  }
  async function waitOverlay(ms=2500){
    const t=performance.now();
    while(performance.now()-t<ms){
      if(document.getElementById('kcDiagOverlay'))return true;
      await new Promise(r=>setTimeout(r,50));
    }
    return false;
  }
  async function waitDataRendered(ms=DATA_TIMEOUT_MS){
    const t=performance.now();
    while(performance.now()-t<ms){
      const host=document.getElementById('kcDiagOverlay');
      if(!host)return {ok:false,reason:'Diagnosefenster wurde vor Abschluss geschlossen'};
      const table=host.querySelector('#kcDiagTable');
      const txt=String(table?.textContent||'').trim();
      if(txt && !/Diagnose wird geladen/i.test(txt)){
        if(/Diagnose konnte nicht geladen|Keine Meldungen|Technischer Code|Keine Aktion nötig|Behoben|Geprüft|Test erledigt/i.test(txt))return {ok:true,text:txt.slice(0,160)};
      }
      await new Promise(r=>setTimeout(r,100));
    }
    return {ok:false,reason:`Diagnosedaten nach ${Math.round(ms/1000)} Sekunden nicht fertig gerendert`};
  }
  async function postRenderStability(){
    mark('post-render-stability:begin',`${STABILITY_MS/1000} Sekunden Nachlaufüberwachung gestartet`);
    const started=performance.now();
    let tick=0;
    while(performance.now()-started<STABILITY_MS){
      await new Promise(r=>setTimeout(r,500));
      const source=await nextFrameOrTask();
      tick++;
      if(tick%2===0)mark('post-render-stability:tick',`${Math.round(performance.now()-started)} ms stabil · ${source}`);
      if(!document.getElementById('kcDiagOverlay'))throw new Error('Diagnosefenster während Stabilitätsprüfung verschwunden');
    }
    mark('post-render-stability:end','Nachlaufüberwachung ohne Blockade abgeschlossen');
  }
  async function run(){
    if(busy)return false;
    busy=true;
    mark('v5-run-entry','Isolierter Diagnose-Controller V5.4 gestartet');
    try{
      closeSettings();
      mark('frame-wait:begin');
      const firstYield=await nextFrameOrTask();
      mark('frame-wait:end',firstYield);
      if(!K.diagnosticsCenter?.open)throw new Error('diagnosticsCenter.open fehlt');
      mark('open-call:begin');
      const result=K.diagnosticsCenter.open();
      mark('open-call:end',String(result));
      if(result===false)throw new Error('Diagnose konnte nicht geöffnet werden');
      mark('overlay-wait:begin');
      if(!await waitOverlay())throw new Error('Diagnose-Overlay nicht sichtbar');
      mark('overlay-visible');
      mark('data-render-wait:begin','Warte auf Supabase-Abruf und Karten-/Tabellen-Rendern');
      const rendered=await waitDataRendered();
      if(!rendered.ok)throw new Error(rendered.reason);
      mark('data-rendered',rendered.text||'Diagnosedaten sichtbar');
      mark('ui-responsive-probe:begin');
      const probeSource=await nextFrameOrTask();
      mark('ui-responsive-probe:end',`UI-Zyklus abgeschlossen · ${probeSource}`);
      await postRenderStability();
      complete();
      return true;
    }catch(e){mark('v5-error',e?.message||String(e));return false}
    finally{setTimeout(()=>{busy=false},500)}
  }
  K.diagnosticsControllerV5={version:'0.19.55-diagnostic-controller-v5.4',run,mark,readActive,readTrace};
})();
