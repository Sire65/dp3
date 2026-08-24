(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
if(!window.XLSX&&document.readyState==='loading')document.write('<script src="src/adapters/xlsx-local.js?v=0.19.42"><\/script>');

const clean=v=>String(v??'').replace(/\u00a0/g,' ').trim();
const norm=v=>clean(v).toLowerCase().replace(/[„“”]/g,'"').replace(/\s+/g,' ');
const yes=v=>['ja','j','yes','y','1','true','x','✓'].includes(norm(v));

function parseDate(v){
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
  if(typeof v==='number'&&Number.isFinite(v)){
    const ms=Math.round((v-25569)*86400*1000),d=new Date(ms);
    if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10);
  }
  const s=clean(v);if(!s)return'';
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  let m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  if(m)return `${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  m=s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
  return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';
}
function parseTime(v){
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return v.getHours()+v.getMinutes()/60+v.getSeconds()/3600;
  if(typeof v==='number'&&Number.isFinite(v))return v>=0&&v<1?v*24:(v>=0&&v<=24?v:null);
  const s=clean(v);if(!s||s==='–'||s==='-')return null;
  let m=s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);if(m){const h=Number(m[1]),mi=Number(m[2]),se=Number(m[3]||0);return h<=24&&mi<60&&se<60?h+mi/60+se/3600:null;}
  m=s.match(/^(\d{1,2})[.,](\d{1,2})$/);if(m){const h=Number(m[1]),mins=Number(m[2]);return h<=24&&mins<60?h+mins/60:null;}
  return null;
}
function splitLine(line,delimiter){
  const out=[];let cur='',quoted=false;
  for(let i=0;i<String(line).length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;
    }else if(ch===delimiter&&!quoted){out.push(cur);cur='';}else cur+=ch;
  }
  out.push(cur);return out;
}
function delimiterFor(text){
  const line=String(text||'').split(/\r?\n/).find(x=>x.trim())||'';
  const counts=[';','\t',','].map(d=>[d,splitLine(line,d).length]);counts.sort((a,b)=>b[1]-a[1]);return counts[0][0];
}
function parseDelimited(text){
  const delimiter=delimiterFor(text),rows=[];let row=[],cur='',quoted=false;
  const s=String(text||'');
  const pushCell=()=>{row.push(cur);cur='';};const pushRow=()=>{pushCell();if(row.some(c=>clean(c)!==''))rows.push(row);row=[];};
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(ch==='"'){
      if(quoted&&s[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;
    }else if(ch===delimiter&&!quoted)pushCell();
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&s[i+1]==='\n')i++;pushRow();}
    else cur+=ch;
  }
  if(cur.length||row.length)pushRow();return rows;
}
const templateHeaders=['datum','kann von','kann bis','v/h/b','wunsch von','wunsch bis','sperrzeit von','sperrzeit bis','sperrtag','nur wenn nötig','bemerkung'];
function headerRowIndex(matrix){
  return (matrix||[]).findIndex(row=>{const ns=(row||[]).map(norm),hits=templateHeaders.filter(h=>ns.includes(h)).length;return ns.includes('datum')&&(hits>=3||ns.includes('von')&&ns.includes('bis'));});
}
function matrixToObjects(matrix){
  const idx=headerRowIndex(matrix);if(idx<0)return {rows:[],headerIndex:-1};
  const headers=(matrix[idx]||[]).map(clean),rows=[];
  for(let r=idx+1;r<matrix.length;r++){
    const vals=matrix[r]||[];if(!vals.some(v=>clean(v)!==''))continue;
    const obj={__rowNumber:r+1};headers.forEach((h,i)=>{if(h)obj[h]=vals[i]??''});rows.push(obj);
  }
  return {rows,headerIndex:idx};
}
function getField(row,aliases){
  const entries=Object.entries(row||{});const wanted=aliases.map(norm);const found=entries.find(([k])=>wanted.includes(norm(k)));return found?found[1]:'';
}
function entry(date,start,end,wishType,comment,rowNumber,sourceField,wishZone='B'){return {date,start,end,wishType,comment:clean(comment),rowNumber,sourceField,wishZone};}
function expandRow(row,index=0){
  const rowNumber=Number(row?.__rowNumber)||index+2,issues=[],entries=[];
  const date=parseDate(getField(row,['Datum','Date','Tag']));
  if(!date){
    const relevant=['Kann von','Kann bis','V/H/B','Wunsch von','Wunsch bis','Sperrzeit von','Sperrzeit bis','Sperrtag','Nur wenn nötig','Von','Bis','Start','Ende'].some(k=>clean(getField(row,[k]))!==''&&!['nein','no','false','0'].includes(norm(getField(row,[k]))));
    if(relevant)issues.push({rowNumber,level:'error',text:'Datum fehlt oder ist nicht lesbar.'});
    return {entries,issues,rowNumber};
  }
  const day=(K.days||[]).find(d=>d.date===date);
  if((K.days||[]).length&&!day){issues.push({rowNumber,level:'error',text:`${date} gehört nicht zum aktuellen KC-DP-Zeitraum.`});return {entries,issues,rowNumber};}
  const remark=clean(getField(row,['Bemerkung','Kommentar','Hinweis','Notiz']));
  const blockedDay=yes(getField(row,['Sperrtag','Gesperrt','Tag gesperrt']));
  const onlyIfNeeded=yes(getField(row,['Nur wenn nötig','Wenn nötig','Reserve']));
  const zoneRaw=clean(getField(row,['V/H/B','VHB','Einsatz V/H/B']));
  const wishZone=zoneRaw?zoneRaw.toUpperCase():'B';
  if(zoneRaw&&!['V','H','B'].includes(wishZone))issues.push({rowNumber,level:'error',text:'„V/H/B“ erlaubt ausschließlich V, H oder B.'});
  const canFrom=parseTime(getField(row,['Kann von','Verfügbar von','Kann ab']));
  const canTo=parseTime(getField(row,['Kann bis','Verfügbar bis','Kann bis Uhr']));
  const wishFrom=parseTime(getField(row,['Wunsch von','Bevorzugt von','Wunsch ab']));
  const wishTo=parseTime(getField(row,['Wunsch bis','Bevorzugt bis']));
  const blockFrom=parseTime(getField(row,['Sperrzeit von','Nicht verfügbar von','Gesperrt von']));
  const blockTo=parseTime(getField(row,['Sperrzeit bis','Nicht verfügbar bis','Gesperrt bis']));
  const legacyFrom=parseTime(getField(row,['Von','Start','Beginn']));
  const legacyTo=parseTime(getField(row,['Bis','Ende','End']));
  const hasTemplateFields=Object.keys(row||{}).some(k=>templateHeaders.includes(norm(k))&&norm(k)!=='datum');
  if(blockedDay){
    const start=day?.start??0,end=day?.end??24;entries.push(entry(date,start,end,'unavailable',remark||'Sperrtag',rowNumber,'Sperrtag','B'));
    if([canFrom,canTo,wishFrom,wishTo,blockFrom,blockTo].some(v=>v!=null))issues.push({rowNumber,level:'warning',text:'Sperrtag = Ja: weitere Zeitangaben dieser Zeile werden bewusst ignoriert.'});
    return {entries,issues,rowNumber};
  }
  if((canFrom==null)!==(canTo==null))issues.push({rowNumber,level:'error',text:'„Kann von“ und „Kann bis“ müssen immer gemeinsam ausgefüllt sein.'});
  if(canFrom!=null&&canTo!=null){if(canTo<=canFrom)issues.push({rowNumber,level:'error',text:'„Kann bis“ muss nach „Kann von“ liegen.'});else entries.push(entry(date,canFrom,canTo,onlyIfNeeded?'if_needed':'available',remark||(onlyIfNeeded?'Nur wenn nötig':''),rowNumber,onlyIfNeeded?'Nur wenn nötig':'Kann',wishZone));}
  if((wishFrom==null)!==(wishTo==null))issues.push({rowNumber,level:'error',text:'„Wunsch von“ und „Wunsch bis“ müssen immer gemeinsam ausgefüllt sein.'});
  if(wishFrom!=null&&wishTo!=null){
    if(wishTo<=wishFrom)issues.push({rowNumber,level:'error',text:'„Wunsch bis“ muss nach „Wunsch von“ liegen.'});
    else if(canFrom==null||canTo==null)issues.push({rowNumber,level:'error',text:'Eine Wunschzeit braucht immer eine vollständige „Kann“-Zeit als Rahmen.'});
    else if(wishFrom<canFrom||wishTo>canTo)issues.push({rowNumber,level:'error',text:'Die Wunschzeit muss vollständig innerhalb der „Kann“-Zeit liegen.'});
    else if(onlyIfNeeded)issues.push({rowNumber,level:'error',text:'„Wunsch“ und „Nur wenn nötig = Ja“ widersprechen sich. Bitte eine der beiden Angaben wählen.'});
    else entries.push(entry(date,wishFrom,wishTo,'preferred',remark||'Bevorzugte Wunschzeit',rowNumber,'Wunsch',wishZone));
  }
  if((blockFrom==null)!==(blockTo==null))issues.push({rowNumber,level:'error',text:'„Sperrzeit von“ und „Sperrzeit bis“ müssen immer gemeinsam ausgefüllt sein.'});
  if(blockFrom!=null&&blockTo!=null){if(blockTo<=blockFrom)issues.push({rowNumber,level:'error',text:'„Sperrzeit bis“ muss nach „Sperrzeit von“ liegen.'});else entries.push(entry(date,blockFrom,blockTo,'unavailable',remark||'Sperrzeit',rowNumber,'Sperrzeit','B'));}
  if(!hasTemplateFields&&legacyFrom!=null&&legacyTo!=null){if(legacyTo>legacyFrom)entries.push(entry(date,legacyFrom,legacyTo,'available',remark,rowNumber,'Von/Bis','B'));else issues.push({rowNumber,level:'error',text:'„Bis“ muss nach „Von“ liegen.'});}
  if(onlyIfNeeded&&canFrom==null&&canTo==null)issues.push({rowNumber,level:'warning',text:'„Nur wenn nötig“ ist markiert, aber es wurde keine „Kann“-Zeit eingetragen.'});
  return {entries,issues,rowNumber};
}
function normalizeRows(rows){
  const allEntries=[],issues=[];let processed=0;
  (rows||[]).forEach((row,i)=>{const out=expandRow(row,i);processed++;allEntries.push(...out.entries);issues.push(...out.issues)});
  return {entries:allEntries,issues,rowsProcessed:processed,valid:!issues.some(x=>x.level==='error')};
}
function normalizeMatrix(matrix){const converted=matrixToObjects(matrix);if(converted.headerIndex<0)return {entries:[],issues:[{rowNumber:0,level:'error',text:'Keine passende Überschriftenzeile gefunden.'}],rowsProcessed:0,valid:false,headerIndex:-1};return {...normalizeRows(converted.rows),headerIndex:converted.headerIndex};}
K.wishImport={parseDate,parseTime,parseDelimited,headerRowIndex,matrixToObjects,expandRow,normalizeRows,normalizeMatrix};
if(document.readyState==='loading')document.write('<script src="src/core/wish-zone.js?v=0.19.53-vhb-1"><\/script>');
})();
