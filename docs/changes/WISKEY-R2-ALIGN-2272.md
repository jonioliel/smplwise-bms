# WISKEY-R2-ALIGN-2272 - reconciliation of the WisKey R2 delivery with the adoption branch (2.27.2)

Branch `pilot/WISKEY-R2-ALIGN-2272`, cut from `pilot/WISKEY-ADOPT-2272` (`39d9daaf6`). Not merged, not pushed, not tagged, not released.
Every installation effect stays behind the setting `wiskey.auto_install` (default OFF). Arx never creates, renews or edits a grant in
WisKey (read only). No physical action, no live device, no real platform restart. Inputs: the owner's R2 review and intake notes
(private/planning, 29.10.2026).

## 1. WIN-R2-ARX-GEN-01 fixed on Arx's own code

Before: the adoption branch had no generation concept; the restart claim was a SQLite transaction on a digest setting and
`reconcile_installation` wrote no journal, so the race did not exist there but would come back with R2's journal. This branch adds
the journal the right way (new `services/wiskey_install_generation.py`, setting `wiskey.installation.generation`, never in a backup):

- one shared process lock plus a write transaction around every read-modify-write (the read and the write can not be separated);
- compare-and-set on generation id, expected state and claim token (`begin`, `claim_restart`, `finish_restart`, `record_proof`);
- the lock is released before any outside I/O (the restart call, the WisKey registry read); the outcome is applied afterwards by a fresh
  CAS, so a stale result returns `stale` and writes nothing;
- `request_component_restart` goes through the journal (a superseded request answers `superseded`); `reconcile_installation` reads the
  generation before its I/O and merges its proof only for the same generation and the intent `reconcile`;
- the legacy digest setting is kept in step; an old claim without a journal still blocks a replay.

Tests (`test_wiskey_r2_align_2272_generation.py`, threads with explicit events on the real functions): (a) a second requester waits on the
lock while the first is inside its critical section, then answers `already_requested`, one restart call only; (b) a late failure of
install A, while install B started and finished its own generation, leaves B's journal unchanged; stale finish / wrong claim /
superseded claim are rejected; (c) a reconcile proof of A, with B started during A's registry read, leaves B untouched; a proof for the
same generation is merged without disturbing state or claim. A mutation check (CAS conditions removed) made tests b and c fail.

## 2. Adopted from R2 and left out

The R2 package itself (ZIP, patch, schemas, tables) was NOT present on this workstation when this was done (searched the repository
tree, the delivery folders, Downloads and Desktop). Only the owner's review of it was available. Nothing was copied from R2 blind.

| Item | Decision | Why |
|---|---|---|
| Generation journal, CAS, lock-free I/O, same-generation proof | adopted (own implementation, section 1) | needed for ask 6 and 7; the race fix is the precondition the review set |
| Digest-keyed single restart | kept, now inside the journal | one mechanism only (review risk: two restart mechanisms) |
| Readiness signal `installation/readiness_v1` | NOT adopted yet | needs R2's signed command contract and schema; the generation journal provides the place to record its proof |
| Contracts / schemas (16), error code table (914), event cursor retention command, `events/retention_policy_v1` | NOT adopted yet | source not available; needs a file-by-file semantic copy from the R2 ZIP, with the catalog trim script |
| Station thumbnail `GET .../stations/{id}/thumbnail.jpg`, station overview screens | NOT adopted yet | source not available; also open question 5 (one camera entity per station, permission) |
| Native ZIP (same label `2.0.0-rc.38`, 374 files vs 370) and the pin | NOT adopted; deliberately kept | same label with different bytes: the pin stays until WisKey answer question 3; the pin check is a byte-exact check, not a version label |
| `TEMPLATE_SEND_SUPPORTED = True` at start-up | left out | stays False; real sends are a joint owner session decision |
| Bridge hard failure `wiskey_automatic_setup_failed` | left out | review H4 stays: never takes the bridge down |
| R2 file lock `fcntl.flock` | left out | not needed: SQLite write transaction plus a process lock; works on Windows |
| Item 1 (cloud export), item 8 (joint session plan), item 9 (references) | no code | blocked externally / plan only / references |

## 3. Notes

- Migration `0183_wiskey_installed_features.sql` still collides with `pilot/BUILDING-PRESENCE-2271`. Not renumbered here; whichever merges second renumbers.
- Next step: when the R2 ZIP is available (path from the owner), copy readiness, schemas, code table, retention command and thumbnail
  semantically, in the order the review gave: pin decision, readiness, then the stations screen.

## 4. Tests actually run

Workstation, Python 3.12 (`.venv` of the main checkout, importing this worktree), focused files only:
`test_wiskey_r2_align_2272_generation.py` (6 passed) with `test_wiskey_adopt_2272_installer.py` (15 passed together); plus `test_wiskey_adopt_2272_review.py`, `_install.py`, `test_wiskey_mac_adopt_298_review.py`, `test_bridge_install.py`: 127 tests, 3 skipped (Windows POSIX-only), 0 failed. Runner: not
contacted (a release gate occupies it). NOT_RUN: the wider WisKey suites, full backend suite, frontend, any live test.
