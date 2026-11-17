# CR-BRIDGE-COMMON-2440 - the bridge's duplicated helpers live once, in `_common.py`

Branch `pilot/CR-BRIDGE-COMMON-2440`, based on `origin/pilot/CR-WAVE2-COMBINED-2439` @ `97080bbc4`.
Contract: the `CR-BRIDGE-COMMON` row of `private/code-review-2026-11-13/MASTER_PLAN.md` (wave 3A, backend), finding
05:P2-20. Pure refactor of the bridge integration (`custom_components/smplwise_bridge`, mirrored to
`smplwise_vms/integration/smplwise_bridge` by `scripts/sync_integration.py`): no answer, refusal code, log line or
signature byte changes.

**A bridge version bump is needed and is NOT in this branch** (lead instruction: bump nothing here). The integration's
files changed and one file was added (`_common.py`); the add-on reinstalls the integration into Home Assistant by
version, so without a bump an installed 0.10.7 keeps the old files. The bump (manifest, `const.py`, the card's
`VERSION`, the version pins in the tests) belongs to whoever combines this batch with the bridge work in the 2.43.7
train.

## What moved

New `_common.py` - standard library only, imports no other bridge module (pinned by a test), so every module may
import it inside Home Assistant Core and in the plain unit tests.

| Duplicate (finding) | Was | Now |
|---|---|---|
| canonical JSON x3 | `signing.sign` (inline), `keyset.canonical`, `lease_contract._canonical` | `_common.canonical`; `keyset.canonical` and `lease_contract._canonical` are the same function object under the old names, `signing` imports it |
| entity-permission check x3 | `schedule_service._check_permissions`, `config_service._check_permissions`, `runnable.policy_refusal` | `_common.entity_policy_refusal(user, policy_control, ids, *, strict, unavailable, refused)`; the three module functions stay as one-line wrappers |
| `_refuse` x5 | `schedule_service`, `config_service`, `service_identity`, `cast_service`, `stream_source_service` | `_common.refusal(msg, error, path=None, *, text_id=False, **extra)`; each `_refuse` stays as a one-line wrapper (`service_identity._refuse` still logs first) |
| sliding-window limiter x3 | `cast_service`, `media_query_service`, `stream_source_service` (`_rate_limited`) | the trim-and-compare step is `_common.window_full(queue, now, window_s, limit)`; each `_rate_limited` keeps its own budgets and module-level queues |
| group walk x2 | `schedule_service._members_refusal` (depth 5), `wiskey_door_block.refusal` (depth 3) | reading the member list is `_common.group_members(state)` (`None` / the members / `UNREADABLE`), adopted by `schedule_service`; the walk keeps its own depth, codes and member rules. The door block's walk is NOT moved - see below |

The two strictness variants of the permission check are a flag, exactly as they were:

- `strict=False` (a Home Assistant person; schedules and automations): an administrator always may; any truthy answer
  of `check_entity` allows; codes `permission_check_unavailable` / `unauthorized`.
- `strict=True` (the service user of an Arx-only person; `runnable.py`): an administrator, or a user object that does
  not say, is a fault (`service_identity_policy_unavailable`); only the answer `True` allows.

The two variants of the refusal answer are a flag too: `text_id=True` (cast, stream source - handlers that may answer
before the message was judged) answers a non-text `request_id` as null; the plain variant hands it back as it came.

## Not done, on purpose

- **The device allow-list** (`service_identity.DEVICE_PAIRS` against `ALLOWED_SERVICES` in `__init__.py`) is not derived.
  `ALLOWED_SERVICES` must stay a literal in `__init__.py`: five tests read it from the syntax tree
  (`bridge_loader.init_allowed_services`, `test_devices.py`, the media fixture's parser, ...), and the STRUCT row says
  the literal stays. `service_identity.py` cannot import `__init__.py` (Home Assistant imports; it must stay
  importable without them). Moving the literal to `_common.py` would leave two literals again. The two lists are
  already held together by `test_bridge_service_identity.py` (`DEVICE_PAIRS == ALLOWED_SERVICES - alarm panel -
  NEVER_LOCAL`), which is the derivation as a test. Left as is; say so if the pin on the literal may move.
- **The second group walk** (`wiskey_door_block.refusal`) still reads the member list itself. That module's imports are
  pinned by its security review (`test_door_bridge_block_2404.py`: `__future__`, `collections.abc`, `typing` and
  `.const` only). Adopting `group_members` there is a 3-line change plus one more allowed import in that pin
  (`_common` is itself pinned as standard-library-only); I did not widen a security pin on my own. Lead decision; the
  helper and a test of both walks' rules (`test_both_group_walks_keep_their_own_rules`) are in place for it.
- `media_query_service._refuse` keeps its own body: it answers a `query` key between `request_id` and `error`.
- `config_policy.fingerprint` also calls `json.dumps` with the canonical arguments, over number-normalised values and
  for another purpose (comparing stored blocks); not a signature input, not in the row, left alone.
- `tests/fake_bridge_rotation_peer.py` keeps its own typed-out canonical JSON: it is the independent second
  implementation the harness compares the real key set with.

## Outside my rows

Bridge files not named in the row, touched minimally because the finding's duplicates live there (no other 3A row
holds them):

