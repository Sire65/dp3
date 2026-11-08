// Build 307 · „Ist-Rückmeldungen der Mitglieder“ – Planer-Dialog (Register Ist → Menü).
// Abholen aus der Club App, Soll gegen gemeldetes Ist mit Abweichung und Grund, bestätigen oder mit Grund ablehnen.
// Regeln und Buchung liegen in src/core/ist-rueckmeldung.js. Gestaltung wie der Sonderstunden-Eingang (se-/hr-Klassen).
(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=iso=>{try{return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso+'T12:00:00'))}catch(_){return iso}};
  const core=()=>K.istRueckmeldung;
  const name=id=>K.person?.(id)?.name||id;
  const ERGEBNIS={passt:'„Ja, passt“',geaendert:'„Andere Zeiten“',nicht_da:'„Ich war nicht da“',korrektur:'„Buchung ist falsch“'};
  const STATUS={offen:'offen',automatisch:'automatisch übernommen',zu_bestaetigen:'wartet auf Bestätigung',bestaetigt:'vom Planer bestätigt',abgelehnt:'abgelehnt'};
  let view='zu_bestaetigen',busy=false;

  function close(){document.getElementById('irBackdrop')?.remove();}
  function status(t,bad=false){const el=document.getElementById('irStatusLine');if(el){el.textContent=t;el.classList.toggle('bad',!!bad);}}
  const canPull=()=>!!K.supabaseConnection?.istRueckmeldungen;
  const canReopen=()=>K.actualWorkflow?.status==='closed'&&(K.auth?.has?K.auth.has('roster.actual.reopen'):false);
  const sign=n=>`${n>0?'+':''}${n} Min.`;

  function rowHtml(r){
    const c=core(),st=c.stateOf(r),d=c.deltaMinutes(r),w=r.planerStatus==='zu_bestaetigen'?c.warnings(r.id):[],open=r.planerStatus==='zu_bestaetigen'&&c.canDecide();
    const ist=r.ergebnis==null?'keine Antwort':r.ergebnis==='nicht_da'?'nicht da':st.ist;
    return `<li class="hr-person" data-ir="${esc(r.id)}"><div><b>${esc(name(r.personId))}</b><small>${esc(fmtDate(r.date))}${r.bereich?' · '+esc(r.bereich):''}</small>`+
      `<small>Soll ${esc(st.soll)}${r.sollPause?` · Pause ${r.sollPause} Min.`:''} → Ist ${esc(ist)}${r.ergebnis&&r.ergebnis!=='passt'&&r.pauseMin!=null?` · Pause ${r.pauseMin} Min.`:''}</small>`+
      `${d&&r.ergebnis!=='passt'?`<small>Δ Beginn ${sign(d.start)} · Ende ${sign(d.end)} · Dauer ${sign(d.duration)}</small>`:''}`+
      `${r.ergebnis?`<small>Antwort: ${esc(ERGEBNIS[r.ergebnis]||r.ergebnis)}</small>`:''}${r.grund?`<small>Grund: ${esc(r.grund)}</small>`:''}${r.bemerkung?`<small>„${esc(r.bemerkung)}“</small>`:''}`+
      `${w.map(x=>`<small class="hr-warn hr-${x.level}">${x.level==='error'?'⛔':x.level==='warn'?'⚠':'ℹ'} ${esc(x.text)}</small>`).join('')}`+
      `${r.planerStatus==='abgelehnt'&&r.planerGrund?`<small>Ablehnungsgrund: ${esc(r.planerGrund)}</small>`:''}</div>`+
      (open?`<div class="se-row-actions"><button type="button" class="ux-btn" data-ir-ok="${esc(r.id)}">✓ Bestätigen</button><button type="button" class="ux-btn secondary" data-ir-no="${esc(r.id)}">Ablehnen</button></div>`:`<span class="se-badge">${esc(st.icon+' '+(r.ergebnis==null?'keine Antwort':st.code==='wartet'?STATUS.zu_bestaetigen:st.text))}</span>`)+`</li>`;
  }

  // Zusatz Hansi: Auswertung „Stimmung & Besetzung“ je Tag und Bereich.
  function stimmungHtml(){
    const rows=core().stimmung();if(!rows.length)return '<p class="se-empty">Noch keine Rückmeldungen zu Stimmung und Besetzung.</p>';
    return `<div class="ir-mood-wrap" style="overflow-x:auto"><table class="ir-mood" style="width:100%;border-collapse:collapse;font-size:.92em"><thead><tr><th style="text-align:left">Tag</th><th style="text-align:left">Bereich</th><th title="gut">😀</th><th title="geht so">🙂</th><th title="nicht gut">☹️</th><th>zu wenig</th><th>genau richtig</th><th>zu viele</th></tr></thead><tbody>${rows.map(g=>`<tr><td>${esc(fmtDate(g.date))}</td><td>${esc(g.bereich)}</td><td style="text-align:center">${g.gut}</td><td style="text-align:center">${g.geht}</td><td style="text-align:center">${g.schlecht}</td><td style="text-align:center${g.zuWenig>g.passt+g.zuViel?';font-weight:700;color:#9a1d2c':''}">${g.zuWenig}</td><td style="text-align:center">${g.passt}</td><td style="text-align:center${g.zuViel>g.passt+g.zuWenig?';font-weight:700':''}">${g.zuViel}</td></tr>`).join('')}</tbody></table></div><p class="se-intro">Freiwillige Angaben der Mitglieder nach dem Dienst. Nur Anzahlen, keine Namen.</p>`;
  }
  function render(){
    const body=document.getElementById('irBody');if(!body||!core())return;
    const n=core().counts(),list=view==='stimmung'?[]:core().list({filter:view});
    const tab=(id,label)=>`<button type="button" role="tab" class="ux-btn ${view===id?'':'secondary'}" data-ir-view="${id}" aria-selected="${view===id}">${label}</button>`;
    body.innerHTML=`<div class="hr-tabs" role="tablist">${tab('zu_bestaetigen',`Zu bestätigen (${n.zu_bestaetigen})`)}${tab('keine_antwort',`Keine Antwort (${n.keine_antwort})`)}${tab('erledigt','Erledigt')}${tab('alle',`Alle (${n.alle})`)}${tab('stimmung','Stimmung & Besetzung')}</div>`+
      `${K.actualWorkflow?.status==='closed'?`<p class="hr-closed">Der Istplan ist abgeschlossen. Bestätigte Rückmeldungen werden erst nach dem Wiederöffnen gebucht.${canReopen()?' <button type="button" class="ux-btn secondary" id="irReopen">Für Nachtrag öffnen</button>':''}</p>`:''}`+
      (view==='stimmung'?stimmungHtml():list.length?`<ul class="se-list"><li class="se-item hr-group"><ul class="hr-people">${list.map(rowHtml).join('')}</ul></li></ul>`:`<p class="se-empty">${view==='zu_bestaetigen'?'Keine Rückmeldung wartet auf Bestätigung.':view==='keine_antwort'?'Alle gefragten Mitglieder haben geantwortet.':'Keine Rückmeldungen.'}</p>`);
    body.querySelectorAll('[data-ir-view]').forEach(b=>b.onclick=()=>{view=b.dataset.irView;render();});
    body.querySelectorAll('[data-ir-ok]').forEach(b=>b.onclick=()=>run(()=>core().decide(b.dataset.irOk,{status:'bestaetigt'}),'Bestätigt – die Zeit steht jetzt im Kontoauszug.'));
    body.querySelectorAll('[data-ir-no]').forEach(b=>b.onclick=()=>{const r=(K.istRueckmeldungen||[]).find(x=>x.id===b.dataset.irNo);const reason=window.prompt(`Warum wird die Rückmeldung von ${name(r?.personId)} abgelehnt?`,'');if(reason==null)return;run(()=>core().decide(b.dataset.irNo,{status:'abgelehnt',reason}),'Abgelehnt.');});
    const reopen=document.getElementById('irReopen');if(reopen)reopen.onclick=()=>{const reason=window.prompt('Begründung für das Wiederöffnen (Nachtrag Ist-Rückmeldungen):','Nachtrag Ist-Rückmeldungen');if(!reason)return;try{K.actual.reopenPlan({reason});const out=core().apply();render();status(`Istplan geöffnet · ${out.angelegt+out.aktualisiert} Zeiten gebucht. Danach wieder abschließen.`);K.persistAll?.().catch?.(()=>{});}catch(e){status(e.message||String(e),true);}};
  }
  async function run(job,ok){if(busy)return;busy=true;status('Wird gespeichert …');try{await job();status(ok);}catch(e){status(e.message||String(e),true);}finally{busy=false;render();K.render?.();}}
  async function pull(){if(busy)return;busy=true;status('Rückmeldungen werden abgeholt …');try{const r=await core().pull();const a=r.applied||{};status(`${r.received} Rückmeldungen abgeholt${a.angelegt||a.aktualisiert?` · ${a.angelegt+a.aktualisiert} als Ist gebucht`:''}${a.blocked?' · Istplan abgeschlossen, nichts gebucht':''}.`);}catch(e){status('Nicht abgeholt: '+(e.message||e),true);}finally{busy=false;render();K.render?.();}}

  function open({fetch=true}={}){
    if(!core())return;close();
    const back=document.createElement('div');back.id='irBackdrop';back.className='se-backdrop';
    back.innerHTML=`<section class="se-panel" role="dialog" aria-modal="true" aria-labelledby="irTitle"><header class="se-head"><h2 id="irTitle">✓ Ist-Rückmeldungen der Mitglieder</h2><button type="button" class="se-close" id="irClose" aria-label="Schließen">×</button></header><p class="se-intro">Nach jedem Dienst fragt die Club App: „Als Ist übernehmen?“ „Passt“ und kleine Abweichungen zählen sofort. Ab 15 Minuten Abweichung, „nicht da“ und Buchungskorrekturen bestätigen Sie hier. Kasse und Stempeluhr haben immer Vorrang.</p><div id="irBody" class="se-body"></div><footer class="se-foot"><span id="irStatusLine" class="se-status" role="status" aria-live="polite"></span>${canPull()?'<button type="button" class="ux-btn secondary" id="irPull">⇩ Rückmeldungen abholen</button>':''}</footer></section>`;
    document.body.appendChild(back);
    back.addEventListener('click',e=>{if(e.target===back)close();});back.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    document.getElementById('irClose').onclick=close;const p=document.getElementById('irPull');if(p)p.onclick=pull;
    render();document.getElementById('irClose').focus();
    if(fetch&&canPull())pull();
  }
  K.istRueckmeldungUi={version:'0.1.0',open,close};
})();
