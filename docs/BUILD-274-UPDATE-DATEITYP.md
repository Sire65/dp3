# Build 274 RC

Update-Dateien erhalten ihren Auslieferungstyp anhand des verifizierten Installationspfads. GitHub Raw liefert HTML, JavaScript und CSS als text/plain; diese Transportangabe darf nicht im Laufzeitcache übernommen werden. Browser-Updateprüfung simuliert jetzt genau diesen Fall und prüft den anschließenden Neustart mit unveränderten neun verschlüsselten Testdatensätzen. Bereits falsch gespeicherte Dateitypen benötigen eine Cache-Reparatur, ohne lokale Datenbanken anzutasten.
