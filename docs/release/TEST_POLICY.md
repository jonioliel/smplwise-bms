# Release test policy (risk-based)

Owner decision 2026-10-02: small releases ship fast with a focused suite; the full, comprehensive suite is reserved for large releases.
Never claim a pass that was not run; every release report states exactly which tier ran.

## Tiers

| Tier | When | What runs | Typical time |
|---|---|---|---|
| **S - small** | Fixes, settings, one screen, no shared-component or security change | `scripts/release_check.py`; backend tests of the touched modules + their direct neighbours (grep the changed file names in `smplwise_vms/backend/tests`); Playwright specs of the touched screens on all three projects (desktop, tablet, mobile); `tsc --noEmit`; a 10-minute smoke set (login/shell, home, area, security live, multimedia, settings open) | 40-70 min |
| **M - medium** | A shared component or style (`sw-page`, `sw-tabs`, tokens, `media-page`), a new setting with a /me/prefs path, a bridge change | Tier S + every spec that references the shared component (grep) + the whole backend directory of the touched domain (settings, access, automations, media...) | 1.5-2 h |
| **L - large** | New migration, RBAC/permission change, bridge allow-list, authentication, backup/restore, a new screen family, a skin/theme layer, anything an owner review flags | The FULL backend suite + the FULL Playwright suite on the dist preview + the dev-server specs + the camera-card fixture spec (the 0.1.151/0.1.152 routine) | 2.5-3 h |

A release takes the highest tier any of its changes needs. When in doubt, go one tier up.

## Always, whatever the tier
- `release_check.py` green (versions, migrations contiguous, bridge copies identical, UI built).
- Security-relevant changes (permissions, auth, request bodies, secrets, destructive actions) get a review before release.
- A nightly full run of backend + Playwright on the integration branch (when the machine is idle) keeps a current full-suite number, so a small release is never based on a stale full result.
- Known time-of-day-dependent tests (quiet hours) are run in daytime, or fixed with a frozen clock.
- Specs that import `/src/...` need the Vite dev server; the camera-card spec needs its fixture backend.
- On the Linux test machine `~/release_gate.sh <branch> [--tier S|M|L]` runs the whole tier-L routine by itself (backend in shards, tsc, build, the dist-preview specs, the dev-server specs, the camera-card fixture spec, the `-linux.png` pixel baselines when they exist, `release_check.py`), re-runs each failure once alone (a pass is reported FLAKY, not a failure), reads the allowlist `~/known_issues.json` (KNOWN) and writes a pass/fail verdict to `~/smplwise-results/gate_<branch>_<sha>.md|json` and `gate_status.json`. Fixture-backed specs other than the camera card are not part of it yet (they self-skip and are listed in the report).
- Evidence screenshots overwritten by a run are restored (`git checkout -- docs/...`) unless the change is intended.

## Release steps (all tiers)
1. Integration branch merged, version bumped (`config.yaml`, `Dockerfile` label, `smplwise/__init__.py`, CHANGELOG head, API inventory), UI built into `smplwise_vms/www`.
2. Tier suites green; a red test is fixed or explained as pre-existing with evidence, never ignored.
3. Bilingual release notes (Hebrew and English): what was added, bugs fixed, how to enable.
4. Merge to the integration/main branches and push; the owner installs.

## Flaky tests of the 2.2.0 gate: root causes and fixes (branch `pilot/flaky-fixes`)
The 2.2.0 gate classed nine tests FLAKY (failed in the full run, passed alone). Verification helper: `pytest --sw-repeat N` (backend
`tests/conftest.py`) runs every selected test N times in one process; the runs below were made on the Linux runner through
`private/runner/run_smart.py backend <branch> <tests> --sw-repeat 20` while 24 busy-loop processes held the 16-core machine at load 24-26
(the unfixed code is run the same way from the branch `pilot/flaky-baseline` = 2.2.0 + the option only).

| Test | Root cause | Fix | Result |
|---|---|---|---|
| backend `test_intercom::test_card_capture_timeout_expiry_and_abandonment` | the abandoned session's state flips to `cancelled` inside the cancel's result callback, the `intercom.card_capture.cancel` audit row (with `trigger: abandoned`) is written only after the action returns; the test waited for the state and read `rows[-1]`, which under load was the earlier manual-cancel row (`KeyError: 'trigger'`). The later `result` rows had the same shape | test waits for the audit row itself (and for both `result` rows) | unfixed 3 of 20 failed; fixed 20 of 20 passed |
| backend `test_presence::test_token_guessing_is_throttled...` | real product timing: the per-device events limiter is a token bucket refilling 1 token/s on `time.monotonic()`; the test posts 61 times and expects the 61st to be 429, but on a slow machine the loop takes over a second and earns a token back (`200 == 429`) | the limiters read the clock through a seam (`services/presence._now`); the test freezes it | unfixed 2 of 20 failed; fixed 20 of 20 passed |
| backend `test_frigate_join::test_the_review_screen_flow_with_the_uis_own_query` | shared state: the poll cursor lives in the module dict `frigate_events.STATES`; `test_frigate_join` imports the `world` fixture but not `test_frigate_api`'s autouse `_clean`, so a cursor left by an earlier test moves the first poll's window (cursor - 600 s) past the oldest fake review and `poll()` returns 2, not 3. Deterministic on a second run in one process (19 of 20 failed in the repeat run); in the gate it depended on what ran before in the shard | the `world` fixture clears `STATES` on setup and teardown | unfixed 19 of 20 failed (state leak between repetitions); fixed 20 of 20 passed |
| preview `unit-plan-3d-determinism.spec.ts:127` [mobile] (`createTreeWalker is not a function`) | shared state between spec files in one Playwright worker: `unit-media-queue.spec.ts` set `globalThis.document = {baseURI}` and never restored it; lit-html, first imported later in that worker by the determinism spec, bound to the stub. Which spec ran first in a worker depended on scheduling | the stub is restored in `finally` (media-queue, and media-screens made exception-safe) | reproduced deterministically with `--workers=1` in file order (unfixed: 1 failed; fixed: 5 of 5 runs passed) |
| preview `unit-devices-tiles.spec.ts:116` [mobile] (panel `open` not set after `?domain=alarm`) | NOT ROOT-CAUSED. Hypothesis tested and rejected: a stale native `close` event of the sw-drawer's `<dialog>` closing a re-opened panel (no reproduction under load). Not reproduced locally in 30 of 30 runs under 16 busy loops; with 8 workers + 20 busy loops on 8 cores the run only produced 60 s timeouts (resource starvation) | none | open |
| pixel `evidence-design-foundation` "classic is pixel-stable: map" [mobile], and `pixel-nvr-encoding-batch:42` classic / domus / tesla | probable cause (not reproduced; the runner became unreachable before the failure artefacts could be read): fixed sleeps (900 / 400 / 500 ms) used as the readiness condition for a 0-pixel (40 px) comparison, so a late fixture answer, lazy chunk, enabled-state of the 3D / layers buttons or a pending Lit update lands inside the screenshot on a busy runner | `tests/pixel-settle.ts` `settlePage`: waits for fonts, network idle, no pending Lit update (shadow roots included), no image loading, no finite animation, unchanged element count and document height for 400 ms of frames | NOT VERIFIED on the runner |
