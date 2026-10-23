(function(){
  const K=window.KCDP=window.KCDP||{};
  function startup(){
    if(!K.cloudPrimary?.enabled?.())return;
    const s=K.cloudPrimary.state;
    if(!['migration','join','blocked','conflict'].includes(s.status))return;
    document.getElementById('cloudPrimaryGate')?.remove();
    const shade=document.createElement('div');shade.id='cloudPrimaryGate';shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-labelledby','cloudPrimaryTitle');
    shade.style.cssText='position:fixed;inset:0;z-index:999999;background:#0008;display:grid;place-items:center;padding:16px';
    const panel=document.createElement('section');panel.style.cssText='background:white;color:#222;border-radius:16px;padding:24px;max-width:650px;max-height:90vh;overflow:auto;width:100%;box-sizing:border-box';shade.append(panel);
    const title=document.createElement('h2');title.id='cloudPrimaryTitle';title.textContent=s.status==='migration'?'Supabase als Hauptdatenbank vorbereiten':'Zentrales Speichern benötigt Prüfung';panel.append(title);
    const p=document.createElement('p');p.textContent=s.status==='migration'?'Der bisherige PC-Bestand bleibt erhalten. Vor dem Wechsel muss ein Ausgangsstand geprüft werden. Es wird nichts automatisch überschrieben.':s.error||'Der Serverstand konnte nicht sicher geladen werden. Die Planung bleibt zum Schutz deiner Daten gesperrt.';panel.append(p);
    if(s.status==='migration'){
      const summary=document.createElement('p');summary.textContent=`Vorhanden: ${(K.wishes||[]).filter(x=>x.status!=='deleted').length} Wunschangaben, ${(K.shifts||[]).filter(x=>x.status!=='deleted').length} Dienste.`;panel.append(summary);
      const ul=document.createElement('ul');for(const [date,rows] of Object.entries(K.demandMatrix||{})){const li=document.createElement('li');li.textContent=date+': '+rows.reduce((n,r)=>n+(r.end-r.start)*r.total,0)+' Bedarfsstunden';ul.append(li);}panel.append(ul);
      const conflicts=(K.syncConflicts||[]).filter(x=>x.status==='open');
      const warning=document.createElement('p');warning.textContent=conflicts.length?`${conflicts.length} offene PC-/Server-Abweichungen. Der Ausgangsstand darf erst nach deren Entscheidung übertragen werden.`:'Keine offenen Synchronisationskonflikte im geladenen PC-Bestand.';panel.append(warning);
      const groups=new Map();for(const c of conflicts){const id=c.entityId||c.local?.date||c.local?.id||c.remote?.date||c.remote?.id;const group=c.entity+':'+id;if(!groups.has(group))groups.set(group,c);}
      for(const c of groups.values()){
        const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Abweichung prüfen: '+c.entity+' · '+(c.entityId||c.local?.date||c.local?.id||'');details.append(summary);
        const current=JSON.parse(JSON.stringify(K.sync.conflictLocal(c)));
        for(const [label,data] of [['Aktueller PC-Stand',current],['Vergleichsstand aus der bisherigen Synchronisation',c.remote]]){const h=document.createElement('h3'),pre=document.createElement('pre');h.textContent=label;pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px';pre.textContent=data?JSON.stringify(data,null,2):'Kein vollständig bestätigter Serververgleich vorhanden.';details.append(h,pre);}
        for(const [choice,label] of [['local','Diesen PC-Stand für die Umstellung auswählen'],['remote','Diesen Serververgleich auswählen']]){
          const choose=document.createElement('button');choose.type='button';choose.style.cssText='min-height:48px;padding:12px;margin:6px';choose.textContent=label;choose.disabled=choice==='remote'&&(!c.remote||!Number.isFinite(Number(c.remoteVersion))||c.remoteVersion==null);details.append(choose);
          choose.onclick=async()=>{if(!confirm(label+'? Die Auswahl wird zunächst als geprüfter Umstellungsentwurf gesichert. Erst der gesonderte Übernahme-Knopf schreibt den zentralen Ausgangsstand.'))return;choose.disabled=true;
            try{K.sync.resolveConflict(c.id,choice,{expectedLocal:current});await K.sync.whenDurable();await K.storage.putMany(K.planningEntries());startup();}catch(e){warning.textContent=e.message;choose.disabled=false;}};
        }
        panel.append(details);
      }
      const start=document.createElement('button');start.type='button';start.style.cssText='min-height:48px;padding:12px';start.textContent='Geprüften PC-Bestand als Ausgangsstand übernehmen';start.disabled=true;panel.append(start);
      const inspect=document.createElement('button');inspect.type='button';inspect.textContent='Bisherigen Serverbestand prüfen';inspect.style.cssText='min-height:48px;padding:12px;margin:8px';panel.append(inspect);
      inspect.onclick=async()=>{inspect.disabled=true;warning.textContent='Vorhandene Serverangaben werden vollständig geprüft …';try{
        const inventory=await K.cloudPrimary.inspectMigration(),missing=[];
        for(const [collection,records] of Object.entries(inventory.collections))for(const row of records)if(!(K[collection]||[]).some(local=>local.id===row.id))missing.push({collection,row});
        const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Geprüfter Serverbestand und Vergleich';pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px';pre.textContent=JSON.stringify({server:inventory,pc:K.planningEntries().filter(([k])=>!K.cloudPrimary.localOnly?.has(k))},null,2);details.append(summary,pre);panel.append(details);
        if(!missing.length){warning.textContent='Serverbestand geprüft. Keine weiteren Wunsch-/Dienstkennungen fehlen auf diesem PC. Abweichende Werte im Vergleich und offene Konflikte bitte prüfen.';start.disabled=!!conflicts.length;}
        else{warning.textContent=missing.length+' weitere Wunsch-/Diensteinträge liegen auf dem Server. Vor der Übernahme müssen sie ergänzt werden.';const add=document.createElement('button');add.type='button';add.textContent=missing.length+' fehlende Servereinträge ergänzen';add.style.cssText='min-height:48px;padding:12px';panel.append(add);add.onclick=async()=>{add.disabled=true;try{for(const {collection,row} of missing){K[collection]=K[collection]||[];if(!K[collection].some(x=>x.id===row.id))K[collection].push(JSON.parse(JSON.stringify(row)));}await K.storage.putMany(K.planningEntries());warning.textContent='Weitere Servereinträge im Umstellungsentwurf ergänzt. Bestehende PC-Angaben wurden nicht ersetzt.';start.disabled=!!conflicts.length;}catch(e){warning.textContent=e.message;add.disabled=false;}};}
      }catch(e){warning.textContent=e.message;inspect.disabled=false;}};
      start.onclick=async()=>{
        if(!confirm('Diesen angezeigten PC-Bestand erstmals in den neuen zentralen Planungsspeicher übernehmen? Bestehende Daten und ältere Stände bleiben erhalten.'))return;
        start.disabled=true;
        try{await K.cloudPrimary.initialize(K.planningEntries(),{confirmed:true});K.planningDataReady=true;location.reload();}
        catch(e){warning.textContent=e.message;start.disabled=false;}
      };
    }
    if(s.status==='join'){
      const preview=K.cloudPrimary.joinPreview(),details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Lokalen Altstand und zentralen Stand vergleichen';pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px';pre.textContent=JSON.stringify(preview,null,2);details.append(summary,pre);panel.append(details);
      const download=document.createElement('a');download.textContent='Lokalen Altstand zusätzlich als Datei sichern';download.download='KC-DP2-PC-Altstand.json';download.href=URL.createObjectURL(new Blob([JSON.stringify(preview.local,null,2)],{type:'application/json'}));panel.append(download);
      const join=document.createElement('button');join.type='button';join.style.cssText='min-height:48px;padding:12px;margin:12px';join.textContent='Zentralen Stand laden und PC-Altstand gesichert behalten';panel.append(join);join.onclick=async()=>{if(!confirm('Den zentralen Serverstand verwenden? Der bisherige PC-Stand wird zusätzlich verschlüsselt archiviert und nicht an den Server übertragen. Bitte eventuell noch benötigte lokale Änderungen vorher vergleichen.'))return;join.disabled=true;try{await K.cloudPrimary.joinServer(preview,{confirmed:true});location.reload();}catch(e){p.textContent=e.message;join.disabled=false;}};
    }
    if(s.status==='conflict'&&s.pending){
      const compare=document.createElement('button');compare.type='button';compare.textContent='PC und Server vergleichen';compare.style.cssText='min-height:48px;padding:12px';panel.append(compare);
      compare.onclick=async()=>{compare.disabled=true;try{
        const preview=await K.cloudPrimary.review();const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Vollständiger Vergleich der Planungsdaten';details.append(summary);
        for(const [label,data] of [['Deine noch nicht übertragenen PC-Daten',preview.local],['Aktueller Serverstand · Version '+preview.remoteVersion,preview.remote]]){const h=document.createElement('h3'),pre=document.createElement('pre');h.textContent=label;pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px';pre.textContent=JSON.stringify(data,null,2);details.append(h,pre);}panel.append(details);
        const warning=document.createElement('p');warning.textContent='Die Entscheidung gilt für den gesamten angezeigten Planungsstand. Beide Varianten bleiben im Verlauf erhalten.';panel.append(warning);
        for(const [choice,label] of [['remote','Serverstand übernehmen'],['local','Meine PC-Daten übertragen']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.style.cssText='min-height:48px;padding:12px;margin:6px';panel.append(button);button.onclick=async()=>{if(!confirm(label+'? Bitte zuerst den vollständigen Vergleich prüfen.'))return;button.disabled=true;try{await K.cloudPrimary.resolve(choice,preview);location.reload();}catch(e){p.textContent=e.message;button.disabled=false;}};}
      }catch(e){p.textContent=e.message;compare.disabled=false;}};
    }
    const retry=document.createElement('button');retry.type='button';retry.style.cssText='min-height:48px;padding:12px;margin:12px';retry.textContent='Serverstand erneut laden';retry.onclick=()=>location.reload();panel.append(retry);
    for(const child of document.body.children)if(child!==shade&&!child.inert){child.inert=true;child.dataset.cloudPrimaryInert='true';}
    document.body.append(shade);retry.focus();
  }
  function update(){if(['blocked','conflict'].includes(K.cloudPrimary?.state.status)&&K.planningDataReady)startup();}
  K.cloudPrimaryUi={startup,update};
})();
