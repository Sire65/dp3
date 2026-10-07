# Build 252 RC – Club-App und direkte DP2-Eingaben abgleichen

## Verhalten

Vor einer Übernahme werden vorhandene Tagesangaben unabhängig vom Eingabeweg verglichen: direkte Eingabe, Twinkey und frühere Club-App-Übernahmen. Ein Unterschied bei vorhandenen Daten stoppt die komplette Übernahme und lässt den Servereingang offen. Der Mail-/Posteingang-Button zeigt die Zahl der Prüffälle.

Im Club-App-Eingang stehen je betroffenem Tag die vorhandenen und neuen Angaben mit Uhrzeiten, Zeitart, Bereich, Kommentar und Bereitschaft. Der Planer muss ausdrücklich „DP2-Angaben behalten“ oder „Mit Handy-Angaben überschreiben“ wählen. Es gibt keine Vorauswahl. Übernommen wird erst, wenn alle Konflikttage entschieden sind. Die Auswahl betrifft den vollständigen Tageswunsch einschließlich Sperren und Bereitschaft; Soll-/Ist-Dienste werden nicht geändert.

Ein leerer neuer Club-App-Tagesstand kann eine Löschung bedeuten; auch das erfordert eine Entscheidung. Direkte DP2-Tage außerhalb der betroffenen Daten bleiben erhalten. Ungültige Eingänge werden nicht mehr teilweise importiert und als übernommen quittiert, sondern bleiben zur Korrektur offen.

Vor der Entscheidung wird bei verbundenem Sync-Provider der aktuelle DP2-Stand nachgeladen. Offene Synchronisationskonflikte sperren die Übernahme. Der Club-App-Eingang wird erneut vom Server gelesen. Änderungen an Revision, Eingang, lokalem Tagesbestand oder Bereitschaft machen die bisherige Entscheidung ungültig. Die Auswahl muss dann wiederholt werden. Audit und Quittierung enthalten die behaltenen/ersetzten Tage. Bei veralteter Quittierung wird auch eine bestätigte Ersetzung direkter DP2-Daten zurückgerollt.

## Prüfung

Automatisiert: Behalten/Ersetzen, fehlende Auswahl, direkte Twinkey-Daten mit Bereitschaft, neue Handy-Version während der Vorschau, DP2-/Bereitschaftsänderung während der Vorschau, bestätigte Löschung, ungültige Eingänge, Rückrollen direkter Daten, Wiederanlauf nach unterbrochener Quittierung und bestehende Schnittstellentests. Browserprüfung des echten Dialogs und der Behalten-Entscheidung bei 320/390/768/1280 Pixeln, einschließlich escaped Textausgabe.

## Übergabe an Claude / Grenzen

Die Konfliktentscheidung sitzt im DP2-Planer-Posteingang. Sie ist keine neue Warnung beim Absenden in der Club-App. Eine solche frühere Mitgliederwarnung benötigt dort einen aktuellen DP2-Vergleichsstand und eine bestätigte Basisversion beim Absenden; bitte nicht allein aus Zeitstempeln ableiten, welche Eingabe richtig ist.

Keine Live-Mitgliederdaten wurden für diese Tests geändert oder quittiert. Stevens tatsächlicher Eingang bleibt von diesen Tests unberührt. Keine Backend-Schemaänderungen. Die bestehende ACK-Schnittstelle prüft die Inbox-Revision, bietet aber keine atomare Sperre über mehrere gleichzeitig importierende DP2-PCs und verschlüsselte Planoperationen. Für eine vollständige geräteübergreifende Transaktionsgarantie ist eine serverseitige Claim-/Versionsprüfung nötig. Zentrale Kollegenfreigabe und Live-Handtest bleiben offen.
