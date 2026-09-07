import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.setContent('<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="kcdpUxRoot"></div></body></html>');
 const html=await readFile('index.html','utf8');
 for(const [,file] of html.matchAll(/<link[^>]+href="([^"?]+\.css)[^"]*"/g))if(!file.startsWith('http'))await page.addStyleTag({content:await readFile(file,'utf8')});
 await page.evaluate(()=>{
  const date='2026-12-04',w=(id,personId,type,start,end,zone='B')=>({id,personId,date,start,end,wishType:type,wishZone:zone,status:'confirmed',scope:'time',comment:''});
  window.KCDP={days:[{date,start:10,end:18,type:'market'}],people:[{personId:'me',name:'Maria',active:true,personType:'member'},{personId:'anna',name:'Anna',active:true},{personId:'ben',name:'Ben',active:true},{personId:'carl',name:'Carl',active:true},{personId:'dora',name:'Dora',active:true}],currentUser:{personId:'me',role:'employee'},state:{wishPhase:'open',step:30},workflow:{status:'draft'},eventConfig:{name:'Weihnachtsmarkt 2026'},memberUxData:{},persistAll:async()=>{},person(id){return this.people.find(p=>p.personId===id)},baseRequirementFor:()=>({front:9,back:9,total:18}),requirementFor:()=>({front:2,back:1,total:3}),
   wishes:[w('can','me','available',11,17),w('pref','me','preferred',12,14,'V'),w('annaWish','anna','preferred',10,14,'V'),w('benWish','ben','preferred',10,14,'V'),w('flex','carl','preferred',14,16,'B'),w('blockedWish','dora','preferred',14,16,'H'),w('block','dora','unavailable',14,16)],
   shifts:[{...w('annaShift','anna','preferred',10,14,'V'),zone:'front',layer:'planned'},{...w('duplicate','anna','preferred',10,14,'V'),zone:'front',layer:'planned'},{...w('cancelled','ben','preferred',14,18,'H'),layer:'planned',status:'cancelled'}]};
  KCDP.wishes[0].assistantDay={wishAnswer:'custom',blockAnswer:'no',standby:{answer:'no',slots:[]}};
 });
 for(const file of ['src/core/wish-contract.js','src/core/auth.js','src/core/mobile-wish-matrix.js','src/ui/role-ux.js','src/ui/mobile-wish-matrix.js','src/ui/wish-assistant.js','src/ui/chef-companion.js','src/core/wish-demand.js','src/ui/assistant-staffing.js'])await page.addScriptTag({content:await readFile(file,'utf8')});
 await page.evaluate(()=>{KCDP.validateWish=w=>KCDP.wishContract.validate(w);KCDP.wishAssistant.start()});
 assert.match(await page.locator('.wa-heading').innerText(),/Trage deine Zeiten wie gewohnt ein/);
 assert.match(await page.locator('.as-dayhint').innerText(),/Hilfe gesucht/);
 await page.locator('[data-wa-day]').click();
 assert.equal(await page.locator('#waDemandLive details').count(),0);
 assert.match(await page.locator('#waDemandLive').innerText(),/Anna · 10:00–14:00/);
 assert.match(await page.locator('#waDemandLive').innerText(),/Ben · 10:00–14:00/);
 assert.match(await page.locator('#waDemandLive').innerText(),/1 mehr als benötigt/);
 const counts=await page.evaluate(()=>KCDP.assistantStaffing.overview('2026-12-04'));
 assert.equal(counts.find(p=>p.start===12).areas[0].count,3,'One planned person plus Ben and own wish, without duplicates');
 assert.equal(counts.find(p=>p.start===12).areas[0].planned,1);
 assert.equal(counts.find(p=>p.start===12).areas[0].needed,2,'Use adjusted demand, not base demand');
 assert.equal(counts.find(p=>p.start===14).areas[1].count,0,'Blocked wishes and cancelled shifts do not count');
 assert.equal(counts.find(p=>p.start===14).flexible.length,1);
 await page.locator('#waNext').click();
 assert.match(await page.locator('.as-offers').innerText(),/Wunsch hierhin ändern/);
 assert.equal(await page.locator('.as-offers [data-as-start="12"][data-as-zone="V"]').count(),0);
 await page.locator('.as-offers [data-as-start="12"][data-as-end="14"][data-as-zone="H"]').click();await page.locator('[data-pick=wish]').click();
 assert.match(await page.locator('#waStaffingStatus').innerText(),/Wunschzeit angepasst/);
 assert.match(await page.locator('#waCurrentSummary').innerText(),/11:00–17:00/);
 assert.match(await page.locator('#waCurrentSummary').innerText(),/12:00–14:00.*Wunschzeit.*Hinten/s);
 assert.equal(await page.evaluate(()=>KCDP.wishes.find(w=>w.id==='pref').wishZone),'V','Suggestion is draft only');
 await page.locator('#waNext').click();
 assert.match(await page.locator('.wa-question h1').innerText(),/Welche Zeit/);
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal scrolling at '+width);
 }
 await page.setViewportSize({width:390,height:844});await mkdir('tmp/staffing-qa',{recursive:true});
 await page.screenshot({path:'tmp/staffing-qa/handy-besetzung.png',fullPage:true});
 // Read-only suggestions must obey availability, blocks, existing shifts and qualifications.
 const result=await page.evaluate(()=>{
  const K=KCDP,date='2026-12-04',draft=[{personId:'me',date,start:11,end:17,wishType:'available',wishZone:'B',status:'confirmed'}];
  const basic=K.assistantStaffing.suggestions(date,draft);
  K.staffing={qualificationOk:(p,z)=>z!=='back'};const qualified=K.assistantStaffing.suggestions(date,draft);
  K.staffing=null;
  const blocked=K.assistantStaffing.suggestions(date,[...draft,{...draft[0],wishType:'unavailable'}]);
  K.shifts.push({...draft[0],layer:'planned',zone:'front'});
  const scheduled=K.assistantStaffing.suggestions(date,draft);
  K.shifts.pop();
  const reserve=K.assistantStaffing.suggestions(date,[{...draft[0],wishType:'if_needed'}]);
  const before=JSON.stringify(K.wishes);K.assistantStaffing.overview(date,draft);
  return {basic,qualified,blocked,scheduled,reserve,unchanged:before===JSON.stringify(K.wishes)};
 });
 assert(result.basic.length);assert(result.basic.every(x=>x.start>=11&&x.end<=17));
 assert(result.qualified.every(x=>x.zone!=='back'));assert.equal(result.blocked.length,0);
 assert.equal(result.scheduled.length,0);assert.equal(result.reserve.length,0);assert(result.unchanged);
 // Every eligible card, including those outside the shortlist, supports keyboard selection.
 await page.evaluate(()=>KCDP.wishAssistant.open('2026-12-04'));await page.locator('#waNext').click();
 assert(await page.locator('.as-area[role=button]').count()>await page.locator('.as-offers [data-as-start]').count());
 const card=page.locator('.as-area[role=button]').last();
 const chosen=await card.evaluate(e=>({start:e.dataset.asStart,end:e.dataset.asEnd,zone:e.dataset.asZone}));
 await card.focus();await card.press('Enter');if(await page.locator('[data-extend]').count())await page.locator('[data-extend]').check();await page.locator('[data-pick=wish]').click();
 assert.match(await page.locator('#waStaffingStatus').innerText(),/Wunschzeit angepasst/);
 assert(await page.locator('.as-selected').count()>0);
 assert.equal(await page.evaluate(()=>KCDP.wishes.find(w=>w.id==='pref').wishZone),'V');
 // Revalidate offers after another person fills a gap.
 await page.evaluate(()=>KCDP.wishAssistant.open('2026-12-04'));await page.locator('#waNext').click();
 const offer=page.locator('.as-offers [data-as-start="12"][data-as-zone="H"]');assert.equal(await offer.count(),1);
 await page.evaluate(()=>KCDP.wishes.push({id:'new',personId:'dora',date:'2026-12-04',start:12,end:14,wishType:'preferred',wishZone:'H',status:'confirmed'}));
 await offer.click();assert.match(await page.locator('#waError').innerText(),/geändert/);
 assert.equal(await page.evaluate(()=>KCDP.wishes.find(w=>w.id==='pref').wishZone),'V');
 // Start with a card, with no prior availability.
 await page.evaluate(()=>{KCDP.wishes=KCDP.wishes.filter(w=>w.personId!=='me');KCDP.wishAssistant.open('2026-12-04')});
 await page.locator('.as-area[role=button]').first().click();
 assert.equal(await page.locator('[data-extend]').count(),0);
 await page.locator('[data-pick=can]').click();
 assert.match(await page.locator('#waCurrentSummary').innerText(),/Kannzeit/);
 assert.doesNotMatch(await page.locator('#waCurrentSummary').innerText(),/Wunschzeit/);
 await page.locator('.as-area[role=button]').last().click();
 assert(await page.locator('[data-pick=wish]').isDisabled());
 await page.locator('[data-extend]').check();await page.locator('[data-pick=wish]').click();
 assert.match(await page.locator('#waCurrentSummary').innerText(),/Wunschzeit/);
 assert.equal(await page.evaluate(()=>KCDP.wishes.filter(w=>w.personId==='me').length),0);
 await page.locator('#waNext').click();
 assert(await page.locator('[data-slot-key=can]').first().isVisible(),'Own time inputs remain available');
 assert.deepEqual(errors,[]);
 console.log('Assistant staffing OK: visible names/counts, planned/wish deduplication, adjusted demand, blocks, flexible wishes, exact availability boundaries, direct area change, draft preservation, stale offers, qualifications, 320–1280px.');
}finally{await browser.close()}

