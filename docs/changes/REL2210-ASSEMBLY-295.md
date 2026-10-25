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

## Second round - `release/2210b` (cut from `release/2210` @ `3dd7b8c46`)

| # | Branch | Tip (ls-remote) | Result |
|---|--------|-----|--------|
| 8 | `pilot/FIX2200-295` | `8b35e887f5` (release/2210 had `2087620163`) | clean; 6 newer commits (announcements tab hides while voice announcements are off, logo-card rows, touch-size targets, test fixes) |
| 9 | `pilot/W031-295` | `dbc361661` | clean (no textual conflict) |
| 10 | `pilot/ADOPTR6-295` | `2eb5fe864` (cut from `9459502e9`) | clean; `wiskey_direct_join.py`, `wiskey_people_csv.py`, `test_wkr5_csv_295.py` auto-merged |

No migration file and no route decorator changed in the three merges (checked with `git diff 3dd7b8c46 HEAD`), so the chain still ends at `0177` and the API inventory stays at 1578 routes. Checks of this round: see the table at the end.

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

### Post-merge test fix (semantic, not a textual conflict) - `tests/test_t06_admission_295.py`
T06ADMIT pinned the 2.19.0 signing inventory. On the merged tree 30 of its tests failed: the stub join's `selected()` took no command
(WKR5 unit A calls `selected(command)`), four new modules match the signing-call pattern (`wiskey_peer.py` W-010, `wiskey_peer_query.py`,
`wiskey_people_csv.py` W-006, and `wiskey_capture_map.py`, which only names `port.call(` in a docstring), and the new lineage router
imports `NativeWriteError` from the writer. Fixed in the test (stub takes the command; the caller set, the inventory / table with
`features/people_csv_preview` under gate `G-PEOPLE-CSV`, and a narrow router-import exception for the error class), with a "REL2210
addendum" in `docs/changes/T06-ADMISSION-MAPPING-295.md`. No product code changed for it.

## Checks run during assembly (local workstation, not the runner; fakes only)

| Check | Exit |
|---|---|
| `tsc --noEmit` (frontend, Node 24) | 0 |
| `scripts/api_inventory.py` (1578 routes) | 0 |
| `scripts/release_check.py` | 0 (one `[FAIL]`: tag `v2.21.0` not yet created, expected) |
| pytest, per file at the release head: `test_peerquery_295`, `test_wkpeer_295`, `test_capemergency_295`, `test_capemergency2_295`, `test_elevator_alert_recipients_295`, `test_infra_elevators_280`, `test_wa_template_send_w11`, `test_wkadapt_resolve_295`, `test_wkcap_295`, `test_capmap_295`, `test_wk4adopt_295`, `test_wkjoin_295`, `test_wkr5_295`, `test_wkr5_295_bdg`, `test_wkr5_295_emergency`, `test_wkr5_295_writer`, `test_wkr5_csv_295`, `test_asgi_wiskey_295`, `test_wiskey_door_path` | 0 each |
| pytest `test_t06_admission_295` | 1 before the test fix above, 0 after |
| pytest regression (dependents of the touched modules): `test_backup_drill`, `test_bridge_key_pause_295`, `test_bridge_key_rotation_295`, `test_bridge_lease_event`, `test_bridge_lease_lifecycle`, `test_capture_lease_events`, `test_capture_lease_ledger`, `test_capture_lease_local_actor` | 0 each |
| pytest regression, one run: `test_wkvec_295`, `test_wka_295_lease_port`, `test_smallfixa_wiskey_switches_295`, `test_f3c_tpl_295`, `test_door_emergency`, `test_door_emergency_retry_open_295` | 0 |

NOT_RUN: the full backend suite; the other dependents (`test_capture_lease_review_fixes`, `test_capture_lease_triggers`,
`test_door_emergency_roles_emrole_295`, `test_doorwin2_review2`, `test_eccact_*`, `test_f3a_doorwin_*`, `test_f3c_e05_295`, `test_f3c_g03_295`,
`test_intercom_capture_lease`, `test_lease_wire_closed_295`, `test_lookup_scope`, `test_pwclean_295`, `test_smallfixa_lease_hold_295`,
`test_wiskey_final281`, `test_wkcapwire_295`); frontend unit specs touched by FIX2200 / GENELEV / WKR5ADOPT (`unit-*.spec.ts`), Playwright
browser, evidence and pixel specs; the `www` / `www-public` build; anything on the runner or against a real WisKey / HA / station / door.

TODO for the lead (runner): `www` / `www-public` rebuild, the full gate, browser and pixel specs, tag.

### Checks of the second round (`release/2210b`, local workstation, fakes only)

| Check | Exit |
|---|---|
| `tsc --noEmit` (frontend, Node 24) | 0 |
| `scripts/release_check.py` | 0 except one `[FAIL]`: tag `v2.21.0` not yet created (expected) |
| pytest per file: `test_adoptr6_295`, `test_announce_stage_a`, `test_remote_access`, `test_w031_295`, `test_wkcap_295`, `test_wkf01f02_295`, `test_wkr5_csv_295`, `test_wkwrite_295`, `test_capture_lease_review_fixes` | 0 each |

NOT_RUN in this round: the API inventory regeneration (no route decorator changed), the other dependents listed above, the frontend unit and Playwright specs touched by FIX2200, pixel baselines (not regenerated), the `www` rebuild, the gate.
