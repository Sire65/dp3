# Phase 19 · Build 116

- Änderungen in der Bedarfsmatrix werden während der Eingabe sofort neu berechnet.
- Wird Vorne oder Hinten geändert, folgt Grundbedarf automatisch als Summe aus V + H.
- Wird Grundbedarf geändert, wird die Aufteilung konsistent angepasst; eine bestehende Vorne-Zahl bleibt soweit möglich erhalten, Hinten erhält den Rest.
- Empfehlung, Sollabweichung, Zeilenstatus und die oberen Stunden-KPIs reagieren unmittelbar auf den neuen Entwurf.
- Erst „Grundbedarf speichern“ übernimmt die Werte dauerhaft; „Abbrechen“ verwirft den Entwurf.
