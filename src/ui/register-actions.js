(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const MENUS={
    dashboard:[['refresh','↻ Aktualisieren'],['copy','⧉ Zusammenfassung kopieren'],['print','⎙ Drucken / PDF']],
    demand:[['demand-sync','↻ Wetter und Bühne aus PC Manager'],['demand-edit','✎ Grundbedarf bearbeiten'],['demand-copy','⧉ Bedarf auf anderen Tag kopieren'],['print','⎙ Drucken / PDF']],
    wish:[['wish-add','＋ Wunsch eintragen'],['wish-photo','📷 Planfoto einlesen'],['forms-center','▤ Formulare & Vorlagen'],['wish-template','⇩ Excel-Vorlage herunterladen'],['print','⎙ Drucken / PDF']],
    planned:[['plan-add','＋ Dienst anlegen'],['plan-check','✓ Plan prüfen'],['plan-quick','＋ Schnell einplanen'],['plan-publish','⇧ Sollplan veröffentlichen'],['print','⎙ Drucken / PDF']],
    actual:[['actual-import','⇩ Istzeiten importieren'],['print','⎙ Drucken / PDF']],
    matrix:[['plan-check','✓ Besetzungslücken prüfen'],['copy','⧉ Ansicht kopieren'],['print','⎙ Drucken / PDF']],
    deviations:[['copy','⧉ Übersicht kopieren'],['print','⎙ Drucken / PDF']],
    fairness:[['fair-csv','⇩ CSV herunterladen'],['copy','⧉ Zusammenfassung kopieren'],['print','⎙ Drucken / PDF']]
  };
  let popup=null;
  const activeId=button=>button?.dataset.v020Register||document.body.dataset.v020Register||'dashboard';
  function close(){popup?.remove();popup=null;document.querySelectorAll('.v020-tab-menu').forEach(x=>x.setAttribute('aria-expanded','false'))}
  function clickLater(id){setTimeout(()=>document.getElementById(id)?.click(),50)}
  async function copyView(){const text=document.getElementById('mainView')?.innerText?.trim()||'';if(!text)return;try{await navigator.clipboard.writeText(text);document.getElementById('messageText').textContent='Ansicht in die Zwischenablage kopiert.'}catch(_){alert('Kopieren ist in diesem Browser nicht freigegeben.')}}
  function run(action){close();if(action==='refresh'){K.render?.();return}if(action==='copy'){copyView();return}if(action==='print'){window.print();return}if(action==='demand-sync')return K.demandView?.sync?.();if(action==='demand-edit')return K.demandView?.edit?.();if(action==='demand-copy')return K.demandView?.copy?.();if(action==='wish-add')return clickLater('addWishInline');if(action==='wish-photo')return clickLater('photoBtn');if(action==='forms-center')return K.formsCenter?.open?.();if(action==='plan-add')return clickLater('addShiftBtn');if(action==='plan-check')return clickLater('checkBtn');if(action==='plan-quick')return clickLater('quickPlanBtn');if(action==='plan-publish')return clickLater('publishBtn');if(action==='actual-import')return clickLater('actualImportBtn');if(action==='fair-csv')return clickLater('fairCsv');if(action==='wish-template'){const a=document.createElement('a');a.href='templates/KC_DP2_Wunschzeiten_Vorlage_Weihnachtsmarkt_2026.xlsx';a.download='';a.click()}}
  function open(button,trigger){close();const id=activeId(button);K.v020Shell?.select?.(id,{quiet:true});popup=document.createElement('div');popup.className='v020-register-menu-popup';popup.setAttribute('role','menu');popup.innerHTML=(MENUS[id]||[['print','⎙ Drucken / PDF']]).map(([action,label])=>`<button type="button" role="menuitem" data-register-action="${action}">${label}</button>`).join('');document.body.appendChild(popup);const r=trigger.getBoundingClientRect(),left=Math.min(innerWidth-popup.offsetWidth-8,Math.max(8,r.left));popup.style.left=left+'px';popup.style.top=Math.min(innerHeight-popup.offsetHeight-8,r.bottom+5)+'px';trigger.setAttribute('aria-expanded','true');popup.querySelectorAll('[data-register-action]').forEach(x=>x.addEventListener('click',()=>run(x.dataset.registerAction)))}
  function install(){document.querySelectorAll('#v020RegisterBar [data-v020-register]').forEach(button=>{if(button.querySelector('.v020-tab-menu'))return;const menu=document.createElement('span');menu.className='v020-tab-menu';menu.setAttribute('role','button');menu.setAttribute('aria-label',`Aktionen für ${button.innerText.replace('⋮','').trim()}`);menu.setAttribute('aria-expanded','false');menu.textContent='☰';button.prepend(menu)});document.getElementById('v020RegisterBar')?.addEventListener('click',e=>{const menu=e.target.closest('.v020-tab-menu');if(!menu)return;e.preventDefault();e.stopImmediatePropagation();open(menu.closest('[data-v020-register]'),menu)},true);document.addEventListener('click',e=>{if(popup&&!e.target.closest('.v020-register-menu-popup')&&!e.target.closest('.v020-tab-menu'))close()});document.addEventListener('keydown',e=>{if(e.key==='Escape')close()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  K.registerActions={version:'0.20.0-b92',install,close,menus:MENUS};
})();
