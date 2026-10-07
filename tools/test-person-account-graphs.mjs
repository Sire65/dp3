import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<body><div id="modalBackdrop" class="hidden"><div id="modal"></div></div></body>');
 await page.evaluate(()=>{window.KCDP={auth:{has:()=>true},people:[{personId:'a',name:'Karla Muster',active:true},{personId:'b',name:'Thomas Muster',active:true}],days:Array.from({length:30},(_,i)=>({date:`2026-12-${String(i+1).padStart(2,'0')}`})),wishes:[],shifts:[],actualShifts:[]};const K=KCDP;K.days.forEach((d,n)=>{K.shifts.push({personId:'a',date:d.date,layer:'planned',start:11,end:15});if(n!==1)K.actualShifts.push({personId:'a',date:d.date,start:11,end:15});K.wishes.push({personId:'a',date:d.date,wishType:'preferred',start:11,end:16})});K.shifts.push({personId:'b',date:'2026-12-01',layer:'planned',start:12,end:18});K.actualShifts.push({personId:'b',date:'2026-12-01',start:12,end:18});});
 await page.addScriptTag({content:await readFile('src/ui/person-account-print.js','utf8')});
 const cfg={personIds:['a','b'],start:'2026-12-01',end:'2026-12-30',onlyActivity:true,presentation:false,detail:'full',header:'logo',nameMode:'clear',documentMode:'combined'};
 const old=await page.evaluate(c=>KCDP.personAccountPrint.buildHtml({...c,graphPage:false}),cfg);
 const html=await page.evaluate(c=>KCDP.personAccountPrint.buildHtml(c),cfg);
 await page.setContent(html);assert.equal(await page.locator('.pa-page').count(),8);assert.equal(await page.locator('.pa-graph-top').count(),4);
 assert.equal(await page.locator('.pa-graph-warning').count(),1);assert.match(await page.locator('.pa-graph-warning').innerText(),/Thomas Muster hat noch keine Zeiten/);
 assert.ok(await page.locator('pattern').count()>0);assert.ok(await page.locator('.missing-text').count()>0);assert.match(await page.locator('.pa-graph-total').first().innerText(),/Ist unvollständig/);
 const oldTables=await page.evaluate(()=>[...document.querySelectorAll('.pa-page')].filter(p=>p.querySelector('.pa-table')).map(p=>p.querySelector('.pa-table').outerHTML+p.querySelector('.pa-summary')?.outerHTML));
 assert.equal(await page.locator('.pa-foot').last().innerText().then(x=>x.includes('Seite 8 von 8')),true);
 await page.setContent(old);assert.equal(await page.locator('.pa-graph-top').count(),0);assert.equal(await page.locator('.pa-page').count(),4);
 assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.pa-page')].map(p=>p.querySelector('.pa-table').outerHTML+p.querySelector('.pa-summary')?.outerHTML)),oldTables);
 await page.setContent('<body><div id="modalBackdrop"><div id="modal"></div></div></body>');await page.evaluate(()=>KCDP.personAccountPrint.open());assert.equal(await page.locator('#paGraphPage').isChecked(),true);
 // Fourteen active days fit too; continuation pages do not overlap the footer.
 await page.setContent(html);await page.setViewportSize({width:1085,height:820});await page.emulateMedia({media:'print'});
 assert.ok((await page.locator('.pa-page').evaluateAll(pages=>pages.filter(p=>p.querySelector('.pa-graph-top')).map(p=>[...p.children].filter(c=>c.tagName!=='FOOTER').every(c=>c.getBoundingClientRect().bottom<=p.querySelector('.pa-foot').getBoundingClientRect().top)))).every(Boolean));
 const privateHtml=await page.evaluate(c=>{KCDP.people[1].pseudoName='P-02';return KCDP.personAccountPrint.buildHtml({...c,personIds:['b'],nameMode:'pseudo'})},cfg);
 assert.ok(!privateHtml.includes('Thomas Muster'),'Hinweis muss gewählte Namensanzeige beachten');
 // Representative ten-day print, with QR fixture, gaps and unknown wish.
 const sample=await page.evaluate(c=>{KCDP.days=KCDP.days.slice(0,10);return KCDP.personAccountPrint.buildHtml({...c,end:'2026-12-10'},{a:'<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>'})},cfg);
 await page.setContent(sample);await page.setViewportSize({width:1085,height:820});await page.emulateMedia({media:'print'});
 const overflow=await page.locator('.pa-page').evaluateAll(pages=>pages.map(p=>{const foot=p.querySelector('.pa-foot').getBoundingClientRect();return [...p.children].filter(c=>c.tagName!=='FOOTER').some(c=>c.getBoundingClientRect().bottom>foot.top)}));console.log('Überlauf',overflow);assert.ok(overflow.every(x=>!x),'Inhalt überschneidet Fuß');
 await mkdir('tmp/pdfs',{recursive:true});await page.screenshot({path:'tmp/pdfs/person-account-graphs.png',fullPage:true});
 if(process.env.ACCOUNT_PDF==='1')await page.pdf({path:'tmp/pdfs/person-account-graphs.pdf',preferCSSPageSize:true,printBackground:true});
 assert.deepEqual(errors,[]);console.log('Personenkonto-Grafiken: Standard/Schalter, fehlende Buchungen, unbekannter Wunsch, unveränderte Tabellen, Mehrpersonen und 30 Tage OK');
} finally {await browser.close();}
