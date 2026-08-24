# KC DP2 V0.20 – Backlog: Persönliches Handschriftprofil

Status: vorgemerkt für eine spätere Import-/Foto-Phase  
Priorität: sinnvoll nach Stabilisierung des allgemeinen Excel-, Matrix- und Fotoimports

## Ziel

DP2 erhält optional ein persönliches Handschriftprofil je Mitglied. Es verbessert die Erkennung handschriftlicher Wunschzeiten, Sperren, Reserven und Korrekturen, ersetzt aber niemals die allgemeine Erkennung oder die menschliche Importvorschau.

## Grundprinzip

```text
allgemeine Handschrifterkennung
  + persönliches Schriftprofil
  + DP2-Plausibilitätsprüfung
  -> Erkennungsvorschlag mit Konfidenz
  -> sichtbare Bestätigung vor Übernahme
```

Keine erkannte Handschrift wird ungeprüft direkt als Wunsch-, Soll- oder Istzeit angewendet.

## Persönlicher Lernbogen

DP2 erzeugt einen druckbaren Lernbogen mit:

- KC-Logo und Bezeichnung „Persönliches Handschriftprofil“
- Mitgliedsbezug über interne Profil-ID
- zufällige Bogen-ID
- QR-Code ohne ausgeschriebenen Namen oder andere unnötige Personendaten
- Bogenversion und Layoutversion
- Erstellzeitpunkt und Status
- eindeutige Seiten- und Feldmarkierungen

## Trainingsfelder

### Pflichtblock Ziffern

- `0 1 2 3 4 5 6 7 8 9`
- jedes Zeichen mindestens dreimal
- zusätzliche Verwechslungsgruppen: `0/O`, `1/I/l`, `2/Z`, `5/S`, `6/G`, `9/g`

### Buchstaben

- `A–Z`
- optional `a–z`
- Umlaute und Sonderzeichen: `Ä Ö Ü ä ö ü ß`

### DP2-Praxisblock

- Uhrzeiten: `08:00`, `11:00`, `14:30`, `18–23`
- Datum: `04.12.`, `12.12.2026`
- Bereiche: `V`, `H`, `B`, `Z`
- Statusbegriffe: `frei`, `Urlaub`, `gesperrt`, `Reserve`
- Veranstaltung: `Aufbau`, `Abbau`, `Vorbereitung`, `Nachbereitung`
- kurze typische Wunsch- und Korrekturtexte

## Einlesefluss

1. QR-Code lesen.
2. Bogen-ID und Bogenversion prüfen.
3. Mitgliedsprofil intern zuordnen.
4. Perspektive, Drehung und Feldraster korrigieren.
5. Schriftproben pro Soll-Zeichen ausschneiden.
6. Qualität und Vollständigkeit bewerten.
7. Unsichere oder fehlende Zeichen zur Nachschulung markieren.
8. Profil erst nach ausdrücklicher Bestätigung speichern.
9. Importvorgang vollständig auditieren.

## Profilzustände

- nicht angelegt
- begonnen
- unvollständig
- einsatzbereit
- Nachlernen empfohlen
- gesperrt
- gelöscht

Beispielanzeige:

```text
Handschriftprofil 94 % vollständig
Ziffer 7: sicher
Buchstabe Z: Nachlernen empfohlen
Letzte Aktualisierung: 24.08.2026
```

## Datenmodell – Entwurf

```text
handwriting_profile
  profileId
  personId
  status
  sheetVersion
  modelVersion
  completeness
  qualityScore
  createdAt / updatedAt
  consentAt / consentBy

handwriting_sample
  sampleId
  profileId
  expectedCharacter
  sampleIndex
  imageReference
  qualityScore
  accepted
  createdAt

handwriting_sheet
  sheetId
  profileId
  randomToken
  sheetVersion
  issuedAt
  scannedAt
  auditReference
```

Die konkrete Speicherung von Bildausschnitten wird erst nach Architektur- und Speicherprüfung festgelegt.

## Sicherheit und Kontrolle

- rollenbasierter Zugriff
- ausdrückliche Information und Zustimmung des Mitglieds
- Zweckbindung ausschließlich für DP2-Handschrifterkennung
- keine Profil-ID mit Klarname im QR-Code
- kein stilles Training aus normalen Dienstplanbögen
- sichtbare Importvorschau mit Konfidenzwerten
- vollständiges Audit für Erstellen, Nachlernen, Verwenden und Löschen
- Funktion „Handschriftprofil löschen“
- Funktion „vollständig neu anlernen“
- Export-/Aufbewahrungsregeln vor Aktivierung festlegen

## Technische Integrationsregel

Das Handschriftprofil wird als zusätzlicher Provider hinter `photo-recognition.js` angebunden. Die bestehende Importnormalisierung und die Vorschau bleiben maßgeblich. Es entsteht kein zweiter direkter Schreibpfad in `K.wishes`, `K.shifts` oder `K.actualShifts`.

## Voraussetzungen vor Umsetzung

- allgemeiner Foto-/Matriximport mit realen Bögen stabil
- endgültiger Wunsch-/Reserve-/Sperren-Datenvertrag vorhanden
- QR-Bogenvertrag und Versionsstrategie festgelegt
- Speicherort und Löschkonzept freigegeben
- Desktop-, Tablet- und Handy-Fotoablauf getestet
- Testgruppe und geeignete Referenzbögen vorhanden

## Einordnung in V0.20

Empfohlene Umsetzung nach der stabilen Wunschplan- und Importphase, vor oder gemeinsam mit dem erweiterten KI-/Fotoausbau. Das Thema darf Phase 1 und Phase 2 nicht blockieren.
