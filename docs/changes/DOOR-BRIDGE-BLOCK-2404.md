# DOOR-BRIDGE-BLOCK-2404 - bridge 0.10.5 execute block for WisKey doors (WXD5A) and gate rows T19 / T24 (WXD11)

Branch `pilot/DOOR-BRIDGE-BLOCK-2404` from `origin/release/2403-train` @ `5573b8e58` (the 2.40.3 train; ships later as 2.40.4).
Owner decision 2026-11-05, round 22, Q3 = a: finish the open door-safety work on the board. Cards WXD5A ("Bridge 0.8.1 execute block for
WisKey doors (admin setting)") and WXD11 ("Door-path gate T1..T26 on fakes", rows T19 and T24 open). WXD5B is OBSOLETE (replaced by the
WisKey direct path) and was not touched: no `door_open` / `door_open_status` in the bridge.

Sources: `docs/changes/CR-033-WISKEY-DOOR-PATH.md` (decision 20, 5.3, 5.5, 11.3 "New T24" and "T19 revised"),
`docs/changes/CR-033-INTEGRATION-NOTES.md` section 4, `docs/security/SECURITY_REVIEW_WXD_DOORPATH_2026-10-12.md` (I10 / I11, T19 / T24
rows), `docs/changes/BOARD-HYGIENE-2403.md`, `docs/changes/BRIDGE-UPDATE-LISTENER-2401.md` (the version pin list).

**Built and tested on fakes and fixtures only.** No lab, no Home Assistant, no WisKey, no station, door, lock or relay was contacted; no
secret was read. The runner was not used (no UI change, no browser spec). No Arx version bump, no tag, no merge.

## 1. What changed

### 1.1 Bridge `smplwise_bridge` 0.10.4 -> 0.10.5 (`custom_components/smplwise_bridge`, mirrored by `scripts/sync_integration.py`)

- New `wiskey_door_block.py` (dependency-free; the rule). In `smplwise_bridge.execute`, after the scheduler-switch guard and BEFORE the
  media checks, the run fences and the one `hass.services.async_call`, a `lock.*` or `button.press` call is refused with
  `{"ok": false, "error": "wiskey_door_execute_blocked", "reason": <token>, "request_id": ...}` and nothing is called when, under the
  policy `blocked`:
  - a target's entity-registry platform is `hikvision_intercom` or `smplwise_intercom` (`wiskey_platform`);
  - a target is a group (its state lists `entity_id` members, e.g. a lock group) with such a member, up to 3 levels (`wiskey_group_member`);
  - where any WisKey entity exists in the registry: a `lock` target (or member) the registry does not know (`unknown_lock`), or a group
    whose members cannot be read (`group_unverifiable`);
  - the registry or a state cannot be read (`registry_unavailable`, fail closed).
  Every other domain is never looked at. The same answer code as the add-on's own guard (2.4.9), so `ha_actions.bridge_status` already
  maps it to `failed` (never "pending").
- The setting: entry option `wiskey_execute_policy`, `blocked` | `allowed`, in the bridge's options flow (section 3). Default `blocked`:
  absent, empty or any value other than exactly `allowed` is `blocked`. Read live on every call; changing it writes the entry options,
  which the 0.10.4 update listener answers with a directory push and NO reload (a reload would revoke the WisKey capability).
- Logged and audited without secrets: a warning `smplwise_bridge.execute lock.unlock refused: wiskey_door_execute_blocked (<reason>,
  policy blocked, request <id>)`, and the Home Assistant event `smplwise_bridge_door_execute_refused` (logbook / event bus) with
  `request_id, domain, service, entity_ids, reason, code, policy`, fired in the context of the HA user the message named. Never the
  signature, nonce, key, signed body or service data (a lock code never appears). A failing event bus never lifts the refusal.
- The directory push carries `wiskey_execute_policy` (state for the add-on, never a request).
- `const.py` (version + history), `manifest.json`, `www/smplwise-card.js` at 0.10.5; options-flow texts in `strings.json`,
  `translations/en.json`, `translations/he.json` (field label, a paragraph in the description, the two option labels).

Not changed: WisKey's own direct path (the add-on talks to WisKey itself; it never passes through `execute`), WisKey's own entities and
screens in Home Assistant, every other `execute` service, every other bridge service. The block applies to Arx-only people's messages
(`on_behalf_of`) too.

### 1.2 Add-on (no version bump)

