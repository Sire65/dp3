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
 `<span class="wa-eyebrow">WILLKOMMEN</span><h1>Mit Begleitung oder direkt loslegen?</h1><div class="wa-choices"><button class="wa-choice" data-tw-mode="guided" aria-pressed="false"><b>Mit Twinkey</b><span>Eine Frage nach der anderen.</span></button><button class="wa-choice" data-tw-mode="plain" aria-pressed="false"><b>Ohne Assistent</b><span>Direkt zur gewohnten Übersicht.</span></button></div><div class="wa-actions"><button class="ux-btn secondary" id="twSkip">Überspringen</button><button class="ux-btn primary tw-next" id="twNext" disabled>Weiter →</button></div>`,'welcome');
 document.querySelector('.ux-bottomnav')?.setAttribute('hidden','');
 let selected=null;document.querySelectorAll('[data-tw-mode]').forEach(b=>b.onclick=()=>{selected=b.dataset.twMode;document.querySelectorAll('[data-tw-mode]').forEach(x=>{x.classList.toggle('chosen',x===b);x.setAttribute('aria-pressed',String(x===b))});$('twNext').disabled=false;$('twNext').click()});
 $('twNext').onclick=()=>{if(!selected)return;mode=selected;mode==='guided'?tasks():K.roleUx.employeeHome()};$('twSkip').onclick=()=>{mode='plain';voice=false;stop();K.roleUx.employeeHome()};
}
function tasks(){
 const name=(K.person(self())?.name||K.currentUser.displayName||'').trim().split(/\s+/)[0]||'';
 const greeting=`Hallo ${name}, schön, dass du da bist. Gemeinsam bringen wir deine Zeiten schnell und einfach in den Dienstplan. Wie möchtest du anfangen?`;
 shell(greeting,`<h1>Wie möchtest du anfangen?</h1><div class="wa-choices">${[['wish','Meinen Wunschplan eintragen oder ändern','Kann, Wunsch, Sperren und Bereitschaft'],['plan','Meinen Dienstplan ansehen','Meine freigegebenen Dienste'],['change','Einen Dienst ändern lassen','Ersatz oder Tausch anfragen'],['actual','Meine erfassten Zeiten ansehen','Kommen, Gehen und Stunden']].map(([id,title,sub])=>`<button class="wa-choice" data-tw-task="${id}" aria-pressed="false"><b>${title}</b><span>${sub}</span></button>`).join('')}</div><div class="wa-actions"><button class="ux-btn secondary" id="twBack">← Zurück</button><button class="ux-btn primary tw-next" id="twNext" disabled>Weiter →</button></div>`,'tasks');
 let selected=null;document.querySelectorAll('[data-tw-task]').forEach(b=>b.onclick=()=>{selected=b.dataset.twTask;document.querySelectorAll('[data-tw-task]').forEach(x=>{x.classList.toggle('chosen',x===b);x.setAttribute('aria-pressed',String(x===b))});$('twNext').disabled=false;$('twNext').click()});
 $('twBack').onclick=welcome;$('twNext').onclick=()=>{if(selected==='wish')entryMethods();else if(selected==='plan')plan();else if(selected==='change')plan(true);else if(selected==='actual')actual()};
}

