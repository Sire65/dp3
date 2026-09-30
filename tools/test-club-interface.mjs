import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'tmp/club-interface-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/*',route=>route.abort());
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="modalBackdrop"><div id="modal"></div></div></body></html>');
 await page.addStyleTag({content:'body{font:16px Arial;margin:0}#modal{max-width:100%;box-sizing:border-box}button,input{max-width:100%;box-sizing:border-box}[data-club-status]{overflow-wrap:anywhere}'});
 await page.addStyleTag({content:await readFile(path.join(root,'src/ui/email-center.css'),'utf8')});
 for(const file of ['core/model','core/wish-contract','core/planning','core/auth','core/configuration','core/mobile-wish-matrix','core/days-publish-bridge','core/club-wish-inbox','ui/simple-wish-assistant','ui/email-center'])await page.addScriptTag({content:await readFile(path.join(root,'src/'+file+'.js'),'utf8')});
 await page.evaluate(()=>{
  const K=window.KCDP;K.currentUser={role:'admin',personId:K.people[1].personId};K.integrationConfig={supabase:{orgId:'KC_WERNE'}};
  K.memberUxData={clubWishInbox:{'["KC_WERNE","KC-WM-2026"]':{receipts:{},metadata:{},lastRunAt:'2026-09-30T12:00:00Z',lastResult:{added:3,problems:[{date:'2026-12-04',text:'Die Wunschzeit muss innerhalb der Kann-Zeit liegen. <img src=x onerror="window.injected=true">'}]}}}};
  K.emailCenter.open();
 });
 assert.match(await page.locator('[data-club-status]').innerText(),/Club-App: 3 Wünsche übernommen/);assert.match(await page.locator('[data-club-status]').innerText(),/innerhalb der Kann-Zeit/);assert.equal(await page.locator('[data-club-status] img').count(),0,'Inbox problem text must be escaped');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});const box=await page.locator('[data-club-status]').boundingBox();assert(box.width>200&&box.x>=0&&box.x+box.width<=width+1,'Club status fits viewport '+width);assert(await page.locator('[data-club-status]').evaluate(e=>e.scrollHeight<=e.clientHeight+1),'Problem list must not be clipped '+width);await page.screenshot({path:path.join(out,'club-status-'+width+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);console.log('Club-App browser PASS: visible counts/date/problems, safe text rendering, status fits 320/390/768/1280px.');
}finally{await browser.close();}
