(function(){
'use strict';
const K=window.KCDP=window.KCDP||{};
const ALPH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(len=12){const a=new Uint8Array(len);crypto.getRandomValues(a);return Array.from(a,x=>ALPH[x%ALPH.length]).join('')}
function shortCode(v){const s=String(v||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();return `WP-${s.slice(0,4)}-${s.slice(4,8)}`}
function payload(meta={}){const token=meta.token||randomCode(16);return{schema:'KCDP-DOC-1',token,docType:String(meta.docType||'wish_matrix'),periodId:String(meta.periodId||''),version:String(meta.version||'0.19.55'),issuedAt:new Date().toISOString()}}
function encode(meta){return JSON.stringify(payload(meta))}
function decode(raw){try{const x=typeof raw==='string'?JSON.parse(raw):raw;if(!x||x.schema!=='KCDP-DOC-1'||!x.token)return null;return x}catch{return null}}
function safePublicLabel(meta){const x=decode(meta)||meta||{};return shortCode(x.token||'')}
K.documentIdentity={version:'1.0',randomCode,shortCode,payload,encode,decode,safePublicLabel};
})();
