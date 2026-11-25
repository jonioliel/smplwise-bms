# 14-hour soak - runbook (T068, LOAD-BUDGET-2530)

Who runs it: the lead, on the Linux test runner, **after the 2.52 release gate has finished** (never while a gate runs: the soak
throttles itself, but a 14 h run beside a 3 h gate distorts both). No lab, no real device, no Home Assistant: everything runs
against the device fakes on 127.0.0.1. The card that asks for it is `SOAK-14H-2490`; the budget it is judged against is
`smplwise_vms/backend/tests/soak/load_budget.json`, written up in `RESOURCE_BUDGET.md` ("Resource budget 2.53").

## What it runs

`tests/soak/load_budget.py --hours 14 --restarts` through the guarded launcher `scripts/soak/t068_long_soak.sh` with
`SOAK_HARNESS=load_budget`:

- the backend in its own process on a fresh data directory, the fake NVR (alert stream ~6 alerts/s on 8 channels), the fake Home
  Assistant (600 entities, 20 state changes/s) with the fake WisKey, the fake go2rtc;
- the full client mix of the budget run: 8 camera-wall screens, 6 home wall panels, 8 notice TV boards, a notice author, 4 operators,
  an acker, an exporter, 3 event-feed WebSockets, 4 live viewers;
- device restarts: NVR every 30 min (down 15 s), HA every 45 min (down 10 s), go2rtc every 60 min (down 10 s);
- idle 60 s, warm-up 120 s, then 14 h measured, sampled every 60 s, then the drain check.

The guards are the launcher's: `nice 19`, `ionice -c3`, `taskset` on two cores (`SOAK_CPUS`, default 14,15), an address-space cap
of 3 GB per process, `MALLOC_ARENA_MAX=2`; the harness pauses its clients while the host has under 800 MB available, ends the run
(`rss_cap`) above 1200 MB backend RSS and (`disk_low`) under 2 GB free on the run folder's disk; the backend log rotates at 64 MB.

## Before

1. The 2.52 gate is finished: `python3 -c 'import json;print(json.load(open("/home/sw/smplwise-results/gate_status.json"))["state"])'`
   is not `running`.
2. At least 6 GB available (`free -m`) and 10 GB free on `~` (`df -h ~`).
3. A source tree of the commit to soak (the released 2.52 tag, or the train head it was gated at):

   ```bash
   cd ~/smplwisebms && git fetch -q origin --tags
   mkdir -p ~/soak/load-2520 && rm -rf ~/soak/load-2520/src
   git worktree add --detach ~/soak/load-2520/src v2.52.0     # or the gated train head
   ```

## Start

```bash
SOAK_HARNESS=load_budget SOAK_CPUS=14,15 bash ~/soak/load-2520/src/scripts/soak/t068_long_soak.sh start \
  ~/soak/load-2520/src ~/soak/load-2520/run-$(date -u +%Y%m%d) --hours 14 --restarts --interval 60
```

`harness.log` shows the start-up line with the mix; `samples.csv` gets a line every 60 s.

## While it runs

- status: `bash ~/soak/load-2520/src/scripts/soak/t068_long_soak.sh status ~/soak/load-2520/run-<date>`
- a gate wants the runner: the soak may keep running (it is throttled); stop it only if the gate's memory check refuses to start.
- stop early (graceful, the report is still written): `bash .../t068_long_soak.sh stop ~/soak/load-2520/run-<date>`

## After

1. `budget_report.md` in the run folder: verdict, every budget line (limit, measured, PASS / FAIL / N/A / SKIPPED), the per-route
   table. The long run is the only one that judges `rss_slope_mb_per_h` (the leak line needs at least 120 minutes).
2. Also there: `summary.json` (fake restarts, status codes, write-lock and ingest counters), `samples.csv` (the trend lines),
   `routes.json`, `backend.log*`.
3. Bring back only redacted results: `summary.json`, `budget_report.json`, `budget_report.md`, `samples.csv` into
   `private-evidence/soak-14h-2520/` (the harness writes no address but 127.0.0.1; check before copying anyway).
4. Record the numbers in `RESOURCE_BUDGET.md` ("Resource budget 2.53", the 14 h column) and in `SOAK-14H-2490`'s change note; a FAIL
   line gets a ticket with the samples that show it. Re-judge against a changed budget file without re-running:
   `python tests/soak/load_budget.py --evaluate <run-dir> --budget <file>`.
5. Clean up: `git -C ~/smplwisebms worktree remove ~/soak/load-2520/src`; keep the run folder until the numbers are recorded.

## If something goes wrong

| symptom | meaning | what to do |
|---|---|---|
| `reason: backend_exit` | the backend crashed - a finding | keep `backend.log*`, open a ticket; do not restart the run on the same folder |
| `reason: rss_cap` | backend RSS passed 1200 MB | a leak finding; the samples show when it started |
| `reason: disk_low` | the run folder's disk fell under 2 GB | free space, start a new run folder |
| `paused` = 1 in samples | host memory under 800 MB (a gate or another job) | nothing; the load resumes on its own |
| exit code 2 | the run did not complete (start-up failed, backend exit) | read `harness.log` and `backend.log` |
