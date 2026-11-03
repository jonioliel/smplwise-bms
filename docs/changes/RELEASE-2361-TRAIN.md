# RELEASE-2361-TRAIN: assembly of the 2.36.1 release train

Branch `release/2361-train`, cut from `origin/release/2360-train` (44b8383c2, then brought up to eb9525d9b, the 2.36.0 rebuilt UI).
Content: release 2.36.1 = 2.36.0 + `pilot/CAM-H264-VERIFY-2361` (camera H.264 verification after a bulk encoding apply / undo, a
per-channel report, the refusal setting "skip and continue" by default; `docs/changes/CAM-H264-VERIFY-2361.md`). No version bump, no
changelog entry, no runner gate and no tag yet: the 2.36.1 version commit comes at release time.

## Owner decision recorded (2026-11-02, "2B")

The undo of an encoding batch follows the same skip / stop setting (`nvr.batch_on_refusal`), as built; kept. Recorded in
`CAM-H264-VERIFY-2361.md` (open point 3 answered).

## Merged

| # | Branch | Tip | Merge commit |
|---|---|---|---|
| 1 | `pilot/CAM-H264-VERIFY-2361` (cut from `release/2342-train` at b75d214da) | 2cbaa62d4 | 5dfa306b9 |
| 2 | `origin/release/2360-train` (final pick-up, 2.36.0 rebuilt UI) | eb9525d9b | c9015c379 |

The pilot was cut from the 2.34.2 train, so merging it onto the 2.36.0 train re-offers already released 2.34.2 content; only the
pilot's own files were kept (see below).

## Conflicts and how they were resolved

- `contracts/API_INVENTORY.md` (generated): header line only; regenerated with `scripts/api_inventory.py` on the assembled tree
  (1711 routes, adding `POST /nvr/stream-batches/{batch_id}/verify`).
- `frontend/tests/evidence-calendars-settings-2310.spec.ts` (1): one comment line; superseded by the 2.34.2 content already on the
  2.36.0 train (the tree equals `origin/release/2360-train` there).
- Version files (`config.yaml`, `Dockerfile`, `__init__.py`, `CHANGELOG.md`): the pilot carried 2.34.2; the train side (2.36.0) kept.
- `smplwise_vms/www` (built UI): train side taken in both merges; the bundle is NOT rebuilt here, so it does not contain the
  CAM-H264-VERIFY UI. `npm run build:addon` runs at release time (as for 2.36.0).
- 103 linux pixel baselines the pilot's base had re-taken (GATE2342-PIXEL): train side taken (2.36.0 re-took its own).
- Result: `git diff origin/release/2360-train` is exactly the 24 files of CAM-H264-VERIFY-2361, its new report spec and mock hooks, the
  change documents and the regenerated API inventory.

## Added on the train (test code only)

`frontend/tests/evidence-nvr-verify-report-2361.spec.ts` (new, 4 tests, mocked API) and optional hooks in
`frontend/tests/nvr-batch-mock.ts` (`bm.onRefusal`, `bm.recheck`, per-batch `extra` fields, per-item `verify` / `skipped`, the
re-check route; nothing existing changes behaviour). It covers what no spec covered: the preview's skip / stop row and what the
confirmation and the start carry, the report dialog (summary, tabs, chip and line per stream, the skipped tab), the read-only
re-check and its refusal line. NOT_RUN (written against the sources, type-checked by `tsc`; the lead runs it on the runner).

## Checks (workstation, final tree c9015c379 plus this document)

| Check | Result |
|---|---|
| `tsc --noEmit` (src + tests) | exit 0 |
| unit specs `tests/unit-` `--workers=1` (`playwright.unit.config.ts`) | 3680 passed, 1 skipped, 0 failed (12.8 min) |
| backend pytest, single process: `test_cam_h264_verify_2361`, `test_live_h265`, `test_nvr_encoding_batch`, `test_nvr_encoding_plan`, `test_nvr_h264_bulk_2341`, `test_nvr_stream_batch` (+ `_rbac`, `_recovery`, `_review_fixes`), `test_nvr_stream_write`, `test_nvr_stream_rollback`, `test_nvr_stream_review_fixes`, `test_provision_encoding_write`, `test_media`, `test_ui_settings` | 347 passed, 0 failed |
| `scripts/release_check.py` | 18 ok, 1 expected FAIL (tag v2.36.0 not created yet); "ready for the owner's approval" |

(An earlier run on the tree before the final 2.36.0 pick-up gave the same results: 3664 unit passed 1 skipped, 347 pytest passed.)

## Browser specs for the runner (NOT_RUN here)

The gate selection (`scripts/gate/gate2_select.py select --base origin/release/2360-train`) is broad because `nvr-batch-mock.ts`,
`system-diagnostics.ts` and `system-security-cameras.ts` are mapped to many screens (413 frontend specs, 6 of 14 pixel specs). The
specs that matter for this change, in priority order:

1. NEW, no run yet: `evidence-nvr-verify-report-2361.spec.ts` (report dialog + skip/stop row, all three projects).
2. NVR encoding screens (touched code): `evidence-nvr-encoding-batch`, `layout-nvr-encoding-batch`, `pixel-nvr-encoding-batch`,
   `evidence-nvr-h264-bulk`, `evidence-nvr-cameras-batch`, `layout-nvr-cameras-batch`, `evidence-nvr-provision-encoding`; the pilot's own
   runner run (7be140fb3, 102 passed, 6 skipped) predates the mock hooks and the 2.36.0 pick-up, so re-run them. The pixel baselines
   stay valid unless the preview mock answers `on_refusal` (it does not by default).
3. Settings › וידאו ומדיה (new row `data-set-batch-refusal`): no spec asserts the row itself; the specs that open this tab are
   `evidence-system-multimedia`, `evidence-webrtc-only`, `evidence-webrtc-first`, `evidence-timeline-colors`, `evidence-security-r1`,
   `evidence-video`, `evidence-video-conn-test`, `evidence-wxmedset` (+ `layout-settings-nav-*` and the diagnostics pixel baselines
   `settings-diagnostics-ready-*`, which may need a refresh on the runner because of the extra row).
4. Not covered by any spec yet: the "דוחות בדיקה קודמים" list view and the settings row's save round trip (the backend settings test
   covers the key; add a settings-tab spec if the gate wants UI coverage of the row).