function entryMethods(){
 K.guidedImportContext=null;
 shell('Wie möchtest du deine Zeiten eintragen? Wähle einen Weg.','<h1>Wie möchtest du deine Zeiten eintragen?</h1><div class="sw-grid">'+[['manual','Selbst eingeben'],['colleague','Von Kollegen übernehmen'],['excel','Excel-Datei einlesen'],['photo','Plan fotografieren'],['overview','Grafische Übersicht der bisherigen Zeiten']].map(([id,label])=>'<button class="wa-choice" data-tw-entry="'+id+'">'+label+'</button>').join('')+'</div><button class="ux-btn secondary" id="twEntryBack">← Zurück</button>','entry');
 $('twEntryBack').onclick=tasks;
 document.querySelectorAll('[data-tw-entry]').forEach(b=>b.onclick=()=>{const kind=b.dataset.twEntry;if(kind==='manual')K.wishAssistant.start();else if(kind==='overview')K.simpleWishAssistant.openTeamOverview();else if(kind==='colleague'){shell('Die Freigaben für Kollegen sind noch in Vorbereitung.','<h1>Zeiten von Kollegen übernehmen</h1><label>Kollege auswählen<select id="twColleagueSelect"><option value="">Bitte wählen</option>'+K.people.filter(p=>p.active!==false).sort((a,b)=>String(a.name||a.displayName).localeCompare(String(b.name||b.displayName),'de')).map(p=>'<option value="'+esc(p.personId)+'">'+esc(p.name||p.displayName||p.personId)+'</option>').join('')+'</select></label><p>Der Freigabestatus ist noch nicht abrufbar. Deshalb wird kein Schloss angezeigt. Die Übernahme ist erst möglich, wenn die Freigabe geprüft wurde.</p><button id="twMethodBack" class="ux-btn secondary">← Anderen Eingabeweg wählen</button>','colleague');$('twMethodBack').onclick=entryMethods;}else importQuestion(kind);});
}
function importQuestion(kind){
 K.guidedImportContext=null;
 const excel=kind==='excel',question=excel?'Hast du deine Excel-Vorlagendatei schon ausgefüllt?':'Hast du deinen ausgefüllten Plan schon bereit?';
 const writingHelp=excel?'':'<aside class="ux-note"><b>Deine Handschrift besser erkennen</b><p>Zur besseren Erkennung ist es ratsam, einige Schriftproben von dir zu bekommen. Du kannst die Vorlage ausdrucken, ausfüllen und deinem IT-Kollegen zukommen lassen. Damit kann die Erkennung auf deine Schrift trainiert werden.</p><button class="ux-btn secondary" id="twWritingSample">Schriftproben herunterladen</button></aside>';
 shell(question,'<h1>'+question+'</h1><div class="sw-grid"><button class="wa-choice" id="twImportReady">Ja, '+(excel?'Datei einlesen':'Foto aufnehmen oder auswählen')+'</button><button class="wa-choice" id="twImportTemplate">Nein, persönliche Vorlage herunterladen</button></div>'+writingHelp+'<p id="twImportInfo" role="status"></p><button class="ux-btn secondary" id="twMethodBack">← Zurück</button>','import-'+kind);
 $('twMethodBack').onclick=entryMethods;
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
function actual(){
 if(!K.auth.has('roster.actual.view_own'))return tasks();const rows=(K.actualShifts||[]).filter(x=>x.personId===self()&&active(x)).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start),dates=[...new Set(rows.map(x=>x.date))];
 shell('Welche erfassten Zeiten möchtest du ansehen? Wähle einen Tag aus.',`<h1>Meine erfassten Zeiten</h1>${dates.length?`<label>Tag auswählen<select id="twActualDate">${dates.map(d=>`<option value="${d}">${dt(d)}</option>`).join('')}</select></label><div id="twActualRows"></div>`:'<p>Für dich wurden noch keine Istzeiten erfasst.</p>'}<div class="wa-actions">${back()}</div>`,'actual');wireBack();
 const draw=()=>{const selected=rows.filter(x=>x.date===$('twActualDate').value);$('twActualRows').innerHTML=selected.map(x=>`<article class="tw-row"><b>Kommen ${tm(x.start)} · Gehen ${tm(x.end)}</b><p>${esc(x.area||'Dienst')} · ${((K.actual?.minutes?.(x.end,x.start,x.breakMinutes)??Math.max(0,(x.end-x.start)*60))/60).toLocaleString('de-DE',{maximumFractionDigits:2})} Stunden</p></article>`).join('')+'<p>Die Stunden berücksichtigen die im Programm eingestellte Pausenberechnung.</p>';};if($('twActualDate')){$('twActualDate').onchange=draw;draw()}
}
window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
K.twinkey={home,tasks,entryMethods,reset,stop,controls,bind,mode:()=>mode,guided:()=>available()&&mode==='guided',start(){owner=self();mode='guided';tasks()}};
})();
