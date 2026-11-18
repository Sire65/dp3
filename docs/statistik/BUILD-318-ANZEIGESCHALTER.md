# Build 318 RC – Anzeige-Schalter an der Bereitschaftsleiste

Neben dem vorhandenen B-Schalter (Reihenfolge Besetzung/Bereitschaft) stehen im Wunschplan zwei zusätzliche Tasten:

- V/H/B ausblenden / einblenden: entfernt beziehungsweise zeigt die drei Bereichszeilen. Die Personenampel bleibt sichtbar und unverändert.
- Bereiche färben / Bereiche neutral: schaltet eine eigenständige Bereichsprüfung zu. Beim Einschalten werden ausgeblendete Bereichszeilen wieder sichtbar.

Die Einstellung wird ausschließlich lokal als Ansichtsvorliebe gespeichert. Sie übersteht erneutes Öffnen der Seite und verändert weder Planung noch Bedarf. Der vorhandene B-Schalter und die Verschiebelinie bleiben erhalten. Die PDF-Ausgabe folgt der gewählten Sichtbarkeit und zeigt bei aktivierten Bereichsfarben die passende Legende.

## Bereichsprüfung

V/H werden mit ihrem jeweiligen Bedarf verglichen: rot zu wenig, grün genau passend, gelb zu viel. B ist ein gemeinsamer Pool: Für die reine Prüfrechnung wird zuerst die V-Lücke, dann die H-Lücke gefüllt. Eine B-Person kann dabei nur einmal verwendet werden. Ein Stern markiert rechnerisch aus B ergänzte Bereichszahlen. Die B-Zeile vergleicht vorhandene B-Personen mit den offenen V+H-Plätzen.

Es werden keine Personen konkret zugeteilt und keine Dienste erzeugt. Die Gesamtampel aus Build 317 bleibt ausschließlich vom Gesamtpersonenbedarf abhängig; Bereichsfarben sind zusätzliche Informationen.

## Prüfung

tools/test-staffing-display-options.mjs prüft die Position am vorhandenen B-Schalter, Ausblenden und Wiederladen, gemerkte Bereichsfarben, einen B-Pool von drei Personen für 2 V + 1 H, Bereichslücken bei unverändert grüner Gesamtampel, Rückkehr zur neutralen Darstellung, den bisherigen Bereitschaftstausch und unveränderte Daten. Die neuen Tasten sind mindestens 44 Pixel hoch.
