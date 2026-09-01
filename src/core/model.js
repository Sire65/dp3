(function(){
  const K=window.KCDP=window.KCDP||{};
  K.VERSION='0.20.0';

  // Verbindlicher Personenstand 01.09.2026: zentrale IDs/Nummern plus lokale Aushilfen.
  // Die Reihenfolge der ersten 19 Einträge bleibt wegen der Präsentations-Testdaten stabil.
  const peopleData=[
    ['Frank Brösel','Vorne · Flex','member','KC-P-M0003','KC-0003','Puhbär'],
    ['Hans-Joachim Koch','Vorne · Hinten · Verantwortung','member','KC-P-002','KC-0010','Pumuckl'],
    ['Dieter Zander','Hinten · Flex','member','KC-P-M0008','KC-0008','Spock'],
    ['Klaus Zander','Vorne','member','KC-P-M0009','KC-0009','Tigger'],
    ['Andrea Spahn','Vorne · Getränke','member','KC-P-M0005','KC-0005','Bibi'],
    ['Marianne Bierkämper','Vorne','member','KC-P-M0001','KC-0001','Maja'],
    ['Karla Kazik','Vorne · Flex','member','KC-P-M0015','KC-0013','Lillifee'],
    ['Willfried Wittwer','Hinten','member','KC-P-M0006','KC-0006','Willi'],
    ['Anne Reinkober','Vorne · Getränke','member','KC-P-M0007','KC-0007','Einhorn'],
    ['Manfred Schoppmann','Hinten · Flex','member','KC-P-M0011','KC-0011','Wickie'],
    ['Reinhild Eggenstein','Vorne','member','KC-P-M0002','KC-0002','Heidi'],
    ['Thomas Hess','Vorne · Hinten','member','KC-P-M0012','KC-0012','Nemo'],
    ['Christina Brösel','Vorne · Getränke','member','KC-P-M0014','KC-0017','Bambi'],
    ['Steven Linley','Vorne · Hinten · Flex','member','KC-P-M0013','KC-0015','Yoda'],
    ['Sabrina','Hinten · Küche','helper','KC-P-LOCAL-01',null,null],
    ['Michael','Vorne · Hinten','helper','KC-P-LOCAL-02',null,null],
    ['Gasthelfer 18','Vorne · Hinten','helper','KC-P-LOCAL-03',null,null],
    ['Aushilfe 1','Vorne · Getränke','helper','KC-P-LOCAL-04',null,null],
    ['Aushilfe 2','Hinten · Küche','helper','KC-P-LOCAL-05',null,null],
    ['Ruth Kazik','Vorne · Flex','member','KC-P-M0016','KC-0014','Maus'],
    ['Peter Wördemann','Vorne · Hinten','member','KC-P-M0017','KC-0016','Sandmann'],
    ['Leon Wördemann','Vorne · Hinten','helper','KC-P-M0018','KC-0018','Simba']
  ];
  // Ehemalige DP2-IDs werden einmalig auf die zentralen Personen-IDs umgeschlüsselt.
  K.personIdAliases={
    'KC-P-001':'KC-P-M0003','KC-P-002':'KC-P-002','KC-P-003':'KC-P-M0008','KC-P-004':'KC-P-M0009',
    'KC-P-005':'KC-P-M0005','KC-P-006':'KC-P-M0001','KC-P-007':'KC-P-M0015','KC-P-008':'KC-P-M0006',
    'KC-P-009':'KC-P-M0007','KC-P-010':'KC-P-M0011','KC-P-011':'KC-P-M0002','KC-P-012':'KC-P-M0012',
    'KC-P-013':'KC-P-M0014','KC-P-014':'KC-P-M0013','KC-P-016':'KC-P-LOCAL-01','KC-P-017':'KC-P-LOCAL-02',
    'KC-P-018':'KC-P-LOCAL-03','KC-P-019':'KC-P-LOCAL-04','KC-P-020':'KC-P-LOCAL-05'
  };
  // Fridbert bleibt aktives Vereinsmitglied, ist für den Weihnachtsmarkt 2026 aber nicht planbar.
  // Heinz Lunemann ist verstorben und darf in DP2 weder planbar noch sichtbar werden.
  K.nonPlanningPersonIds=new Set(['KC-P-M0004','KC-P-M0019']);
  K.personPlanningAllowed=id=>!K.nonPlanningPersonIds.has(String(id||''));
  K.people=peopleData.map(p=>({personId:p[3],memberNo:p[4],name:p[0],skills:p[1],personType:p[2],active:true,expanded:false,maxHours:p[2]==='helper'?6:8,pseudoName:p[5]||null,phone:'nicht hinterlegt',preferences:{},availability:[]}));
  K.localPersonIds=new Set(K.people.filter(p=>p.personId.startsWith('KC-P-LOCAL-')).map(p=>p.personId));
  const helper1=K.people.find(p=>p.personType==='helper'&&p.name==='Aushilfe 1'),helper2=K.people.find(p=>p.personType==='helper'&&p.name==='Aushilfe 2');
  helper1.availability=[{date:'2026-12-04',start:16,end:23},{date:'2026-12-05',start:12,end:20},{date:'2026-12-06',start:12,end:18},{date:'2026-12-11',start:16,end:23},{date:'2026-12-12',start:12,end:20},{date:'2026-12-13',start:12,end:18}];
  helper2.availability=[{date:'2026-12-05',start:15,end:23},{date:'2026-12-08',start:12,end:20},{date:'2026-12-12',start:15,end:23}];
  K.canonicalPeople=K.people.map(p=>({...p,availability:(p.availability||[]).map(a=>({...a})),preferences:{...(p.preferences||{})}}));
  const dates=[]; const add=(date,type,start,end,open=null,close=null)=>dates.push({date,type,start,end,open,close,preOpenMinutes:type==='market'?60:0,weather:{temp:5,condition:'trocken',impact:type==='market'?'gut':'neutral',factor:type==='market'?1.1:1},program:[]});
  add('2026-12-02','prep',8,18); add('2026-12-03','prep',8,18); add('2026-12-04','market',11,23,12,null); add('2026-12-05','market',11,23,12,null); add('2026-12-06','market',11,23,12,null); add('2026-12-07','market',13,23,14,null); add('2026-12-08','market',11,23,12,null); add('2026-12-09','market',13,23,14,null); add('2026-12-10','market',13,23,14,null); add('2026-12-11','market',11,23,12,null); add('2026-12-12','market',11,23,12,null); add('2026-12-13','market',11,23,12,null); add('2026-12-14','after',8,15);
  dates.find(d=>d.date==='2026-12-04').program=[{title:'Eröffnung / Auftakt',start:17,end:18,impact:'+'}]; dates.find(d=>d.date==='2026-12-05').program=[{title:'Live-Musik',start:18.5,end:20.5,impact:'++'}]; dates.find(d=>d.date==='2026-12-12').program=[{title:'Hauptprogramm',start:19,end:21,impact:'+++'}]; K.days=dates;
  function marketReq(hour){if(hour<12)return{total:4,front:2,back:2};if(hour<15)return{total:6,front:4,back:2};if(hour<17)return{total:8,front:5,back:3};if(hour<21)return{total:10,front:6,back:4};return{total:7,front:4,back:3};}
  function simpleReq(day,hour){if(day.type==='prep')return{total:hour<9?4:hour<12?6:hour<16?7:4,front:null,back:null};if(day.type==='after')return{total:hour<10?5:hour<13?6:4,front:null,back:null};return marketReq(hour);}
  K.baseRequirementFor=(day,hour)=>simpleReq(day,hour); K.requirementFor=(day,hour)=>{const base=K.baseRequirementFor(day,hour);if(day.type!=='market')return{...base,baseTotal:base.total,weatherExtra:0,programExtra:0};let front=base.front,back=base.back;const wf=Number(day.weather?.factor||1),weatherExtra=Math.max(0,Math.round(base.total*(wf-1)));front+=weatherExtra;let programExtra=0;for(const p of day.program||[]){if(hour>=p.start-.5&&hour<p.end+.5){if(p.impact==='+'){front++;programExtra++;}else if(p.impact==='++'){front++;back++;programExtra+=2;}else if(p.impact==='+++'){front+=2;back++;programExtra+=3;}}}return{total:front+back,front,back,baseTotal:base.total,weatherExtra,programExtra};}; K.standbyRequirementFor=()=>2;
  K.state={dateIndex:2,view:'day',layer:'planned',step:60,history:[],messages:[],drag:null,filters:{},supabaseConnected:false,wishPhase:'open',photoRecognitionConfigured:false,mobileMode:false,selectedShiftId:null,inspectorOpen:true,inspectorHour:null};
  const shifts=[]; function s(personIdx,date,start,end,zone='front',area='Verkauf'){shifts.push({id:`S-${shifts.length+1}`,personId:K.people[personIdx].personId,date,start,end,zone,area,layer:'planned',breakMinutes:0,status:'draft'});} s(0,'2026-12-04',11,17,'front','Verkauf');s(1,'2026-12-04',11,18,'back','Hinten');s(2,'2026-12-04',11,16,'back','Küche');s(4,'2026-12-04',12,18,'front','Getränke');s(8,'2026-12-04',15,21,'front','Verkauf');s(15,'2026-12-04',16,23,'back','Küche');s(16,'2026-12-04',17,23,'front','Verkauf');s(11,'2026-12-04',18,23,'special','Z · Nachproduktion');s(18,'2026-12-04',16,20,'front','Getränke');s(0,'2026-12-02',8,13,'neutral','Vorbereitung');s(1,'2026-12-02',8,14,'neutral','Vorbereitung');s(2,'2026-12-02',9,15,'neutral','Vorbereitung');s(3,'2026-12-02',10,16,'neutral','Vorbereitung');s(5,'2026-12-14',8,13,'neutral','Nachbereitung');s(9,'2026-12-14',8,15,'neutral','Nachbereitung');s(12,'2026-12-14',9,14,'neutral','Nachbereitung');K.shifts=shifts;
  K.wishes=[{id:'W-1',personId:K.people[0].personId,date:'2026-12-04',start:11,end:17,wishType:'preferred',source:'self_service',comment:'Frühdienst bevorzugt',confidence:1,status:'confirmed'},{id:'W-2',personId:K.people[1].personId,date:'2026-12-04',start:11,end:18,wishType:'available',source:'self_service',comment:'',confidence:1,status:'confirmed'},{id:'W-3',personId:K.people[8].personId,date:'2026-12-04',start:15,end:21,wishType:'preferred',source:'self_service',comment:'',confidence:1,status:'confirmed'},{id:'W-4',personId:K.people[15].personId,date:'2026-12-04',start:16,end:23,wishType:'available',source:'form_import',comment:'Papierformular geprüft',confidence:.96,status:'confirmed'},{id:'W-5',personId:K.people[16].personId,date:'2026-12-04',start:17,end:23,wishType:'if_needed',source:'self_service',comment:'Nur wenn nötig',confidence:1,status:'confirmed'},{id:'W-6',personId:K.people[3].personId,date:'2026-12-04',start:18,end:23,wishType:'unavailable',source:'self_service',comment:'Privater Termin',confidence:1,status:'confirmed'}]; K.wishesFor=date=>K.wishes.filter(w=>w.date===date&&w.status!=='deleted'); K.memberUxData=K.memberUxData||{colleaguePreferences:[],wishSubmittedAt:{},draftMeta:{}};
  K.standby=[{id:'B-1',personId:'KC-P-M0015',date:'2026-12-04',start:11,end:17,phone:'nicht hinterlegt',status:'planned'},{id:'B-2',personId:'KC-P-M0011',date:'2026-12-04',start:17,end:23,phone:'nicht hinterlegt',status:'planned'},{id:'B-3',personId:'KC-P-LOCAL-04',date:'2026-12-04',start:11,end:23,phone:'nicht hinterlegt',status:'planned'}]; K.day=()=>K.days[K.state.dateIndex];K.person=id=>K.people.find(p=>p.personId===id);K.shiftsFor=(date,layer=K.state.layer)=>K.shifts.filter(s=>s.date===date&&(layer==='compare'||s.layer===layer));K.standbyFor=date=>K.standby.filter(s=>s.date===date&&!['cancelled','deleted'].includes(s.status));
})();
