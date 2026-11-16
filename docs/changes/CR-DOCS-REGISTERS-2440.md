# CR-DOCS-REGISTERS-2440

Code-review batch 16.11, wave 3A (backend), documentation only. Plan row `pilot/CR-DOCS-REGISTERS-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md`; findings 03:F27, 03:F28, 01:F-21, 05:P2-15.
Base: `origin/pilot/CR-WAVE2-COMBINED-2439` (`4e52e5e4a`). Risk in the plan: none. No behaviour changes: the only `.py`
file touched changes in its module docstring alone.

## What and why

| Finding | Result |
|---|---|
| 03:F27 - the ffmpeg command line of a Provision export carries the recorder's RTSP address with user and password, visible in the container's process list while the download runs | `docs/security/FFMPEG_PROCESS_LIST_CREDENTIALS.md`: what is exposed and for how long, who can read it (the add-on does not share the host PID namespace), what is already done, why it is accepted, the rules that follow, the triggers for a new review. No code change, as the finding proposes. |
| 03:F28 - the notes "wire shape unverified / unproven" live only in comments | `docs/integrations/UNVERIFIED_WIRE_SHAPES.md`: a register with one row per assumption (24 rows: Frigate reads 4, Frigate writes 12, Hikvision NVR 3, multimedia / TV 4, plan 1), each with where it is stated, the guard today, the check that closes it and a status. |
| 01:F-21 - function-level imports in the tickets package, most of them breaking import cycles | `smplwise_vms/backend/smplwise/services/tickets/__init__.py`: a "Layering" section in the package docstring (leaves, store, documents, access, services, wiring), the rule for new code, and the cycles the function-level imports hold today. Docstring only. |
| 05:P2-15 - pagination and list envelopes differ per router | `docs/architecture/API_LIST_CONVENTION.md`: the convention for new routes (`items` + `next_cursor`, keyset cursor for growing tables, what a cursor must be, `limit` bounds) and the reference implementations already in the code. Existing routes do not change. |

## Found on the way

- **The count of 71.** Repeating the review's search at this base over its scope gives 72 lines in 134 files. 38 are
  assumption notes and collapse into the 24 rows (one assumption is usually stated in the adapter, the service and the
  router); 34 are the word `unverified` used as a status value or verdict and are listed as such in the register's
  section 6. The register is therefore 24 rows, not 71.
- **Some "NOT verified" notes look stale.** Later comments in the same files record live Frigate 0.18.0 observations
  (FRIGLIVE-295) and an OpenAPI check (FRIGATE-295) for parts of what the module docstrings still call unverified
  (`config/set`, the exports row, the clip read). I did not reword any comment (no evidence was re-run here; no device
  access in this batch): those rows carry the status `reconcile` and name the later note. Closing chain / lead: one pass
  over the lab's `GET /frigate/{recorder_id}/control/first-writes` answer settles which rows close.
- **Tickets package numbers.** At this base the package has 132 modules and 407 import statements inside functions
  (the review counted 131 and 496 at v2.43.4; the tickets branches of wave 1 and 2 removed some). The docstring gives
  round figures. The store modules (`store.py`, `store_*.py`) import nothing from the package, which is the one layer
  rule that already holds without exception; `outbox_store.py` and `public_store.py` are named as the exceptions they are.
- **The pagination helper** in the finding's fix ("add a helper for new routes") is code; the row is documentation only,
  so it is recorded in the note as left to a code branch.

## Files

New: `docs/security/FFMPEG_PROCESS_LIST_CREDENTIALS.md`, `docs/integrations/UNVERIFIED_WIRE_SHAPES.md`,
`docs/architecture/API_LIST_CONVENTION.md`, this note.
Changed: `smplwise_vms/backend/smplwise/services/tickets/__init__.py` (module docstring only).

Outside my rows: none.

## Tests actually run

- `ast.parse` of `services/tickets/__init__.py` after the edit: ok. The diff of that file is inside the docstring only.
- The numbers in the notes were measured at this base with `grep` and a small AST script (import statements of the
  tickets package), not taken from the review.

NOT_RUN: pytest (the row names no test; no executable line changed), ruff, the full suite, the entry check. No device,
lab, runner or Home Assistant access. The ffmpeg options-file alternative in the security note was not tried on the add-on
image.

Pixels to refresh: none.
