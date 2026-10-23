# Build 302 RC – Update-Aktivierung

## Ausgangspunkt

Bericht KCDP-UPD-1792771754924-3KMJE6: Abbruch in activate im Update-Manager mit Cachekennung b292, Chrome155, lokaler Ursprung8765. Der Bericht enthält weder laufenden Worker noch Zielbuild; die konkrete Live-Ursache ist damit nicht bewiesen. Der lokale Server war bei der Untersuchung nicht erreichbar und wurde aus dem aktuellen Arbeitsordner neu gestartet.

## Änderungen

- Registrierung der aktuellen Worker-URL und explizites update statt ausschließlichem Aktualisieren einer unbekannten alten Registrierung. Aktivierung muss tatsächlich abgeschlossen sein; Timeout bedeutet keinen stillen Erfolg.
- Protokollprüfung über separaten MessageChannel vor dem Umschalten.
- Aktivierungsbeleg enthält Cache und zufällige Vorgangsnummer. Antwortverlust wird nur durch genau diesen gespeicherten Beleg bestätigt. Eine fremde Vorgangsnummer gilt nie als Erfolg.
- Positive Antwort nach dauerhaftem Metadaten-Schreiben und vor nichtkritischer Bereinigung alter Programmcaches.
- Bericht nennt Zielbuild, aktuellen Build und Worker-Kennung. Bei fehlender Bestätigung behauptet das Fenster nicht mehr pauschal, welcher Programmstand aktiv ist.
- Keine Tabellen-, Planungsdaten- oder IndexedDB-Migration. Keine Browserdaten löschen.

## Prüfung

Browsertest test-local-update.mjs: alte funktionslose Worker-Registrierung ersetzen, Hashfehler ohne Umschalten, erfolgreicher Wechsel, verlorene Antwort über eigenen Beleg erkennen, fremden Beleg ablehnen, neun verschlüsselte Wunschdatensätze nach Neustart erhalten. npm test grün. Live-Abnahme am geöffneten Benutzerbrowser bleibt erforderlich.

## Nutzung

Seite einmal neu laden und Update erneut prüfen. Die lokale Serveradresse muss aus dem aktuellen Programmordner bedient werden. Falls weiterhin ein alter Dienst antwortet, Bericht herunterladen; nicht IndexedDB oder Browserdaten löschen.
