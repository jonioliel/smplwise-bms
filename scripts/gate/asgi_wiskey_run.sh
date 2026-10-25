#!/usr/bin/env bash
# W-016 (ASGI-295): the full-ASGI qualification of the WisKey media path on the runner - ONE pytest module,
# smplwise_vms/backend/tests/test_asgi_wiskey_295.py (the real FastAPI app with startup/shutdown, every media / talk route over HTTP and
# WebSocket, RBAC, station scope, revoke / expiry during await, the downlink, cancel / join, the lease lifecycle across shutdown, no leaked
# asyncio task / socket / thread / timer; fakes for WisKey's direct transport and go2rtc only - no equipment, no network).
#
# PREPARED, NOT EXECUTED: it runs only on the runner, when the runner is free AND the owner gave the go-ahead for W-016.
#
# Usage: asgi_wiskey_run.sh <arx-ref> [--wiskey-code <CODE>] [--wiskey-delta-sha256 <HEX>] [--timeout <secs>] [--dry-run]
#   <arx-ref>              the Arx commit / branch to qualify (e.g. origin/pilot/ASGI-295); the FULL 40-hex SHA is recorded
#   --wiskey-code          WisKey's full CODE identity the candidate was integrated against (recorded verbatim; placeholder when absent)
#   --wiskey-delta-sha256  the sha256 of the WisKey delta applied by hand (recorded verbatim; placeholder when absent)
#   --timeout              hard limit for the pytest process (default 1800 s); exceeding it is TIMEOUT, never FAIL or PASS
#   --dry-run              print what would run and exit (no lock, no fetch, no worktree, nothing run)
#
# Output: ~/smplwise-results/asgi-wiskey/<UTC>_<sha12>/
#   IDENTITY.json   Arx full SHA + ref, WisKey CODE (or the placeholder), delta sha256, host, python, start / end UTC
#   pip_freeze.txt  `python -m pip freeze` of the interpreter that ran the module
#   junit.xml       pytest --junitxml (xunit2)
#   pytest.log      the whole pytest output (-rA: every outcome with its reason)
#   PROCESS.txt     this run's own process lineage (pid / ppid / command of the script and its pytest child)
#   SUMMARY.json / SUMMARY.md  counts kept SEPARATE: passed, FAIL, ERROR, SKIP, TIMEOUT (+ xfail / xpass), and every non-pass test by id
#                              with the first line of its message. Zero collected tests is an ERROR (false-green guard), never a pass.
# Exit: 0 all passed; 1 a FAIL or ERROR; 2 usage / setup problem; 3 the runner is busy (a lock is held); 4 TIMEOUT.
#
# Rules: one run at a time and never next to a gate or the nightly (the same two flock files as release_gate.sh, non-blocking); never
# kills a process by name (only the pytest child it started, through `timeout`); its own scratch worktree under ~/work is removed at
# the end, nothing else is touched; no secret is read or written (the module uses synthetic fixture keys only).
set -uo pipefail
export PATH="$HOME/smplwisebms/.venv/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
REPO="${SW_REPO:-$HOME/smplwisebms}"
PY="${SW_PYTHON:-$HOME/smplwisebms/.venv/bin/python}"
MODULE="tests/test_asgi_wiskey_295.py"
CODE_PLACEHOLDER="WISKEY_CODE_NOT_PROVIDED"
DELTA_PLACEHOLDER="WISKEY_DELTA_SHA256_NOT_PROVIDED"

REF=""; WISKEY_CODE="$CODE_PLACEHOLDER"; DELTA="$DELTA_PLACEHOLDER"; TIMEOUT_S=1800; DRY=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help) sed -n 2,31p "$0"; exit 0;;
    --wiskey-code) WISKEY_CODE="${2:?--wiskey-code needs a value}"; shift 2;;
    --wiskey-delta-sha256) DELTA="${2:?--wiskey-delta-sha256 needs a value}"; shift 2;;
    --timeout) TIMEOUT_S="${2:?--timeout needs a value}"; shift 2;;
    --dry-run) DRY=1; shift;;
    -*) echo "unknown option: $1" >&2; exit 2;;
    *) [ -z "$REF" ] || { echo "one <arx-ref> only" >&2; exit 2; }; REF="$1"; shift;;
  esac
