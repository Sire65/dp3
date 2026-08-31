(function(){
  'use strict';
  const K=window.KCDP=window.KCDP||{};
  const clean=v=>String(v??'').trim(),norm=v=>clean(v).toLocaleLowerCase('de').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const overlap=(a,b)=>a.date===b.date&&Number(a.start)<Number(b.end)&&Number(a.end)>Number(b.start);
  function aliases(p){return[p.personId,p.name,p.displayName,p.pseudoName,p.pseudonym,p.nickname].map(norm).filter(Boolean)}
  function resolvePerson(value,{fallbackPersonId=''}={}){
    const raw=clean(value||fallbackPersonId);if(!raw)return{personId:'',status:'missing',matches:[]};
    const key=norm(raw),matches=(K.people||[]).filter(p=>aliases(p).includes(key));
    if(matches.length===1)return{personId:matches[0].personId,status:'exact',person:matches[0],matches};
    if(matches.length>1)return{personId:'',status:'ambiguous',matches};
    const partial=(K.people||[]).filter(p=>aliases(p).some(a=>a.startsWith(key)||key.startsWith(a)));
    return partial.length===1?{personId:partial[0].personId,status:'suggested',person:partial[0],matches:partial}:{personId:'',status:partial.length?'ambiguous':'unknown',matches:partial};
  }
  function confidenceFields(row){
    const source=row.fieldConfidence||row.confidenceByField||{},overall=Number.isFinite(Number(row.confidence))?Number(row.confidence):null;
    const normalized=value=>{const n=Number(value);return Number.isFinite(n)?(n>1?n/100:n):null},get=key=>source[key]!=null?normalized(source[key]):normalized(overall);
    return{person:get('person')??get('personId'),date:get('date'),start:get('start'),end:get('end'),wishType:get('wishType')};
  }
  function reviewWishRows(rows,{fallbackPersonId='',existing=K.wishes||[],source='import'}={}){
    const prepared=(rows||[]).map((input,index)=>{const identity=resolvePerson(input.personId||input.personName||input.name,{fallbackPersonId}),row={...input,personId:identity.personId||clean(input.personId),reviewIndex:index,source:input.source||source,fieldConfidence:confidenceFields(input)},issues=[];
      if(identity.status==='missing')issues.push({level:'error',code:'person.missing',text:'Person fehlt.'});
      else if(identity.status==='unknown')issues.push({level:'error',code:'person.unknown',text:'Person konnte weder über ID, Klarname noch PC-Manager-Pseudonym zugeordnet werden.'});
      else if(identity.status==='ambiguous')issues.push({level:'error',code:'person.ambiguous',text:'Personenangabe ist nicht eindeutig.'});
      else if(identity.status==='suggested')issues.push({level:'warning',code:'person.suggested',text:`Person als ${identity.person.name} vorgeschlagen – bitte bestätigen.`});
      if(!(K.days||[]).some(d=>d.date===row.date))issues.push({level:'error',code:'date.range',text:'Datum liegt außerhalb des Planzeitraums.'});
      if(!Number.isFinite(Number(row.start))||!Number.isFinite(Number(row.end)))issues.push({level:'error',code:'time.missing',text:'Von/Bis fehlt.'});else if(Number(row.end)<=Number(row.start))issues.push({level:'error',code:'time.order',text:'Ende liegt nicht nach Beginn.'});
      if(!['available','preferred','if_needed','unavailable'].includes(row.wishType))issues.push({level:'error',code:'wish.type',text:'Wunschstatus ist ungültig.'});
      for(const [field,value] of Object.entries(row.fieldConfidence))if(value!=null&&value<0.75)issues.push({level:value<0.5?'error':'warning',code:`confidence.${field}`,text:`${({person:'Person',date:'Datum',start:'Beginn',end:'Ende',wishType:'Angabe'})[field]} nur ${Math.round(value*100)} % sicher.`});
      const duplicate=existing.find(x=>x.status!=='deleted'&&x.personId===row.personId&&x.date===row.date&&Number(x.start)===Number(row.start)&&Number(x.end)===Number(row.end)&&x.wishType===row.wishType);
      if(duplicate)issues.push({level:'warning',code:'duplicate.existing',text:'Identische Angabe ist bereits gespeichert.',recordId:duplicate.id});
      const conflict=existing.find(x=>x.status!=='deleted'&&x.personId===row.personId&&overlap(x,row)&&x.wishType!==row.wishType);
      if(conflict)issues.push({level:'warning',code:'overlap.existing',text:'Zeit überschneidet eine andersartige vorhandene Angabe.',recordId:conflict.id});
      return{...row,identityStatus:identity.status,issues,valid:!issues.some(x=>x.level==='error'),duplicate:!!duplicate};
    });
    for(let i=0;i<prepared.length;i++)for(let j=0;j<i;j++)if(prepared[i].personId&&prepared[j].personId===prepared[i].personId&&overlap(prepared[i],prepared[j])){const same=prepared[i].date===prepared[j].date&&prepared[i].start===prepared[j].start&&prepared[i].end===prepared[j].end&&prepared[i].wishType===prepared[j].wishType;prepared[i].issues.push({level:'warning',code:same?'duplicate.batch':'overlap.batch',text:same?'Angabe kommt im Import mehrfach vor.':'Angabe überschneidet eine andere Importzeile.'});prepared[i].duplicate=prepared[i].duplicate||same;}
    const counts={total:prepared.length,valid:prepared.filter(x=>x.valid).length,errors:prepared.filter(x=>x.issues.some(i=>i.level==='error')).length,warnings:prepared.reduce((n,x)=>n+x.issues.filter(i=>i.level==='warning').length,0),duplicates:prepared.filter(x=>x.duplicate).length};
    return{rows:prepared,counts,canApply:counts.valid>0&&counts.errors===0};
  }
  K.importReview={version:'0.20.0-b113',resolvePerson,confidenceFields,reviewWishRows,overlap};
})();
