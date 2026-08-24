(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function isTestRow(r){
  const code=String(r?.error_code||'').toLowerCase(),msg=String(r?.message||'').toLowerCase();
  return code.startsWith('e2e.')||code.startsWith('test.')||code.endsWith('.test')||msg.includes('kontrollierter e2e')||msg.includes('kontrollierte testmeldung');
}
function visibleRows(host){
  const rows=Array.isArray(host?._kcDiagRows)?host._kcDiagRows:[];
  const filter=host?.querySelector?.('#kcDiagFilter')?.value||'open';
  const q=String(host?.querySelector?.('#kcDiagSearch')?.value||'').trim().toLowerCase();
  return rows.filter(r=>{
    const status=String(r?.status||'').toLowerCase(),test=isTestRow(r);
    let ok=true;
    if(filter==='open')ok=!test&&(status==='new'||status==='reviewed');
    else if(filter==='new')ok=!test&&status==='new';
    else if(filter==='resolved')ok=!test&&status==='resolved';
    else if(filter==='tests')ok=test;
    else if(filter==='all')ok=!test;
    else if(filter==='all_with_tests')ok=true;
    if(!ok)return false;
    if(!q)return true;
    return [r.error_code,r.message,r.member_name,r.person_id,r.device_id,r.app_version,r.status,r.platform,r.browser,r.source,r.route,r.stack].some(v=>String(v||'').toLowerCase().includes(q));
  });
}
function firstStackLocation(stack){
  const s=String(stack||'');
  const m=s.match(/(?:https?:\/\/[^\s)]+|[^\s()]+\.js[^\s)]*):\d+(?::\d+)?/);
  return m?.[0]||'';
}
function decorate(){
  const host=document.getElementById('kcDiagOverlay');
  if(!host)return;
  const body=host.querySelector('#kcDiagBody');
  if(!body)return;
  const rows=visibleRows(host),cards=[...body.querySelectorAll(':scope > article')];
  cards.forEach((card,i)=>{
    if(card.dataset.kcTechDetails==='1')return;
    const r=rows[i];if(!r)return;
    const stack=r.stack||r.stack_trace||r.error_stack||'';
    const source=r.source||r.filename||r.file_name||'';
    const route=r.route||'';
    const location=firstStackLocation(stack);
    const device=r.device_id||'';
    const platform=r.platform||'';
    const browser=r.browser||'';
    const hasTech=stack||source||route||device||platform||browser;
    if(!hasTech)return;
    const details=document.createElement('details');
    details.style.cssText='margin-top:12px;padding-top:10px;border-top:1px solid #e4ddd8';
    details.innerHTML=`<summary style="cursor:pointer;font-weight:700;color:#7e1826">Technische Details</summary><div style="margin-top:10px;font-size:.9rem;line-height:1.45;overflow-wrap:anywhere">${source?`<div><b>Datei/Quelle:</b> ${esc(source)}</div>`:''}${location?`<div><b>Erste Stack-Stelle:</b> ${esc(location)}</div>`:''}${route?`<div><b>Route:</b> ${esc(route)}</div>`:''}${device?`<div><b>Gerät:</b> ${esc(device)}</div>`:''}${platform?`<div><b>Plattform:</b> ${esc(platform)}</div>`:''}${browser?`<div><b>Browser:</b> ${esc(browser)}</div>`:''}${stack?`<div style="margin-top:8px"><b>Stacktrace:</b><pre style="white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 0;padding:10px;border-radius:8px;background:#f7f4f2;font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace">${esc(stack)}</pre></div>`:''}</div>`;
    card.appendChild(details);
    card.dataset.kcTechDetails='1';
  });
}
function schedule(){setTimeout(decorate,80);setTimeout(decorate,350);}
document.addEventListener('click',e=>{if(e.target?.closest?.('#kcDiagLoad'))schedule();},true);
document.addEventListener('change',e=>{if(e.target?.id==='kcDiagFilter')schedule();},true);
document.addEventListener('input',e=>{if(e.target?.id==='kcDiagSearch')schedule();},true);
window.addEventListener('pageshow',schedule);
schedule();
K.diagnosticsHistoryView={version:'0.19.72-tech-details',decorate};
})();