done
[ -n "$REF" ] || { sed -n 2,31p "$0"; exit 2; }
case "$TIMEOUT_S" in ''|*[!0-9]*) echo "--timeout must be whole seconds" >&2; exit 2;; esac

if [ "$DRY" -eq 1 ]; then
  echo "ref: $REF"; echo "module: smplwise_vms/backend/$MODULE"; echo "python: $PY"; echo "timeout: ${TIMEOUT_S}s"
  echo "wiskey code: $WISKEY_CODE"; echo "wiskey delta sha256: $DELTA"; echo "results: $HOME/smplwise-results/asgi-wiskey/<UTC>_<sha12>/"
  exit 0
fi

mkdir -p "$HOME/smplwise-results/asgi-wiskey" "$HOME/work"
exec 9>"$HOME/.smplwise-gate.lock"
flock -n 9 || { echo "a release gate is running: W-016 waits for a free runner"; exit 3; }
exec 8>"$HOME/.smplwise-tests.lock"
flock -n 8 || { echo "the nightly / a manual test run holds ~/.smplwise-tests.lock: W-016 waits"; exit 3; }

git -C "$REPO" fetch --quiet origin || { echo "git fetch failed" >&2; exit 2; }
SHA="$(git -C "$REPO" rev-parse --verify "${REF}^{commit}" 2>/dev/null)" || { echo "unknown ref: $REF" >&2; exit 2; }
[ "${#SHA}" -eq 40 ] || { echo "not a full SHA: $SHA" >&2; exit 2; }
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$HOME/smplwise-results/asgi-wiskey/${STAMP}_${SHA:0:12}"
WT="$HOME/work/asgi-wiskey-${STAMP}"
mkdir -p "$OUT"
cleanup() { git -C "$REPO" worktree remove --force "$WT" >/dev/null 2>&1 || true; }
trap cleanup EXIT
git -C "$REPO" worktree add --detach --quiet "$WT" "$SHA" || { echo "worktree add failed" >&2; exit 2; }
[ -f "$WT/smplwise_vms/backend/$MODULE" ] || { echo "the module is not in $SHA" >&2; echo '{"status":"ERROR","reason":"module_missing"}' > "$OUT/SUMMARY.json"; exit 2; }

START_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
"$PY" -m pip freeze > "$OUT/pip_freeze.txt" 2>&1 || echo "pip freeze failed (exit $?)" >> "$OUT/pip_freeze.txt"
PYVER="$("$PY" -c 'import sys; print(sys.version.split()[0])')"

cd "$WT/smplwise_vms/backend" || exit 2
set +e
timeout -k 30 "$TIMEOUT_S" "$PY" -m pytest "$MODULE" -p no:cacheprovider -rA -o junit_family=xunit2 --junitxml="$OUT/junit.xml" \
  > "$OUT/pytest.log" 2>&1 &
CHILD=$!
{ echo "script pid=$$ ppid=$PPID cmd=$0 $REF"; ps -o pid=,ppid=,args= --ppid "$$" 2>/dev/null; ps -o pid=,ppid=,args= --ppid "$CHILD" 2>/dev/null; } > "$OUT/PROCESS.txt"
wait "$CHILD"; RC=$?
END_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TIMED_OUT=0; { [ "$RC" -eq 124 ] || [ "$RC" -eq 137 ]; } && TIMED_OUT=1

