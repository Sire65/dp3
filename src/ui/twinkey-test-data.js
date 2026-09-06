(function(){
'use strict';const K=window.KCDP;
K.days=[{date:'2026-12-04',start:11,end:23,type:'market',label:'Freitag'},{date:'2026-12-05',start:11,end:23,type:'market',label:'Samstag'},{date:'2026-12-06',start:11,end:23,type:'market',label:'Sonntag'}];
K.people=[{personId:'TW-DEMO-1',name:'Hans Beispiel',active:true,personType:'member',skills:'Vorne Hinten',maxHours:12},{personId:'TW-DEMO-2',name:'Anna Beispiel',active:true,personType:'member',skills:'Vorne Hinten',maxHours:12}];
K.currentUser={personId:'TW-DEMO-1',displayName:'Hans Beispiel',role:'employee'};
K.state={...K.state,wishPhase:'open',date:K.days[0].date,dayIndex:0,view:'day',layer:'wish'};K.day=()=>K.days[0];K.person=id=>K.people.find(p=>p.personId===id);
K.eventConfig={name:'Twinkey ausprobieren · Beispieldaten'};K.workflow={status:'draft'};K.memberUxData={};K.personRules={};K.auditLog=[];K.swapRequests=[];K.standby=[];K.absences=[];
K.wishes=[{id:'TW-W1',personId:'TW-DEMO-1',date:'2026-12-04',start:12,end:18,wishType:'available',status:'confirmed',wishZone:'B'},{id:'TW-W2',personId:'TW-DEMO-2',date:'2026-12-04',start:14,end:22,wishType:'available',status:'confirmed',wishZone:'V'},{id:'TW-W3',personId:'TW-DEMO-2',date:'2026-12-04',start:16,end:20,wishType:'preferred',status:'confirmed',wishZone:'V'}];
K.shifts=[{id:'TW-S1',personId:'TW-DEMO-1',date:'2026-12-05',start:14,end:18,layer:'planned',status:'published',zone:'front',area:'Verkauf',breakMinutes:0}];
K.actualShifts=[{id:'TW-A1',personId:'TW-DEMO-1',date:'2026-12-04',start:12,end:16,status:'recorded',area:'Verkauf',breakMinutes:0}];
K.planVersions=[{version:1,shifts:JSON.parse(JSON.stringify(K.shifts)),publishedAt:'2026-12-01T10:00:00Z'}];
K.persistAll=async()=>true;K.sync={enqueue(){},snapshot:()=>({outbox:[]})};K.memberAccess={configured:()=>false,cachePublicConfig(){}};
// No storage adapter, login session or server connector is loaded in this isolated document.
})();
