# DP2 testen

Die externe Testumgebung ist über `package.json` und `package-lock.json` versionsfest definiert.

## Einmalige Einrichtung

```powershell
npm install
npm run test:install-browser
```

`node_modules` und die großen Playwright-Browserdateien werden bewusst nicht in Git gespeichert. `npm install` verwendet die eingecheckte Sperrdatei; der Browser wird in den lokalen Playwright-Cache geladen.

## Prüfungen

```powershell
npm test                       # schnelle Kern- und Releaseprüfungen
npm run test:browser           # zentrale Twinkey- und Eingabeabläufe im Browser
npm run test:all               # beide Gruppen nacheinander
npm run test:browser:extended  # zusätzliche Admin-, Mitglieder- und Bedarfsprüfungen
```

Der Foto-OCR-Einzeltest benötigt zusätzlich einen konkreten Bildpfad:

```powershell
node tools/test-form-ocr-sample.mjs "C:\Pfad\zum\Formularbild.png"
```

Aktuell benötigte externe Testsoftware: Node.js/npm und Playwright mit Chromium. Weitere Bibliotheken werden ergänzt, sobald ein Test sie tatsächlich benötigt.