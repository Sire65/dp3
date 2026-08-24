(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const $=id=>document.getElementById(id);

  const isSession=()=>{
    const modal=$('modal');
    if(!modal)return false;
    const title=modal.querySelector('h2')?.textContent||'';
    return title.includes('Anmeldung')&&title.includes('Monitor');
  };

  function hardClose(){
    const back=$('modalBackdrop'),modal=$('modal');
    back?.classList.add('hidden');
    if(modal){modal.innerHTML='';modal.classList.remove('wide')}
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
  }

  function bindHardClose(el){
    if(!el||el.dataset.kcHardClose==='1')return;
    el.dataset.kcHardClose='1';
    const close=e=>{e?.preventDefault?.();e?.stopPropagation?.();hardClose()};
    el.addEventListener('click',close,{capture:true});
  }

  function ensureClose(){
    if(!isSession())return;
    const modal=$('modal'),h2=modal?.querySelector('h2');
    if(!h2)return;
    let x=$('kcSessionGuardClose');
    if(!x){
      h2.style.position='relative';h2.style.paddingRight='62px';
      x=document.createElement('button');
      x.id='kcSessionGuardClose';x.type='button';x.textContent='×';x.setAttribute('aria-label','Fenster schließen');
      Object.assign(x.style,{position:'absolute',right:'0',top:'50%',transform:'translateY(-50%)',width:'52px',height:'52px',borderRadius:'50%',border:'1px solid #d8c9c1',background:'#fff',fontSize:'34px',lineHeight:'44px',zIndex:'9999',touchAction:'manipulation'});
      h2.appendChild(x);
    }
    bindHardClose(x);
    bindHardClose($('sessionClose'));
  }

  function markFallback(){
    if(!isSession()||K.session?.state?.provider)return;
    const modal=$('modal');const boxes=[...modal.querySelectorAll('.ai-summary')];
    const target=boxes.find(x=>(x.textContent||'').includes('Candidate-Fallback'));
    if(target){target.style.borderColor='#d7a34a';target.style.background='#fff8e8';target.title='Produktivbetrieb ohne verbundenen KC-Auth-Provider';}
  }

  function wire(){
    if(!isSession())return;
    ensureClose();markFallback();
    // Wichtig: Dieser Legacy-Guard greift die Fehlerdiagnose NICHT mehr ab.
    // Der Diagnosebutton wird ausschließlich von K.diagnosticsWatchdog gesteuert.
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(wire));
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('click',e=>{if(e.target?.id==='userBtn')setTimeout(wire,0)},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isSession()){e.preventDefault();hardClose()}},true);
  wire();

  K.sessionDiagnosticsGuard={version:'0.19.64-close-only',wire,hardClose};
})();
