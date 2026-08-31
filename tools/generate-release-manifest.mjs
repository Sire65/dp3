import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const version='0.20.0';
const build=191;
const allowed=new Set(['.html','.js','.css','.webmanifest','.svg','.png','.webp','.xlsx','.docx','.gz']);
const excluded=new Set(['service-worker.js','pilot-sw.js','pilot2/sw.js','pilot-mobile/sw.js']);
const canonicalTextExtensions=new Set(['.html','.js','.css','.webmanifest','.svg']);
function canonicalData(relative,data){return canonicalTextExtensions.has(path.extname(relative).toLowerCase())?Buffer.from(data.toString('utf8').replace(/\r\n?/g,'\n'),'utf8'):data;}

async function walk(dir=''){
  const entries=await readdir(path.join(root,dir),{withFileTypes:true});
  const out=[];
  for(const entry of entries){
    const rel=path.posix.join(dir.replaceAll('\\','/'),entry.name);
    if(entry.isDirectory()){
      if(['tools','tmp','output','.git','.chrome-dump-test'].includes(entry.name)||entry.name.includes('-backup-build'))continue;
      out.push(...await walk(rel));
    }else if(allowed.has(path.extname(entry.name).toLowerCase())&&!excluded.has(rel))out.push(rel);
  }
  return out;
}

