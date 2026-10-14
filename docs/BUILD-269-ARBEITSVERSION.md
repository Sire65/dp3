# Build 269 RC – Arbeitsversion zum Planer-Import

Basis: Build 268 RC, 769305a. Startwerkzeug korrigiert: Build 269 statt 216, kein erzwungenes offline=1 für den Supabase-Import. Die vorhandene Serveradresse 127.0.0.1:8765 bleibt erhalten.

Browsertests wählen die seit Build 268 vorgeschriebene generelle Bereitschaft ausdrücklich, statt den Dialog ohne Antwort zu überspringen. Datenformat, Speicherung, Reservierung und Konfliktentscheidungen bleiben unverändert.

Reproduzierbares Laufzeitpaket mit Manifest, Startwerkzeug und Anleitung; keine lokalen Mitgliederdaten oder Zugangswerte. Arbeitsversion bleibt RC. Automatisierte Import-/Konfliktprüfungen ersetzen nicht den echten Zwei-PC- und Wiederherstellungstest.
