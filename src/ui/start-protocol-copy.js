(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  if(K.__startProtocolCopyInstalled)return;
  K.__startProtocolCopyInstalled=true;

  function buildText(){
    const rows=K.loginTrace?.snapshot?.()||[];
    const base=rows[0]?.ms||Date.now();
    const body=rows.map(r=>{
      const d=Math.max(0,Number(r.ms||0)-base);
      const ico=r.status==='green'?'✓':r.status==='red'?'✕':'•';
      return `${ico} +${d} ms · ${r.stage}: ${r.detail}`;
    }).join('\n');
    return [
      'KC DP2 – Startprotokoll',
      `Erstellt: ${new Date().toLocaleString('de-DE')}`,
      `Einträge: ${rows.length}`,
      'Hinweis: Keine Passwörter, Sicherheitscodes oder Tokens enthalten.',
      '',
      body||'Noch keine Messwerte.'
    ].join('\n');
  }

  async function copyText(text){
    if(navigator.clipboard?.writeText){
      try{await navigator.clipboard.writeText(text);return true;}catch(_){}
    }
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.setAttribute('readonly','');
    Object.assign(ta.style,{position:'fixed',left:'-9999px',top:'0',opacity:'0'});
    document.body.appendChild(ta);
    ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);
    let ok=false;
    try{ok=document.execCommand('copy');}catch(_){}
    ta.remove();
    return ok;
  }

  function confirmDelete(){
    return new Promise(resolve=>{
      document.getElementById('kcStartProtocolDeleteConfirm')?.remove();
      const host=document.createElement('div');
      host.id='kcStartProtocolDeleteConfirm';
      Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'2147483647',background:'rgba(0,0,0,.62)',display:'grid',placeItems:'center',padding:'16px'});
      host.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="kcStartProtocolDeleteTitle" style="width:min(520px,96vw);background:#fff;border-radius:18px;padding:20px;box-shadow:0 18px 60px #0007;font-family:system-ui,Arial,sans-serif"><h2 id="kcStartProtocolDeleteTitle" style="margin:0 0 10px;color:#8f1422;font-size:22px">Startprotokoll wirklich löschen?</h2><p style="margin:0 0 10px;line-height:1.5;color:#333">Alle derzeit gespeicherten Einträge des Startprotokolls werden dauerhaft von diesem Gerät gelöscht.</p><p style="margin:0 0 18px;line-height:1.5;color:#6b625c"><b>Diese Aktion kann nicht rückgängig gemacht werden.</b></p><div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button id="kcStartProtocolDeleteCancel" type="button" style="min-height:44px;border:1px solid #cdbeb6;border-radius:10px;background:#fff;padding:0 16px;font-weight:800">Abbrechen</button><button id="kcStartProtocolDeleteConfirmBtn" type="button" style="min-height:44px;border:1px solid #b42318;border-radius:10px;background:#b42318;color:#fff;padding:0 16px;font-weight:800">Ja, Protokoll löschen</button></div></section>`;
      document.body.appendChild(host);
      const finish=v=>{host.remove();resolve(v)};
      host.querySelector('#kcStartProtocolDeleteCancel').onclick=()=>finish(false);
      host.querySelector('#kcStartProtocolDeleteConfirmBtn').onclick=()=>finish(true);
      host.addEventListener('click',e=>{if(e.target===host)finish(false)});
      const onKey=e=>{if(e.key==='Escape'){document.removeEventListener('keydown',onKey,true);finish(false)}};
      document.addEventListener('keydown',onKey,true);
      host.querySelector('#kcStartProtocolDeleteCancel')?.focus();
    });
  }

  function deleteProtocol(){
    try{
      localStorage.removeItem('kc_dp_login_trace_v1');
      return true;
    }catch(_){return false}
  }

  function inject(){
    const ov=document.getElementById('kcLoginTraceOverlay');
    if(!ov||document.getElementById('kcLoginTraceCopy'))return;
    const section=ov.querySelector('section'),pre=ov.querySelector('pre');
    if(!section||!pre)return;
    const row=pre.previousElementSibling;
    const host=row&&row.tagName==='DIV'?row:document.createElement('div');
    if(host!==row){host.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px';pre.before(host);}

    const copyBtn=document.createElement('button');
    copyBtn.id='kcLoginTraceCopy';copyBtn.type='button';copyBtn.textContent='📋 Alles kopieren';
    copyBtn.style.cssText='min-height:42px;border:1px solid #8f1422;border-radius:10px;background:#8f1422;color:#fff;padding:0 14px;font-weight:800;touch-action:manipulation';

    const deleteBtn=document.createElement('button');
    deleteBtn.id='kcLoginTraceDelete';deleteBtn.type='button';deleteBtn.textContent='🗑 Protokoll löschen';
    deleteBtn.style.cssText='min-height:42px;border:1px solid #b42318;border-radius:10px;background:#fff;color:#b42318;padding:0 14px;font-weight:800;touch-action:manipulation';

    const status=document.createElement('span');
    status.id='kcLoginTraceCopyStatus';status.setAttribute('role','status');status.style.cssText='align-self:center;color:#5d554f;font-size:.9rem';

    copyBtn.onclick=async()=>{
      copyBtn.disabled=true;const old=copyBtn.textContent;copyBtn.textContent='Wird kopiert …';
      const ok=await copyText(buildText());
      copyBtn.disabled=false;copyBtn.textContent=ok?'✓ Kopiert':old;
      status.textContent=ok?'Komplette Zeitlinie ist in der Zwischenablage. Jetzt hier in ChatGPT einfügen.':'Kopieren wurde vom Browser blockiert. Bitte erneut tippen oder Text markieren.';
      if(ok)setTimeout(()=>{if(copyBtn.isConnected)copyBtn.textContent=old;},1800);
    };

    deleteBtn.onclick=async()=>{
      const yes=await confirmDelete();
      if(!yes)return;
      const ok=deleteProtocol();
      if(ok){
        ov.remove();
        const msg=document.getElementById('messageText');
        if(msg)msg.textContent='Startprotokoll wurde vollständig gelöscht.';
        setTimeout(()=>K.loginTrace?.show?.(),80);
      }else{
        status.textContent='Startprotokoll konnte nicht gelöscht werden.';
      }
    };

    host.append(copyBtn,deleteBtn,status);
  }

  const obs=new MutationObserver(inject);
  if(document.body)obs.observe(document.body,{subtree:true,childList:true});
  else document.addEventListener('DOMContentLoaded',()=>obs.observe(document.body,{subtree:true,childList:true}),{once:true});
  document.addEventListener('click',e=>{if(e.target?.closest?.('#kcStartGuardBtn,#kcStartProtocolShow'))setTimeout(inject,80)},true);
  inject();
  K.startProtocolCopy={version:'0.19.55-copy-2-delete-confirm',inject,buildText,copyText,confirmDelete,deleteProtocol};
})();
