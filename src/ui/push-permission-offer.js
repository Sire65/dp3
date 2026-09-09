(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const DISMISS_KEY='kcdp_push_offer_dismissed_v1';
  let handled=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function dismissed(){try{return localStorage.getItem(DISMISS_KEY)==='1'}catch(_){return false}}
  function remember(){try{localStorage.setItem(DISMISS_KEY,'1')}catch(_){}}
  function shouldOffer(){
    if(handled)return false;
    if(!K.currentUser?.personId)return false;
    if(!K.pushAdapter?.supported?.())return false;
    if(typeof Notification==='undefined'||Notification.permission!=='default')return false;
    if(K.pushAdapter.hasSubscription(K.currentUser.personId))return false;
    if(dismissed())return false;
    return true;
  }
  function close(){document.getElementById('kcPushOfferOverlay')?.remove()}
  function show(){
    if(document.getElementById('kcPushOfferOverlay'))return;
    handled=true;
    const host=document.createElement('div');
    host.id='kcPushOfferOverlay';
    host.innerHTML=`<style>
#kcPushOfferOverlay{position:fixed;top:calc(78px + env(safe-area-inset-top));right:calc(14px + env(safe-area-inset-right));z-index:2147483000;display:flex;justify-content:flex-end}
#kcPushOfferOverlay .kc-po-badge{pointer-events:auto;width:46px;height:46px;border-radius:50%;border:0;background:#741521;color:#fff;font-size:20px;box-shadow:0 8px 22px #0004;cursor:pointer;display:flex;align-items:center;justify-content:center}
#kcPushOfferOverlay .kc-po-card{display:none;pointer-events:auto;width:min(300px,calc(100vw - 28px));background:#fff;border:1px solid #e7dada;border-radius:16px;padding:16px;box-shadow:0 14px 40px #0003;font-family:inherit}
#kcPushOfferOverlay.kc-po-open .kc-po-badge{display:none}
#kcPushOfferOverlay.kc-po-open .kc-po-card{display:block}
#kcPushOfferOverlay h2{margin:0 0 7px;color:#741521;font-size:15.5px}
#kcPushOfferOverlay p{margin:0 0 12px;font-size:12.5px;line-height:1.5;color:#4a3f3f}
#kcPushOfferOverlay .kc-po-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
#kcPushOfferOverlay button{border:0;border-radius:10px;padding:9px 13px;font-weight:750;font-size:12.5px;cursor:pointer}
#kcPushOfferOverlay .kc-po-primary{background:#741521;color:#fff}
#kcPushOfferOverlay .kc-po-secondary{background:#efe8e4;color:#4a3f3f}
#kcPushOfferOverlay .kc-po-status{margin-top:9px;font-size:11.5px;color:#4a3f3f}
</style>
<button type="button" class="kc-po-badge" id="kcPushOfferBadge" aria-label="Erinnerungen aktivieren">🔔</button>
<div class="kc-po-card"><h2>🔔 Erinnerungen aktivieren?</h2><p>KC DP2 kann Sie automatisch an offene Wunschabgaben, Planänderungen und Vertretungsanfragen erinnern. Dafür braucht es einmalig Ihre Erlaubnis für Benachrichtigungen auf diesem Gerät.</p><div class="kc-po-actions"><button type="button" class="kc-po-secondary" id="kcPushOfferLater">Später</button><button type="button" class="kc-po-primary" id="kcPushOfferEnable">Aktivieren</button></div><div class="kc-po-status" id="kcPushOfferStatus"></div></div>`;
    document.body.appendChild(host);
    host.querySelector('#kcPushOfferBadge').onclick=()=>host.classList.add('kc-po-open');
    host.querySelector('#kcPushOfferLater').onclick=()=>{remember();close();};
    host.querySelector('#kcPushOfferEnable').onclick=async()=>{
      const btn=host.querySelector('#kcPushOfferEnable'),status=host.querySelector('#kcPushOfferStatus');
      btn.disabled=true;status.textContent='Browserfreigabe wird angefordert …';
      try{
        await K.pushAdapter.subscribe(K.currentUser.personId);
        await K.persistAll?.();
        status.textContent='Erinnerungen sind jetzt aktiv.';
        remember();
        setTimeout(close,1100);
      }catch(e){
        status.textContent=esc(e?.message||'Push konnte nicht aktiviert werden.');
        btn.disabled=false;
      }
    };
  }
  function maybeOffer(){if(document.body.classList.contains('ux-role')&&shouldOffer())show();}
  document.addEventListener('DOMContentLoaded',()=>{
    new MutationObserver(maybeOffer).observe(document.body,{attributes:true,attributeFilter:['class']});
    setTimeout(maybeOffer,600);
  });
})();
