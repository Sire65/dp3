(function(){
'use strict';
const K=window.KCDP,$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tm=h=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round(h%1*60)).padStart(2,'0')}`;
const dt=d=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'numeric',month:'long'}).format(new Date(d+'T12:00:00'));
const self=()=>K.currentUser?.personId,active=x=>!['deleted','cancelled','absent','failed'].includes(x.status);
let owner=null,mode=null,voice=false,lastKey='',spoken='',speechId=0,clip=null;
const audioKeys=new Set(['welcome','tasks','days','availability','can','wish','blocks','standby','zone','offdays','review','done','finish','planfalse','plantrue','actual']);
function stop(){speechId++;if(clip){clip.pause();clip=null;}window.speechSynthesis?.cancel();document.querySelectorAll('.tw-wave').forEach(x=>x.classList.remove('speaking'));}
function speak(){
 stop();if(!voice||!spoken)return;const token=speechId;
 const end=()=>{if(token===speechId)document.querySelectorAll('.tw-wave').forEach(x=>x.classList.remove('speaking'))};
 const begin=()=>{if(token===speechId)document.querySelectorAll('.tw-wave').forEach(x=>x.classList.add('speaking'))};
 const device=()=>{
  if(token!==speechId)return;
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){const status=$('twVoiceStatus');if(status)status.textContent='Vorlesen ist gerade nicht verfügbar. Du kannst alles mitlesen.';return;}
  const u=new SpeechSynthesisUtterance(spoken);u.lang='de-DE';u.rate=.94;
  const german=speechSynthesis.getVoices().filter(v=>/^de(?:-|_)/i.test(v.lang));u.voice=german.find(v=>/Katja/i.test(v.name))||german.find(v=>v.localService)||german[0]||null;
  u.onstart=begin;u.onend=end;u.onerror=end;speechSynthesis.speak(u);
 };
 const key=lastKey.startsWith('wish-')?lastKey.split('-').at(-1):lastKey;
 if(audioKeys.has(key)&&!K.twinkeyUseDeviceVoice){
  const player=clip=new Audio(new URL('assets/twinkey/audio/'+key+'.wav',document.baseURI).href);player.onplaying=begin;player.onended=end;let failed=false;
  const fallback=()=>{if(failed||token!==speechId)return;failed=true;end();device()};player.onerror=fallback;player.play().catch(fallback);
 }else device();
}
function voiceLabel(){return '<span aria-hidden="true" class="tw-speaker">'+(voice?'🔊':'🔇')+'</span><span>'+(voice?'Ton an':'Ton aus')+'</span>';}
function controls(){return `<div class="tw-audio"><button type="button" id="twVoice" aria-pressed="${voice}" aria-label="${voice?'Ton ausschalten':'Ton einschalten'}" title="${voice?'Ton ausschalten':'Ton einschalten'}">${voiceLabel()}</button><button type="button" id="twRepeat" aria-label="Noch einmal vorlesen" ${voice?'':'hidden'}>Wiederholen</button><button type="button" id="twStop" ${voice?'':'hidden'}>Stopp</button><span class="tw-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><small id="twVoiceStatus" role="status"></small></div>`;}
function bind(text,key){
 spoken=text;const changed=key!==lastKey;lastKey=key;
 const toggle=$('twVoice');if(!toggle)return;
 if(K.twinkeyUseDeviceVoice&&(!window.speechSynthesis||!window.SpeechSynthesisUtterance)){toggle.disabled=true;toggle.textContent='Vorlesen auf diesem Gerät nicht verfügbar';return;}
 toggle.onclick=()=>{voice=!voice;toggle.innerHTML=voiceLabel();toggle.setAttribute('aria-label',voice?'Ton ausschalten':'Ton einschalten');toggle.title=voice?'Ton ausschalten':'Ton einschalten';toggle.setAttribute('aria-pressed',String(voice));$('twRepeat').hidden=$('twStop').hidden=!voice;if(voice)speak();else stop()};
 $('twRepeat').onclick=speak;$('twStop').onclick=stop;if(voice&&changed)speak();
}
function reset(){stop();owner=null;mode=null;voice=false;lastKey='';spoken='';}
function available(){return !!self()&&K.currentUser.role==='employee';}
function shell(question,html,key){
 K.roleUx.matrixShell(`<div class="wa-root tw-root">${K.chefCompanion.helper(question)}<section class="wa-question">${html}</section></div>`,'home');
 K.chefCompanion.wireQuiet();bind(question,key);const title=document.querySelector('.tw-root h1');if(title){title.tabIndex=-1;title.focus({preventScroll:true})}window.scrollTo({top:0,behavior:'instant'});
}
function home(){if(!available())return false;if(owner!==self()){reset();owner=self()}if(mode===null)welcome();else if(mode==='guided')tasks();else return false;return true;}
function welcome(){
 const name=(K.person(self())?.name||K.currentUser.displayName||'').trim().split(/\s+/)[0];
 shell(`Hallo ${name}, ich bin Twinkey, dein persönlicher Assistent für das Dienstplanprogramm DP2. Wie möchtest du starten?`,
 `<span class="wa-eyebrow">WILLKOMMEN</span><h1>Mit Begleitung oder direkt loslegen?</h1><div class="wa-choices"><button class="wa-choice" data-tw-mode="guided" aria-pressed="false"><b>Mit Twinkey</b><span>Eine Frage nach der anderen.</span></button><button class="wa-choice" data-tw-mode="plain" aria-pressed="false"><b>Ohne Assistent</b><span>Direkt zur gewohnten Übersicht.</span></button></div><div class="wa-actions"><button class="ux-btn primary tw-next" id="twNext" disabled>Weiter →</button></div>`,'welcome');
 document.querySelector('.ux-bottomnav')?.setAttribute('hidden','');
 let selected=null;document.querySelectorAll('[data-tw-mode]').forEach(b=>b.onclick=()=>{selected=b.dataset.twMode;document.querySelectorAll('[data-tw-mode]').forEach(x=>{x.classList.toggle('chosen',x===b);x.setAttribute('aria-pressed',String(x===b))});$('twNext').disabled=false;$('twNext').click()});
 // Build 257: „Überspringen“ war doppelt zu „Ohne Assistent“; dessen Wirkung (Ton aus) übernimmt jetzt „Ohne Assistent“.
 $('twNext').onclick=()=>{if(!selected)return;mode=selected;if(mode==='guided')tasks();else{voice=false;stop();K.roleUx.employeeHome();}};
}
function tasks(){
 const name=(K.person(self())?.name||K.currentUser.displayName||'').trim().split(/\s+/)[0]||'';
 const greeting=`Hallo ${name}, schön, dass du da bist. Gemeinsam bringen wir deine Zeiten schnell und einfach in den Dienstplan. Wie möchtest du anfangen?`;
 shell(greeting,`<h1>Wie möchtest du anfangen?</h1><div class="wa-choices">${[['wish','Meinen Wunschplan eintragen oder ändern','Kann, Wunsch, Sperren und Bereitschaft'],['plan','Meinen Dienstplan ansehen','Meine freigegebenen Dienste'],['change','Einen Dienst ändern lassen','Ersatz oder Tausch anfragen'],['actual','Meine erfassten Zeiten ansehen','Kommen, Gehen und Stunden'],...(K.specialEventSignupsCore?[['signup','Bei einem Sondereinsatz helfen','Zusagen, Anreise und Fahrgemeinschaft']]:[]),...(K.hourReportsCore?[['hours','Sonderstunden melden','Arbeit außerhalb des Stands: Kochen, Fahrten, zuhause']]:[]),['documents','Meine Unterlagen','Kontoauszug, Papiermatrix, Excel und Handschriftprobe']].map(([id,title,sub])=>`<button class="wa-choice" data-tw-task="${id}" aria-pressed="false"><b>${title}</b><span>${sub}</span></button>`).join('')}</div><div class="wa-actions"><button class="ux-btn secondary" id="twBack">← Zurück</button><button class="ux-btn primary tw-next" id="twNext" disabled>Weiter →</button></div>`,'tasks');
 let selected=null;document.querySelectorAll('[data-tw-task]').forEach(b=>b.onclick=()=>{selected=b.dataset.twTask;document.querySelectorAll('[data-tw-task]').forEach(x=>{x.classList.toggle('chosen',x===b);x.setAttribute('aria-pressed',String(x===b))});$('twNext').disabled=false;$('twNext').click()});
 $('twBack').onclick=welcome;$('twNext').onclick=()=>{if(selected==='wish')entryMethods();else if(selected==='plan')plan();else if(selected==='change')plan(true);else if(selected==='actual')actual();else if(selected==='hours')hoursStart();else if(selected==='signup')signupStart();else if(selected==='documents')documents()};
}

