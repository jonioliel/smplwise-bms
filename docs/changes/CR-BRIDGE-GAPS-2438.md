# CR-BRIDGE-GAPS-2438 - bridge behaviour gaps and nits

Branch `pilot/CR-BRIDGE-GAPS-2438`, based on `origin/pilot/CR-WAVE1B-COMBINED-2436` (`ffb4af2d5`; it carries
`CR-BRIDGE-RUNTIME-2436` and bridge 0.10.7). Code review 2026-11-13, MASTER_PLAN section 3.3 entry `CR-BRIDGE-GAPS-2436`:
report 05 P2-21 and P3-07. Edited in the canonical `custom_components/smplwise_bridge/` and mirrored with
`python scripts/sync_integration.py` (`--check` clean). **Bridge version not bumped** (stays 0.10.7; the plan does not ask for it).

## What changed

| Finding | Change |
|---|---|
| 05:P2-21 registry scans | `config_service.entity_of` asks Home Assistant's indexed `async_get_entity_id(domain, platform, unique_id)` (an answer outside the domain is ignored); `_wait_entity` polls it every 0.25 s for up to 5 s, so the walk over every entity per poll is gone. A duck-typed registry without the method is walked as before. |
| 05:P2-21 cast origin (verify intent) | Intent confirmed from `cast_service`'s own docstring ("a missing, stale or forged one leaves the origin unknown"): the announced origin now ages out. `current_origin()` returns it only while it was heard of within `ORIGIN_MAX_AGE_S` = 600 s (ten directory pushes, monotonic clock); after that a `play` is refused `cast_origin_unknown`, exactly as before any announcement. `stop` / `off` never needed it. |
| 05:P2-21 no signing key | `KeySet.sign` raises `keyset.NoSigningKey` (a `ValueError` subclass, so every old `except ValueError` still holds). The directory push signs before the POST and notes `no_signing_key` (new `push_health` reason, one warning with the Reconfigure fix, at most hourly) instead of `addon_unreachable`. Any other failure while building the push is still noted, never raised. |
| 05:P2-21 sync rate | `sync_directory` (the add-on's "sync users" button, also called by the add-on after an access change) goes through `push_health.Coalescer`: at most one push per 2 s, trailing edge - presses during a push or within 2 s after it wait and share ONE later push, so no caller ever gets an answer from a push that started before its call (a sync right after a change still carries it). A first version that returned the previous push's answer inside the window broke three key-rotation harness tests (`sync` right after a re-pair got no new push): exactly the freshness loss the trailing edge avoids. The 60 s periodic push is unchanged. |
| 05:P3-07 timeouts | The two `timeout=10` (directory push, pairing ping) are `aiohttp.ClientTimeout(total=ADDON_POST_TIMEOUT_S)`, `const.ADDON_POST_TIMEOUT_S = 10`. |
| 05:P3-07 unused constant | `const.SIGNATURE_WINDOW_S` removed (nothing imported it; `signing.py` keeps its own `SIGNATURE_WINDOW_S = 60`). |
| 05:P3-07 rotation reflection (verify) | Confirmed real: both peers sign with the same key, and a bridge answer (kid, 32-hex nonce, fresh ts) verifies as a control message. `KeySet.handle_control` now refuses, unsigned and before the MAC, a message carrying an answer-only field (`reply_to`, `ok`); the add-on never sends either in a control message (pinned by a test over `bridge_rotation._call`). |
| 05:P3-07 `ConfigStore` per item | `runnable.impact_refusal` / `execute_refusal` build the config store once per judgement (the item, its nested items, every target of one `execute`). |
| 05:P3-07 `single_config_entry` | **Deliberately not added.** The bridge already allows one entry (unique id = the domain). Home Assistant aborts every new flow of a single-config-entry integration that has an entry except reauth / reconfigure / ignore, which would include the Supervisor's `hassio` discovery flow that delivers a re-paired code to the existing entry (BRIDGE-STALE-DISCOVERY-2383). A test pins the absence with this reason. (Home Assistant's behaviour taken from its core flow manager, not run against a real Home Assistant here.) |
| 05:P3-07 changelog in docstrings, mirror check in 6 tests | **Not done here** - pure documentation / test-helper moves across files outside this branch's list; they belong with the bridge-structure branch (report 05 branch 17, P2-19 / P2-20, which also owns `tests/bridge_loader.py`). |

Test infrastructure: `keyrot_harness.py` and `test_bridge_stale_discovery_2383.py` stub `aiohttp.ClientTimeout` when aiohttp is not
installed (the backend venv has none; Home Assistant always has it); `fake_ha_config._FakeRegistry` gains `async_get_entity_id`.

## Tests (workstation, Windows, Python 3.12 venv, `-p no:xdist`)

| Run | Result |
|---|---|
| New `tests/test_bridge_gaps_2438.py` (coalescer (first version), failed push not cached, wiring; reflected answer refused before the MAC and still a valid signature; add-on never sends answer-only fields; named timeouts and the removed constant; manifest without `single_config_entry`; both copies identical) + new tests in `test_bridge_cast_policy.py` (origin ages out), `test_bridge_config_service.py` (index lookup; an edit waits through the index), `test_bridge_runnable.py` (one store per judgement), with those three files whole | 176 passed, 1 skipped |
| `test_bridge_stale_discovery_2383.py` (+ new no-signing-key test), `test_bridge_keyrot_harness_295.py`, `test_bridge_key_activation_295.py`, `test_bridge_runtime_2436.py`, `test_bridge_update_listener_2401.py`, `test_entpol295_bridge_policy.py`, `test_bridge_install.py` (first coalescer version) | 199 passed, 1 skipped, **3 failed** (keyrot harness: `sync` right after a re-pair answered from the previous push) - the coalescer was changed to trailing edge |
| After the change: `test_bridge_gaps_2438.py` | 8 passed |
| After the change: `test_bridge_keyrot_harness_295.py` + `test_bridge_stale_discovery_2383.py` | 66 passed |
| `python scripts/sync_integration.py --check` | up to date |
| `ruff check` on the touched files | no new finding (8 pre-existing F401 re-exports in `__init__.py`, unchanged) |

No request to a real Home Assistant, add-on or lab. NOT_RUN locally: the full backend suite - left to the runner entry check.
