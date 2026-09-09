import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE),b=await chromium.launch({channel:'chrome',headless:true});
try{const p=await b.newPage();await p.goto('http://127.0.0.1:8774/twinkey-test.html');await p.locator('[data-tw-mode=guided]').click();await p.locator('[data-tw-task=wish]').click();await p.locator('[data-tw-entry=manual]').click();
assert.match(await p.locator('[data-day="2026-12-02"]').getAttribute('class'),/status-empty/);
assert.match(await p.locator('[data-day="2026-12-04"]').getAttribute('class'),/status-draft/);
await p.locator('[data-day="2026-12-02"]').click();assert(!/Bereitschaft\n/.test(await p.locator('#swTimeline').innerText()));await p.locator('#swEditDay').click();await p.locator('#swNext').click();await p.locator('#swNext').click();await p.locator('#swNone').click();
assert.equal(await p.locator('#swYesStandby').count(),0);await p.locator('#swNext').click();await p.locator('#swComplete').waitFor();await p.locator('#swNext').click();await p.locator('#swMore').click();
assert.match(await p.locator('[data-day="2026-12-02"]').getAttribute('class'),/status-complete/);
const result=await p.evaluate(()=>{const K=KCDP,w=K.wishes.find(w=>w.personId===K.currentUser.personId&&w.date==='2026-12-02');w.end-=1;return {status:K.simpleWishAssistant.statusFor(w.date).key,prep:K.simpleWishAssistant.standbyEnabled({type:'prep'}),after:K.simpleWishAssistant.standbyEnabled({type:'after'}),market:K.simpleWishAssistant.standbyEnabled({type:'market'}),override:K.simpleWishAssistant.standbyEnabled({type:'prep',standbyEnabled:true})};});
assert.deepEqual(result,{status:'draft',prep:false,after:false,market:true,override:true});console.log('Day status: red/yellow/green, explicit completion, changed data and optional special-day standby OK.');
}finally{await b.close()}
