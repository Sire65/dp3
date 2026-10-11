/* DP2 an der direkten Leitung (KC-RT-PROGRAMME, Build 252, 11.10.2026)
 *
 * Gleiche direkte Leitung wie Club-App, PC-Manager und Money Butler (Supabase Realtime, nur Signal, nie Inhalt).
 * Schreibt ein Gerät Änderungen in den gemeinsamen Abgleich (kc_dp_sync_operations), meldet die Datenbank das
 * Signal "abgleich" – alle anderen angemeldeten DP2-Geräte holen dann SOFORT, statt bis zum nächsten Minutentakt
 * zu warten. Der Minutentakt (auto-sync.js) bleibt unverändert: darüber gehen auch die eigenen Änderungen hinaus.
 * Den Kanalnamen gibt die Datenbank (kc_rt_programm_kanal) nur angemeldeten Mitgliedern mit aktiver DP-Mitgliedschaft;
 * ohne Kanal (anonym, abgemeldet, offline) keine Leitung – DP2 arbeitet dann genau wie bisher.
 * Adresse und öffentlicher Schlüssel kommen aus der DP2-Supabase-Einstellung (integrationConfig), nicht fest eingetragen.
 */
(function(){
 const K=window.KCDP=window.KCDP||{};
 function init(){
 if(!window.KCDirekteLeitung||K.direkteLeitung)return;
 let c=null;try{c=K.supabaseConnection?.validateConfig?.();}catch(e){c=null;}
 if(!c){setTimeout(init,60000);return;} // Supabase-Einstellung (noch) nicht gültig → später erneut
 let warte=null;
 function abgleichen(){clearTimeout(warte);warte=setTimeout(()=>{try{if(K.autoSync?.state?.inFlight)return abgleichen();K.autoSync?.runNow?.({silent:true});}catch(e){/* nächster Takt */}},1500);}
 const leitung=window.KCDirekteLeitung.starte({
  name:'dp2',
  url:c.url.replace(/^https:/,'wss:')+'/realtime/v1/websocket',
  schluessel:c.publishableKey,
  startNachMs:4000,
  async kanalHolen(){
   const S=K.supabaseConnection;if(!S?.hasAccessToken?.())return null;
   try{await S.ensureSession?.();}catch(e){return null;}
   const t=S.sessionSnapshot?.()?.access_token;if(!t)return null;
   const r=await fetch(c.url+'/rest/v1/rpc/kc_rt_programm_kanal',{method:'POST',headers:{'Content-Type':'application/json',apikey:c.publishableKey,Authorization:'Bearer '+t},body:JSON.stringify({p_bereich:'dp'}),signal:AbortSignal.timeout(8000)});
   if(!r.ok)return null;const k=await r.json().catch(()=>null);return typeof k==='string'?k:null;
  },
  beiSignal(art){if(art==='abgleich')abgleichen();},
  nachholen(){abgleichen();}
 });
 K.direkteLeitung={version:'1.0.0',steht:leitung.steht,zustand:leitung.zustand,neuVerbinden:leitung.neuVerbinden};
 }
 // erst starten, wenn alle (defer-)Skripte und die Supabase-Einstellung geladen sind
 if(document.readyState==='complete')init();else window.addEventListener('load',init);
})();
