# CR-BE-GATES-2436 - backend static check lane (warn mode), local-channel auth inventory, async-route guard

Branch `pilot/CR-BE-GATES-2436`, cut from `origin/main` @ `665ec8f24` (2.43.4). Wave 1 of the code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md` section 3.2, theme T6). No product source file is edited, no version bump, no
CHANGELOG entry, no migration, no setting. No device, NVR, go2rtc, Home Assistant or lab host was contacted; the runner was not used.

## Findings covered

| Finding | What this branch does |
|---|---|
| 04:F06, 01:F-17 (configuration only) | `[tool.ruff]` / `[tool.ruff.lint] select = ["F"]` in `smplwise_vms/backend/pyproject.toml`; new lane `scripts/gate/lint_backend.py`, wired non-blocking into `scripts/gate/gate_entry.py`. The findings are **not** fixed here (wave 3B, `CR-PYFLAKES-ENFORCE`). |
| 05:P1-09 | new `smplwise_vms/backend/tests/test_local_auth_inventory.py`: every HTTP route-method of the real app, called from an untrusted peer with spoofed Ingress identity headers, answers 401, except the 38-entry `PUBLIC_ON_LOCAL` set of review 05 section 2.2, each pinned to its status today. |
| 02:P1-6 (guard only) | new `smplwise_vms/backend/tests/test_async_routes_no_inline_db.py`: no routed `async def` handler calls `.connection(` in its own body or through a same-module sync helper. The one known offender (`routers/wiskey_lineage.py::resolve`) is listed in `PENDING`; a strict `xfail` test names `pilot/AUTH-REVOKE-GATE-2435`. |

## Files

- `smplwise_vms/backend/pyproject.toml` - ruff configuration (pyflakes rules only, `tests/fixtures` excluded, `# noqa` honoured).
- `scripts/gate/lint_backend.py` (new) - runs `ruff check` over `smplwise/` with `--exit-zero --no-cache`, prints the total, the
  count per rule and per area. Exit 0 always (`--strict` exists for the later blocking switch). NOT_RUN when ruff is missing, the
  backend tree is not found, or ruff fails - never a false 0.
- `scripts/gate/gate_entry.py` - new `lint` sub-command, and `decide` prints the lane's summary to **stderr** after its JSON.
  `gate_release.sh` reads only stdout, so the decision, the JSON and every exit code are unchanged; `decide()` the function is
  untouched (the self-test calls it directly). `GATE_BACKEND_LINT=0` switches the lane off. The `rule` text is unchanged (the new
  docstring lines sit after the rule block).
- the two new test files above.

Deviation from the row text: the row says `[tool.ruff] select = ["F"]`. Current ruff (0.17) reads lint rules from
`[tool.ruff.lint]`; the top-level form is the deprecated spelling, so the rule set is under `[tool.ruff.lint]` with `[tool.ruff]`
holding `target-version` and the exclusion. Same effect.

## The current count (the lane's output, 2026-11-13, ruff 0.17.5, this branch)

```
backend lint (ruff F, non-blocking): 111 finding(s) [ruff 0.17.5]
  by rule: F401 88, F402 1, F541 4, F811 3, F821 2, F841 13
  by area: services 62, routers 29, tickets 9, (package root) 2, services/calendar 2, services/emergency 2, services/recorders 2, services/notices 1, services/partner 1, services/transit 1
```

The row expected "about 50 in area 04, 9 in tickets": tickets is exactly 9 (review 01's list); the rest of `services` + `routers`
is larger than area 04 alone because the lane covers the whole package (areas 02, 03 and 05 too). Notes for 3B:

- `F821` x2 at `routers/ha.py:393-394` (`exc` inside the nested `_failed()`): the helper is called inside the `except` block, so it
  works at runtime today; ruff flags it because `exc` is unbound once the block ends. Not a live defect, but fragile.
- `F811` x3: `routers/doors.py:487` (`ConfirmBody` twice), `services/plan_render.py:112` (`image_guard`),
  `services/presence.py:940` (`ssid_hash`, review 04:F20).
- `main.py:1036` and `:1128` (`F401`) are imports kept for a start-up side effect: check each before removal, as 04:F06 says.

## Install on the runner (for the lead; not done by this branch)

The runner copies the gate scripts into `~` / `~/gate2` (README_GATE_FAST.md). For the lane to print a count there,
`lint_backend.py` must be copied next to `gate_entry.py`, and ruff must be in the runner venv (`pip install ruff`). Without either
the lane prints `NOT_RUN` and nothing else changes. The lane lints `GATE_LINT_ROOT`, else the checkout the script sits in, else
`~/smplwisebms` - i.e. the runner's main checkout, not the branch under gate (`gate_release.sh` does not pass the branch to
`gate_entry.py`, and it is outside this row's file list). Passing the gate worktree through `GATE_LINT_ROOT` is a one-line change
for whoever next edits `gate_release.sh` / `branch_check.sh`.

## Tests

Backend tests run with the workstation venv (`C:\cloude\smplwisebms\.venv`, Python 3.12.10, FastAPI 0.141.1) from
`smplwise_vms/backend`; gate tools with `py -3.12`.

| Command | Result |
|---|---|
| `pytest tests/test_local_auth_inventory.py tests/test_async_routes_no_inline_db.py` | 6 passed, 1 xfailed (the strict xfail of `PENDING`) |
| `pytest tests/test_local_auth_inventory.py tests/test_async_routes_no_inline_db.py tests/test_remote_access.py tests/test_plan_routes_unique.py -o addopts=""` (the new tests + the route / channel-auth suite they sit next to) | 73 passed, 1 xfailed, 0 failed (31 min 18 s wall on a busy workstation; several other agents were running) |
| `py -3.12 scripts/gate/selftest_gate_fast.py` (calls `gate_entry.decide` directly) | SELFTEST PASSED, 58 OK, 0 BROKEN |
| `py -3.12 scripts/gate/selftest_entry_check.py` | SELFTEST PASSED, 45 OK, rc 0 |
| `py -3.12 scripts/gate/gate_entry.py decide --results <empty>` | the same JSON on stdout as before, rc 0; the lane's three lines on stderr |
| `GATE_BACKEND_LINT=0 ... gate_entry.py decide` | nothing on stderr |
| `py -3.12 scripts/gate/lint_backend.py --strict` | rc 1 (111 findings) - the switch for 3B works |
| `GATE_LINT_ROOT=<missing> lint_backend.py` | `NOT_RUN - no backend tree ...`, rc 0 |
| `ruff check --select F` on the four new / changed Python files | All checks passed |

Proof the sweep is real: before `PUBLIC_ON_LOCAL` was filled, the sweep listed exactly the 31 non-401 routes beyond the first 7,
and together they are the 38 of review 05 section 2.2 (9 Arx sign-in, 6 app-refresh, 6 remote-only, 8 notice board, 1 calendar
feed, 1 assetlinks, 2 brand images, 2 bridge, 1 action token, `/healthz`, brand public). A first version that walked `app.routes`
saw only 2 routes (FastAPI 0.141 keeps each included router as one lazy entry); the test now uses `iter_route_contexts` and
asserts more than 1,500 route-methods. The async guard finds exactly `routers/wiskey_lineage.py::resolve` (line 89 inline, line 78
through `_admin`); its self-test proves both shapes are caught and a `run_in_threadpool` helper is not.

Encoding note: the first lane run decoded ruff's JSON with the Windows code page and silently reported 0; the lane now decodes
UTF-8 explicitly (a decode failure can no longer read as a clean count).

## Skipped / NOT_RUN

- No source fix (by the row): the 111 ruff findings, and 02:P1-6 itself (`AUTH-REVOKE-GATE-2435`).
- After `AUTH-REVOKE-GATE-2435` merges: `test_pending_offenders_are_fixed` will XPASS and fail (strict); then empty `PENDING` and
  remove the mark.
- Runner entry check: not queued (the lead combines wave-1 branches). Pixel gate: not run (no UI change).
- The full backend suite: NOT_RUN locally (see the counts above for what was run).
