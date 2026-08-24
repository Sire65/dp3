(function(){
 const K=window.KCDP=window.KCDP||{},clone=v=>JSON.parse(JSON.stringify(v));
 const DEDICATED_REF='ptblnpiroqftcvlsrhac';
 const DEDICATED_URL=`https://${DEDICATED_REF}.supabase.co`;
 const DEDICATED_KEY='sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24';
 const LEGACY_REFS=['iddudrxuihdodnvejxcp','lddudrxuihdodnvejjxcp','lddudrxuihdodnvejxcp'];
 const defaults={
  pcManager:{mode:'host',endpoint:'',expectedOrigin:'',autoSync:false},
  supabase:{url:DEDICATED_URL,publishableKey:DEDICATED_KEY,supabaseProjectRef:DEDICATED_REF,region:'London · eu-west-2',profile:'KC_DP_DEDICATED_PROJECT',orgId:'KC_WERNE',projectId:'KC_DP',authMode:'password',onlineSyncEnabled:true,autoSync:true,offlineAllowed:true,syncIntervalMinutes:1,deviceName:'',keyReviewRequired:false}
 };
 K.integrationConfig=K.integrationConfig||clone(defaults);
 function normalize(cfg){
  const x=clone(cfg||{}),sb={...defaults.supabase,...(x.supabase||{})};
  let migrated=false;
  const currentRef=String(sb.supabaseProjectRef||'').trim();
  const currentUrl=String(sb.url||'').trim();
  const pointsElsewhere=currentRef!==DEDICATED_REF||!currentUrl.includes(DEDICATED_REF);
  const legacy=LEGACY_REFS.some(ref=>currentRef===ref||currentUrl.includes(ref));
  if(pointsElsewhere||legacy){
    sb.url=DEDICATED_URL;
    sb.supabaseProjectRef=DEDICATED_REF;
    sb.publishableKey=DEDICATED_KEY;
    migrated=true;
  }
  if(!sb.publishableKey||sb.publishableKey!==DEDICATED_KEY||sb.keyReviewRequired){sb.publishableKey=DEDICATED_KEY;sb.keyReviewRequired=false;migrated=true;}
  sb.url=DEDICATED_URL;
  sb.supabaseProjectRef=DEDICATED_REF;
  sb.publishableKey=DEDICATED_KEY;
  sb.region=defaults.supabase.region;
  sb.profile=defaults.supabase.profile;
  sb.authMode='password';
  sb.keyReviewRequired=false;
  if(migrated)sb.migratedFrom=legacy?'FUTURA_SHARED_PROJECT':'NON_DEDICATED_CONFIG';
  return {pcManager:{...defaults.pcManager,...(x.pcManager||{})},supabase:sb};
 }
 K.integrations={version:'0.19.41',defaults:clone(defaults),snapshot(){return normalize(K.integrationConfig)},restore(cfg){K.integrationConfig=normalize(cfg);return this.snapshot();},update(section,patch){if(!defaults[section])throw new Error('Unbekannte Integration.');const merged=normalize(K.integrationConfig);merged[section]={...merged[section],...clone(patch||{})};K.integrationConfig=normalize(merged);K.recordAudit?.('integration.config.update',{entity:'integration_config',entityId:section,after:{...K.integrationConfig[section],publishableKey:section==='supabase'&&K.integrationConfig[section].publishableKey?'***gesetzt***':undefined}});return clone(K.integrationConfig[section]);}};
})();
