// Build 268 KC-DP-MITGLIED-KOMPAKT / KC-DP-BEREITSCHAFT-GENERELL (Wunsch Hansi nach der Eingabe mit Christina):
// Startfrage „Bereitschaft generell“ (Ja/Nein, Pflicht) neben der Kollegen-Freigabe; bei „Nein“ keine tägliche Bereitschaftsfrage
// (Tage mit schon angebotener Bereitschaft bleiben änderbar). „Nur wenn nötig“ auffällig in der Kann-Zeit, kein ausgegrautes
// Kästchen mehr bei der Wunschzeit. Club-Eingang übernimmt standbyGeneral. Kompakte Kopfzeile auf dem Handy.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),read=f=>readFile(path.join(root,f),'utf8');
const [chef,sw,inbox,css,tw,idx]=await Promise.all(['src/ui/chef-companion.js','src/ui/simple-wish-assistant.js','src/core/club-wish-inbox.js','src/ui/member-compact.css','twinkey-test.html','index.html'].map(read));
// Startfrage
assert.match(chef,/Bist du generell bereit, auch Bereitschaftsdienste zu übernehmen\?/);
assert.match(chef,/name="twStandbyGeneral" value="yes" \$\{sg===true\?'checked':''\}/);assert.match(chef,/name="twStandbyGeneral" value="no" \$\{sg===false\?'checked':''\}/);
assert.match(chef,/if\(!general\)\{\$\('twShareStatus'\)\.textContent='Bitte bei der Bereitschaft „Ja“ oder „Nein“ wählen\.'/,'Pflichtfrage');
assert.match(chef,/K\.memberUxData\.standbyGeneral\[id\]=\{allow:general==='yes',updatedAt:/);
// Tagesfrage nur bei Ja – vorhandene Bereitschaft bleibt änderbar
assert.match(sw,/standbyGeneral\?\.\[personId\]\?\.allow===false&&K\.memberUxData\?\.assistantStandby\?\.\[personId\]\?\.\[d\.date\]\?\.answer!=='yes'\)return false;/);
// Nur wenn nötig
assert.match(sw,/class="sw-needed"><input type="checkbox" data-needed="'\+i\+'"/,'auffälliges Feld, gleiche data-needed-Bindung');
assert.ok(!/type="checkbox" disabled/.test(sw),'kein ausgegrautes Kästchen bei der Wunschzeit');
assert.match(sw,/inheritedNeeded\(t\)\?'<p class="sw-needed-note">/);
// Club-Eingang
assert.match(inbox,/standbyGeneral:typeof input\.standbyGeneral==='boolean'\?input\.standbyGeneral:\(before\.metadata\?\.standbyGeneral\?\?null\)/);
assert.match(inbox,/if\(typeof meta\.standbyGeneral==='boolean'\)\{K\.memberUxData\.standbyGeneral=/);
assert.match(inbox,/standbyGeneral:clone\(K\.memberUxData\?\.standbyGeneral\?\.\[input\.personId\]\)/,'Rückweg kennt den alten Stand');
// Stile geladen
for(const h of [tw,idx])assert.match(h,/src\/ui\/member-compact\.css\?v=0\.20\.0-b268/);
assert.match(css,/@media \(max-width:700px\)/);assert.match(css,/\.sw-needed:has\(input:checked\)/);assert.match(css,/\.tw-sg-choice/);
console.log('Mitglied kompakt OK: Startfrage Bereitschaft generell, Tagesfrage nur bei Ja, „Nur wenn nötig“ auffällig, Club-Eingang übernimmt es');
