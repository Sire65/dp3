import {readFile} from 'node:fs/promises';
import {chromium} from 'file:///C:/Users/Koch/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const source=process.argv[2];
if(!source)throw Error('Bildpfad fehlt.');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage();
await page.goto('http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.KCDP?.formOcr&&window.Tesseract,{timeout:30000});
await page.addScriptTag({url:`http://127.0.0.1:8766/src/adapters/form-ocr.js?qa=${Date.now()}`});
const base64=(await readFile(source)).toString('base64');
const result=await page.evaluate(async data=>{
  const K=window.KCDP;
  K.days=[['2026-12-02',8,18,'prep'],['2026-12-03',8,18,'prep'],['2026-12-04',11,23,'market'],['2026-12-05',11,23,'market'],['2026-12-06',11,23,'market'],['2026-12-07',13,23,'market'],['2026-12-08',11,23,'market'],['2026-12-09',13,23,'market'],['2026-12-10',13,23,'market'],['2026-12-11',11,23,'market'],['2026-12-12',11,23,'market'],['2026-12-13',11,23,'market'],['2026-12-14',8,15,'after']].map(([date,start,end,type])=>({date,start,end,type}));
  K.people=[{personId:'KC-P-002',name:'Hans-Joachim Koch',formProfileId:'HP-SAMPLE'}];K.person=id=>K.people.find(p=>p.personId===id);
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),file=new File([bytes],'Matrixplan.jpg',{type:'image/jpeg'});
  return K.photoRecognition.analyze(file,{});
},base64);
await browser.close();
if(result?.diagnostics?.layout?.rows?.length!==15)throw Error(`Formularraster nicht erkannt: ${result?.diagnostics?.layout?.rows?.length||0} Zeilenbegrenzungen.`);
if(![13,14].includes(result?.diagnostics?.layout?.cols?.length))throw Error(`Formularraster nicht erkannt: ${result?.diagnostics?.layout?.cols?.length||0} Spaltenbegrenzungen.`);
if(result?.rows?.length!==39)throw Error(`Kontrollansicht unvollständig: ${result?.rows?.length||0}/39 Prüfzeilen.`);
console.log(JSON.stringify(result,null,2));