- `services/door_execute_guard.py`: `note_directory_push` records the bridge's reported policy as `bridge.wiskey_execute_policy`
  (`blocked` | `allowed`; nothing recorded for an older bridge that does not report it) and audits a change as
  `bridge.wiskey_execute_policy_seen` (`{policy, previous}`). Called from the signed `/ha/bridge/directory` route. Read-only state; the
  add-on's own guard is independent of it and is not weakened by it (CR-033 13.2). Docstring updated (0.8.1 -> 0.10.5).
- `services/backup.py`: `bridge.wiskey_execute_policy` joins `SETTINGS_KEEP` (runtime state, never taken from an archive).
- No new door-opening or program-write site anywhere; nothing in a timer-shaped module. `test_fake_doorwin_closed_rule_sr1` unchanged
  and green; the bridge module states its SR-1 review in its docstring and a test pins that it calls nothing and is not timer-shaped.

### 1.3 Tests

- New `tests/test_door_bridge_block_2404.py` (21 tests): the rule (policy parsing, WisKey locks / buttons / groups, unknown locks only
  where WisKey exists, `allowed`, other domains never judged, fail closed, answer and event contents); static pins (the block sits
  before the media checks, the run fences and the one service call; policy read live; the push reports it; 0.10.5 everywhere; the
  bundled copy identical; translations); the REAL bridge under the key-rotation harness (`keyrot_harness.BridgeSide`) with a fake
  registry / states / services / event bus: **T24** - refused under `blocked` (default), allowed under `allowed`, an unknown registry
  entry refused, the policy changed without an entry reload, a broken registry, a failing event bus, a bad signature answered first;
  the options flow (field offered with `blocked` by default, stored values); the add-on recording / auditing the reported policy; end to
  end, a tile command whose add-on mirror row is stale reaches the REAL bridge and is refused there (row `failed`, audit `denied`
  `wiskey_door_execute_blocked`), and a known WisKey button never leaves the add-on.
