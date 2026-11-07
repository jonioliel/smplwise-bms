#!/bin/bash
# T068 long soak on the test runner: start / stop / status. Throttled so release gates and the nightly are not disturbed:
# nice 19, ionice idle, taskset on 2 cores, an address-space limit per process (+ MALLOC_ARENA_MAX=2), the harness's own
# soft RSS cap and host-memory pause. Command lines contain no pytest / uvicorn / vite, so cleanup_orphans.sh leaves them alone.
#   t068_long_soak.sh start  <src_dir> <run_dir> [soak_long.py args...]
#   t068_long_soak.sh stop   <run_dir>      # graceful (STOP file, <= ~90 s), then SIGTERM / SIGKILL the process group
#   t068_long_soak.sh status <run_dir>
set -u
cmd=${1:-}; shift || true
PY=${SOAK_PY:-$HOME/smplwisebms/.venv/bin/python}
CPUS=${SOAK_CPUS:-14,15}
AS_MB=${SOAK_AS_MB:-3072}
case "$cmd" in
  start)
    src=$1; run=$2; shift 2
    mkdir -p "$run"
    [ -f "$run/harness.pid" ] && kill -0 "$(cat "$run/harness.pid")" 2>/dev/null && { echo "already running"; exit 1; }
    cd "$src/smplwise_vms/backend" || exit 2
    MALLOC_ARENA_MAX=2 PYTHONDONTWRITEBYTECODE=1 SW_SOAK=1 nohup setsid nice -n 19 ionice -c3 taskset -c "$CPUS" \
      prlimit --as=$((AS_MB * 1024 * 1024)) -- "$PY" "$src/smplwise_vms/backend/tests/soak/soak_long.py" --run-dir "$run" "$@" \
      > "$run/harness.log" 2>&1 < /dev/null &
    echo $! > "$run/launcher.pid"
    sleep 2; echo "started pid $(cat "$run/launcher.pid") run_dir $run";;
  stop)
    run=$1; touch "$run/STOP"
    for _ in $(seq 1 90); do pid=$(cat "$run/harness.pid" 2>/dev/null); [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null || { echo stopped; exit 0; }; sleep 1; done
    pid=$(cat "$run/harness.pid"); kill -TERM -- "-$pid" 2>/dev/null; sleep 10; kill -KILL -- "-$pid" 2>/dev/null; echo "killed group $pid";;
  status)
    run=$1; pid=$(cat "$run/harness.pid" 2>/dev/null)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then echo "running pid $pid"; else echo "not running"; fi
    wc -l < "$run/samples.csv" 2>/dev/null; tail -n 2 "$run/samples.csv" 2>/dev/null; tail -n 3 "$run/harness.log";;
  *) echo "usage: $0 start|stop|status ..."; exit 2;;
esac
