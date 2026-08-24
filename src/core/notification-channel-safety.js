(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const STORE='kc_dp_notification_channel_safety_v1';
  const DEFAULT={push:{mode:'test',armed:false,changedAt:null,changedBy:null},email:{mode:'test',armed:false,changedAt:null,changedBy:null}};
  const clone=v=>JSON.parse(JSON.stringify(v));
  function load(){try{const raw=localStorage.getItem(STORE);if(!raw)return clone(DEFAULT);const x=JSON.parse(raw);return{push:{...DEFAULT.push,...(x.push||{})},email:{...DEFAULT.email,...(x.email||{})}}}catch(_){return clone(DEFAULT)}}
  let state=load();
  function save(){localStorage.setItem(STORE,JSON.stringify(state));return snapshot()}
  function snapshot(){return clone(state)}
  function channel(name){if(!['push','email'].includes(name))throw new Error('Unbekannter Versandkanal.');return clone(state[name])}
  function isLive(name){const c=state[name];return !!(c&&c.mode==='live'&&c.armed===true)}
  function isTest(name){return !isLive(name)}
  function status(name){const c=channel(name);return{...c,live:isLive(name),label:isLive(name)?'LIVE – Versand aktiv':'TEST – kein Versand'}}
  function allowedAdmin(){return String(K.currentUser?.role||'')==='admin'||K.auth?.has?.('*')===true}
  function setMode(name,mode,{confirmation=''}={}){
    if(!allowedAdmin())throw new Error('Nur Admin darf den Versandmodus ändern.');
    if(!['test','live'].includes(mode))throw new Error('Ungültiger Versandmodus.');
    if(mode==='live'&&String(confirmation).trim().toUpperCase()!=='LIVE')throw new Error('Für LIVE-Versand muss LIVE ausdrücklich bestätigt werden.');
    const before=channel(name),now=new Date().toISOString(),who=K.currentUser?.personId||K.currentUser?.name||'admin';
    state[name]={mode,armed:mode==='live',changedAt:now,changedBy:who};
    save();
    K.recordAudit?.('notifications.channel.mode',{entity:'notification_channel_safety',entityId:name,before,after:channel(name)});
    K.sync?.enqueue?.({entity:'notification_channel_safety',operation:'update',payload:{channel:name,...channel(name)},baseVersion:null});
    window.dispatchEvent(new CustomEvent('kc-notification-safety-change',{detail:{channel:name,status:status(name)}}));
    return status(name);
  }
  function forceTest(name){const before=channel(name),now=new Date().toISOString();state[name]={mode:'test',armed:false,changedAt:now,changedBy:K.currentUser?.personId||'system'};save();K.recordAudit?.('notifications.channel.force_test',{entity:'notification_channel_safety',entityId:name,before,after:channel(name)});return status(name)}
  function guard(name){if(!isLive(name)){const e=new Error(`${name==='push'?'Push':'E-Mail'} ist im TEST-Modus. Es wurde nichts versendet.`);e.code='KC_NOTIFICATION_TEST_MODE';throw e}return true}
  function resetAll(){state=clone(DEFAULT);save();return snapshot()}
  K.notificationChannelSafety={version:'0.19.56',snapshot,channel,status,isLive,isTest,setMode,forceTest,guard,resetAll,allowedAdmin};
})();
