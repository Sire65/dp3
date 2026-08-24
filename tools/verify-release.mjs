import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(path.join(root,'update-manifest.json'),'utf8'));
const failures=[];
const seen=new Set();
for(const file of manifest.files||[]){
  if(!file.path||seen.has(file.path)){failures.push(`Ungültiger/doppelter Pfad: ${file.path}`);continue;}
  seen.add(file.path);
  const absolute=path.resolve(root,...file.path.split('/'));
  if(!absolute.startsWith(root+path.sep)){failures.push(`Pfad verlässt Release: ${file.path}`);continue;}
  try{await access(absolute);const data=await readFile(absolute);const hash=createHash('sha256').update(data).digest('hex');if(data.byteLength!==file.bytes)failures.push(`Größe: ${file.path}`);if(hash!==file.sha256)failures.push(`SHA-256: ${file.path}`);}catch{failures.push(`Fehlt: ${file.path}`);}
}
const index=await readFile(path.join(root,'index.html'),'utf8');
const referenced=[...index.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css|webmanifest|png|svg|webp))/g)].map(x=>x[1]);
for(const file of referenced)if(!seen.has(file))failures.push(`In index.html geladen, aber nicht manifestiert: ${file}`);
if(Number(manifest.build)!==88)failures.push(`Falscher Build im Manifest: ${manifest.build}`);
if(!manifest.cacheName.endsWith('-b88'))failures.push(`Falscher Cache-Name: ${manifest.cacheName}`);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`Release OK: ${seen.size} Dateien vollständig geprüft (${manifest.version} Build ${manifest.build})`);
