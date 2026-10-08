# CR-021 S3/S4 - running status (branch `pilot/CR021-s3-apply`, from `origin/main` 31fe5d7c)

Kept current after every step so another session can continue.

## Key finding (2026-10-08): the task premise was stale

The task card asked to rebase S1 + S2 onto main (renumbering migration 0050 to 0073) and to build S3. **All three slices are already
on `main` and released since 0.1.159** (merge `5e4370bf` "Merge origin/pilot/CR021-s3-merged into integ/0159"):

| Slice | On main as | Evidence |
|---|---|---|
| S1 backend (check, interval, `system.update`) | `a4afe28f`, migration **0051_self_update.sql** (renumbered from 0050 at the time, `e81fb33b`) | `tests/test_self_update.py` |
| S2 UI (menu marker, Settings tab "עדכונים") | `bd326c79` | `frontend/tests/evidence-system-update.spec.ts` |
| S3 backend (apply, platform restart, state machine, fake Supervisor) | `1230f31f` + review fixes `5a086664` | `tests/test_self_update_s3.py`, `tests/test_self_update_s3_fixes.py`, `frontend/tests/fixtures/update_fake_supervisor.py` |
| S3 UI (apply dialog, run status, restarts card, restart-required row + menu dot) | `210e5725` .. `1c8d15a0` | `evidence-system-update-apply.spec.ts`, `evidence-system-update-fixture.spec.ts`, `layout-update-screens.spec.ts`, `docs/design/evidence/cr021-s3/*.png` (19 states x 3 widths) |
| Manifest `hassio_role: manager` | `smplwise_vms/config.yaml` (ships since 0.1.159, owner answer S3-2) | DOCS.md "What Arx may do on your system" |

Therefore: **no rebase, no new migration (0073 NOT used), no second copy of S1/S2/S3.** `pilot/CR021-s12-rebased` (60452c02) is an
ancestor of main; a backup copy was pushed anyway as `origin/pilot/CR021-s12-rebased-backup`.

## Done / not done

| Item | State | Notes |
|---|---|---|
| Backup branch `pilot/CR021-s12-rebased-backup` on origin | DONE | |
| S1/S2/S3 on main | ALREADY DONE (0.1.159) | see table above |
| `[platform-restart]` marker -> "restart required" reason (S4) | DONE | `services/release_notes.py`, `Dockerfile` copies CHANGELOG, `main.py` start hook (off in tests: `SW_RELEASE_MARKER=0`), `tests/test_release_notes_marker.py` |
| Downgrade guard (security, S4) | DONE | `self_update.is_newer` in `parse_info`; `tests/test_self_update_s4_downgrade.py`; test NEWER -> 99.0.0, fixture spec 0.1.157 -> 99.0.0 (both were BELOW the running 2.4.2, i.e. the suites exercised a downgrade) |
| `docs/security/CR021_SELF_UPDATE_SECURITY_NOTES.md` | DONE | threat model, role `manager`, O9 branch protection, review checklist |
| User guide page | DONE | `docs/user-guide/he/83-updates_HE.md`, index row, `GUIDE_ALL_HE.html` rebuilt |
| `docs/release/NEXT-DRAFT.md` bilingual draft | DONE | |
| CR-021 doc section 14 (S4) | DONE | |
| Release-notes text of the NEWER version on the Updates page | NOT DONE - needs decision | only the Supervisor has it; conflicts with "no upstream text echoed or stored"; unverified lab assumption |
| Feature OFF by default behind an admin switch | NOT DONE - owner question | ships ON for `system.update` holders since 0.1.159 by owner approval (D1, S3 answer 2); turning it off would silently remove a working function after an upgrade |
| New Playwright evidence PNGs | NOT DONE - not needed | 19 states x 3 widths exist in `docs/design/evidence/cr021-s3/`; "rolled back" is guidance only (no restore button, owner answer 10) and is covered by the guidance screens |
| Owner release gate 13.4 (branch protection O9, lab session 13.5) | OWNER | agents never change repository settings |

## Tests

Runner (Ubuntu), 2026-10-08:

- Backend @ 4905d15d: `test_release_notes_marker`, `test_self_update_s4_downgrade`, `test_self_update`, `test_self_update_s3`,
  `test_self_update_s3_fixes`, `test_nvr_connection`, `test_notify_sources` - **221 passed**.
- Playwright @ a901c2e8: `evidence-system-update-fixture.spec.ts` (real fixture backend + fake Supervisor, `SW_UPDATE_FIXTURE_PY`,
  `run_remote.sh preview`) - **18 passed** (desktop / tablet / mobile). Note: `run_smart.py spec` skips this spec (no
  `SW_UPDATE_FIXTURE_PY`) and `run_smart.py fixture` refuses it (not in `fixture_specs.json`); a small ssh wrapper set the variable.
- NOT_RUN: full backend suite, full Playwright, `tsc` (no TypeScript change), the mocked evidence specs
  (`evidence-system-update*.spec.ts` other than the fixture one - unaffected, no UI change), release_check.

## Next step

Release engineer: merge `pilot/CR021-s3-apply` into the next integration branch; tier S/M (backend CR-021 tests + the update fixture
spec). Owner: confirm GitHub 2FA + protection of `main` / `v*` tags; answer the two open questions above.
