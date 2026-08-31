# Build 96 · Startfix

Der neue T/W/Z-DOM-Beobachter schrieb seine Beschriftungen bei jedem Durchlauf erneut und konnte dadurch eine endlose MutationObserver-Schleife erzeugen. Build 96 aktualisiert Text, Tooltip und ARIA-Beschriftung ausschließlich bei einer tatsächlichen Abweichung. Dadurch bleibt die Dekoration idempotent und blockiert den Browser nicht mehr.
