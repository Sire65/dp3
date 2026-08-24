(function(){
 const K=window.KCDP=window.KCDP||{};let provider=typeof window.KCDPLockProvider==='function'?window.KCDPLockProvider:null;K.planLocks=K.planLocks||{};
 const state={enabled:false,provider:!!provider};
 const owner=()=>K.currentUser?.personId||'monitor';
 async function acquire(date){if(!state.enabled)return {status:'disabled'};if(provider){const r=await provider({action:'acquire',date,owner:owner(),ttlSeconds:120});if(!r?.ok)throw new Error(r?.message||'Plan ist bereits gesperrt.');}const lock={date,owner:owner(),ownerName:K.currentUser?.displayName||owner(),acquiredAt:new Date().toISOString(),expiresAt:new Date(Date.now()+120000).toISOString()};K.planLocks[date]=lock;return lock;}
 async function release(date){if(provider)await provider({action:'release',date,owner:owner()});if(K.planLocks[date]?.owner===owner()||K.auth?.has('*'))delete K.planLocks[date];return true;}
 function lockFor(date){const l=K.planLocks[date];if(l&&new Date(l.expiresAt).getTime()<Date.now()){delete K.planLocks[date];return null;}return l||null;}
 function editable(date){if(!state.enabled)return true;const l=lockFor(date);return !l||l.owner===owner();}
 function requireEditable(date){if(!editable(date)){const l=lockFor(date);throw new Error(`Plan ${date} ist durch ${l?.ownerName||'anderen Benutzer'} gesperrt.`);}return true;}
 K.locks={version:'0.15.0',state,setEnabled(v){state.enabled=!!v;},setProvider(fn){provider=typeof fn==='function'?fn:null;state.provider=!!provider;},acquire,release,lockFor,editable,requireEditable};
})();
