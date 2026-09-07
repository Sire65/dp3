import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE),root=process.cwd();
let old=true;
const stale="self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(clients.claim()));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.pathname==='/version.js'&&!u.searchParams.has('kc_update'))e.respondWith(new Response('old'));});";
const server=createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/service-worker.js'){res.setHeader('Content-Type','text/javascript');res.end(old?stale:await readFile(root+'/service-worker.js'));return;}if(u.pathname==='/version.js'){res.end('new');return;}res.setHeader('Content-Type','text/html');res.end('<html><head></head><body>Preview test</body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{const page=await browser.newPage();await page.goto(url);await page.evaluate(async()=>{localStorage.setItem('user-data-sentinel','keep');await navigator.serviceWorker.register('/service-worker.js');await navigator.serviceWorker.ready;});await page.reload();assert.equal(await page.evaluate(async()=>await(await fetch('/version.js')).text()),'old');
old=false;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await new Promise(async resolve=>{navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});await r.update()});});
assert.equal(await page.evaluate(async()=>await(await fetch('/version.js')).text()),'new');
assert.equal(await page.evaluate(()=>localStorage.getItem('user-data-sentinel')),'keep');
console.log('Local cache migration OK: old worker replaced, fresh files served, local user storage preserved.');
}finally{await browser.close();await new Promise(r=>server.close(r))}

