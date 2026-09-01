(function(){
  const K=window.KCDP=window.KCDP||{};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const state=new WeakMap();
  function nativeCore(){return window.TableCore||window.MasterTableCore||window.Framework?.TableCore||null}
  function fallback(host,opts){
    const s={rows:opts.rows||[],selected:new Set(),sort:opts.initialSort||null,dir:opts.initialDir===-1?-1:1,query:''};state.set(host,s);
    const cols=opts.columns||[],selectable=opts.selectable!==false,placeholder=opts.filterPlaceholder||'Filtern …';
    function view(){let rows=s.rows.filter(r=>!s.query||JSON.stringify(r).toLowerCase().includes(s.query));if(s.sort)rows=[...rows].sort((a,b)=>String(a[s.sort]??'').localeCompare(String(b[s.sort]??''),'de',{numeric:true})*s.dir);return rows}
    function countText(n){return typeof opts.countLabel==='function'?opts.countLabel(n):(opts.countLabel?`${n} ${opts.countLabel}`:`${n} Einträge`)}
    function render(){
      const rows=view();
      host.innerHTML=`<div class="kc-tc-toolbar"><input data-tc-filter placeholder="${esc(placeholder)}" value="${esc(s.query)}"><span>${esc(countText(rows.length))}</span></div><div class="kc-tc-scroll"><table class="tc ${esc(opts.tableClass||'kc-diagnostics-table')}"><thead><tr>${selectable?'<th><input type="checkbox" data-tc-all aria-label="Alle auswählen"></th>':''}${cols.map(c=>`<th data-tc-sort="${esc(c.key)}">${esc(c.label)} ↕</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr data-tc-id="${esc(r.id)}">${selectable?`<td><input type="checkbox" data-tc-select="${esc(r.id)}" ${s.selected.has(String(r.id))?'checked':''} aria-label="Zeile auswählen"></td>`:''}${cols.map(c=>`<td>${c.render?c.render(r,esc):esc(r[c.key]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      const filter=host.querySelector('[data-tc-filter]');if(filter)filter.oninput=e=>{s.query=e.target.value.toLowerCase();render()};
      host.querySelectorAll('[data-tc-sort]').forEach(h=>h.onclick=()=>{const k=h.dataset.tcSort;s.dir=s.sort===k?-s.dir:1;s.sort=k;render()});
      if(selectable){
        host.querySelectorAll('[data-tc-select]').forEach(x=>x.onchange=()=>{x.checked?s.selected.add(x.dataset.tcSelect):s.selected.delete(x.dataset.tcSelect);opts.onSelection?.([...s.selected])});
        const all=host.querySelector('[data-tc-all]');if(all)all.onchange=()=>{rows.forEach(r=>all.checked?s.selected.add(String(r.id)):s.selected.delete(String(r.id)));render();opts.onSelection?.([...s.selected])};
      }
      opts.afterRender?.(host,rows)
    }
    render();return{replace(rows){s.rows=rows||[];render()},selection(){return[...s.selected]},clearSelection(){s.selected.clear();render()},snapshot(){return{rows:s.rows.length,visible:view().length,selected:s.selected.size,sort:s.sort}}}
  }
  function create(host,opts){const core=nativeCore();if(core?.create){try{return core.create(host,opts)}catch(e){console.warn('TableCore adapter: Master-Core fallback',e)}}return fallback(host,opts)}
  const enhanced=new WeakMap(),collator=new Intl.Collator('de',{numeric:true,sensitivity:'base'});
  function enhance(table,opts={}){
    if(!table?.tHead?.rows?.[0]||!table.tBodies?.[0]||enhanced.has(table))return enhanced.get(table)||null;
    const headers=[...table.tHead.rows[0].cells];if(headers.length<2||headers.some(h=>Number(h.colSpan||1)>1||Number(h.rowSpan||1)>1))return null;
    const body=table.tBodies[0],rows=[...body.rows],normalRows=rows.filter(r=>r.cells.length>1&&!r.cells[0]?.hasAttribute('colspan'));
    normalRows.forEach((r,i)=>r.dataset.tcOriginal=String(i));
    const s={query:'',sort:-1,dir:1,rows:normalRows};enhanced.set(table,s);table.dataset.tablecoreEnhanced='1';
    const toolbar=document.createElement('div');toolbar.className='kc-tc-inline-toolbar';toolbar.innerHTML=`<label><span class="sr-only">Tabelle filtern</span><input type="search" data-tc-inline-filter placeholder="${esc(opts.filterPlaceholder||'Tabelle filtern …')}" aria-label="Tabelle filtern"></label><span data-tc-inline-count></span>`;
    table.before(toolbar);const input=toolbar.querySelector('input'),count=toolbar.querySelector('[data-tc-inline-count]');
    const value=(row,index)=>String(row.cells[index]?.dataset.sortValue||row.cells[index]?.innerText||'').trim();
    const compare=(a,b)=>{const av=value(a,s.sort),bv=value(b,s.sort),clean=x=>x.replace(/\s*(h|std\.?|%|min\.?)$/i,'').replace(/\./g,'').replace(',','.').trim(),an=Number(clean(av)),bn=Number(clean(bv));return(Number.isFinite(an)&&Number.isFinite(bn)?an-bn:collator.compare(av,bv))*s.dir};
    const apply=()=>{const q=s.query.toLocaleLowerCase('de'),ordered=s.sort<0?[...s.rows].sort((a,b)=>Number(a.dataset.tcOriginal)-Number(b.dataset.tcOriginal)):[...s.rows].sort(compare);ordered.forEach(r=>body.append(r));let shown=0;s.rows.forEach(r=>{const visible=!q||r.innerText.toLocaleLowerCase('de').includes(q);r.hidden=!visible;if(visible)shown++});count.textContent=`${shown} von ${s.rows.length}`;headers.forEach((h,i)=>{h.setAttribute('aria-sort',s.sort===i?(s.dir>0?'ascending':'descending'):'none');const mark=h.querySelector('.kc-tc-sort-mark');if(mark)mark.textContent=s.sort===i?(s.dir>0?'▲':'▼'):'↕'})};
    headers.forEach((h,i)=>{h.classList.add('kc-tc-sortable');h.tabIndex=0;h.title=(h.title?h.title+' · ':'')+'Sortieren';const mark=document.createElement('span');mark.className='kc-tc-sort-mark';mark.textContent='↕';mark.setAttribute('aria-hidden','true');h.append(mark);const sort=()=>{s.dir=s.sort===i?-s.dir:1;s.sort=i;apply()};h.addEventListener('click',e=>{if(!e.target.closest('input,button,select'))sort()});h.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();sort()}})});
    input.addEventListener('input',()=>{s.query=input.value.trim();apply()});apply();return{filter:q=>{input.value=q||'';input.dispatchEvent(new Event('input'))},sort:(i,dir=1)=>{s.sort=Number(i);s.dir=dir<0?-1:1;apply()},snapshot:()=>({rows:s.rows.length,visible:s.rows.filter(r=>!r.hidden).length,sort:s.sort,dir:s.dir})}
  }
  const excluded='table.tc,table.hm-table,table.hm-radar-table,table.occ-summary,table.demand-table,table.photo-table,table.matrix,table.roster-grid,table.handwriting-table';
  function eligible(table){return !table.closest('#printRoot')&&!table.matches(excluded)&&!table.closest('.kc-tc-scroll')&&!table.querySelector('input,select,textarea')&&table.tHead?.rows?.length===1&&table.tBodies?.[0]?.rows?.length>1}
  let pending=false;function enhanceAll(){pending=false;document.querySelectorAll('table').forEach(t=>{if(eligible(t))enhance(t,{filterPlaceholder:t.closest('#hmPersonHours')?'Mitarbeiter oder Stunden filtern …':'Tabelle filtern …'})})}function scheduleEnhance(){if(!pending){pending=true;requestAnimationFrame(enhanceAll)}}
  new MutationObserver(scheduleEnhance).observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleEnhance,{once:true});else scheduleEnhance();
  K.tableCore={version:'adapter-1.3',masterApi:'1.1',create,enhance,enhanceAll,nativeCore};
})();
