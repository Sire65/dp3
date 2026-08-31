(function(){
  'use strict';
  const TOOLTIP_ID='kcMicrotextZoom';
  const explicit='.shift-label,.person-name,.person-role,.metric .sub,.workflow-stat small,.matrix-cell,.summary-table th,.summary-table td,.hour-label,.shift-source-badge,.break-required-marker,.wish-composite-solid span,.plan-wish-guide-solid span,.wish-key,.photo-ocr-legend span,.color-legend-item span,.helper-badge,.break-chip,[class*="legend"] span,[class*="legend"] b,[data-microtext]';
  const candidates='small,'+explicit;
  let tooltip=null,current=null,showTimer=0,hideTimer=0,pinned=false;
  function candidate(target){
    const el=target?.closest?.(candidates);
    if(!el||el.closest('#'+TOOLTIP_ID)||el.closest('button,input,select,textarea'))return null;
    const style=getComputedStyle(el),font=parseFloat(style.fontSize)||16;
    const clipped=el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1;
    if(!el.matches(explicit)&&font>11.5&&!clipped)return null;
    const value=String(el.getAttribute('aria-label')||el.getAttribute('title')||el.dataset.kcFulltext||el.textContent||'').replace(/\s+/g,' ').trim();
    if(!value||value.length<2)return null;
    return {el,value};
  }
  function ensure(){
    if(tooltip)return tooltip;
    tooltip=document.createElement('div');tooltip.id=TOOLTIP_ID;tooltip.className='kc-microtext-zoom';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.appendChild(tooltip);return tooltip;
  }
  function place(el){
    const box=el.getBoundingClientRect(),tip=ensure(),gap=9,pad=10,t=tip.getBoundingClientRect();
    let left=box.left+(box.width-t.width)/2;left=Math.max(pad,Math.min(innerWidth-t.width-pad,left));
    let top=box.top-t.height-gap;if(top<pad)top=Math.min(innerHeight-t.height-pad,box.bottom+gap);
    tip.style.left=Math.round(left)+'px';tip.style.top=Math.round(top)+'px';
  }
  function restoreTitle(el){if(el?.dataset.kcHoverTitle!==undefined){el.setAttribute('title',el.dataset.kcHoverTitle);delete el.dataset.kcHoverTitle;}}
  function show(info,{pin=false}={}){
    clearTimeout(showTimer);clearTimeout(hideTimer);if(current&&current!==info.el)restoreTitle(current);current=info.el;pinned=pin;
    if(info.el.hasAttribute('title')){info.el.dataset.kcHoverTitle=info.el.getAttribute('title')||'';info.el.removeAttribute('title');}
    const tip=ensure();tip.textContent=info.value;tip.hidden=false;tip.classList.toggle('pinned',pin);info.el.setAttribute('aria-describedby',TOOLTIP_ID);requestAnimationFrame(()=>place(info.el));
  }
  function hide(force=false){
    clearTimeout(showTimer);clearTimeout(hideTimer);if(pinned&&!force)return;
    if(current){current.removeAttribute('aria-describedby');restoreTitle(current);}current=null;pinned=false;if(tooltip){tooltip.hidden=true;tooltip.classList.remove('pinned');}
  }
  function schedule(info){clearTimeout(showTimer);clearTimeout(hideTimer);showTimer=setTimeout(()=>show(info),260);}
  document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const info=candidate(e.target);if(info)schedule(info);},true);
  document.addEventListener('pointerout',e=>{if(pinned||e.pointerType==='touch')return;if(current&&e.relatedTarget&&current.contains(e.relatedTarget))return;clearTimeout(showTimer);hideTimer=setTimeout(()=>hide(),90);},true);
  document.addEventListener('focusin',e=>{const info=candidate(e.target);if(info)show(info);},true);
  document.addEventListener('focusout',()=>{if(!pinned)hide();},true);
  document.addEventListener('pointerup',e=>{if(!['touch','pen'].includes(e.pointerType))return;const info=candidate(e.target);if(info){if(current===info.el&&pinned)hide(true);else show(info,{pin:true});}else hide(true);},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide(true);},true);
  addEventListener('scroll',()=>hide(true),true);addEventListener('resize',()=>{if(current&&!tooltip?.hidden)place(current);});
  window.KCDP=window.KCDP||{};window.KCDP.microtextZoom={version:'0.20.0-b150',hide:()=>hide(true)};
})();