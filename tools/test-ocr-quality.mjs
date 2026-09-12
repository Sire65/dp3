import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{const page=await browser.newPage();await page.setContent('<!doctype html><canvas id="good" width="1200" height="1600"></canvas><canvas id="poor" width="600" height="800"></canvas>');await page.evaluate(()=>{window.KCDP={}});await page.addScriptTag({content:await readFile(new URL('../src/adapters/form-ocr.js',import.meta.url),'utf8')});const result=await page.evaluate(()=>{const q=KCDP.formOcr._test,good=document.getElementById('good'),g=good.getContext('2d');g.fillStyle='#f8f8f5';g.fillRect(0,0,1200,1600);g.strokeStyle='#222';g.lineWidth=4;for(let y=120;y<1500;y+=80){g.beginPath();g.moveTo(80,y);g.lineTo(1120,y);g.stroke()}for(let x=80;x<1120;x+=130){g.beginPath();g.moveTo(x,120);g.lineTo(x,1480);g.stroke()}const poor=document.getElementById('poor'),p=poor.getContext('2d');p.fillStyle='#888';p.fillRect(0,0,600,800);return{good:q.qualityReport(good,{w:1040,h:1360}),poor:q.qualityReport(poor,{w:200,h:250}),time:q.parseTime('I4.30')}});assert.equal(result.good.level,'good');assert.equal(result.poor.level,'poor');assert.equal(result.time,14.5);console.log('OCR quality OK: resolution, sharpness, lighting, paper coverage and handwriting normalization.')}finally{await browser.close()}


