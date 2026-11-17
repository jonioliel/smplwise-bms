# CR-W3-BE-COMBINED-2441 - the wave-3A backend code-review branches in one branch, one entry check

Branch `pilot/CR-W3-BE-COMBINED-2441`, based on `origin/pilot/CR-WAVE2-COMBINED-2439` @ `4e52e5e4a` (wave 2 + its entry fixes).
Brief: `private/planning/AGENT_BRIEF_W3_COMBINE_2026-11-16.md` (section "Backend"). It carries every pushed backend `-2440`
branch of the code review of 2026-11-13 (MASTER_PLAN section 3.4), merged `--no-ff` one by one, so that ONE runner entry check
covers them. No version bump, no tag, no new behaviour of its own: beyond the merges there is one `fix(merge)` commit (below).
No device, NVR, go2rtc, Home Assistant or lab host was contacted.

Each source branch keeps its own change note `docs/changes/CR-<NAME>-2440.md`; read it for what the branch does.

## Merges (all `--no-ff`, origin heads of 16.11.2026 evening, in this order)

Seventeen of the branches were cut from the older wave-2 head `97080bbc4`; merging them onto `4e52e5e4a` was expected and
needed nothing by hand.

| # | Merge commit | Branch | Head |
|---|---|---|---|
| 1 | `2754f00f4` | CR-TK-SQL-2440 | `99f8ff2d6` |
| 2 | `b0cceddac` | CR-TK-MONEY-UTILS-2440 | `8ab007d8b` |
| 3 | `29a2f68fe` | CR-TK-OUTBOX-FILTER-2440 | `b72db1a57` |
| 4 | `d8b945e83` | CR-TK-EXCEPT-LOG-2440 | `a20c30f85` |
| 5 | `c0880ac7d` | CR-SPLIT-TICKETS-ADMIN-2440 (after the TK-* ones) | `97a034043` |
| 6 | `5df756945` | CR-SPLIT-ACCESS-CONTROL-2440 | `1cb31ef7d` |
| 7 | `d89cd7951` | CR-SPLIT-ACCESS-2440 (stacked on 6) | `35ce75482` |
| 8 | `5f49e512b` | CR-BRIDGE-PREVERIFY-2440 | `b80b40b4d` |
| 9 | `6bad8e85f` | CR-BRIDGE-COMMON-2440 | `ce1e19bab` |
| 10 | `e4f1809a6` | CR-BRIDGE-STRUCT-2440 (stacked on 9; a change note only, no code) | `83ee10144` |
| 11 | `57b74c31f` | CR-REDACT-2440 | `bbc52c7b9` |
| 12 | `dd88ada90` | CR-BE-TWINS-2440 | `4908e4835` |
| 13 | `d4542f5e6` | CR-BE-SMALL-UNIFY-2440 | `c9ddd271d` |
| 14 | `d8ba046c3` | CR-MAIN-ROUTERS-TABLE-2440 | `4c9deca82` |
| 15 | `92cf4a1bd` | CR-SCHEMA-PROBES-2440 | `5fde693e3` |
| 16 | `6909cd223` | CR-SETTING-CALLERS-2440 (conflict 1) | `4b2d5bfc9` |
| 17 | `ed1873072` | CR-SETTINGS-PATCH-A-2440 | `15cd06fe0` |
| 18 | `b69726b17` | CR-SETTINGS-PATCH-B-2440 (stacked on 17) | `c4a3fafcf` |
| 19 | `8849c6b1e` | CR-HEALTH-POLLERS-2440 | `f44438900` |
| 20 | `dc2074921` | CR-LIVE-SOCKET-CAPS-2440 | `72fb02630` |
| 21 | `628d99583` | CR-SENDER-WORKER-2440 | `7b9dd27fd` |
| 22 | `672946014` | CR-PDF-CHILD-2440 | `768ce9151` |
| 23 | `25cb57379` | CR-EXPORTS-HOUSEKEEPING-2440 | `f8c9c59de` |
| 24 | `2e04995bb` | CR-INTERCOM-SHARED-2440 | `a60551eec` |
| 25 | `a5caacd64` | CR-PERSON-PROJECTION-2440 | `e29b392f3` |
| 26 | `c62dc39a9` | CR-READCONN-B-2440 | `64fb5d33a` |
| 27 | `7ffed5b29` | CR-DOCS-REGISTERS-2440 | `06ceb9816` |
| 28 | `d10d4a73f` | CR-TEST-SUPPORT-2440 (last; conflict 2) | `904da9960` |

**Dropped: none.** All 28 listed branches are in.

## Conflicts (2 textual; 26 merges were clean)

