# KC DP2 – Tiefenkonsolidierung und TÜV Build 169

Stand: 28.08.2026

## Ergebnis

Build 169 wurde konsolidiert. Die unmittelbar offenen Bedienfehler wurden vor der Gesamtprüfung behoben:

- Gelöschte Soll-Dienste werden unmittelbar aus allen Planeransichten entfernt.
- Die schraffierte Kann-Zeit ist im Sollplan auswählbar, per Entf-Taste löschbar und per Rechtsklick bearbeitbar.
- Kontextmenü und Tastatur verwenden denselben revisionssicheren Löschpfad.
- Die Kann-Zeit erhält eine deutlich sichtbare Auswahlkontur.
- Die Verschiebelinie ist im Ruhezustand 6 px hoch, bei Hover/Ziehen 18 px und auf Touchgeräten 14 px.
- Cachekennungen und Releasebestand wurden auf Build 169 vereinheitlicht.

## Automatisierte Prüfverfahren

| Prüfgruppe | Einzelprüfungen | Ergebnis |
|---|---:|---|
| JavaScript-Syntaxprüfung mit Node.js | 133 | 133 bestanden |
| Kern- und UI-Vertragsassertionen | 100 | 100 bestanden |
| Release-Manifest: Datei, Größe und SHA-256 | 211 | 211 bestanden |
| Lokale Ressourcen über HTTP | 141 | 141 mit HTTP 200 |
| Geänderte Kernressourcen gegen Manifest | 6 | 6 bytegenau |
| Office-Paketprüfung DOCX/XLSX | 4 | 4 gültige ZIP/OOXML-Pakete |
| HTML-ID-Struktur | 50 IDs | keine Doppelung |
| Reale OCR-/Chrome-Probe | 1 Foto / 39 Prüffelder | technisch bestanden, fachliche Nachprüfung nötig |

Damit wurden deutlich mehr als die geforderten 50 einzelnen Verfahren ausgeführt.

## Besonders geprüfte Logik

- Pausenpflicht bei genau 6 Stunden, über 6 Stunden und über 9 Stunden.
- Überschneidungen von Diensten.
- Tagesbewertung und Besetzungsberechnung.
- Dynamische Löschung eines Soll-Dienstes einschließlich sofortigem Sichtbarkeitsfilter.
- Wunsch-, Soll- und Ist-Löschung per Tastatur und Kontextmenü.
- Wunsch/Kann-Kompositbalken und Herkunftsnachweis.
- Bedarf, V/H-Aufteilung und Live-Neuberechnung.
- Stundenmatrix, T/W/Z, aktive Tagesmarkierung und grafische Besetzung.
- Sammelauswahl, Konfliktprüfung und Tablet-Bedienung.
- Undo/Redo mit 40 Änderungen.
- Personalisierte Formulare, QR-Datenschutz und PDF-Datenstrom.
- Excel-/Word-Downloadvorlagen und Formularfelder.
- Update-Manifest, Cachekennung und vollständige HTTP-Auslieferung.

## Offener Qualitätsbefund OCR

Der bereitgestellte `Matrixplan.jpg` wurde mit dem echten lokalen Chrome-/OCR-Ablauf geprüft. Das Papier und das Tabellenraster wurden korrekt erkannt: 15 Zeilenbegrenzungen, 13 Spaltenbegrenzungen und 39 kontrollierbare Eingabefelder. Der personalisierte QR-Code und die handschriftlichen Zeiten wurden in dieser Aufnahme jedoch nicht sicher erkannt. DP2 übernimmt deshalb keine unsicheren Werte automatisch und kennzeichnet alle fehlenden Werte zur manuellen Nacharbeit. Das ist datensicher, die Erkennungsquote muss aber in einem späteren OCR-Optimierungssprint verbessert werden.

## Einschränkung der Prüfung

Die direkte Steuerung des eingebetteten Codex-Browsers war wegen einer lokalen Windows-ACL-Sperre des Browser-Testwerkzeugs nicht verfügbar. Die Browser-Laufzeit selbst wurde stattdessen durch den vorhandenen realen Chrome-OCR-Test, den lokalen HTTP-Server und die vollständige Ressourcenprüfung abgedeckt.