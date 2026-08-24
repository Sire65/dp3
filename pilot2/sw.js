const ENDPOINT='https://ptblnpiroqftcvlsrhac.supabase.co/functions/v1/kc-dp-pilot';
const META='kc-dp2-pilot2-meta-v1';
const META_URL=new URL('__ctx__',self.registration.scope).toString();
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
async function save(ctx){const c=await caches.open(META);await c.put(META_URL,new Response(JSON.stringify(ctx),{headers:{'Content-Type':'application/json'}}))}
async function load(){try{const c=await caches.open(META),r=await c.match(META_URL);return r?await r.json():{}}catch(_){return{}}}
self.addEventListener('message',e=>{if(e.origin!==self.location.origin)return;if(e.data?.type!=='KC_DP_PILOT2_CONTEXT')return;e.waitUntil(save(e.data.ctx||{}).then(()=>e.ports?.[0]?.postMessage({ok:true})))});
async function report(data){if(data?.type!=='test')return;const ctx=await load();if(!ctx.token)return;try{await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'test_received',token:ctx.token,device:'handy:'+String(ctx.device||''),deviceClass:'handy',targetVersion:'0.19.51',pilotBuild:'0.19.51-simple1'})})}catch(_){}}
self.addEventListener('push',e=>{let p={};try{p=e.data?.json?.()||{}}catch(_){p={body:e.data?.text?.()||''}};const data=p.data||{};e.waitUntil(Promise.all([self.registration.showNotification(p.title||'KC DP2',{body:p.body||'Test erfolgreich.',data,tag:'kc-dp2-pilot2',renotify:true}),report(data)]))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil((async()=>{const wins=await clients.matchAll({type:'window',includeUncontrolled:true});for(const w of wins){if(w.url.includes('/pilot2/')&&'focus'in w)return w.focus()}return clients.openWindow?clients.openWindow('./'):undefined})())});
