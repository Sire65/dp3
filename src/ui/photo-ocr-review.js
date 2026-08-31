(function(){
  'use strict';
  function confidence(row){const cells=row.cells||[],text=cells[6]?.textContent||'',m=text.match(/(\d+)\s*%/);return m?Number(m[1]):null}
  function classify(row){const start=row.querySelector('.prStart')?.value||'',end=row.querySelector('.prEnd')?.value||'',score=confidence(row);row.classList.remove('ocr-missing','ocr-partial','ocr-uncertain');let state,title;if(!start&&!end){state='ocr-missing';title='Nicht erkannt: Von- und Bis-Zeit bitte manuell eintragen.'}else if(!start||!end){state='ocr-partial';title='Unvollständig erkannt: fehlende Uhrzeit bitte ergänzen.'}else if(score!=null&&score<55){state='ocr-uncertain';title='Unsicherer OCR-Vorschlag: beide Uhrzeiten bitte kontrollieren.'}if(state){row.classList.add(state);row.title=title;row.setAttribute('aria-label',title)}else{row.removeAttribute('title');row.removeAttribute('aria-label')}}
  function enhance(){const body=document.getElementById('photoRows');if(!body)return;body.querySelectorAll('tr').forEach(classify);const tools=document.querySelector('.photo-tools');if(tools&&!tools.querySelector('.photo-ocr-legend'))tools.insertAdjacentHTML('afterend','<div class="photo-ocr-legend" aria-label="Legende der OCR-Erkennung"><span class="missing"><i></i>Nicht erkannt</span><span class="partial"><i></i>Unvollständig</span><span class="uncertain"><i></i>Unsicher</span></div>')}
  document.addEventListener('input',e=>{const row=e.target.closest?.('#photoRows tr');if(row)classify(row)});
  new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
  enhance();
})();
