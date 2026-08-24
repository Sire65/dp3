(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
const PROVIDERS=['resend','brevo','custom'];
function normalizeProvider(p={}){return{id:String(p.id||''),kind:PROVIDERS.includes(String(p.kind))?String(p.kind):'custom',name:String(p.name||p.kind||'Provider'),enabled:p.enabled!==false,priority:Number.isFinite(Number(p.priority))?Number(p.priority):100,sendReady:!!p.sendReady,receiveReady:!!p.receiveReady,freeTierLabel:String(p.freeTierLabel||''),lastOkAt:p.lastOkAt||null,lastError:p.lastError||null}}
function chooseProvider(rows=[],capability='send'){const key=capability==='receive'?'receiveReady':'sendReady';return rows.map(normalizeProvider).filter(p=>p.enabled&&p[key]).sort((a,b)=>a.priority-b.priority)[0]||null}
function classifyAttachment(a={}){const n=String(a.name||'').toLowerCase(),m=String(a.mime||'').toLowerCase();if(n.endsWith('.xlsx')||n.endsWith('.xls')||m.includes('spreadsheet')||m.includes('excel'))return'excel';if(/\.(png|jpe?g|webp|heic)$/i.test(n)||m.startsWith('image/'))return'image';if(n.endsWith('.pdf')||m==='application/pdf')return'pdf';return'unsupported'}
function decideImport(ctx={}){const problems=[];if(!ctx.documentMatched)problems.push('Dokument nicht eindeutig erkannt');if(!ctx.personMatched)problems.push('Person nicht eindeutig erkannt');if(ctx.wishPhaseOpen!==true)problems.push('Wunschphase ist geschlossen');if(ctx.validationOk!==true)problems.push('Inhalt ist nicht vollständig valide');if(Number(ctx.confidence||0)<0.98)problems.push('Erkennung unter 98 %');const automatic=problems.length===0;return{automatic,status:automatic?'auto_ready':'review_required',problems}}
function shouldAutoApply(ctx={}){return decideImport(ctx).automatic}
K.emailInbox={version:'1.0',PROVIDERS,normalizeProvider,chooseProvider,classifyAttachment,decideImport,shouldAutoApply};
})();
