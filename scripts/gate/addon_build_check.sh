#!/usr/bin/env bash
# SUPERVISOR-BUILD-GATE-2341: build the add-on image the way the HA Supervisor builds it, then smoke-test it.
#
# 2.31.0 shipped with BUILD_FROM / build.yaml pinned to name:tag@sha256:... and the Supervisor build failed on the lab
# ("pip install ... exit code: 127"). release_check.py has the static rules (fast, everywhere); this script is the real build.
#
# What the Supervisor does for a local add-on: `docker build` of the add-on folder (the context) with its Dockerfile and the
# build args BUILD_FROM (build.yaml build_from.<arch>; Supervisors from 2026.04 read the Dockerfile's ARG default, which
# release_check.py requires to be the same string), BUILD_VERSION (config.yaml version) and BUILD_ARCH. This script runs exactly
# that for amd64 (the runner's arch), with the layer cache (no --no-cache), then inside the image (--network none, the s6
# entrypoint bypassed, nothing reaches the lab):
#   1. python3 -c 'import smplwise' and its __version__ = config.yaml version
#   2. the server import smoke test: from smplwise.main import create_app; create_app()
#   3. the server itself: python3 -m smplwise on 127.0.0.1, GET /healthz within 90 s
#   4. the system tools the Dockerfile installs: pdftoppm, pdfinfo, ffmpeg
#   5. PY-CONSTRAINTS-LOCK-2407: the installed Python set = smplwise_vms/backend/constraints.txt (every pin installed at its
#      exact version, nothing outside the lock but the base image's own pip / setuptools / wheel)
# The Python lock is also checked before the engine probe, so it runs on a machine without docker too:
#   lock_static  scripts/lock_python.py --check (offline): every direct requirement pinned in constraints.txt and satisfied
#   lock_wheels  scripts/lock_python.py --verify-wheels: every pin has a CPython 3.12 musllinux wheel for amd64 and aarch64 (PyPI)
#   lock_pip     scripts/lock_python.py --pip-resolve --arch amd64: pip in a clean venv of this python3 resolves
#                -r requirements.txt -c constraints.txt for musllinux / CPython 3.12 to exactly the lock (exact on a Linux
#                amd64 host - the runner; skipped elsewhere)
# lock_static fails the check; lock_wheels / lock_pip fail it when PyPI answers and the lock is wrong, and are NOT_RUN offline.
# Without an engine the result stays NOT_RUN (the image was not built) unless a lock step FAILED.
#
# Usage: addon_build_check.sh [--root <checkout>] [--json <out.json>] [--detect-only] [--lock-only]
#   --root         the checkout to build (default: this script's repository)
#   --json         write the result as JSON ({result, reason, engine, image, base, version, seconds, steps, log_tail})
#   --detect-only  only the read-only engine probe: PASS = an engine answers, NOT_RUN = none (nothing is built)
#   --lock-only    only the three Python lock steps (no engine probe, no build): PASS / FAIL / NOT_RUN of those
# Environment:
#   ADDON_BUILD_ENGINE  auto (default: docker only) | docker | podman (opt-in; rootless podman did not answer on the runner)
#   ADDON_BUILD_SECS    the whole budget in seconds (default 600 = the gate's 10-minute stage budget)
#   ADDON_BUILD_BUILDER plain (default: the Supervisor's own docker build) | ha (the official ghcr.io/home-assistant/amd64-builder,
#                       used only when that image is already present locally and the engine is docker; NOT verified on the
#                       runner yet - the Supervisor itself does not use it)
#   ADDON_BUILD_LOCK    all (default: lock_static + lock_wheels + lock_pip) | static (offline lock_static only; the hermetic
#                       tests use it)
# Exit: 0 PASS, 1 FAIL, 3 NOT_RUN (no container engine: nothing is installed, the owner's install steps are printed), 2 usage.
# The last line is always "ADDON_BUILD: PASS|FAIL|NOT_RUN - <reason>". It never installs, pulls a builder, pushes, or removes an
# image other than the dangling layers of its own label (smplwise.gate=addon-build).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
JSON=""
DETECT=0
LOCK_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --root) ROOT="${2:-}"; shift 2 ;;
    --json) JSON="${2:-}"; shift 2 ;;
    --detect-only) DETECT=1; shift ;;
    --lock-only) LOCK_ONLY=1; shift ;;
    -h|--help) sed -n '2,/^set -uo/p' "$0" | sed '$d'; exit 0 ;;
    *) echo "unknown argument: $1"; exit 2 ;;
  esac
