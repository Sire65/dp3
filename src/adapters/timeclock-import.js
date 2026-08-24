(function(){
  const K=window.KCDP=window.KCDP||{};
  let provider=typeof window.KCDPTimeClockProvider==='function'?window.KCDPTimeClockProvider:null;
  const aliases={
    personId:['personid','personalid','mitarbeiterid','persnr','personalnr','id'],
    name:['mitarbeiter','name','mitarbeitername','person'],date:['datum','date','tag'],
    start:['kommen','start','beginn','von','startzeit'],end:['gehen','ende','bis','endzeit'],breakMinutes:['pause','pausemin','pausenminuten','break']
  };
  const norm=s=>String(s??'').trim().toLowerCase().replace(/[\s_.\-/]+/g,'');
  const splitCsvLine=(line,delimiter)=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===delimiter&&!q){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out.map(x=>x.trim());};
  function delimiterFor(line){const cand=[';','\t',','];return cand.map(d=>[d,(line.match(new RegExp(d==='\t'?'\\t':`\\${d}`,'g'))||[]).length]).sort((a,b)=>b[1]-a[1])[0][0];}
  function parseDate(v){v=String(v||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;let m=v.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);if(!m)return null;let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;}
  function parseTime(v){if(v==null||v==='')return null;if(typeof v==='number')return v;v=String(v).trim().replace(',', '.');if(/^\d{1,2}:\d{2}/.test(v)){const [h,m]=v.split(':').map(Number);return h+m/60;}const n=Number(v);return Number.isFinite(n)?n:null;}
  function parseBreak(v){if(v==null||v==='')return 0;v=String(v).trim();if(v.includes(':')){const [h,m]=v.split(':').map(Number);return h*60+m;}const n=Number(v.replace(',','.'));return Number.isFinite(n)?n:0;}
  function uniquePersonByName(name){const n=norm(name);const rows=K.people.filter(p=>norm(p.name)===n);return rows.length===1?rows[0]:null;}
  function mapHeaders(headers){const map={};headers.forEach((h,i)=>{const n=norm(h);for(const [key,list] of Object.entries(aliases))if(list.includes(n)&&map[key]==null)map[key]=i;});return map;}
  function normalizeRow(raw,{map=null,rowNumber=null}={}){
    let personId=raw.personId||raw.personalId||raw.employeeId||null,name=raw.name||raw.mitarbeiter||null,date=raw.date||raw.datum||null,start=raw.start??raw.kommen??raw.von,end=raw.end??raw.gehen??raw.bis,breakMinutes=raw.breakMinutes??raw.pause??0;
    if(Array.isArray(raw)&&map){personId=map.personId!=null?raw[map.personId]:null;name=map.name!=null?raw[map.name]:null;date=map.date!=null?raw[map.date]:null;start=map.start!=null?raw[map.start]:null;end=map.end!=null?raw[map.end]:null;breakMinutes=map.breakMinutes!=null?raw[map.breakMinutes]:0;}
    let matchSource='personId';if(personId&&!K.person(String(personId).trim()))personId=null;
    if(!personId&&name){const p=uniquePersonByName(name);if(p){personId=p.personId;matchSource='unique_name';}}
    const out={rowNumber,personId:personId?String(personId).trim():'',name:String(name||''),date:parseDate(date),start:parseTime(start),end:parseTime(end),breakMinutes:parseBreak(breakMinutes),source:'file_import',matchSource};
    out.issues=[];if(!out.personId)out.issues.push('Person nicht eindeutig zugeordnet');if(!out.date)out.issues.push('Datum fehlt/ungültig');if(out.start==null)out.issues.push('Kommen fehlt/ungültig');if(out.end==null)out.issues.push('Gehen fehlt/ungültig');if(out.start!=null&&out.end!=null&&out.end<=out.start)out.issues.push('Gehen liegt nicht nach Kommen');out.valid=out.issues.length===0;return out;
  }
  function parseCsv(text){const lines=String(text||'').split(/\r?\n/).filter(l=>l.trim());if(lines.length<2)throw new Error('CSV enthält keine Datenzeilen.');const delimiter=delimiterFor(lines[0]),headers=splitCsvLine(lines[0],delimiter),map=mapHeaders(headers);if(map.date==null||map.start==null||map.end==null||(map.personId==null&&map.name==null))throw new Error('Benötigte Spalten nicht erkannt: Person/ID, Datum, Kommen, Gehen.');return lines.slice(1).map((l,i)=>normalizeRow(splitCsvLine(l,delimiter),{map,rowNumber:i+2}));}
  function parseJson(text){const parsed=JSON.parse(text);const rows=Array.isArray(parsed)?parsed:(Array.isArray(parsed.rows)?parsed.rows:[]);if(!rows.length)throw new Error('JSON enthält keine Istzeit-Datensätze.');return rows.map((r,i)=>normalizeRow(r,{rowNumber:i+1}));}
  async function analyzeFile(file){
    const name=String(file?.name||'').toLowerCase();
    if(/\.xlsx?$/.test(name)){if(!provider)throw new Error('XLSX benötigt einen verbundenen TimeClock-/Import-Provider. CSV oder JSON kann KC DP direkt prüfen.');const res=await provider({action:'parse_file',contract:'KC_TIMECLOCK_IMPORT_V1',file});return {mode:'provider',rows:(res?.rows||[]).map((r,i)=>normalizeRow(r,{rowNumber:i+1})),meta:res?.meta||{}};}
    const text=await file.text();const rows=name.endsWith('.json')?parseJson(text):parseCsv(text);return {mode:name.endsWith('.json')?'json':'csv',rows,meta:{fileName:file.name,size:file.size,type:file.type||null}};
  }
  async function pullFromTimeClock({dateFrom=null,dateTo=null}={}){if(!provider)throw new Error('Kein TimeClock-Provider verbunden.');const res=await provider({action:'pull',contract:'KC_TIMECLOCK_IMPORT_V1',dateFrom,dateTo});const rows=(res?.rows||[]).map((r,i)=>normalizeRow({...r,source:'timeclock'},{rowNumber:i+1}));return {mode:'timeclock',rows,meta:res?.meta||{}};}
  K.timeclockImport={version:'0.7.0',setProvider(fn){provider=typeof fn==='function'?fn:null;},hasProvider(){return !!provider;},parseDate,parseTime,normalizeRow,parseCsv,parseJson,analyzeFile,pullFromTimeClock};
})();
