import {readFileSync} from 'node:fs';
const js=readFileSync('src/ui/person-account-print.js','utf8'),css=readFileSync('src/ui/person-account-print.css','utf8'),html=readFileSync('index.html','utf8');
const required=['Wunsch','Soll','Ist geprüft','Ist aus Buchungen','Tageszeit','Internes Dokument','pseudoName','.original','K.exports.printHtml','Personenkonto drucken'];
const missing=required.filter(x=>!js.includes(x));
if(missing.length)throw new Error('Personenkonto-Vertrag fehlt: '+missing.join(', '));
if(!css.includes('repeat(3')||!css.includes('@media'))throw new Error('Responsive Personenauswahl fehlt');
if(!html.includes('person-account-print.js?v=0.20.0-b200')||!html.includes('KC_DP_BUILD=206'))throw new Error('Build-Integration fehlt');
console.log('Personenkonto-Smoke-Test OK: Verlauf, Summen, Namenswahl, Druck und responsive Auswahl');