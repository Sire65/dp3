// Build 254: „Meine Angaben ausdrucken“ – Sicherheitsabfrage, PDF-Vorschau, erst dann Drucken; an allen drei Abschlüssen.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL===''?{}:{channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'})});
const files=['vendor/qrcode-generator','core/model','core/wish-contract','core/planning','core/auth','core/workflow','core/actual','core/configuration','core/mobile-wish-matrix','core/document-identity','core/personalized-forms','adapters/pdf','ui/member-button-logic','ui/role-ux','ui/mobile-wish-matrix','ui/wish-assistant','ui/chef-companion','ui/twinkey','ui/assistant-staffing','ui/assistant-hours','ui/simple-wish-assistant','ui/wish-print'];
async function seite(width,{desktopPdf}){
 const page=await browser.newPage({viewport:{width,height:820}}),errors=[];page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.abort());
 await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="kcdpUxRoot"></div></body></html>');
 await page.evaluate(v=>{Object.defineProperty(navigator,'pdfViewerEnabled',{configurable:true,get:()=>v});Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=>v?'Mozilla/5.0 (X11; Linux x86_64) Chrome/140':'Mozilla/5.0 (Linux; Android 14) Mobile'});},!!desktopPdf);
 const html=await readFile(path.join(root,'index.html'),'utf8');for(const file of [...html.matchAll(/<link[^>]+href="([^"?]+\.css)[^"]*"/g)].map(x=>x[1]).filter(x=>!x.startsWith('http')))await page.addStyleTag({content:await readFile(path.join(root,file),'utf8')});
 for(const f of files)await page.addScriptTag({content:await readFile(path.join(root,'src/'+f+'.js'),'utf8')});
 await page.evaluate(()=>{const K=KCDP,me=K.people[0].personId;K.days=K.days.filter(d=>['2026-12-04','2026-12-05'].includes(d.date));K.shifts=[];K.actualShifts=[];K.planSharing=[];K.memberUxData={};
  K.wishes=[{id:'W1',personId:me,date:'2026-12-04',start:14,end:18,wishType:'available',wishZone:'V',status:'confirmed'},{id:'W2',personId:me,date:'2026-12-05',start:11,end:23,wishType:'unavailable',scope:'day',wishZone:'B',status:'confirmed'}];
  K.currentUser={personId:me,displayName:K.people[0].name,role:'employee'};K.persistAll=async()=>{};K.latestPublishedVersion=()=>null;K.requirementFor=()=>({total:20,front:10,back:10});});
 return {page,errors};
}
const dialoge=[];
// 1) Tagesmatrix: Abbrechen → nichts; Bestätigen → Vorschau (Handy: PDF öffnen)
{const {page,errors}=await seite(390,{desktopPdf:false});page.on('dialog',d=>{dialoge.push(d.message());d.dismiss()});
 await page.evaluate(()=>KCDP.mobileMatrixUi.overview());
 assert.ok(await page.locator('#mmPrint').isVisible(),'Matrix: Knopf fehlt');
 await page.click('#mmPrint');await page.waitForTimeout(200);
 assert.match(dialoge.at(-1),/PDF erstellt[\s\S]*QR-Code[\s\S]*Vorschau/,'Sicherheitsabfrage fehlt');
 assert.equal(await page.locator('.wp-overlay').count(),0,'nach Abbrechen darf nichts erscheinen');
 assert.match(await page.locator('#mmPrintStatus').innerText(),/abgebrochen/);
 page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());
 await page.click('#mmPrint');await page.locator('.wp-overlay').waitFor();
 assert.equal(await page.locator('#wpPdf').count(),0,'Handy: keine eingebettete Vorschau');
 assert.ok(await page.locator('#wpOeffnen').isVisible()&&/PDF öffnen/.test(await page.locator('#wpOeffnen').innerText()),'Handy: PDF öffnen fehlt');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Vorschau zu breit');
 const [dl]=await Promise.all([page.waitForEvent('download'),page.click('#wpSpeichern')]);assert.match(dl.suggestedFilename(),/^KC_DP2_Meine_Wunschzeiten_.+_HP-[A-Z0-9]+\.pdf$/);
 const pdf=await page.evaluate(async()=>{const r=await KCDP.personalizedForms.filledPdf(KCDP.currentUser.personId);return String.fromCharCode(...r.bytes.slice(0,8))+'|'+r.bytes.length+'|'+r.tage+'|'+r.gesperrt});
 assert.match(pdf,/^%PDF-1\.4\|\d{5,}\|2\|1$/,'PDF fehlerhaft: '+pdf);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.wp-overlay').count(),0,'Esc schließt nicht');
 assert.deepEqual(errors,[]);await page.close();}
// 2) Desktop: eingebettete PDF-Vorschau, Drucken erst im Vorschaufenster
{const {page,errors}=await seite(1280,{desktopPdf:true});page.on('dialog',d=>d.accept());
 await page.evaluate(()=>KCDP.mobileMatrixUi.overview());await page.click('#mmPrint');await page.locator('.wp-overlay').waitFor();
 assert.equal(await page.locator('#wpPdf').count(),1,'Desktop: Vorschau fehlt');assert.match(await page.locator('#wpPdf').getAttribute('src'),/^blob:/);
 assert.ok(await page.locator('#wpDruck').isVisible(),'Desktop: Drucken fehlt');
 await page.click('#wpSchliessen');assert.equal(await page.locator('.wp-overlay').count(),0);
 assert.deepEqual(errors,[]);await page.close();}
// 3) Twinkey-Auswertung und einfacher Assistent zeigen denselben Knopf
for(const width of [320,768]){const {page,errors}=await seite(width,{desktopPdf:false});
 await page.evaluate(()=>KCDP.chefCompanion.finish());assert.ok(await page.locator('#chefPrint').isVisible(),'Twinkey-Auswertung: Knopf fehlt');
 await page.evaluate(()=>KCDP.simpleWishAssistant.open('2026-12-05'));await page.locator('#swDayBlock').waitFor();
 if(!(await page.locator('#swDayBlock').isChecked()))await page.check('#swDayBlock');await page.click('#swNext');await page.click('#swNext');await page.locator('#swFinish').waitFor();await page.click('#swFinish');
 assert.ok(await page.locator('#swPrintPdf').isVisible(),'Einfacher Assistent: Knopf am Schluss fehlt');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Abschluss zu breit');
 assert.deepEqual(errors,[]);await page.close();}
await browser.close();
console.log('Wunsch-Ausdruck PASS: Sicherheitsabfrage (Abbrechen ohne Wirkung), PDF-Vorschau Desktop/Handy, Speichern, Esc, gültiges PDF mit QR-Profil, Knopf in Matrix, Twinkey-Auswertung und am Schluss des einfachen Assistenten, 320–1280px.');
