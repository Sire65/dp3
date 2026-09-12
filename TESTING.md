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
## KC TÜV

Die historischen KC-TÜV-Regeln sind in `.github/workflows/kc-tuev-baseline.yml` und `.github/workflows/web-deep-tuev.yml` umgesetzt.

- **Pflichtprüfungen:** JavaScript-/Python-Syntax, `npm audit`, optionale Python-Abhängigkeitsprüfung, Geheimnissuche, DP2-Smoke-Tests und Playwright-Browsertests.
- **Diagnoseberichte:** Lighthouse prüft Leistung, Barrierefreiheit und Web-Best-Practices. OWASP ZAP führt einen passiven Sicherheitsscan aus.
- **Zeitplan:** Baseline dienstags, Web-Tiefenprüfung donnerstags sowie zusätzlich bei Push, Pull Request und manuellem Start.

Lighthouse ist versionsfest in `package-lock.json` hinterlegt. OWASP ZAP läuft isoliert als Docker-Image in GitHub Actions und wird nicht in das DP2-Programm oder Installations-ZIP eingebaut.