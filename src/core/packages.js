(function(){
 const K=window.KCDP=window.KCDP||{};
 function merge(docs,title='KC DP Planungsmappe'){if(!docs.length)throw new Error('Keine Dokumente im Paket.');const html=docs.map((d,i)=>`<section class="package-doc" data-package-index="${i}">${d.html}</section>`).join('');return {id:`PKG-${Date.now()}`,type:'document_package',title,fileName:`KC_DP_Planungsmappe_${new Date().toISOString().slice(0,10)}.html`,scope:'restricted',sensitive:true,createdAt:new Date().toISOString(),html,fingerprint:K.documents.fingerprint(html),documents:docs.map(d=>({id:d.id,type:d.type,title:d.title,fingerprint:d.fingerprint}))};}
 function planning(start,end){const types=['planned_plan','matrix','special_services','standby_internal'];const docs=types.map(type=>K.documents.build({type,start,end,publishedOnly:true}));return merge(docs,'KC DP – Planungsmappe');}
 function member(personId,start,end){return K.documents.build({type:'personal',personId,start,end,publishedOnly:true});}
 K.documentPackages={version:'0.14.0',merge,planning,member};
})();
