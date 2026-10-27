# WisKey owner26 adoption plan (WISKEY-OWNER26-297)

Branch `pilot/WISKEY-OWNER26-297`, base `origin/main` = `1b0ddd85c` (v2.23.2).

## Sources (read as data, WisKey repo is read-only)

- Forward prompt: `C:\hik intercom\private\wiskey\owner26-arx-complete-forwarding-2026-10-26\delivery\FORWARD_TO_ARX_HE.txt`
- Windows review folder: `...\windows-mac-owner26-intake-2026-10-26\delivery` (START_HERE, RECEIPT, WINDOWS_REVIEW_RESULT,
  CURRENT_ARX_ADOPTION_RECONCILIATION, ARX_PATCH_SEQUENCE_VERIFIED, SOURCE_FILE_SYMBOL_HASHES_VERIFIED, RUNS_VERIFIED,
  MASTER_CURRENT_34_WINDOWS, STATUS_BY_ITEM_WINDOWS, MEDIA_STATUS_WINDOWS, DEPENDENCIES_AND_QUESTIONS) and `original-Mac/`.
- WisKey commits (local Git, read without checkout): review `2ab94af2`, Mac delivery `772c5396`, product CODE `e732562e`.

## Drift check before applying

`origin/main` moved from the reviewed `011c97d4d` to `1b0ddd85c`. Between the two, none of the 13 touched paths and none of the
8 caller source files changed (`git diff --stat 011c97d4d..1b0ddd85c` touches only `home_screen_options.py` in `services/`). The
before-hash of every touched file on our base equals the `matches_pinned_before` hash of the reconciliation, and the three patch
files hash to the pinned SHA-256 values. So the patches apply as published; no semantic merge is needed.

## Steps

1. Apply in order, one commit each, unchanged bytes:
   `owner26-ha-scoped-terminal.patch` (bf69f8df...), `owner26-independent-listen.patch` (95686d77...),
   `owner26-signed-native-metadata-feed.patch` (7f4711e7...). Verify all 13 after-hashes.
2. Wire the original product callers to the existing Native APIs, without flipping any go-live / activation constant:
   - auto (W-018): `door_automation.LiveSender` -> Native `features/start` `door_automations` (automation actor: block id, run,
     trigger, creator, approver, grant revision = policy revision), completion read of the pulse receipt.
     `door_automation.GO_LIVE_PERMITTED` stays False.
   - program (W-023): `door_windows_engine.WiskeyProgramEngine` -> Native `stations/technical_program_list|save|action` over the
     direct port. `LIVE_ENGINE_BUILT` stays False, so the window factory still hands out the tier-D `PreparedEngine`.
   - template (W-013): already wired (TPLV2-295 route -> `wa_template_send.send_v2` -> `TRANSPORT_V2_PROVIDER` ->
     `DirectJoin.template_v2_or_none`). No code change; `TEMPLATE_SEND_SUPPORTED` stays False.
   - card (W-005): `SelectingLeaseTransport` direct branch gets the `MappedLeaseTransport` DTO9 pre-flight in front of
     `DirectLeaseTransport`. `MAPPING_ENABLED` and `capture_lease.GO_LIVE_PERMITTED` stay False.
3. Run the relevant backend suites and a real `npm run build:addon` on the runner; publish the combined SHA and artifact digest.
4. Write `OWNER26_ADOPTION_RECEIPT.md`: 34 rows x six states, leftovers, questions.

## Not done again (already closed in our history; never re-applied)

WR6-01 (`80e3eed68`), actor / rename (W031-295 `d98c0e47b`, `c58ce5493`, `42eddc46a`, `2df090d09`), direct_join overlap,
people CSV reader (`b3073998c`), listen publish-fence (ADOPTR6 `b3073998c`), historical person_writes removal (`8b7657e3a`).
No UNKNOWN is replayed. Historical receipts (Native 26, ASGI 28, frontend build 19ef, joint 1) stay attached to their own CODE.

## The 34 rows at the start of this task

| Row | Title | Already done in Arx before this task | Work in this task |
|---|---|---|---|
| W-001 | Live video, descriptor/lease | yes (lifecycle 002eec7b, ADOPTR6 listen fix) | none (patch 2 touches listen only) |
| W-002 | Incoming audio / listen-only | consumer done; standalone listen `downlink_pending` | patch 1 + patch 2 |
| W-003 | Talk and duplex | yes (DONE_WITH_EVIDENCE) | none |
| W-004 | Emergency new OPEN after UNKNOWN | yes (WKOPENUNK, EMROLE, WKR5 unit E) | none |
| W-005 | Card capture lease / DTO9 | map + Mac column (WK4ADOPT), not wired | card caller pre-flight wiring |
| W-006 | people_csv preview | yes, switch off | none |
| W-007 | KEY guard, two installers | Mac side | none |
| W-008 | Signed vectors | yes | none |
| W-009 | Durable event cursor | optional, not required | none |
| W-010 | peer / registry / resolve | yes (WR6-01 closed) | none |
| W-011 | People writes | yes | none |
| W-012 | Station removal verdict v2 | yes | none |
| W-013 | WhatsApp template v2 | route + provider wired (TPLV2-295), permit off | verify only |
| W-014 | name_ref | yes | none |
| W-015 | Candidate identity | per release | combined SHA of this branch |
| W-016 | Full ASGI of the combined candidate | script ready | run `test_asgi_wiskey_295.py` on this branch |
| W-017 | S8 / live proof | owner session | none (owner) |
| W-018 | Automations that open doors | built locked, sender refuses | auto caller wiring |
| W-019 | Emergency buttons live enabling | built off | none (owner) |
| W-020 | Supervised run of extended identity | not required | none |
| W-021 | Key rotation | not required | none |
| W-022 | Generic operation/status | not required | none |
| W-023 | Door-window program writes | engine `not_implemented` | program caller wiring |
| W-024 | Visitor pre-registration | frozen, off | none |
| W-025 | wiskey-bridge-command.v1 | not required | none |
| W-026 | Historical person_writes | removed in main | none |
| W-027 | Meta WhatsApp business templates | owner task | none |
| W-028 | Earlier switches / backup | yes | none |
| W-029 | Earlier adapters / metadata feed | yes | patch 3 (signed metadata feed) |
| W-030 | W10 slices / direct connection | yes | patch 1 (HA scoped terminal) |
| W-031 | T06 admission mapping | yes (3 XFAIL documented) | patch 3 adds G-NATIVE-METADATA |
| W-032 | T01-T11 table | yes | none |
| W-033 | Emergency adapter hash | yes | none |
| W-034 | HA 2026.10 | yes | none |
