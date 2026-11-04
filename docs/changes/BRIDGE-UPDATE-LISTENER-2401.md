# BRIDGE-UPDATE-LISTENER-2401 - the bridge's update listener and its config-flow reload (breaks on Home Assistant 2026.12)

Branch `fix/BRIDGE-UPDATE-LISTENER-2401`, cut from `origin/release/2400-train` at `ac87047b2` (the 2.40.0 version commit, before the UI
build commit). Target: hotfix **Arx 2.40.1**. No add-on version bump, no tag, no merge here (the lead does that). Bridge `smplwise_bridge`
0.10.3 -> **0.10.4**.

## 1. Evidence (lab, read only, 2026-11-04 audit)

Source: `private/planning/LAB_AUDIT_LOGS_2026-11-04_HE.md`, finding 4, and the raw Home Assistant log in `private-evidence/lab-audit-20261104/`
(14 occurrences across the captured log files; the audit counted 6 Home Assistant starts in the window, including 09:58:53 and 10:07:29
local). The line, verbatim apart from the logger prefix:

```
WARNING (MainThread) [homeassistant.helpers.frame] Detected that custom integration 'smplwise_bridge' has an update listener and
should use it for scheduling a reload. This will stop working in Home Assistant 2026.12.0, please create a bug report at
https://github.com/jonioliel/smplwise-bms/issues
```

Lab versions at the audit: Home Assistant 2026.10.4, bridge 0.10.2. WisKey rc.10 no longer shows its own variant of the warning.

## 2. Home Assistant facts relied on

- Core `homeassistant/config_entries.py` (branch `dev`, read 2026-11-04): the message is raised by `report_usage(...)` in exactly two places of
  `ConfigFlow`: `_abort_if_unique_id_configured(updates=..., reload_on_update=True)` when the entry data changed and the entry is LOADED or
  SETUP_RETRY, and `async_update_reload_and_abort(...)`, each only when `entry.update_listeners` is not empty. Core integrations get an
  error, custom integrations a log line - until 2026.12. `async_update_reload_and_abort` for subentries already raises
  `ValueError("Cannot update and reload entry with update listeners")`, and `OptionsFlowWithReload` raises when the entry has listeners.
