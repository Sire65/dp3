(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{},esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateLabel=s=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(s+'T12:00:00'));
  const clone=x=>JSON.parse(JSON.stringify(x));
  function normalize(rows,date){let previous=-Infinity;return (rows||[]).map(r=>({...r})).sort((a,b)=>a.start-b.start).map(r=>{
    if(!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.end<=r.start||r.start<previous||!Number.isInteger(r.total)||r.total<0)throw Error('Ungültige Bedarfswerte am '+date+'. Bitte zuerst prüfen.');
    for(const field of ['front','back'])if(r[field]!=null&&(!Number.isInteger(r[field])||r[field]<0))throw Error('Ungültige Bereichszahl am '+date+'.');
    if(r.front!=null&&r.back!=null&&r.front+r.back!==r.total)throw Error('V + H stimmt am '+date+' nicht mit dem Gesamtbedarf überein.');
    previous=r.end;return {start:r.start,end:r.end,total:r.total,front:r.front??null,back:r.back??null};
  });}
  function hourly(rows){const result=[];for(const row of rows){let start=row.start;while(start<row.end){const end=Math.min(row.end,Math.floor(start+1e-8)+1);result.push({...row,start,end});start=end;}}return result;}
  function totals(rows){if(!rows.length)return {total:null,front:null,back:null};return Object.fromEntries(['total','front','back'].map(k=>[k,rows.some(r=>r[k]==null)?null:Math.round(rows.reduce((sum,r)=>sum+(r.end-r.start)*r[k],0)*100)/100]));}
  function pack(days,columns,daily){const pages=[{blocks:[]}],width=(774-(columns-1)*12)/columns;let column=0,y=510;
    function advance(){column++;y=510;if(column===columns){column=0;pages.push({blocks:[]});}}
    for(let di=0;di<days.length;di++){
      if(daily&&di){pages.push({blocks:[]});column=0;y=510;}
      const day=days[di],all=day.rows.length?day.rows:[null];let offset=0,part=0;
      const fullHeight=72+all.length*(daily?22:17);if(fullHeight<=426&&fullHeight>y-84)advance();
      while(offset<all.length){const rowHeight=daily?22:17,space=y-84;
        if(space<72+rowHeight){advance();continue;}
        const count=Math.min(all.length-offset,Math.floor((space-72)/rowHeight)),rows=all.slice(offset,offset+count),last=offset+count===all.length;
        pages.at(-1).blocks.push({date:day.date,label:dateLabel(day.date),kind:day.kind,rows,totals:day.totals,last,continuation:part>0,x:34+column*(width+12),y,width,rowHeight,font:daily?11:10});
        y-=50+rows.length*rowHeight+(last?22:0)+10;offset+=count;part++;if(!last)advance();
      }
    }
    return pages;
  }
  function documentFor({days,data,layout='overview',version=null,at=new Date().toISOString()}){
    if(!days?.length)throw Error('Bitte mindestens einen Tag auswählen.');
    const selected=[...days].sort((a,b)=>a.date.localeCompare(b.date)).map(d=>{const raw=normalize(data.demandMatrix?.[d.date],d.date);return {date:d.date,kind:d.type==='prep'?'Aufbau':d.type==='after'?'Nachbereitung':'Markttag',rows:hourly(raw),totals:totals(raw)};});
    let pages=pack(selected,layout==='daily'?1:3,layout==='daily');
    const sum=Object.fromEntries(['total','front','back'].map(k=>[k,selected.some(d=>d.totals[k]==null)?null:Math.round(selected.reduce((n,d)=>n+d.totals[k],0)*100)/100]));
    const meta={title:layout==='daily'?'Bedarfsmatrix · Tagesblätter':'Bedarfsmatrix · Gesamtübersicht',event:data.eventConfig?.name||'Weihnachtsmarkt 2026',from:selected[0].date,to:selected.at(-1).date,at,version,grand:sum,days:selected.length};
    return {html:pages.map((page,i)=>'<section class="doc-page demand-overview-pdf-page"><div class="demand-print-model">'+esc(JSON.stringify({...meta,...page,showGrand:i===pages.length-1}))+'</div></section>').join(''),title:meta.title,fileName:'KC_DP2_Bedarf_'+(layout==='daily'?'Tagesblaetter_':'Uebersicht_')+meta.from+'_'+meta.to+'.pdf',pageCount:pages.length};
  }
  async function snapshot(){
    if(K.cloudPrimary?.enabled?.()){if(!K.cloudPrimary.confirmedSnapshot)throw Error('Zentraler Druckbaustein fehlt. Bitte DP2 aktualisieren.');return K.cloudPrimary.confirmedSnapshot();}
    return {data:clone({demandMatrix:K.demandMatrix||{},eventConfig:K.eventConfig||{}}),version:null};
  }
  function open({currentDate,isEditing=false}={}){
    if(isEditing){alert('Bitte die Bedarfsänderungen zuerst speichern oder abbrechen.');return;}
    document.getElementById('demandPdfDialog')?.remove();const overlay=document.createElement('div');overlay.id='demandPdfDialog';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Bedarfsmatrix als PDF');overlay.style.cssText='position:fixed;inset:0;z-index:200000;background:#0008;display:grid;place-items:center;padding:12px';
    overlay.innerHTML='<section style="width:min(620px,100%);box-sizing:border-box;max-height:92vh;overflow:auto;background:#fff;border-radius:16px;padding:24px;color:#272320"><h2>Bedarfsmatrix als PDF</h2><label style="display:block;margin:14px 0">Darstellung<select id="demandPdfLayout" style="display:block;width:100%;min-height:48px"><option value="overview">Stundenübersicht · alle Zeitbereiche · A4 quer</option><option value="daily">Tagesblätter · jeder Tag auf neuem Blatt</option></select></label><label style="display:block;margin:14px 0">Tage auswählen<select id="demandPdfScope" style="display:block;width:100%;min-height:48px"><option value="all">Alle Tage</option><option value="current">Aktueller Tag</option><option value="selected">Bestimmte Tage</option></select></label><fieldset id="demandPdfDays" hidden><legend>Gewünschte Tage antippen</legend>'+ (K.days||[]).map(d=>'<label style="display:flex;gap:10px;align-items:center;min-height:44px"><input type="checkbox" data-pdf-date="'+esc(d.date)+'" style="width:22px;height:22px" '+(d.date===currentDate?'checked':'')+'>'+esc(dateLabel(d.date))+'</label>').join('')+'</fieldset><p>Jeder Stundenbereich wird einzeln mit Bedarf, V und H aufgeführt. Der ganze Planungstag bleibt sichtbar; bei Bedarf entstehen weitere Seiten. Personalstunden stehen je Tag und als Gesamtsumme darunter. Es werden keine Planungsdaten geändert.</p><p id="demandPdfResult" role="status"></p><div style="display:flex;gap:12px;flex-wrap:wrap"><button type="button" id="demandPdfClose" style="min-height:48px;padding:12px">Schließen</button><button type="button" id="demandPdfCreate" style="min-height:48px;padding:12px;background:#741521;color:white">PDF erstellen</button></div></section>';
    document.body.append(overlay);const q=id=>overlay.querySelector('#'+id),previous=document.activeElement;
    function close(){overlay.remove();document.removeEventListener('keydown',key);previous?.focus?.();}
    function key(e){if(e.key==='Escape')close();if(e.key==='Tab'){const items=[...overlay.querySelectorAll('button,select,input')].filter(x=>!x.disabled&&x.getClientRects().length);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}}}
    document.addEventListener('keydown',key);q('demandPdfClose').onclick=close;
    const chosen=()=>q('demandPdfScope').value==='all'?K.days:q('demandPdfScope').value==='current'?K.days.filter(d=>d.date===currentDate):K.days.filter(d=>overlay.querySelector('[data-pdf-date="'+d.date+'"]')?.checked);
    function update(){q('demandPdfDays').hidden=q('demandPdfScope').value!=='selected';q('demandPdfCreate').disabled=!chosen().length;q('demandPdfResult').textContent=chosen().length+' Tag(e) ausgewählt.';}
    q('demandPdfScope').onchange=update;overlay.querySelectorAll('input').forEach(x=>x.onchange=update);update();q('demandPdfLayout').focus();
    q('demandPdfCreate').onclick=async()=>{const button=q('demandPdfCreate'),selected=chosen(),layout=q('demandPdfLayout').value;button.disabled=true;q('demandPdfResult').textContent='Gespeicherten Bedarf laden und PDF erstellen …';try{const saved=await snapshot(),doc=documentFor({days:selected,data:saved.data,version:saved.version,layout});await K.pdfAdapter.download(doc);q('demandPdfResult').textContent='PDF erstellt: '+selected.length+' Tage auf '+doc.pageCount+' Seite(n).';}catch(e){q('demandPdfResult').textContent='PDF nicht erstellt: '+e.message;}finally{button.disabled=!chosen().length;}};
  }
  K.demandPrint={open,documentFor,hourly,totals};
})();
