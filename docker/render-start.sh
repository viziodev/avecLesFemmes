#!/usr/bin/env bash
set -euo pipefail
PORT=3000 HOST=127.0.0.1 node dist/main.js &
api_pid=$!
nginx -c /app/docker/render-nginx.conf -g 'daemon off;' &
web_pid=$!
cleanup() { kill "$api_pid" "$web_pid" 2>/dev/null || true; wait "$api_pid" "$web_pid" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 0' TERM INT
set +e
wait -n "$api_pid" "$web_pid"
status=$?
set -e
# La fin inattendue de l’un des processus doit faire redémarrer le conteneur.
if [ "$status" -eq 0 ]; then status=1; fi
exit "$status"
