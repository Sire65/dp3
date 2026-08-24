(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
function validateContext(ctx={}){return K.emailInbox?.decideImport?.({documentMatched:!!ctx.documentMatched,personMatched:!!ctx.personId,wishPhaseOpen:ctx.wishPhaseOpen===true,validationOk:ctx.validationOk===true,confidence:Number(ctx.confidence||0)})||{automatic:false,status:'review_required',problems:['E-Mail-Modul fehlt']}}
function sameWish(a,b){return a.personId===b.personId&&a.date===b.date&&Number(a.start)===Number(b.start)&&Number(a.end)===Number(b.end)&&a.wishType===b.wishType&&String(a.wishZone||'B')===String(b.wishZone||'B')}
async function applyEntries(entries=[],ctx={}){
 const decision=validateContext(ctx);if(!decision.automatic)return{ok:false,status:decision.status,problems:decision.problems,added:0,skipped:0};
 if(!K.mutations?.saveWish)throw new Error('Wunsch-Mutation nicht verfügbar');
 const before=JSON.parse(JSON.stringify(K.wishes||[])),personId=String(ctx.personId),sourceId=String(ctx.inboxId||ctx.documentId||'inbound');let added=0,skipped=0;
 try{for(const e of entries){const row={id:'',personId,date:e.date,start:Number(e.start),end:Number(e.end),wishType:e.wishType,wishZone:e.wishZone||'B',comment:e.comment||'',source:'email_auto_import',sourceDocumentId:ctx.documentId||null,sourceInboxId:ctx.inboxId||null,status:'confirmed'};if((K.wishes||[]).some(w=>w.status!=='deleted'&&sameWish(w,row))){skipped++;continue}K.mutations.saveWish(row,{reason:`Automatischer Eingang ${sourceId}`});added++}await K.persistAll?.();return{ok:true,status:'applied',added,skipped,personId,documentId:ctx.documentId||null}}
 catch(e){K.wishes=before;await K.persistAll?.();throw e}
}
async function fromMatrix(matrix,ctx={}){const parsed=K.wishImport?.normalizeMatrix?.(matrix);if(!parsed)return{ok:false,status:'review_required',problems:['Excel-Parser fehlt']};const decisionCtx={...ctx,validationOk:parsed.valid};if(!parsed.valid)return{ok:false,status:'review_required',problems:parsed.issues.map(x=>x.text),issues:parsed.issues};return applyEntries(parsed.entries,decisionCtx)}
K.inboundWishImport={version:'1.0',validateContext,sameWish,applyEntries,fromMatrix};
})();
