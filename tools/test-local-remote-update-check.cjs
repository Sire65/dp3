const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const c=fs.readFileSync(path.join(__dirname,'..','src/core/update-manager.js'),'utf8');
assert.match(c,/raw\.githubusercontent\.com\/Sire65\/dp3\/main\/update-manifest\.json/);
assert.match(c,/LOCAL_REPO_HOST/);
assert.match(c,/GitHub Desktop öffnen, Repository dp3 auswählen/);
assert.match(c,/const source=LOCAL_REPO_HOST\?REMOTE_MANIFEST_URL:MANIFEST_URL/);
console.log('KC DP2: localhost prüft GitHub main; lokale Installation wird nicht fälschlich als Browser-Auto-Update behandelt.');