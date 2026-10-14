import {readFile,mkdir,copyFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),manifest=JSON.parse(await readFile(path.join(root,'update-manifest.json'),'utf8'));
const name=`KC-DP2-Arbeitsversion-Build${manifest.build}-RC`,folder=path.join(root,'tmp','working-release',name);
await mkdir(folder,{recursive:true});
const paths=[...manifest.files.map(f=>f.path),'update-manifest.json','release-version.json','service-worker.js','pilot-sw.js','pilot2/sw.js','pilot-mobile/sw.js','DP2-OFFLINE-STARTEN.cmd','tools/static-server.mjs'];
for(const relative of paths){const from=path.resolve(root,relative),to=path.resolve(folder,relative);if(!from.startsWith(root+path.sep)||!to.startsWith(folder+path.sep))throw Error('Invalid package path');await mkdir(path.dirname(to),{recursive:true});await copyFile(from,to);}
await copyFile(path.join(root,'docs','ARBEITSVERSION-STARTEN.md'),path.join(folder,'BITTE-ZUERST-LESEN.md'));
await writeFile(path.join(folder,'PAKET-STAND.json'),JSON.stringify({version:manifest.version,build:manifest.build,stage:manifest.stage,sourceBranch:'codex/club-app-interface',runtimeFiles:manifest.files.length},null,2)+'\n');
console.log(folder);
