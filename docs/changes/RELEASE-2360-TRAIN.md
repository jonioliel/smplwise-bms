# RELEASE-2360-TRAIN: assembly of the 2.36.0 release train

Branch `release/2360-train`, cut from `origin/release/2350-train` (1993a207d). Release order (owner): 2.34.2 -> 2.35.0 -> 2.36.0 ->
WisKey last. No version bump, no changelog entry, no runner gate and no tag yet: this document is the input for the version commit
and the runner gate.

## Merged (one `--no-ff` merge commit each, in this order)

| # | Branch | Tip | Merge commit | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/HA-LABELS-SYNC-2351` | c50f3cc1c | ee0f53c54 | none |
| 2 | `sec/CAL-FEED-REVIEW-2351` | f566c2736 | 972314162 | none (migration number clash, see below) |
| 3 | `pilot/GDRIVE-READY-2351` | aeafc45b1 | 9db437058 | none |
| 4 | `pilot/HOME-EDIT-DRAWER-2351` | 933d2c898 | 87f949925 | none |
| 5 | `pilot/AREA-PRESENCE-LINE-2351` | d221e5eb0 | fd74186e1 | `contracts/API_INVENTORY.md` |
| 6 | `pilot/XS-MINI-WIDGET-2351` | b9595d581 | e722c5e40 | `frontend/src/screens/devices-building.ts` |
| 7 | `pilot/MAPPING-IMPROVE-2351` | eb313f41e | da3b62789 | `docs/changes/MAPPING-ASSIST-2330.md`, `frontend/src/api/mapping-engine.ts`, `frontend/src/screens/mapping-health.ts` |

Not merged: `pilot/BUILDING-SCOPE-CONTROL-2351` (held by the lead until the single-device control route gets its building check);
`pilot/WISKEY-RC7-ADOPT-2331` (WisKey boards last).

## Conflict resolutions

- `contracts/API_INVENTORY.md` (5): generated file; header line only. The train side was kept, then `scripts/api_inventory.py` was
  re-run on the assembled tree (commit 11f74a836): 1709 routes, adding `POST /backups/offbox/targets/{id}/gdrive/diagnose`
  (GDRIVE-READY) and `GET /presence/area/{area_id}` (AREA-PRESENCE-LINE), which no branch had regenerated.
- `devices-building.ts` (6): the `<home-edit-panel>` tag. HOME-EDIT-DRAWER added the `flat` attribute (drawn inside the drawer),
  XS-MINI-WIDGET added `?xsection=${this.xsOffered(...)}`. Both kept.
- `mapping-engine.ts` (7): HA-LABELS added the labels section (`HaLabel`, `labelCoverage`, `labelCoverageText`, ...) just above
  `subsetPlan`; MAPPING-IMPROVE rewrote `subsetPlan` and its comment and added `levelQuestions` / `levelWaiting` / `autoAdded` /
  `autoNoticeText` / `levelAnswerOf`. Both kept: the labels section, then MAPPING-IMPROVE's comment and functions.
- `mapping-health.ts` (7): import line = union of both import lists. `card()`: HA-LABELS' "not applied yet" labels card for
  `!d.seen` kept, then MAPPING-IMPROVE's `autoNotice` + `freshCard` split; the coverage line stays in every `freshCard` state.
- `MAPPING-ASSIST-2330.md` (7): MAPPING-IMPROVE's struck-through limits kept, with HA-LABELS' "(done: HA-LABELS-SYNC-2351)" on the
  labels limit.

## Cross-branch integration fix (no conflict, behaviour)

MAPPING-IMPROVE's server port of the mapping engine (`services/mapping_engine.py`, used by the background auto-insert
`services/mapping_auto.py`) was written while labels were not synced, so the job built area items without labels. With HA-LABELS on
the same train the browser would leave an area open on a label conflict (or place it by a "בתווית" rule) while the job placed it by its
name mark. Commit d4b11083f: the job reads area labels through `routers/home_mapping._labels` (the read the assistant route serves);
new test `test_job_reads_the_synced_labels_like_the_browser`; the stale limits in both change docs are marked closed.

