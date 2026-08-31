import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [index,app,hour,picker,transfer,composite,deviations,forms,manifest,shell,shellCss,demand,demandCss,colleague,importReview,personalized,pdf,qrVendor,wishCheck,globalHistory,history,formOcr,occupancy,occupancyCss,batch,batchCss]=await Promise.all([
  read('index.html'),read('src/ui/app.js'),read('src/ui/hour-matrix.js'),
  read('src/ui/day-picker.js'),read('src/ui/plan-transfer.js'),read('src/ui/wish-bar-composite.js'),
  read('src/ui/deviations-view.js'),read('src/ui/forms-center.js'),read('update-manifest.json'),
  read('src/ui/v020-shell.js'),read('src/ui/v020-shell.css'),read('src/ui/demand-view.js'),read('src/ui/regression-fixes.css'),read('src/ui/mobile-colleague-search.js'),read('src/core/import-review.js'),read('src/core/personalized-forms.js'),read('src/adapters/pdf.js'),read('src/vendor/qrcode-generator.js'),read('src/ui/wish-submission-check.js'),read('src/ui/global-history.js'),read('src/core/history.js'),read('src/adapters/form-ocr.js'),read('src/ui/occupancy-view.js'),read('src/ui/occupancy-view.css'),read('src/ui/batch-planning.js'),read('src/ui/batch-planning.css')
]);
const planningFocus=await read('src/ui/planning-focus.js'),planningFocusCss=await read('src/ui/planning-focus.css'),documents=await read('src/core/documents.js');
const wishGuideControls=await read('src/ui/wish-guide-controls.js'),wishCompositeCss=await read('src/ui/wish-bar-composite.css');
assert(index.includes('src/ui/wish-guide-controls.js')&&wishGuideControls.includes('plan-wish-guide-handle')&&wishGuideControls.includes('plan-wish-guide-reveal')&&wishGuideControls.includes("mode==='move'")&&wishGuideControls.includes('Kann-Zeit per Drag/Resize geändert')&&wishCompositeCss.includes('.plan-wish-guide[data-direct-control]'),'Kann-Zeit muss vollhoch hinter dem Soll liegen sowie direkt verschieb- und an beiden Rändern skalierbar sein.');