- `cast_service.py`, `stream_source_service.py`: `_refuse` and `_rate_limited` bodies (5 and 4 lines).
- `media_query_service.py`: `_rate_limited` (the two trim loops).
- Tests that executed `keyset.py` / `signing.py` / `push_health.py` as bare files
  (`importlib.util.spec_from_file_location` on the path, no package): a module with a relative import cannot be run
  that way. `tests/bridge_loader.py` (named in the row) gains `load_private(sub, tag)` - a private copy inside a private
  package, same isolation as before - and the four `_load` helpers call it: `test_bridge_gaps_2438.py`,
  `test_bridge_key_activation_295.py`, `test_lease_wire_closed_295.py`, `test_wxh_leftovers_2405.py`.

## Resolved file list

Bridge (source and mirror, byte-identical): `_common.py` (new), `signing.py`, `keyset.py`, `lease_contract.py`,
`schedule_service.py`, `config_service.py`, `runnable.py`, `service_identity.py`, `cast_service.py`,
`stream_source_service.py`, `media_query_service.py`.
Tests: `bridge_loader.py`, `test_bridge_common_2440.py` (new), the four loaders above. This note.

## Tests

RESULTS (actually run, 2026-11-16, workstation, `.venv` Python 3.12, `pytest -p no:xdist`):

- `tests/test_bridge_common_2440.py` (new, 22 tests): the canonical JSON against the original recipe and fixed
  literals, v1 / v2 signatures byte for byte, the refusal shapes per module, the ten-row table of the permission check
  in both variants through all three module names, both group walks' rules, the three limiters' counting, `_common.py`
  standard-library-only and mirrored, no second copy of the recipe left in the package. **22 passed** (first run).
- The per-service bridge suites and the pins around them, one run - `test_bridge_common_2440.py`,
  `test_bridge_schedule_service.py`, `test_bridge_config_service.py`, `test_bridge_runnable.py`,
  `test_bridge_service_identity.py`, `test_bridge_lease_event.py`, `test_bridge_lease_lifecycle.py`,
  `test_bridge_stream_source.py`, `test_media_query.py`, `test_bridge_cast_policy.py`, `test_schedimpact_295_bridge.py`,
  `test_entpol295_bridge_policy.py`, `test_lease_wire_closed_295.py`, `test_wka_295_lease_port.py`,
  `test_bridge_schedule_policy.py`, `test_bridge_config_policy.py`, `test_bridge_media_policy.py`,
  `test_bridge_gaps_2438.py`, `test_bridge_media_players.py`, `test_bridge_config_drift.py`,
  `test_bridge_schedule_drift.py`, `test_bridge_config_store.py`, `test_lovelace_card.py` (the mirror check),
  `test_wiskey_golden_vectors.py`, `test_bridge_080.py`: **1205 passed, 5 skipped** (11 min wall).
- An earlier run of a wider list stopped at collection: three test files executed `keyset.py` as a bare file
  (`ImportError: attempted relative import with no known parent package`). That is the loader change above; after it
  the files collect and pass (they are in the run above, or in the follow-up below).

NOT_RUN:

- The suites that drive the REAL bridge under the key-rotation harness or need the whole application
  (`test_bridge_key_activation_295.py`, `test_bridge_keyrot_harness_295.py`, `test_bridge_keyrot_harness_doors_295.py`,
  `test_door_bridge_block_2404.py`, `test_bridge_stale_discovery_2383.py`, `test_bridge_update_listener_2401.py`,
  `test_bridge_runtime_2436.py`, `test_wxh_leftovers_2405.py`, `test_bridge_key_rotation_295.py`,
  `test_bridge_key_pause_295.py`) had not been run when this commit was made (the workstation had under 0.5 GB free); a
  follow-up commit records their result.
- The full backend suite, the entry check, anything inside a real Home Assistant: NOT_RUN.

## For the closing chain (3B) / the lead

- The bridge version bump (above).
- `CR-BRIDGE-STRUCT-2440` is based on this branch.
- No entry check was run (batch rule): the lead combines.
