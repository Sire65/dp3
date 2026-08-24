(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
const VALID=new Set(['V','H','B']);
const normalize=v=>{const s=String(v??'').trim().toUpperCase();return VALID.has(s)?s:'B';};
const label=v=>normalize(v)==='V'?'V · vorne':normalize(v)==='H'?'H · hinten':'B · beides';
const short=v=>normalize(v);

K.wishZone={values:['V','H','B'],normalize,label,short};
(K.wishes||[]).forEach(w=>{w.wishZone=normalize(w.wishZone)});

const originalValidateWish=K.validateWish;
if(typeof originalValidateWish==='function')K.validateWish=function(w){
  const out=[...(originalValidateWish.call(this,w)||[])];
  const raw=String(w?.wishZone??'B').trim().toUpperCase();
  if(!VALID.has(raw))out.push({level:'error',text:'Einsatzbereich muss V (vorne), H (hinten) oder B (beides) sein.'});
  return out;
};

const originalSaveWish=K.mutations?.saveWish;
if(typeof originalSaveWish==='function')K.mutations.saveWish=function(record,meta){
  const raw=document.getElementById('wZone')?.value ?? record?.wishZone ?? 'B';
  const zone=String(raw).trim().toUpperCase();
  if(!VALID.has(zone))throw new Error('Einsatzbereich: ausschließlich V, H oder B auswählen.');
  return originalSaveWish.call(this,{...record,wishZone:zone},meta);
};

const originalValidateShift=K.validateShift;
if(typeof originalValidateShift==='function')K.validateShift=function(shift){
  const out=[...(originalValidateShift.call(this,shift)||[])];
  if(!shift||!['front','back'].includes(shift.zone))return out;
  const wanted=shift.zone==='front'?'V':'H';
  const conflicts=(K.wishes||[]).filter(w=>w.personId===shift.personId&&w.date===shift.date&&w.status!=='deleted'&&!['unavailable','deleted','cancelled'].includes(w.wishType)&&Math.max(Number(w.start),Number(shift.start))<Math.min(Number(w.end),Number(shift.end))&&normalize(w.wishZone)!=='B'&&normalize(w.wishZone)!==wanted);
  if(conflicts.length)out.push({level:'error',text:`Einsatzbereich verletzt Wunschangabe: ${wanted==='V'?'vorne':'hinten'} ist in diesem Zeitfenster nicht freigegeben (${conflicts.map(w=>short(w.wishZone)).join('/')}).`});
  return out;
};

function addZoneToWishDialog(){
  const type=document.getElementById('wType');
  if(!type||document.getElementById('wZone'))return;
  const modal=type.closest('#modal');if(!modal)return;
  const id=modal.querySelector('#wSave')?null:null;
  const editingId=document.querySelector('.wish-bar.preview')?.dataset?.wish||null;
  let current='B';
  const person=document.getElementById('wPerson')?.value,date=document.getElementById('wDate')?.value,start=document.getElementById('wStart')?.value;
  const toNum=t=>{if(!t)return null;const [h,m]=t.split(':').map(Number);return h+m/60};
  const found=(K.wishes||[]).find(w=>w.personId===person&&w.date===date&&(editingId?w.id===editingId:Math.abs(Number(w.start)-Number(toNum(start)))<0.001));
  if(found)current=normalize(found.wishZone);
  const field=document.createElement('div');field.className='field';
  field.innerHTML=`<label>Einsatz V/H/B</label><select id="wZone" aria-label="Einsatzbereich"><option value="V">V · nur vorne</option><option value="H">H · nur hinten</option><option value="B">B · beides</option></select><small style="display:block;margin-top:4px">Nur diese drei Werte sind zulässig.</small>`;
  type.closest('.field')?.insertAdjacentElement('afterend',field);
  document.getElementById('wZone').value=current;
}

function decorate(){
  addZoneToWishDialog();
  document.querySelectorAll('.wish-bar[data-wish]').forEach(el=>{
    const w=(K.wishes||[]).find(x=>x.id===el.dataset.wish),lab=el.querySelector('.shift-label');
    if(!w||!lab)return;const z=` · ${short(w.wishZone)}`;if(!lab.textContent.endsWith(z))lab.textContent=lab.textContent.replace(/ · [VHB]$/,'')+z;
  });
  document.querySelectorAll('[data-copywish]').forEach(box=>{
    const w=(K.wishes||[]).find(x=>x.id===box.dataset.copywish),small=box.closest('.ws-slot')?.querySelector('small');
    if(!w||!small)return;const z=` · ${short(w.wishZone)}`;if(!small.textContent.endsWith(z))small.textContent+=z;
  });
}
const observer=new MutationObserver(()=>queueMicrotask(decorate));
observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(decorate,0);
})();