"$PY" - "$OUT" "$SHA" "$REF" "$WISKEY_CODE" "$DELTA" "$START_UTC" "$END_UTC" "$RC" "$TIMED_OUT" "$PYVER" "$(hostname)" <<'PYEOF'
import json, sys, xml.etree.ElementTree as ET
from pathlib import Path
out, sha, ref, code, delta, start, end, rc, timed_out, pyver, host = sys.argv[1:]
out = Path(out); rc = int(rc); timed_out = timed_out == "1"
identity = {"work_item": "W-016", "arx_ref": ref, "arx_sha": sha, "wiskey_code": code, "wiskey_code_provided": code != "WISKEY_CODE_NOT_PROVIDED",
            "wiskey_delta_sha256": delta, "host": host, "python": pyver, "start_utc": start, "end_utc": end, "pytest_exit": rc,
            "module": "smplwise_vms/backend/tests/test_asgi_wiskey_295.py"}
(out / "IDENTITY.json").write_text(json.dumps(identity, indent=1), encoding="utf-8")
counts = {"tests": 0, "passed": 0, "FAIL": 0, "ERROR": 0, "SKIP": 0, "TIMEOUT": 1 if timed_out else 0}
items = []
junit = out / "junit.xml"
if junit.is_file() and junit.stat().st_size:
    try:
        root = ET.parse(junit).getroot()
        for case in root.iter("testcase"):
            counts["tests"] += 1
            tid = f"{case.get('classname', '')}::{case.get('name', '')}"
            kind = None
            for child in case:
                if child.tag in ("failure", "error", "skipped"):
                    kind = {"failure": "FAIL", "error": "ERROR", "skipped": "SKIP"}[child.tag]
                    msg = (child.get("message") or child.text or "").strip().splitlines()
                    items.append({"id": tid, "status": kind, "message": msg[0][:300] if msg else ""})
                    break
            if kind is None:
                counts["passed"] += 1
            else:
                counts[kind] += 1
    except ET.ParseError as exc:
        counts["ERROR"] += 1
        items.append({"id": "junit.xml", "status": "ERROR", "message": f"unreadable junit: {exc}"})
elif not timed_out:
    counts["ERROR"] += 1
    items.append({"id": "junit.xml", "status": "ERROR", "message": "no junit written (crash at load time?)"})
if counts["tests"] == 0 and not timed_out:
    counts["ERROR"] += 1
    items.append({"id": "collection", "status": "ERROR", "message": "zero tests ran: never a pass"})
if timed_out:
    status = "TIMEOUT"
elif counts["FAIL"] or counts["ERROR"]:
    status = "RED"
elif counts["SKIP"]:
    status = "GREEN_WITH_SKIPS"
else:
    status = "GREEN"
summary = {"status": status, "counts": counts, "non_pass": items, **identity}
(out / "SUMMARY.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
lines = [f"# W-016 ASGI WisKey media path - {status}", "",
         f"- Arx: `{sha}` ({ref})", f"- WisKey CODE: `{code}`" + ("" if identity["wiskey_code_provided"] else " (PLACEHOLDER - not tied to a WisKey CODE)"),
         f"- WisKey delta sha256: `{delta}`", f"- host {host}, python {pyver}, {start} .. {end}, pytest exit {rc}", "",
         "| tests | passed | FAIL | ERROR | SKIP | TIMEOUT |", "|---|---|---|---|---|---|",
         f"| {counts['tests']} | {counts['passed']} | {counts['FAIL']} | {counts['ERROR']} | {counts['SKIP']} | {counts['TIMEOUT']} |", ""]
lines += [f"- {i['status']} `{i['id']}` - {i['message']}" for i in items] or ["- every test passed"]
lines += ["", "Files: IDENTITY.json, pip_freeze.txt, junit.xml, pytest.log, PROCESS.txt. Fakes only (WisKey direct transport, go2rtc):",
          "nothing here measures a real WisKey, go2rtc, add-on installation or live station."]
(out / "SUMMARY.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
PYEOF

echo "results: $OUT"
if [ "$TIMED_OUT" -eq 1 ]; then exit 4; fi
STATUS="$("$PY" -c 'import json,sys; print(json.load(open(sys.argv[1]))["status"])' "$OUT/SUMMARY.json" 2>/dev/null || echo RED)"
case "$STATUS" in GREEN|GREEN_WITH_SKIPS) exit 0;; *) exit 1;; esac
