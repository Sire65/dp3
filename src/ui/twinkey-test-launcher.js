(function(){
'use strict';const K=window.KCDP;
function open(){
 if(K.currentUser?.role!=='admin')throw Error('Die Twinkey-Testansicht ist für Administratoren vorgesehen.');
 if(document.getElementById('twinkeyTestOverlay'))return;
 const focus=document.activeElement,box=document.createElement('div');box.id='twinkeyTestOverlay';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Twinkey testen');
 box.style.cssText='position:fixed;inset:0;z-index:100000;background:#fff;display:flex;flex-direction:column';
 box.innerHTML='<header style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px;background:#fff4d9;border-bottom:1px solid #d6bd82;color:#332717"><strong>Twinkey-Test · Build 228 · nur Beispieldaten</strong><button id="twinkeyTestClose" type="button" style="margin-left:auto;min-height:44px;padding:8px 16px">Zurück zur Adminansicht</button></header><iframe title="Mitgliederführung mit Twinkey testen" sandbox="allow-scripts allow-modals" style="flex:1;width:100%;border:0;background:white"></iframe>';
 const frame=box.querySelector('iframe');frame.src=new URL('twinkey-test.html?build=228',document.baseURI).href;
 const siblings=[...document.body.children].filter(x=>x instanceof HTMLElement).map(x=>[x,x.inert]);siblings.forEach(([x])=>x.inert=true);
 document.body.appendChild(box);const close=()=>{box.remove();siblings.forEach(([x,was])=>x.inert=was);focus?.focus?.()};box.querySelector('button').onclick=close;box.querySelector('button').focus();
}
K.twinkeyTest={open};
})();