function documents(){
 const forms=K.personalizedForms,sprint=K.wishSprint,account=K.personAccountPrint;
 shell('Welche persönliche Unterlage möchtest du ansehen oder ausdrucken?',`<h1>Meine Unterlagen</h1><div class="sw-grid"><button class="wa-choice" id="twDocAccount"><b>Persönlichen Kontoauszug</b><span>Wunsch, Soll, Ist und Stechuhrzeiten</span></button><button class="wa-choice" id="twDocMatrix"><b>Papiermatrix</b><span>Kann, Wunsch, Sperren und Bereitschaft</span></button><button class="wa-choice" id="twDocExcel"><b>Excel-Matrix</b><span>Persönliche Excel-Vorlage</span></button><button class="wa-choice" id="twDocWriting"><b>Handschriftprobe</b><span>Vorlage für die Handschrifterkennung</span></button></div><p>Alle Unterlagen werden direkt aus DP2 erzeugt und enthalten deine persönliche QR-Zuordnung.</p><p id="twDocStatus" role="status"></p><div class="wa-actions">${back()}</div>`,'documents');wireBack();
 const run=async(button,job,done)=>{button.disabled=true;try{await job();$('twDocStatus').textContent=done}catch(e){$('twDocStatus').textContent=e.message||String(e)}finally{button.disabled=false}};
 $('twDocAccount').onclick=()=>{if(!account?.open)return void($('twDocStatus').textContent='Der persönliche Kontoauszug ist noch nicht geladen. Bitte DP2 neu laden.');account.open({personId:self()})};
 $('twDocMatrix').onclick=()=>run($('twDocMatrix'),()=>forms.downloadPdf('matrix',self()),'Die persönliche Papiermatrix wurde geöffnet beziehungsweise heruntergeladen.');
 $('twDocExcel').onclick=()=>run($('twDocExcel'),()=>sprint?.personalizedTemplate?sprint.personalizedTemplate():forms.downloadExcel(self()),'Die persönliche Excel-Matrix wurde heruntergeladen.');
 $('twDocWriting').onclick=()=>run($('twDocWriting'),()=>forms.downloadPdf('handwriting',self()),'Die persönliche Handschriftprobe wurde geöffnet beziehungsweise heruntergeladen.');
}
function entryMethods(){K.chefCompanion.sharingSettings(entryMethodChoices,tasks);}
function entryMethodChoices(){
 K.guidedImportContext=null;
 shell('Wie möchtest du deine Zeiten eintragen? Wähle einen Weg.','<h1>Wie möchtest du deine Zeiten eintragen?</h1><div class="sw-grid">'+[['manual','Selbst eingeben'],['colleague','Von Kollegen übernehmen'],['excel','Excel-Datei einlesen'],['photo','Plan fotografieren'],['overview','Grafische Übersicht der bisherigen Zeiten']].map(([id,label])=>'<button class="wa-choice" data-tw-entry="'+id+'">'+label+'</button>').join('')+'</div><button class="ux-btn secondary" id="twEntryBack">← Zurück</button>','entry');
 $('twEntryBack').onclick=tasks;
 document.querySelectorAll('[data-tw-entry]').forEach(b=>b.onclick=()=>{const kind=b.dataset.twEntry;if(kind==='manual')K.wishAssistant.start();else if(kind==='overview')K.simpleWishAssistant.openTeamOverview();else if(kind==='colleague')K.mobileMatrixUi.search(entryMethodChoices);else importQuestion(kind);});
}
function importQuestion(kind){
 K.guidedImportContext=null;
 const excel=kind==='excel',question=excel?'Hast du deine Excel-Vorlagendatei schon ausgefüllt?':'Hast du deinen ausgefüllten Plan schon bereit?';
 const writingHelp=excel?'':'<aside class="ux-note"><b>Deine Handschrift besser erkennen</b><p>Zur besseren Erkennung ist es ratsam, einige Schriftproben von dir zu bekommen. Du kannst die Vorlage ausdrucken, ausfüllen und deinem IT-Kollegen zukommen lassen. Damit kann die Erkennung auf deine Schrift trainiert werden.</p><button class="ux-btn secondary" id="twWritingSample">Schriftproben herunterladen</button></aside>';
 shell(question,'<h1>'+question+'</h1><div class="sw-grid"><button class="wa-choice" id="twImportReady">Ja, '+(excel?'Datei einlesen':'Foto aufnehmen oder auswählen')+'</button><button class="wa-choice" id="twImportTemplate">Nein, persönliche Vorlage herunterladen</button></div>'+writingHelp+'<p id="twImportInfo" role="status"></p><button class="ux-btn secondary" id="twMethodBack">← Zurück</button>','import-'+kind);
 $('twMethodBack').onclick=entryMethodChoices;
 const download=async type=>{const forms=K.personalizedForms,sprint=K.wishSprint;if(type==='excel'&&sprint?.personalizedTemplate)return sprint.personalizedTemplate();if(type==='excel'&&forms?.downloadExcel)return forms.downloadExcel(self());if(type==='writing'&&forms?.downloadPdf)return forms.downloadPdf('handwriting',self());if(forms?.downloadPdf)return forms.downloadPdf('matrix',self());throw Error('Die persönliche Vorlage ist noch nicht geladen. Bitte DP2 neu laden und erneut versuchen.');};
 $('twImportTemplate').onclick=async()=>{const button=$('twImportTemplate');button.disabled=true;try{await download(excel?'excel':'matrix');$('twImportInfo').textContent='Fülle die Vorlage in Ruhe aus. Danach kannst du sie hier einlesen – oder später über diesen Weg zurückkommen.';}catch(e){$('twImportInfo').textContent=e.message;}finally{button.disabled=false;}};
 if($('twWritingSample'))$('twWritingSample').onclick=async()=>{try{await download('writing');$('twImportInfo').textContent='Die Schriftproben wurden zum Ausdrucken heruntergeladen.';}catch(e){$('twImportInfo').textContent=e.message;}};
 $('twImportReady').onclick=()=>{K.guidedImportContext={kind,back:()=>importQuestion(kind)};if(excel)K.roleUx.guidedExcel();else photoChoice();};
}
function photoChoice(){
 shell('Fotografiere den ganzen Plan gut lesbar oder wähle ein vorhandenes Bild.','<h1>Plan einlesen</h1><div class="sw-grid"><button class="wa-choice" id="twCamera">Kamera öffnen (Handy / Tablet)</button><button class="wa-choice" id="twImage">Bilddatei auswählen</button></div><p>Unklare Angaben prüfst und korrigierst du vor dem Speichern.</p><button class="ux-btn secondary" id="twPhotoBack">← Zurück</button>','photo-source');
 $('twPhotoBack').onclick=()=>importQuestion('photo');
 $('twCamera').onclick=()=>K.roleUx.guidedPhoto(true);
 $('twImage').onclick=()=>K.roleUx.guidedPhoto(false);
}
function back(){return '<button class="ux-btn secondary" id="twTasks">← Etwas anderes machen</button>'}
function wireBack(){if($('twTasks'))$('twTasks').onclick=tasks;}
function published(){const version=K.latestPublishedVersion?.();return version?(version.shifts||[]).filter(x=>x.personId===self()&&active(x)).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start):[];}
function plan(change=false){
 const rows=published(),canRequest=K.auth.has('roster.swap.request');
 shell(change?'Welchen Dienst möchtest du ändern lassen? Deine Einteilung bleibt bestehen, bis der Planer eine Änderung bestätigt.':'Hier siehst du deine freigegebenen Dienste.',`<h1>${change?'Dienst auswählen':'Mein Dienstplan'}</h1>${rows.map(s=>{const pending=(K.swapRequests||[]).find(r=>r.shiftId===s.id&&r.requestedBy===self()&&r.status==='open');return `<article class="tw-row"><b>${dt(s.date)} · ${tm(s.start)}–${tm(s.end)} Uhr</b><p>${esc(s.area||'Dienst')}</p>${change?(pending?'<p>Änderungsanfrage bereits offen.</p>':`<button class="ux-btn secondary" data-tw-shift="${esc(s.id)}" ${canRequest?'':'disabled'}>Diesen Dienst auswählen</button>`):''}</article>`}).join('')||'<p>Für dich sind noch keine Dienste freigegeben.</p>'}<div class="wa-actions">${back()}</div>`,'plan'+change);wireBack();document.querySelectorAll('[data-tw-shift]').forEach(b=>b.onclick=()=>request(b.dataset.twShift));
}
function request(shiftId){
 const s=published().find(x=>x.id===shiftId);if(!s)return plan(true);
 shell('Was soll sich ändern? Wähle einen Grund. Der Planer prüft deine Anfrage.',`<h1>Änderung für ${dt(s.date)}</h1><p>${tm(s.start)}–${tm(s.end)} Uhr · ${esc(s.area||'Dienst')}</p><div class="wa-choices">${['Ich kann diesen Dienst nicht übernehmen.','Ich möchte den Dienst tauschen.','Ich benötige andere Uhrzeiten.'].map((text,i)=>`<button class="wa-choice" data-tw-reason="${i}" aria-pressed="false">${text}</button>`).join('')}</div><details><summary>Etwas ergänzen (freiwillig)</summary><label>Deine Ergänzung<textarea id="twNote" maxlength="500" rows="2"></textarea></label></details><p>Die Anfrage ändert deinen Dienst noch nicht.</p><div id="twRequestStatus" role="status"></div><div class="wa-actions"><button class="ux-btn secondary" id="twBack">← Zurück</button><button class="ux-btn primary tw-next" id="twRequest" disabled>Anfrage speichern</button></div>`,'request'+shiftId);
 let reason='',created=false,saving=false;const requestOwner=self(),fingerprint=JSON.stringify(s);document.querySelectorAll('[data-tw-reason]').forEach(b=>b.onclick=()=>{reason=b.textContent;document.querySelectorAll('[data-tw-reason]').forEach(x=>{x.classList.toggle('chosen',x===b);x.setAttribute('aria-pressed',String(x===b))});$('twRequest').disabled=false});$('twBack').onclick=()=>plan(true);
 $('twRequest').onclick=async()=>{if(saving||!reason)return;saving=true;const button=$('twRequest');button.disabled=true;try{
 if(requestOwner!==self())throw Error('Die Anmeldung hat sich geändert. Bitte neu öffnen.');K.auth.require('roster.swap.request');
 if(!created){const live=(K.shifts||[]).find(x=>x.id===shiftId&&x.personId===self()&&active(x));if(!live||live.start!==s.start||live.end!==s.end||live.date!==s.date||JSON.stringify(published().find(x=>x.id===shiftId))!==fingerprint)throw Error('Der Dienst hat sich geändert. Bitte die Übersicht erneut öffnen.');
 if((K.swapRequests||[]).some(r=>r.shiftId===shiftId&&r.status==='open'))throw Error('Für diesen Dienst liegt bereits eine offene Anfrage vor.');
 K.createSwapRequest({shiftId,note:reason+($('twNote').value.trim()?' '+$('twNote').value.trim():'')});created=true;}
 await K.persistAll();shell('Deine Anfrage ist gespeichert. Möchtest du noch einen weiteren Dienst auswählen?',`<h1>Anfrage gespeichert</h1><p>Die Übertragung erfolgt über die normale Synchronisierung. Dein bisheriger Dienst gilt weiter, bis die Änderung bestätigt ist.</p><div class="wa-actions"><button class="ux-btn primary" id="twAnother">Weiteren Dienst auswählen</button>${back()}</div>`,'requested');$('twAnother').onclick=()=>plan(true);wireBack();
 }catch(e){$('twRequestStatus').textContent=e.message;button.textContent=created?'Speichern erneut versuchen':'Anfrage speichern';button.disabled=false}finally{saving=false}};
}
// KICC-F-100 / DP2-F-SE-02: Sonderstunden melden – Sammelmeldung mit Stunden je Kollege. Gutschrift erst nach Bestätigung durch den Planer.
let hr=null;
const hrCore=()=>K.hourReportsCore;
const hrFmt=h=>{const v=Number(h);return v>=24?`${tm(v-24)} (+1 Tag)`:tm(v)};
const hrHours=v=>Number(v||0).toLocaleString('de-DE',{maximumFractionDigits:2});
function hrTimeOptions(sel,{from=0,to=24}={}){let o='';for(let q=from*4;q<=to*4;q++){const v=q/4;o+=`<option value="${v}" ${Math.abs(v-sel)<1e-9?'selected':''}>${hrFmt(v)}</option>`;}return o;}
const HR_ROLES=[['fahrer','Ich bin gefahren (Fahrer)'],['mitfahrer','Mitgefahren'],['keine','Keine Fahrt / anders hingekommen']];
const hrRoleShort=r=>({fahrer:'Fahrer',mitfahrer:'Mitfahrer',keine:'keine Fahrt'})[r]||'';
function hrRoleDefault(pid){return K.specialEventSignupsCore?.roleFor?.(hr.eventId,pid)||'keine';}
function hrRoleOptions(sel){return HR_ROLES.map(([v,l])=>`<option value="${v}" ${v===sel?'selected':''}>${l}</option>`).join('');}
function hrBreakOptions(sel){return [0,15,30,45,60,90,120].map(m=>`<option value="${m}" ${m===sel?'selected':''}>${m?m+' Min.':'keine'}</option>`).join('');}
// Nur Vereinsmitglieder mit Stundenkonto (keine Aushilfen/Platzhalter, keine gesperrten Personen).
function hrPeople(){return (K.people||[]).filter(p=>p.active!==false&&p.personType==='member'&&!String(p.personId).startsWith('KC-P-LOCAL-')&&K.personPlanningAllowed?.(p.personId)!==false&&p.personId!==self()).sort((a,b)=>String(a.name).localeCompare(String(b.name),'de'));}
function hoursStart(){
 if(!hrCore())return tasks();
 hr={eventId:null,date:null,start:8,end:16,breakMinutes:0,taetigkeit:null,bemerkung:'',fahrtRolle:null,others:{}};
 const list=hrCore().reportableEvents();
 shell('Für welchen Einsatz möchtest du Stunden melden? Die Stunden werden deinem Stundenkonto gutgeschrieben, sobald der Planer sie bestätigt hat.',`<h1>Sonderstunden melden</h1>${list.length?`<div class="wa-choices">${list.map(e=>`<button class="wa-choice" data-hr-event="${esc(e.id)}" ${e.reportable?'':'disabled'} aria-pressed="false"><b>${esc(e.titel)}</b><span>${esc(e.ort||e.artLabel||'')}${e.effective.datumVon?' · '+esc(dt(e.effective.datumVon))+(e.effective.datumBis&&e.effective.datumBis!==e.effective.datumVon?' – '+esc(dt(e.effective.datumBis)):''):''}${e.reportable?'':' · '+(e.effective.terminStatus==='OFFEN'?'Termin noch offen':'noch nicht stattgefunden')}</span></button>`).join('')}</div>`:'<p>Zurzeit gibt es keine Sondereinsätze. Der Planer legt sie an.</p>'}<div class="wa-actions">${back()}</div>`,'hours-event');wireBack();
 document.querySelectorAll('[data-hr-event]').forEach(b=>b.onclick=()=>{hr.eventId=b.dataset.hrEvent;hoursTime();});
}
function hoursTime(){
 const ev=K.specialEventsCore?.get?.(hr.eventId);if(!ev)return hoursStart();
 const allowed=hrCore().allowedDates(ev),today=hrCore().todayIso();if(!hr.date)hr.date=allowed.length===1?allowed[0]:(allowed.at(-1)||null);
 const dateField=allowed.length?`<label>Tag<select id="hrDate">${allowed.map(d=>`<option value="${d}" ${d===hr.date?'selected':''}>${esc(dt(d))}</option>`).join('')}</select></label>`:`<label>Tag<input type="date" id="hrDate" max="${today}" value="${esc(hr.date||'')}"></label>`;
 shell('Wann bist du zuhause losgefahren, und wann warst du wieder zuhause? Die Fahrzeit zählt mit.',`<h1>${esc(ev.titel)}</h1>${dateField}<div class="sw-grid"><label>Losgefahren<select id="hrStart">${hrTimeOptions(hr.start,{to:23.75})}</select></label><label>Wieder zuhause<select id="hrEnd">${hrTimeOptions(hr.end,{from:.25,to:hrCore().MAX_END})}</select></label><label>Pause<select id="hrBreak">${hrBreakOptions(hr.breakMinutes)}</select></label></div><label>Fahrt<select id="hrRole">${hrRoleOptions(hr.fahrtRolle||hrRoleDefault(self()))}</select></label><p><b>Was hast du gemacht?</b></p><div class="wa-choices">${K.hourReportActivities.map(a=>`<button class="wa-choice${a.id===hr.taetigkeit?' chosen':''}" data-hr-act="${esc(a.id)}" aria-pressed="${a.id===hr.taetigkeit}">${esc(a.label)}</button>`).join('')}</div><div id="hrTimeStatus" role="status"></div><div class="wa-actions"><button class="ux-btn secondary" id="hrBack">← Zurück</button><button class="ux-btn primary tw-next" id="hrNext">Weiter →</button></div>`,'hours-time');
 document.querySelectorAll('[data-hr-act]').forEach(b=>b.onclick=()=>{hr.taetigkeit=b.dataset.hrAct;document.querySelectorAll('[data-hr-act]').forEach(x=>{x.classList.toggle('chosen',x===b);x.setAttribute('aria-pressed',String(x===b))});});
 $('hrBack').onclick=hoursStart;
 $('hrNext').onclick=()=>{hr.date=$('hrDate').value||null;hr.start=Number($('hrStart').value);hr.end=Number($('hrEnd').value);hr.breakMinutes=Number($('hrBreak').value);hr.fahrtRolle=$('hrRole').value;
  const problem=!hr.date?'Bitte den Tag wählen.':hr.date>today?'Stunden können erst nach dem Einsatz gemeldet werden.':hr.end<=hr.start?'„Wieder zuhause“ muss nach „Losgefahren“ liegen.':!hr.taetigkeit?'Bitte wählen, was du gemacht hast.':'';
  if(problem){$('hrTimeStatus').textContent=problem;return;}hoursOthers();};
}
function hoursOthers(focusId){
 const people=hrPeople();
 // Build 290: vom Planer vorgesehene Kollegen einmal vorschlagen (abwählbar, wer nicht dabei war)
 if(!hr.prefilled){hr.prefilled=true;const planned=K.specialEventsCore?.get?.(hr.eventId)?.vorgesehen||[];for(const p of people)if(planned.includes(p.personId)&&!hr.others[p.personId])hr.others[p.personId]={start:hr.start,end:hr.end,breakMinutes:hr.breakMinutes,fahrtRolle:hrRoleDefault(p.personId)};}
 const plannedIds=K.specialEventsCore?.get?.(hr.eventId)?.vorgesehen||[];
 const row=p=>{const o=hr.others[p.personId];return `<article class="tw-row" data-hr-row="${esc(p.personId)}"><label class="sw-check"><input type="checkbox" data-hr-person="${esc(p.personId)}" ${o?'checked':''}> <b>${esc(p.name)}</b>${plannedIds.includes(p.personId)?' <small>(vorgesehen)</small>':''}</label>${o?`<div class="sw-grid"><label>Von<select data-hr-f="start">${hrTimeOptions(o.start,{to:23.75})}</select></label><label>Bis<select data-hr-f="end">${hrTimeOptions(o.end,{from:.25,to:hrCore().MAX_END})}</select></label><label>Pause<select data-hr-f="breakMinutes">${hrBreakOptions(o.breakMinutes)}</select></label><label>Fahrt<select data-hr-f="fahrtRolle">${hrRoleOptions(o.fahrtRolle||'keine')}</select></label></div><p>${hrHours(hrCore().hoursOf(o))} Stunden</p>`:''}</article>`;};
 shell(plannedIds.some(id=>id!==self())?'Wer war noch dabei? Die vom Planer vorgesehenen Kollegen sind schon ausgewählt – bitte abwählen, wer nicht dabei war. Deine Zeiten werden vorgeschlagen und können für jeden geändert werden.':'Wer war noch dabei? Wähle die Kollegen aus. Deine Zeiten werden vorgeschlagen und können für jeden geändert werden.',`<h1>Wer war noch dabei?</h1><p>Du: ${hrFmt(hr.start)}–${hrFmt(hr.end)} · ${hrHours(hrCore().hoursOf(hr))} Stunden</p><label>Kollegen suchen<input id="hrSearch" type="search" autocomplete="off" placeholder="Name"></label><div id="hrPeople">${people.map(row).join('')||'<p>Keine weiteren Personen vorhanden.</p>'}</div><div class="wa-actions"><button class="ux-btn secondary" id="hrBack">← Zurück</button><button class="ux-btn primary tw-next" id="hrNext">${Object.keys(hr.others).length?'Weiter →':'Nur ich – weiter →'}</button></div>`,'hours-others');
 if(focusId){const row=document.querySelector(`[data-hr-row="${CSS.escape(focusId)}"]`);row?.scrollIntoView({block:'center'});row?.querySelector('input')?.focus({preventScroll:true});}
 const redraw=id=>hoursOthers(id);
 document.querySelectorAll('[data-hr-person]').forEach(c=>c.onchange=()=>{const id=c.dataset.hrPerson;if(c.checked)hr.others[id]={start:hr.start,end:hr.end,breakMinutes:hr.breakMinutes,fahrtRolle:hrRoleDefault(id)};else delete hr.others[id];const q=$('hrSearch').value;redraw(id);if(q){$('hrSearch').value=q;$('hrSearch').oninput();}});
 document.querySelectorAll('[data-hr-row] select').forEach(sel=>sel.onchange=()=>{const id=sel.closest('[data-hr-row]').dataset.hrRow;hr.others[id][sel.dataset.hrF]=sel.dataset.hrF==='fahrtRolle'?sel.value:Number(sel.value);redraw(id);});
 $('hrSearch').oninput=()=>{const q=$('hrSearch').value.trim().toLowerCase();document.querySelectorAll('[data-hr-row]').forEach(r=>r.hidden=!!q&&!r.textContent.toLowerCase().includes(q)&&!r.querySelector('input:checked'));};
 $('hrBack').onclick=hoursTime;$('hrNext').onclick=hoursReview;
}
function hrSubmission(){return {specialEventId:hr.eventId,date:hr.date,taetigkeit:hr.taetigkeit,bemerkung:hr.bemerkung,eintraege:[{personId:self(),start:hr.start,end:hr.end,breakMinutes:hr.breakMinutes,fahrtRolle:hr.fahrtRolle||'keine'},...Object.entries(hr.others).map(([personId,o])=>({personId,...o}))]};}
function hoursReview(){
 const ev=K.specialEventsCore?.get?.(hr.eventId),sub=hrSubmission(),dl=hrCore().deadline(hr.date),total=sub.eintraege.reduce((n,e)=>n+hrCore().hoursOf(e),0);
 shell('Passt das so? Prüfe alle Zeiten. Erst mit dem Knopf unten wird gemeldet.',`<h1>Passt das so?</h1><p><b>${esc(ev?.titel||'')}</b> · ${esc(dt(hr.date))} · ${esc(hrCore().activityLabel(hr.taetigkeit))}</p>${sub.eintraege.map(e=>`<article class="tw-row"><b>${esc(K.person(e.personId)?.name||e.personId)}</b><p>${hrFmt(e.start)}–${hrFmt(e.end)}${e.breakMinutes?` · Pause ${e.breakMinutes} Min.`:''} · ${hrHours(hrCore().hoursOf(e))} Stunden${e.fahrtRolle&&e.fahrtRolle!=='keine'?' · '+hrRoleShort(e.fahrtRolle):''}</p></article>`).join('')}${sub.eintraege.filter(e=>e.fahrtRolle==='fahrer').length>1&&K.specialEventSignupsCore?.carpoolsFor?.(hr.eventId)?.length?'<p>⚠ Mehrere Fahrer gemeldet – vorrangig sollen Fahrgemeinschaften gebildet werden.</p>':''}<p><b>Zusammen: ${hrHours(total)} Stunden</b></p><label>Bemerkung (freiwillig)<textarea id="hrNote" maxlength="500" rows="2">${esc(hr.bemerkung)}</textarea></label><p>${dl.late?'⚠ Die Meldefrist von 3 Tagen ist abgelaufen. Du kannst trotzdem melden; der Planer sieht es als verspätet.':`Meldefrist: noch ${dl.left} ${dl.left===1?'Tag':'Tage'}.`}</p><p>Fahrtkosten und Auslagen (Parkgebühren, Kaution …) bitte zusätzlich in der Club-App unter Erstattung melden.</p><p><b>Die Stunden werden dem Stundenkonto „${esc(K.eventConfig?.name||'Weihnachtsmarkt')}“ gutgeschrieben, sobald der Planer sie bestätigt hat.</b></p><div id="hrStatus" role="status"></div><div class="wa-actions"><button class="ux-btn secondary" id="hrBack">← Zurück</button><button class="ux-btn primary tw-next" id="hrSend">✓ Gutschreiben lassen</button></div>`,'hours-review');
 $('hrNote').oninput=()=>{hr.bemerkung=$('hrNote').value;};
 $('hrBack').onclick=hoursOthers;
 let sending=false;$('hrSend').onclick=async()=>{if(sending)return;sending=true;$('hrSend').disabled=true;$('hrStatus').textContent='Wird gemeldet …';try{const r=await hrCore().submit(hrSubmission());hoursDone(r);}catch(e){$('hrStatus').textContent=e.message||String(e);$('hrSend').disabled=false;sending=false;}};
}
function hoursDone(r){
 const name=id=>esc(K.person(id)?.name||id);
 shell('Deine Meldung ist angekommen. Der Planer prüft sie und schreibt die Stunden dann deinem Stundenkonto gut.',`<h1>Gemeldet</h1>${(r.created||[]).length?`<p>Gemeldet für: ${(r.created||[]).map(x=>name(x.personId)).join(', ')}.</p>`:''}${(r.skipped||[]).length?`<p>Schon vorher gemeldet und deshalb nicht doppelt eingetragen: ${(r.skipped||[]).map(x=>name(x.personId)).join(', ')}.</p>`:''}<p>Bis zur Bestätigung stehen die Stunden im Kontoauszug als „gemeldet, noch nicht bestätigt“.</p>${K.hourReportsTransport?.openErstattung?'<p>Hattest du Fahrtkosten oder Auslagen (Parkgebühren, Kaution, Kraftstoff …)?</p><button class="ux-btn primary" id="hrErst">🚗 Fahrtkosten / Auslagen erfassen</button>':''}<div class="wa-actions"><button class="ux-btn secondary" id="hrMore">Weiteren Einsatz melden</button><button class="ux-btn primary" id="hrMine">Meine erfassten Zeiten</button>${back()}</div>`,'hours-done');wireBack();
 $('hrMore').onclick=hoursStart;$('hrMine').onclick=actual;
 if($('hrErst')){const ev=K.specialEventsCore?.get?.(hr.eventId);$('hrErst').onclick=()=>K.hourReportsTransport.openErstattung({specialEventId:hr.eventId,titel:ev?.titel||'',ort:ev?.ort||'',datum:hr.date,fahrer:hr.fahrtRolle==='fahrer'});}
}

