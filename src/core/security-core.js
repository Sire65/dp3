/* KC MarktKasse SecurityCore – Crypto & Secure Sync Module V0.3.0
 * Common KC cryptographic foundation; chunked Base64 supports full planning snapshots.
 * Browser WebCrypto only; AES-256-GCM + PBKDF2-SHA-256.
 */
(function(global){
  "use strict";
  const enc=new TextEncoder(), dec=new TextDecoder();
  const b64=bytes=>{const parts=[];for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));return btoa(parts.join(''));};
  const unb64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
  const randomBytes=n=>crypto.getRandomValues(new Uint8Array(n));
  async function deriveKey(secret,salt,iterations=310000){
    if(!global.crypto?.subtle)throw new Error("WebCrypto ist auf diesem Gerät nicht verfügbar.");
    if(String(secret||"").length<16)throw new Error("Der Übertragungsschlüssel muss mindestens 16 Zeichen lang sein.");
    const material=await crypto.subtle.importKey("raw",enc.encode(secret),"PBKDF2",false,["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  }
  // KC-DP-SPEICHERN-SPARSAM (13.11.2026, Wunsch Hansi „setze A und B um“): große Stände vor dem Verschlüsseln mit gzip packen.
  // Ein Planungsstand (JSON) wird dabei typischerweise 5- bis 10-mal kleiner. Format V2 + „compression“ stehen im Umschlag und in den
  // geprüften Zusatzdaten (AAD) – eine Manipulation des Merkmals fällt beim Entschlüsseln auf. V1 (ungepackt) bleibt lesbar.
  // Ohne CompressionStream (sehr alte Browser) wird wie bisher ungepackt als V1 gespeichert.
  const strom=name=>global[name]||globalThis[name];
  const kannPacken=()=>typeof strom("CompressionStream")==="function"&&typeof strom("DecompressionStream")==="function";
  async function durchStrom(bytes,strom){
    const w=strom.writable.getWriter();const fertig=w.write(bytes).then(()=>w.close());
    const r=strom.readable.getReader(),teile=[];let n=0;
    for(;;){const {value,done}=await r.read();if(done)break;teile.push(value);n+=value.length;}
    await fertig;const out=new Uint8Array(n);let o=0;for(const t of teile){out.set(t,o);o+=t.length;}return out;
  }
  const packen=bytes=>{const C=strom("CompressionStream");return durchStrom(bytes,new C("gzip"));};
  const entpacken=bytes=>{const D=strom("DecompressionStream");return durchStrom(bytes,new D("gzip"));};
  async function encryptEnvelope(payload,{secret,projectId="default",aad="KC_SECURE_SYNC_V1",compress=false}={}){
    const salt=randomBytes(16),iv=randomBytes(12),iterations=310000;
    const key=await deriveKey(secret,salt,iterations);
    const gz=!!compress&&kannPacken();
    const additionalData=enc.encode(gz?`${aad}|${projectId}|gzip`:`${aad}|${projectId}`);
    const klar=enc.encode(JSON.stringify(payload));
    const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData,tagLength:128},key,gz?await packen(klar):klar);
    return {format:gz?"KC_SECURE_SYNC_V2":"KC_SECURE_SYNC_V1",algorithm:"AES-256-GCM",kdf:"PBKDF2-SHA-256",iterations,projectId,salt:b64(salt),iv:b64(iv),aad,...(gz?{compression:"gzip"}:{}),ciphertext:b64(new Uint8Array(cipher)),createdAt:new Date().toISOString()};
  }
  async function decryptEnvelope(envelope,{secret,projectId}={}){
    const v2=envelope?.format==="KC_SECURE_SYNC_V2";
    if(!envelope||(envelope.format!=="KC_SECURE_SYNC_V1"&&!v2))throw new Error("Unbekanntes oder unverschlüsseltes Sync-Paket.");
    if(v2&&envelope.compression!=="gzip")throw new Error("Unbekannte Packart im Sync-Paket.");
    if(v2&&!kannPacken())throw new Error("Dieser Browser kann gepackte Planungsstände nicht öffnen. Bitte Chrome, Edge oder Firefox aktualisieren.");
    if(projectId&&envelope.projectId!==projectId)throw new Error("Sync-Paket gehört zu einem anderen Projekt.");
    const salt=unb64(envelope.salt),iv=unb64(envelope.iv);
    const key=await deriveKey(secret,salt,envelope.iterations||310000);
    const additionalData=enc.encode(`${envelope.aad||"KC_SECURE_SYNC_V1"}|${envelope.projectId}${v2?"|gzip":""}`);
    let plain;
    try{plain=new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData,tagLength:128},key,unb64(envelope.ciphertext)));}
    catch(_){throw new Error("Paketprüfung fehlgeschlagen: falscher Schlüssel oder manipulierte Daten.");}
    try{
      return JSON.parse(dec.decode(v2?await entpacken(plain):plain));
    }catch(_){throw new Error("Paketprüfung fehlgeschlagen: falscher Schlüssel oder manipulierte Daten.");}
  }
  function createOperationId(prefix="op"){return `${prefix}_${crypto.randomUUID()}`;}
  function normalizeQueueItem(item){const now=new Date().toISOString();return {...item,operationId:item.operationId||createOperationId(item.entity||"op"),status:item.status||"pending",queuedAt:item.queuedAt||now,attempts:Number(item.attempts||0),nextAttemptAt:item.nextAttemptAt||now};}
  function nextRetry(attempts){const seconds=Math.min(900,Math.max(5,2**Math.min(Number(attempts||0),8)*5));return new Date(Date.now()+seconds*1000).toISOString();}
  global.KCSecureSync={version:"0.4.0",encryptEnvelope,decryptEnvelope,createOperationId,normalizeQueueItem,nextRetry,capabilities:()=>({webCrypto:!!global.crypto?.subtle,aesGcm:true,integrityProtection:true,replayId:true})};
})(window);
