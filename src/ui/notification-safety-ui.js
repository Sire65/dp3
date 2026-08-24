(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const RAW_RE=/DP2:\s*([^;]+);\s*canSend=(true|false);\s*Regel aktiv=(true|false);\s*previewOnly=(true|false);\s*messageSent=(true|false)/i;

  function parse(raw){
    const m=String(raw||'').match(RAW_RE);
    if(!m)return null;
    return {state:m[1].trim(),canSend:m[2]==='true',ruleActive:m[3]==='true',previewOnly:m[4]==='true',messageSent:m[5]==='true'};
  }

  function human(s){
    if(!s)return null;
    if(s.previewOnly||!s.canSend){
      return {
        level:'safe',
        title:'Testmodus – kein Versand',
        text:'Die Nachricht wird nur als Vorschau erzeugt. Es wurde nichts verschickt.',
        detail:`Regel ${s.ruleActive?'aktiv':'nicht aktiv'} · Versand gesperrt · Nachricht ${s.messageSent?'als gesendet markiert':'nicht gesendet'}`
      };
    }
    if(s.canSend&&s.ruleActive&&!s.messageSent){
      return {
        level:'armed',
        title:'Versand freigegeben – noch nicht gesendet',
        text:'Die Versandregel ist aktiv. Vor dem tatsächlichen Senden ist eine ausdrückliche Freigabe erforderlich.',
        detail:'Versandweg bereit · Sicherheitsfreigabe erforderlich'
      };
    }
    if(s.messageSent){
      return {
        level:'sent',
        title:'Nachricht wurde versendet',
        text:'Der Versand ist abgeschlossen. Details stehen im Versandprotokoll.',
        detail:'Versand abgeschlossen'
      };
    }
    return {level:'info',title:'Versandstatus',text:'Status konnte nicht eindeutig zugeordnet werden.',detail:String(s.state||'')};
  }

  function decorate(root=document){
    const nodes=[...root.querySelectorAll('div,section,article,p')];
    for(const el of nodes){
      if(el.dataset.kcSafetyDecorated==='1')continue;
      const txt=(el.innerText||'').trim();
      if(!txt.includes('Sicherheitsstatus')||!txt.includes('previewOnly='))continue;
      const parsed=parse(txt);
      const h=human(parsed);
      if(!h)continue;
      el.dataset.kcSafetyDecorated='1';
      el.dataset.kcSafetyLevel=h.level;
      el.innerHTML=`<div style="display:flex;gap:10px;align-items:flex-start"><span aria-hidden="true" style="font-size:22px;line-height:1">${h.level==='safe'?'🟢':h.level==='armed'?'🟡':h.level==='sent'?'✅':'ℹ️'}</span><div><strong style="display:block;font-size:1.05em">${h.title}</strong><div style="margin-top:4px">${h.text}</div><div style="margin-top:7px;font-size:.82em;opacity:.72">${h.detail}</div></div></div>`;
    }
  }

  function canDispatch(status){
    const s=typeof status==='string'?parse(status):status;
    return !!(s&&s.canSend&&s.ruleActive&&!s.previewOnly);
  }

  function assertDispatchAllowed(status,{confirmed=false}={}){
    if(!canDispatch(status))throw new Error('Versand ist durch den Sicherheitsstatus gesperrt.');
    if(!confirmed)throw new Error('Versand benötigt eine ausdrückliche Freigabe.');
    return true;
  }

  let loginTimer=null;
  function loginWatchdog(){
    const form=document.getElementById('uxLoginForm');
    if(!form||form.dataset.kcLoginWatchdog==='1')return;
    form.dataset.kcLoginWatchdog='1';
    form.addEventListener('submit',()=>{
      clearTimeout(loginTimer);
      const startedAt=Date.now();
      loginTimer=setTimeout(()=>{
        const current=document.getElementById('uxLoginForm');
        const btn=current?.querySelector('button[type="submit"]');
        if(!current||!btn||!btn.disabled||!/Anmeldung läuft/i.test(btn.textContent||''))return;
        sessionStorage.setItem('kc_dp_login_timeout_notice','1');
        try{K.supabaseConnection?.clearSession?.();}catch(_){}
        location.reload();
      },20000);
      K.loginWatchdogState={startedAt,timeoutMs:20000};
    },true);
  }

  function showLoginTimeoutNotice(){
    if(sessionStorage.getItem('kc_dp_login_timeout_notice')!=='1')return;
    sessionStorage.removeItem('kc_dp_login_timeout_notice');
    const tryShow=()=>{
      const card=document.querySelector('.ux-login-card');
      const h=card?.querySelector('h1');
      if(!card||!h)return false;
      const old=document.getElementById('kcLoginTimeoutNotice');if(old)old.remove();
      const n=document.createElement('div');
      n.id='kcLoginTimeoutNotice';
      n.className='ux-note ux-error';
      n.textContent='Die Anmeldung hat innerhalb von 20 Sekunden keine Antwort erhalten. Bitte Internetverbindung prüfen und erneut anmelden.';
      h.insertAdjacentElement('afterend',n);
      return true;
    };
    if(!tryShow()){let n=0;const t=setInterval(()=>{n++;if(tryShow()||n>40)clearInterval(t)},250);}
  }

  const observer=new MutationObserver(()=>{decorate(document);loginWatchdog();});
  function start(){decorate(document);loginWatchdog();showLoginTimeoutNotice();observer.observe(document.body,{childList:true,subtree:true,characterData:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  K.notificationSafetyUi={version:'0.19.56-preview-guard-login-watchdog',parse,human,canDispatch,assertDispatchAllowed,decorate,loginWatchdog};
})();
