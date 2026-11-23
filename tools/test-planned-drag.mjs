import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const source=await readFile('src/ui/app.js','utf8');
const start=source.indexOf('function shiftPointerDown(');
const handler=source.slice(start,source.indexOf('\nfunction previewDrag(',start));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:500}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<div class="person-row" data-person="test"><div class="shift planned" data-shift="fake"><i class="resize-handle left" data-resize="left"></i><span class="shift-label">Testdienst</span><i class="resize-handle right" data-resize="right"></i></div></div>');
 await page.addStyleTag({content:'.person-row{position:relative;height:80px;width:1400px}.shift{position:absolute;top:10px;height:40px;background:#ccc}.shift-label{position:absolute;inset:0 12px;display:grid;place-items:center}.shift i{position:absolute;top:0;width:10px;height:40px;z-index:2}.shift i:last-child{right:0}'+await readFile('src/ui/app.css','utf8')});
 await page.evaluate(()=>{
  window.K={state:{layer:'planned',step:60},auth:{has:()=>true},shifts:[],person:()=>({name:'Test'}),validateShift:()=>window.block?[{level:'error',text:'Überlappung'}]:[],mutations:{saveShift:c=>{Object.assign(K.shifts[0],c);window.saves++;}}};
  Object.assign(window,{day:()=>({start:8,end:23}),displayEnd:d=>d.end,snapTime:Math.round,fmtTime:t=>String(t),dragRAF:0,undoAction:null,updateTimeRangeHighlight:()=>{},clearShiftRowHighlights:()=>{},markShiftRow:()=>{},flashShiftRow:()=>{},msg:()=>{},persist:async()=>{},previewDrag:()=>{},render:()=>{}});
  window.reset=(availability=[8,23])=>{K.shifts=[{id:'fake',personId:'test',start:10,end:14,availabilityStart:availability[0],availabilityEnd:availability[1]}];K.state.layer='planned';K.auth.has=()=>true;window.block=false;window.saves=0;const el=document.querySelector('.shift');el.style.left='184px';el.style.width='368px';};
 });
 await page.addScriptTag({content:handler+'\ndocument.querySelector(".shift").addEventListener("pointerdown",shiftPointerDown);'});
 async function drag(selector,dx){const b=await page.locator(selector).boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2,{steps:6});await page.mouse.up();await page.waitForTimeout(40);return page.evaluate(()=>({start:K.shifts[0].start,end:K.shifts[0].end,saves}));}
 await page.evaluate(()=>reset());
 assert.deepEqual(await drag('.shift-label',92),{start:11,end:15,saves:1});
 await page.evaluate(()=>reset([10,14]));page.once('dialog',d=>d.dismiss());
 assert.deepEqual(await drag('.shift-label',92),{start:10,end:14,saves:0});
 page.once('dialog',d=>d.accept());
 assert.deepEqual(await drag('.shift-label',92),{start:11,end:15,saves:1});
 assert.deepEqual(await page.evaluate(()=>[K.shifts[0].availabilityStart,K.shifts[0].availabilityEnd]),[10,14]);
 await page.evaluate(()=>reset());
 assert.deepEqual(await drag('.shift-label',1000),{start:19,end:23,saves:1});
 await page.evaluate(()=>reset());assert.deepEqual(await drag('[data-resize="left"]',92),{start:11,end:14,saves:1});
 await page.evaluate(()=>reset());assert.deepEqual(await drag('[data-resize="right"]',92),{start:10,end:15,saves:1});
 for(const condition of ['block=true','K.state.layer="compare"','K.auth.has=()=>false']){
  await page.evaluate(()=>reset());await page.evaluate(condition);
  assert.deepEqual(await drag('.shift-label',92),{start:10,end:14,saves:0});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: whole-bar duration, day boundary, explicit Kann confirmation/cancel, edge resize, overlap and permissions');
}finally{await browser.close();}

