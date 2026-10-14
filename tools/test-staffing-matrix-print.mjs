import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('**/*',r=>r.abort());
 await page.setContent('<div id="mainView"></div>');
 for(const file of ['core/model','core/planning','core/documents','adapters/pdf'])await page.addScriptTag({content:await readFile('src/'+file+'.js','utf8')});
 const app=await readFile('src/ui/app.js','utf8'),matrix=app.slice(app.indexOf('function matrixHtml('),app.indexOf('K.screenMatrixHtml=matrixHtml;'));
 await page.addScriptTag({content:`const K=window.KCDP,esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),fmtTime=h=>String(Math.floor(h)).padStart(2,'0')+':00';${matrix};K.screenMatrixHtml=matrixHtml;`});
 await page.evaluate(()=>{const K=KCDP;K.auth={has:()=>true};K.state.layer='planned';K.days=[{date:'2026-12-04',start:10,end:23,open:12,type:'market'},{date:'2026-12-05',start:11,end:23,open:12,type:'market'}];K.day=()=>K.days[0];K.coverageAt=(d,h)=>({req:{total:4,front:2,back:2},total:h===10?3:4,front:h===10?1:2,back:2,special:1,standby:1});K.standbyRequirementFor=()=>1;});
 const data=await page.evaluate(async()=>{const K=KCDP,one=K.documents.build({type:'matrix',start:K.days[0].date,end:K.days[0].date,publishedOnly:false}),all=K.documents.build({type:'matrix',start:K.days[0].date,end:K.days[1].date,publishedOnly:false});const dom=new DOMParser().parseFromString(all.html,'text/html');return {one:one.html,html:all.html,pages:dom.querySelectorAll('.doc-page').length,cells:[...dom.querySelectorAll('.doc-page:first-of-type tbody td')].map(c=>c.textContent),bytes:Array.from(await K.pdfAdapter.bytes(all))};});
 assert.equal(data.pages,2);assert.equal((data.one.match(/class="doc-page"/g)||[]).length,1);assert(data.cells.includes('3/4'));assert(data.cells.includes('1/2 V'));assert(data.cells.includes('1 Z'));
 const pdf=Buffer.from(data.bytes);assert(pdf.toString('latin1').includes('/Count 2'));
 await mkdir('tmp/staffing-print-qa',{recursive:true});await writeFile('tmp/staffing-print-qa/matrix-fixture.pdf',pdf);await writeFile('tmp/staffing-print-qa/matrix-fixture.html',data.html);
 await page.addScriptTag({content:await readFile('src/ui/staffing-matrix-print.js','utf8')});await page.evaluate(()=>document.getElementById('mainView').innerHTML=KCDP.screenMatrixHtml(KCDP.day(),1196));await page.getByRole('button',{name:'PDF für diesen Tag',exact:true}).waitFor();
 await page.evaluate(()=>{KCDP.pdfAdapter.download=async doc=>{window.printedDoc=doc;return {fileName:doc.fileName}};});await page.getByRole('button',{name:'PDF für diesen Tag',exact:true}).click();assert((await page.evaluate(()=>window.printedDoc.html)).includes('2026'));
 console.log('PASS: screen values reused, one day/one page, all days/separate pages, real PDF generated, day button works.');
}finally{await browser.close();}
