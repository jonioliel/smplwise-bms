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

Source: the R2 ZIP (`WISKEY_MAC_ARX_NINE_COMPLETION_2026-10-29_R2.zip`, extracted read-only into a scratch folder outside the repository;
nothing from it was run). Order followed from the review section 2. Adopted semantically (own code, not the patch):

| Item | Decision | Where |
|---|---|---|
| Generation journal, CAS, lock-free I/O, same-generation proof | adopted (section 1) | `services/wiskey_install_generation.py` |
| Digest-keyed single restart | kept, now inside the journal (one mechanism only) | `request_component_restart` |
| Schemas (16 + `definitions.json` + index) | adopted as files | `contracts/wiskey/r2/schemas/` (examples and legacy folders left out: 4 MB, no use in Arx) |
| Error / status code table (914 codes, 54 typed outcomes, 12 state sets) | adopted compact (per-source evidence stripped: 71 KB instead of 4.4 MB; source sha256 recorded) | `contracts/wiskey/r2/public_outcomes.compact.json`, `outcome_known()`; a wire code is never rewritten, unknown = uncertain refusal |
| Event cursor semantics, retention | semantics file copied; reader for `events/retention_policy_v1` (defaults 30 days / 5000 records are not a guarantee) | `contracts/wiskey/r2/EVENT_CURSOR_FINAL.json`, `read_event_retention`; our `EventCursor` already had at-least-once and `reset_required` |
| Readiness `installation/readiness_v1` | closed reader: ready needs expected = staged = installed = loaded for both components, one boot, a bridge boot, and the identity (installation, entry, GrantRef) equal to our manifest, else reconnect | `wiskey_r2_contracts.read_readiness` (consumer only, no caller yet) |
| Station thumbnail `GET /api/v1/access-control/stations/{id}/thumbnail.jpg` | adopted; same gate as `/media` (access.read on the station chain), `private, no-store`; the installed WisKey still (`media/station_snapshot_v1`, `installed_snapshot`) ONLY with `wiskey.auto_install` on, otherwise / on "not supported" Arx's own lease path (one frame by stream name, `frame_existing`; no raw source) | `routers/intercom_media.py`, `wiskey_auto_install.installed_snapshot` |

Deliberately left out:

| Item | Why |
|---|---|
| R2's file-based generation journal in the HA config (`installation_generation.py`, `installation_files.py`) and its `fcntl.flock` | Arx keeps ONE mechanism (SQLite journal above); a second journal would give two restart sources of truth. R2's readiness proof is read, not stored in that file |
| `installation/request_restart_v1`, `installation/retire_v1` catalog names and a catalog refresh | effect commands; the catalog is pinned by hash and counts (tests) - refresh with the trim script is a separate step. `readiness_v1`, `events/retention_policy_v1` and `media/station_snapshot_v1` are therefore NOT yet in our runtime catalog (readers exist; a join that selects them needs the refresh) |
| Native ZIP (same label `2.0.0-rc.38`, 374 vs 370 files) and the pin | label is not identity; pin stays until WisKey answer question 3 |
| `TEMPLATE_SEND_SUPPORTED = True` | stays False |
| Bridge hard failure `wiskey_automatic_setup_failed` | review H4 stays |
| Station screens (`wiskey-stations*.ts`, `intercom.ts`), `addon_restart.py`, `self_update.py`, bootstrap restart, `reproduce_nine.py` | no screen or restart-path change in this round; the thumbnail endpoint exists for the screen to use later |
| Item 1 (cloud export), item 8 (joint session plan), item 9 (references) | blocked externally / plan only / references |

## 3. Notes

- Migration `0183_wiskey_installed_features.sql` still collides with `pilot/BUILDING-PRESENCE-2271`. Not renumbered here; whichever merges second renumbers.
- Next step: when the R2 ZIP is available (path from the owner), copy readiness, schemas, code table, retention command and thumbnail
  semantically, in the order the review gave: pin decision, readiness, then the stations screen.

## 4. Tests actually run

Workstation, Python 3.12 (`.venv` of the main checkout importing this worktree), focused files only, all passed: `test_wiskey_r2_align_2272_generation.py`
(6), `test_wiskey_r2_align_2272_contracts.py` (readiness, retention, code table, schemas, thumbnail route; 1 skipped: `jsonschema` not installed),
`test_wiskey_adopt_2272_installer.py`, `test_intercom_media.py`, `test_wkr5_295.py`; earlier in this round `test_wiskey_adopt_2272_review.py`, `_install.py`,
`test_wiskey_mac_adopt_298_review.py`, `test_bridge_install.py` (127, 3 skipped Windows-only). Runner: not contacted. NOT_RUN: full backend suite, frontend / tsc,
schema validation of examples, any live or device test.
