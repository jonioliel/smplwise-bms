# PERSONWRITES-CLEANUP-295 - remove the historical WisKey person-write reads (W-026)

Status: DONE on branch `pilot/PWCLEAN-295` (from `release/2200` @ `47ca1a2c0`). Owner decision 2026-10-25: option A, clean up code,
tests and documents ONLY. No table is dropped or altered, no migration is added, no stored row is touched.
Input: the read-only inventory `private/review/W026_PERSON_WRITES_INVENTORY_HE.md` (not in Git).

## What W-026 is

Two command names that WisKey never shipped, and the Arx code that was written against them:

- `hikvision_intercom/signed_person_writes/status` (contract `wiskey-signed-person-completion-draft1`, capability
  `signed_person_completion_read_v1`), read by `wiskey_peer.verify_receipt`.
- `hikvision_intercom/person_writes/resolve_create` (contract `wiskey-create-resolution-draft1`, capability
  `person_create_resolution_v1`), an Arx proposal, read by `wiskey_intents.verify_create_resolution`.

Neither name was in any command catalog, allow-list, contract file or fixture, and no product module called the code. The real receipt
read is `hikvision_intercom/peer_receipts/resolve` (WKADAPT-295).

## Removed

| File | Removed | Why it was dead |
|---|---|---|
| `services/wiskey_peer.py` | `RECEIPT_PROTOCOL`, `RECEIPT_COMMAND`, `RECEIPT_CAPABILITY`, `RECEIPT_SCOPE`, `RECEIPT_KEYS`, `STATES`, `NEVER_REASONS`, `UNKNOWN_REASONS`, `ReceiptExpectation`, `FenceContext`, `verify_receipt`, `OneCommitLedger` | used only by `verify_receipt` / `verify_create_resolution` and their tests; `OneCommitLedger` only took `ReceiptExpectation` + `verify_receipt` verdicts |
| `services/wiskey_intents.py` | `PROPOSED_CREATE_COMMAND`, `PROPOSED_CREATE_CAPABILITY`, `CREATE_PROTOCOL`, `CREATE_SCOPE`, `CREATE_KEYS`, `CreateExpectation`, `CreateVerdict`, `_unknown`, `verify_create_resolution`, `settle_create`, `ExactOriginal.as_request` | the never-shipped create proposal; no caller |
| `tests/fake_wiskey_peer.py` | `receipt_result`, `receipt_frame`, `REQUEST_ID`, `OPERATION_ID`, `OPERATION_BINDING` | only fed the removed receipt tests |
| `tests/test_wkpeer_295.py` | the "shared receipt" and "one central commit" sections (`verify_receipt`, `OneCommitLedger`), `_expect`; two registry tests lost their trailing `verify_receipt` assertion (the registry assertions stay; the rotated-binding test now asserts the current peer is the new revision) | tested removed code |
| `tests/test_eccact_intents_295.py` | the create-resolution tests (`verify_create_resolution`, `settle_create`, `CreateExpectation`, `as_request`) | tested removed code |
| `tests/test_wkadapt_resolve_295.py` | the `RECEIPT_COMMAND` / `PROPOSED_CREATE_COMMAND` comparison | replaced by an assertion that the names are gone and that `peer_receipts/resolve` is the only receipt read |

## Kept, and why

| Kept | Why |
|---|---|
| table `wiskey_fence_intents`, migration `0145_wiskey_peer_intents_feature_registry.sql` (byte-identical, test-asserted) | owner option A; dropping it needs its own change request and migration (option B) |
| `wiskey_peer.ReceiptVerdict`, `_unknown`, `_result_of` | live path: `verify_resolution` reads every envelope through `_result_of`; its refusal codes `malformed_envelope`, `error:<code>`, `error` must not change |
| `wiskey_intents` module: `admit`, `original`, `state`, `mark_sent`, `mark_unknown`, `_terminal`, `settle_update`, `open_intents`, `settle_resolution`, `LiveResolveTransport`, `RESOLVE_COMMAND` | the intent state machine of migration 0145 and the real `peer_receipts/resolve` settlement (the inventory: "verify there is no dependency before removing the whole module"); `settle_update` is not on the inventory's removal list and keeps its refusal code `create_needs_create_resolution` |
| `wiskey_peer` seam (`VerifiedPeerRef`, `TransportAttestation`, `as_peer_binding`, switches), `ResolveOriginal`, `resolve_parameters`, `verify_resolution`, `ResolutionVerdict` | the real contract |
| `wiskey_native_write.verify_receipt` and `RECEIPT_*` there | a different, live function (WKWRITE-295, `wiskey-native-peer-source.v2`); same name only |
| `wiskey_write_lineage.py` and its `lineage.sqlite3` | live write lineage (WKWRITE-295), not W-026 |
| `PERSON_WRITES` in `tests/fake_wiskey.py`, `person_writes` in `tests/test_intercom_writes_s11.py` | an unrelated variable name for the `users/*` command set |
| comment `OneCommitLedger, durable` in migration 0145 | migrations are never edited; the rule it names lives on in the unique indexes and `_terminal` |
| `CR-ACR7-FENCE-02.md`, `CR-ECCACT-295.md`, `CR-ARX-WISKEY-SHARED-IDENTITY-BUILD-NOTES.md` | historical design records; each got a SUPERSEDED note, the text is otherwise unchanged |
| `private/planning/...` WisKey inbox mentions | gitignored evidence, out of scope |

## Wire behaviour toward WisKey: unchanged

`tests/test_pwclean_295.py` proves it:

- the canonical command catalog (every `wiskey_channels.ALLOWLISTS` channel, `LEASE_SIGNED`, `W10_COMMANDS`,
  `wiskey_command_port.PEER_QUERY_COMMANDS`, the guard codes `not_allowed_on_channel` / `reserved_frame_key`) hashes to the same
  sha256 as on the pre-cleanup head, and the pinned `people_command_catalog.json` fixture is byte-identical;
- no product module, fixture or contract JSON names a historical command, protocol or capability;
- the `peer_receipts/resolve` constants are unchanged, and the envelope refusal codes of `verify_resolution` are pinned;
- the intent refusal codes `create_needs_create_resolution` and `not_a_resolution` are unchanged;
- migration 0145 is byte-identical and no other migration touches `wiskey_fence_intents`.

## Not done here

- No database inventory of `wiskey_fence_intents` on the owner's installation (inventory gate 1; read-only on a copy, owner's call).
- Option B (dropping `wiskey_fence_intents`) needs a separate change request, a new migration number and owner approval.
- WisKey confirmation that `person_writes/context|submit|resolve` (the ACR7 fence draft) was never shipped is not recorded; Arx never
  built it, so there was no code to remove.

## Rollback

Revert the cleanup commit. No data, schema or setting changed, so nothing else is needed.
