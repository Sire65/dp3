(function(){'use strict';
const K=window.KCDP=window.KCDP||{};
function el(id){return document.getElementById(id)}
function close(){el('plannedToolbarMenu')?.classList.remove('open');el('plannedToolbarMore')?.setAttribute('aria-expanded','false')}
function proxy(target){close();el(target)?.click()}
function sync(){
 const active=document.body.dataset.v020Register==='planned';
 const controls=document.querySelector('.plan-controls-main');if(!controls)return;
 let more=el('plannedToolbarMore');
 if(!more){
  const wrap=document.createElement('div');wrap.className='planned-toolbar-more-wrap';
  wrap.innerHTML='<button type="button" class="plan-chip planned-toolbar-more" id="plannedToolbarMore" aria-haspopup="menu" aria-expanded="false">⋯ Ansicht & mehr</button><div class="planned-toolbar-menu" id="plannedToolbarMenu" role="menu"><button type="button" data-plan-proxy="inspectorToggleBtn">ℹ Planinfo ein-/ausblenden</button><button type="button" data-plan-proxy="colorLegendBtn">◉ Farben und Zeichen erklären</button><button type="button" data-plan-proxy="planProgramChip">♪ Wetter- und Programmdetails</button></div>';
  controls.appendChild(wrap);more=el('plannedToolbarMore');
  more.onclick=e=>{e.stopPropagation();const menu=el('plannedToolbarMenu'),open=!menu.classList.contains('open');menu.classList.toggle('open',open);more.setAttribute('aria-expanded',String(open))};
  wrap.querySelectorAll('[data-plan-proxy]').forEach(b=>b.onclick=()=>proxy(b.dataset.planProxy));
 }
 more.closest('.planned-toolbar-more-wrap').hidden=!active;
 const check=el('checkBtn');if(check){const label=active?'✓ Plan prüfen':'✓ Prüfen',title=active?'Besetzung, Regeln, Pausen und Konflikte des Sollplans prüfen':'Plan prüfen';if(check.textContent!==label)check.textContent=label;if(check.title!==title)check.title=title}
 const gap=el('planGapChip');if(gap&&active&&!gap.textContent.includes('Lücken'))gap.textContent=gap.textContent.replace(/^⚠\s*/,'⚠ ')+' Lücken';
}
function install(){sync();window.addEventListener('kc-v020-register-change',()=>setTimeout(sync,0));new MutationObserver(()=>{if(!document.documentElement.dataset.plannedToolbarSync){document.documentElement.dataset.plannedToolbarSync='1';requestAnimationFrame(()=>{delete document.documentElement.dataset.plannedToolbarSync;sync()})}}).observe(document.querySelector('.plan-controls-main')||document.body,{childList:true,subtree:true,characterData:true});document.addEventListener('click',e=>{if(!e.target.closest?.('.planned-toolbar-more-wrap'))close()});document.addEventListener('keydown',e=>{if(e.key==='Escape')close()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
K.plannedToolbar={version:'0.20.0-b180',sync,close};
})();