const paths=(await walk()).sort((a,b)=>a.localeCompare(b,'en'));
const files=[];
let totalRuntimeBytes=0;
for(const relative of paths){
  const raw=await readFile(path.join(root,...relative.split('/')));
  const data=canonicalData(relative,raw);
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
    'Build 191: eindeutige Mitgliedsnummern-Zuordnung fuer PC-Manager, Kasse und Wunschimport mit sicherem Fehlerriegel',
    'Build 190: plattformneutrale LF-Integritaetspruefung fuer identische Windows- und GitHub-Pages-Releases',
    'Build 189: Kann-Zeiten liegen wieder vollhoch hinter dem Sollbalken und lassen sich direkt verschieben, skalieren und löschen',
    'Build 186: klickbares Ansichtsmenü mit Schnellwechsel, kontextbezogenen Aktionen, Datenstand, Tastatursteuerung und Außenklick-Schließen',
    'Build 185: kompakte aussagekräftige Fairness-Seite mit Datenbasisstatus, Kennzahlen, Suche, Sortierung, Personendetails und V/H/Z-Zeitverteilung',
    'Build 184: Update-Aktivierung mit aktuellem Service Worker, direkter Bestätigung, belastbarer Wartezeit und Buildnummer-Erkennung',
    'Build 183: Live-Tableau mit aufklappbarem, geordnetem Personendetail für Status, Soll/Ist, Dauer, Restzeit, Pause, Quelle und Hinweise',
    'Build 182: Zeitraum-Auswertung zeigt je Zeitbalken Im Auswahlbereich und Gesamtdienst als gleich große Stunden-Infofelder',
    'Build 181: Uhrzeitenkopf mit Einzel-/Zeitraumauswahl, Personen- und Stundenübersicht sowie einheitlichem Live-/Planzeit-Tableau mit Ampelstatus',
    'Build 180: Planleisten vermessen und ohne abgeschnittene Buttons angeordnet; Mitarbeiter/in und dezente Wunsch-/Soll-/Ist-Farbidentität ergänzt',
    'Build 179: Sollplan-Bedienleiste logisch priorisiert, Wetter und Programm gebündelt sowie Anzeigehilfen in Ansicht & mehr zusammengefasst',
    'Build 178: Globale Personensuche springt in Wunsch, Soll und Ist exakt zur Mitarbeiterzeile und markiert sie deutlich',
    'Build 177: Warndreieck erklärt Hauptursache, Einzelprobleme und konkrete Handlungsempfehlungen auf den ersten Blick',
    'Build 176: KI-Problemstellen mit direkter Kandidatenanfrage, Lückensuche und Plannavigation',
    'Build 175: KI-Plan-Ergebnisseite mit Wunsch-/Kann-Auswertung, ausgeschöpften Problemstellen, Sperrgründen und direkter Plannavigation',
    'Build 174: Mitglieder-Team-Wunschplan mit Pseudonymen, persönlicher Lückensuche und bestätigungspflichtiger freiwilliger Schichtübernahme',
    'Build 173: Ergebnisradar mit Lösungsvorschlägen und Aushilfen-Telefonaktion, TableCore-Sortierung/Filter sowie einheitliche Pseudonymanzeige',
    'Build 172: sperrbare einklappbare Besetzungsblöcke, persönliche T/W/Z-Stunden nach Zeitlagen, Zeilenstreifen und verbreiterbarer Detailbereich',
    'Build 171: zusätzliches einklappbares Besetzungsradar in der Stundenmatrix mit T/W/Z, V/H-Abweichungen, kritischem Filter und Prüfanimation',
    'Build 169: Löschregression behoben, Kann-Zeit auswählbar/löschbar und Verschiebelinie platzsparend verdichtet',
    'Build 167: Verschiebelinie bewegt untere Planblöcke in beide Richtungen und bietet Doppelklick-Reset',
    'Build 166: verschiebbare Planunterkante und gespeicherter B-Tausch von Besetzung und Bereitschaft',
    'Build 165: Verdichtungsmodus umfasst Besetzungsmatrix, grafische Besetzung und Bereitschaftsdienst',
    'Build 164: tintensparender Originalkopf sowie Tages-, Wochen- und Gesamtplan mit Besetzungsstatistik',
    'Build 163: atomar neu bereitgestelltes Druck-Release nach erkannter Manifest-Datei-Abweichung',
    'Build 162: zweiseitiger A4-Querformat-Dienstplan fuer 18 Personen und V/H-Besetzungsgrafik in festen Bereichsfarben',
    'Build 161: Verdichtungsmodus reduziert nun verbindlich Raster-, Zellen- und Vergleichszeilenhoehen',
    'Build 160: Einklappbarer Besetzungsverlauf mit V/H-Saeulen, Sollmarken und gekoppeltem Stundenraster',
    'Build 159: Verdichtungsmodus fuer Planungszeilen und reparierte Bereichsschalter',
    'Build 158: E-Mail- und Posteingangsfenster professionell ausgerichtet, gegliedert und responsiv aufgebaut',
    'Build 157: Zeitbereich eines markierten oder verschobenen Balkens wird live im Stundenkopf hervorgehoben',
    'Build 156: kompakte Originalhoehe der Balken wiederhergestellt; groessere Beschriftung bleibt erhalten',
    'Build 155: groessere Balkenschrift und nahezu volle Zeilenhoehe in Wunsch-, Soll-, Ist- und Bereitschaftsplanung',
    'Build 154: Schnellplanung aus dem rechten Bereich mit eindeutigem Auswahlmodus, Klick-Standardzeit und flüssigem Ziehen',
    'Build 153: Wunschphasen-Ampel wechselt exakt zwei Kalendertage vor Frist auf Gelb',
    'Build 152: kompakter registerbezogener Planstatus in der Steuerzeile und deutlicher Pausenmarker mit Regeldetails',
    'Build 151: Herkunftskarten nutzen volle Fensterbreite; Verlaufsspalte vergroessert und sicher umbrochen',
    'Build 150: groessere zweispaltige Herkunftsverlaeufe und lesbare Farblegenden mit Hover und Touch',
    'Build 149: Herkunft links, Pause rechts und zentrale Textvergroesserung fuer kleine oder abgeschnittene Inhalte',
    'Build 148: Mitarbeitersortierung ohne Render- und Flackerschleife',
    'Build 147: gemeinsamer rollenbasierter Projektschlüssel und sichere Sync-Generation 2; alte Pakete bleiben archiviert',
    'Phase 39: Sichtbare Zeilentrennung und abwählbare Mitarbeiter in Sammelvorschauen',
    'Phase 31: Quellenbadges an Soll- und Istbalken mit Änderungskennzeichnung und Tooltip',
    'Phase 30: kompakte grafische Besetzung mit T/W/Z, Soll/Ist, V/H/B und Bereitschaft',
    'Schraffierte Wunsch- und Reservebalken erhalten kontrastreiche Textovale',
    'Phase 29: Wunsch- und Istplan mit stündlicher Standbesetzungs- und Bereitschaftsauswertung',
    'Aufgeklappte Mitarbeiterblöcke enden nach vier Detailzeilen mit einer klaren Abschlusslinie',
    'Phase 28: touchfreundliche Mitarbeitersortierung nach Name, Beginn, Tageszeit, V/H/B und Stunden',
    'Bearbeiten-Hinweis wird nach drei Sekunden automatisch ausgeblendet; Bearbeitungsmodus bleibt aktiv',
    'Phase 26 Fokus erweitert: Register, Wunschphasen-Banner, linke Kopfbedienung und interne Dashboard-KPIs werden im Arbeitsmodus ausgeblendet',
    'Phase 27 Korrektur: Wunschlegende kollisionsfrei in der vorhandenen Infozeile statt ueber der Zeitachse',
    'Phase 27: Wunschlegende in der Zeitachse und sicherer manueller OCR-Pruefweg bei unlesbarem QR',
    'Phase 26: stabiler Planungsfokus fuer Notebook-Bildschirme; Beobachterschleife behoben und Startmessung regressionsgeprueft',
    'Phase 25: lokale Foto-OCR mit QR-Personenzuordnung, Perspektivkorrektur, Formularraster und sicherem manuellen Pruefweg',
    'Phase 24: Handschriftprobe mit sechs klar getrennten und gerahmten Bereichen fuer Ziffern, Buchstaben, Verwechslungen und DP2-Praxis',
    'Phase 21: Wunschabgabe-Check nach Eingabeweg mit gezielter Erinnerung und globalem Undo/Redo für 40 Änderungen',
    'Phase 20: Original-Excelmatrix reparaturfrei wiederhergestellt, A4-Einseitendruck und großzügige Handschriftfelder',
    'Phase 19: live berechnete Bedarfsmatrix mit automatischer Konsistenz von Gesamt, Vorne und Hinten',
    'Phase 18: Bedarfswerte wieder direkt editierbar, kompakte Register und reparaturfreie personalisierte Excel-Ausgabe',
    'Phase 17: personalisiertes Formularpaket mit PDF-Verfügbarkeitsmatrix, Excel-Wunschmatrix und dreiseitiger Handschriftprobe',
    'Gemeinsame gespeicherte Profil-ID und datensparsamer QR-Bezug ohne Klarname oder interne Personen-ID',
    'Phase 16: gemeinsamer Import-Prüfkern für Excel, Foto und Handschrift mit Pseudonymzuordnung, Feldsicherheit, Überschneidungs- und Duplikatprüfung',
    'Persönlicher Handschriftprofil-Lernbogen V1 im Formularzentrum zum direkten Herunterladen',
    'Phase 14: konsolidierte Tagesauswahl, V/H-Stundenmatrix, Register Abweichungen und zentraler Formularbereich',
    'Chrome-Startoptimierung: Service-Worker-Metadaten werden pro Start geteilt statt für jede Laufzeitdatei erneut gelesen',
    'Phase 6: kompakte Bedarfssteuerung und registerbezogene Aktionsmenüs mit rechtem Ziehgriff',
    'Phase 5: Register Bedarf mit Tages-, Wochen- und Zeitraumansicht sowie PC-Manager-Wetter und Bühnenprogramm',
    'Phase 4: einheitlicher Wunschvertrag mit Sperrzeit und Sperrtag für Direkteingabe, Excel/CSV und Foto-Prüfung',
    'Phase 3: Register Fairnis mit Iststunden, personenspezifischer Vergleichsbasis, Filtern und zugänglicher Balkengrafik',
    'Beschleunigter Programmstart: verifizierter Release-Cache wird sofort angezeigt, vollständige Startprüfung läuft weiter im Hintergrund',
    'Phase 2: entschlackte Kopfzeile, kontextbezogene Hauptaktionen und zentrale Meldungszeile',
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
