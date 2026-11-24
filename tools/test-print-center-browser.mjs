import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const real=process.env.PRINT_QA_REAL?JSON.parse(await readFile(process.env.PRINT_QA_REAL,'utf8')):null;
const fixture=real?.club||{stand:'2026-11-24T12:00:00Z',von:8,bis:23,tage:Array.from({length:13},(_,i)=>({d:`2026-12-${String(i+2).padStart(2,'0')}`,art:i<2?'Aufbau':i===12?'Nachbereitung':'Markttag',bedarf:Array.from({length:30},(_,j)=>j>=4?3:0),vorne:Array(30).fill(2),hinten:Array(30).fill(1),leute:Array.from({length:16},(_,p)=>({p:'test-'+p,n:'Testperson '+(p+1),w:p%4?'----ppppppppppaaaaaaaaaa------':'----iiiiiiiiiiiiiiiiiiii------',f:p===15?1:0,s:p<3?[10+p*.5,16+p*.5]:null})),ber:[{p:'test-3',n:'Testperson 4',s:[20,23]}]}))};
function setupData(club){
 const names=new Map(club.tage.flatMap(d=>d.leute.map(p=>[p.p||p.n,p.n]))),people=[...names].map(([personId,name])=>({personId,name,active:true})),days=[],wishes=[],shifts=[],assistantStandby={},expected={hours:{},wish:{},missing:0};
 const codes={p:'preferred',a:'available',i:'if_needed',u:'unavailable'};
 for(const d of club.tage){
  const first=d.bedarf.findIndex(n=>n>0),last=d.bedarf.findLastIndex(n=>n>0),start=first>=0?8+first/2:8,end=last>=0?8+(last+1)/2:23;
  days.push({date:d.d,start,end,type:d.art==='Aufbau'?'prep':d.art==='Nachbereitung'?'after':'market',demand:d.bedarf,front:d.vorne,back:d.hinten});
  for(const p of d.leute){const pid=p.p||p.n,w=p.f?'':p.we??p.w??'';for(let i=0;i<w.length;){let j=i+1;while(j<w.length&&w[j]===w[i])j++;if(codes[w[i]])wishes.push({personId:pid,date:d.d,start:8+i/2,end:8+j/2,wishType:codes[w[i]],source:'club_app'});i=j;}expected.wish[pid]=(expected.wish[pid]||0)+[...w].filter(c=>c==='p').length/2;if(p.s){shifts.push({id:`${d.d}-${pid}`,personId:pid,date:d.d,start:p.s[0],end:p.s[1],zone:'neutral',layer:'planned',status:'draft',breakMinutes:0});expected.hours[pid]=(expected.hours[pid]||0)+p.s[1]-p.s[0];}}
  for(const b of d.ber||[]){const pid=b.p||[...names].find(([,name])=>name===b.n)?.[0];if(pid)(assistantStandby[pid]??={})[d.d]={answer:'yes',slots:[{start:b.s[0],end:b.s[1]}]};}
  expected.missing+=d.bedarf.reduce((n,r,i)=>n+Math.max(0,r-d.leute.filter(p=>p.s&&p.s[0]<=8+i/2&&p.s[1]>8+i/2).length)/2,0);
 }
 return {people,days,wishes,shifts,memberUxData:{assistantStandby},expected};
}
const data=setupData(fixture),browser=await chromium.launch({channel:'chrome',headless:true}),folder=process.env.PRINT_QA_REAL?'tmp/print-center-real-qa':'tmp/print-center-qa';await mkdir(folder,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const logo=await readFile('assets/kc-original-kochmuetze.png');await page.route('https://print.test/**',r=>r.request().url().includes('kc-original-kochmuetze.png')?r.fulfill({contentType:'image/png',body:logo}):r.fulfill({contentType:'text/html',body:'<button id="moreBtn">Mehr</button>'}));await page.goto('https://print.test/');
 await page.evaluate(data=>{window.KC_DP_BUILD=323;const K=window.KCDP={...data,currentUser:{personId:data.people[0].personId},state:{dateIndex:2},auth:{has:()=>true},eventConfig:{name:'Weihnachtsmarkt Werne 2026'},personPlanningAllowed:()=>true,validateShift:()=>[],standby:[]};K.requirementFor=(d,t)=>({total:d.demand[Math.floor((t-8)*2)]||0,front:d.front?.[Math.floor((t-8)*2)]||0,back:d.back?.[Math.floor((t-8)*2)]||0});K.baseRequirementFor=K.requirementFor;},data);
 for(const f of ['core/print-center','adapters/pdf','ui/print-center'])await page.addScriptTag({content:await readFile('src/'+f+'.js','utf8')});await page.addStyleTag({content:await readFile('src/ui/print-center.css','utf8')});
 const comparison=await page.evaluate(()=>{const m=KCDP.printData.build();return {hours:Object.fromEntries(m.people.map(p=>[p.id,m.days.reduce((n,d)=>n+(d.people.find(q=>q.id===p.id)?.planHours||0),0)])),wish:Object.fromEntries(m.people.map(p=>[p.id,m.days.reduce((n,d)=>n+(d.people.find(q=>q.id===p.id)?.wishHours||0),0)])),missing:m.days.reduce((n,d)=>n+d.missingHours,0)};});
 for(const [pid,h] of Object.entries(data.expected.hours))assert.equal(comparison.hours[pid],h,`Sollstunden ${pid}`);for(const [pid,h] of Object.entries(data.expected.wish))assert.equal(comparison.wish[pid],h,`Wunschstunden ${pid}`);assert.equal(comparison.missing,data.expected.missing,'Lücken bei identischem Stand wie Club-App');
 const reports=[];
 for(const type of ['wish','plan','full','deployment','demand','hours','wishhours','gaps','suggestions'])for(const scope of ['current','all'])for(const width of ['one','two']){
  const r=await page.evaluate(async({type,scope,width})=>{const r=await KCDP.printCenter.generate({types:[type],scope,width});return {bytes:Array.from(r.bytes),pages:r.pages.length,days:r.pages.flatMap(p=>p.blocks.map(b=>b.d?.date||b.day).filter(Boolean))};},{type,scope,width});
  assert(r.bytes.length<1000000);assert(r.pages>0);const file=`${folder}/${type}-${scope}-${width}.pdf`;await writeFile(file,Buffer.from(r.bytes));reports.push({file,pages:r.pages,size:r.bytes.length});
 }
 await page.locator('#kcPrintStart').click();await page.locator('[name=scope]').selectOption('selected');await page.locator('[name=persons]').selectOption('selected');assert(await page.locator('[data-dates]').isVisible());assert(await page.locator('[data-people]').isVisible());await page.locator('[data-none]').click();assert.equal(await page.locator('[name=person]:checked').count(),0);await page.locator('[name=person]').first().check();await page.locator('[type=submit]').click();await page.locator('.kc-print-preview').waitFor();assert(await page.locator('.kc-print-preview iframe').getAttribute('src'));await page.screenshot({path:folder+'/filter-preview.png'});
 assert.deepEqual(errors,[]);await writeFile(folder+'/report.json',JSON.stringify({reports,comparison,expected:data.expected,stand:fixture.stand},null,2));console.log(`PASS print browser: ${reports.length} PDFs, all nine types, day/all, 1/2 sheets wide, each <1MB; UI selection/preview; identical-source hours and gaps ${comparison.missing} h.`);
}finally{await browser.close();}
