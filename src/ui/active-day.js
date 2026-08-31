(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
function selectedDate(){
  if(document.body.dataset.v020Register==='matrix')return K.days?.[K.hourMatrix?.state?.dayIndex]?.date||'';
  if(document.body.dataset.v020Register==='deviations')return K.days?.[K.deviationsView?.state?.dayIndex]?.date||'';
  if(document.body.dataset.v020Register==='demand')return K.days?.[K.demandView?.state?.dayIndex]?.date||'';
  return K.day?.()?.date||K.days?.[K.state?.dateIndex||0]?.date||'';
}
function mark(){
  const date=selectedDate();if(!date)return;
  document.querySelectorAll('[data-dev-row]').forEach(row=>row.classList.toggle('current-day',row.dataset.devRow?.split('|').at(-1)===date));
  document.querySelectorAll('.dash-table-wrap tbody tr').forEach(row=>row.classList.toggle('current-day',row.cells?.[0]?.textContent?.trim()===date));
  document.querySelectorAll('.summary-table [data-jump-date]').forEach(cell=>cell.classList.toggle('current-day-cell',cell.dataset.jumpDate===date));
}
function install(){new MutationObserver(mark).observe(document.getElementById('mainView')||document.body,{childList:true,subtree:true});window.addEventListener('kc-v020-register-change',()=>setTimeout(mark,0));mark()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
K.activeDayMarker={version:'0.20.0-b120',mark};
})();
