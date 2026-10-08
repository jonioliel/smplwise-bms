# CR-021 S3/S4 - running status (branch `pilot/CR021-s3-apply`, from `origin/main` 31fe5d7c)

Kept current after every step so another session can continue. Newest first in "Log".

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

What is genuinely left is slice **S4** (CR-021 section 10 / 13.6) plus the documents the card asked for.

## Done / not done

| Item | State | Notes |
|---|---|---|
| Backup branch `pilot/CR021-s12-rebased-backup` on origin | DONE | |
| S1/S2/S3 on main | ALREADY DONE (0.1.159) | see table above |
| `[platform-restart]` marker -> "restart required" reason (S4) | IN PROGRESS | `services/release_notes.py`; reads the add-on's own bundled CHANGELOG entry of the running version at start |
| Release-notes feed for the NEWER version on the Updates page (S4) | NOT DONE - needs decision | only the Supervisor has the newer CHANGELOG (`GET /addons/self/changelog` / store), which (a) is an unverified lab assumption and (b) conflicts with the S3 security rule "no upstream text echoed or stored". Needs an owner + security decision |
| Feature OFF by default behind an admin switch | NOT DONE - owner question | the feature already ships ON for `system.update` holders since 0.1.159 with owner approval (D1, S3 answer 2). Turning it off now would silently remove a working function after an upgrade |
| `docs/security/CR021_SELF_UPDATE_SECURITY_NOTES.md` | TODO | |
| User guide page (Hebrew) | TODO | `docs/user-guide/he/83-updates_HE.md` |
| `docs/release/NEXT-DRAFT.md` bilingual draft | TODO | |
| Owner release gate 13.4 (branch protection, lab session 13.5) | OWNER | agents never change repository settings |

## Next step

Finish `release_notes.py` + test, push, run `python private/runner/run_smart.py backend pilot/CR021-s3-apply` on the touched tests.

## Log

- 2026-10-08: worktree `C:\cloude\wt-CR021` created from origin/main 31fe5d7c; premise check above.
