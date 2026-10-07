import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:320,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const body='<script>window.KCDP={}</script><details data-klappe="test" open><summary>Bereich</summary><p>Inhalt</p><details data-klappe="inner" class="innen"><summary>Innen</summary>Text</details></details>';
await page.route('http://127.0.0.1:18889/**',r=>r.fulfill({contentType:'text/html',body}));await page.goto('http://127.0.0.1:18889/');
const js=await readFile(new URL('../src/ui/fold-sections.js',import.meta.url),'utf8'),css=await readFile(new URL('../src/ui/fold-sections.css',import.meta.url),'utf8');
async function load(){await page.addStyleTag({content:css});await page.addScriptTag({content:js})}await load();
const el=page.locator('details[data-klappe=test]'),head=el.locator(':scope > summary'),lock=head.locator('.dp-fold-lock'),arrow=head.locator('.dp-fold-arrow');
assert.equal(await arrow.evaluate(e=>e.getBoundingClientRect().width),42);await lock.click();assert.equal(await lock.getAttribute('aria-pressed'),'true');await head.locator('.dp-fold-title').click();assert(await el.evaluate(e=>e.open));await el.locator(':scope > .dp-fold-bottom button').click();assert(await el.evaluate(e=>e.open));assert.equal(await page.locator('.innen .dp-fold-bottom').count(),0);
await page.evaluate(()=>KCDP.foldSections.setOpen(document.querySelector('[data-klappe=test]'),false));assert(await el.evaluate(e=>e.open));
await page.reload();await load();assert.equal(await lock.getAttribute('aria-pressed'),'true');assert(await el.evaluate(e=>e.open));await lock.click();await el.locator(':scope > .dp-fold-bottom button').click();assert.equal(await el.evaluate(e=>e.open),false);assert.equal(await head.getAttribute('aria-expanded'),'false');
await page.reload();await load();assert.equal(await el.evaluate(e=>e.open),false);
await page.evaluate(()=>KCDP.foldSections.setOpen(document.querySelector('[data-klappe=test]'),true));assert(await el.evaluate(e=>e.open));assert.equal(await page.evaluate(()=>localStorage.getItem('kc_dp_klappe_test')),'0','flow must not save a user choice');
await page.evaluate(()=>{Object.defineProperty(Storage.prototype,'getItem',{value:()=>{throw Error('blocked')}});Object.defineProperty(Storage.prototype,'setItem',{value:()=>{throw Error('blocked')}});document.body.insertAdjacentHTML('beforeend','<details data-klappe="blocked"><summary>Ohne Speicher</summary>Text</details>')});await page.locator('[data-klappe=blocked] .dp-fold-arrow').click();assert(await page.locator('[data-klappe=blocked]').evaluate(e=>e.open));assert.deepEqual(errors,[]);
console.log('Fold PASS: 42px touch controls, lock, bottom close, nested exclusion, reload, flow without persistence and blocked storage.');
}finally{await browser.close()}
