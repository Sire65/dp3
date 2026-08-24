(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const REGISTER=[
    {id:'dashboard',label:'Dashboard',hint:'Planungsübersicht'},
    {id:'wish',label:'Wunschplan',hint:'Wünsche und Verfügbarkeit',layer:'wish'},
    {id:'planned',label:'Sollplan',hint:'Planung und Veröffentlichung',layer:'planned'},
    {id:'actual',label:'Istplan',hint:'Istzeiten und Abweichungen',layer:'actual'},
    {id:'matrix',label:'Stundenmatrix',hint:'Besetzung je Stunde',layer:'planned'}
  ];
  const ORDER_KEY='kc.dp2.v020.register-order';
  const state=K.v020ShellState=K.v020ShellState||{active:'planned',order:[]};
  let root=null,draggedId=null,touchDrag=null,suppressClick=false;

  function defaultOrder(){return REGISTER.map(item=>item.id)}
  function normalizeOrder(value){
    const allowed=new Set(defaultOrder()),out=[];
    for(const id of Array.isArray(value)?value:[])if(allowed.has(id)&&!out.includes(id))out.push(id);
    for(const id of allowed)if(!out.includes(id))out.push(id);
    return out;
  }
  function loadOrder(){
    if(state.order?.length)return normalizeOrder(state.order);
    try{return normalizeOrder(JSON.parse(localStorage.getItem(ORDER_KEY)||'[]'))}catch(_){return defaultOrder()}
  }
  function saveOrder(){
    state.order=[...root.querySelectorAll('[data-v020-register]')].map(button=>button.dataset.v020Register);
    try{localStorage.setItem(ORDER_KEY,JSON.stringify(state.order))}catch(_){}
  }
  function orderedRegister(){const order=loadOrder();return order.map(id=>REGISTER.find(item=>item.id===id)).filter(Boolean)}

  function layerButton(layer){return document.querySelector(`#layerTabs [data-layer="${layer}"]`)}
  function announce(text){
    const target=document.getElementById('messageText');
    if(target)target.textContent=text;
  }
  function paint(){
    if(!root)return;
    root.querySelectorAll('[data-v020-register]').forEach(button=>{
      const active=button.dataset.v020Register===state.active;
      button.classList.toggle('active',active);
      button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
    });
    document.body.dataset.v020Register=state.active;
  }
  function select(id,{focus=false,quiet=false}={}){
    const entry=REGISTER.find(item=>item.id===id);
    if(!entry)return false;
    state.active=id;
    if(entry.layer)layerButton(entry.layer)?.click();
    paint();
    if(focus)root?.querySelector(`[data-v020-register="${id}"]`)?.focus();
    if(!quiet){
      const suffix=id==='dashboard'||id==='matrix'?' · Grundansicht in Phase 1, Fachausbau folgt stufenweise.':'';
      announce(`${entry.label}: ${entry.hint}${suffix}`);
    }
    window.dispatchEvent(new CustomEvent('kc-v020-register-change',{detail:{id,layer:entry.layer||null}}));
    return true;
  }
  function onKeydown(event){
    const buttons=[...root.querySelectorAll('[data-v020-register]')];
    const index=buttons.indexOf(document.activeElement);
    if(index<0)return;
    if(event.altKey&&(event.key==='ArrowRight'||event.key==='ArrowLeft')){
      event.preventDefault();
      const target=event.key==='ArrowRight'?buttons[index+1]:buttons[index-1];
      if(!target)return;
      if(event.key==='ArrowRight')target.after(buttons[index]);else target.before(buttons[index]);
      saveOrder();paint();buttons[index].focus();
      announce(`${buttons[index].innerText.replace('⋮⋮','').trim()} verschoben · Position ${[...root.querySelectorAll('[data-v020-register]')].indexOf(buttons[index])+1}.`);
      return;
    }
    let next=index;
    if(event.key==='ArrowRight')next=(index+1)%buttons.length;
    else if(event.key==='ArrowLeft')next=(index-1+buttons.length)%buttons.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=buttons.length-1;
    else return;
    event.preventDefault();
    select(buttons[next].dataset.v020Register,{focus:true});
  }
  function syncLegacyLayer(event){
    const layer=event.target?.closest?.('#layerTabs [data-layer]')?.dataset.layer;
    if(!layer)return;
    const match=REGISTER.find(item=>item.layer===layer&&item.id!=='matrix');
    if(match){state.active=match.id;paint()}
  }
  function moveBeforePointer(button,clientX){
    const others=[...root.querySelectorAll('[data-v020-register]')].filter(item=>item!==button);
    const next=others.find(item=>clientX<item.getBoundingClientRect().left+item.getBoundingClientRect().width/2);
    if(next)root.insertBefore(button,next);else root.appendChild(button);
  }
  function installReorder(){
    root.addEventListener('dragstart',event=>{
      const button=event.target.closest('[data-v020-register]');if(!button)return;
      draggedId=button.dataset.v020Register;button.classList.add('dragging');
      event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',draggedId);
    });
    root.addEventListener('dragover',event=>{
      if(!draggedId)return;event.preventDefault();
      const button=root.querySelector(`[data-v020-register="${draggedId}"]`);if(button)moveBeforePointer(button,event.clientX);
    });
    root.addEventListener('drop',event=>{if(draggedId)event.preventDefault()});
    root.addEventListener('dragend',()=>{
      root.querySelector('.dragging')?.classList.remove('dragging');
      if(draggedId){saveOrder();announce('Registerreihenfolge gespeichert.');suppressClick=true;setTimeout(()=>suppressClick=false,0)}
      draggedId=null;
    });
    root.addEventListener('pointerdown',event=>{
      const handle=event.target.closest('.v020-drag-handle');if(!handle)return;
      const button=handle.closest('[data-v020-register]');if(!button)return;
      event.preventDefault();handle.setPointerCapture?.(event.pointerId);
      touchDrag={pointerId:event.pointerId,button,startX:event.clientX,moved:false};button.classList.add('dragging');
    });
    root.addEventListener('pointermove',event=>{
      if(!touchDrag||event.pointerId!==touchDrag.pointerId)return;
      if(Math.abs(event.clientX-touchDrag.startX)>5)touchDrag.moved=true;
      if(touchDrag.moved)moveBeforePointer(touchDrag.button,event.clientX);
    });
    const finishTouch=event=>{
      if(!touchDrag||event.pointerId!==touchDrag.pointerId)return;
      touchDrag.button.classList.remove('dragging');
      if(touchDrag.moved){saveOrder();announce('Registerreihenfolge gespeichert.');suppressClick=true;setTimeout(()=>suppressClick=false,0)}
      touchDrag=null;
    };
    root.addEventListener('pointerup',finishTouch);root.addEventListener('pointercancel',finishTouch);
  }
  function install(){
    if(document.getElementById('v020RegisterBar'))return;
    const topbar=document.querySelector('.topbar');
    const controls=document.querySelector('.plan-control-row');
    if(!topbar||!controls)return;
    const brand=document.createElement('div');
    brand.className='v020-brand';
    brand.innerHTML='<img src="assets/kc-logo.svg" alt=""><span><strong>KC DP2</strong><small>V0.20.0 · Build 87</small></span>';
    topbar.prepend(brand);
    root=document.createElement('nav');
    root.id='v020RegisterBar';
    root.className='v020-register-bar';
    root.setAttribute('aria-label','Hauptregister');
    root.setAttribute('role','tablist');
    root.innerHTML=orderedRegister().map(item=>`<button type="button" role="tab" draggable="true" data-v020-register="${item.id}" title="${item.hint} · Ziehen zum Verschieben · Alt+Pfeiltaste verschiebt per Tastatur"><span class="v020-drag-handle" aria-hidden="true" title="Register verschieben">⋮⋮</span><span>${item.label}</span></button>`).join('');
    controls.before(root);
    root.addEventListener('click',event=>{
      if(suppressClick){event.preventDefault();return}
      const button=event.target.closest('[data-v020-register]');
      if(button)select(button.dataset.v020Register);
    });
    root.addEventListener('keydown',onKeydown);
    installReorder();
    document.addEventListener('click',syncLegacyLayer);
    select(state.active,{quiet:true});
  }
  K.v020Shell={version:'0.20.0-phase1-register-order',registers:REGISTER.map(item=>({...item})),state,select,install,saveOrder};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
