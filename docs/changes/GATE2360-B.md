# GATE2360-B - release gate of 2.36.0: the non-builder failures

Branch `fix/GATE2360-B` from `origin/release/2360-train` @ `eb9525d9b`. Not merged into the train (the lead merges A + B).
**Tests only - no `frontend/src` change, no product code change, no UI rebuild needed.** No version bump, no API, data or
settings change. Gate report: `gate_release-2360-train_eb9525d9b` (FAIL: 154 test failures; 150 evidence-automations-builder
are GATE2360-A's). This branch covers the other groups: 4 "failed again alone" and 12 "flaky" entries.

History check (older `gate_release-*.gate2.md` on the runner): every group below had already been red in earlier gates
(media-admin-list 2.33.1 / 2.33.3 / 2.34.2; tickets-delete :108 2.33.2; tickets-device 2.35.0; pixel-access-s12 2.33.0 -
2.35.0 on mobile; messaging_accounts_runtime 2.35.0 twice; energy_bill_pdf_pipeline 2.33.3). None is a regression of the
2.36.0 product changes; one is a stale expectation, the rest are tests that read before the thing they read was there or
raced a timer of their own harness.

## 1. Root causes and fixes

| Group | Class | Root cause | Fix |
|---|---|---|---|
| `test_messaging_accounts_runtime::test_another_module_registers_a_use_and_a_shared_account_warns` (failed twice) | **stale spec** | CAL-ATTENDEES-2343 (2.35.0) registers the messaging module `calendar` ("יומנים") when `create_app` imports `routers/calendar_attendees`. `test_messaging_accounts_api` was updated then; this file was not and passed only when no app-building test ran earlier in the process. | Expected modules include `calendar`; `messaging_registry_isolation.IMPORTED_FIRST` imports `services.calendar.attendee_notices` (an eager module, like identity / access / notifications), so the registry is the same in every order. Intended change named: CAL-ATTENDEES-2343. |
| `test_nvr_encoding_batch::test_preview_refuses_bad_settings_and_unknown_cameras_with_zero_device_reads` | flaky / harness | `ready()` waits for the camera rows, but the same start-up discovery task then runs the recording-derived events (`POST /ISAPI/ContentMgmt/search` per camera) and starts the storage warm-up thread (`GET /ISAPI/ContentMgmt/Storage`, tracks, searches). On the loaded gate machine those reads landed inside the test's "zero device reads" window (4 searches + the storage read). | `nvr_batch_helpers.quiet_startup_reads(builds_before)` waits for the storage warm-up build that ends that chain (counter read before the app starts); the `ew` fixture calls it after `quiet_alert_stream()`. The assertion is unchanged. |
| `test_notice_caps_295::test_caps_change_at_runtime_without_a_restart` | flaky / harness | The test server's handler timeout was 5 s; the held (unfinished) requests are what keeps the slots taken, so on a slow run one held connection timed out mid-test, freed its slot and `_total` read 2 instead of 3. | Hang guard 60 s (the held sockets are closed by `_stop` in `finally`). Assertions unchanged. |
| `test_energy_bill_pdf_pipeline::test_bill_pdf_end_to_end_with_the_real_renderer` | flaky / harness | The copy render crossed the `auto` engine's 5 s slow-render rule (log: "WeasyPrint exceeded 5 s; rendering again with the simple engine"), so the copy came from fpdf2, whose rotated watermark pdftotext does not read back as "העתק". | Same budget as `test_bill_pdf` / `test_energy_tou_billing` (`SW_BILL_PDF_FALLBACK_S=60`, `SW_BILL_PDF_TIMEOUT_S=90`): the test is about WeasyPrint's output; the fallback keeps its own tests. |
| `test_f3a_doorwin_dw03_295::test_four_hung_doors_do_not_hold_back_the_other_four` | flaky / timing | The "not behind the hung four" property was checked as "all eight first calls within 0.5 s"; on the loaded machine the eight claim writes before the sends alone spread over 1.26 s with every door on its own worker. | The structural property instead: a wrapper of `door_emergency._claim` records the dispatcher worker of each door, and no worker that sent a hung door may send one of doors 5-8. Verified that it bites: with `LANE_MAX=4` (doors queued behind the hung ones) the new check fails. |
| `evidence-media-admin-list` :73 / :118 (failed alone, all projects) | stale spec since 2.34.2 | The route screens are lazy chunks since PERF-HOME-DEVICES-2342; the spec counted rows (`count()`, `allInnerTexts()` do not wait) before the players list was drawn (0 rows / `[]`), and read again right after clicks that start a redraw. | Cherry-picked GATE2360-A `960e1da73` (harness waits for `data-shell-ready`, the first count polls) + here: after the chip click wait for the toolbar's "n מתוך total"; poll the availability count, the reversed names after the sort direction, and the group heads after "לפי אינטגרציה". |
| `evidence-tickets-delete` :108 (failed alone) | flaky / harness | The table drew 8 rows and then 11 (early load before the address filters / saved board settled); `before` was 8 and the range selection could land on a redrawn list (retry: the count typed did not match, "מחיקה" stayed disabled). | From `960e1da73`: count and select only once the row count held still. |
| `evidence-tickets-device` :250 | flaky / harness | `test-results/` is the output folder of every Playwright run in the checkout; a parallel run of the gate pool emptied it mid-test (ENOENT on the evidence copy). | From `960e1da73`: re-create the copy folder before each write. |
| `layout-noscroll-297` :89 wall-demo / electricity-meters @1440 (dev) | flaky / environment | On the Vite dev server shared by four workers, one page load never booted: `<sw-app>` stayed an empty undefined element for the whole 240 s (455 polls). Both green on the retry and at 1920. | The shell gets 60 s to boot; a load that did not boot is reloaded once and recorded as a `dev-boot-reload` annotation, so a real boot failure still fails and a repeated stall stays visible. Measurement unchanged. |
| `pixel-access-s12` :49 / :61 [mobile] | flaky (see section 3) | see section 3 | see section 3 |

## 2. Commits

| SHA | What |
|---|---|
| `11e1a96fa` | backend: the five tests above (stale calendar module; NVR start-up reads; caps handler timeout; bill PDF budget; DW-03 structural check) |
| `dc71c75bb` | cherry-pick of GATE2360-A `960e1da73` (media harness `data-shell-ready` + first-count poll; tickets-delete row count settles; tickets-device re-creates its copy folder) |
| `e0aa696ae`, `cc8e5fbcb` | media-admin-list: wait for each redraw after a click before reading |
| `326ddc753` | layout-noscroll-297: bounded boot wait, one named reload |

## 3. pixel-access-s12 (mobile)

Not changed. The gate failure is an unstable element screenshot, not a moved baseline: the display card measured 949 px
(the committed baseline) and 963 px on consecutive captures of the same run (+14 px, one muted text line), and the
operator parity card drifted likewise; the mobile retry passed. On the free runner it did not reproduce: 40/40 with
`--repeat-each=4` (desktop + mobile, every skin case and the operator test), so no baseline was re-taken (nothing shipped in
2.36.0 explains a change; re-taking would only freeze one of the two states). It has been red on mobile in 2.33.0, 2.33.1,
2.34.2 and 2.35.0 too - only under the gate's load. Suggested for the owner's quarantine rule (ticket + expiry) if it recurs
in the `--after` run; the next step for a root cause is to capture both images under load (which line wraps / which face
is used) - likely the Heebo subset race `settlePage` already nudges, inside one of the card's muted `.lbl` texts.

## 4. Runner results

All on the runner (`run_smart.py`, branch `fix/GATE2360-B`), preview = the built UI of the branch:

| Run | Result |
|---|---|
| preview `evidence-media-admin-list` + `evidence-tickets-delete` + `evidence-tickets-device`, desktop/tablet/mobile, @ `e0aa696ae` | 40 passed, 3 failed (my own regex escape in the new wait, fixed in `cc8e5fbcb`) |
| preview `evidence-media-admin-list` `--repeat-each=2`, 3 projects, @ `cc8e5fbcb` | **54/54 passed** |
| dev `layout-noscroll-297` desktop, `wall-demo` + `electricity-meters` at 1440 | **2/2 passed** (no `dev-boot-reload` needed) |
| preview `pixel-access-s12` desktop + mobile `--repeat-each=4` | **40/40 passed** |
| backend: messaging_accounts_runtime / _api, wa_policy_295, nvr_encoding_batch, notice_caps_295, f3a_doorwin_dw03_295, energy_bill_pdf_pipeline | **85 passed, 1 skipped** (the skip: `test_render_stack_is_present_where_it_is_required`, only the add-on image check sets SW_REQUIRE_BILL_PDF; the end-to-end PDF test ran and passed) |

Locally: `tsc --noEmit` clean; the same backend files 47 passed on Windows; DW-03 check verified to fail with `LANE_MAX=4`.
NOT_RUN: the gate's `--after` re-run (the lead runs it after merging A + B); the full noscroll matrix (only the two red cases).
