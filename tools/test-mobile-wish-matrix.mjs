import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(root,'tmp/mobile-matrix-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('http://matrix.test/**',async route=>{const file=new URL(route.request().url()).pathname.slice(1);try{await route.fulfill({body:await readFile(path.join(root,file)),contentType:file.endsWith('.svg')?'image/svg+xml':'image/webp'})}catch{await route.abort()}});
 await page.setContent('<!doctype html><html><head><base href="http://matrix.test/"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="kcdpUxRoot"></div></body></html>');
 const html=await readFile(path.join(root,'index.html'),'utf8');
 const css=[...html.matchAll(/<link[^>]+href="([^"?]+\.css)[^"]*"/g)].map(x=>x[1]).filter(x=>!x.startsWith('http'));
 for(const file of css)await page.addStyleTag({content:await readFile(path.join(root,file),'utf8')});
 await page.evaluate(()=>{
  window.KCDP={days:[{date:'2026-12-04',start:11,end:23,type:'market'},{date:'2026-12-05',start:11,end:23,type:'market'},{date:'2026-12-06',start:11,end:23,type:'market'}],people:[{personId:'me',name:'Anna Beispiel',active:true,personType:'member'},{personId:'friend',name:'Bernd Beispiel',active:true,personType:'member'}],currentUser:{personId:'me',displayName:'Anna Beispiel',role:'employee'},state:{wishPhase:'open'},workflow:{status:'draft'},wishes:[],eventConfig:{name:'Weihnachtsmarkt 2026'},memberUxData:{},persistAll:async()=>{},requirementFor:()=>({total:2}),person(id){return this.people.find(p=>p.personId===id)}};
 });
 for(const file of ['src/core/wish-contract.js','src/core/auth.js','src/core/mobile-wish-matrix.js','src/ui/role-ux.js','src/ui/mobile-wish-matrix.js','src/ui/wish-assistant.js','src/ui/chef-companion.js'])await page.addScriptTag({content:await readFile(path.join(root,file),'utf8')});
 await page.evaluate(()=>{const K=KCDP;K.validateWish=w=>K.wishContract.validate(w);const mk=(id,type,start,end,extra={})=>({id,personId:'friend',date:'2026-12-04',start,end,wishType:type,status:'confirmed',scope:'time',wishZone:'H',comment:'',...extra});K.wishes.push(mk('f1','available',11,21),mk('f2','preferred',12,18),mk('f3','unavailable',19,20),mk('f4','if_needed',21,23),mk('f5','unavailable',11,23,{date:'2026-12-05',scope:'day'}));K.roleUx.employeeHome();});
 await page.locator('#uxStartTimes').click();await page.locator('#uxManual').click();
 await page.locator('#mmFriend').selectOption('friend');
 assert.match(await page.locator('.mm-day').first().innerText(),/11:00–21:00/);
 await page.evaluate(()=>{document.body.scrollTo({top:0,behavior:"instant"});scrollTo({top:0,behavior:"instant"})});await page.screenshot({path:path.join(out,'handy-tagesuebersicht.png'),fullPage:true});
 await page.locator('[data-mm-day="2026-12-04"]').click();
 await page.locator('[data-add="available"]').click();
 await page.locator('[data-field=start]').selectOption('11');await page.locator('[data-field=end]').selectOption('21');
 await page.locator('[data-add="preferred"]').click();
 await page.locator('[data-mm-row="1"] [data-field=start]').selectOption('12');await page.locator('[data-mm-row="1"] [data-field=end]').selectOption('22');
 await page.locator('#mmSave').click();assert.match(await page.locator('#mmError').innerText(),/innerhalb/);
 assert.equal(await page.evaluate(()=>KCDP.mobileWishMatrix.rows('me').length),0,'Invalid matrix must not save Kann partially');
 await page.locator('[data-mm-row="1"] [data-field=end]').selectOption('18');
 await page.locator('[data-add="unavailable"]').click();
 await page.locator('[data-mm-row="2"] [data-field=start]').selectOption('19');await page.locator('[data-mm-row="2"] [data-field=end]').selectOption('20');
 await page.screenshot({path:path.join(out,'handy-tagesmatrix.png'),fullPage:true});
 await page.locator('#mmStandby').check();await page.locator('#mmStandbyFrom').selectOption('21');await page.locator('#mmStandbyTo').selectOption('23');await page.locator('#mmSave').click();assert.equal(await page.evaluate(()=>KCDP.mobileWishMatrix.rows('me').length),3);assert.equal(await page.evaluate(()=>KCDP.mobileWishMatrix.rows('me')[0].assistantDay.standby.slots[0].start),21);
 await page.locator('[data-mm-day="2026-12-04"]').click();assert.equal(await page.locator('[data-mm-row]').count(),3);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Editor overflow '+width);assert.ok(await page.locator('#mmForm').evaluate(e=>e.getBoundingClientRect().width)>200,'Editor too narrow');}await page.setViewportSize({width:390,height:844});
 await page.locator('[data-mm-row="1"] [data-field=end]').selectOption('17');await page.locator('#mmSave').click();
 assert.equal(await page.evaluate(()=>KCDP.mobileWishMatrix.rows('me').length),3,'Editing must not duplicate');
 await page.evaluate(()=>KCDP.mobileMatrixUi.friend('friend','2026-12-04'));
 assert.match(await page.locator('.mm-compare').innerText(),/12:00–18:00/);
 await page.screenshot({path:path.join(out,'handy-freundesvorschau.png'),fullPage:true});
 assert.equal(await page.locator('#mmCopyApply').isDisabled(),true,'Conflicting preselection must not be copied');
 await page.locator('[data-copy-id=f1]').uncheck();await page.locator('[data-copy-id=f2]').uncheck();await page.locator('[data-copy-id=f4]').check();
 assert.equal(await page.locator('#mmCopyApply').isEnabled(),true,'Non-conflicting reserve time can be copied');
 await page.locator('#mmCopyApply').click();
 assert.equal(await page.evaluate(()=>KCDP.mobileWishMatrix.rows('friend').length),5,'Friend unchanged');
 await page.evaluate(()=>KCDP.mobileMatrixUi.entry('2026-12-05'));
 await page.locator('#mmOff').check();await page.locator('#mmOffEnd').selectOption('2026-12-06');await page.locator('#mmSave').click();
 assert.equal(await page.evaluate(()=>KCDP.mobileWishMatrix.rows('me').filter(w=>w.scope==='day').length),2);
 await page.evaluate(()=>KCDP.mobileMatrixUi.friend('friend','2026-12-05'));await page.locator('[data-copy-id=f5]').check();
 assert.equal(await page.locator('#mmCopyApply').isDisabled(),true,'Duplicate day block not copied');
 await page.evaluate(()=>{KCDP.state.wishPhase='closed';KCDP.mobileMatrixUi.entry('2026-12-04')});
 assert.equal(await page.locator('#mmSave').count(),0);
 assert.equal(await page.locator('[data-add=available]').isDisabled(),true);
 const locked=await page.evaluate(async()=>{try{await KCDP.mobileWishMatrix.copy('friend',['f1']);return false}catch{return true}});assert.equal(locked,true);
 await page.evaluate(()=>{KCDP.state.wishPhase='open';KCDP.mobileMatrixUi.overview()});
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}`);}
 await page.screenshot({path:path.join(out,'desktop-tagesuebersicht.png'),fullPage:true});
 const extra=await page.evaluate(async()=>{
 const K=KCDP,M=K.mobileWishMatrix,day='2026-12-04',base={personId:'me',date:day,start:11,end:21,wishType:'available',scope:'time',wishZone:'B',comment:'',status:'confirmed'};
 const tests={};
 tests.reserveConflict=M.validate([base,{...base,wishType:'if_needed'},{...base,start:12,end:16,wishType:'preferred'}]).some(x=>x.includes('Kann-Zeiten'));
 tests.blockConflict=M.validate([base,{...base,start:12,end:16,wishType:'preferred'},{...base,start:15,end:17,wishType:'unavailable'}]).some(x=>x.includes('Sperre'));
 tests.multipleWindows=M.validate([base,{...base,start:22,end:24},{...base,start:22,end:24,wishType:'preferred'}]).length===0;
 tests.missingEnd=M.validate([{...base,end:null}]).length>0;
 tests.sourceRestricted=M.copyPreview('friend',['nonexistent',M.rows('me')[0].id]).add.length===0;
 const before=JSON.stringify(K.wishes);try{await M.save('me',[day],[{...base,id:'f1'}])}catch{tests.foreignId=JSON.stringify(K.wishes)===before}
 try{await M.save('me',[day],[base],'stale')}catch{tests.stale=JSON.stringify(K.wishes)===before}
 return tests;
 });for(const [key,value]of Object.entries(extra))assert.equal(value,true,key);assert.equal(Object.keys(extra).length,7);assert.deepEqual(errors,[]);console.log('Mobile matrix browser checks passed: login entry, complete fields, atomic validation, editing, friend preview/copy, date range, locks, 320–1280px.');
}finally{await browser.close()}
