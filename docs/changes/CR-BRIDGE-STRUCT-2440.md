# CR-BRIDGE-STRUCT-2440 - NOT IMPLEMENTED: the row's premise does not hold (lead decision needed)

Branch `pilot/CR-BRIDGE-STRUCT-2440`, based on `pilot/CR-BRIDGE-COMMON-2440` @ `ce1e19bab` (the same bridge package; this branch adds
this note only). Contract: the `CR-BRIDGE-STRUCT` row of `private/code-review-2026-11-13/MASTER_PLAN.md` (wave 3A),
finding 05:P2-19: a `BridgeRuntime` object in `entry.runtime_data`, one `SERVICES` table driving registration and
removal, the "screened, then refused" block once; files `__init__.py` + new `runtime.py`; "Pure move; the names the AST
tests pin stay (`entry_updated`, `schedule_reload`, the `ALLOWED_SERVICES` literal)".

**No code was changed.** The row assumes three source pins. The suite has many more, and they pin exactly the shape the
finding wants to remove. This is recorded here instead of being resolved silently (AGENTS / CLAUDE.md: contradictions
are recorded).

## What the tests pin in `__init__.py` today

Read on `origin/pilot/CR-WAVE2-COMBINED-2439` @ `97080bbc4`. Every line below is an assertion on the SOURCE TEXT or
the syntax tree of `custom_components/smplwise_bridge/__init__.py` (several also on the mirror):

| Target of the finding | Pinned by | What is pinned |
|---|---|---|
| one `SERVICES` table for the 11 registrations | `test_bridge_schedule_service.py` (`test_the_service_is_registered_with_response_and_removed_on_unload`), `test_bridge_config_drift.py`, `test_bridge_cast_policy.py`, `test_bridge_media_players.py`, `test_schedimpact_295_bridge.py`, `test_bridge_gaps_2438.py` | the literal calls `hass.services.async_register(DOMAIN, SERVICE_X, <handler>, schema=X_SCHEMA, supports_response=SupportsResponse.ONLY)`, per service, as text; two tests slice the source between `async def <handler>` and the next `hass.services.async_register` |
| one table for the 11 removals | `test_bridge_schedule_service.py` (same test), `test_bridge_config_drift.py`, `test_bridge_media_players.py` | the syntax tree of `async_unload_entry` must contain eleven literal `hass.services.async_remove(DOMAIN, SERVICE_X)` calls - the set of their second arguments is compared by name |
| the "screened, then refused" block once | `test_bridge_service_identity.py` (`test_every_signed_service_is_screened_and_no_handler_verifies_again`), `test_bridge_stream_source.py`, `test_schedimpact_295_bridge.py` | `await screened(SERVICE_X, call)` as text for each of the seven services; `service_identity.PREVERIFIED` exactly five times in the file |
| handlers as methods of a runtime object, in `runtime.py` | `test_door_bridge_block_2404.py` (`_setup_and_execute`), `test_bridge_schedule_service.py` (`test_the_execute_service_calls_the_guard_before_it_calls_home_assistant`), `test_bridge_runnable.py`, `test_bridge_stream_source.py`, `test_bridge_media_policy.py` | `execute` must be an `async def` NESTED IN `async_setup_entry` of `__init__.py`; the order of its checks is asserted on its unparsed text (`execute_refusal(hass, data)` < the door block < the media policy < `hass.services.async_call(domain, service, data`); `stream_source`, `config_item` and `schedule` are found by name with exact call texts (`schedule` with its four-space indentation) |
| `BridgeRuntime` in `entry.runtime_data` | `test_bridge_runtime_2436.py` (`test_the_directory_pushes_are_tied_to_the_entry`) | `entry.runtime_data = saver` as text in `async_setup_entry`; exactly two `entry.async_create_background_task(hass, push_directory()` there; `persist()` in `async_unload_entry` |
| the options readers / the push as runtime methods | `test_bridge_service_identity.py`, `test_bridge_runnable.py`, `test_entpol295_bridge_policy.py`, `test_bridge_stale_discovery_2383.py` (two tests), `test_door_bridge_block_2404.py`, `test_bridge_config_drift.py` | `entry.options.get(CONF_LOCAL_IDENTITY_EXTENDED, False) is True`, `runnable.allowlist(entry.options.get(CONF_LOCAL_IDENTITY_RUNNABLE))`, `wiskey_door_block.policy(entry.options)` in the setup's text; the push's body sliced between `async def push_directory` and `async def sync_directory`, with the order of its statements asserted |
| anything else leaving `__init__.py` | `test_bridge_lease_lifecycle.py`, `test_lovelace_card.py`, `test_wiskey_adopt_2272_contrib.py`, `test_wka_295_lease_port.py`, `test_bridge_stream_source.py` / `test_bridge_schedule_service.py` / `test_bridge_config_drift.py` (the schemas as top-level assignments), `test_bridge_runtime_2436.py` (the loaded-distribution block) | the lease attach / detach calls in setup / unload, the card registration, the native setup, the lease re-exports, each schema, the import-time digest |
| the harness seam | `tests/keyrot_harness.py` (`BridgeSide.start`) | the harness replaces `KeySet` ON THE PACKAGE MODULE before `async_setup_entry`; whoever builds the key set must look the name up there |

Fourteen test files outside the row, about twenty assertions. Most of them are the written conclusion of a security
review of the bridge (the door block's order, "every signed service is screened", "no handler verifies again", the
schedule fence, the stream source's waiver): they pin the text because Home Assistant cannot be imported in the suite.

So the move is not "pure" in the sense the row means. Doing it means rewriting those pins to follow the code into
`runtime.py` and into a table - a change of the bridge's security test contract, on the path that opens doors and
disarms alarms. That is a decision for the lead (and probably the owner of the security reviews), not for the
agent that moves the code.

## Options (recommendation first)

a. **Re-point the pins first, in their own branch, then move (recommended if P2-19 is still wanted).** One helper in
   `tests/bridge_loader.py` that returns the handler's source wherever it lives (`handler_source("execute")`,
   `registered_services()`, `removed_services()`), and the ~20 assertions rewritten onto it while the code is still
   where it is - green before and after, reviewable as a test-only change. Then the move is the mechanical branch the
   row describes, and the bridge version bump rides with it. About a day each; the second is Medium-high risk as the
   plan says.
b. **Drop P2-19.** The duplication it names is real but small (22 lines of registration / removal, 14 lines of
   "screened" blocks) and the closures are what the pins read. `CR-BRIDGE-COMMON-2440` already removed the duplicates
   that were logic.
c. **A pin-compatible subset.** I looked for one and found nothing worth a branch: every closure with content is
   pinned by name or by text, and what is not pinned (`set_entity_area`, `rotate`, `lease`, `housekeeping`) is short
   and would move alone, leaving the structure less coherent than it is.

## Tests

None run for this branch (no code). NOT_RUN: everything in the row (`test_bridge_update_listener_2401.py`, the
key-rotation harness) - nothing changed that they could see.
