# NIGHTLY-2250-297: keep the nightly inside its budget

Branch `pilot/NIGHTLY-2250-297` (from origin/main, v2.25.0). Nothing here is deployed to the runner: the lead installs it.

## What the runner and the reports show (read-only look, 2026-10-28)

- Cron (runner, `CRON_TZ=Asia/Jerusalem`): `0 2 * * * ~/nightly_tests.sh >> ~/smplwise-results/cron.log 2>&1`. No `SW_NIGHTLY_*` variable is set on the line.
- Installed `~/nightly_tests.sh` is the current one (hard limit 240 min, engine budget 225 min, schedule default **v1**).
- Installed `~/nightly-gate/release_gate.py` is **stale**: it differs from the repo engine (the one in `~/release_gate.py` is identical to the repo file). `~/nightly-gate/gate_baselines.json` differs too; `gate_durations.json` is identical.
- Nightly history (all v1, tier L, no visual step):

| Night | main @ | wall | preview | dev | verdict |
|---|---|---|---|---|---|
| 10-25 | b6eb212ec | 170 min | 94 | 70 | FAIL: 28 pixel |
| 10-26 | 223fff4ad | 174 min | 103 | 69 | FAIL: 94 pixel, 1 backend |
| 10-27 | 011c97d4d (2.23.1) | **222 min** | 99 | **120** | FAIL: 25 pixel, 6 dev, budget |
| 10-28 | 0a3b04bbe (2.24.1) | 162 min | 95 | 39 | PASS |

## Cause of "90-minute budget exhausted"

1. The text is wrong, not the budget. The stale nightly engine hard-codes "90-minute" in the message; the repo engine already prints the real `GATE_TOTAL_SECS` (GATEAUDIT-297). The real budget on 10-27 was 225 min, and the run used 222 of them.
2. v1 runs the preview phase and then the dev-server phase one after the other. On 10-27 the dev phase took 120 min (39 to 70 min on the other nights). `layout-bubble-screens` (about 34 min of recorded time) and `layout-schedules-parity` (about 18 min, four skins) are the heavy dev specs; the two bubble failures were retried alone, and the four schedules-parity retries "did not complete: time limit". With a serial schedule one slow dev phase has nowhere to go but the budget.
3. The pixel failures on 10-25..10-27 are separate (baselines; the 10-28 run on 2.24.1 had 0).

## The change (smallest)

`scripts/gate/nightly_tests.sh`: the nightly defaults to `GATE_SCHEDULE=v2` (`SW_NIGHTLY_SCHEDULE=v1` is the rollback). v2 is the schedule of the release gates in the 2.23.0 to 2.25.0 gates: 6 backend shards on tmpfs, one Playwright pool in which dev-server specs are jobs scheduled largest first, and the same retries and false-green guards. Full tier-L v2 gates on the runner took 84 to 131 min of pool time (10-26..10-28), against 162 to 222 min for the v1 nightly. The 225 min engine budget and 240 min hard limit stay, so the budget gains 90+ min of headroom without being enlarged. `--dry-run` now prints the schedule.

Not changed on purpose: budgets (a larger budget would only hide a slow dev phase), the pixel handling, and any spec.

## Install steps for the lead (idle runner only)

Precondition: no `~/.smplwise-tests.lock` holder, no `~/.gate-pending`, no `~/.nightly-pending`; run `~/gate_clean.sh` before and after. Best done in the daytime so the 02:00 run uses it.

```
ssh runner 'ls ~/.smplwise-tests.lock ~/.gate-pending ~/.nightly-pending 2>&1; fuser -v ~/.smplwise-tests.lock 2>&1 | head -3'
# 1. merge this branch to main (or take the three files from it), then from a checkout of main:
ssh runner 'D=$(date +%Y%m%d); cp ~/nightly_tests.sh ~/nightly_tests.sh.bak-$D; for f in release_gate.py gate_baselines.json gate_durations.json select_tests.py shadow_compare.py; do cp ~/nightly-gate/$f ~/nightly-gate/$f.bak-$D 2>/dev/null; done'
scp scripts/gate/nightly_tests.sh runner:~/
scp scripts/gate/release_gate.py scripts/gate/gate_baselines.json scripts/gate/gate_durations.json scripts/gate/select_tests.py scripts/gate/shadow_compare.py runner:~/nightly-gate/
ssh runner 'chmod +x ~/nightly_tests.sh && ~/nightly_tests.sh --dry-run'
```

Expected dry-run: `schedule v2`, `hard limit 240 min`, `per-branch engine budget 225 min`, `engine: ... present`. No cron change is needed.

Check after the first night (`~/smplwise-results/<date>_main.md` and `nightly/gate_main_<sha>.json`): `"schedule": "v2"`, wall near 130 to 150 min (tablet full adds specs over the gate), no "budget exhausted" line. If load flakes appear that v1 did not have (more parallel tests), set `SW_NIGHTLY_SCHEDULE=v1` in the cron line (`0 2 * * * SW_NIGHTLY_SCHEDULE=v1 /home/sw/nightly_tests.sh ...`) as the rollback, and raise `SW_NIGHTLY_MAX_MIN` / `SW_NIGHTLY_BRANCH_MAX_MIN` (for example 300 / 285) rather than cutting specs.

## Verification

- `bash -n scripts/gate/nightly_tests.sh`: OK. `--dry-run` prints `schedule v2`, and `schedule v1` with `SW_NIGHTLY_SCHEDULE=v1`.
- NOT_RUN: a real nightly or v2 nightly-shaped run (the runner was not used for heavy work; the change needs the first live night).
