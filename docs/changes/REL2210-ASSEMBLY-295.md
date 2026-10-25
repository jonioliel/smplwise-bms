# REL2210-ASSEMBLY-295 - assembly of the 2.21.0 candidate

Branch `release/2210`, cut from `origin/release/2201` @ `8aa101a4d214688b04e2a53483e414b33adceef9` (the 2.20.1 candidate). Each head
was verified with `git ls-remote` before merging. Merged with `--no-ff`, one merge commit each, in this order:

| # | Branch | Tip (ls-remote) | Branch base | Result |
|---|--------|-----------------|-------------|--------|
| 0 | `pilot/FIX2200-295` | `2087620163466ec034662fc9cdafd3c864dcadf2` (9 commits) | `a50059306` (`release/2200`) | clean (the 2.20.0 gate fixes; they also ship in 2.20.0) |
| 1 | `pilot/WK4ADOPT-295` | `80e3eed68b6fd929a6b819976e4a0430ac88efd4` (14 commits, contains `pilot/ASGI-295` @ `cac9ff553`) | `a50059306` | 1 conflict, resolved |
| 2 | `pilot/WKR5ADOPT-295` | `f97862b8f775cc28d5a7ec0409428a11fe350027` (7 commits, contains `pilot/WKR5-295` @ `dc89c339a`) | `e476e48ae` (`release/2190`) | 1 conflict, resolved; `wiskey_direct_join.py` auto-merged and checked |
| 3 | `pilot/PEERQUERY-295` | `d534f1014b2405a0956b07d157d6d7b9b11e6618` | `e476e48ae` | 2 conflicts, resolved; duplicate owner-id rule unified |
| 4 | `pilot/CAPEMERGENCY-295` | `732fab50e38703fb28007b0ffe754cb10f33dc08` | `e476e48ae` | clean (`door_emergency.py`, `routers/door_windows.py` auto-merged) |
| 5 | `pilot/CAPEMERGENCY2-295` | `d20fff019ebd9f10e084c8baef237d85059ccdcf` | `e476e48ae` | clean (same two files auto-merged) |
| 6 | `pilot/GENELEV-295` | `8c7c4340679494b494ee15da65a248364619c7cd` | `b6eb212ec` | clean |
| 7 | `pilot/T06ADMIT-295` | `67a5c40fad75244cbec139cc23362e53645630a0` | `e476e48ae` | clean (test + document only) |

Not merged (later versions / other trains): `pilot/TVOPT-295`, `pilot/POLISH2-295`, `pilot/HOMEMOCK-295`, `pilot/GATE2-295`,
`pilot/LEGALPACK-295`.

## Conflicts and how they were resolved

### WK4ADOPT-295 - `services/wiskey_peer.py`
WK4ADOPT was cut from `release/2200` before PERSONWRITES-CLEANUP-295 (PWCLEAN, on `release/2201`) removed `OneCommitLedger` and the draft1
receipt verifier. WK4ADOPT's W-010 block (`PEER_READ_TIMEOUT_S`, `PeerReadReceipt`, `peer_read`, `attest_port`) sat directly above
`OneCommitLedger`. Kept WK4ADOPT's W-010 block; `OneCommitLedger` stays removed. A search of the merged tree finds no caller of
`OneCommitLedger`, `ReceiptExpectation`, `FenceContext`, `verify_create_resolution`, `settle_create` or `CreateExpectation` outside the
removal notes and the test that asserts the names are gone.

### WKR5ADOPT-295 - `services/wa_template_send.py`
WK4ADOPT (W-013) and WKR5 (unit D) each added `TemplateSender.send_v2`, with different signatures:
- W-013: `person_revision`, the WisKey template pair from the stored reference (`TemplateRef.wiskey_ref` / `.wiskey_revision`), the
  explicit or installed transport, the window check, `TemplateRequestV2` + `wire_problem_v2`;
- unit D: `expected_person_revision`, an explicit `template_ref` + `expected_template_revision`, the transport from
  `TRANSPORT_V2_PROVIDER` (the direct join while `whatsapp/template_send_v2` is discovered), admission through `admit`.

