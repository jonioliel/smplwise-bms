# CR-W3B-BE-COMBINED-2443 - the wave-3B backend chain (BE-1..BE-4) on the 2.43.8 train, for 2.43.9

Branch `pilot/CR-W3B-BE-COMBINED-2443`, from `origin/release/2438-train` @ `c68904139` (2.43.8 train head of 18.11 evening,
rebuilt UI; the 2.43.8 release gate runs on that head). Brief: `private/planning/REMAINING_WORK_2026-11-18.md` section A2.
No version bump, no tag, no migration, no route change, no frontend change, no pixel change. No device, NVR, go2rtc, Home
Assistant, lab host or runner was contacted; no entry check was queued.

Each step keeps its own change note: `docs/changes/CR-ROUTER-COMMON-TAIL-2442.md` (BE-1), `CR-BE-DEAD-CODE-2442.md` (BE-2),
`CR-PYFLAKES-ENFORCE-2442.md` (BE-3), `CR-BE-DEAD-CODE-B-2442.md` (BE-4).

## Merge

| Merge commit | Branch | Head | Note |
|---|---|---|---|
| `a7c3134e1` | `pilot/CR-BE-DEAD-CODE-B-2442` (linear chain BE-1 `382b52e1d` -> BE-2 `6de49c824` -> BE-3 `b2ba874ca` -> BE-4 `8b74bb16f`) | `8b74bb16f` | `--no-ff`; merge base `59e4215fe` (the older W2-FU head; the train holds W2-FU `c193fab64`) |

**Conflicts: none.** The merge was textual-clean (`git merge-tree` predicted it, the merge confirmed it). 235 files differ
from the train. Files changed on BOTH sides since the merge base (7) and how they combined:

| File (under `smplwise_vms/backend/`) | Train side | Chain side | Result |
|---|---|---|---|
| `smplwise/routers/recorders.py` | I18N-C confirm words | unused `fastapi.Query` import removed (BE-3) | both; the train adds no `Query` use (ruff F clean) |
| `smplwise/routers/settings.py` | DOMUS / I18N-C | unused `ui_background` import removed (BE-3) | both; no `settings.ui_background` reader anywhere (scan below) |
| `smplwise/routers/wiskey_lineage.py` | W2-FU admin gate, I18N-C confirm words | local `_rid` -> `from ._common import rid as _rid` (BE-1) | both |
| `smplwise/routers/wiskey_managed.py` | I18N-C | local `_rid` -> `_common` (BE-1) | both |
| `smplwise/services/access_external.py` | I18N-C | `# test-only:` marker on `reset_export_rate` (BE-2) | both |
| `smplwise/services/access_grants.py` | I18N-C | `zone_of` reads `setting_value(conn, "time.zone")` (BE-1); unused `now_iso` removed (BE-3); `# test-only:` marker (BE-2) | both |
| `tests/test_wiskey_door_tech.py` | train edits | BE-4 exact `correlation_id` assertion | both |

The other overlaps the inventory listed (MODAL-STACK-B gate scripts / `pyproject.toml` / `door_*` routers, DOMUS `main.py`,
LOCAL-USER-CREATE `local_identity.py`, W2-FU `notify*` / `presence` / `active_users`) were already in the merge base or touched
by one side only, so git took them without a hunk to resolve.

## Deleted names against the train (dead-code steps BE-2 / BE-4, unused imports BE-3)

Nothing had to be restored. How it was checked:

