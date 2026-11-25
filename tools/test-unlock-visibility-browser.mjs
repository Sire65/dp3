import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
 await page.setContent('<div id="modal"></div><button id="outside">Außerhalb</button>');
 await page.evaluate(()=>{window.KCDP={storage:{setSecret:v=>{if(v.length<16)throw Error('zu kurz');window.accepted=v}}};window.K=KCDP;window.$=id=>document.getElementById(id);window.openModal=html=>{document.getElementById('modal').innerHTML=html};window.closeModal=()=>{document.getElementById('modal').innerHTML=''};window.msg=()=>{};});
 await page.addScriptTag({content:await readFile('src/ui/secret-visibility.js','utf8')});
 const app=await readFile('src/ui/app.js','utf8'),start=app.indexOf('async function unlockSecureStore('),end=app.indexOf('\n',start);
 await page.addScriptTag({content:app.slice(start,end)});await page.evaluate(()=>{window.unlockDone=unlockSecureStore()});
 const input=page.locator('#unlockSecret'),eye=page.locator('#unlockSecretEye'),preview=page.locator('#unlockSecretPreview');
 await input.pressSequentially('Ab3');assert.equal(await input.getAttribute('type'),'password');assert.equal(await preview.textContent(),'••3');await page.clock.fastForward(850);assert.equal(await preview.textContent(),'');
 await eye.click();assert.equal(await input.getAttribute('type'),'text');assert.equal(await eye.getAttribute('aria-pressed'),'true');await eye.click();assert.equal(await input.getAttribute('type'),'password');
 await eye.click();await page.clock.fastForward(10050);assert.equal(await input.getAttribute('type'),'password');
 await input.focus();await input.pressSequentially('Z');await page.locator('#outside').click();assert.equal(await preview.textContent(),'');
 // Pasted/autofilled text never gets copied into the preview.
 await input.fill('SyntheticValue16');assert.equal(await preview.textContent(),'');
 await eye.click();await page.locator('#outside').click();assert.equal(await input.getAttribute('type'),'password');
 await input.focus();await input.press('End');await input.pressSequentially('!');assert.equal(await input.inputValue(),'SyntheticValue16!');await input.press('Enter');assert.equal(await page.evaluate(()=>accepted),'SyntheticValue16!');assert.equal(await page.locator('#unlockSecret').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS unlock visibility: actual dialog, last character expiry, eye toggle/timeout, blur, paste, Enter unlock unchanged, no key logging.');
}finally{await browser.close();}
