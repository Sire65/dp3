# Build 262 RC – persönliche Handschrift-Ziffernprofile

Bisher hatte der Matrix-Import allgemeine Tesseract-Erkennung, aber keinen Anschluss für persönliche Proben. Neu ist persönliches Ziffern-Vorlagenlernen; kein Tesseract-Neutraining.

Foto-Import → Handschriftprofil: Person wählen, PNG/JPG öffnen, jeweils eine handgeschriebene Ziffer einrahmen und richtig beschriften. Mehrere Proben je Ziffer sind möglich. Profilimport/-export und Speicherung im bestehenden verschlüsselten Gerätespeicher. Andere Personen benötigen roster.wish.edit_others; ein importiertes Profil muss zur ausgewählten aktiven Person passen. Private Profile bleiben außerhalb des öffentlichen Repositories. Andere PCs benötigen einen eigenen Import; die Profile sind nicht im bisherigen Gesamt-Backup enthalten.

Matrix-OCR lädt das Profil bei erkannter oder explizit zugeordneter Person. Normalisierte Zeichenmuster ergänzen die Uhrzeiterkennung. Widerspruch zur allgemeinen OCR bleibt unsicher. Persönliche Vorschläge bleiben unter der automatischen Freigabeschwelle; bewusste Prüfung ist erforderlich. Buchstaben, V/H/B und Freitext bleiben beim bisherigen Verfahren.

Klaus: 30 getrennte Ziffernvorlagen vorbereitet. Separat geschriebene 08:00 erkannt; 14:30 blieb unsicher und lieferte keinen persönlichen Vorschlag. Dieser begrenzte Test auf demselben Bogen belegt keine zuverlässig bessere Erkennung unabhängiger Matrizen. Keine Beispielzeiten als Dienstwünsche übernommen.

Neuer Browsertest test-handwriting-profile prüft Lernen, Uhrzeitsegmentierung, Speichern/Wiederladen, Zugriff, Profilformat und Prüfpflicht. Keine Datenbankänderung, kein Server-Einspielen.

Verifikation: npm test/Release, Syntax (229 JavaScript-Dateien), elf Browserprüfungen inklusive Profiltest grün. Profiltest prüft auch OCR-Widerspruch, unveränderten Weg ohne Profil, mobilen Dialog und Profilimport/Speichern.
