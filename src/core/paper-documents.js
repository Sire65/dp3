// Build 267 KC-DP-PLANERPAPIERE-QR (Wunsch Hansi „alle Formulare personalisiert mit QR-Code, der in DP2 eingelesen werden kann“ – Paket 2):
// Leerplan, Besetzungsmatrix für Papierplanung und persönlicher Dienstplan tragen einen QR nach dem Dokumentvertrag KCDP-DOC-1
// (Art, Tag bzw. Zeitraum, Person, Planversion). DP2 erkennt das Papier beim Fotografieren/Scannen und sagt, was es ist und was zu tun ist –
// ein veralteter Dienstplan wird als veraltet gemeldet. Es wird nichts still übernommen.
(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
const KINDS={'empty-plan-v1':'Leerplan','paper-staffing-v1':'Besetzungsmatrix für Papierplanung','personal-plan-v1':'Persönlicher Dienstplan'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tag=d=>{const m=String(d||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:String(d||'')};
const current=()=>K.latestPublishedVersion?.()?.version??null;
function payload(kind,{personId='',date='',periodId='',version=''}={}){
  if(!KINDS[kind])throw new Error(`Unbekannte Papierart: ${kind}`);
  if(!K.documentIdentity?.encode)throw new Error('Dokumentvertrag (document-identity.js) ist nicht geladen.');
  return K.documentIdentity.encode({docType:kind,personId,date,periodId:periodId||(date?`${date}_${date}`:''),version:String(version??'')});
}
function label(kind,{date='',personId='',version=''}={}){const kurz={'empty-plan-v1':'LEERPLAN','paper-staffing-v1':'PAPIERPLANUNG','personal-plan-v1':'DIENSTPLAN'}[kind]||'DP2';return [kurz,date?tag(date):'',personId,version!==''&&version!=null?`V${version}`:''].filter(Boolean).join(' · ')}
// Platzhalter im HTML: wird für PDF (pdf.js) und für den Browserdruck (fillRoot) ausgewertet
function placeholder(kind,meta={}){return `<div class="doc-qr" data-kc-qr="${esc(payload(kind,meta))}" data-kc-qr-label="${esc(label(kind,meta))}"></div>`}
async function svg(raw){
  const m=await K.personalizedForms.qrFor(raw),n=m.length;let d='';
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m[r][c])d+=`M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n} ${n}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-label="QR-Code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
async function fillRoot(root){
  const els=[...(root?.querySelectorAll?.('.doc-qr[data-kc-qr]')||[])],cache=new Map();
  for(const el of els){const raw=el.getAttribute('data-kc-qr');if(!cache.has(raw))cache.set(raw,svg(raw));
    try{el.innerHTML=`${await cache.get(raw)}<b>${esc(el.getAttribute('data-kc-qr-label')||'')}</b>`;}catch(e){el.innerHTML='<b style="color:#b00">QR-Code fehlt</b>';}}
  return els.length;
}
function recognize(raw){
  const x=K.documentIdentity?.decode?.(raw);if(!x||!KINDS[x.docType])return null;
  const person=x.personId?K.person?.(x.personId)||(K.people||[]).find(p=>p.personId===x.personId):null,cur=current(),v=x.version===''||x.version==null?null:Number(x.version);
  const zeitraum=x.periodId?String(x.periodId).split('_').map(tag).filter((a,i,l)=>l.indexOf(a)===i).join(' bis '):'';
  const outdated=x.docType==='personal-plan-v1'&&v!=null&&cur!=null&&Number(cur)>v;
  let text;
  if(x.docType==='personal-plan-v1')text=`${KINDS[x.docType]} von ${person?.name||x.personId||'unbekannt'}${zeitraum?` (${zeitraum})`:''}${v!=null?`, Planversion V${v}`:', nicht veröffentlicht'}`+(outdated?` – ACHTUNG: veraltet, aktuell ist V${cur}. Bitte neu ausdrucken.`:cur!=null&&v===Number(cur)?' – aktuell.':'.');
  else if(x.docType==='empty-plan-v1')text=`${KINDS[x.docType]} vom ${tag(x.date)} – die handschriftlichen Zeiten bitte in der Ist-Erfassung für diesen Tag eintragen.`;
  else text=`${KINDS[x.docType]} vom ${tag(x.date)} – die eingetragenen Namen bitte in der Planung für diesen Tag übernehmen.`;
  return{kind:x.docType,name:KINDS[x.docType],personId:x.personId||'',person:person||null,date:x.date||'',periodId:x.periodId||'',version:v,current:cur,outdated,text,token:x.token};
}
K.paperDocuments={version:'1.0.0-b267',KINDS,payload,label,placeholder,svg,fillRoot,recognize};
})();
