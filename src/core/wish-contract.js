(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const VERSION='KC_DP3_WISH_V1';
  const TYPES={available:{label:'Verfügbar',intent:'availability'},preferred:{label:'Bevorzugt',intent:'preference'},if_needed:{label:'Nur wenn nötig',intent:'reserve'},unavailable:{label:'Nicht verfügbar',intent:'block'}};
  const dayFor=date=>(K.days||[]).find(d=>d.date===date)||null;
  function inferScope(row){const day=dayFor(row.date);return row.wishType==='unavailable'&&day&&Number(row.start)<=Number(day.start)&&Number(row.end)>=Number(day.end)?'day':'time'}
  function normalize(input={},meta={}){
    const type=String(input.wishType||'available'),day=dayFor(input.date),scope=input.scope==='day'||input.blockScope==='day'?'day':inferScope({...input,wishType:type});
    const start=scope==='day'&&day?Number(day.start):Number(input.start),end=scope==='day'&&day?Number(day.end):Number(input.end);
    return {...input,date:String(input.date||''),start,end,wishType:type,wishIntent:TYPES[type]?.intent||'unknown',scope,contract:VERSION,wishZone:String(input.wishZone||'B').toUpperCase(),source:String(input.source||meta.source||'direct'),status:String(input.status||'confirmed'),comment:String(input.comment||''),updatedAt:new Date().toISOString()};
  }
  function validate(input={}){const row=normalize(input),issues=[],day=dayFor(row.date);if(!TYPES[row.wishType])issues.push({level:'error',code:'wish.type',text:'Unbekannter Wunschstatus.'});if(!day)issues.push({level:'error',code:'wish.date',text:'Datum gehört nicht zum aktuellen Planzeitraum.'});if(!Number.isFinite(row.start)||!Number.isFinite(row.end)||row.end<=row.start)issues.push({level:'error',code:'wish.time',text:'Ende muss nach Beginn liegen.'});if(!['V','H','B'].includes(row.wishZone))issues.push({level:'error',code:'wish.zone',text:'Einsatzbereich muss V, H oder B sein.'});if(row.scope==='day'&&row.wishType!=='unavailable')issues.push({level:'error',code:'wish.scope',text:'Ein vollständiger Sperrtag muss „Nicht verfügbar“ sein.'});return issues}
  function label(rowOrType){const row=typeof rowOrType==='string'?{wishType:rowOrType}:rowOrType||{},base=TYPES[row.wishType]?.label||String(row.wishType||'');if(row.wishType==='unavailable')return (row.scope||inferScope(row))==='day'?'Sperrtag':'Sperrzeit';return base}
  function migrate(rows=K.wishes||[]){let changed=0;for(let i=0;i<rows.length;i++){if(rows[i]?.contract===VERSION)continue;rows[i]=normalize(rows[i],{source:rows[i]?.source||'legacy'});changed++;}return{changed,total:rows.length,contract:VERSION}}
  K.wishContract={version:VERSION,types:TYPES,normalize,validate,label,inferScope,migrate};
  K.wishContract.lastMigration=migrate();
})();