## Migrations

The runner (`db.Database.migrate`) applies `migrations/*.sql` sorted by file name and records the integer prefix in
`schema_migrations(version INTEGER PRIMARY KEY)`, so two files numbered 0192 would fail the second insert. Neither branch's commits are
in any tag (`git tag --contains`: none), so renumbering is safe (commit 5895a4ad9):

| Number | File | Branch |
|---|---|---|
| 0190, 0191 | `calendar_attendees`, `calendar_grid_edit` | 2.35.0 train (unchanged) |
| 0192 | `0192_ha_labels.sql` | HA-LABELS-SYNC-2351 (unchanged) |
| 0193 | `0193_calendar_feed_review.sql` (was 0192) | CAL-FEED-REVIEW-2351: file, header comment, `test_migration_0193_columns`, change doc |

Sequence 0001-0193 contiguous. **WisKey (`pilot/WISKEY-RC7-ADOPT-2331`, 0192-0194 on its branch) must move to 0194+ when it boards.**

## Re-merge of 2.35.0

`origin/release/2350-train` moved to a449be64c (quick-create time inputs carry `lang=dateInputLang()`); merged into the train as
0bd4f1078 (no conflict).

## Checks on the workstation (02.11, one worker / one process)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p frontend` | 0 errors (after the 2.35.0 re-merge too) |
| Node unit specs `playwright.unit.config.ts --workers=1 tests/unit-` (page specs excluded by the config) | 3636: **3633 passed, 2 failed, 1 skipped** before the two fixes below; both specs then re-run green |
| - `unit-date-format-module` "every lit date/time input ... lang=dateInputLang()" | pre-existing on `origin/release/2350-train` 1993a207d (calendars/grid-overlays.ts, untouched by this train); fixed there by a449be64c; after the re-merge 8/8 passed |
| - `unit-menu-lint` (`.he-drawer` of HOME-EDIT-DRAWER flagged as an unregistered menu) | train regression; exempted like `.lay-panel` (9ab62cd65); 18/18 passed with `unit-home-edit-drawer` |
| Backend pytest, single process, 30 files (labels, structure refresh, mapping improve / assist, home links, multibuilding, calendar feed review / connect / attendees / grid edit, remote access, gdrive connect / api, offbox gdrive / backup / api, area + building presence, presence history / compact, home config / screen / options, bv1 tiles, generator widget, temperature phase 3, migrations, db template, ui settings, capabilities) | **445 passed, 0 failed, 0 skipped** |
| `scripts/release_check.py` | ready (migrations contiguous: 193 files, last `0193_calendar_feed_review.sql`; version 2.34.1 everywhere, no bump yet) |
| Full backend suite, browser / evidence / pixel specs | NOT_RUN (workstation memory; runner, see below) |

## Runner work still needed (NOT_RUN on the workstation)

Collected from each branch's change doc. Nothing below has been run on the train.

