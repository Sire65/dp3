(function(){
'use strict';
const K=window.KCDP=window.KCDP||{},rules=new WeakMap();let scheduled=false,serial=0;
const self=()=>K.currentUser?.personId;
const active=r=>r&&!['deleted','cancelled','absent','failed','rejected','voided'].includes(r.status);
const inEvent=r=>(K.days||[]).some(d=>d.date===r.date);
const wishes=id=>(K.wishes||[]).filter(r=>r.personId===id&&active(r)&&inEvent(r));
const published=()=> (K.latestPublishedVersion?.()?.shifts||[]).filter(r=>r.personId===self()&&active(r)&&inEvent(r));
const ownData=()=>wishes(self()).length>0||Object.entries(K.memberUxData?.assistantStandby?.[self()]||{}).some(([date,s])=>inEvent({date})&&['yes','no'].includes(s.answer));
const open=()=>K.state?.wishPhase==='open'&&K.workflow?.status!=='published'&&K.auth?.canEditWish?.(self())!==false;
const unrequested=()=>published().filter(s=>!(K.swapRequests||[]).some(r=>r.shiftId===s.id&&r.status==='open'));
function reason(key){
 if(key==='write')return !open()?'Die Wunschphase ist geschlossen.':!(K.days||[]).length?'Noch keine Planungstage angelegt.':'';
 if(key==='own')return ownData()?'':'Noch keine eigenen Angaben gespeichert.';
 if(key==='times')return open()||ownData()?'':'Noch keine eigenen Angaben gespeichert; die Wunschphase ist geschlossen.';
 if(key==='plan')return published().length?'':'Noch keine eigenen Dienste freigegeben.';
 if(key==='change')return !K.auth?.has?.('roster.swap.request')?'Für diesen Zugang sind Änderungsanfragen nicht freigegeben.':!published().length?'Noch keine eigenen Dienste freigegeben.':!unrequested().length?'Für alle Dienste liegt bereits eine Anfrage vor.':'';
 if(key==='actual')return !K.auth?.has?.('roster.actual.view_own')?'Für diesen Zugang sind Istzeiten nicht freigegeben.':(K.actualShifts||[]).some(r=>r.personId===self()&&active(r)&&inEvent(r))?'':'Noch keine eigenen Istzeiten erfasst.';
 if(key==='colleague')return reason('write')||((K.people||[]).some(p=>p.personId!==self()&&p.active!==false&&wishes(p.personId).length)?'':'Noch keine Zeiten von Kollegen vorhanden.');
 if(key==='overview')return (K.people||[]).some(p=>p.active!==false&&(p.personId===self()||K.mobileWishMatrix?.colleagueCopyAllowed?.(p.personId))&&(wishes(p.personId).length||(K.shifts||[]).some(r=>r.personId===p.personId&&active(r)&&inEvent(r))))?'':'Noch keine sichtbaren Zeiten vorhanden.';
 if(key==='account')return ownData()||published().length||(K.actualShifts||[]).some(r=>r.personId===self()&&active(r)&&inEvent(r))?'':'Noch keine eigenen Zeiten für den Kontoauszug vorhanden.';
 return '';
}
function set(button,message){
 if(!button)return;
 let hint=button.querySelector(':scope > .member-button-reason');
 if(message){
  button.disabled=true;button.dataset.memberDisabled='true';button.setAttribute('aria-disabled','true');button.title=message;
  if(!hint){hint=document.createElement('small');hint.className='member-button-reason';hint.id='member-reason-'+(++serial);button.append(hint);button.setAttribute('aria-describedby',hint.id);}
  if(hint.textContent!==message)hint.textContent=message;
 }else if(button.dataset.memberDisabled){button.disabled=false;delete button.dataset.memberDisabled;button.removeAttribute('aria-disabled');button.removeAttribute('aria-describedby');button.removeAttribute('title');hint?.remove();}
}
function bind(button,check){if(button){rules.set(button,check);set(button,check());}}
function refresh(){
 const root=document.getElementById('kcdpUxRoot');if(!root)return;
 const next=root.querySelector('#twNext');
 if(next){
  const task=root.querySelector('[data-tw-task]'),mode=root.querySelector('[data-tw-mode]');
  if(task||mode){const selector=task?'[data-tw-task][aria-pressed="true"]':'[data-tw-mode][aria-pressed="true"]';set(next,root.querySelector(selector)?'':task?'Bitte zuerst eine Aufgabe wählen.':'Bitte mit oder ohne Twinkey wählen.');}
 }
 const map={'[data-tw-task="wish"]':'write','[data-tw-task="plan"],#uxMyPlan':'plan','[data-tw-task="change"],#twAnother':'change','[data-tw-task="actual"]':'actual','[data-tw-entry="manual"],[data-tw-entry="excel"],[data-tw-entry="photo"],#uxAssistant,#uxManual,#uxExcel,#uxPhoto':'write','[data-tw-entry="colleague"],#uxColleague':'colleague','[data-tw-entry="overview"]':'overview','#uxOwnList,#waSummary,#waOverview':'own','#uxStartTimes':'times','#twDocAccount':'account'};
 for(const [selector,key] of Object.entries(map))root.querySelectorAll(selector).forEach(b=>set(b,reason(key)));
 if(K.currentUser?.role==='employee')root.querySelectorAll('[data-nav="plan"]').forEach(b=>set(b,reason('plan')));
 root.querySelectorAll('button').forEach(b=>{const check=rules.get(b);if(check)set(b,check());});
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;refresh();});}
function install(){
 const root=document.getElementById('kcdpUxRoot');if(!root)return;
 const style=document.createElement('style');style.textContent='#kcdpUxRoot button:disabled{background:#eeece9!important;color:#696762!important;border-color:#d2d0cc!important;box-shadow:none!important;animation:none!important;cursor:not-allowed} .member-button-reason{display:block;font-size:13px;line-height:1.4;font-weight:400;margin-top:5px;white-space:normal} .ux-bottomnav .member-button-reason{display:none}';document.head.append(style);
 new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
 root.addEventListener('input',schedule);root.addEventListener('change',schedule);
 root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;refresh();if(b.disabled){e.preventDefault();e.stopImmediatePropagation();}},true);
 K.sync?.on?.(schedule);schedule();
}
K.memberButtons={reason,set,bind,schedule,refresh,wishes,published,ownData,open,unrequested};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
