(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const LABELS={
    dashboard:['Übersicht','Kennzahlen, Risiken und Systemstatus'],
    demand:['Bedarf','Tägliche Grundmatrix mit Wetter- und Programmeinfluss'],
    wish:['Wunschplan','Wünsche, Reserven und Sperren erfassen'],
    planned:['Sollplan','Dienste planen, prüfen und veröffentlichen'],
    actual:['Istplan','Istzeiten übernehmen und Abweichungen prüfen'],
    matrix:['Stundenmatrix','Besetzung je Zeitabschnitt prüfen'],
    fairness:['Fairnis','Stundenverteilung neutral und nachvollziehbar vergleichen']
  };
  const SCOPES={
    aiPlanBtn:'planned',photoBtn:'wish',actualImportBtn:'actual',pauseToggleBtn:'planned',
    addShiftBtn:'planned',checkBtn:'planned matrix',quickPlanBtn:'planned',publishBtn:'planned',
    planWeatherChip:'dashboard demand planned matrix',planProgramChip:'dashboard demand planned matrix',
    planGapChip:'dashboard planned matrix',inspectorToggleBtn:'planned matrix',
    colorLegendBtn:'wish planned actual'
  };
  let context=null;

  function markActions(){
    for(const [id,scope] of Object.entries(SCOPES)){
      const element=document.getElementById(id);if(!element)continue;
      element.dataset.v020Context=scope;
    }
    const layerTabs=document.getElementById('layerTabs');
    if(layerTabs){layerTabs.classList.add('v020-legacy-layer-tabs');layerTabs.setAttribute('aria-hidden','true')}
  }
  function ensureContext(){
    if(context)return context;
    const host=document.querySelector('.plan-controls-main');if(!host)return null;
    context=document.createElement('div');context.className='v020-ribbon-context';
    context.innerHTML='<span class="v020-ribbon-dot" aria-hidden="true"></span><span><b></b><small></small></span>';
    host.prepend(context);return context;
  }
  function apply(register=document.body.dataset.v020Register||'planned'){
    const label=LABELS[register]||LABELS.planned,node=ensureContext();
    if(node){node.querySelector('b').textContent=label[0];node.querySelector('small').textContent=label[1]}
    document.querySelector('.plan-control-row')?.setAttribute('aria-label',`${label[0]} – Befehlsleiste`);
    document.querySelectorAll('[data-v020-context]').forEach(element=>{
      const visible=element.dataset.v020Context.split(/\s+/).includes(register);
      element.setAttribute('aria-hidden',String(!visible));
      if(!visible&&element===document.activeElement)document.getElementById('moreBtn')?.focus();
    });
  }
  function install(){
    if(document.body.dataset.v020LayoutInstalled)return;
    document.body.dataset.v020LayoutInstalled='true';markActions();ensureContext();apply();
    window.addEventListener('kc-v020-register-change',event=>apply(event.detail?.id));
  }
  K.v020Layout={version:'0.20.0-phase2',install,apply,scopes:{...SCOPES}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
