import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE),K={},ctx=vm.createContext({window:{KCDP:K,addEventListener(){}},console});
for(const f of ['src/core/model.js','src/core/configuration.js','src/ui/demand-view.js'])vm.runInContext(await readFile(f,'utf8'),ctx);
K.eventConfig.name+=' · Grundkonfiguration (Muster)';
K.demandView.state.editing=true;
const html=K.demandView.printHtml(K.days);
assert(!html.includes('<input'));assert.equal(K.demandView.state.editing,true);
assert.equal((K.demandView.printHtml([K.days[0]]).match(/<section>/g)||[]).length,1);
await writeFile('tmp/demand-matrix.html',html);
const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage();await page.setContent(html);await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('section').count(),K.days.length);
 for(const table of await page.locator('table').all())assert.deepEqual(await table.locator('thead th').allTextContents(),['Zeit','Grundbedarf','Vorne','Hinten','Flexibel','Wetter','Bühnenprogramm','Empfehlung','Soll']);
 await page.pdf({path:'../../outputs/KC-DP2-Bedarfsmatrix-Muster.pdf',preferCSSPageSize:true,printBackground:true});
 console.log('Bedarfsmatrix:',K.days.length,'Tage, neun Spalten; schreibgeschützter Export geprüft.');
}finally{await browser.close()}