assert(index.includes('src/ui/day-picker.js'), 'Gemeinsame Tagesauswahl muss geladen werden');
assert(planningFocus.includes('planningDenseBtn')&&planningFocus.includes("toggle('dense')")&&planningFocusCss.includes('.kc-dense-planning'), 'Globaler Verdichtungsbutton muss Zeilen, Balken und Kopf kompakt schalten');
assert(planningFocusCss.includes('.person-row>.person-cell')&&planningFocusCss.includes('max-height:36px!important')&&planningFocusCss.includes('.compare-row'), 'Verdichtung muss die echte Raster-, Zell- und Vergleichszeilenhoehe verbindlich reduzieren');
assert(planningFocusCss.includes('Verdichtung: Besetzungsmatrix und Bereitschaft')&&planningFocusCss.includes('.standby-row')&&planningFocusCss.includes("[data-v020-register='matrix'] .hm-table th")&&planningFocusCss.includes('.occ-chart-cell'),'Verdichtung muss Bereitschaft, Stundenmatrix und grafische Besetzung gemeinsam verkleinern');
assert(planningFocus.includes('installLowerLayout')&&planningFocus.includes('lowerGap')&&planningFocus.includes("lowerOrder==='standby-first'")&&planningFocus.includes('nextElementSibling!==first'),'Untere Planblöcke brauchen gespeicherte Verschiebehoehe und schleifenfreien Reihenfolgewechsel');
assert(planningFocus.includes('Math.max(-420')&&planningFocus.includes('spacer.style.marginTop')&&planningFocus.includes('handle.ondblclick'),'Verschiebelinie muss nach oben und unten arbeiten und per Doppelklick zurücksetzbar sein');
assert(planningFocusCss.includes('.planner-lower-separator')&&planningFocusCss.includes('.lower-swap')&&planningFocusCss.includes('cursor:ns-resize'),'Verschiebelinie und B-Tauschschalter müssen sichtbar und ziehbar gestaltet sein');
assert(planningFocusCss.includes('Schlanke Verschiebelinie')&&planningFocusCss.includes('min-height:6px!important')&&planningFocusCss.includes('min-height:18px!important')&&planningFocusCss.includes('@media(pointer:coarse)'),'Verschiebelinie muss im Ruhezustand dünn und bei Interaktion oder Touch sicher greifbar sein');
assert(planningFocusCss.includes('Vordergrundebene bei hochgeschobenen unteren Planblöcken')&&planningFocusCss.includes('z-index:50!important')&&planningFocusCss.includes('background-color:#fff!important'),'Hochgeschobene Besetzung und Bereitschaft müssen deckend vor den Dienstplanzeilen liegen');
assert(planningFocusCss.includes('body.kc-context-collapsed .planner-meta')&&planningFocusCss.includes('body.kc-context-collapsed .plan-message-inline'), 'Kontextschalter muss sichtbaren Tageskopf und Meldungen schalten');
assert(planningFocusCss.includes('body.kc-plan-collapsed .planner-workspace{display:none!important}')&&planningFocusCss.includes('height:auto!important'), 'Planungsschalter muss Bereich und feste Leerhoehe gemeinsam einklappen');
assert(index.indexOf('src/vendor/tesseract/tesseract.min.js')<index.indexOf('src/adapters/form-ocr.js')&&index.indexOf('src/adapters/form-ocr.js')<index.indexOf('src/adapters/photo-recognition.js'),'Lokale OCR muss vor dem Fotoimport geladen werden');
assert(index.indexOf('src/core/document-identity.js')<index.indexOf('src/core/personalized-forms.js'), 'Dokumentidentität muss vor personalisierten Formularen geladen werden');
assert(index.indexOf('src/vendor/qrcode-generator.js')<index.indexOf('src/core/personalized-forms.js'), 'Lokaler QR-Generator muss vor personalisierten Formularen geladen werden');
assert(index.indexOf('src/ui/day-picker.js')<index.indexOf('src/ui/hour-matrix.js'), 'Tagesauswahl muss vor Stundenmatrix geladen werden');
assert(picker.includes("weekend")&&picker.includes("striped"), 'Tagesliste muss Wochenende und Auf-/Nachbereitung markieren');
assert(hour.includes("Bedarf V / H")&&hour.includes("Soll V / H")&&hour.includes("Ist V / H"), 'Stundenmatrix muss V/H getrennt zeigen');
assert(shell.includes("id:'matrix',label:'Stundenmatrix'")&&index.includes('src/ui/hour-matrix.js'), 'Register Stundenmatrix muss sichtbar und geladen bleiben');
assert(!shell.includes("id:'occupancy',label:'Besetzung'")&&index.includes('src/ui/occupancy-view.js')&&index.includes('src/ui/occupancy-view.css')&&hour.includes('K.occupancyView?.embed?.(host)'),'Grafische Besetzung muss ohne doppelte Registerkarte einklappbar in der Stundenmatrix liegen');
assert(occupancy.includes("['day','T','Tagesansicht']")&&occupancy.includes("['week','W','Wochenansicht']")&&occupancy.includes("['all','Z','Gesamter Zeitraum']"),'Besetzungsansicht muss das gemeinsame T/W/Z-Muster verwenden');
assert(occupancy.includes("pref==='B'")&&occupancy.includes("people.length")&&occupancy.includes("x.zone==='front'")&&occupancy.includes("x.zone==='back'"),'B-Personen müssen einmal gezählt und vom tatsächlichen Einsatzort getrennt bleiben');
assert(occupancyCss.includes('.occ-level.back')&&occupancyCss.includes('.occ-level.front')&&occupancyCss.includes('.occ-person.t4'),'Besetzung braucht kompakte Vorder-/Hinterebenen und leicht variierte neutrale Personenicons');
assert(occupancy.includes('function alignEmbedded')&&occupancy.includes('gridAutoColumns')&&occupancy.includes('lower.scrollLeft'),'Grafische Besetzung und Stundenmatrix müssen dieselben Spaltenbreiten und gekoppelte horizontale Position verwenden');
assert(occupancyCss.includes(':has(#hmOccupancyEmbed.open)')&&occupancyCss.includes('.occ-time small{display:none}'),'Bei geöffneter Grafik darf nur eine gemeinsame Stundenüberschrift sichtbar sein');
assert(occupancy.includes('function staffingChart')&&occupancy.includes('occChartToggle')&&occupancy.includes('occ-chart-target')&&occupancyCss.includes('.occ-chart-series.under')&&occupancyCss.includes('.occ-chart-series.high'),'Einklappbarer V/H-Besetzungsverlauf muss Ist/Soll, Statusfarben und Sollmarken anzeigen');
assert(occupancy.includes("querySelectorAll('.occ-scroll')")&&occupancy.includes("querySelector('.occ-hours,.occ-chart-hours')"),'Besetzungskarten, Säulendiagramm und Stundenmatrix müssen gemeinsam horizontal gekoppelt sein');
assert(documents.includes('chunk(people,9)')&&documents.includes('roster-grid')&&documents.includes('Blatt ${pageIndex+1} von'),'Sollplan-Druck muss als lesbare Mehrseitenmatrix mit neun Personen je A4-Querformatblatt aufgebaut sein');
assert(documents.includes('plannedDayDocument')&&documents.includes('plannedWeekDocument')&&documents.includes('day-timeline')&&documents.includes('day-bar zone-'),'Dokumentcenter muss Tagesplan mit Zeitbalken sowie Wochenplan und Gesamtplan erzeugen');
assert(documents.includes('occupancyStats(days,rows)')&&documents.includes('Besetzungsstatistik')&&documents.includes('Spitze V'),'Alle mehrtägigen Sollpläne müssen eine kompakte Besetzungsstatistik enthalten');
assert(documents.includes('since 1991')&&documents.includes('border-bottom:2px solid #7a1420'),'Druckkopf muss Logo-Herkunft und einen tintensparenden Akzent statt einer massiven Farbfläche verwenden');
assert(documents.includes('roster-weekend')&&documents.includes('roster-specialday')&&documents.includes('zone-v')&&documents.includes('zone-h'),'Sollplan-Druck muss Wochenende, Auf-/Nachbereitung sowie V/H eindeutig kennzeichnen');
assert(occupancyCss.includes('#7a1420!important')&&occupancyCss.includes('#566578!important'),'Besetzungsverlauf muss die festen Programmfarben für Vorne und Hinten verwenden');
assert(transfer.includes('decorateMatrixOrigins')&&transfer.includes('Herkunft der vorhandenen Angaben')&&app.includes('planningOrigin(x,\'wish\')'),'Normaler Wunschdialog und Wunschmatrix müssen Herkunftsnachweise anzeigen');
assert(index.includes('src/ui/batch-planning.js')&&batch.includes('data-batch-person')&&batch.includes('data-batch-all')&&batch.includes('Sammelübernahme aus Wunschplan'),'Wunsch- und Sollplan brauchen Auswahlkästchen, Alle/Keine und geprüfte Sammelübernahme');
assert(batch.includes('function timeDialog')&&batch.includes('function copyDialog')&&batch.includes('K.validateShift(candidate)')&&batchCss.includes('@media(max-width:760px),(pointer:coarse)'),'Sammelzeit, Kopieren, Konfliktprüfung und Tablet-Bedienung müssen erhalten bleiben');
assert(batch.includes('function syncChecks')&&batch.includes('box.checked=ids.has')&&batchCss.includes('.person-row>.person-cell')&&batchCss.includes('box-shadow:inset 0 -2px'),'Alle-Auswahl muss Einzelhaken synchronisieren und Mitarbeiterzeilen brauchen eine durchgehende zarte Trennung');
assert(app.includes('function deletePlanningBar')&&app.includes("e.key==='Delete'")&&app.includes("label:'Löschen',action:()=>deletePlanningBar({kind:'actual'")&&app.includes('selectedPlanningBar')&&app.includes('K.actual.deleteActual')&&app.includes('K.mutations.deleteShift')&&app.includes('K.mutations.deleteWish'),'Markierte Wunsch-, Soll- und Istbalken müssen per Entf-Taste und Kontextmenü revisionssicher löschbar sein');
assert(app.includes('bar.dataset.wishGuide')&&app.includes('.plan-wish-guide[data-wish-guide]')&&app.includes('K.openWishContext=openWishContext')&&composite.includes('Kann-Zeit markieren, Entf zum Löschen'),'Schraffierte Kann-Zeit muss auswählbar, per Entf löschbar und per Rechtsklick bearbeitbar sein');
assert((await read('src/core/workflow.js')).includes("['cancelled','absent','failed','deleted']"),'Gelöschte Soll-Dienste dürfen im Planerfilter nicht erneut erscheinen');assert(batch.includes('function decoratePreviewChecks')&&batch.includes('data-batch-preview-person')&&batch.includes('applyPreviewSelection')&&batchCss.includes('.batch-preview-check'),'Mitarbeiter müssen in Sammelvorschauen vor der Anwendung nochmals abwählbar sein');
assert(shellCss.includes('.v020-register-bar{display:flex')&&!shellCss.includes('grid-template-columns:repeat(8'), 'Register müssen kompakt nach Inhalt statt gleich breit dargestellt werden');
assert(demand.includes('id="demandEditToggle"')&&demand.includes('type="number"')&&demand.includes('step="1"')&&demand.includes('id="demandSave"'), 'Bedarf muss direkt mit Zahlenfeldern und Hoch-/Runter-Pfeilen editierbar bleiben');
assert(demand.includes('function changeDemandInput')&&demand.includes("total.value=n(front.value)+n(back.value)")&&demand.includes('function recalculateDraft')&&demand.includes('data-demand-kpi="recommended"'), 'Bedarf muss Gesamt, V/H, Empfehlung und KPIs während der Eingabe live neu berechnen');
assert(demandCss.includes('.demand-table input[type="number"]'), 'Bedarfs-Zahlenfelder brauchen eine sichtbare kompakte Gestaltung');
assert(index.includes('src/ui/wish-submission-check.js')&&wishCheck.includes("color.after(b)")&&wishCheck.includes('Noch keine Wunschplanung eingereicht')&&wishCheck.includes('K.notifications?.wishDeadline'), 'Wunschabgabe-Check, Quellenübersicht oder Erinnerungsfunktion fehlt');
assert(wishCheck.includes("s==='excel_import'")&&wishCheck.includes("s==='form_import'")&&wishCheck.includes("s==='self_service'"), 'Wunschabgabe-Check muss Excel, Foto/Formular und manuelle Eingabe unterscheiden');
assert(index.includes('src/ui/global-history.js')&&history.includes('max:40')&&history.includes('state.max+1')&&globalHistory.includes("key==='z'")&&globalHistory.includes("key==='y'"), 'Globales Undo/Redo muss 40 Änderungen und Tastenkürzel unterstützen');
assert(index.includes('id="undoBtn" class="global-history-button"')&&index.includes('id="redoBtn" class="global-history-button"'), 'Undo/Redo müssen in allen Ansichten sichtbar eingebaut sein');
assert(index.indexOf('id="undoBtn"')<index.indexOf('class="db-block"')&&index.includes('aria-label="Änderungsverlauf"'), 'Undo/Redo müssen links vor den Datenbank-LEDs stehen');
assert(index.includes('aria-label="Rückgängig">↶</button>')&&index.includes('aria-label="Wiederholen">↷</button>')&&!index.includes('↶ Undo')&&!index.includes('↷ Redo'), 'Undo/Redo dürfen oben nur Symbole mit Tooltip zeigen');
assert(app.includes('function expandedPersonRows')&&app.includes("label:'Wunschzeit'")&&app.includes("label:'Kann / Reserve'")&&app.includes("label:'Soll / Ist'")&&app.includes("label:'Sperren / Hinweise'"), 'Aufgeklappte Mitarbeiter brauchen vier relevante Informationszeilen');
assert(index.indexOf('id="exitBtn"')<index.indexOf('id="settingsBtn"'), 'Zahnrad muss rechts neben der Tür stehen');
assert(colleague.indexOf('.kc-mobile-colleague-backdrop{')<colleague.indexOf('@media(max-width:600px)'), 'Kollegensuche braucht eine Gestaltung für alle Fenstergrößen');
assert(hour.includes('K.dayPicker?.open'), 'Stundenmatrix muss gemeinsame Tagesauswahl verwenden');
assert(demand.includes("current?'current-day'")&&hour.includes("current?'current-day'")&&index.includes('src/ui/active-day.js')&&index.includes('src/ui/active-day.css'), 'Aktiver Tag muss in Bedarf, Stundenmatrix und weiteren Mehrtagesansichten markiert werden');
assert(app.includes('Letzte technische Fehlerursache')&&app.includes('Warteschlange synchronisieren')&&app.includes('Neu anmelden')&&app.includes('Anmeldung, Provider und Datenbank erreichbar'), 'Supabase-Diagnose muss Ursache, lokalen Datenstatus und nächsten Schritt verständlich anzeigen');
assert(app.includes('K.planTransfer?.matrixEditor'), 'Wunschbalken-Doppelklick muss vollständige Matrix öffnen');
assert(transfer.includes('Wunschplan in den Sollplan')&&transfer.includes('Sollplan in den Istplan'), 'Beide Planübergaben müssen vorhanden sein');
assert(transfer.includes('Es wird nichts überschrieben'), 'Planübergabe darf nichts überschreiben');
assert(composite.includes('wish-composite-solid')&&composite.includes('plan-wish-guide'), 'Wunsch/Kann-Kompositbalken fehlen');
assert(deviations.includes('Wunsch, Soll und Ist')&&deviations.includes('data-dev-plan')&&deviations.includes('data-dev-actual'), 'Abweichungsansicht ist unvollständig');
assert(forms.includes('KC_DP2_Wunschzeiten_Vorlage_Weihnachtsmarkt_2026_V6_VHB.xlsx')&&forms.includes('KC_DP2_Verfuegbarkeitsformular_V12_VHB_QR_DRUCKRAND_FINAL.docx'), 'Formularzentrum kennt nicht alle vorhandenen Originale');
assert(forms.includes('KC_DP2_Persoenliches_Handschriftprofil_Lernbogen_V1.docx'), 'Schriftlernbogen fehlt im Formularzentrum');
assert(forms.includes('data-personal-form="matrix"')&&forms.includes('data-personal-form="excel"')&&forms.includes('data-personal-form="handwriting"'), 'Drei personalisierte Downloads fehlen im Formularzentrum');
assert(personalized.includes("fetch('templates/KC_DP2_Wunschzeiten_Vorlage_Weihnachtsmarkt_2026_V6_VHB.xlsx'")&&!personalized.includes('XLSX.')&&personalized.includes('Originalformat.xlsx'), 'Excel-Download muss die reparaturfreie Originalmatrix unverändert ausliefern');
assert(personalized.includes('handwriting-table handwriting-section')&&!personalized.includes('____________________________________________________________')&&pdf.includes('minRow=handwriting?34')&&pdf.includes('stroke:framed?.7:handwriting?0:.55'), 'Handschriftprobe braucht hohe gerahmte Schreibfelder ohne enge Linien');
assert(personalized.includes('class="matrix-form-table"')&&personalized.includes('class="matrix-guide-table"')&&pdf.includes("matrix=table.classList.contains('matrix-form-table')"), 'V12-Matrix braucht eine druckoptimierte vollständige Tabellengeometrie');
assert(pdf.includes('qrCommands')&&pdf.includes('doc.qrMatrix'), 'PDF-Ausgabe muss echte QR-Matrix zeichnen');
assert(manifest.includes('KC_DP2_Verfuegbarkeitsformular_V12_VHB_QR_DRUCKRAND_FINAL.docx'), 'Word-Formular fehlt im Release-Manifest');

