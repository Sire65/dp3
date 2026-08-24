(function(){
 const K=window.KCDP=window.KCDP||{};const listeners=new Set();
 function emit(type,payload={}){for(const f of listeners)try{f({type,payload,version:K.VERSION})}catch(_){}}
 function publishedFeed(){const v=K.latestPublishedVersion?.();return {contract:'KC_DESIGNER_DUTY_FEED_V1',version:v?.version||null,publishedAt:v?.publishedAt||null,people:K.people.map(p=>{const shifts=(v?.shifts||[]).filter(s=>s.personId===p.personId&&s.zone!=='special'&&!['deleted','absent','failed','cancelled'].includes(s.status)).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);return {personId:p.personId,publicDisplayName:p.name,nextShift:shifts[0]||null};})};}
 function applyPeople(snapshot){return K.personAdapter?.applySnapshot?.(snapshot,{source:'KC_VERWALTUNG_HOST'});}
 function configureProviders(p={}){if(p.person)K.personAdapter?.setProvider?.(p.person);if(p.sync)K.sync?.setProvider?.(p.sync);if(p.weather)K.contextProviders?.setWeatherProvider?.(p.weather);if(p.program)K.contextProviders?.setProgramProvider?.(p.program);if(p.email)K.emailAdapter?.configure?.(p.email);if(p.push)K.pushAdapter?.configure?.(p.push);if(p.auth)K.session?.setProvider?.(p.auth);emit('providers.configured',{keys:Object.keys(p)});}
 K.hostBridge={version:'0.14.0',contract:'KC_DP_HOST_V1',capabilities:['people','published_feed','sync','weather','program','email','push','auth','timeclock','photo'],on(fn){listeners.add(fn);return()=>listeners.delete(fn);},publishedFeed,applyPeople,configureProviders,status(){return {version:K.VERSION,eventId:K.eventConfig?.eventId,sync:K.sync?.state?.status||'offline',people:K.people.length,publishedVersion:K.latestPublishedVersion?.()?.version||null};}};
 window.KCDPHostBridge=K.hostBridge;
})();
