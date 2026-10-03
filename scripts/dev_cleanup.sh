#!/usr/bin/env bash
# POSIX counterpart of scripts/dev_cleanup.ps1 (Linux runner / macOS): stops the dev servers a test run leaves behind
# and removes stale Playwright temp directories, so the machine never fills up.
#
#   scripts/dev_cleanup.sh [--ports "4173 4176 5173"] [--stop-backend] [--older-than-min 60] [--dry-run]
#
# Safety rules (same spirit as the PowerShell script, stricter on identity):
#   - Processes are selected ONLY by the TCP port they listen on, never by process name or command-line pattern.
#     The default ports are the Vite preview / dev servers (4173, 5173); pass --ports for the ones your run used.
#   - Port 8099 (the developer backend) is left alone unless --stop-backend is given.
#   - Only listeners owned by the current user are signalled (SIGTERM, then SIGKILL after 5 s if still listening).
#   - Temp directories are removed only when they match the exact prefixes Playwright creates in $TMPDIR and are
#     older than --older-than-min minutes (default 60), so a run in progress is not disturbed.
set -u

PORTS="${SW_CLEANUP_PORTS:-4173 5173}"
STOP_BACKEND=0
OLDER_MIN=60
DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --ports) PORTS="$2"; shift 2 ;;
    --stop-backend) STOP_BACKEND=1; shift ;;
    --older-than-min) OLDER_MIN="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ "$STOP_BACKEND" = 1 ] && PORTS="$PORTS 8099"

killed=()
me="$(id -u)"

listeners() { # prints "<pid>" for every process of this user listening on TCP port $1
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -H -ltnp "sport = :${port}" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u
  elif command -v lsof >/dev/null 2>&1; then
    lsof -t -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | sort -u
  fi
}

owner_uid() { # uid of a pid (Linux /proc, else ps)
  if [ -r "/proc/$1/status" ]; then awk '/^Uid:/{print $2}' "/proc/$1/status"; else ps -o uid= -p "$1" 2>/dev/null | tr -d ' '; fi
}

for port in $PORTS; do
  [ "$port" = 8099 ] && [ "$STOP_BACKEND" != 1 ] && continue
  for pid in $(listeners "$port"); do
    [ "$(owner_uid "$pid")" = "$me" ] || continue
    if [ "$DRY" = 1 ]; then echo "would stop pid $pid (port $port)"; continue; fi
    kill "$pid" 2>/dev/null || continue
    for _ in 1 2 3 4 5; do
      sleep 1
      [ -n "$(listeners "$port" | grep -x "$pid")" ] || break
    done
    if [ -n "$(listeners "$port" | grep -x "$pid")" ]; then kill -9 "$pid" 2>/dev/null; fi
    killed+=("port${port}:${pid}")
  done
done

tmp="${TMPDIR:-/tmp}"
removed=0
for pattern in 'playwright_chromiumdev_profile-*' 'playwright_firefoxdev_profile-*' 'playwright-artifacts-*' 'playwright-transform-cache-*'; do
  while IFS= read -r d; do
    [ -n "$d" ] || continue
    if [ "$DRY" = 1 ]; then echo "would remove $d"; else rm -rf -- "$d"; fi
    removed=$((removed + 1))
  done < <(find "$tmp" -maxdepth 1 -type d -name "$pattern" -user "$(id -un)" -mmin +"$OLDER_MIN" 2>/dev/null)
done

free_mb="$(awk '/MemAvailable/{printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo '?')"
echo "cleanup: stopped ${#killed[@]} [${killed[*]:-}] | temp dirs removed: ${removed} | available RAM MB: ${free_mb}"
