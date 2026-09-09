(function(){
'use strict';const K=window.KCDP,ids=['KC-P-002','KC-P-M0001','KC-P-M0002','KC-P-M0003','KC-P-M0004','KC-P-M0005','KC-P-M0006','KC-P-M0007','KC-P-M0008','KC-P-M0009','KC-P-M0011','KC-P-M0012','KC-P-M0013','KC-P-M0014','KC-P-M0015','KC-P-M0016','KC-P-M0017','KC-P-M0018'];
function install(){if(K.currentUser?.role!=='admin'||!document.getElementById('uxAdminBack')||document.getElementById('kcAccessSetup'))return;const host=document.querySelector('#kcdpUxRoot .ux-grid');if(!host)return;const panel=document.createElement('section');panel.id='kcAccessSetup';panel.className='ux-card';panel.innerHTML='<h2>Vereinbarte Mitgliedszugänge</h2><p>Hans-Joachim Koch und Frank Brösel: Admin. Klaus Zander: Planer. Die übrigen aktiven Mitglieder einschließlich Leon: Mitglied. Admins behalten alle Planerrechte.</p><button class="ux-btn secondary" id="kcAccessPreview">Zugänge in Supabase prüfen</button><div id="kcAccessResult" role="status"></div>';host.prepend(panel);
const leon=document.createElement('section');leon.className='ux-card';leon.innerHTML='<h2>Leons wiederkehrende Sperrtage</h2><p>Jeden Montag und Mittwoch ganztägig gesperrt, auch in künftigen Planungszeiträumen.</p><button class="ux-btn primary" id="kcLeonBlocks">Leons Sperrtage in Supabase speichern</button><p id="kcLeonStatus" role="status"></p>';panel.append(leon);
document.getElementById('kcLeonBlocks').onclick=async()=>{
 const button=document.getElementById('kcLeonBlocks'),status=document.getElementById('kcLeonStatus');button.disabled=true;status.textContent='Sperrtage werden geprüft und übertragen …';
 try{
  if(K.currentUser?.role!=='admin')throw Error('Bitte als Admin anmelden.');
  if(!K.memberAccess?.configured?.())throw Error('Bitte zuerst mit Supabase verbinden und anmelden.');
  await K.supabaseConnection.ensureSession();
  const membership=await K.supabaseConnection.currentMembership();if(membership?.role!=='admin')throw Error('Der angemeldete Zugang benötigt die Adminrolle.');
  const people=await K.supabaseConnection.memberProvisioningTargets();if(!people.some(p=>p.person_id==='KC-P-M0018'&&p.active))throw Error('Leons aktiver Datensatz wurde nicht gefunden.');
  if(K.sync.snapshot().outbox.length||K.sync.openConflicts())throw Error('Bitte zuerst offene Synchronisierungen und Konflikte abschließen.');
  await K.sync.pull();
  if(K.sync.openConflicts())throw Error('Bitte zuerst den Synchronisierungskonflikt lösen.');
  const before=K.staffing.rulesFor('KC-P-M0018');if(!before)throw Error('Bitte zuerst die Mitglieder in DP2 laden.');
  K.staffing.setRules('KC-P-M0018',{forbiddenWeekdays:[...new Set([...(before.forbiddenWeekdays||[]),1,3])]},{reason:'Auf Wunsch von Hans-Joachim Koch: Leon jeden Montag und Mittwoch ganztägig gesperrt'});
  await K.persistAll();
  const sent=await K.sync.flush();if(sent.failed||sent.conflicts||sent.pending||sent.sent<1)throw Error('Noch nicht vollständig in Supabase gespeichert. Bitte Synchronisierung prüfen.');
  await K.sync.pull();await K.persistAll();
  status.textContent='✓ In Supabase gespeichert: Leon ist jeden Montag und Mittwoch ganztägig gesperrt.';
 }catch(e){status.textContent='Nicht bestätigt: '+e.message;button.disabled=false;}
};
document.getElementById('kcAccessPreview').onclick=async()=>{const result=document.getElementById('kcAccessResult');result.textContent='Prüfe Supabase …';try{const all=await K.supabaseConnection.memberProvisioningTargets();const targets=all.filter(p=>ids.includes(p.person_id)&&p.active);const existing=await K.memberAccess.listMemberAccess();result.replaceChildren();for(const p of targets){const line=document.createElement('p');line.textContent=p.display_name+': '+(!p.email?'E-Mail fehlt':existing.some(m=>m.person_id===p.person_id)?'Zugang vorhanden · Rolle wird geprüft':'Zugang wird vorbereitet');result.append(line);}const button=document.createElement('button');button.className='ux-btn primary';button.textContent='Zugänge und Rollen in Supabase einrichten';result.append(button);button.onclick=async()=>{button.disabled=true;for(const p of targets.filter(p=>p.email)){const line=document.createElement('p');try{const role=['KC-P-002','KC-P-M0003'].includes(p.person_id)?'admin':p.person_id==='KC-P-M0009'?'planner':'employee';await K.memberAccess.provisionMemberAccess({personId:p.person_id,displayName:p.display_name,email:p.email,role});line.textContent='✓ '+p.display_name+' · '+role;}catch(e){line.textContent='Nicht eingerichtet: '+p.display_name+' · '+e.message;}result.append(line);}button.remove();};}catch(e){result.textContent=e.message;}};}
new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});install();
})();