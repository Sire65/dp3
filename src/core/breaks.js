(function(){
  const K=window.KCDP;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const defaults={
    enabled:true,
    profile:'KC_STANDARD',
    thresholds:[
      {overHours:6,requiredMinutes:30},
      {overHours:9,requiredMinutes:45}
    ],
    minSegmentMinutes:15,
    maxContinuousHours:6,
    coverageImpact:true,
    hoursAccounting:'included',
    autoSuggest:true,
    enforcement:'warning'
  };
  K.breakConfig={...defaults,...(K.breakConfig||{}),thresholds:clone(K.breakConfig?.thresholds||defaults.thresholds)};

  function config(){return K.breakConfig;}
  function grossHours(s){return Math.max(0,Number(s?.end||0)-Number(s?.start||0));}
  function requiredMinutes(s){
    if(!K.breakConfig.enabled)return 0;
    const h=grossHours(s);let min=0;
    for(const r of [...(K.breakConfig.thresholds||[])].sort((a,b)=>Number(a.overHours)-Number(b.overHours))){
      if(h>Number(r.overHours))min=Math.max(min,Number(r.requiredMinutes)||0);
    }
    return min;
  }
  function segments(s){
    return Array.isArray(s?.breakSegments)?s.breakSegments.filter(x=>Number.isFinite(Number(x.start))&&Number.isFinite(Number(x.end))&&Number(x.end)>Number(x.start)).map(x=>({start:Number(x.start),end:Number(x.end)})):[];
  }
  function segmentMinutes(s){return Math.round(segments(s).reduce((n,x)=>n+(x.end-x.start)*60,0));}
  function plannedMinutes(s){
    const seg=segmentMinutes(s);return seg>0?seg:Math.max(0,Number(s?.breakMinutes||0));
  }
  function countedHours(s){
    const gross=grossHours(s);
    if(K.breakConfig.hoursAccounting!=='deducted')return gross;
    return Math.max(0,gross-plannedMinutes(s)/60);
  }
  function netHours(s){return countedHours(s);}
  function accountingLabel(){return K.breakConfig.hoursAccounting==='deducted'?'Pause wird von Arbeitszeit abgezogen':'Pause ist in Arbeitszeit enthalten';}
  function isOnBreak(s,time){
    if(!K.breakConfig.enabled||!K.breakConfig.coverageImpact)return false;
    return segments(s).some(x=>x.start<=time&&x.end>time);
  }
  function maxContinuousMinutes(s){
    const seg=segments(s).slice().sort((a,b)=>a.start-b.start);if(!seg.length)return grossHours(s)*60;
    let last=Number(s.start),max=0;
    for(const b of seg){max=Math.max(max,(Math.max(last,b.start)-last)*60);last=Math.max(last,b.end);}
    max=Math.max(max,(Number(s.end)-last)*60);return Math.max(0,Math.round(max));
  }
  function compliance(s){
    const required=requiredMinutes(s),planned=plannedMinutes(s),missing=Math.max(0,required-planned),seg=segments(s),issues=[];
    if(!K.breakConfig.enabled)return {enabled:false,requiredMinutes:0,plannedMinutes:planned,missingMinutes:0,segments:seg,issues:[],compliant:true};
    if(missing>0)issues.push({level:K.breakConfig.enforcement==='error'?'error':'warn',code:'break_missing',text:`Pausenregel: ${required} Min. erforderlich, ${planned} Min. geplant (${missing} Min. fehlen).`});
    const minSeg=Number(K.breakConfig.minSegmentMinutes||0);
    for(const b of seg){
      const m=Math.round((b.end-b.start)*60);
      if(b.start<Number(s.start)||b.end>Number(s.end))issues.push({level:'error',code:'break_outside_shift',text:'Geplante Pause liegt teilweise außerhalb des Dienstes.'});
      if(minSeg&&m<minSeg)issues.push({level:K.breakConfig.enforcement==='error'?'error':'warn',code:'break_segment_short',text:`Pausenabschnitt ist kürzer als ${minSeg} Min.`});
    }
    if(planned>0&&!seg.length&&K.breakConfig.coverageImpact)issues.push({level:'warn',code:'break_without_time',text:'Pausendauer ist eingetragen, aber noch ohne genaue Pausenzeit; die Besetzungsmatrix kann sie daher nicht zeitgenau abziehen.'});
    const maxAllowed=Math.round(Number(K.breakConfig.maxContinuousHours||0)*60),continuous=maxContinuousMinutes(s);
    if(maxAllowed>0&&grossHours(s)*60>maxAllowed&&continuous>maxAllowed)issues.push({level:K.breakConfig.enforcement==='error'?'error':'warn',code:'break_continuous',text:`Mehr als ${K.breakConfig.maxContinuousHours} Std. ohne zeitlich eingeplante Pause.`});
    return {enabled:true,requiredMinutes:required,plannedMinutes:planned,missingMinutes:missing,segments:seg,maxContinuousMinutes:continuous,issues,compliant:!issues.some(i=>i.level==='error'||i.code==='break_missing'||i.code==='break_continuous')};
  }
  function snap(v,mins=15){const step=mins/60;return Math.round(v/step)*step;}
  function suggestSegments(s){
    const need=requiredMinutes(s);if(!need)return [];
    const min=Number(K.breakConfig.minSegmentMinutes||15),length=Math.max(need,min)/60;
    let start=snap(Number(s.start)+Math.max(min/60,Math.min(Number(K.breakConfig.maxContinuousHours||6)-.25,grossHours(s)/2-length/2)),min);
    start=Math.max(Number(s.start)+min/60,Math.min(start,Number(s.end)-length));
    return [{start:Number(start.toFixed(4)),end:Number((start+length).toFixed(4))}];
  }
  function applySuggested(s){
    if(!K.breakConfig.enabled||!K.breakConfig.autoSuggest)return s;
    const required=requiredMinutes(s);if(!required)return {...s,breakMinutes:Number(s.breakMinutes||0),breakSegments:Array.isArray(s.breakSegments)?s.breakSegments:[]};
    if(plannedMinutes(s)>=required&&segments(s).length)return s;
    const suggested=suggestSegments(s);return {...s,breakMinutes:required,breakSegments:suggested,breakAutoSuggested:true};
  }

  function normalizeForDuration(s){
    const out=clone(s||{}),required=requiredMinutes(out);
    if(!out.breakAutoSuggested)return out;
    if(!required){out.breakMinutes=0;out.breakSegments=[];out.breakAutoSuggested=false;return out;}
    if(plannedMinutes(out)!==required){out.breakMinutes=required;out.breakSegments=suggestSegments(out);}
    return out;
  }
  function setEnabled(value,{reason='Pausenprüfung umgestellt'}={}){
    K.auth?.require?.('roster.breaks.edit','Sie dürfen die Pausenprüfung nicht ändern.');
    const before=clone(K.breakConfig);K.breakConfig.enabled=!!value;
    K.recordAudit?.('breaks.enabled.changed',{entity:'break_config',entityId:'global',before,after:K.breakConfig,reason});
    K.sync?.enqueue?.({entity:'break_config',operation:'update',payload:K.breakConfig,baseVersion:null});
    return K.breakConfig.enabled;
  }
  function updateConfig(patch,{reason='Pausenregeln geändert'}={}){
    K.auth?.require?.('roster.breaks.edit','Sie dürfen die Pausenregeln nicht ändern.');
    const next={...K.breakConfig,...clone(patch||{})};
    const t=[...(next.thresholds||[])].sort((a,b)=>Number(a.overHours)-Number(b.overHours));
    if(t.some(x=>Number(x.overHours)<0||Number(x.requiredMinutes)<0))throw new Error('Pausenschwellen dürfen nicht negativ sein.');
    if(Number(next.minSegmentMinutes)<0||Number(next.maxContinuousHours)<=0)throw new Error('Pausenblock und maximale Arbeitsdauer müssen plausibel sein.');
    if(!['warning','error'].includes(next.enforcement))throw new Error('Ungültige Prüfart.');
    if(!['included','deducted'].includes(next.hoursAccounting))throw new Error('Ungültige Stundenberechnung für Pausen.');
    const before=clone(K.breakConfig);K.breakConfig={...next,thresholds:t};
    K.recordAudit?.('breaks.rules.changed',{entity:'break_config',entityId:'global',before,after:K.breakConfig,reason});
    K.sync?.enqueue?.({entity:'break_config',operation:'update',payload:K.breakConfig,baseVersion:null});
    return clone(K.breakConfig);
  }
  function applyArbzgPreset(){return updateConfig({profile:'ARBZG_4',thresholds:[{overHours:6,requiredMinutes:30},{overHours:9,requiredMinutes:45}],minSegmentMinutes:15,maxContinuousHours:6},{reason:'Preset ArbZG §4 übernommen'});}

  // Fachintegration: vorhandene Validierung bleibt erhalten und wird nur ergänzt.
  const baseValidate=K.validateShift;
  K.validateShift=function(candidate){const out=baseValidate(candidate);if(K.breakConfig.enabled)for(const i of compliance(candidate).issues)if(!out.some(x=>x.code===i.code&&x.text===i.text))out.push(i);return out;};

  // Exakte Pausenintervalle reduzieren die reale Standdeckung, ohne den Dienst zu löschen.
  const baseCoverage=K.coverageAt;
  K.coverageAt=function(day,time,override=null){
    const c=baseCoverage(day,time,override);if(!K.breakConfig.enabled||!K.breakConfig.coverageImpact)return {...c,onBreak:[]};
    const onBreak=[...(c.active||[]),...(c.specialActive||[])].filter(s=>isOnBreak(s,time));
    const active=(c.active||[]).filter(s=>!isOnBreak(s,time)),specialActive=(c.specialActive||[]).filter(s=>!isOnBreak(s,time));
    return {...c,total:active.length,front:active.filter(s=>s.zone==='front').length,back:active.filter(s=>s.zone==='back').length,special:specialActive.length,active,specialActive,onBreak};
  };

  // KI-Vorschläge erhalten bei aktivierter Automatik direkt eine konkrete Pause.
  if(K.aiProposal){const baseAi=K.aiProposal;K.aiProposal=function(day){return baseAi(day).map(s=>applySuggested(s));};}

  K.breaks={version:'0.11.3',defaults:clone(defaults),config,requiredMinutes,plannedMinutes,countedHours,netHours,segments,isOnBreak,compliance,suggestSegments,applySuggested,normalizeForDuration,setEnabled,updateConfig,applyArbzgPreset,maxContinuousMinutes,accountingLabel};
})();