// KICC-F-100 Phase 7: Zusage zu einem Sondereinsatz – Anreise und Fahrgemeinschaft (nur Startort, keine Adresse).
const suCore=()=>K.specialEventSignupsCore;
const SU_ANSWER={ja:'Ja, ich helfe',vielleicht:'Vielleicht',nein:'Nein, diesmal nicht'};
const SU_TRAVEL={fahrer:'Ich fahre und kann Leute mitnehmen',mitfahrer:'Ich brauche eine Mitfahrgelegenheit',selbst:'Ich komme anders hin'};
function suCarpoolText(id){const c=suCore().carpoolOf(id);if(!c)return '';const n=x=>esc(K.person(x)?.name||x);return c.fahrerId===self()?`<p>🚗 <b>Deine Fahrgemeinschaft:</b> Du fährst${(c.mitfahrer||[]).length?' – mit '+c.mitfahrer.map(n).join(', '):''}${c.startort?' · ab '+esc(c.startort):''}.</p>`:`<p>🚗 <b>Deine Fahrgemeinschaft:</b> Du fährst mit ${n(c.fahrerId)}${c.startort?' ab '+esc(c.startort):''}.</p>`;}
function signupStart(){
 if(!suCore())return tasks();
 const today=hrCore?.()?.todayIso?.()||new Date().toISOString().slice(0,10);
 const list=(K.specialEventsCore?.list?.()||[]).filter(e=>e.aktiv!==false&&(!e.effective.dates.length||e.effective.dates.some(d=>d>=today)));
 shell('Bei welchem Einsatz möchtest du helfen? Du kannst auch angeben, wie du hinkommst – vorrangig bilden wir Fahrgemeinschaften.',`<h1>Bei einem Sondereinsatz helfen</h1>${list.length?`<div class="wa-choices">${list.map(e=>{const m=suCore().mine(e.id);return `<button class="wa-choice" data-su-event="${esc(e.id)}" aria-pressed="false"><b>${esc(e.titel)}</b><span>${esc(e.ort||e.artLabel||'')}${e.effective.datumVon?' · '+esc(dt(e.effective.datumVon)):' · Termin noch offen'}${(e.vorgesehen||[]).includes(self())?' · 👥 Du bist vorgesehen (vorläufig)':''}${m?' · Deine Antwort: '+esc(SU_ANSWER[m.antwort]):''}</span></button>`}).join('')}</div>`:'<p>Zurzeit gibt es keine anstehenden Sondereinsätze.</p>'}<div class="wa-actions">${back()}</div>`,'signup-list');wireBack();
 document.querySelectorAll('[data-su-event]').forEach(b=>b.onclick=()=>signupForm(b.dataset.suEvent));
}
function signupForm(id){
 const ev=K.specialEventsCore?.get?.(id);if(!ev)return signupStart();
 const m=suCore().mine(id)||{},st={antwort:m.antwort||null,anreise:m.anreise||null,plaetze:Number(m.plaetze||3),startort:m.startort||'',bemerkung:m.bemerkung||''};
 const draw=()=>{
  shell('Kannst du helfen? Und wie kommst du hin?',`<h1>${esc(ev.titel)}</h1><p>${esc(ev.ort||'')}${ev.effective.datumVon?' · '+esc(dt(ev.effective.datumVon)):' · Termin noch offen'}</p>${suCarpoolText(id)}<p><b>Kannst du helfen?</b></p><div class="wa-choices">${Object.entries(SU_ANSWER).map(([k,l])=>`<button class="wa-choice${st.antwort===k?' chosen':''}" data-su-a="${k}" aria-pressed="${st.antwort===k}">${l}</button>`).join('')}</div>${st.antwort&&st.antwort!=='nein'?`<p><b>Wie kommst du hin?</b></p><div class="wa-choices">${Object.entries(SU_TRAVEL).map(([k,l])=>`<button class="wa-choice${st.anreise===k?' chosen':''}" data-su-t="${k}" aria-pressed="${st.anreise===k}">${l}</button>`).join('')}</div>${st.anreise==='fahrer'?`<label>Freie Plätze<select id="suSeats">${[0,1,2,3,4,5,6,7,8].map(n=>`<option value="${n}" ${n===st.plaetze?'selected':''}>${n}</option>`).join('')}</select></label>`:''}${st.anreise==='fahrer'||st.anreise==='mitfahrer'?`<label>Startort<select id="suPlace"><option value="">– bitte wählen –</option>${K.carpoolPlaces.map(o=>`<option ${o===st.startort?'selected':''}>${esc(o)}</option>`).join('')}</select></label><p><small>Nur der Ort, keine Adresse.</small></p>`:''}`:''}<label>Bemerkung (freiwillig)<input id="suNote" maxlength="300" value="${esc(st.bemerkung)}"></label><div id="suStatus" role="status"></div><div class="wa-actions"><button class="ux-btn secondary" id="suBack">← Zurück</button><button class="ux-btn primary tw-next" id="suSave">Speichern</button></div>`,'signup-form');
  const keep=()=>{if($('suSeats'))st.plaetze=Number($('suSeats').value);if($('suPlace'))st.startort=$('suPlace').value;st.bemerkung=$('suNote').value;};
  document.querySelectorAll('[data-su-a]').forEach(b=>b.onclick=()=>{keep();st.antwort=b.dataset.suA;if(st.antwort==='nein')st.anreise=null;draw();});
  document.querySelectorAll('[data-su-t]').forEach(b=>b.onclick=()=>{keep();st.anreise=b.dataset.suT;draw();});
  $('suBack').onclick=signupStart;
  let saving=false;$('suSave').onclick=async()=>{if(saving)return;keep();saving=true;$('suSave').disabled=true;try{await suCore().answer(id,st);shell('Danke! Deine Angaben sind gespeichert. Der Planer bildet daraus die Fahrgemeinschaften.',`<h1>Gespeichert</h1><p>${esc(ev.titel)}: ${esc(SU_ANSWER[st.antwort])}${st.anreise?' · '+esc(SU_TRAVEL[st.anreise]):''}${st.anreise==='fahrer'?` · ${st.plaetze} ${st.plaetze===1?'freier Platz':'freie Plätze'}`:''}${st.startort&&st.anreise!=='selbst'?' · ab '+esc(st.startort):''}.</p>${suCarpoolText(id)}<div class="wa-actions"><button class="ux-btn secondary" id="suMore">Weiteren Einsatz</button>${back()}</div>`,'signup-done');wireBack();$('suMore').onclick=signupStart;}catch(e){$('suStatus').textContent=e.message||String(e);$('suSave').disabled=false;saving=false;}};
 };
 draw();
}