- Developer blog, 2026-05-07, "config entry listener together with reloading methods"
  (https://developers.home-assistant.io/blog/2026/05/07/config-entry-listener-together-with-reloading-methods, core PR #169198):
  deprecated from 2026.6, an error from 2026.12, because the listener and the flow reload can reload twice or race. The documented ways out:
  drop the listener and rely on the flow's reload; use the non-reloading `async_update_and_abort`; or pass `reload_on_update=False` to
  `_abort_if_unique_id_configured`.
- `entry.add_update_listener` itself is NOT deprecated. The bridge already registered it as `entry.async_on_unload(entry.add_update_listener(...))`.

## 3. Root cause in the bridge

`config_flow._discovered_for_existing` (0.10.3, BRIDGE-STALE-DISCOVERY-2383): an accepted discovered pairing code is written with
`self._abort_if_unique_id_configured(updates=updates)` - default `reload_on_update=True` - on an entry whose setup registered an update
listener (`options_updated` in `__init__.py`, which pushes the user directory when the options change). In 0.10.2 the same call ran for every
replayed discovery, so the lab saw the warning at each start; 0.10.3 only reaches it for a real re-pair. From 2026.12 that call would raise
after the entry was already updated, so the reload - and with it the K-02 re-pair (`keyset.KeySet.repaired`) - would not happen until the
next Home Assistant restart.

The listener cannot simply be dropped: the options (delegation switch, service identity, extended mode, runnable list) are read live and
must NOT reload the bridge, and the bridge's own HA-06 code wipe is an entry update that must not reload either. `OptionsFlowWithReload`
would turn every options change into a reload, a behaviour change.

## 4. What changed

### Bridge 0.10.4 (`custom_components/smplwise_bridge`, mirrored by `scripts/sync_integration.py`)

- `config_flow.py`, `_discovered_for_existing`: the accepted update calls
  `self._abort_if_unique_id_configured(updates=updates, reload_on_update=not getattr(entry, "update_listeners", None))`.
  A loaded bridge entry has its listener, so the flow does not reload; an entry without a listener (not loaded, or waiting for a setup
  retry) keeps the flow's own reload, which Home Assistant performs only for a LOADED or SETUP_RETRY entry - the same set as before.
  Nothing else in the 0.10.3 path moved: no-change short cut without a ping, one signed ping, refused / unreachable -> abort without updates,
  the automatic-install flag only from the automatic-install discovery, never a code in the log.
- `__init__.py`: the listener is now `entry_updated`, still registered as `entry.async_on_unload(entry.add_update_listener(entry_updated))`.
  It compares `pairing_fields(entry.data)` - add-on address, pairing code, automatic-install flag - with the pairing the current setup was
  built from:
  - different (a discovery re-pair) -> `schedule_reload` (Home Assistant's `async_schedule_reload`; an older core without it gets
    `async_reload` as a task), once per new pairing. The fresh setup runs the unchanged K-02 path.
  - equal (an options change, or the bridge's own HA-06 wipe - `wipe_entry_code` moves the baseline to the blank code before it writes)
    -> no reload, the directory is pushed now, as before.
- One intended difference from 0.10.3: on a re-pair the old listener also pushed the directory once with the OLD keys just before the
  reload (the add-on refused it, and 0.10.3's push health would count it); 0.10.4 skips that push - the reloaded setup pushes with the new
  pairing right away, as before.
- Version 0.10.4 in `const.py` (with its history line), `manifest.json`, `www/smplwise-card.js`. The generated
  `smplwise_vms/integration/README.md` names no bridge version and is unchanged; the mirror was regenerated with
  `python scripts/sync_integration.py` and `--check` reports it up to date.

### Arx add-on

No code change. `bridge_install` copies the bundled bridge when the installed version differs, so Arx 2.40.1 refreshes an installed 0.10.3
on its own (the `bridge_update_pending` row asks for the one Home Assistant restart, as for every bridge version).

## 5. Tests

All on the workstation (`C:\cloude\smplwisebms\.venv`, Python 3.12, Windows), explicit files only; the runner was not used.

- New `smplwise_vms/backend/tests/test_bridge_update_listener_2401.py` (13 tests):
  static pin on both copies (no `async_update_reload_and_abort`, no `OptionsFlowWithReload`, the one updating abort decides
  `reload_on_update` from `update_listeners`, exactly one `add_update_listener`, wrapped in `async_on_unload`, the listener schedules the
  reload, `options_updated` gone); version 0.10.4 and byte-identical copies; the REAL config flow under a core that refuses the deprecated
  combination as 2026.12 will (the strict stub raises on the 0.10.3 call; a loaded entry's re-pair updates once without a flow reload; an
  entry without a listener keeps the flow reload; a stale code touches nothing); the REAL `async_setup_entry` listener under the key-rotation
  harness (options -> directory push, no reload; new code -> exactly one reload, no push; new address / automatic-install flag -> reload;
  the HA-06 wipe at setup is not a new pairing; flow + listener end to end).
  Regression proof: with the 0.10.3 `__init__.py` and `config_flow.py` restored, 7 of the 13 fail (the static pin, the version pin, the flow
  re-pair, the three listener reload cases and the end-to-end case); with 0.10.4 all pass.
- `test_bridge_stale_discovery_2383.py`: its flow stub now models `reload_on_update`, runs the entry's update listeners and refuses a flow
  reload on an entry that has one (2026.12 semantics); every 0.10.3 test passes unchanged in substance. `keyrot_harness.py`: the fake
  `config_entries` records `async_schedule_reload`, the fake entry exposes `update_listeners`.
- Version pins 0.10.3 -> 0.10.4 in 15 test files (the 2383 pattern), including the 2383 fixtures that set `bridge.integration_version`
  and the version inside signed directory payloads: they stand for "the running bridge is the current one" (`bridge_install.status`
  compares it with the installed source version; left at 0.10.3 they turned one 2383 test into `bridge_update_pending` in a combined run).
  `test_wiskey_pairing_2382`'s installed "0.10.3" is an older-version fixture on purpose and stays.

Receipts:

| Command (from `smplwise_vms/backend`) | Result |
|---|---|
| `pytest tests/test_bridge_update_listener_2401.py tests/test_bridge_stale_discovery_2383.py` | 44 passed |
| same new file against the 0.10.3 bridge code (regression proof) | 7 failed, 6 passed (expected) |
| bridge set: `tests/test_bridge_*.py` (24 files incl. K-01/K-02 harness, install, version pins), `test_bkpfix_295`, `test_wiskey_native_bundle_2272`, `test_self_update*.py` (5), `test_adoptr6_295`, `test_smallfixa_lease_hold_295`, `test_extid_followups`, `test_lovelace_card`, `test_wiskey_adopt_2272_review`, `test_wiskey_s4_core_observer`, `test_wiskey_pairing_2382` | **1319 passed, 5 skipped, 0 failed** (41 min; the five `test_self_update*.py` files first). A first run with them after `test_bridge_install.py` gave 1314 passed, 5 failed: one 2383 fixture not yet bumped (fixed, see above) and the 4 pre-existing order-leak failures below |
| `python scripts/sync_integration.py --check` | integration mirror is up to date |
| `python scripts/release_check.py` | every item `[ok]` (one version 2.40.0, bridge copies identical, bridge 0.10.4 = manifest = const) except the expected `[FAIL] git tag v2.40.0 not yet`; RESULT: ready for the owner's approval |

### Finding (pre-existing, reported, not changed)

`tests/test_bridge_install.py` leaves `bridge_install.STATE` (installed version, config dir) set for the rest of the process. Run before
`tests/test_self_update.py` / `tests/test_self_update_s3.py` in one process, 4 tests there see a `bridge` platform-restart reason and fail
(`test_state_before_any_check`, `test_platform_restart_reasons`, `test_state_carries_the_reasons_to_admins_only`,
`test_platform_restart_end_to_end`). Reproduced on `main` @ `613f4b0ef` (bridge 0.10.3) with
`pytest tests/test_bridge_install.py tests/test_self_update.py::test_state_before_any_check` -> 1 failed; it is not caused by this change
and the files pass on their own. A conftest reset of `bridge_install.STATE` (as already done for `ha_sync.STATE`) would fix it.

### NOT_RUN

- The full backend suite and the release gate (the runner is busy with the 2.40.0 gate and another agent; not used by instruction).
- Any test against a real Home Assistant core: no `homeassistant` package is installed on the workstation, so the flow and the listener
  run under the repository's stubs. The core behaviour they model was read from the core source (section 2), not executed.
- The lab: the bridge 0.10.4 is not installed there; the warning's disappearance after the next Home Assistant start is NOT verified.
- Frontend tests: no frontend file changed.

## 6. Owner note (Hebrew)

עדכון הגשר (0.10.4) מגיע עם Arx 2.40.1. בהתקנה הרגילה Arx מעתיק את הגשר בעצמו, והשורה של הגשר תבקש הפעלה מחדש אחת של תשתית המערכת (כשנוח).
אחרי ההפעלה האזהרה "has an update listener ... 2026.12.0" לא אמורה להופיע יותר ביומן.

בהתקנה ידנית של WisKey, Arx לא מעתיק את הגשר: העתיקו בעצמכם את התיקייה `custom_components/smplwise_bridge` בגרסה 0.10.4 מחבילת הגרסה
והפעילו מחדש את תשתית המערכת. יש לעשות זאת לפני עדכון התשתית לגרסה 2026.12 - מהגרסה הזו צימוד מחדש של הגשר ייכשל בלי התיקון.

## 7. Rollback

Revert the branch commit. A bridge 0.10.3 keeps working on Home Assistant up to 2026.11 (with the warning); nothing on the Arx side
depends on 0.10.4.