Unified into ONE `send_v2` keeping both callers' contracts: the revision is `person_revision` or `expected_person_revision` (both given
must agree); the template pair is the explicit one, else the stored one, else `template_v2_unbound`; admission is switch + permit, the
reference, the shared pacing budget and the window (W-013 order); the transport is the explicit one, else `TRANSPORT_V2_PROVIDER()`
when it is set (answering None refuses `template_unsupported`, no fallback), else the installed transport; it must offer `send_v2`.
The request is always built by `TemplateRequestV2` and checked by `wire_problem_v2` before the hand-over; the answer is read by the v2
reader only; the result carries `retry_after_s` / `scope` (unit D). WKR5's private helper `_slots` (only used by its own `send_v2`) is
dropped. Production is unchanged: `TEMPLATE_SEND_SUPPORTED` / the permit stay False, so `send_v2` refuses before any hand-over.

### WKR5ADOPT-295 - `services/wiskey_direct_join.py` (auto-merged, the expected overlap)
`startup` keeps WK4ADOPT's construction of `join.registry_transport = LiveRegistryTransport(join.capture_port)` and
`join.resolve_transport = LiveResolveTransport(join.capture_port)` and adds WKR5's `wts.TRANSPORT_V2_PROVIDER = join.template_v2_or_none`
(and its removal in `shutdown`), the per-command discovery (`require_discovery`, `selected(command)`), the lineage administration and
`janitor()`. `envelope_kind` now reads the catalog (`wiskey_direct_catalog.envelope_for`), which still answers `wiskey-peer-query.v1` for
the four peer reads WK4ADOPT's live transports use. Tested: the WK4ADOPT W-010 / W-013 tests and the WKR5 join / bdg tests on the merged
tree (see Checks).

### PEERQUERY-295 - `services/wiskey_peer.py`, `services/wiskey_peer_registry.py`
- Textual conflicts: the `attest_transport` docstring and the module docstring of `wiskey_peer_registry.py`; both texts kept (the
  `attest_transport` docstring now names both product callers: the peer_query boundary and `attest_port`).
- Semantic overlap (auto-merged into two definitions): WK4ADOPT and PEERQUERY each added `SERVICE_OWNER_RE` and `is_query_owner_id`.
  Unified to ONE implementation, PEERQUERY's: `SERVICE_OWNER_RE = arx-service:[!-~]{1,116}` (printable ASCII without space, 128 code
  points at most, WisKey `reference`), `is_service_owner_id`, `is_query_owner_id = is_ha_user_id or is_service_owner_id`. It accepts every
  subject WK4ADOPT's narrower pattern `arx-service:[A-Za-z0-9_.-]{1,96}` accepted. Used by attestation, owner pin, binding row and mint.
  `docs/changes/WK4ADOPT-295.md` still quotes the old narrower pattern (historical record; the code has the unified rule).
- PEERQUERY's `wiskey_peer_query.DirectRegistryTransport` and WK4ADOPT's `wiskey_peer_registry.LiveRegistryTransport` both read
  `peer_bindings/get` over the direct join's port; both are kept (different gates: `wiskey.peer_query` vs `wiskey.peer_receipt` + pin).
  The registry client accepts either a native frame or PEERQUERY's `VerifiedResult`. Folding them into one transport is left to a later
  change.

## Migrations

No merged branch adds, edits or renames a file under `smplwise_vms/backend/smplwise/migrations/`
(`git diff --name-status 8aa101a4d HEAD` on that path is empty; also checked per branch against its merge base). The chain still ends at
`0177_announce_stage_a.sql`. Mapping: none. No test that lists migrations needed a change.

## New routes (API inventory 1570 -> 1578)

- WKR5-295 unit C (`routers/wiskey_lineage.py`): `GET /access-control/wiskey-lineage`, `POST /access-control/wiskey-lineage/reinitialise`,
  `POST /access-control/wiskey-lineage/{operation_id}/close`, `POST /access-control/wiskey-lineage/{operation_id}/resolve`.
- WKR5ADOPT-295 (W-006): `PUT /access-control/bulk-people/wiskey-csv/settings`, `POST /access-control/bulk-people/jobs/{job_id}/wiskey-preview`,
  `POST /access-control/bulk-people/jobs/{job_id}/wiskey-confirm`, `GET /access-control/bulk-people/jobs/{job_id}/wiskey-result`.

## Release prep on top

Version 2.21.0 (`smplwise_vms/Dockerfile`, `smplwise_vms/config.yaml`, `smplwise/__init__.py`), bilingual `smplwise_vms/CHANGELOG.md`
entry, `docs/release/2.21.0-RELEASE-NOTES.md`, `contracts/API_INVENTORY.md` regenerated (1578 routes).

## Checks run during assembly (local workstation, not the runner)

Recorded with exit codes in the release notes' verification receipt.

TODO for the lead (runner): `www` / `www-public` rebuild, the full gate, browser and pixel specs, tag.