function actual(){
 if(!K.auth.has('roster.actual.view_own'))return tasks();
 // Build 291: Sonderstunden mit Stand – offen, bestätigt (gutgeschrieben) oder abgelehnt mit Grund. Bestätigte, die schon als Ist-Zeit
 // vorliegen (DP2), werden nicht doppelt gezeigt; in der Club App gibt es keine Ist-Zeiten, dort erscheint die bestätigte Meldung selbst.
 const own=(K.actualShifts||[]).filter(x=>x.personId===self()&&active(x)),booked=r=>own.some(x=>(r.actualId&&x.id===r.actualId)||(x.source==='self_report'&&x.date===r.date&&Math.abs(x.start-r.start)<1e-9&&Math.abs(x.end-r.end)<1e-9));
 const mine=(K.hourReports||[]).filter(x=>x&&x.personId===self()&&x.date&&['gemeldet','bestaetigt','abgelehnt'].includes(x.status));
 const reports=mine.filter(x=>x.status!=='bestaetigt'||!booked(x)).map(x=>({...x,report:true,pending:x.status==='gemeldet',confirmed:x.status==='bestaetigt',rejected:x.status==='abgelehnt'}));
 const rows=[...own,...reports].sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start),dates=[...new Set(rows.map(x=>x.date))];
 const hrsA=x=>(K.actual?.minutes?.(x.end,x.start,x.breakMinutes)??Math.max(0,(x.end-x.start)*60))/60,hrsR=x=>K.hourReportsCore?.hoursOf?K.hourReportsCore.hoursOf(x):Math.max(0,(x.end-x.start)*60-Number(x.breakMinutes||0))/60,hrs=x=>x.report?hrsR(x):hrsA(x),fmtH=v=>v.toLocaleString('de-DE',{maximumFractionDigits:2});
 const sumOk=mine.filter(x=>x.status==='bestaetigt').reduce((n,x)=>n+hrsR(x),0),sumOpen=mine.filter(x=>x.status==='gemeldet').reduce((n,x)=>n+hrsR(x),0);
 const summary=mine.length?`<p class="tw-hr-sum"><b>★ Sonderstunden:</b> ${fmtH(sumOk)} Std. gutgeschrieben${sumOpen?` · ${fmtH(sumOpen)} Std. gemeldet, noch nicht bestätigt (zählen erst nach Bestätigung)`:''}</p>`:'';
 shell('Welche erfassten Zeiten möchtest du ansehen? Wähle einen Tag aus.',`<h1>Meine erfassten Zeiten</h1>${summary}${dates.length?`<label>Tag auswählen<select id="twActualDate">${dates.map(d=>`<option value="${d}">${dt(d)}</option>`).join('')}</select></label><div id="twActualRows"></div>`:'<p>Für dich wurden noch keine Istzeiten erfasst.</p>'}<div class="wa-actions">${back()}</div>`,'actual');wireBack();
 const draw=()=>{const selected=rows.filter(x=>x.date===$('twActualDate').value);$('twActualRows').innerHTML=selected.map(x=>`<article class="tw-row"><b>Kommen ${tm(x.start)} · Gehen ${tm(x.end)}</b><p>${x.pending?'Gemeldet, noch nicht bestätigt · ':x.confirmed?'✓ Bestätigt – gutgeschrieben · ':x.rejected?'✖ Nicht gutgeschrieben · ':''}${esc((x.specialEventId&&K.specialEventsCore?.get?.(x.specialEventId)?.titel)||x.specialEventTitle||x.area||'Dienst')} · ${fmtH(hrs(x))} Stunden${x.rejected?' (zählen nicht)':''}</p>${x.rejected&&x.ablehngrund?`<p>Grund: ${esc(x.ablehngrund)}</p>`:''}</article>`).join('')+'<p>Die Stunden berücksichtigen die im Programm eingestellte Pausenberechnung.</p>';};if($('twActualDate')){$('twActualDate').onchange=draw;draw()}
}
window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
K.twinkey={home,tasks,entryMethods,reset,stop,controls,bind,mode:()=>mode,guided:()=>available()&&mode==='guided',start(){owner=self();mode='guided';tasks()}};
})();