1. **`routers/access_control.py`** - SETTING-CALLERS (16) against the split (6). SETTING-CALLERS changed one line of
   `camera_snapshot` (`read_settings(conn)["snapshots.max_age_s"]` -> `setting_value(conn, "snapshots.max_age_s")`) and the
   import that serves it; CR-SPLIT-ACCESS-CONTROL had moved that function to `routers/access_control_stills.py`. Resolved by
   the brief's rule: the split wins the file layout (the re-export module is exactly as the split left it) and the hunk is
   applied in `access_control_stills.py` (the call and the import). Nothing else in the parts read `read_settings`.
2. **`services/storage.py`** (import block) - TEST-SUPPORT (28) against SETTING-CALLERS (16). One side replaced the
   `read_settings` import by `setting_value`, the other added `from ..test_reset import register_reset` on the next line. Both
   kept: `setting_value` and `register_reset`; `read_settings` is no longer imported (nothing in the module reads it).

## Merge interactions fixed in `fix(merge)` (no textual conflict, found by the checks)

One product edit (item 3, three one-line `del`); everything else is in test files and test lists.

1. **`tests/singletons_unregistered.txt`** (TEST-SUPPORT's list, recorded on `97080bbc4`):
   `smplwise.routers.access_control.RELAYS` -> `smplwise.routers.access_control_command.RELAYS` (the split moved the object;
   the old module only re-exports it). Still 116 names.
2. **`tests/test_singletons_registered.py`, the stale rule.** Two things made "listed but not found" wrong as a definition of
   stale: (a) after CR-HEALTH-POLLERS the three health pollers are instances of the shared `PeriodicWorker`, and the walk
   counts only objects whose class is defined in the module that binds them, so their three lines were reported stale
   although the singletons exist and have no registered reset; (b) the answer depended on the test order - start-up replaces
   `tickets.external.DISPATCH` by the outbox dispatcher (a class of another module), so the file passed alone and failed on
   that line when any test had built an application earlier in the process (it would have been red or flaky in a full
   run; this one is TEST-SUPPORT's own, not a merge interaction). An entry is now stale when it is registered or when the
   NAME is gone from its module; a name still bound to an object the walk does not count stays listed. The three poller
   lines stay on the list. **For the lead / closing chain:** a singleton of a shared class is invisible to the "missing"
   half of this test (a NEW `PeriodicWorker` instance would not be asked to register a reset).
3. **The leaked loop name `_part`** in the three re-export modules of the splits (`routers/access.py`,
   `routers/access_control.py`, `routers/tickets_admin.py`): `for _part in PARTS: router.include_router(_part)` left `_part`
   bound to the LAST part's router. Harmless inside each split branch, but once CR-READCONN-B's
   `tests/get_write_allowlist_rest.txt` exists, `test_get_routes_read_conn.py` walks every router module in name order,
   meets that router first under the re-export module (where none of its endpoints belong) and then skips it as "seen" in
   the part itself: the GET routes of `access_custom_roles`, `access_control_ws` and `tickets_admin_locations` dropped out of
   the inventory (`test_allowlist_is_well_formed_and_access_modules_exist` failed on `access_custom_roles`). Fixed at the
   source: `del _part` after each loop (one line per module; the routers, their order and every re-export are unchanged).
4. **`tests/gate_always_run.json`**: three new package scanners were not on the list (`test_gate_always_run.py` fails on that):
   `test_exports_housekeeping_2440.py`, `test_routers_table_2440.py`, `test_setting_callers_2440.py` added under `backend`
   (the union rule; TEST-SUPPORT's own line and the base's line merged by themselves). 49 -> 52 entries.
5. **`tests/test_routers_table_2440.py`** (MAIN-ROUTERS-TABLE against the three splits): "every API router is mounted exactly
   once" reported the 18 part routers as not mounted by the table. They are mounted through their re-export module, like the
   four nested installer routers the test already knew. New `SPLIT_PARTS` (parent -> parts): the parts are expected unmounted,
   the parent must be in the table, and the parent's `PARTS` must be exactly those routers in that order.
6. **`tests/test_no_ip_literals.py`** (repository walk) failed on invented private-range addresses in two NEW test files of
   the batch: `test_redact_table.py` (two values) and `test_intercom_shared_2440.py` (one). Replaced by RFC 5737 shapes
   (`192.0.2.x`), as the lint asks; the assertions do not depend on the address. Nothing was added to the allow-list.
7. **`tests/test_get_routes_read_conn.py`** - READCONN-B's `get_write_allowlist_rest.txt` widens this file from the access
   routers to EVERY router, and READCONN-B ran only the two inventory tests (its note lists the parametrised behaviour test
   as NOT_RUN). On the combined branch the behaviour test had four kinds of failure; none is a product regression of this
   batch (every route below was on the read connection before it):
   - **the connection label** (interaction with CR-BRIDGE-PREVERIFY, `auth.conn_label`, review 05:P3-08): a parametrised route
     is now labelled with its TEMPLATE, the test looked for `GET <concrete url>`, so every route with a path parameter failed
     with "the request opened no labelled request connection". The test accepts the template (its own key) or the concrete
     path.
   - **the key of a prefixed router**: `value.prefix + r.path` doubled the prefix of `routers/system_update.py` (the only
     prefixed router; `r.path` already carries it). Now `API + r.path`. No allow-list line names such a route.
   - **routes with no request connection** (38: the public brand / notice-board / calendar-feed / app-token routes and the
     presence routes, which open a short labelled connection of their own or none): the behaviour check is about the request's
     READ connection, so `_CONVERTED` is now the non-allow-listed GET routes whose dependency tree reaches
     `auth.get_read_conn` (714 routes). The inventory test still walks all of them.
   - **read routes that write one row aside** and therefore cannot answer while another connection holds the write lock - the
     class READCONN-A already exempted for two routes (`AUDITS_ON_SUCCESS`: checked without a held lock, still no write
     connection of their own). Eight more, all pre-existing: a success audit row - `GET /access-grants/export.csv`,
     `/access-control/diag/stations/{station_id}/permission-audit`, `/fleet/report/enrollment` (added to `AUDITS_ON_SUCCESS`);
     and, in a new `WRITES_ASIDE_HERE`, the routes that write in THIS fixture: a refusal's audit row -
     `/access-control/people/{person_id}/messages`, `/compliance/access/matrix`, `/compliance/access/matrix.csv`,
     `/frigate/{recorder_id}/cameras/{camera_id}/ptz` - and the lazy key pair of `/push/vapid-key`.

   **For the lead:** (a) READCONN-B's note asks for ONE decision on success-audit GETs (write connection, or read + aside);
   the three routes above join that list. (b) Outside this test's subject but seen by the sweep: `GET /presence/config` and
   `GET /presence/people` (own labelled read connection) answer 500 `database_busy` while the write lock is held - something
   on their path waits for the write lock in the empty fixture; not investigated and not touched here.

## For the lead (carried over from the source notes; nothing decided here)

- **CR-BRIDGE-COMMON-2440**: a bridge version bump is needed and is NOT in that branch nor here (its note, first section).
- **CR-BRIDGE-STRUCT-2440**: not implemented - the row's premise does not hold; lead decision needed (its note).
- **CR-SPLIT-ACCESS-2440**: the OpenAPI document is identical except ONE component name (its note, "identical except").
- **CR-TK-SQL-2440**: three narrowed `except` shims can surface a hidden error (its note, "Shims").
- **CR-SCHEMA-PROBES-2440**: lead decision L3 not done. **CR-SENDER-WORKER-2440**: L7 answered in its note.
- **CR-LIVE-SOCKET-CAPS-2440**: `GET /media/streams` returns only the go2rtc version (L9) - a deliberate behaviour change.

## Tests actually run (workstation, Python 3.12 from the main checkout's venv, `pytest -p no:xdist`, one process)

One process at a time where possible; the workstation was shared with other agents (CPU 25-90 %).

| Run | What | Result |
|---|---|---|
| A | 31 files: the always-run scanners most exposed to the merges and the files of the two conflicts - `test_gate_always_run`, `test_local_auth_inventory`, `test_tickets_naming`, `test_setting_callers_2440`, `test_schema_probes_2440`, `test_routers_table_2440`, `test_redact_table`, `test_be_twins_2440`, `test_be_small_unify_2440`, `test_settings_patch_audit_order`, `test_storage`, `test_storage_warm`, `test_exports_housekeeping_2440`, `test_plan_routes_unique`, `test_async_routes_no_inline_db`, `test_async_routes_hold_no_write_conn`, `test_raw_body_order`, `test_body_limit`, `test_db_gate`, `test_db_template`, `test_t06_admission_295`, `test_fake_doorwin_closed_rule_sr1`, `test_wiskey_door_gate`, `test_wiskey_door_path`, `test_wkpeer_295`, `test_capture_lease_ledger`, `test_core_helpers_2438`, `test_bridge_common_2440`, `test_bridge_preverify_2440`, `test_no_ip_literals`, `test_singletons_registered` | **1053 passed, 3 failed, 1 skipped, 3 xfailed** - the 3 failures are items 2, 5 and 6 above (this run was before those fixes) |
| B | after the fixes: `test_body_limit` (builds applications first), `test_routers_table_2440`, `test_redact_table`, `test_intercom_shared_2440`, `test_no_ip_literals`, `test_gate_always_run`, `test_singletons_registered` | 148 passed, 1 failed (a third address in `test_redact_table.py`); after that fix `test_redact_table` + `test_no_ip_literals`: **97 passed, 0 failed** |
| C | `test_get_routes_read_conn.py`, final version: the two inventory tests and 20 behaviour cases (the eight exempted routes, the prefixed router, parts of the three splits, the snapshot route of conflict 1) | **22 passed, 0 failed** |
| D | a sweep, not a test file (a scratch script, not committed): ONE application, all 714 routes of the behaviour test asked in turn under a held write lock, with the final exemptions | 0 routes fail (before the test changes: 46 of 752) |
| E | conflict 1: `test_intercom.py -k "snapshot or still"` | 7 passed |
| F | new unit files of the batch: `test_tickets_fields`, `test_tickets_sql_helpers`, `test_tickets_outbox_filter`, `test_tickets_except_log`, `test_person_projection_parity_2440` | 236 passed, 0 failed |
| G | `test_delayed_worker_2440`, `test_health_pollers_2440`, `test_pdf_child_2440` | 50 passed |
| H | `test_intercom_shared_2440`, `test_live_socket_caps_2440` (before the address change of item 6; `test_intercom_shared_2440` again in run B) | 17 passed |

Also: `python -m compileall` over `smplwise/`, `smplwise_vms/integration/` and `custom_components/`: clean; `import smplwise.main`: ok.
An earlier run of `test_get_routes_read_conn.py` (before any fix) was stopped by `--maxfail=30`; it is what showed items 3 and 7.

## NOT_RUN

- **`test_get_routes_read_conn.py` in full** (716 cases, one fresh application each, more than an hour here): only run C and
  the sweep D. The sweep shares one application between the routes, the real test does not - the runner is the proof.
- The full backend suite, the whole `test_tickets_*` set, the upgrade set, the API tests of the routers READCONN-B and
  SETTING-CALLERS converted, the three-green-runs rule of CR-SENDER-WORKER: left to the entry check (and to the source notes).
- `ruff`: not installed in the workstation venv.
- Frontend (`tsc`, unit, pixels): nothing of it is touched; not run.
- No lab, device or Home Assistant check of any kind.

## Pixels expected to change

None. No frontend file, no baseline and no evidence image is touched by any of the 28 branches or by the fix commit.

## Entry check 1 (`d4e316691`, RED) - main 2.43.7 merged, fixes (17.11.2026)

Runner verdict `~/smplwise-results/entry_pilot-CR-W3-BE-COMBINED-2441_d4e316691.md`: 6 backend tests "failed twice", one frontend
unit spec (3 projects) and one "expired quarantine" line. No guard was loosened and nothing was quarantined.

### Merge of `origin/main` v2.43.7 (`cc69447f1`) - merge commit `a75af20b6`

- `routers/settings.py`: main still defines the two PATCH words (`ALLOW_DISARM_WORD`, `LOCAL_PURGE_WORD`) in the router;
  CR-SETTINGS-PATCH-B moved them to `settings_patch/identity.py` and re-exports them. The split layout kept (same values).
- `tests/test_async_routes_no_inline_db.py`: `PENDING` empty on both sides; main's comment kept.
- `smplwise_vms/www`, `www-public`: main's 2.43.7 build taken as is, minus its 282 debug source maps, and the 282
  `sourceMappingURL` comments stripped with `frontend/scripts/sourcemaps-archive.mjs` (CR-BUILD-GUARDS-2438, the rule the
  2.43.6 merge of CR-WAVE2-COMBINED-2439 followed). The file list equals main's minus the maps.
- Backend content main brought: the version (2.43.7) and `services/home_interface.py` (+ its test). Design ratchet after the
  merge: no count above the baseline.

### Failures, causes, fixes

1. `test_maintenance_215::test_a_tag_keeps_its_medium_and_the_time_of_the_last_scan_only` - **a product regression of
   CR-READCONN-B-2440**, fixed in the code. It moved `GET /maintenance/scan/{token}` to the read connection; `service.scan`
   stamps `maint_tags.last_scan_at` and skips the stamp silently on a read-only connection (`_read_only`), so the tags list
   never showed a scan. The route is back on `current_principal` + `get_conn` and listed in
   `tests/get_write_allowlist_rest.txt` ("the handler changes rows of its own"). The test is unchanged.
2. `test_capmap_295::test_the_receiver_source_is_the_one_the_vectors_were_made_from` - three intended source changes of the
   batch, each read against the vectors' path and recorded as a `REVIEWED_SUCCESSORS` entry (old -> new hash, reason), the
   mechanism the test provides; WisKey's vectors file stays byte-identical:
   - `services/ha_bridge.py` (CR-BRIDGE-PREVERIFY-2440): keyword-only `nonces` / `screen_only`, defaults take the old path;
   - `custom_components/smplwise_bridge/keyset.py` and `lease_contract.py` (CR-BRIDGE-COMMON-2440): `canonical` /
     `_canonical` are the one `_common.canonical` (same one-line body) instead of local copies.
   The runner showed only the first; the other two would have failed next (the loop stops at the first drift).
3. `test_wk4adopt_295::test_w005_the_arx_receiver_chain_is_the_one_mac_mapped_against` - the same `lease_contract.py`
   change. This pin had no successor mechanism; it now has `MAC_REVIEWED_SUCCESSORS` in the shape and rule of
   `test_capmap_295.REVIEWED_SUCCESSORS` (one entry, with the reason). Any further edit of a pinned file fails again.
   **For the lead:** the pinned hashes are what WisKey (Mac) mapped against; if WisKey must be told that
   `lease_contract.py` changed textually (not behaviourally), that message is not sent by this branch.
4. `test_nvr_stream_batch_review_fixes::test_status_list_and_stop_use_a_read_connection_and_never_recover` - stale test.
   The stop route IS on a read connection (the failure text shows `('read', 'POST /api/v1/nvr/stream-batches/{batch_id}/stop')`);
   since CR-BRIDGE-PREVERIFY-2440 (`auth.conn_label`, 05:P3-08) a route with a path parameter is labelled with its template,
   and the test looked for the concrete URL. The test accepts both labels (as `test_get_routes_read_conn.py` does).
5. `test_provision_playback::test_rtsp_download_redacts_secrets_from_ffmpeg_errors` and
   `::test_rtsp_download_cancel_kills_ffmpeg_and_removes_the_file` - stale test fakes. CR-EXPORTS-HOUSEKEEPING-2440 (03:F08)
   drains ffmpeg's stderr pipe while it runs and reaps with `wait()` instead of `communicate()`; the two fake `Proc` classes
   had neither. They now carry `stderr` (a `BytesIO`, with the same error text in the redaction test) and `wait()`. The
   assertions are unchanged (the redaction test still proves no URL, user, password or host leaves).
6. `frontend/tests/unit-tickets-1440-column-setting-2360.spec.ts:127` - stale path. CR-SPLIT-TICKETS-ADMIN-2440 moved the
   settings PATCH body (`table_mid_width: Literal["sentence", "department"] | None = None`) from `routers/tickets_admin.py`
   to its part `routers/tickets_admin_settings.py`; the spec reads the part. The line itself is unchanged.
7. "expired quarantine: [mobile] pixel CR-036 S12 (FLAKY-S12-PIXEL-2412)" - **not in this branch.**
   `scripts/gate/gate2_quarantine.json` here has `"entries": []` (main's removal `a7d7dde5c` was already contained in
   `d4e316691`). The entry check reads the RUNNER's own copy, `~/gate2/gate2_quarantine.json` (dated 11.11 19:14, before the
   removal), which still holds the entry. Read only; not touched (the runner's gate files are the lead's). **For the lead:**
   refresh that copy, otherwise every entry-check report keeps listing the line.

### Tests actually run (workstation, `.venv` of the main checkout, `pytest -p no:xdist`)

- `test_provision_playback`, `test_nvr_stream_batch_review_fixes`, `test_capmap_295`, `test_wk4adopt_295`,
  `test_maintenance_215`, `test_async_routes_no_inline_db` (the six failing tests' files in full, one process):
  **225 passed, 0 failed**.
- `test_get_routes_read_conn.py -k "allowlist or inventory or maintenance"` (the allow-list with the new line, the inventory
  and the maintenance routes' behaviour cases): **20 passed, 0 failed**.
- `scripts/design_ratchet.py`: no count above the baseline. `scripts/sync_integration.py --check`: mirror up to date.
  `scripts/release_check.py`: ready (2.43.7; no `.map` and no `sourceMappingURL` in the add-on).

### NOT_RUN

- `unit-tickets-1440-column-setting-2360.spec.ts` (this worktree has no `node_modules` junction and no preview build): the
  expected line was checked with grep in `routers/tickets_admin_settings.py`; the runner is the proof.
- `tsc`, the full backend suite, `test_get_routes_read_conn.py` in full, Playwright, pixels: the entry check.
- No lab, device or Home Assistant check.

