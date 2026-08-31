(function(){
'use strict';
var K=window.KCDP=window.KCDP||{},menu=null,anchor=null;
var META={
 wish:{label:'Wunschplan',hint:'Wünsche und Verfügbarkeiten',color:'#7554a3',actions:[['Lücken finden','matrix'],['Wunsch erfassen','#addShiftBtn'],['Planfoto einlesen','#photoBtn']]},
 planned:{label:'Sollplan',hint:'Dienste planen und veröffentlichen',color:'#2f66a5',actions:[['Plan prüfen','#checkBtn'],['Dienst einplanen','#quickPlanBtn'],['Veröffentlichen','#publishBtn']]},
 actual:{label:'Istplan',hint:'Istzeiten und Abweichungen',color:'#3d7a63',actions:[['Istzeiten importieren','#actualImportBtn'],['Abweichungen','deviations'],['Sollplan vergleichen','planned']]},
 fairness:{label:'Fairnis',hint:'Stunden und Dienstarten vergleichen',color:'#8f1726',actions:[['Auffälligkeiten sortieren','fair-sort'],['Erklärung anzeigen','#fairInfo'],['CSV herunterladen','#fairCsv']]},
 dashboard:{label:'Dashboard',hint:'Kennzahlen und Systemstatus',color:'#8b5d20',actions:[['Zum Sollplan','planned'],['Zur Stundenmatrix','matrix']]},
 demand:{label:'Bedarf',hint:'Besetzungsmatrix und Einflussfaktoren',color:'#b27316',actions:[['Zur Stundenmatrix','matrix'],['Zum Sollplan','planned']]},
 matrix:{label:'Stundenmatrix',hint:'Besetzung je Stunde prüfen',color:'#b27316',actions:[['Besetzungsradar','#occupancyRadarRun'],['Zum Sollplan','planned'],['Fairnis ansehen','fairness']]},
 deviations:{label:'Abweichungen',hint:'Wunsch, Soll und Ist vergleichen',color:'#a14a58',actions:[['Zum Istplan','actual'],['Fairnis ansehen','fairness']]}
};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function current(){return document.body.dataset.v020Register||'planned'}
function count(list,test){return(list||[]).filter(test||function(){return true}).length}
function status(id){
 var active=function(x){return !['deleted','cancelled','failed'].includes(String((x&&x.status)||''))},w=count(K.wishes,active),p=count(K.shifts,function(x){return x.layer==='planned'&&active(x)}),a=count(K.actualShifts,active);
 if(id==='wish')return w+' Wünsche/Verfügbarkeiten · '+p+' geplante Dienste';
 if(id==='planned')return p+' geplante Dienste · '+(K.workflow&&K.workflow.state&&K.workflow.state.status==='published'?'veröffentlicht':'Entwurf');
 if(id==='actual')return a+' erfasste Istzeiten · '+Math.max(0,p-a)+' noch ohne Istwert';
 if(id==='fairness'){var rows=K.fairnessView&&K.fairnessView.rows?K.fairnessView.rows().rows:[];var low=rows.filter(function(x){return x.delta<-1}).length;return rows.length+' Personen · '+low+' unter Vergleich';}
 if(id==='matrix'){var critical=(K.days||[]).reduce(function(n,d){var e=K.evaluateDay&&K.evaluateDay(d);return n+(e?Number(e.critical||0):0)},0);return critical+' kritische Besetzungsintervalle';}
 return 'Aktueller Datenstand · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+' Uhr';
}
function close(){if(menu){menu.remove();menu=null}if(anchor)anchor.setAttribute('aria-expanded','false')}
function select(id){close();if(K.v020Shell&&K.v020Shell.select)K.v020Shell.select(id)}
function act(target){
 if(target==='fair-sort'){var s=document.getElementById('fairSort');if(s){s.value='status';s.dispatchEvent(new Event('change',{bubbles:true}))}close();return}
 if(target.charAt(0)==='#'){var el=document.querySelector(target);close();if(el){el.click();el.focus()}return}
 select(target);
}
function open(){
 close();var id=current(),meta=META[id]||META.planned,r=anchor.getBoundingClientRect();
 menu=document.createElement('section');menu.className='v020-context-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Menü '+meta.label);
 var nav=['wish','planned','actual','fairness'].map(function(key){var m=META[key];return'<button type="button" class="v020-context-nav '+(key===id?'active':'')+'" data-select="'+key+'" style="--view-color:'+m.color+'"><i></i><span><b>'+m.label+'</b><small>'+m.hint+'</small></span>'+(key===id?'<em>Aktiv</em>':'')+'</button>'}).join('');
 var actions=(meta.actions||[]).map(function(item){return'<button type="button" class="v020-context-action" data-action="'+esc(item[1])+'"><span>'+esc(item[0])+'</span><b>›</b></button>'}).join('');
 menu.innerHTML='<header style="--view-color:'+meta.color+'"><span class="v020-context-large-dot"></span><div><b>'+meta.label+'</b><small>'+meta.hint+'</small></div><button type="button" class="v020-context-close" aria-label="Menü schließen">×</button></header><div class="v020-context-status"><b>Aktueller Stand</b><span>'+esc(status(id))+'</span></div><div class="v020-context-section"><b>Schnell wechseln</b>'+nav+'</div><div class="v020-context-section"><b>Wichtige Funktionen</b>'+actions+'</div><footer>Das Menü schließt mit Esc oder Klick außerhalb.</footer>';
 document.body.appendChild(menu);
 var left=Math.min(Math.max(6,r.left),window.innerWidth-menu.offsetWidth-8),top=Math.min(r.bottom+5,window.innerHeight-menu.offsetHeight-8);menu.style.left=left+'px';menu.style.top=Math.max(6,top)+'px';anchor.setAttribute('aria-expanded','true');
 menu.querySelector('.v020-context-close').onclick=close;menu.querySelectorAll('[data-select]').forEach(function(b){b.onclick=function(){select(b.dataset.select)}});menu.querySelectorAll('[data-action]').forEach(function(b){b.onclick=function(){act(b.dataset.action)}});menu.querySelector('button').focus();
}
function install(){
 anchor=document.querySelector('.v020-ribbon-context');if(!anchor||anchor.dataset.contextMenuInstalled)return;anchor.dataset.contextMenuInstalled='true';anchor.setAttribute('role','button');anchor.setAttribute('tabindex','0');anchor.setAttribute('aria-haspopup','dialog');anchor.setAttribute('aria-expanded','false');anchor.title='Ansichtsmenü öffnen';
 anchor.addEventListener('click',function(e){e.stopPropagation();menu?close():open()});anchor.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();menu?close():open()}});
 document.addEventListener('click',function(e){if(menu&&!menu.contains(e.target)&&!anchor.contains(e.target))close()});document.addEventListener('keydown',function(e){if(e.key==='Escape'&&menu){close();anchor.focus()}});
 window.addEventListener('kc-v020-register-change',close);window.addEventListener('resize',close);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,0)},{once:true});else setTimeout(install,0);
K.registerContextMenu={version:'0.20.0-b186',open:open,close:close};
})();