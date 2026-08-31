(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=d=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(d.date+'T12:00:00'));
  const kind=d=>d.type==='prep'?'Aufbau':d.type==='after'?'Nachbereitung':'Markttag';
  const visual=d=>{const wd=new Date(d.date+'T12:00:00').getDay();return `${d.type!=='market'?'striped ':''}${wd===0||wd===6?'weekend ':''}`.trim()};
  let pop=null,returnFocus=null;
  function close(){if(!pop)return;pop.remove();pop=null;returnFocus?.focus?.();returnFocus=null}
  function open(anchor,{currentIndex=0,onSelect,title='Tag auswählen'}={}){
    close();
    const days=K.days||[];
    if(!anchor||!days.length)return;
    returnFocus=anchor;
    pop=document.createElement('section');
    pop.className='kc-day-picker';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label',title);
    pop.innerHTML=`<header><b>${esc(title)}</b><button type="button" data-day-close aria-label="Schließen">×</button></header><label class="kc-day-search"><span>Tag suchen</span><input type="search" placeholder="Datum, Wochentag oder Tagesart"></label><div class="kc-day-list">${days.map((d,i)=>{const wd=new Date(d.date+'T12:00:00').getDay(),weekend=wd===0||wd===6;return `<button type="button" data-day-index="${i}" class="${visual(d)}${i===currentIndex?' active':''}" aria-current="${i===currentIndex?'date':'false'}"><b>${esc(label(d))}</b><small>${kind(d)}${weekend?' · Wochenende':''}</small></button>`}).join('')}</div>`;
    document.body.appendChild(pop);
    const rect=anchor.getBoundingClientRect(),width=Math.min(380,Math.max(280,window.innerWidth-20));
    pop.style.width=width+'px';
    pop.style.left=Math.max(10,Math.min(window.innerWidth-width-10,rect.left))+'px';
    pop.style.top=Math.min(window.innerHeight-pop.offsetHeight-10,rect.bottom+5)+'px';
    pop.querySelector('[data-day-close]').onclick=close;
    pop.querySelectorAll('[data-day-index]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.dayIndex);close();onSelect?.(i,days[i])});
    const input=pop.querySelector('input');
    input.oninput=()=>{const q=input.value.trim().toLocaleLowerCase('de');pop.querySelectorAll('[data-day-index]').forEach(b=>b.hidden=q&&!b.textContent.toLocaleLowerCase('de').includes(q))};
    requestAnimationFrame(()=>{pop?.querySelector('.active')?.scrollIntoView({block:'center'});input.focus()});
  }
  document.addEventListener('pointerdown',e=>{if(pop&&!pop.contains(e.target)&&e.target!==returnFocus)close()},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pop){e.preventDefault();close()}},true);
  function installPlanningPicker(){const b=document.getElementById('dateBtn');if(!b||b.dataset.dayPickerBound)return;b.dataset.dayPickerBound='1';b.title='Tag auswählen · Tagesdaten über Einstellungen bearbeiten';b.onclick=()=>open(b,{currentIndex:K.state?.dateIndex||0,onSelect:i=>{K.state.dateIndex=i;K.appRender?.()}})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installPlanningPicker,{once:true});else installPlanningPicker();
  K.dayPicker={version:'0.20.0-b105',open,close,label,kind,visual};
})();
