(function(){
'use strict';
// Build 254: „Meine Angaben ausdrucken“ am Ende der Wunscheingabe – mit Twinkey, im einfachen Assistenten und in der Tagesmatrix.
// Ablauf: Sicherheitsabfrage → PDF erzeugen (ausgefüllter V12-Bogen, QR oben rechts, K.personalizedForms.filledPdf) →
// PDF-Vorschau anzeigen → erst danach drucken (oder öffnen/speichern). Es wird nichts gespeichert oder verändert.
const K=window.KCDP=window.KCDP||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const FRAGE='Deine gespeicherten Wunschzeiten werden als PDF erstellt – mit deinem persönlichen QR-Code oben rechts.\n\nZuerst siehst du eine Vorschau, gedruckt wird erst, wenn du dort „Drucken“ wählst.\n\nPDF jetzt erstellen?';
let offen=null;
function schliessen(){if(!offen)return;try{URL.revokeObjectURL(offen.url)}catch(_){}offen.box.remove();document.removeEventListener('keydown',offen.taste);offen.zurueck?.focus?.();offen=null;}
// Eingebettete PDF-Vorschau nur, wo der Browser PDFs selbst anzeigt (Desktop). Handys öffnen das PDF in ihrer Anzeige – dort ist Drucken eingebaut.
const inlinePdf=()=>navigator.pdfViewerEnabled===true&&!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
function vorschau(r){
  const blob=new Blob([r.bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),box=document.createElement('div'),zurueck=document.activeElement,inline=inlinePdf();
  box.className='wp-overlay';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','wpTitel');
  box.innerHTML=`<div class="wp-box"><div class="wp-kopf"><h2 id="wpTitel">Vorschau · Meine Wunschzeiten</h2><button type="button" class="ux-btn secondary" id="wpZu" aria-label="Vorschau schließen">✕</button></div>
  <p class="wp-info">${r.tage} Tag(e) mit Angaben${r.gesperrt?`, ${r.gesperrt} davon gesperrt`:''} · Profil ${esc(r.profileId)} im QR-Code oben rechts.</p>
  ${inline?`<iframe id="wpPdf" class="wp-pdf" title="PDF-Vorschau Meine Wunschzeiten" src="${url}"></iframe>`:`<p class="wp-hinweis">Das PDF ist fertig. Tippe auf „PDF öffnen“ – in der PDF-Anzeige deines Geräts kannst du es ansehen und von dort drucken oder teilen.</p>`}
  <div class="wp-aktionen">${inline?'<button type="button" class="ux-btn primary" id="wpDruck">🖨️ Drucken</button>':''}<button type="button" class="ux-btn ${inline?'secondary':'primary'}" id="wpOeffnen">📄 PDF öffnen</button><button type="button" class="ux-btn secondary" id="wpSpeichern">⬇️ Speichern</button><button type="button" class="ux-btn secondary" id="wpSchliessen">Schließen</button></div></div>`;
  document.body.appendChild(box);
  const taste=e=>{if(e.key==='Escape')schliessen()};document.addEventListener('keydown',taste);offen={box,url,taste,zurueck};
  const $=id=>box.querySelector('#'+id);
  $('wpZu').onclick=schliessen;$('wpSchliessen').onclick=schliessen;box.onclick=e=>{if(e.target===box)schliessen()};
  $('wpOeffnen').onclick=()=>{const w=window.open(url,'_blank');if(!w)location.assign(url)};
  $('wpSpeichern').onclick=()=>{const a=document.createElement('a');a.href=url;a.download=r.fileName;document.body.appendChild(a);a.click();a.remove()};
  if($('wpDruck'))$('wpDruck').onclick=()=>{const f=$('wpPdf');try{f.contentWindow.focus();f.contentWindow.print()}catch(_){const w=window.open(url,'_blank');if(!w)location.assign(url)}};
  ($('wpDruck')||$('wpOeffnen')).focus();
}
async function start(personId,{status}={}){
  const id=personId||K.currentUser?.personId,melde=t=>{if(typeof status==='function')status(t)};
  if(!id)return melde('Bitte zuerst anmelden.');
  if(!K.personalizedForms?.filledPdf)return melde('Der Ausdruck ist in dieser Ansicht nicht verfügbar.');
  if(!(K.mobileWishMatrix?.rows?.(id)||[]).length)return melde('Es sind noch keine Angaben gespeichert, die gedruckt werden können.');
  if(!window.confirm(FRAGE))return melde('Ausdruck abgebrochen.');
  melde('PDF wird erstellt …');
  try{const r=await K.personalizedForms.filledPdf(id);vorschau(r);melde('Vorschau geöffnet.');}catch(e){melde('PDF konnte nicht erstellt werden: '+(e?.message||e));}
}
// Knopf, den die drei Abschlüsse einsetzen (gleiches Aussehen und Verhalten überall)
function knopf(id='wpStart'){return `<button type="button" class="ux-btn secondary wp-start" id="${id}">🖨️ Meine Angaben ausdrucken (PDF mit QR)</button><p class="wp-status" id="${id}Status" role="status" aria-live="polite"></p>`;}
function binden(id='wpStart',personId){const b=document.getElementById(id);if(!b)return;const s=document.getElementById(id+'Status');b.onclick=()=>start(personId,{status:t=>{if(s)s.textContent=t}});}
K.wishPrint={version:'0.20.0-b254',start,knopf,binden,_test:{inlinePdf,FRAGE}};
})();
