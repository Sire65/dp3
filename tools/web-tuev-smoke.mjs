import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1366,height:768}}),runtimeErrors=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  const response=await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:30000});
  if(!response||response.status()>=400)throw new Error(`HTTP ${response?.status()}`);
  await page.waitForTimeout(2000);
  const info=await page.evaluate(()=>({title:document.title,body:(document.body?.innerText||'').trim().length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  console.log(JSON.stringify(info));
  if(info.body<1)throw new Error('Leere Seite');
  if(runtimeErrors.length)throw new Error(`JavaScript runtime errors: ${runtimeErrors.join(' | ')}`);
}finally{await browser.close();}