| Branch | Specs / baselines |
|---|---|
| HA-LABELS-SYNC | Browser evidence / pixel of settings "בניינים ומיפוי" before an apply (new labels card): `evidence-mapping-assist-2330` screenshots and any pixel baseline of that page may need a refresh. Not checked against a real home system. |
| CAL-FEED-REVIEW | No UI change (remote switch is API only). `test_remote_access.py` stays in the backend gate. |
| GDRIVE-READY | Browser spec / pixel baseline for the new "בדיקת חיבור Google" dialog (none exists; `offbox-backup-ui.spec.ts` passed on the runner, 24, but does not open it). |
| HOME-EDIT-DRAWER | `unit-home-screen` (page spec, needs the built app); evidence `evidence-home-screen`, `evidence-devices` (floor / area card panels on the drawer's card tab), `layout-bv1-tiles` (home-edit overflow / clipped at the drawer width), `evidence-home-polish`, `layout-a11y-295`; drawer screenshots at 1920 / 1440 / 1280 / 1180 / 1024 / 390. Confirm: drawer body scrolls with a fixed footer, edit-mode page height drops, Escape and Tab wrap. |
| AREA-PRESENCE-LINE | Browser / screenshot evidence; `evidence-presence-design-2300` and `evidence-presence-2280-layout` settings shots differ (one more toggle row in "זמנים ותצוגה"). No `visual-matrix` change (off by default). |
| XS-MINI-WIDGET | `evidence-home-screen` (order list updated on the branch; one more ghost "חתך בניין · כבוי" in edit mode). No `visual-matrix` change (off by default). |
| MAPPING-IMPROVE | `evidence-mapping-assist-2330` and the settings header baselines. Live structure refresh against the lab home system not run. |

Overlap to watch on the runner: HOME-EDIT-DRAWER and XS-MINI-WIDGET both change the home editor (`evidence-home-screen`,
`layout-bv1-tiles`): refresh their baselines once, on the train, not per branch.

## Open owner questions

1. Calendar feed on the remote channel (CAL-FEED-REVIEW, section 5 of its doc; built, OFF for every feed):
   1. Allow opening a feed to remote access at all? (a) yes, per feed, as built (b) no, keep fully blocked.
   2. If yes, a switch on the "outgoing feeds" screen? (a) yes (b) no, administrator only.
   3. Default lifetime of a feed address? (a) unlimited (today) (b) 180 days (c) 365 days.
   4. Force "busy only" on a remote-open feed? (a) yes (b) no, the creator chooses.
2. Google Drive (GDRIVE-READY): the owner's first real connection following `docs/operations/GDRIVE_CONNECT_SETUP_HE.md` ("בדיקת
   חיבור Google" before and after), then Publish app + one reconnect, or the daily push stops after 7 days. Recorded contradiction:
   the older `GDRIVE_BACKUP_SETUP*.md` say "In production" at once; the new guide starts in Testing.
3. Home edit on a phone (HOME-EDIT-DRAWER): (a) refuse always (b) default "hide the layout editor on the phone" to on (c) leave as is
   (today the option defaults to off, so a phone can enter home edit mode).
4. Closed home-edit drawer (HOME-EDIT-DRAWER): (a) keep its column reserved (b) give the width back to the preview.
5. Area presence line (AREA-PRESENCE-LINE): should `presence.building.view` without `presence.view` see an anonymous people count?
   (today: no). Should the line also appear in the area quick pop-up?
6. Recorded contradiction (HOME-EDIT-DRAWER): the brief asked for a side drawer on tablet; the owner's OWNER-R12-2341 answer 8B (side
   panel only from 1200 px) was followed.

## Follow-up merges announced by the lead (not on the train yet)

Owner decisions arrived during the assembly: new commits will land on `pilot/HOME-EDIT-DRAWER-2351` (a closed drawer gives the width
back, as a setting), `pilot/AREA-PRESENCE-LINE-2351` (anonymous count for building-presence viewers, line in the area quick pop-up)
and `sec/CAL-FEED-REVIEW-2351` (remote toggle on the outgoing feeds screen, expiry default 365 as a setting, busy-only when remote; no
new migration). The lead re-merges them later; questions 1, 3-for-the-drawer (item 4) and 5 above are answered by those commits.
For that re-merge: the feed migration lives here at `migrations/0193_calendar_feed_review.sql` (renamed from 0192; git follows the
rename), and this train edited lines 8-9 and 45 of `docs/changes/CAL-FEED-REVIEW-2351.md` (the migration name / test name) - a
conflict there keeps 0193. `pilot/BUILDING-SCOPE-CONTROL-2351` is still to be merged when the lead says so.
