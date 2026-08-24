(function(){
 const K=window.KCDP=window.KCDP||{};
 function checks(){const market=K.days.filter(d=>d.type==='market'),q=K.intelligence?.quality?.(),openConf=K.sync?.openConflicts?.()||0;return [
  {id:'modal',label:'Dialogsystem',ok:typeof window.__KCDPModalWired==='boolean'?window.__KCDPModalWired:true,level:'hard'},
  {id:'storage',label:'Verschlüsselter Speicher entsperrt',ok:!!K.storage?.unlocked,level:'hard'},
  {id:'identity',label:'personId eindeutig',ok:new Set(K.people.map(p=>p.personId)).size===K.people.length,level:'hard'},
  {id:'closing',label:'Markt-Schließzeiten vollständig gepflegt',ok:market.every(d=>d.close!=null),level:'hard'},
  {id:'syncConflict',label:'Keine offenen Sync-Konflikte',ok:openConf===0,level:'hard'},
  {id:'published',label:'Sollplan veröffentlicht',ok:!!K.latestPublishedVersion?.(),level:'operational'},
  {id:'providerPeople',label:'PC-Manager/KC-Verwaltung Provider',ok:!!K.personAdapter?.hasProvider?.(),level:'integration'},
  {id:'providerSync',label:'KC Sync/Supabase Provider',ok:!!K.sync?.hasProvider?.(),level:'integration'},
  {id:'providerMail',label:'E-Mail Provider',ok:!!K.emailAdapter?.hasProvider?.(),level:'integration'},
  {id:'providerPush',label:'Push Server Provider',ok:!!K.pushAdapter?.state?.provider,level:'integration'},
  {id:'context',label:'Wetter-/Programmprovider',ok:!!K.contextProviders?.hasWeather?.()&&!!K.contextProviders?.hasProgram?.(),level:'integration'},
  {id:'quality',label:'Planqualität >= 75%',ok:(q?.score||0)>=75,level:'operational'}
 ];}
 function summary(){const c=checks(),hard=c.filter(x=>x.level==='hard'&&!x.ok),open=c.filter(x=>!x.ok);return {version:K.VERSION,at:new Date().toISOString(),checks:c,hardFailures:hard.length,open:open.length,decision:hard.length?'RED':open.length?'YELLOW':'GREEN'};}
 function perf(iterations=250){const d=K.days.find(x=>x.type==='market'),start=performance.now();for(let i=0;i<iterations;i++)K.evaluateDay(d);const ms=performance.now()-start;return {iterations,ms,perIteration:ms/iterations};}
 K.release={version:'0.15.0',checks,summary,perf};
})();