const context={window:{KCDP:{people:[{personId:'p1',name:'Anne Beispiel',pseudonym:'Einhorn'}],days:[{date:'2026-12-04'}],wishes:[{id:'w1',personId:'p1',date:'2026-12-04',start:14,end:16,wishType:'preferred'}]}}};
vm.runInNewContext(importReview,context);
assert.equal(context.window.KCDP.importReview.resolvePerson('Einhorn').personId,'p1','PC-Manager-Pseudonym muss beim Import zugeordnet werden');
const reviewed=context.window.KCDP.importReview.reviewWishRows([{personName:'Anne Beispiel',date:'2026-12-04',start:14,end:16,wishType:'preferred',fieldConfidence:{start:.6}}]);
assert.equal(reviewed.counts.duplicates,1,'Vorhandene Importduplikate müssen erkannt werden');
assert(reviewed.rows[0].issues.some(x=>x.code==='confidence.start'),'Niedrige Feldsicherheit muss sichtbar geprüft werden');

const formContext={KCDP:{days:[{date:'2026-12-02'},{date:'2026-12-14'}],documentIdentity:{randomCode:()=> 'ABCDEFGHJKLM'},persistAll:async()=>{}}};formContext.window=formContext;
vm.runInNewContext(qrVendor,formContext);
vm.runInNewContext(personalized,formContext);
const samplePerson={personId:'KC-P-001',name:'Anne Beispiel'},profile=formContext.KCDP.personalizedForms.profileFor(samplePerson);
assert.equal(profile.profileId,'HP-ABCDEFGHJKLM','Profil-ID muss stabil an der Person gespeichert werden');
assert(!profile.payload.includes('Anne Beispiel')&&!profile.payload.includes('KC-P-001'),'QR-Nutzdaten dürfen weder Klarname noch Personen-ID enthalten');
const qrMatrix=await formContext.KCDP.personalizedForms.qrFor(profile.payload);
assert(qrMatrix.length>20&&qrMatrix.some(row=>row.some(Boolean)),'Lokaler QR-Generator muss eine echte Modulmatrix erzeugen');
const handwriting=formContext.KCDP.personalizedForms._test.handwritingDoc(samplePerson,profile,qrMatrix);
assert.equal((handwriting.html.match(/class="doc-page"/g)||[]).length,3,'Handschriftprobe muss genau drei PDF-Seiten erzeugen');
assert.equal((handwriting.html.match(/Bereich [1-6]:/g)||[]).length,6,'Handschriftprobe muss sechs getrennte Bereiche enthalten');
for(const label of ['Ziffern 0 bis 9','Gro\u00dfbuchstaben A bis Z','Kleinbuchstaben a bis z','Typische Verwechslungen','DP2-K\u00fcrzel und Begriffe'])assert(handwriting.html.includes(label),`Handschriftbereich fehlt: ${label}`);
assert((handwriting.html.match(/handwriting-section/g)||[]).length>=6,'Jeder Handschriftbereich braucht einen sichtbaren Rahmen');
const matrixForm=formContext.KCDP.personalizedForms._test.matrixDoc(samplePerson,profile,qrMatrix);
assert.equal((matrixForm.html.match(/class="doc-page"/g)||[]).length,2,'Personalisierte V12-Matrix muss aus Formular- und Anleitungsseite bestehen');
for(const field of ['Tag / Bereich','Rahmenzeit','Kann von','Kann bis','Wunsch von','Wunsch bis','Sperrzeit von','Sperrzeit bis','Sperrtag','Nur wenn nötig','V/H/B','Bemerkung','Bereitschaft von'])assert(matrixForm.html.includes(field),`V12-Matrixfeld fehlt: ${field}`);

