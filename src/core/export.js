(function(){
  const K=window.KCDP=window.KCDP||{};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtDate=iso=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso+'T12:00:00'));
  const fmtTime=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h%1)*60)).padStart(2,'0')}`;
  const h=v=>Number(v||0).toFixed(2).replace('.',',');
  const breakMinutes=s=>{const seg=Array.isArray(s?.breakSegments)?s.breakSegments.filter(b=>Number(b.end)>Number(b.start)):[];return seg.length?Math.round(seg.reduce((n,b)=>n+(Number(b.end)-Number(b.start))*60,0)):Math.max(0,Number(s?.breakMinutes||0));};
  const countedWith=(s,cfg)=>{const gross=Math.max(0,Number(s.end)-Number(s.start));return cfg?.hoursAccounting==='deducted'?Math.max(0,gross-breakMinutes(s)/60):gross;};
  const visibleBreakConfig=()=>{const canDraft=K.auth?.has?.('roster.plan.view_draft')||K.auth?.has?.('*');return canDraft?(K.breakConfig||{}):(K.latestPublishedVersion?.()?.breakConfig||{});};
  const counted=s=>countedWith(s,visibleBreakConfig());
  const has=p=>!!(K.auth?.has?.(p)||K.auth?.has?.('*'));
  function requirePersonal(personId){if(personId===K.currentUser?.personId&&(has('roster.export.personal')||has('roster.documents.personal')))return true;if(has('roster.export.all')||has('roster.documents.generate'))return true;throw new Error('Sie dürfen nur Ihre eigenen persönlichen Daten exportieren.');}
  function requireAll(){if(!has('roster.export.all'))throw new Error('Keine Berechtigung für Gesamtexporte.');}
  function planLabel(){const latest=K.latestPublishedVersion?.();const canDraft=K.auth?.has?.('roster.plan.view_draft')||K.auth?.has?.('*');if(!canDraft)return latest?`Veröffentlicht · V${latest.version}`:'Kein veröffentlichter Sollplan';return K.workflowLabel?.()||'Entwurfsstand';}
  function csvCell(v){const s=String(v??'');return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function download(name,text,type='text/plain;charset=utf-8'){
    const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function personalCsv(personId,start,end){
    requirePersonal(personId);const p=K.person(personId);if(!p)throw new Error('Person nicht gefunden.');
    const rows=[['Datum','Von','Bis','Bereich','Zone','Pause Min.','Stunden','Status']];
    (K.visiblePlannedShifts?K.visiblePlannedShifts():K.shifts.filter(s=>s.layer==='planned')).filter(s=>s.personId===personId&&s.date>=start&&s.date<=end).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start).forEach(s=>rows.push([s.date,fmtTime(s.start),fmtTime(s.end),s.area,s.zone,s.breakMinutes||0,h(counted(s)),s.status||'']));
    return rows.map(r=>r.map(csvCell).join(';')).join('\n');
  }
  function analyticsCsv(start,end){
    requireAll();const f=K.analytics.fairness(start,end),rows=[['Person','Typ','Sollstunden','Iststunden','Differenz','Vorne','Hinten','Z','Bereitschaft','Dienste','Wochenende','Abend','Wunscherfüllung %','Fairness %']];
    f.rows.concat(K.people.filter(p=>p.active&&p.personType==='helper').map(p=>K.analytics.personStats(p.personId,start,end))).forEach(r=>rows.push([r.name,r.personType,h(r.plannedHours),h(r.actualHours),h(r.differenceHours),h(r.frontHours),h(r.backHours),h(r.specialHours),h(r.standbyHours),r.shifts,r.weekendShifts,r.eveningShifts,r.wishScore,r.fairnessScore??'Aushilfe']));
    return rows.map(r=>r.map(csvCell).join(';')).join('\n');
  }
  function printStyles(){return `<style>body{font-family:Arial,sans-serif;color:#111;margin:20mm 14mm}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px}.meta{font-size:11px;color:#555;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:10.5px}th,td{border:1px solid #aaa;padding:5px;text-align:left}th{background:#eee}.num{text-align:right}.badge{display:inline-block;border:1px solid #999;border-radius:10px;padding:1px 5px}.page-break{break-before:page}.foot{margin-top:14px;font-size:9px;color:#666}@media print{@page{size:A4 landscape;margin:12mm}body{margin:0}.no-print{display:none}}</style>`;}
  function personalHtml(personId,start,end){
    requirePersonal(personId);const p=K.person(personId),stats=K.analytics.personStats(personId,start,end),latest=K.latestPublishedVersion?.();
    const shifts=(K.visiblePlannedShifts?K.visiblePlannedShifts():K.shifts.filter(s=>s.layer==='planned')).filter(s=>s.personId===personId&&s.date>=start&&s.date<=end).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
    return `${printStyles()}<h1>KC DP – Persönlicher Dienstplan</h1><div class="meta">${esc(p.name)} · ${esc(start)} bis ${esc(end)} · ${esc(planLabel())} · erzeugt ${new Date().toLocaleString('de-DE')}</div><table><thead><tr><th>Datum</th><th>Von</th><th>Bis</th><th>Bereich</th><th>Zone</th><th>Pause</th><th>Std.</th></tr></thead><tbody>${shifts.map(s=>`<tr><td>${esc(fmtDate(s.date))}</td><td>${fmtTime(s.start)}</td><td>${fmtTime(s.end)}</td><td>${esc(s.area)}</td><td>${esc(s.zone==='front'?'Vorne':s.zone==='back'?'Hinten':s.zone==='special'?'Z':'–')}</td><td>${s.breakMinutes||0} Min.</td><td class="num">${h(counted(s))}</td></tr>`).join('')||'<tr><td colspan="7">Keine Dienste</td></tr>'}</tbody></table><h2>Summen</h2><table><tr><th>Sollstunden</th><th>Vorne</th><th>Hinten</th><th>Z</th><th>Bereitschaft</th><th>Wunscherfüllung</th></tr><tr><td>${h(stats.plannedHours)} h</td><td>${h(stats.frontHours)} h</td><td>${h(stats.backHours)} h</td><td>${h(stats.specialHours)} h</td><td>${h(stats.standbyHours)} h</td><td>${stats.wishScore} %</td></tr></table><div class="foot">KC DP · Person-ID ${esc(personId)}. Bereitschaft ist separat ausgewiesen und nicht Teil der Standbesetzung.</div>`;
  }
  function dayHtml(date){
    requireAll();const d=K.days.find(x=>x.date===date);if(!d)throw new Error('Tag nicht gefunden.');const e=K.evaluateDay(d),latest=K.latestPublishedVersion?.();
    const shifts=(K.visiblePlannedShifts?K.visiblePlannedShifts(date):K.shifts.filter(s=>s.layer==='planned'&&s.date===date)).sort((a,b)=>a.start-b.start||K.person(a.personId)?.name.localeCompare(K.person(b.personId)?.name));
    return `${printStyles()}<h1>KC DP – Tagesplan ${esc(fmtDate(date))}</h1><div class="meta">${d.type==='market'?`Weihnachtsmarkt · Öffnung ${fmtTime(d.open)} · Standbesetzung ab ${fmtTime(d.open-d.preOpenMinutes/60)}`:d.type==='prep'?'Vorbereitung':'Nachbereitung'} · ${esc(planLabel())} · Planqualität ${e.quality}%</div><table><thead><tr><th>Person</th><th>Von</th><th>Bis</th><th>Bereich</th><th>Zone</th><th>Pause</th><th>Std.</th></tr></thead><tbody>${shifts.map(s=>`<tr><td>${esc(K.person(s.personId)?.name||s.personId)}</td><td>${fmtTime(s.start)}</td><td>${fmtTime(s.end)}</td><td>${esc(s.area)}</td><td>${esc(s.zone==='front'?'V':s.zone==='back'?'H':s.zone==='special'?'Z':'–')}</td><td>${s.breakMinutes||0}</td><td>${h(counted(s))}</td></tr>`).join('')||'<tr><td colspan="7">Keine Dienste</td></tr>'}</tbody></table><h2>Besetzung</h2><table><tr><th>Planqualität</th><th>Kritische Intervalle</th><th>Unterbesetzung</th><th>Überbesetzung</th><th>Wunschkonflikte</th></tr><tr><td>${e.quality}%</td><td>${e.critical}</td><td>${e.under}</td><td>${e.over}</td><td>${e.wishViolations}</td></tr></table><div class="foot">Z-Sonderdienste und Bereitschaften werden nicht zur Standbesetzung gerechnet.</div>`;
  }
  function rangePlanHtml(start,end){
    requireAll();const latest=K.latestPublishedVersion?.(),days=K.days.filter(d=>d.date>=start&&d.date<=end);
    const sections=days.map(d=>{const shifts=(K.visiblePlannedShifts?K.visiblePlannedShifts(d.date):K.shifts.filter(s=>s.layer==='planned'&&s.date===d.date)).sort((a,b)=>a.start-b.start||String(K.person(a.personId)?.name||'').localeCompare(String(K.person(b.personId)?.name||''))),e=K.evaluateDay(d);return `<h2>${esc(fmtDate(d.date))} · ${d.type==='market'?`Weihnachtsmarkt · Öffnung ${fmtTime(d.open)}`:d.type==='prep'?'Vorbereitung':'Nachbereitung'} · Qualität ${e.quality}%</h2><table><thead><tr><th>Person</th><th>Von</th><th>Bis</th><th>Bereich</th><th>Zone</th><th>Std.</th></tr></thead><tbody>${shifts.map(x=>`<tr><td>${esc(K.person(x.personId)?.name||x.personId)}</td><td>${fmtTime(x.start)}</td><td>${fmtTime(x.end)}</td><td>${esc(x.area)}</td><td>${esc(x.zone==='front'?'V':x.zone==='back'?'H':x.zone==='special'?'Z':'–')}</td><td>${h(counted(x))}</td></tr>`).join('')||'<tr><td colspan="6">Keine Dienste</td></tr>'}</tbody></table>`}).join('');
    return `${printStyles()}<h1>KC DP – Dienstplan ${esc(start)} bis ${esc(end)}</h1><div class="meta">${esc(planLabel())} · erzeugt ${new Date().toLocaleString('de-DE')}</div>${sections}<div class="foot">Z-Sonderdienste und Bereitschaften zählen nicht zur aktiven Standbesetzung.</div>`;
  }
  function fairnessHtml(start,end){requireAll();
    const f=K.analytics.fairness(start,end),dash=K.analytics.dashboard({start,end,dates:K.days.filter(d=>d.date>=start&&d.date<=end).map(d=>d.date),label:`${start} – ${end}`});
    return `${printStyles()}<h1>KC DP – Auswertung & Fairness</h1><div class="meta">${esc(start)} bis ${esc(end)} · Planqualität ${dash.quality}% · Fairness ${f.overall}% · Durchschnitt ${h(f.averageHours)} h</div><table><thead><tr><th>Person</th><th>Soll h</th><th>V</th><th>H</th><th>Z</th><th>Bereitsch.</th><th>Dienste</th><th>WE</th><th>Abend</th><th>Wunsch %</th><th>Fairness %</th></tr></thead><tbody>${f.rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${h(r.plannedHours)}</td><td>${h(r.frontHours)}</td><td>${h(r.backHours)}</td><td>${h(r.specialHours)}</td><td>${h(r.standbyHours)}</td><td>${r.shifts}</td><td>${r.weekendShifts}</td><td>${r.eveningShifts}</td><td>${r.wishScore}</td><td>${r.fairnessScore}</td></tr>`).join('')}</tbody></table><div class="foot">Fairness ist eine Planungshilfe. Sie berücksichtigt Stundenabweichung, Wochenend-/Abenddienste und Wunscherfüllung; sie teilt niemanden automatisch ein.</div>`;
  }
  function printHtml(html,title='KC DP'){
    let root=document.getElementById('printRoot');if(!root){root=document.createElement('section');root.id='printRoot';root.className='print-root';document.body.appendChild(root);}root.innerHTML=html;root.dataset.title=title;document.body.classList.add('print-mode');
    const old=document.title;document.title=title;setTimeout(()=>{window.print();setTimeout(()=>{document.body.classList.remove('print-mode');document.title=old;root.innerHTML='';},250)},50);
  }
  K.exports={version:'0.11.3',download,personalCsv,analyticsCsv,personalHtml,dayHtml,rangePlanHtml,fairnessHtml,printHtml,
    downloadPersonalCsv(personId,start,end){const p=K.person(personId);download(`KC_DP_${(p?.name||personId).replace(/[^A-Za-z0-9_-]+/g,'_')}_${start}_${end}.csv`,personalCsv(personId,start,end),'text/csv;charset=utf-8');},
    downloadAnalyticsCsv(start,end){download(`KC_DP_Auswertung_${start}_${end}.csv`,analyticsCsv(start,end),'text/csv;charset=utf-8');}
  };
})();
