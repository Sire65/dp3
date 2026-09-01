(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
function active(x){return x&&x.status!=='deleted'}
function installImportReplacement(){
  if(!K.actual?.importRows||K.actual.__fridaySimulationWrapped)return;
  const original=K.actual.importRows.bind(K.actual);
  K.actual.importRows=function(rows,options={}){
    const prepared=(rows||[]).map(row=>{
      if(row.id)return row;
      const planned=(K.shifts||[]).filter(s=>active(s)&&s.layer==='planned'&&s.personId===row.personId&&s.date===row.date).sort((a,b)=>Math.abs(a.start-row.start)-Math.abs(b.start-row.start))[0];
      const provisional=planned&&(K.actualShifts||[]).find(a=>active(a)&&a.source==='planned_transfer'&&a.personId===row.personId&&(a.plannedShiftId===planned.id||a.linkedShiftId===planned.id));
      return provisional?{...row,id:provisional.id,plannedShiftId:planned.id,linkedShiftId:planned.id}:row;
    });
    return original(prepared,options);
  };
  K.actual.__fridaySimulationWrapped=true;
}
function addButton(){
  installImportReplacement();
  const choose=document.getElementById('actualChooseFile');
  if(!choose||document.getElementById('actualFridaySimulation'))return;
  const button=document.createElement('button');
  button.id='actualFridaySimulation';button.type='button';button.className='secondary';
  button.textContent='🎬 Kassen-Test +1 h';
  button.title='Simuliert für Hans-Joachim eine echte Kassen-CSV mit einer Stunde Mehrarbeit';
  button.onclick=()=>{
    const person=(K.people||[]).find(p=>p.name==='Hans-Joachim Koch');
    const today=K.day?.()?.date;
    const planned=(K.shifts||[]).find(s=>active(s)&&s.layer==='planned'&&s.personId===person?.personId&&s.date===today)||(K.shifts||[]).find(s=>active(s)&&s.layer==='planned'&&s.personId===person?.personId);
    if(!person||!planned)return alert('Zuerst Hans-Joachims Wunsch in den Sollplan und anschließend in den Istplan übernehmen.');
    const time=h=>String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round((h%1)*60)).padStart(2,'0');
    const csv='Mitgliedsnummer;Mitarbeiter;Datum;Kommen;Gehen;Pause\r\n'+[person.memberNo,person.name,planned.date,time(planned.start),time(planned.end+1),'0'].join(';')+'\r\n';
    const file=new File([csv],'KC_Kasse_Freitagstest_Hans-Joachim_plus_1h.csv',{type:'text/csv'});
    const input=document.getElementById('actualFileInput'),transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;
    document.getElementById('modalBackdrop')?.classList.add('hidden');document.body.classList.remove('modal-open');
    input.dispatchEvent(new Event('change',{bubbles:true}));
  };
  choose.after(button);
}
function install(){installImportReplacement();new MutationObserver(addButton).observe(document.body,{childList:true,subtree:true});addButton();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
K.fridayPresentationSimulation={version:'0.20.0-b203',addButton};
})();