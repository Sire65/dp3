# Build 292 RC – ein Update, ein fester Stand

Ein gemeinsamer Updateprüfer. Während Installation und nach Erfolg keine neue Aufforderung. Parallele Installationen werden mit Web Locks über Tabs hinweg gesperrt. GitHub-Commit per API auflösen; Manifest und Dateien ausschließlich von derselben unveränderlichen Commitadresse laden. Fehlende Commitkennung verhindert die Installation, statt mutable Downloads zu erlauben. Prüfsummen bleiben zwingend. Claudes Builds 283–291 sind enthalten. Keine Datenbankmigration und keine Änderung an Mitgliederdaten.

Service Worker wird von Anwendung und Update-Manager unter derselben stabilen URL registriert. Test: falsche Hashes blockieren, alle Dateien verwenden dieselbe Commitkennung, paralleler Installationsversuch blockiert, nach erfolgreicher Installation/Neustart kein erneutes Angebot desselben Builds, neun verschlüsselte Testeinträge erhalten.
