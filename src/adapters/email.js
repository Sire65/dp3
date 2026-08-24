(function(){
  const K=window.KCDP=window.KCDP||{};
  const state={provider:null,status:'not_configured',lastError:null,lastSendAt:null,lastBlockedAt:null};
  function configure(provider){if(!provider||typeof provider.send!=='function')throw new Error('E-Mail-Provider benötigt send(message).');state.provider=provider;state.status='ready';state.lastError=null;}
  function clear(){state.provider=null;state.status='not_configured';}
  function assertLive(bypassSafety=false){if(bypassSafety)return true;if(K.notificationChannelSafety&&K.notificationChannelSafety.isLive('email')!==true){state.status='test_mode';state.lastBlockedAt=new Date().toISOString();const e=new Error('E-Mail ist im TEST-Modus. Es wurde nichts versendet.');e.code='KC_NOTIFICATION_TEST_MODE';throw e;}return true;}
  async function send(message,options={}){if(!state.provider)throw new Error('Kein E-Mail-Provider verbunden. Versand wurde nicht vorgetäuscht.');assertLive(options?.bypassSafety===true);try{state.status='sending';const out=await state.provider.send(message);state.status='ready';state.lastSendAt=new Date().toISOString();return out;}catch(e){state.status='error';state.lastError=e.message;throw e;}}
  K.emailAdapter={version:'0.10.0-safety-gated',state,configure,clear,send,assertLive,hasProvider:()=>!!state.provider};
})();
