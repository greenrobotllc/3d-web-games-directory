#!/usr/bin/env bash
# Run the audit inside a locked-down container, so game sites are never opened in a
# browser on this machine directly.
#
#   npm run audit:docker                          # every game
#   npm run audit:docker -- slow-roads townscaper  # specific games
#
# The report, screenshots and contact sheets go to ./audit-report, or to $AUDIT_OUT.
# The container gets: the internet, read-only copies of scripts/ and games/, and one
# writable output folder. It has no other access to this machine's files, no Linux
# capabilities, a read-only filesystem, and memory and process limits.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=3dwg-audit
OUT="${AUDIT_OUT:-$PWD/audit-report}"

if ! docker info >/dev/null 2>&1; then
    echo "Docker isn't running. Start Docker Desktop (on a Mac: open -a Docker) and try again." >&2
    exit 2
fi

docker build --quiet --tag "$IMAGE" --file scripts/docker/Dockerfile . >/dev/null
mkdir -p "$OUT"

status=0
docker run --rm \
    --cap-drop=ALL \
    --security-opt no-new-privileges \
    --read-only \
    --tmpfs /tmp:exec,size=1g \
    --tmpfs /home/node:size=512m,uid=1000,gid=1000 \
    --shm-size=1g \
    --memory=3g \
    --pids-limit=512 \
    --volume "$PWD/scripts:/app/scripts:ro" \
    --volume "$PWD/games:/app/games:ro" \
    --volume "$OUT:/out" \
    "$IMAGE" --out /out "$@" || status=$?

echo "Report folder on this machine: $OUT"
exit "$status"