- New `tests/test_wxd11_t19_fake_ha_context.py` (4 tests), **T19 fake-HA part**: `tests/fake_ha_config.py` gained an opt-in
  `model_context` (default off, every existing test unchanged): a script run takes the calling context (same id / user_id) and hands it on
  to a nested `script.turn_on` (parallel branches walked); an automation `trigger` starts a new context with `parent_id` = the caller's id
  and `user_id` = None (Home Assistant's rule); every step of a run is recorded with its context. `FakeContext` gained `parent_id`;
  `FakeBridgeHass` passes the context on. Proven: no door step reaches Home Assistant in any context, while the door path names the
  operator even where the HA context is anonymous (automation); an unconverted item never runs; two operators' concurrent runs keep their
  own context, doors, run op ids and request ids; a door permission revoked while the first door is out stops the second door before
  anything is sent (`not_sent`, audited `denied`), and the next run is refused before it runs.
- `tests/test_wiskey_door_gate.py`: T19 and T24 rows list the new tests; `OPEN` is empty (T13 closed in 2.40.0).
- Version pins 0.10.4 -> 0.10.5 in 16 test files (the 2401 pattern, including the 2383 fixtures that stand for "the running bridge is the
  current one"); the 2401 docstrings that describe 0.10.4 stay.

## 2. Recorded deviations (not silently resolved)

1. **Version number.** CR-033 decision 20 / 5.3 planned "bridge 0.8.1". The bridge is at 0.10.4, so the block ships as 0.10.5.
2. **Where the setting lives.** CR-033 5.3 planned a signed `bridge_policy.set` message from an Arx setting (Settings -> infrastructure,
   system administrator). Built instead with the bridge's existing settings pattern (as the task required): an options-flow field that
   only a Home Assistant administrator can change inside Home Assistant - the same pattern as the delegation switch and the extended
   mode. Nothing the add-on sends can loosen the block, which is the stronger property for a defence-in-depth control. Arx shows the
   reported value only (state + audit). If the owner still wants the Arx-side switch, it is a follow-up (a signed message and a settings
   row), not built here.
3. **Unknown locks.** 5.3 says "unknown registry entry for a lock target: refused". Built as the add-on's guard does it (review I9): only
   where a WisKey entity exists in the registry; an installation without WisKey keeps its unregistered (YAML) locks working. Under
   `allowed` nothing is judged.
4. **Scope of "door services".** `lock.*` and `button.press` on WisKey-platform targets, direct or as a group member. A script / scene /
   automation run that reaches a WisKey door is judged by the add-on's R-17 run guard (D9) and, for Arx-only people, by the bridge's run
   fences (0.9.2); this block does not expand script steps.

## 3. Owner note

- **The setting:** `wiskey_execute_policy` - Home Assistant > Settings > Devices & services > SMPLWISE Bridge > Configure, the last
  field, "Intercom (WisKey) doors through the bridge's device commands" (Hebrew: "דלתות אינטרקום (WisKey) דרך פקודות ההתקנים של
  הגשר"). Only a Home Assistant administrator can open that form. Arx records what the bridge reports as `bridge.wiskey_execute_policy`
  and audits every change (`bridge.wiskey_execute_policy_seen`).
- **The default is blocked** ("Blocked (default)" / "חסום (ברירת מחדל)"). Choose "Allowed" only after a security review. WisKey's own
  screens and WisKey's direct path are not affected either way.
- **Manual WisKey install:** where the bridge is installed by hand (a manual WisKey installation), copy the folder
  `custom_components/smplwise_bridge` at version **0.10.5** into Home Assistant's `config/custom_components/` by hand, then restart Home
  Assistant once. With the managed install, Arx copies the bundled 0.10.5 itself (`bridge_install`, the copy happens when the installed
  version differs) and asks for the one restart.
- Release order (CR-033 5.5) is already met: the add-on that routes WisKey tile opens through the door path (D4) shipped long ago, so the
  block breaks nothing today. An add-on older than that would see its WisKey tile unlocks refused (fail closed, not unsafe).

## 4. Receipts

All on the workstation (`C:\cloude\smplwisebms\.venv`, Python 3.12, Windows), from `smplwise_vms/backend`, explicit files only. The
runner was not used.

| Command | Result |
|---|---|
| `pytest tests/test_door_bridge_block_2404.py` | 21 passed |
| same file with the 0.10.4 `__init__.py` restored (regression proof) | 8 failed, 13 passed (expected: the T24 harness cases, the end-to-end case, the static pins) |
| `pytest tests/test_wxd11_t19_fake_ha_context.py` | 4 passed; the concurrency test alone 8 of 8 runs passed after its fake-HA side was serialized (before that 2 of 8 runs lost a thread to the fake's non-thread-safe YAML layer - a fake limit, not a product finding) |
| set B, 38 files: the two new files, SR-1 (`test_fake_doorwin_closed_rule_sr1`), `test_gate_always_run`, every door-path file (`test_wiskey_door_*` 7, `test_wiskey_d6_d8`, `test_security_review_wxd_fixes`, `test_wxd10_door_jobs`, `test_intercom`), every user of `fake_ha_config` / `automations_fixture` (17 files), `test_service_identity*` (2), `test_backup`, `test_backup_sensitive`, `test_version`, `test_bridge_keyrot_harness_doors_295` | **903 passed, 0 failed** (exit 0) |
| set A, the bridge set of BRIDGE-UPDATE-LISTENER-2401: `test_self_update*.py` (5), `test_bridge_*.py` (24, incl. K-01/K-02 harness, install, update_listener_2401, stale_discovery_2383, the version pins), `test_bkpfix_295`, `test_wiskey_native_bundle_2272`, `test_adoptr6_295`, `test_smallfixa_lease_hold_295`, `test_extid_followups`, `test_lovelace_card`, `test_wiskey_adopt_2272_review`, `test_wiskey_s4_core_observer`, `test_wiskey_pairing_2382` | **1319 passed, 5 skipped, 0 failed** (exit 0) |
| `python scripts/sync_integration.py --check` | integration mirror is up to date |
| `python scripts/release_check.py` | every item `[ok]` (version 2.40.2 of the train base, bridge copies identical, bridge 0.10.5 = manifest = const); RESULT: ready for the owner's approval |

## 5. NOT_RUN / limits

- Live acceptance (DR-8): the bridge 0.10.5 on the lab, a refused WisKey `execute` seen in the HA logbook, the policy switched in the
  real options flow. Not run - needs the owner's approval and a Home Assistant restart.
- The options form rendered in a real Home Assistant (the test drives the flow class with stubbed `vol` / `selector`).
- The full backend suite and the release gate (the 2.40.3 gate is running on the runner; no runner job was started).
- `ha_actions` UI text for the bridge's refusal: unchanged (the add-on already maps `wiskey_door_execute_blocked`).

## 6. Rollback

Revert the branch commits. Installed bridges go back to 0.10.4 with the next add-on that bundles it (bridge_install copies when the
version differs) and one Home Assistant restart; the stored option `wiskey_execute_policy` is then ignored. The add-on's own guard is
unchanged either way.
