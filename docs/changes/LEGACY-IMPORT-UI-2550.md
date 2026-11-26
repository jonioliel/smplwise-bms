# LEGACY-IMPORT-UI-2550 - the legacy import screen (T070, Settings > Backup and restore)

Branch `pilot/LEGACY-IMPORT-UI-2550`, cut from `origin/pilot/LEGACY-MIGRATION-2550` at `aa7a68c74` (the routes it uses). Target 2.55.
No version bump, no merge, no lab, no device contact. Owner rule (unanswered = the recommendation) for LEGACY-MIGRATION-2550's open
questions: **Q1 a** (a small screen using the existing components), **Q3 a** (the Hebrew / English label of the backup kind with it).

## 1. What and why

LEGACY-MIGRATION-2550 added the import from the legacy "Hikvision NVR Panel" add-on 1.5.27 as three routes and a workstation script.
This row gives a system administrator the screen for it, on Settings > Backup and restore ("גיבוי ושחזור" - where the project backups,
the restore and the off-box copies already live; the apply writes such a backup first):

1. **Choose the file** - a full unprotected home-system backup, a ZIP / TAR of the add-on's files or the export of
   `scripts/migrate_legacy.py --export`, up to the server's limit (`max_bytes` of `GET /migration/legacy`). The file is sent as the
   raw request body to `POST /migration/legacy/dry-run` at once; nothing is written on the server (an audit row only). The file is not
   kept by the browser past the screen.
