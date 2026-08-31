import {writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'file:///C:/Users/Koch/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
await page.evaluate(()=>{window.KCDP={days:[{date:'2026-12-02'},{date:'2026-12-14'}],documentIdentity:{randomCode:()=> 'ABCDEFGHJKLM'},persistAll:async()=>{}}});
await page.addScriptTag({path:path.join(root,'src/vendor/qrcode-generator.js')});
await page.addScriptTag({path:path.join(root,'src/core/personalized-forms.js')});
await page.addScriptTag({path:path.join(root,'src/adapters/pdf.js')});
const bytes=await page.evaluate(async()=>{
  const K=window.KCDP,person={personId:'KC-P-001',name:'Anne Beispiel'},profile=K.personalizedForms.profileFor(person),qrMatrix=await K.personalizedForms.qrFor(profile.payload),doc=K.personalizedForms._test.handwritingDoc(person,profile,qrMatrix),host=document.createElement('div');
  host.innerHTML=doc.html;
  document.body.append(host);
  return [...await K.pdfAdapter._test.buildPages([...host.querySelectorAll('.doc-page')],doc)];
});
await browser.close();
const output=path.join(os.tmpdir(),'KC_DP2_Handschriftprobe_Build121.pdf');
await writeFile(output,Buffer.from(bytes));
console.log(output);
