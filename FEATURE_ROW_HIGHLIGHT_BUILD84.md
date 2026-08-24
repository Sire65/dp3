# Build 84 – Zeilenmarkierung beim Verschieben

Die Balkengrafik markiert jetzt die komplette Mitarbeiterzeile vom Namen bis zur letzten Uhrzeit.

- Anklicken oder Anfassen eines Dienstbalkens: Ausgangszeile pastellgelb.
- Ziehen über eine gültige andere Zeile: Zielzeile pastellgrün mit Kennzeichnung „Ziel“.
- Ziehen über eine ungültige Zeile: Zielzeile pastellrot mit Kennzeichnung „Ziel“.
- Während des Ziehens bleibt die Ausgangszeile mit „Start“ sichtbar.
- Nach erfolgreichem Ablegen leuchtet die Zielzeile kurz grün und bleibt anschließend als ausgewählte Zeile gelb markiert.
- Bei ungültigem Ablegen leuchtet die abgelehnte Zielzeile kurz rot; der Balken bleibt unverändert in seiner Ausgangszeile.
- Ein abgebrochener Pointer-/Touch-Vorgang stellt die unveränderte Darstellung wieder her.

Geändert wurden ausschließlich `src/ui/app.js`, `src/ui/app.css` sowie die für einen korrekten Update-Build notwendigen Release-/Manifestdateien. Bestehende Dienstplandaten und andere Funktionen wurden nicht gelöscht oder umgebaut.
