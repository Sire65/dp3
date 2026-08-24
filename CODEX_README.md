# KC DP2 – Codex-Prüfpaket

**Stand:** KC DP2 V0.19.55 **Build 84 (stabilisierter Prüfstand mit Zeilenmarkierung)**  
**Quelle:** Produktionsstand aus dem verifizierten GitHub-Pages-Build von `Sire65/Dienstplan` (`main`).  
**Web-Root:** dieser Ordner.

## Lokal starten

Die Anwendung ist eine statische PWA und sollte über HTTP gestartet werden (nicht per `file://`), damit Service Worker, Cache und Update-Logik korrekt geprüft werden können.

### Windows
Doppelklick auf `START_LOCAL_WINDOWS.bat` oder im Terminal:

```bat
python -m http.server 8000
```

Danach öffnen: `http://localhost:8000/`

### macOS/Linux

```bash
./START_LOCAL.sh
```

oder:

```bash
python3 -m http.server 8000
```

## Gewünschter Codex-Check

Bitte den kompletten Stand prüfen, besonders:

1. Login → lokaler Sicherheitsschlüssel → Programmstart. Nach `local-key-valid` darf nicht erneut die Passwort-Anmeldung erscheinen.
2. Logout → erneute Anmeldung → lokaler Schlüssel, mehrfach hintereinander.
3. `src/ui/session-mobile-hotfix.js` und `src/ui/post-unlock-auth-guard.js` auf Race Conditions, doppelte Wrapper und widersprüchliche Auth-Zustände prüfen.
4. `src/ui/update-ui.js` auf ältere Login-/Session-Wrapper prüfen, die mit den neueren Guards kollidieren können.
5. Automatische Update-Erkennung: V0.19.55 Build 84, `src/core/update-build-guard.js`, `update-manifest.json`, Service Worker und Cache-Migration.
6. Prüfen, ob bei gleichem Versionsstand eine höhere Buildnummer zuverlässig erkannt und installiert wird.
7. Prüfen, ob Service Worker oder Browsercache alte JS-Dateien trotz neuer Buildnummer ausliefern können.
8. Alle JavaScript-Dateien syntaktisch prüfen und offensichtliche Deadlocks/Endlosschleifen/MutationObserver-Kaskaden melden.
9. Keine funktionierenden Bereiche unnötig umbauen. Zuerst Ursache und konkrete Änderungsvorschläge nennen.

## Erwartete Diagnosemarker

Beim aktuellen Fix sind insbesondere diese Startprotokoll-Einträge relevant:

- `post-unlock-guard-ready`
- `post-unlock-auth-captured`
- `post-unlock-auth-restored`
- `login-gate-state-repair`
- `login-gate-restored`
- `startup-auth-complete`

Problematisch wäre weiterhin:

`local-key-valid` → `login-gate-open` → erneute Passwort-Anmeldung.

## Wichtige Dateien

- `index.html`
- `service-worker.js`
- `update-manifest.json`
- `src/core/update-manager.js`
- `src/core/update-build-guard.js`
- `src/core/member-access.js`
- `src/ui/update-ui.js`
- `src/ui/role-ux.js`
- `src/ui/session-mobile-hotfix.js`
- `src/ui/post-unlock-auth-guard.js`
- `src/core/login-trace.js`
- `src/adapters/storage.js`
- `src/adapters/supabase-provider.js`

Die ZIP enthält keine von mir ergänzten Passwörter, Tokens oder privaten Sicherheitsschlüssel.
