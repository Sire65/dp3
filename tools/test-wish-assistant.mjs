import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(root,'tmp/assistant-qa');await mkdir(out,{recursive:true});
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
 for(const file of ['src/core/wish-contract.js','src/core/auth.js','src/core/mobile-wish-matrix.js','src/ui/role-ux.js','src/ui/mobile-wish-matrix.js','src/ui/wish-assistant.js','src/ui/chef-companion.js','src/core/wish-demand.js','src/ui/wish-demand.js','src/ui/assistant-staffing.js'])await page.addScriptTag({content:await readFile(path.join(root,file),'utf8')});
 await page.evaluate(()=>{const K=KCDP;K.validateWish=w=>K.wishContract.validate(w);const mk=(id,type,start,end,extra={})=>({id,personId:'friend',date:'2026-12-04',start,end,wishType:type,status:'confirmed',scope:'time',wishZone:'H',comment:'',...extra});K.wishes.push(mk('f1','available',11,21),mk('f2','preferred',12,18),mk('f3','unavailable',19,20),mk('f4','if_needed',21,23),mk('f5','unavailable',11,23,{date:'2026-12-05',scope:'day'}));K.roleUx.employeeHome();});
 await page.evaluate(()=>{KCDP.testQueue=[];KCDP.sync={enqueue:op=>KCDP.testQueue.push(JSON.parse(JSON.stringify(op))),snapshot:()=>({outbox:KCDP.testQueue})};KCDP.persistAll=async()=>{KCDP.testSaved=JSON.stringify(KCDP.wishes)};});
 await page.locator('#uxStartTimes').click();assert.equal(await page.locator('.ux-methods>button').count(),5);
 await page.locator('#uxAssistant').click();await page.locator('[data-wa-day="2026-12-04"]').click();
 const screenshot=async name=>{await page.evaluate(()=>{document.body.scrollTo({top:0,behavior:'instant'});scrollTo({top:0,behavior:'instant'})});await page.screenshot({path:path.join(out,name),fullPage:true})};
 await screenshot('handy-assistent-start.png');
 await page.locator('#waNext').click();assert.match(await page.locator('#waError').innerText(),/Antwort/);
 await page.locator('[data-choice=status][data-value=yes]').click();await page.locator('#waNext').click();
 await page.locator('#waWhole').click();await screenshot('handy-assistent-zeiten.png');await page.locator('#waNext').click();
 await page.locator('[data-choice=wishAnswer][data-value=custom]').click();
 await page.locator('[data-slot-key=pref][data-slot-field=start]').selectOption('12');await page.locator('[data-slot-key=pref][data-slot-field=end]').selectOption('18');await page.locator('#waNext').click();
 await page.locator('[data-choice=blockAnswer][data-value=no]').click();await page.locator('#waNext').click();
 await page.locator('[data-choice=standby][data-value=yes]').click();
 await page.locator('[data-slot-key=standby][data-slot-field=start]').selectOption('21');await page.locator('[data-slot-key=standby][data-slot-field=end]').selectOption('23');await page.locator('#waNext').click();
 await page.locator('[data-choice=zone][data-value=H]').click();await page.locator('#waNext').click();
 await screenshot('handy-assistent-pruefen.png');await page.locator('#waNext').click();
 assert.match(await page.locator('.wa-done').innerText(),/gespeichert/);
 let result=await page.evaluate(()=>({rows:KCDP.mobileWishMatrix.rows('me'),queue:KCDP.testQueue}));assert.equal(result.rows.length,2);assert.equal(result.rows[0].assistantDay.standby.slots[0].start,21);assert.equal(result.queue[0].payload.assistantDay.standby.answer,'yes');assert.equal(result.rows[1].wishZone,'H');
 // Reload saved data, then change only readiness; it must still enqueue a real update.
 await page.evaluate(()=>{KCDP.wishes=JSON.parse(KCDP.testSaved);KCDP.wishAssistant.open('2026-12-04')});
 await page.locator('#waNext').click();await page.locator('#waNext').click();await page.locator('#waNext').click();await page.locator('#waNext').click();
 assert.equal(await page.locator('[data-slot-key=standby][data-slot-field=start]').inputValue(),'21');
 await page.locator('[data-choice=standby][data-value=no]').click();await page.locator('#waNext').click();await page.locator('#waNext').click();await page.locator('#waNext').click();
 assert.equal(await page.evaluate(()=>KCDP.mobileWishMatrix.rows('me')[0].assistantDay.standby.answer),'no');
 assert.ok(await page.evaluate(()=>KCDP.testQueue.length)>2);
 // Friend selection shows times, copies only time fields, asks own readiness.
 await page.evaluate(()=>KCDP.wishAssistant.open('2026-12-04'));await page.locator('#waNext').click();
 await page.locator('.wa-friend summary').click();await page.locator('#waFriend').selectOption('friend');assert.match(await page.locator('#waFriendPreview').innerText(),/11:00–21:00/);await screenshot('handy-assistent-freund.png');await page.locator('#waUseFriend').click();await page.locator('#waNext').click();assert.match(await page.locator('.wa-question').innerText(),/Welche Zeit/);
 // Reserve skips wish; valid separate readiness and date block branches.
 await page.evaluate(()=>KCDP.wishAssistant.open('2026-12-05'));await page.locator('[data-choice=status][data-value=yes]').click();await page.locator('#waNext').click();await page.locator('#waWhole').click();await page.locator('[data-reserve-index="0"]').check();await page.locator('#waNext').click();assert.match(await page.locator('.wa-question h1').innerText(),/nicht kannst/);
 await page.locator('[data-choice=blockAnswer][data-value=no]').click();await page.locator('#waNext').click();await page.locator('[data-choice=standby][data-value=no]').click();await page.locator('#waNext').click();await page.locator('#waNext').click();await page.locator('#waNext').click();
 assert.equal(await page.evaluate(()=>KCDP.mobileWishMatrix.rows('me','2026-12-05')[0].wishType),'if_needed');
 await page.evaluate(()=>KCDP.wishAssistant.open('2026-12-05'));await page.locator('[data-choice=status][data-value=no]').click();await page.locator('#waNext').click();await page.locator('[data-offdate="2026-12-06"]').check();await page.locator('#waNext').click();assert.match(await page.locator('.wa-question').innerText(),/bisherigen Angaben/);await page.locator('#waNext').click();
 assert.equal(await page.evaluate(()=>KCDP.mobileWishMatrix.rows('me').filter(w=>w.scope==='day').length),2);
 const before=await page.evaluate(()=>JSON.stringify(KCDP.wishes));await page.evaluate(()=>KCDP.wishAssistant.open('2026-12-04'));await page.locator('[data-choice=status][data-value=unknown]').click();await page.locator('#waNext').click();await page.locator('#waNext').click();assert.equal(await page.evaluate(()=>JSON.stringify(KCDP.wishes)),before);
 await page.evaluate(()=>KCDP.wishAssistant.open('2026-12-04'));await page.evaluate(()=>KCDP.state.wishPhase='closed');await page.locator('#waNext').click();assert.match(await page.locator('#waError').innerText(),/geändert/);
 await page.evaluate(()=>{KCDP.state.wishPhase='open';KCDP.wishAssistant.start()});
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Day overflow '+width);await page.locator('[data-wa-day="2026-12-04"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Question overflow '+width);await page.evaluate(()=>KCDP.wishAssistant.start());}
 await screenshot('desktop-assistent-tage.png');
 const measured=await page.evaluate(()=>{
 const K=KCDP,mk=(id,type,start,end)=>({id,personId:'me',date:'2026-12-04',start,end,wishType:type,scope:'time',wishZone:'V',status:'confirmed',assistantDay:{standby:{answer:'yes',slots:[{start:18,end:20}]}}});
 K.wishes=[mk('a','available',10,20),mk('b','available',10,20),mk('c','preferred',12,18),mk('d','preferred',12,18),mk('e','unavailable',15,16),mk('f','if_needed',20,22)];
 K.shifts=[{...mk('s','preferred',12,17),layer:'planned'},{...mk('t','preferred',12,17),layer:'planned'}];K.person('me').maxHours=8;
 return K.chefCompanion.totals('me');
 });assert.equal(measured.wish,5);assert.equal(measured.can,9);assert.equal(measured.standby,2);assert.equal(measured.reserve,2);assert.equal(measured.planned,5);assert.equal(measured.open,2);assert.equal(measured.limit,null);
 await page.evaluate(()=>{const K=KCDP;K.shifts=[];K.coverageAt=()=>({req:{front:2,back:2},front:1,back:1});K.memberOpportunities={eligibility:g=>({ok:g.zone==='front'})};K.wishes=K.wishes.filter(w=>!['b','d','f'].includes(w.id));K.chefCompanion.finish()});
 const gaps=await page.evaluate(()=>KCDP.chefCompanion.suggestions('me'));assert.ok(gaps.length);assert.ok(gaps.every(g=>g.zone==='front'&&g.start>=11&&g.end<=20&&!(g.start<18&&g.end>12)));
 await page.setViewportSize({width:390,height:844});await screenshot('handy-koch-auswertung.png');
 await page.locator('#chefQuiet').click();assert.equal(await page.locator('.chef-helper.quiet').count(),1);
 await page.evaluate(()=>KCDP.wishes=KCDP.wishes.filter(w=>w.wishType!=='available'));await page.locator('[data-chef-gap]').first().click();assert.match(await page.locator('#chefStatus').innerText(),/geändert/);
 await page.locator('#chefInstall').click();assert.match(await page.locator('.wa-question').innerText(),/lokale Testansicht/);await screenshot('handy-installation.png');
 await page.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.promptCalled=true};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e);KCDP.chefCompanion.install()});await page.locator('#chefInstallNow').click();assert.equal(await page.evaluate(()=>window.promptCalled),true);assert.match(await page.locator('#chefInstallStatus').innerText(),/bestätigt/);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});await page.evaluate(()=>KCDP.chefCompanion.finish());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Summary overflow '+width);}
 assert.deepEqual(errors,[]);
 console.log('Assistant checks passed: fifth entry, full guided flow, readiness queue/reload/edit, friend preview, reserve, multiple blocked days, unknown, phase lock, 320–1280px.');
}finally{await browser.close()}