done
ADDON="$ROOT/smplwise_vms"
BUDGET="${ADDON_BUILD_SECS:-600}"
ENGINE_WANT="${ADDON_BUILD_ENGINE:-auto}"
BUILDER="${ADDON_BUILD_BUILDER:-plain}"
LOCK_MODE="${ADDON_BUILD_LOCK:-all}"
case "$LOCK_MODE" in all|static) ;; *) echo "ADDON_BUILD_LOCK must be all or static"; exit 2 ;; esac
T0=$(date +%s)
WORK="$(mktemp -d "${TMPDIR:-/tmp}/addon-build.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
LOG="$WORK/build.log"
: > "$LOG"
STEPS=""
ENGINE=""
ENGINE_VER=""
IMG="smplwise-gate/amd64-addon-smplwise_vms:gate"
BASE=""
VER=""

left() { echo $(( BUDGET - ($(date +%s) - T0) )); }

finish() {   # finish <result> <exit> <reason>
  local res="$1" code="$2" reason="$3"
  if [ -n "$JSON" ]; then
    R="$res" REASON="$reason" ENG="$ENGINE" ENGV="$ENGINE_VER" IMGN="$IMG" BASEI="$BASE" V="$VER" SECS="$(( $(date +%s) - T0 ))" \
    ST="$STEPS" LOGF="$LOG" BLD="$BUILDER" python3 - "$JSON" <<'PY'
import json, os, sys
e = os.environ
tail = open(e["LOGF"], encoding="utf-8", errors="replace").read().splitlines()[-40:] if os.path.exists(e["LOGF"]) else []
steps = [dict(zip(("name", "result", "seconds"), s.split(":", 2))) for s in e["ST"].split() if s]
json.dump({"result": e["R"], "reason": e["REASON"], "engine": e["ENG"], "engine_version": e["ENGV"], "builder": e["BLD"],
           "image": e["IMGN"], "base": e["BASEI"], "version": e["V"], "seconds": int(e["SECS"]), "steps": steps,
           "log_tail": tail}, open(sys.argv[1], "w", encoding="utf-8"), indent=1)
PY
  fi
  if [ "$res" = "FAIL" ]; then
    echo "--- log tail"
    tail -n 40 "$LOG"
  fi
  echo "ADDON_BUILD: $res - $reason"
  exit "$code"
}

install_steps() {
  cat <<'TXT'
No container engine answered on this machine, so the Supervisor build check did NOT run (nothing was installed).
Owner steps to enable it on the runner (Ubuntu 24.04), once, outside a gate:
  sudo apt-get update && sudo apt-get install -y docker.io docker-buildx
  sudo usermod -aG docker "$USER"          # membership of the docker group is root-equivalent on this host
  # log out and in again (or reboot), then check:
  docker version && docker run --rm hello-world
  # optional warm-up of the layer cache (about 1-3 GB in /var/lib/docker):
  bash ~/work/gate-<branch>/scripts/gate/addon_build_check.sh --root ~/work/gate-<branch>
The gate then runs the check by itself (release_gate.py stage "addon_build", GATE_ADDON_BUILD=auto).
TXT
}

step() {   # step <name> <cmd...>: run with the remaining budget; record name:PASS|FAIL:seconds
  local name="$1"; shift
  local t=$(date +%s) rem
  rem=$(left)
  if [ "$rem" -lt 10 ]; then
    STEPS="$STEPS $name:TIMEOUT:0"
    finish FAIL 1 "time budget (${BUDGET}s) exhausted before step $name"
  fi
  echo "== $name" >> "$LOG"
  timeout -k 10 "$rem" "$@" >> "$LOG" 2>&1
  local rc=$?
  local d=$(( $(date +%s) - t ))
  if [ $rc -eq 0 ]; then STEPS="$STEPS $name:PASS:$d"; return 0; fi
  STEPS="$STEPS $name:FAIL:$d"
  if [ $rc -eq 124 ] || [ $rc -eq 137 ]; then
    finish FAIL 1 "step $name hit the time budget (${BUDGET}s total)"
  fi
  finish FAIL 1 "step $name failed (rc=$rc)"
}

