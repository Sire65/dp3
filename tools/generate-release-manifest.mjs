import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const version='0.20.0';
const build=87;
const allowed=new Set(['.html','.js','.css','.webmanifest','.svg','.png','.webp','.xlsx']);
const excluded=new Set(['service-worker.js','pilot-sw.js','pilot2/sw.js','pilot-mobile/sw.js']);

async function walk(dir=''){
  const entries=await readdir(path.join(root,dir),{withFileTypes:true});
  const out=[];
  for(const entry of entries){
    const rel=path.posix.join(dir.replaceAll('\\','/'),entry.name);
    if(entry.isDirectory()){
      if(['tools'].includes(entry.name))continue;
      out.push(...await walk(rel));
    }else if(allowed.has(path.extname(entry.name).toLowerCase())&&!excluded.has(rel))out.push(rel);
  }
  return out;
}

const paths=(await walk()).sort((a,b)=>a.localeCompare(b,'en'));
const files=[];
let totalRuntimeBytes=0;
for(const relative of paths){
  const data=await readFile(path.join(root,...relative.split('/')));
  const runtime=!relative.startsWith('pilot-mobile/');
  if(runtime)totalRuntimeBytes+=data.byteLength;
  files.push({
    path:relative,
    installPath:relative,
    bytes:data.byteLength,
    sha256:createHash('sha256').update(data).digest('hex'),
    runtime,
    ...(relative==='index.html'||relative.endsWith('.html')?{forceRefresh:true}:{})
  });
}

const manifest={
  schema:'KC_DP_UPDATE_MANIFEST_V1',app:'KC DP2',version,build,
  cacheName:`kc-dp-release-${version}-b${build}`,
  releaseNotes:[
    'Eigener verschlüsselter DP3-Gerätespeicher verhindert Kollisionen mit älteren Dienstplan-Installationen',
    'Automatische Update-Erkennung mit klarer Ja-/Nein-Abfrage für jede höhere Version oder Buildnummer',
    'V0.20 Phase 1: additive Hauptregister für Dashboard, Wunschplan, Sollplan, Istplan und Stundenmatrix',
    'Gemeinsame responsive Registerbedienung mit Tastaturnavigation und eindeutigen Textzuständen',
    'Vollständiges Laufzeitmanifest mit SHA-256-Prüfung aller lokalen Programmdateien',
    'Atomare Cache-Auslieferung verhindert Mischstände aus alten und neuen JavaScript-/CSS-Dateien',
    'Authentifizierter Zustand wird nicht mehr ohne vorhandenes Supabase-Zugriffstoken rekonstruiert',
    'Reproduzierbare Release- und Integritätsprüfung ergänzt',
    'Pastellfarbene Start-/Zielzeilen beim Markieren und Verschieben von Dienstbalken'
  ],
  generatedAt:new Date().toISOString(),totalRuntimeBytes,files
};
await writeFile(path.join(root,'update-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(`Manifest geschrieben: ${files.length} Dateien, ${totalRuntimeBytes} Runtime-Bytes`);
