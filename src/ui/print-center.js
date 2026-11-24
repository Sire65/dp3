(function(){
'use strict';
const K=window.KCDP,WIDTH=842,HEIGHT=595,LEFT=24,RIGHT=818,TOP=89,BOTTOM=552;
const labels={wish:'Wunschplan',plan:'Sollplan / Dienstplan',full:'Wünsche und Einteilung',deployment:'Einsatzplan',demand:'Regelzeit und Besetzung je Stunde',hours:'Stunden je Person laut Sollplan',wishhours:'Wunschstunden je Person',gaps:'Hier fehlen noch Helfer',suggestions:'Vorschläge zu den Lücken · nur Planung'};
const color={preferred:'#dce8fa',available:'#e1f2e6',if_needed:'#fff0be',unavailable:'#f6d6d3',planned:'#741521',standby:'#dcecf6',empty:'#ffffff',closed:'#efede9',line:'#bdb8b1',bad:'#f5c8c4',good:'#d8edda',over:'#f8e3a5',ink:'#292725'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=t=>`${String(Math.floor(t)).padStart(2,'0')}${t%1?':'+String(Math.round(t%1*60)).padStart(2,'0'):''}`;
const num=n=>Math.round(n*100)/100===0?'0':String(Math.round(n*100)/100).replace('.',',');
const date=s=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(s+'T12:00:00'));
const dayTitle=d=>`${date(d.date)} · ${d.type==='prep'?'Aufbau':d.type==='after'?'Nachbereitung':'Markttag'} · ${time(d.start)}–${time(d.end)} Uhr`;
const tone=(a,r)=>a<r?'bad':a>r?'over':'good';
const pdfEsc=s=>String(s??'').replace(/[–—]/g,'-').replace(/[„“”]/g,'"').replace(/[^\x20-\xff]/g,'?').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const rgb=hex=>{let h=hex.replace('#','');if(h.length===3)h=[...h].map(c=>c+c).join('');return h.match(/../g).map(n=>(parseInt(n,16)/255).toFixed(3)).join(' ');};
function canvas(){const out=[];return {out,
 rect(x,y,w,h,fill='#fff',stroke=color.line){if(fill)out.push(`${rgb(fill)} rg ${x.toFixed(2)} ${(HEIGHT-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);if(stroke)out.push(`${rgb(stroke)} RG .35 w ${x.toFixed(2)} ${(HEIGHT-y-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);},
 line(x,y,xx,yy,c=color.line,w=.4){out.push(`${rgb(c)} RG ${w} w ${x} ${HEIGHT-y} m ${xx} ${HEIGHT-yy} l S`);},
 text(x,y,t,size=8,bold=false,fill=color.ink,max=Infinity){let str=String(t??'');const fit=Math.floor(max/(size*.53));if(str.length>fit)str=str.slice(0,Math.max(0,fit-3))+'...';out.push(`${rgb(fill)} rg BT /${bold?'F2':'F1'} ${size} Tf ${x.toFixed(2)} ${(HEIGHT-y).toFixed(2)} Td (${pdfEsc(str)}) Tj ET`);}
 };}
const integral=(d,key,a=8,b=23)=>d.intervals.reduce((n,s)=>n+Math.max(0,Math.min(b,s.end)-Math.max(a,s.start))*s[key],0);
const at=(d,t)=>d.intervals.find(s=>s.start<=t&&s.end>t)||{needed:0,count:0,wish:0,extra:0,req:{total:0,front:0,back:0}};
function timelineRows(d,art,o){
 const rows=[];
 for(const p of d.people){
  if(art==='plan'&&!p.shifts.length)continue;
  if(art!=='plan')rows.push({name:p.name,sub:p.ownSubmitted?'Angaben der Person':'nicht selbst eingetragen',kind:'wish',segments:p.wishes,hours:p.wishHours,wh:p.wishHours,sh:p.planHours});
  if(art!=='wish')rows.push({name:art==='plan'?p.name:'  Einteilung',sub:p.shifts.length?p.shifts.some(s=>s.breakMinutes)?'Dienst · Pause siehe Balken':'Dienst':'nicht eingeteilt',kind:'plan',segments:p.shifts.map(s=>({...s,type:'planned'})),hours:p.planHours,wh:p.wishHours,sh:p.planHours});
 }
 if(o.standby)for(const p of d.people){const spans=art==='wish'?p.standby.own:p.standby.planned;if(spans.length)rows.push({name:p.name,sub:'Bereitschaft · separat',kind:'standby',segments:spans.map(([start,end])=>({start,end,type:'standby'})),hours:spans.reduce((n,[a,b])=>n+b-a,0)});}
 if(o.matrix){rows.push({name:art==='wish'?'Bedarf / Wunsch':'Bedarf / besetzt',kind:'matrix'});if(art!=='wish')rows.push({name:'Ampel',sub:'rot fehlt · grün passt · gelb zu viel',kind:'tone'});}
 if(!rows.length)rows.push({name:'Keine Einteilung an diesem Tag',kind:'empty'});
 return rows;
}
function timelineBlocks(model,art,o){return model.days.map(d=>{const rows=timelineRows(d,art,o),rh=Math.min(16,Math.floor((BOTTOM-TOP-36)/rows.length));if(rh<10)throw Error(`${date(d.date)}: Zu viele Zeilen für ein lesbares Tagesblatt. Bitte Personen filtern oder Wunschplan und Sollplan getrennt auswählen.`);return {kind:'timeline',d,art,rows,rh,height:36+rows.length*rh,force:art==='deployment'};});}
function timelineGeometry(art,range){const [from,to]=range,x0=204,max=art==='deployment'?738:766,wide=to-from<15,scale=(max-x0)/(wide?8:15);return {x0,x1:x0+(to-from)*scale,scale,right:to===23?(art==='deployment'?80:52):0};}
function paintTimeline(c,b,y,range){
 const {d,rows,rh,art}=b,[from,to]=range,{x0,x1,scale,right}=timelineGeometry(art,range);
 c.text(LEFT,y+10,dayTitle(d),10,true);c.text(450,y+10,`Bedarf ${num(d.demandHours)} h · ${art==='wish'?'Wunsch '+num(d.wishHours):'Soll '+num(d.planHours)} h`,8,true);
 y+=16;c.rect(LEFT,y,x1+right-LEFT,20,'#eee7df');c.text(LEFT+4,y+13,'Person',8,true);
 if(right)c.text(x1+4,y+13,art==='deployment'?'W / S h':'Std.',7.5,true);
 for(let t=from;t<to;t+=.5){const x=x0+(t-from)*scale;if(t%1===0)c.text(x+2,y+9,`${Math.floor(t)} Uhr`,6.5,true);c.text(x+2,y+17,t%1?':30':':00',5.5);}
 y+=20;
 for(const row of rows){
  c.rect(LEFT,y,x0-LEFT,rh,'#fff');c.text(LEFT+4,y+rh*.48,row.name,7.8,true,color.ink,x0-LEFT-8);if(row.sub)c.text(LEFT+4,y+rh*.9,row.sub,5.4,false,color.ink,x0-LEFT-8);
  for(let t=from;t<to;t+=.5){const x=x0+(t-from)*scale,point=at(d,t+.25),closed=point.needed===0;let fill=closed?color.closed:'#fff',text='';
   const parts=(row.kind==='matrix'||row.kind==='tone')?d.intervals.filter(s=>s.start<t+.5&&s.end>t):[];
   const changing=parts.some(s=>s.needed!==parts[0].needed||(art==='wish'?s.wish:s.count)!==(art==='wish'?parts[0].wish:parts[0].count));
   if(row.kind==='matrix'){const first=parts[0]||point;text=`${first.needed}/${art==='wish'?first.wish:first.count}${changing?'*':''}`;fill='#f2f1ef';}
   if(row.kind==='tone'){const status=parts.some(s=>s.count<s.needed)?'bad':parts.some(s=>s.count>s.needed)?'over':'good',n=status==='bad'?-Math.max(...parts.map(s=>s.missing)):status==='over'?Math.max(...parts.map(s=>s.over)):0;fill=closed&&n===0?color.closed:color[status];text=(n===0?'=':n>0?'+'+n:String(n))+(changing?'*':'');}
   c.rect(x,y,scale*.5,rh,fill);if(text)c.text(x+1,y+rh*.65,text,6.1,true);
  }
  for(const s of row.segments||[]){const a=Math.max(from,s.start),end=Math.min(to,s.end);if(a>=end)continue;const x=x0+(a-from)*scale,w=(end-a)*scale,fill=color[s.type]||'#fff';c.rect(x,y+1,w,rh-2,fill,s.type==='planned'?color.planned:color.line);
   if(s.type==='unavailable'){for(let t=a;t<end;t+=.5)c.text(x0+(t-from)*scale+scale*.2,y+rh*.7,'×',7,true,'#842c2c');}
   else{const label=`${time(s.start)}–${time(s.end)} · ${num(s.end-s.start)} h`;c.text(x+2,y+rh*.67,label,Math.max(5.7,Math.min(7,w/(label.length*.54))),true,s.type==='planned'?'#fff':color.ink,w-2);}
   if(s.type==='planned')for(const pause of s.breakSegments||[]){const aa=Math.max(a,pause.start),bb=Math.min(end,pause.end);if(bb>aa){c.rect(x0+(aa-from)*scale,y+rh-4,(bb-aa)*scale,3,'#fff',null);}}
  }
  if(right){c.rect(x1,y,right,rh,'#fff');if(row.hours!=null)c.text(x1+4,y+rh*.65,art==='deployment'&&row.kind!=='standby'?`${num(row.wh)} / ${num(row.sh)}`:num(row.hours),8,true);}
  y+=rh;
 }
}
function tableBlock(title,headers,rows,widths,{force=false,day=null}={}){return {kind:'table',title,headers,rows,widths,height:29+rows.length*17,force,day};}
function hoursBlocks(model,wish,o){
 const rows=model.people.map(p=>{const dayRows=model.days.map(d=>d.people.find(q=>q.id===p.id));const vals=dayRows.map(p=>p?(wish?p.wishHours:p.planHours):0),ber=dayRows.reduce((n,p)=>n+(p?.standby.planned||[]).reduce((s,[a,b])=>s+b-a,0),0),total=vals.reduce((n,v)=>n+v,0);return [p.name,...vals.map(num),num(total),...(!wish&&o.standby?[num(ber)]:[])];});
 const sums=model.days.map(d=>wish?d.wishHours:d.planHours),total=sums.reduce((n,v)=>n+v,0);
 rows.push(['Alle zusammen',...sums.map(num),num(total),...(!wish&&o.standby?[num(model.days.reduce((n,d)=>n+d.people.reduce((s,p)=>s+p.standby.planned.reduce((a,[x,y])=>a+y-x,0),0),0))]:[])]);
 if(o.matrix)rows.push(['Bedarf',...model.days.map(d=>num(d.demandHours)),num(model.days.reduce((n,d)=>n+d.demandHours,0)),...(!wish&&o.standby?['separat']:[])]);
 if(!wish&&o.matrix)rows.push(['Fehlt / zu viel',...model.days.map(d=>`-${num(d.missingHours)} / +${num(d.overHours)}`),`-${num(model.days.reduce((n,d)=>n+d.missingHours,0))}`,...(o.standby?['ohne Anrechnung']:[])]);
 const headers=['Person',...model.days.map(d=>d.date.slice(8)+'.'+d.date.slice(5,7)+'.'),'Gesamt',...(!wish&&o.standby?['Bereit.']:[])],left=150,last=wish?48:o.standby?100:48,middle=(794-left-last)/model.days.length,widths=[left,...model.days.map(()=>middle),...(wish?[48]:o.standby?[50,50]:[48])];
 const blocks=[];for(let i=0;i<rows.length;i+=23)blocks.push(tableBlock(labels[wish?'wishhours':'hours'],headers,rows.slice(i,i+23),widths));return blocks;
}
function demandBlocks(model,range){
 const [from,to]=range,hours=[];for(let t=Math.floor(from);t<to;t++)hours.push({start:Math.max(t,from),end:Math.min(t+1,to)});
 const showHours=to===23,scale=570/(to-from<15?8:15),widths=[174,...hours.map(h=>(h.end-h.start)*scale),...(showHours?[50]:[])],fields=[['total','Bedarf gesamt'],['count','Besetzt gesamt'],['front','Bedarf vorne'],['frontCount','Besetzt vorne'],['back','Bedarf hinten'],['backCount','Besetzt hinten'],['extra','Programm-Zuschlag']];
 return model.days.map(d=>{const value=(s,key)=>['total','front','back'].includes(key)?s.req[key]:s[key]||0;
 const block=tableBlock(dayTitle(d),['Regelmatrix',...hours.map(h=>time(h.start)+'–'+time(h.end)),...(showHours?['h']:[])],fields.map(([key,label])=>[label,...hours.map(h=>{const vals=[at(d,h.start+.01),at(d,Math.max(h.start,h.end-.5)+.01)].map(s=>value(s,key));return vals[0]===vals[1]?(vals[0]==null?'–':String(vals[0])):vals.map(v=>v==null?'–':v).join(' | ');}),...(showHours?[(['front','back'].includes(key)&&d.intervals.filter(s=>s.start>=d.start&&s.end<=d.end).every(s=>s.req[key]==null)?'–':num(d.intervals.reduce((n,s)=>n+value(s,key)*(s.end-s.start),0)))]:[])]),widths,{day:d.date});
 block.cellColors={1:Object.fromEntries(hours.map((h,i)=>{const parts=d.intervals.filter(s=>s.start<h.end&&s.end>h.start);const status=parts.some(s=>s.count<s.needed)?'bad':parts.some(s=>s.count>s.needed)?'over':'good';return [i+1,color[status]];}))};return block;});
}
function gapBlocks(model,suggest){return model.days.map(d=>{
 const rows=suggest?K.printData.suggestions(model,d).map(g=>[`${time(g.start)}–${time(g.end)}`,String(g.missing),(g.choices.slice(0,3).join(', ')+(g.choices.length>3?` (+${g.choices.length-3} weitere)`:''))||'Keine passende Person aus den hinterlegten Zeiten',`${num((g.end-g.start)*g.missing)} h`]):d.gaps.map(g=>[`${time(g.start)}–${time(g.end)}`,String(g.missing),'Personen fehlen',`${num((g.end-g.start)*g.missing)} h`]);
 return tableBlock(`${dayTitle(d)} · fehlen ${num(d.missingHours)} h`,['Zeit','Anzahl',suggest?'Mögliche Personen · noch nicht eingeteilt':'Offen','Fehlstunden'],rows.length?rows:[['—','0','Vollständig besetzt','0']], [110,55,529,100],{day:d.date});
 });}
function pack(blocks,title,range,model){const groups=[];let group=[],used=0;for(const b of blocks){if(b.height>BOTTOM-TOP)throw Error('Der Tagesblock ist zu groß. Bitte die Personenauswahl einschränken.');if(group.length&&(b.force||used+b.height>BOTTOM-TOP)){groups.push(group);group=[];used=0;}group.push(b);used+=b.height+9;if(b.force){groups.push(group);group=[];used=0;}}if(group.length)groups.push(group);return groups.map(blocks=>({title,blocks,range,model}));}
function pages(model,options={}){
 const o={types:['wish'],matrix:true,standby:true,appendHours:false,appendGaps:false,width:'one',...options},types=[...new Set([...o.types,...(o.appendHours?['hours',...(o.types.includes('wish')?['wishhours']:[])]:[]),...(o.appendGaps?['gaps']:[])])];
 if(!types.length)throw Error('Bitte mindestens eine Ausgabe auswählen.');
 const ranges=o.width==='two'?[[8,16],[15.5,23]]:[[8,23]],out=[];
 for(const type of types){
  if(!labels[type])continue;
  if(['wish','plan','full','deployment'].includes(type)){
   const blocks=timelineBlocks(model,type,o),packed=pack(blocks,labels[type],ranges[0],model);
   for(const p of packed)for(const range of ranges)out.push({...p,range,part:ranges.length===2?(range[0]===8?'links · bis 16 Uhr':'rechts · Klebekante 15:30–16 Uhr'):null});
  }else if(type==='demand'){for(const range of ranges)out.push(...pack(demandBlocks(model,range),labels[type],range,model));}
  else if(type==='hours'||type==='wishhours')out.push(...pack(hoursBlocks(model,type==='wishhours',o),labels[type],null,model));
  else out.push(...pack(gapBlocks(model,type==='suggestions'),labels[type],null,model));
 }
 return out;
}
function paintTable(c,b,y){
 c.text(LEFT,y+11,b.title,9.2,true);y+=17;let x=LEFT;
 b.headers.forEach((h,i)=>{c.rect(x,y,b.widths[i],12,'#eee7df');c.text(x+3,y+9,h,6.7,true,color.ink,b.widths[i]-5);x+=b.widths[i];});y+=12;
 for(const [ri,row] of b.rows.entries()){x=LEFT;row.forEach((v,i)=>{const value=String(v),isGap=b.headers[2]?.includes('Offen')||b.headers[2]?.includes('Mögliche'),isAmp=row[0]==='Fehlt / zu viel';let fill=ri%2?'#f7f6f4':'#fff';if(isGap&&row[1]!=='0'&&i===1)fill=color.bad;if(isAmp&&i>0)fill=/^-0 \/ \+0$/.test(value)?color.good:/^-0 \/ \+/.test(value)?color.over:color.bad;if(b.cellColors?.[ri]?.[i])fill=b.cellColors[ri][i];c.rect(x,y,b.widths[i],17,fill);c.text(x+3,y+11,v,7.1,i===0,color.ink,b.widths[i]-6);x+=b.widths[i];});y+=17;}
}
function paint(page,index,total,logo){const c=canvas(),m=page.model;
 if(logo)c.out.push('q 54 0 0 39 24 542 cm /Logo Do Q');else c.text(24,35,'KC WERNE',11,true);
 c.text(90,29,'KÖCHECLUB WERNE',13,true,color.planned);c.text(90,46,page.title,13,true,color.planned);c.text(90,60,`${m.event} · Druckstand ${new Date(m.at).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})} · Build ${m.build||''} · ${m.sourceLabel}`,6.8);
 const legend=page.title===labels.demand?'Je Stunde: Wert vor / nach :30 als Zahl | Zahl. V/H nur fest zugeordnet; flexible Personen zählen einmal im Gesamt.':page.title===labels.hours||page.title===labels.wishhours?'Wunschstunden = nur bevorzugte Zeit. Sollstunden nach DP2-Pausenregel. Bereitschaft separat, nie zur Summe addiert.':page.title===labels.suggestions?'Nur für die Planung: passende hinterlegte Zeitangebote; keine automatische Einteilung oder Bereitschaft.':page.title===labels.gaps?'Fehlstunden = fehlende Personen × Zeitdauer. Maßgeblich ist die Gesamtpersonenzahl, nicht die V/H-Zuordnung.':'Wunsch blau · kann grün · wenn nötig gelb · gesperrt × · Dienst weinrot · Bereitschaft hellblau';
 c.text(LEFT,76,legend,7);
 c.line(LEFT,82,RIGHT,82,color.planned,1);
 let y=TOP;for(const b of page.blocks){if(b.kind==='timeline')paintTimeline(c,b,y,page.range);else paintTable(c,b,y);y+=b.height+9;}
 c.line(LEFT,563,RIGHT,563,color.planned,.6);
 c.text(LEFT,574,`${m.filtered?'Gefilterte Auswahl: Bedarf bleibt Gesamtvorgabe; Besetzung zählt nur ausgewählte Personen.':'Gesamter Personenstand.'} Bereich: ${m.area==='all'?'alle':m.area==='front'?'vorne':'hinten'}.`,6.3);
 c.text(LEFT,584,'Bereitschaft separat. * = Wechsel im Zeitfeld. '+m.accounting+(page.part?' · '+page.part:''),6.1);
 c.text(747,584,`Seite ${index+1} von ${total}`,7,true);
 return c.out.join('\n');
}
async function generate(options={}){const model=K.printData.build(options),layout=pages(model,options);const bytes=await K.pdfAdapter.vectorPages(layout.map((page,i)=>logo=>paint(page,i,layout.length,logo)));if(bytes.length>=1000000)throw Error('Die Datei ist größer als 1 MB. Bitte weniger Ausgabearten zusammen auswählen.');return {bytes,model,pages:layout,fileName:`KC_DP2_Druck_${model.days[0].date}_${model.days.at(-1).date}.pdf`};}
function preview(result){
 const blob=new Blob([result.bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),dialog=document.createElement('dialog');dialog.className='kc-print-preview';dialog.innerHTML=`<h2>PDF-Vorschau · ${result.pages.length} Blatt · ${Math.ceil(result.bytes.length/1024)} KB</h2><iframe title="DP2 Druckvorschau" src="${url}"></iframe><div><button data-save>PDF speichern</button><button data-print>Drucken</button><button data-close>Schließen</button></div>`;document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-save]').onclick=()=>{const a=document.createElement('a');a.href=url;a.download=result.fileName;a.click();};dialog.querySelector('[data-print]').onclick=()=>{try{const f=dialog.querySelector('iframe');f.contentWindow.focus();f.contentWindow.print();}catch(_){window.open(url,'_blank');}};dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>{URL.revokeObjectURL(url);dialog.remove();};
}
function open(defaults={}){
 if(!K.auth?.has?.('roster.export.all')&&!K.auth?.has?.('roster.export.personal')){alert('Keine Druckberechtigung.');return;}
 if(K.planningDataReady===false||K.workMode&&!K.workPeopleReady){alert('Bitte warten, bis der gespeicherte Arbeitsstand vollständig geladen ist.');return;}
 document.getElementById('kcPrintDialog')?.remove();const dlg=document.createElement('dialog');dlg.id='kcPrintDialog';dlg.className='kc-print-dialog';
 const all=K.auth.has('roster.export.all'),people=(K.people||[]).filter(p=>K.printData.permitted(p)&&(all||p.personId===K.currentUser?.personId));
 dlg.innerHTML=`<h2>Dienstplan-Druck / PDF</h2><p>Nur der aktuell geladene DP2-Stand. Es werden keine Daten verändert oder Pläne freigegeben.</p><form><fieldset><legend>Ausgaben auswählen</legend><div class="kc-print-grid">${Object.entries(labels).map(([key,name])=>`<label><input type="checkbox" name="type" value="${key}" ${(defaults.types||['wish']).includes(key)?'checked':''}>${esc(name)}</label>`).join('')}</div></fieldset><div class="kc-print-grid"><label>Zeitraum<select name="scope"><option value="all">Alle Tage</option><option value="current">Aktueller Tag</option><option value="selected">Mehrere Tage auswählen</option><option value="prep">Nur Aufbau</option><option value="market">Nur Markttage</option><option value="after">Nur Nachbereitung</option></select></label><label>Bereich<select name="area"><option value="all">Alle Bereiche</option><option value="front">Vorne</option><option value="back">Hinten</option></select></label><label>Breite<select name="width"><option value="one">1 Blatt breit · 8–23 Uhr · A4 quer</option><option value="two">2 Blätter breit · 8–16 / 15:30–23 · A4 quer</option></select></label><label>Personen<select name="persons"><option value="all">${all?'Alle Personen':'Nur meine Angaben'}</option><option value="selected">Auswahl / Einzelplan</option></select></label></div><fieldset data-dates hidden><legend>Tage auswählen</legend><div class="kc-print-grid">${(K.days||[]).map(d=>`<label><input type="checkbox" name="date" value="${d.date}" checked>${esc(dayTitle(d))}</label>`).join('')}</div></fieldset><fieldset data-people hidden><legend>Personen auswählen · für Einzelplan nur einen Haken setzen</legend><div class="kc-print-grid">${people.map(p=>`<label><input type="checkbox" name="person" value="${esc(p.personId)}" checked>${esc(p.name)}</label>`).join('')}</div><button type="button" data-none>Alle abwählen</button><button type="button" data-all>Alle auswählen</button></fieldset><fieldset><legend>Inhalt</legend><div class="kc-print-grid"><label><input type="checkbox" name="matrix" checked>Matrixzeilen Bedarf / besetzt / Ampel</label><label><input type="checkbox" name="standby" checked>Bereitschaft separat anzeigen</label><label><input type="checkbox" name="appendHours">Stundenblätter am Ende</label><label><input type="checkbox" name="appendGaps">Lückenblatt am Ende</label></div></fieldset><p>Jeder Tag bleibt zusammen. Sehr große Tagesblätter bitte über die Personenauswahl aufteilen. Pausen werden wie im DP2-Arbeitsstand berücksichtigt. Änderungen seit dem Laden erscheinen nach erneutem Laden.</p><p data-status role="status"></p><div class="kc-print-actions"><button type="button" data-close>Schließen</button><button type="submit" class="primary">PDF-Vorschau erstellen</button></div></form>`;
 document.body.append(dlg);const form=dlg.querySelector('form');form.elements.scope.value=defaults.scope||'all';const toggle=()=>{dlg.querySelector('[data-dates]').hidden=form.elements.scope.value!=='selected';dlg.querySelector('[data-people]').hidden=form.elements.persons.value!=='selected';};form.onchange=toggle;toggle();dlg.querySelector('[data-close]').onclick=()=>dlg.close();dlg.querySelector('[data-none]').onclick=()=>form.querySelectorAll('[name=person]').forEach(x=>x.checked=false);dlg.querySelector('[data-all]').onclick=()=>form.querySelectorAll('[name=person]').forEach(x=>x.checked=true);dlg.onclose=()=>dlg.remove();dlg.showModal();
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]'),status=dlg.querySelector('[data-status]');button.disabled=true;status.textContent='PDF wird erstellt …';try{const f=new FormData(form),o={types:f.getAll('type'),scope:f.get('scope'),dates:f.getAll('date'),area:f.get('area'),width:f.get('width'),personIds:f.get('persons')==='selected'?f.getAll('person'):null,...Object.fromEntries(['matrix','standby','appendHours','appendGaps'].map(k=>[k,f.has(k)]))};const result=await generate(o);status.textContent=`${result.pages.length} Blatt · ${Math.ceil(result.bytes.length/1024)} KB · Vorschau geöffnet`;preview(result);}catch(err){status.textContent='PDF nicht erstellt: '+err.message;}finally{button.disabled=false;}};
}
function install(){if(document.getElementById('kcPrintStart')||!document.getElementById('moreBtn'))return;const b=document.createElement('button');b.id='kcPrintStart';b.type='button';b.className='tool-btn';b.textContent='Druck / PDF';b.onclick=()=>open();document.getElementById('moreBtn').after(b);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
K.printCenter={open,generate,pages,paint,preview,labels,timelineGeometry};
})();