1. Every module-level name bound in the train version of a file the merge changed and no longer bound after the merge was
   listed with a syntax-tree pass (68 modules: the 17 BE-4 names, the 4 `wiskey_media_contract` constants, BE-3's removed
   imports, BE-1's `read_settings` imports in `events` / `recordings`).
2. Every `*.py` of `smplwise_vms/backend/` (package and tests), `scripts/` and `custom_components/` was scanned for a use of one
   of them through another module: `from <module> import <name>`, `<module alias>.<name>`, a `"<module>.<name>"` string (patch
   targets), `setattr/getattr/hasattr(<module>, "<name>")`. **0 hits.**
3. A word search (`git grep -w`) of each BE-4 name and of the BE-2 removals (`_push` member, rfq `old_lines`) over the whole
   tree (docs and built bundles excluded): only unrelated homonyms (`fx._push` of the media fake, a test name with
   `old_lines`).
4. Every `smplwise.*` module imported in one interpreter (migrations excluded): 928 imported, 0 failed; `create_app` builds
   (API inventory below).

In particular I18N-C `confirm_words`, LOCAL-USER-CREATE identity routes and FIX-2438-REDS use none of the removed names.

## ruff F (PYFLAKES-ENFORCE)

`ruff 0.17.5 check --select F smplwise/` (also `--no-cache`): **All checks passed!** - the train introduced no new finding, so
nothing had to be fixed. `scripts/gate/lint_backend.py --gate` and `--strict`: `0 finding(s)`, exit 0. `gate_entry.py lint`
on this tree: 0 findings. The marker `# ruff-lane: blocking` is in `smplwise_vms/backend/pyproject.toml`, so from this branch on
the lane blocks.

## Router helper conversions (ROUTER-COMMON-TAIL) against the train's routers

The train added no router file; it changed 13 (`access_control_door_tech`, `capture_lease`, `local_identity`, `me`,
`nvr_connection`, `recorders`, `settings`, `settings_patch/__init__`, `settings_patch/identity`, `wiskey_installer_common`,
`wiskey_lineage`, `wiskey_managed`, `wiskey_relay_map`).

- Helper copies (`_rid` / `_raw_body` / `_is_json` / `_db` defined in a router): none in any of the 13 after the merge
  (`wiskey_lineage`, `wiskey_managed` converted by BE-1 and merged cleanly). `tests/test_router_common_helpers.py` with an empty
  `WAITING` passes on this head.
- One-key setting readers: the only `read_settings(` calls in train-changed files are the two whole-document reads of
  `routers/settings.py` (GET `/settings`), which are not one-key readers. `tests/test_setting_callers_2440.py` passes.
- **Left as is:** `routers/settings_patch/identity.py` keeps 14 inline `getattr(request.state, "correlation_id", None)`
  expressions (13 on `request`, 1 on `patch.request`). They were there before the train (merge base has the same 14), are not helper copies, and BE-1 left inline
  forms outside its row list on purpose (~30 routers, "a later row may sweep them"). The train's I18N-C edit only added
  `confirm_word` details next to them. Converted: nothing beyond what the chain already did.

## Runner prerequisites - checklist for the lead (NOT done here; the runner was not touched)

Before this branch gets an entry check or boards a train:

- [ ] ruff installed for the gate python on the runner (`$PY3` of `~/gate2`; `"$PY3" -m ruff --version`). Without it the lane
      prints NOT_RUN and enforces nothing.
- [ ] Sync to `~/gate2` from this branch: `scripts/gate/lint_backend.py`, `scripts/gate/gate_entry.py`,
      `scripts/gate/gate_release.sh`, `scripts/gate/branch_check.sh`.
- [ ] After the sync, read the first lint line of the next entry / release log (`backend lint (ruff F, blocking): 0 finding(s)`).
- [ ] Known limit (BE-3 note): `gate_entry.py decide` lints `GATE_LINT_ROOT`, else the script's checkout, else `~/smplwisebms`;
      the precise branch check is `branch_check.sh` (lints the branch worktree).
- [ ] Branches cut before the marker (no `# ruff-lane: blocking` in their `pyproject.toml`) are only reported, not blocked.
- [ ] Bridge: BRIDGE-COMMON (in the train via W3-BE) needs a bridge version bump at release (inventory note A2).

## Proof (actually run, workstation, Windows, Python 3.12 dev venv, `-p no:xdist`)

- `ruff 0.17.5 check --select F smplwise/` (+ `--no-cache`): All checks passed. `lint_backend.py --gate` / `--strict`: 0, exit 0.
  `gate_entry.py lint`: 0 findings.
- `scripts/api_inventory.py` (dev venv): **1909 routes**, `contracts/API_INVENTORY.md` **no diff** (the train's 1909 = BE-4's
  1908 + LOCAL-USER-CREATE's password route).
- Import of every `smplwise.*` module (migrations excluded): 928 imported, 0 failed.
- Removed-name reference scan (section above): 0 hits.
- `scripts/gate/selftest_gate_fast.py`: SELFTEST PASSED. `bash -n` on `branch_check.sh`, `gate_release.sh`: ok.
  `py_compile` on `gate_entry.py`, `lint_backend.py`: ok.
- Backend tests: see "Test runs" below (appended as each batch finishes).

## Test runs

## NOT_RUN

- The full backend suite (~1070 files): not run (runner not used, PC busy). Router API tests beyond the list above: not run.
- Entry check: not queued (as instructed; the 2.43.8 release gate holds the runner).
- `branch_check.sh` / `gate_release.sh` end to end: not run (runner); `bash -n` on both ok.
- Frontend, pixels: nothing in `frontend/` changed by this merge.