# --- 0. the Python constraints lock (PY-CONSTRAINTS-LOCK-2407), with or without an engine
LOCK_NOTE=""
lock_step() {   # lock_step <name> <lock_python.py args...>: rc 0 PASS, 3 NOT_RUN (recorded, not fatal), else FAIL (fatal)
  local name="$1"; shift
  local t=$(date +%s) rem rc line
  rem=$(left)
  if [ "$rem" -lt 10 ]; then STEPS="$STEPS $name:TIMEOUT:0"; finish FAIL 1 "time budget (${BUDGET}s) exhausted before step $name"; fi
  echo "== $name" >> "$LOG"
  timeout -k 10 "$rem" python3 "$ROOT/scripts/lock_python.py" --root "$ROOT" "$@" > "$WORK/$name.out" 2>&1
  rc=$?
  cat "$WORK/$name.out" >> "$LOG"
  line="$(grep '^LOCK_PYTHON' "$WORK/$name.out" | tail -n 1 | cut -c1-200)"
  local d=$(( $(date +%s) - t ))
  case $rc in
    0) STEPS="$STEPS $name:PASS:$d" ;;
    3) STEPS="$STEPS $name:NOT_RUN:$d"; LOCK_NOTE="$LOCK_NOTE; $name NOT_RUN" ;;
    124|137) STEPS="$STEPS $name:FAIL:$d"; finish FAIL 1 "step $name hit the time budget (${BUDGET}s total)" ;;
    *) STEPS="$STEPS $name:FAIL:$d"; finish FAIL 1 "step $name failed (rc=$rc): ${line:-see the log}" ;;
  esac
}
if [ "$DETECT" = 0 ]; then
  if [ ! -f "$ROOT/smplwise_vms/backend/constraints.txt" ] || [ ! -f "$ROOT/scripts/lock_python.py" ]; then
    STEPS="$STEPS lock_static:FAIL:0"
    finish FAIL 1 "no smplwise_vms/backend/constraints.txt or scripts/lock_python.py (PY-CONSTRAINTS-LOCK-2407)"
  fi
  lock_step lock_static --check
  if [ "$LOCK_MODE" = all ]; then
    lock_step lock_wheels --verify-wheels
    lock_step lock_pip --pip-resolve --arch amd64
  else
    STEPS="$STEPS lock_wheels:NOT_RUN:0 lock_pip:NOT_RUN:0"; LOCK_NOTE="$LOCK_NOTE; lock_wheels/lock_pip NOT_RUN (ADDON_BUILD_LOCK=static)"
  fi
  if [ "$LOCK_ONLY" = 1 ]; then
    if [ -n "$LOCK_NOTE" ]; then
      finish NOT_RUN 3 "Python lock steps: $(echo "$STEPS" | tr ' ' '\n' | grep '^lock_' | cut -d: -f1,2 | tr '\n' ' ')(--lock-only, nothing built)"
    fi
    finish PASS 0 "Python lock: static, wheels (amd64 + aarch64) and pip resolution PASS (--lock-only, nothing built)"
  fi
fi

# --- 1. the container engine, probed read-only (`<engine> version`, 20 s)
probe() {   # docker: the daemon's version (empty when the daemon is down or the socket is not ours); podman: the local engine
  local f='{{.Server.Version}}'
  [ "$1" = podman ] && f='{{.Client.Version}}'
  timeout -k 5 20 "$1" version --format "$f" 2>/dev/null | head -n 1
}
case "$ENGINE_WANT" in
  auto|docker) cands="docker" ;;
  podman) cands="podman" ;;
  *) echo "ADDON_BUILD_ENGINE must be auto, docker or podman"; exit 2 ;;
esac
for c in $cands; do
  if command -v "$c" >/dev/null 2>&1; then
    v="$(probe "$c")"
    if [ -n "$v" ]; then ENGINE="$c"; ENGINE_VER="$v"; break; fi
    echo "$c is installed but '$c version' gave no server version within 20 s" >> "$LOG"
  else
    echo "$c: not installed" >> "$LOG"
  fi
done
if [ -z "$ENGINE" ]; then
  cat "$LOG"
  install_steps
  finish NOT_RUN 3 "no container engine ($cands) answered: $(grep -E '(not installed|gave no server version)' "$LOG" | tr '\n' ' ' | cut -c1-160) (Python lock steps: $(echo "$STEPS" | tr ' ' '\n' | grep '^lock_' | cut -d: -f1,2 | tr '\n' ' '))"
fi
if [ "$DETECT" = 1 ]; then
  finish PASS 0 "engine $ENGINE $ENGINE_VER answers (detect only, nothing built)"
fi

# --- 2. the Supervisor's build inputs, read with release_check.py's own parsers
[ -f "$ADDON/Dockerfile" ] && [ -f "$ADDON/config.yaml" ] || finish FAIL 1 "no smplwise_vms/Dockerfile or config.yaml under $ROOT"
read -r BASE VER < <(python3 - "$ROOT" <<'PY'
import importlib.util, sys
from pathlib import Path
root = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("rc", root / "scripts" / "release_check.py")
rc = importlib.util.module_from_spec(spec); spec.loader.exec_module(rc)
addon = root / "smplwise_vms"
bf = rc.parse_build_from(rc.read(addon / "build.yaml"))
v = rc.find(r'^version:\s*"([^"]+)"', rc.read(addon / "config.yaml"))
print(bf.get("amd64") or "-", v or "-")
PY
)
[ -n "$BASE" ] && [ "$BASE" != "-" ] || finish FAIL 1 "build.yaml has no build_from.amd64"
[ -n "$VER" ] && [ "$VER" != "-" ] || finish FAIL 1 "config.yaml has no version"
echo "engine $ENGINE $ENGINE_VER; base $BASE; version $VER; builder $BUILDER; budget ${BUDGET}s" >> "$LOG"

