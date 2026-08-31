(function(){
  const K=window.KCDP=window.KCDP||{};
  let provider=null;
  function asHour(v){
    if(typeof v==='number')return v;
    const m=String(v||'').trim().match(/^(\d{1,2})(?::|\.)(\d{2})$/);
    if(!m)return null;
    const h=Number(m[1]),min=Number(m[2]);
    return h>=0&&h<=24&&min>=0&&min<60?h+min/60:null;
  }
  function normalizeRow(r,defaults={}){
    return {
      rowId:r.rowId||`PR-${Math.random().toString(36).slice(2)}`,
      personId:r.personId||defaults.personId||'',
      date:r.date||defaults.date||'',
      start:asHour(r.start),
      end:asHour(r.end),
      wishType:r.wishType||'available',
      wishZone:['V','H','B'].includes(String(r.wishZone||'').toUpperCase())?String(r.wishZone).toUpperCase():'B',
      comment:r.comment||'',
      confidence:Number.isFinite(Number(r.confidence))?Number(r.confidence):null,
      fieldConfidence:r.fieldConfidence||r.confidenceByField||{},
      sourceBox:r.sourceBox||r.boundingBox||null,
      accepted:r.accepted!==false
    };
  }
  K.photoRecognition={
    version:'0.20.0-b122',
    setProvider(fn){provider=typeof fn==='function'?fn:null;K.state.photoRecognitionConfigured=!!provider;},
    hasProvider(){return !!provider||!!K.formOcr?.analyze;},
    async analyze(file,context={}){
      if(provider){
        const raw=await provider({file,context,people:K.people,days:K.days});
        const rows=Array.isArray(raw?.rows)?raw.rows:[];
        return {mode:'vision',rows:rows.map(r=>normalizeRow(r,context)),notes:raw?.notes||[],overallConfidence:raw?.overallConfidence??null};
      }
      if(K.formOcr?.analyze){
        const raw=await K.formOcr.analyze(file,context),detected=Array.isArray(raw?.rows)?raw.rows:[],rows=K.formOcr.completeReview(detected,raw.identity?.personId||context.personId||'');
        if(context.personId&&raw.identity?.status==='matched'&&raw.identity?.personId!==context.personId)throw new Error('Der QR-Code gehoert zu einer anderen Person. Es wird nichts uebernommen.');
        if(context.personId&&raw.identity?.status!=='matched')raw.notes=[...(raw.notes||[]),'QR nicht sicher lesbar: Zuordnung erfolgt nur zur angemeldeten Person und jede Zeile muss manuell bestätigt werden.'];
        return {...raw,rows:rows.map(r=>normalizeRow(r,context))};
      }
      // Sicherheits-Fallback: keine erfundenen OCR-Daten. Der Nutzer kontrolliert/ergänzt die Zeilen.
      return {mode:'guided_review',rows:[normalizeRow({date:context.date,wishType:'available',accepted:true},context)],notes:['Kein Foto-KI-Provider konfiguriert. Es werden keine Handschriftwerte erfunden; die Kontrolltabelle ist zur sicheren manuellen Erfassung geöffnet.'],overallConfidence:null};
    },
    validateRows(rows){
      if(K.importReview?.reviewWishRows)return K.importReview.reviewWishRows(rows,{source:'photo'}).rows.map(row=>({...row,issues:row.issues.map(x=>x.text),valid:row.valid}));
      const checked=[];
      for(const row of rows){
        const issues=[];
        if(!K.person(row.personId))issues.push('Person fehlt');
        if(!K.days.some(d=>d.date===row.date))issues.push('Datum außerhalb KC-DP-Zeitraum');
        if(row.start==null||row.end==null)issues.push('Von/Bis fehlt');
        else if(row.end<=row.start)issues.push('Ende liegt nicht nach Beginn');
        if(!(K.wishContract?.types?.[row.wishType]||['available','preferred','if_needed','unavailable'].includes(row.wishType)))issues.push('Wunschstatus ungültig');
        const candidate={...row,id:row.rowId};
        if(!issues.length)K.validateWish(candidate).forEach(i=>issues.push(i.text));
        checked.push({...row,issues,valid:issues.length===0});
      }
      return checked;
    }
  };
  if(typeof window.KCDPPhotoVisionProvider==='function')K.photoRecognition.setProvider(window.KCDPPhotoVisionProvider);
})();