const ocrContext={window:{KCDP:{}}};ocrContext.window.window=ocrContext.window;vm.runInNewContext(formOcr,ocrContext);const ocr=ocrContext.window.KCDP.formOcr;
assert.equal(ocr.parseTime('11'),11,'OCR muss handschriftliche volle Stunden lesen');assert.equal(ocr.parseTime('14.30'),14.5,'OCR muss Punktzeiten normalisieren');
assert.equal(ocr.resolveProfileId('{"schema":"KCDP-FORM-PROFILE-1","profileId":"HP-ABCDEFGH"}'),'HP-ABCDEFGH','OCR muss personalisierte QR-Profile erkennen');
const ocrWishes=ocr.wishesFromRecord({canStart:13,canEnd:20,wishStart:15,wishEnd:19,blockStart:11,blockEnd:12,zone:'H',fields:{},canConfidence:.9,wishConfidence:.8,blockConfidence:.8},'p1',{date:'2026-12-04',start:11,end:23});
assert.equal(ocrWishes.map(x=>x.wishType).join(','),'unavailable,available,preferred','OCR muss Sperre, Kann und Wunsch getrennt abbilden');assert(ocrWishes.every(x=>x.wishZone==='H'),'OCR muss V/H/B erhalten');

const wishContext={window:{KCDP:{people:[{personId:'p1',name:'Hans',active:true,personType:'member'},{personId:'p2',name:'Marianne',active:true,personType:'member'}],wishes:[{personId:'p1',date:'2026-12-04',start:14,end:16,wishType:'preferred',source:'excel_import',status:'confirmed',updatedAt:'2026-08-25T10:00:00Z'}],wishTypeLabel:x=>x}},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(wishCheck,wishContext);const submission=wishContext.window.KCDP.wishSubmissionCheck.summary();
assert.equal(submission.submitted.length,1,'Eine eingereichte Wunschplanung muss erkannt werden');assert.equal(submission.missing[0].person.name,'Marianne','Person ohne Wunschplanung muss aufgelistet werden');assert.equal(submission.submitted[0].sources[0],'Excel','Eingabeweg Excel muss erhalten bleiben');

const historyK={shifts:[],standby:[],wishes:[],workflow:{},planVersions:[],acknowledgements:[],swapRequests:[],actualShifts:[],actualWorkflow:{},actualPlanVersions:[],actualConfig:{},breakConfig:{},personRules:{},absences:[],replacementRequests:[],notificationInbox:[],notificationPreferences:{},eventConfig:{},daySettings:{},demandMatrix:{},configuration:{restore(){}},refreshWorkflowState(){}};
const historyContext={window:{KCDP:historyK,dispatchEvent(){}},CustomEvent:class{}};vm.runInNewContext(history,historyContext);historyK.historyManager.reset();for(let i=1;i<=45;i++){historyK.wishes=[{i}];historyK.historyManager.record('Änderung '+i)}let undoCount=0;while(historyK.historyManager.undo()){undoCount++}assert.equal(undoCount,40,'Exakt 40 Änderungen müssen rückgängig gemacht werden können');

const pdfContext={window:{KCDP:{}}};vm.runInNewContext(pdf,pdfContext);
const pageStub={querySelector:()=>null,querySelectorAll:()=>[],children:[]},pdfBytes=await pdfContext.window.KCDP.pdfAdapter._test.buildPages([pageStub],{qrMatrix,qrLabel:profile.profileId});
assert.equal(String.fromCharCode(...pdfBytes.slice(0,4)),'%PDF','QR-PDF muss als gültiger PDF-Datenstrom beginnen');

console.log('UI-Vertrags-Smoke-Test OK: kompakte Register, Bedarfseditor, Excel-Ausgabe, Tagesauswahl, Stundenmatrix und Importprüfung');
