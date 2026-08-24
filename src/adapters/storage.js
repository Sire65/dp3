(function(){
  const K=window.KCDP;
  const PROJECT_ID='KC_DP',DB_NAME='KC_DP_SECURE_CANDIDATE',STORE='encrypted_envelopes',META_KEY='__kc_local_crypto_meta_v2__',FORMAT='KC_DP_LOCAL_V2',ITERATIONS=310000;
  const enc=new TextEncoder(),dec=new TextDecoder();
  function idbTraffic(op){try{window.dispatchEvent(new CustomEvent('KC_DP_IDB_TRAFFIC',{detail:{op,at:new Date().toISOString()}}));}catch(_){ }}
  function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
  function unb64(text){return Uint8Array.from(atob(text),c=>c.charCodeAt(0))}
  function randomBytes(n){return crypto.getRandomValues(new Uint8Array(n))}
  function tick(){return new Promise(r=>setTimeout(r,0))}
  K.storage={
    db:null,secret:null,unlocked:false,_metaPromise:null,_sessionKeyPromise:null,_fingerprints:new Map(),_metrics:{reads:0,writes:0,skippedWrites:0,encryptedBytes:0,lastWriteMs:null,lastReadMs:null},_migration:{legacyRead:0,migrated:0},
    setSecret(secret){if(String(secret||'').length<16)throw new Error('Der lokale Sicherheitsschlüssel muss mindestens 16 Zeichen lang sein.');this.secret=String(secret);this.unlocked=true;this._sessionKeyPromise=null;},
    lock(){this.secret=null;this.unlocked=false;this._sessionKeyPromise=null;},
    requireUnlock(){if(!this.unlocked||!this.secret)throw new Error('Sicherer Speicher ist gesperrt.');},
    async init(){
      if(this.db)return true;
      if(!('indexedDB' in window)) throw new Error('IndexedDB nicht verfügbar');
      return new Promise((resolve,reject)=>{
        let settled=false;const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error('IndexedDB antwortet nicht. Bitte andere geöffnete KC-DP-Tabs schließen und erneut laden.'));}},10000),finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value)};const req=indexedDB.open(DB_NAME,1);
        req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};
        req.onsuccess=()=>{if(settled){req.result.close();return;}this.db=req.result;this.db.onversionchange=()=>{this.db?.close?.();this.db=null;};finish(resolve,true)};req.onerror=()=>finish(reject,req.error);req.onblocked=()=>{};
      });
    },
    async _rawGet(key){if(!this.db)await this.init();return new Promise((resolve,reject)=>{const tx=this.db.transaction(STORE,'readonly'),q=tx.objectStore(STORE).get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});},
    async _cryptoMeta(){
      if(this._metaPromise)return this._metaPromise;
      this._metaPromise=(async()=>{
        if(!this.db)await this.init();
        let row=await this._rawGet(META_KEY);if(row?.meta?.salt)return row.meta;
        const meta={format:'KC_DP_LOCAL_META_V2',salt:b64(randomBytes(16)),iterations:ITERATIONS,createdAt:new Date().toISOString()};
        await new Promise((resolve,reject)=>{const tx=this.db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key:META_KEY,meta});tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error)});
        return meta;
      })();
      try{return await this._metaPromise}catch(e){this._metaPromise=null;throw e}
    },
    async _sessionKey(){
      this.requireUnlock();
      if(this._sessionKeyPromise)return this._sessionKeyPromise;
      this._sessionKeyPromise=(async()=>{
        const meta=await this._cryptoMeta();
        const material=await crypto.subtle.importKey('raw',enc.encode(this.secret),'PBKDF2',false,['deriveKey']);
        return crypto.subtle.deriveKey({name:'PBKDF2',salt:unb64(meta.salt),iterations:Number(meta.iterations||ITERATIONS),hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      })();
      try{return await this._sessionKeyPromise}catch(e){this._sessionKeyPromise=null;throw e}
    },
    _serialize(value){return JSON.stringify(value)},
    async _encryptFast(value,serialized){
      const key=await this._sessionKey(),iv=randomBytes(12),aad='KC_DP_INDEXEDDB_V2',additionalData=enc.encode(`${aad}|${PROJECT_ID}`),plain=enc.encode(serialized===undefined?this._serialize(value):serialized);
      const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData,tagLength:128},key,plain);
      this._metrics.encryptedBytes+=plain.byteLength;
      return {format:FORMAT,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA-256',iterations:ITERATIONS,projectId:PROJECT_ID,saltRef:META_KEY,iv:b64(iv),aad,ciphertext:b64(new Uint8Array(cipher)),createdAt:new Date().toISOString()};
    },
    async _decryptFast(envelope){
      if(envelope?.format!==FORMAT)throw new Error('Unbekanntes lokales V2-Paket.');
      const key=await this._sessionKey(),iv=unb64(envelope.iv),aad=envelope.aad||'KC_DP_INDEXEDDB_V2',additionalData=enc.encode(`${aad}|${PROJECT_ID}`);
      try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData,tagLength:128},key,unb64(envelope.ciphertext));return JSON.parse(dec.decode(plain));}
      catch(_){throw new Error('Lokale Paketprüfung fehlgeschlagen: falscher Schlüssel oder manipulierte Daten.');}
    },
    async putMany(entries,{onProgress,force=false}={}){
      this.requireUnlock();if(!this.db)await this.init();
      const list=Array.isArray(entries)?entries:Object.entries(entries||{});if(!list.length)return true;
      const started=performance.now(),prepared=[];for(const [key,value] of list){const serialized=this._serialize(value);if(!force&&this._fingerprints.get(key)===serialized){this._metrics.skippedWrites++;continue}prepared.push({key,value,serialized})}
      if(!prepared.length){this._metrics.lastWriteMs=Math.round((performance.now()-started)*10)/10;return {written:0,skipped:list.length,total:list.length}}
      await this._sessionKey();
      const rows=[];for(let i=0;i<prepared.length;i++){const x=prepared[i];rows.push({key:x.key,envelope:await this._encryptFast(x.value,x.serialized),updatedAt:new Date().toISOString()});onProgress?.(i+1,prepared.length,{key:x.key,phase:'encrypt'});if(i&&i%8===0)await tick();}
      idbTraffic('put');
      await new Promise((resolve,reject)=>{const tx=this.db.transaction(STORE,'readwrite'),os=tx.objectStore(STORE);for(const row of rows)os.put(row);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error)});
      for(const x of prepared)this._fingerprints.set(x.key,x.serialized);this._metrics.writes+=rows.length;this._metrics.lastWriteMs=Math.round((performance.now()-started)*10)/10;
      return {written:rows.length,skipped:list.length-rows.length,total:list.length};
    },
    async getMany(keys,{onProgress,migrate=true}={}){
      this.requireUnlock();if(!this.db)await this.init();const list=[...keys];if(!list.length)return [];
      const started=performance.now(),raw=await new Promise((resolve,reject)=>{let settled=false;const out=new Array(list.length),tx=this.db.transaction(STORE,'readonly'),os=tx.objectStore(STORE),timer=setTimeout(()=>{if(settled)return;settled=true;try{tx.abort()}catch(_){}reject(new Error('Lokale Datenbank antwortet beim Lesen nicht. Bitte andere KC-DP-Tabs schließen und erneut laden.'));},12000),finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value)};list.forEach((key,i)=>{const q=os.get(key);q.onsuccess=()=>out[i]=q.result;q.onerror=()=>finish(reject,q.error)});tx.oncomplete=()=>finish(resolve,out);tx.onerror=()=>finish(reject,tx.error);tx.onabort=()=>finish(reject,tx.error||new Error('Lokaler Lesevorgang abgebrochen.'))});
      idbTraffic('get');await this._sessionKey();
      const values=new Array(list.length),legacy=[];
      for(let i=0;i<raw.length;i++){
        const row=raw[i];if(!row){values[i]=undefined;onProgress?.(i+1,list.length,{key:list[i],phase:'read',legacy:false});continue;}
        if(row.envelope?.format===FORMAT)values[i]=await this._decryptFast(row.envelope);
        else{this._migration.legacyRead++;values[i]=await KCSecureSync.decryptEnvelope(row.envelope,{secret:this.secret,projectId:PROJECT_ID});legacy.push([list[i],values[i]]);}
        this._fingerprints.set(list[i],this._serialize(values[i]));onProgress?.(i+1,list.length,{key:list[i],phase:'read',legacy:row.envelope?.format!==FORMAT});if(i&&i%4===0)await tick();
      }
      if(migrate&&legacy.length){await this.putMany(legacy,{force:true,onProgress:(done,total,info)=>onProgress?.(list.length+done,list.length+legacy.length,{...info,phase:'migrate'})});this._migration.migrated+=legacy.length;}
      this._metrics.reads+=raw.filter(Boolean).length;this._metrics.lastReadMs=Math.round((performance.now()-started)*10)/10;return values;
    },
    async put(key,value){return this.putMany([[key,value]])},
    async get(key){return (await this.getMany([key]))[0]},
    async remove(key){this.requireUnlock();if(!this.db)await this.init();idbTraffic('remove');return new Promise((resolve,reject)=>{const tx=this.db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>{this._fingerprints.delete(key);resolve(true)};tx.onerror=()=>reject(tx.error)});},
    async removeMany(keys){this.requireUnlock();if(!this.db)await this.init();const list=[...keys];if(!list.length)return true;idbTraffic('remove');return new Promise((resolve,reject)=>{const tx=this.db.transaction(STORE,'readwrite'),os=tx.objectStore(STORE);list.forEach(k=>os.delete(k));tx.oncomplete=()=>{list.forEach(k=>this._fingerprints.delete(k));resolve(true)};tx.onerror=()=>reject(tx.error)});},
    async benchmark({rounds=8,payloadBytes=2048,onProgress}={}){
      this.requireUnlock();if(!this.db)await this.init();const count=Math.max(3,Math.min(30,Number(rounds)||8)),payload={probe:'KC_DP_PERF_V1',text:'x'.repeat(Math.max(128,Number(payloadBytes)||2048)),at:new Date().toISOString()},keys=Array.from({length:count},(_,i)=>`__perf_${Date.now()}_${i}`),rawKeys=keys.map(k=>k+'_raw'),p=()=>performance.now(),round=v=>Math.round(v*10)/10;
      const keyStart=p();await this._sessionKey();const keyWarmupMs=round(p()-keyStart);onProgress?.(1,5,{phase:'key',label:'Sitzungsschlüssel bereit'});await tick();
      let t=p();await new Promise((resolve,reject)=>{const tx=this.db.transaction(STORE,'readwrite'),os=tx.objectStore(STORE);rawKeys.forEach((key,i)=>os.put({key,rawProbe:payload,seq:i}));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});const rawWriteMs=round(p()-t);onProgress?.(2,5,{phase:'raw-write',label:'Reines IndexedDB-Schreiben gemessen'});await tick();
      t=p();const raw=await new Promise((resolve,reject)=>{const out=[],tx=this.db.transaction(STORE,'readonly'),os=tx.objectStore(STORE);rawKeys.forEach(key=>{const q=os.get(key);q.onsuccess=()=>out.push(q.result);q.onerror=()=>reject(q.error)});tx.oncomplete=()=>resolve(out);tx.onerror=()=>reject(tx.error)});const rawReadMs=round(p()-t);if(raw.length!==count)throw new Error('Rohmessung unvollständig.');onProgress?.(3,5,{phase:'raw-read',label:'Reines IndexedDB-Lesen gemessen'});await tick();
      t=p();const envelopes=[];for(let i=0;i<count;i++)envelopes.push(await this._encryptFast(payload));const encryptMs=round(p()-t);t=p();for(const envelope of envelopes)await this._decryptFast(envelope);const decryptMs=round(p()-t);onProgress?.(4,5,{phase:'crypto',label:'Verschlüsselung getrennt gemessen'});await tick();
      t=p();await this.putMany(keys.map(k=>[k,payload]),{force:true});const secureWriteMs=round(p()-t);t=p();const secure=await this.getMany(keys,{migrate:false});const secureReadMs=round(p()-t);if(secure.some(x=>x?.probe!==payload.probe))throw new Error('Sichere Messung unvollständig.');await this.removeMany([...keys,...rawKeys]);keys.forEach(k=>this._fingerprints.delete(k));onProgress?.(5,5,{phase:'complete',label:'Gesamttest abgeschlossen'});
      return {ok:true,rounds:count,payloadBytes,keyWarmupMs,raw:{writeMs:rawWriteMs,readMs:rawReadMs,totalMs:round(rawWriteMs+rawReadMs)},crypto:{encryptMs,decryptMs,totalMs:round(encryptMs+decryptMs)},secure:{writeMs:secureWriteMs,readMs:secureReadMs,totalMs:round(secureWriteMs+secureReadMs)},perRecord:{rawMs:round((rawWriteMs+rawReadMs)/count),cryptoMs:round((encryptMs+decryptMs)/count),secureMs:round((secureWriteMs+secureReadMs)/count)},at:new Date().toISOString()};
    },
    stats(){return {format:FORMAT,kdfIterations:ITERATIONS,sessionKeyCached:!!this._sessionKeyPromise,legacyRead:this._migration.legacyRead,migrated:this._migration.migrated,...this._metrics,changeCacheCount:this._fingerprints.size};},
    async test(){this.requireUnlock();const key=`__test__-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,token={value:'KC-DP-'+Math.random().toString(36).slice(2),at:new Date().toISOString()};try{await this.put(key,token);const out=await this.get(key);if(out?.value!==token.value)throw new Error('Verschlüsselter Lese-/Schreibtest fehlgeschlagen');return true;}finally{try{await this.remove(key)}catch(_){}}}
  };
})();