2. **The dry-run report** - what was read (file name, container, size, legacy version, the parts found), the count per action
   (a zero count is not drawn), the server's warnings, and every item with its action badge and the server's note (Hebrew or English by
   the reader's language), **grouped by area** (a heading row per group, repeated at the top of a page that continues a group) and
   **paged** (8 rows on a wide screen, 5 on a phone; `sw-pager`) - no scrolling list. A file that was applied before says so.
3. **Apply** - a dialog that states what changes (only the camera aliases that are empty today; nothing on the NVR, the home system or
   go2rtc), the line **"a project backup (auto-pre-legacy-import) is written before any change; no backup, no change"**, and the typed
   confirm word (`legacy_import_apply`: the Hebrew word, or the English one in the English interface - the server accepts both). The
   request carries the report's `plan_digest` and the typed word.
4. **Honest refusals** - 409 `legacy_plan_changed` closes the dialog, shows the server's text as it is, blocks the apply and offers
   "run the check again" (a new dry run); 409 `legacy_backup_failed` (and any other refusal) stays in the dialog. Nothing is reported as
   done unless the server said so.
5. **The result** - copied / unchanged counts (or "already imported: nothing changed and no backup was written"), the backup's name and
   size, the channels updated, when and by whom, the file's fingerprint (first 12 hex of the SHA-256), and the note that the action is in
   the audit log and the backup above returns to the previous state. The card fires `backups-changed`; the backup tab reads its list
   again, so the new backup shows at once. The newest 3 runs are listed under the card while no report is open.
6. **The backup kind label** - `auto-pre-legacy-import` is "אוטומטי · לפני ייבוא מהמערכת הישנה" / "Automatic · before the legacy import"
   in the backup list (and its delete dialog), instead of the raw kind.

Who sees it: the parent draws the card for `system.configure` in API mode; the card draws nothing when `GET /migration/legacy` answers
403 (`not_system_admin` - the server's own gate stays the authority) or 404 (a server without the routes). No new setting: the card is
new, an administrator opens it on purpose, and nothing changes for anyone who does not.

Not changed: the routes, the wire models, the server texts, step-up (stays OFF by default; the apply is not on its once-list - Q2 a of
the base row), the NVR connection (Q4 a: not copied).

## 2. Files

| file | change |
|---|---|
| `frontend/src/components/sw-legacy-import.ts` | new - the card (sw-card, sw-table with group headings, sw-pager, sw-badge, sw-dialog, sw-state-panel, settingsStyles; tokens only) |
| `frontend/src/api/legacy-migration.ts` | new - the three calls (raw body), the wire types, `writeCount`, `groupedItems`, `pageRows` |
| `frontend/src/screens/system-diagnostics.ts` | the card on the backup tab (`system.configure`), `@backups-changed` -> reload the list (2 lines) |
| `frontend/src/screens/system-diagnostics-backup.ts` | the tab chunk imports the card (1 line) |
| `frontend/src/api/backup.ts` | `KIND_LABEL['auto-pre-legacy-import']` |
| `frontend/src/screens/system-index.ts` | settings search keywords of "גיבוי ושחזור" (+ legacy import, Hebrew and English) |
| `frontend/src/i18n/lang/en/i18n/msg/components.ts`, `.../msg/api-system.ts` | the English of the new texts (appended) |
| `frontend/tests/unit-legacy-import-2550.spec.ts` | new - grouping / paging / write count, English completeness + no branding, the kind label, the confirm word |
| `frontend/tests/legacy-import-ui-2550.spec.ts`, `frontend/tests/legacy-import-mock.ts` | new - the mocked UI spec (and the SW_SHOTS evidence pages) |
| `frontend/tests/pixel-legacy-import-2550.spec.ts` (+ `-snapshots/`) | new - Linux pixel baselines |

Shared files touched (merge note): `system-diagnostics.ts`, `system-diagnostics-backup.ts`, `system-index.ts`, `api/backup.ts`, the two
en msg packs - each a line-local addition. None is a WisKey R1-R7 / bridge file; DESIGN-LITERALS-2510 may touch `system-diagnostics.ts`
too (different lines). No backend change.

## 3. Tests

Linux runner, slot B (jobs `~/work/p2520_legacyui_run.sh`, `_run2.sh`, `_run3.sh`; the final pass at `5a140c11d`, the code of this
commit). All RUN:

| command | exit | result |
|---|---|---|
| `python scripts/design_ratchet.py` | 0 | no count above the baseline (px-literal / color-literal / scroll-container unchanged) |
| `npx tsc --noEmit -p .` | 0 | 0 errors (pass 1 found 2: a `hidden` state clashing with `HTMLElement.hidden` - fixed, `absent`) |
| `npx tsc --noEmit -p tsconfig.tests.json` | 0 | 0 errors |
| `npx eslint` (the 6 changed src files + the en packs) | 0 | 0 errors (4 warnings: the spec files are on eslint's ignore list) |
| unit: `unit-legacy-import-2550`, `unit-i18n-en-ratchet-2490`, `unit-i18n-lang-packs-2443`, `unit-settings-index`, `unit-settings-search-en-2490`, `unit-confirm-words-2442`, `unit-i18n-api-2442` (pass 1) | 0 | 67 passed |
| unit: `unit-legacy-import-2550`, `unit-i18n-en-ratchet-2490` (final pass) | 0 | 12 passed |
| `npm run build` | 0 | - |
| `SW_SHOTS=1 playwright test tests/legacy-import-ui-2550.spec.ts --project=desktop --project=mobile` | 0 | 20 passed (pass 1: 4 failed - the evidence-only cases loaded the same address twice without a reload; fixed) |
| the same without SW_SHOTS | 0 | 16 passed, 4 skipped (the evidence-only cases) |
| `playwright test tests/pixel-legacy-import-2550.spec.ts --update-snapshots=all`, then the re-check | 0 / 0 | 6 passed / 6 passed - 12 Linux baselines (classic + domus report; classic dark report, dialog, result, 409; 1440 and 390) |
| existing backup-tab specs: `offbox-backup-ui`, `evidence-diagnostics-defects`, `evidence-backup`, `evidence-backup-meters`, `offbox-gdrive-diagnose-2351` (pass 1 build) | 0 | 33 passed, 15 skipped (their own skips) |

Workstation: `npx playwright test -c playwright.unit.config.ts tests/unit-legacy-import-2550.spec.ts` - 6 passed;
`py -3.12 scripts/design_ratchet.py` - no count above the baseline.

Compare page (local): `private/planning/legacy-import-ui-2550_compare_2026-11-25.html` - "before" is the same build with the import
routes missing (the tab as it is today), desktop + phone, light + dark.

NOT_RUN: the full frontend suite, the layout guard over every settings page and the release gate (the train's job); any lab run or a
real legacy file (LAB-T070-01..07 stay the owner's session); the backend (unchanged here).

## 4. Open questions (recommendation first)

1. Should the card also be reachable from the "old system" migration guide (a link from the Hebrew guide's section 2א to
   `#/system/diagnostics?tab=backup`)? a) yes, a one-line doc edit in the train (recommended); b) no.
2. Page size of the report: a) fixed 8 / 5 rows (recommended - the report holds 15-40 items, one installation runs it once);
   b) follow the installation's long-lists page-size setting.
