(function(){
'use strict';const K=window.KCDP;
function text(){const header=['Datum','Kann von','Kann bis','Wunsch von','Wunsch bis','Sperrzeit von','Sperrzeit bis','Sperrtag','Nur wenn nötig','V/H/B','Bemerkung'];const rows=K.days.map(d=>[d.date.split('-').reverse().join('.'),'','','','','','','','','B','']);return '\ufeff'+[header,...rows].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\r\n');}
function download(){const blob=new Blob([text()],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='KC_DP2_Wunschmatrix_kompatibel.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
K.compatibleTemplate={text,download};
})();