# --- 3. the build
HA_BUILDER="ghcr.io/home-assistant/amd64-builder:latest"
if [ "$BUILDER" = "ha" ] && [ "$ENGINE" = "docker" ] && docker image inspect "$HA_BUILDER" >/dev/null 2>&1; then
  IMG="local/amd64-addon-smplwise_vms:$VER"
  step build_ha_builder docker run --rm --privileged -v /var/run/docker.sock:/var/run/docker.sock -v "$ADDON":/data "$HA_BUILDER" \
    --test --amd64 --target /data --image amd64-addon-smplwise_vms --docker-hub local --version "$VER"
  step image_present docker image inspect "$IMG"
else
  [ "$BUILDER" = "ha" ] && echo "ADDON_BUILD_BUILDER=ha but $HA_BUILDER is not present locally (or the engine is not docker): plain Supervisor build" >> "$LOG"
  BUILDER="plain"
  step build "$ENGINE" build -f "$ADDON/Dockerfile" \
    --build-arg "BUILD_FROM=$BASE" --build-arg "BUILD_VERSION=$VER" --build-arg "BUILD_ARCH=amd64" \
    --label "io.hass.version=$VER" --label "io.hass.arch=amd64" --label "smplwise.gate=addon-build" \
    -t "$IMG" "$ADDON"
fi

# --- 4. smoke tests inside the image (no network, s6 bypassed)
RUN=("$ENGINE" run --rm --network none --entrypoint python3 -e SW_DATA_DIR=/tmp/swdata -e PYTHONDONTWRITEBYTECODE=1 "$IMG")
step import_smplwise "${RUN[@]}" -c "import smplwise, sys; print('smplwise', smplwise.__version__); sys.exit(0 if smplwise.__version__ == '$VER' else 3)"
step import_server "${RUN[@]}" -c "from smplwise.main import create_app; create_app(); print('create_app ok')"
step server_healthz "${RUN[@]}" -c "
import os, subprocess, sys, time, urllib.request
os.makedirs('/tmp/swdata', exist_ok=True)
env = dict(os.environ, SW_HOST='127.0.0.1', SW_PORT='8099', SW_LOG_LEVEL='warning')
p = subprocess.Popen([sys.executable, '-m', 'smplwise'], cwd='/app', env=env)
ok = False
for _ in range(90):
    if p.poll() is not None:
        break
    try:
        with urllib.request.urlopen('http://127.0.0.1:8099/healthz', timeout=3) as r:
            ok = r.status == 200
            print('healthz', r.status, r.read(200))
            break
    except Exception:
        time.sleep(1)
p.terminate()
try:
    p.wait(15)
except Exception:
    p.kill()
sys.exit(0 if ok else 4)
"
step system_tools "$ENGINE" run --rm --network none --entrypoint sh "$IMG" -c "pdftoppm -v && pdfinfo -v && ffmpeg -hide_banner -version | head -n 1"
# PY-CONSTRAINTS-LOCK-2407: what pip installed in the image is exactly the lock (the base image's own installers aside)
step constraints_match "${RUN[@]}" -c "
import re, sys
from importlib import metadata
norm = lambda n: re.sub(r'[-_.]+', '-', n).lower()
pins = {}
for raw in open('/app/constraints.txt', encoding='utf-8'):
    line = raw.split('#', 1)[0].strip()
    if line:
        n, _, v = line.partition('==')
        pins[norm(n)] = v
have = {norm(d.metadata['Name']): d.version for d in metadata.distributions() if d.metadata['Name']}
bad = [f'{n}: installed {have.get(n, \"-\")}, pinned {v}' for n, v in sorted(pins.items()) if have.get(n) != v]
extra = sorted(set(have) - set(pins) - {'pip', 'setuptools', 'wheel', 'smplwise'})
# an extra distribution is reported, not failed: it may be the base image's own (lock_pip fails a transitive package that
# pip would install outside the lock)
print(len(pins), 'pins;', len(have), 'distributions; extra (not in the lock, base image?):', extra or 'none')
for b in bad:
    print('MISMATCH', b)
sys.exit(1 if bad else 0)
"

# --- 5. only this check's own dangling layers (the tagged image stays: it is the next run's cache)
"$ENGINE" image prune -f --filter "label=smplwise.gate=addon-build" >> "$LOG" 2>&1 || true
finish PASS 0 "built $IMG from $BASE with $ENGINE $ENGINE_VER ($BUILDER) and the image passed import, create_app, /healthz and tools in $(( $(date +%s) - T0 ))s"
