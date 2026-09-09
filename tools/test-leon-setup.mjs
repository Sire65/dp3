import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
const page=await browser.newPage();
await page.setContent('<div id="uxAdminBack"></div><div id="kcdpUxRoot"><div class="ux-grid"></div></div>');
await page.evaluate(()=>{
 window.calls=[];window.failed=false;
 window.KCDP={currentUser:{role:'admin'},memberAccess:{configured:()=>true},supabaseConnection:{ensureSession:async()=>{},currentMembership:async()=>({role:'admin'}),memberProvisioningTargets:async()=>[{person_id:'KC-P-M0018',active:true}]},staffing:{rulesFor:()=>({forbiddenWeekdays:[5],notes:'keep'}),setRules:(id,patch)=>calls.push({id,patch})},persistAll:async()=>{},sync:{snapshot:()=>({outbox:[]}),openConflicts:()=>0,pull:async()=>{},flush:async()=>failed?{failed:1,sent:0}:{sent:1,pending:0,failed:0,conflicts:0}}};
});
await page.addScriptTag({path:'src/ui/member-access-setup.js'});
await page.click('#kcLeonBlocks');
await page.waitForFunction(()=>document.getElementById('kcLeonStatus').textContent.includes('✓'));
assert.deepEqual(await page.evaluate(()=>calls[0]),{id:'KC-P-M0018',patch:{forbiddenWeekdays:[5,1,3]}});
await page.evaluate(()=>{failed=true;document.getElementById('kcLeonBlocks').disabled=false;});
await page.click('#kcLeonBlocks');
await page.waitForFunction(()=>document.getElementById('kcLeonStatus').textContent.includes('Nicht bestätigt'));
assert.equal(await page.isEnabled('#kcLeonBlocks'),true);
console.log('Admin-Button: richtige Person, vorhandene Sperren erhalten, Erfolg und Übertragungsfehler geprüft.');
}finally{await browser.close();}
