# LEGACY-MIGRATION-2550 - import from the legacy NVR add-on: gap analysis, plan, dry run, apply (T070)

Branch `pilot/LEGACY-MIGRATION-2550`, cut from `origin/release/2520-train` at `91de5c377`. Target 2.55. No version bump, no merge,
no lab, no device contact. Card T070 stays BACKLOG (its acceptance needs the shadow run on the owner's installation).

## 1. What and why

T070 needs a gradual migration from the legacy "Hikvision NVR Panel" add-on 1.5.27 with a dry run, a real rollback and acceptance
side by side. The earlier work (T070-T006-2406) left a workstation dry-run script and the parity map; this row adds:

1. **Gap analysis + migration plan** - `docs/legacy/MIGRATION_GAP_ANALYSIS.md`: everything the legacy persists (14 options, the
   override document's NVR overrides / camera names / display offset / manual recordings, the event store, the browser theme; no
   layouts, users, schedules or notifications of its own), where each lands in Arx, what the import carries, the remaining gaps and
   the phased plan with a way back at every phase.
2. **A read-only import path inside Arx** (software only):
   - `services/legacy_source.py` (standard library only) reads COPIES: loose JSON / JSON lines, ZIP / TAR (plain or gzip) with
     members recognised by content (any file names), the secret-free export, an unprotected Home Assistant backup (outer TAR +
     `backup.json` + the add-on's and the configuration folder's inner archives; a protected one is refused with its own reason).
     Caps: 20 MiB upload, 8 MiB per member, 64 MiB unpacked in total, 50,000 members, 20,000 event rows; nothing is extracted to
     disk. Secrets never survive the read: passwords, PINs and the Ingress path become set / empty, the NVR host and the go2rtc URL
     salted digests (compared with Arx's own, never shown). Arx never opens the legacy's own files (PARITY_REPORT C8 still PASS).
   - `services/legacy_import.py`: **dry run** - one item per legacy element with an action (`update`, `create`, `same`, `keep`,
     `skip`, `manual`, `info`), a stable code, a note in the reader's language, the warnings, the legacy's effective display offset
     (computed exactly as the legacy did, `auto` = the zone's standard offset) and a `plan_digest`; **apply** - bound to that digest
     (409 when the file or Arx changed), a project backup `auto-pre-legacy-import` first (no backup, no change; newest 5 kept), then
     only EMPTY camera aliases on the first recorder by a guarded UPDATE (idempotent: the same file again writes nothing and no
     backup), a run record (`migration.legacy.runs`, newest 20), audit rows `camera.update` (`via: legacy_import`) and
     `migration.legacy.apply` / `.dry_run` - with counts, the source SHA-256 and the backup name only.
   - `routers/legacy_migration.py`: `GET /api/v1/migration/legacy`, `POST /api/v1/migration/legacy/dry-run`,
     `POST /api/v1/migration/legacy/apply?plan_digest=&confirm=` - system administrator (audited refusal), the body read after the
     gate with its cap; apply also needs an interactive session and the typed word `legacy_import_apply`
     (`ייבוא מהמערכת הישנה` / `import legacy`).
   - Not carried by design: the NVR connection (compared only - Arx tests a connection before saving it), the NVR password
     (never read out), PINs (a shared PIN names no person: people get home-system users and Arx roles), manual recordings (live NVR
     commands), the event store (archive), the display offset (Arx shows NVR wall-clock times).
3. **Workstation script** - `scripts/migrate_legacy.py --backup <file> [--export out.json]` reads a full backup with the same reader
   and writes the secret-free export the API takes; `--export` also works with `--options / --override / --events`.
4. **Acceptance checklist (Hebrew)** - `docs/operations/LEGACY_ACCEPTANCE_CHECKLIST_HE.md`: legacy vs Arx side by side for the pilot
   day (before, import, live, recordings and time, export, maintenance and storage, people, security, cutover and rollback, sign-off).
   The Hebrew guide `docs/operations/MIGRATION_FROM_LEGACY_HE.md` gains section 2א (the in-product import).

## 2. Files

| file | change |
|---|---|
| `smplwise_vms/backend/smplwise/services/legacy_source.py` | new - the reader |
| `smplwise_vms/backend/smplwise/services/legacy_import.py` | new - dry run and apply |
| `smplwise_vms/backend/smplwise/routers/legacy_migration.py` | new - three routes |
| `smplwise_vms/backend/smplwise/wire/legacy_migration.py` | new - response models (every route modelled) |
| `smplwise_vms/backend/smplwise/routers/__init__.py` | `Mount("legacy_migration", "migration")` after backup |
| `smplwise_vms/backend/smplwise/body_limit.py` | rule `legacy_import`: 20 MiB raw for dry-run / apply |
| `smplwise_vms/backend/smplwise/services/backup.py` | `KEEP["auto-pre-legacy-import"] = 5` (one line) |
| `smplwise_vms/backend/smplwise/services/confirm_words.py`, `frontend/src/i18n/confirm-words.ts` | word `legacy_import_apply` (both tables, no UI change) |
| `smplwise_vms/backend/smplwise/error_text_en.json` | English for the 8 new refusal texts |
| `contracts/API_INVENTORY.md` | 3 rows (tag `migration`) |
| `scripts/migrate_legacy.py` | `--backup`, `--export` |
| `smplwise_vms/backend/tests/test_legacy_import_2550.py` | new, 16 tests; synthetic fixtures `tests/fixtures/legacy_v1527/` (`.invalid` hosts, made-up secret markers) |
| `smplwise_vms/backend/tests/test_migrate_legacy.py` | +1 test (`--backup` / `--export`) |
| `smplwise_vms/backend/tests/test_confirm_words_2442.py` | 23 words; the new caller in the list |
| `docs/legacy/MIGRATION_GAP_ANALYSIS.md`, `docs/operations/LEGACY_ACCEPTANCE_CHECKLIST_HE.md` | new |
| `docs/operations/MIGRATION_FROM_LEGACY_HE.md` | section 2א |

Shared files touched (merge note for the 2.52+ trains): `routers/__init__.py`, `body_limit.py`, `services/backup.py`,
`services/confirm_words.py` + `frontend/src/i18n/confirm-words.ts`, `error_text_en.json`, `contracts/API_INVENTORY.md`,
`tests/test_confirm_words_2442.py` - each a small, line-local addition. None is a WisKey R1-R7 / DESIGN-LITERALS file. No UI change
(no screen, no pixel baseline, no compare page).

## 3. Tests

Linux runner (slot B, worktree at `1d00f7850`, `SW_WIRE_STRICT=1`, job `~/work/p2520_legacymig_run.sh`) - all RUN:

| command | exit | result |
|---|---|---|
| pytest `test_legacy_import_2550.py test_migrate_legacy.py test_legacy_parity_t070.py test_confirm_words_2442.py` | 0 | 82 passed |
| pytest `test_body_limit.py test_wire_ratchet_2480.py test_i18n_errors_en_2520.py test_plan_routes_unique.py test_raw_body_order.py` | 0 | 45 passed |
| pytest `test_get_routes_read_conn.py test_local_auth_inventory.py test_remote_hardening.py test_release_check.py` | 0 | 788 passed (30 min) |
| pytest `test_backup.py test_cameras.py test_wire_consumption_2450.py` | 0 | 29 passed |
| `npx playwright test -c playwright.unit.config.ts tests/unit-confirm-words-2442.spec.ts` | 0 | 7 passed |
| `python scripts/api_inventory.py` (regenerated, compared with the committed file) | 0 | 1951 routes, diff 0 lines |
| `python scripts/legacy_parity.py check` | 0 | PASS (C1-C8; C8 "Arx never touches the legacy files" still holds) |
| `python scripts/gen_wire_types.py --check` | 0 | current (the new router is not in a generated family) |
| `ruff check` on the changed / new Python files | 1 | the 5 findings are all on lines of `scripts/migrate_legacy.py` that existed before this row (EXE001, RUF100 x2, UP017, SIM118); the new modules and tests are clean |

Workstation (`.venv`, one file per process): `test_legacy_import_2550.py` 16 passed, `test_migrate_legacy.py` 4 passed,
`test_confirm_words_2442.py` 52 passed.

NOT_RUN: the full backend suite and the release gate (the train's job); any lab / real-file dry run (LAB-T070-01..07 - the
owner's session, see the Hebrew checklist); no UI, so no pixel baselines and no compare page.

## 4. Open questions (recommendation first)

1. A screen for the import (Settings > Backup > "Import from the old system": upload, the report table, apply with the word)?
   a) yes, a small follow-up row in 2.55 using the existing table / confirm components (recommended); b) keep it API + script only
   (the lead runs it once for the pilot site); c) not needed.
2. Step-up for the apply (when the owner turns step-up on)? a) leave it as is: system administrator + interactive session + typed
   word + backup first; step-up stays OFF by default and this action is not on its once-list (recommended, matches Q2=b); b) add it to
   the step-up once-actions like a backup restore.
3. The backup list shows the new kind as `auto-pre-legacy-import` (no Hebrew label yet). a) add the label with the screen of
   question 1 (recommended); b) add it now in a frontend row.
4. Should the import ever offer to copy the NVR connection (host / ports / user, never the password) into Settings > Connections?
   a) no - a person enters it once and Arx tests it before saving (recommended); b) yes, as a pre-filled form only.
