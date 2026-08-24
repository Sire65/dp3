/* KC MarktKasse SecurityCore – Crypto & Secure Sync Module V0.3.0
 * Reused unchanged as the common KC cryptographic foundation.
 * Browser WebCrypto only; AES-256-GCM + PBKDF2-SHA-256.
 */
(function(global){
  "use strict";
  const enc=new TextEncoder(), dec=new TextDecoder();
  const b64=bytes=>btoa(String.fromCharCode(...bytes));
  const unb64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
  const randomBytes=n=>crypto.getRandomValues(new Uint8Array(n));
  async function deriveKey(secret,salt,iterations=310000){
    if(!global.crypto?.subtle)throw new Error("WebCrypto ist auf diesem Gerät nicht verfügbar.");
    if(String(secret||"").length<16)throw new Error("Der Übertragungsschlüssel muss mindestens 16 Zeichen lang sein.");
    const material=await crypto.subtle.importKey("raw",enc.encode(secret),"PBKDF2",false,["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  }
  async function encryptEnvelope(payload,{secret,projectId="default",aad="KC_SECURE_SYNC_V1"}={}){
    const salt=randomBytes(16),iv=randomBytes(12),iterations=310000;
    const key=await deriveKey(secret,salt,iterations);
    const additionalData=enc.encode(`${aad}|${projectId}`);
    const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData,tagLength:128},key,enc.encode(JSON.stringify(payload)));
    return {format:"KC_SECURE_SYNC_V1",algorithm:"AES-256-GCM",kdf:"PBKDF2-SHA-256",iterations,projectId,salt:b64(salt),iv:b64(iv),aad,ciphertext:b64(new Uint8Array(cipher)),createdAt:new Date().toISOString()};
  }
  async function decryptEnvelope(envelope,{secret,projectId}={}){
    if(!envelope||envelope.format!=="KC_SECURE_SYNC_V1")throw new Error("Unbekanntes oder unverschlüsseltes Sync-Paket.");
    if(projectId&&envelope.projectId!==projectId)throw new Error("Sync-Paket gehört zu einem anderen Projekt.");
    const salt=unb64(envelope.salt),iv=unb64(envelope.iv);
    const key=await deriveKey(secret,salt,envelope.iterations||310000);
    const additionalData=enc.encode(`${envelope.aad||"KC_SECURE_SYNC_V1"}|${envelope.projectId}`);
    try{
      const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData,tagLength:128},key,unb64(envelope.ciphertext));
      return JSON.parse(dec.decode(plain));
    }catch(_){throw new Error("Paketprüfung fehlgeschlagen: falscher Schlüssel oder manipulierte Daten.");}
  }
  function createOperationId(prefix="op"){return `${prefix}_${crypto.randomUUID()}`;}
  function normalizeQueueItem(item){const now=new Date().toISOString();return {...item,operationId:item.operationId||createOperationId(item.entity||"op"),status:item.status||"pending",queuedAt:item.queuedAt||now,attempts:Number(item.attempts||0),nextAttemptAt:item.nextAttemptAt||now};}
  function nextRetry(attempts){const seconds=Math.min(900,Math.max(5,2**Math.min(Number(attempts||0),8)*5));return new Date(Date.now()+seconds*1000).toISOString();}
  global.KCSecureSync={version:"0.3.0",encryptEnvelope,decryptEnvelope,createOperationId,normalizeQueueItem,nextRetry,capabilities:()=>({webCrypto:!!global.crypto?.subtle,aesGcm:true,integrityProtection:true,replayId:true})};
})(window);
