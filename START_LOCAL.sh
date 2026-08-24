#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  echo "KC DP2 startet unter http://localhost:8000/"
  exec python3 -m http.server 8000
elif command -v python >/dev/null 2>&1; then
  echo "KC DP2 startet unter http://localhost:8000/"
  exec python -m http.server 8000
else
  echo "Python wurde nicht gefunden. Bitte einen statischen HTTP-Server verwenden." >&2
  exit 1
fi
