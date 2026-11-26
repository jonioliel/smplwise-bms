# STALE-FIXTURE-SPECS-2530 - the media and WisKey fixture specs settled against the merged product, and into the gate

Branch `pilot/STALE-FIXTURE-SPECS-2530` from `origin/pilot/GATE-FIXTURE-LANE-2530` (d52a6e649). Target 2.53. Follows up the open
questions 2 and 3 of `docs/changes/GATE-FIXTURE-LANE-2530.md`. Nothing ran against the lab, a device, WisKey, go2rtc or Home Assistant:
every backend here is a committed fixture (`.test` hosts, refuses to start inside the add-on).

## 1. evidence-media-players-live (CR-MULTIMEDIA-BASE-2440)

The spec was written before the players server existed. Each assertion that failed in the lane (ma 6, sonos 4) was checked against the
product code and its own tests:

| Failing check | Who was right | Change |
|---|---|---|
| "unplaced devices are listed last" (desktop only): `sw-app :text("לא משויכים")`.first() was hidden | the product: `resolvePlayerGroups` puts the bucket last; the first match was the desktop's closed floor menu, which names the bucket too; a desktop also pages the cards (NOSCROLL-1366-2437) | spec: the sections' order (`section.fsec[data-group]`, the last is `none`), the unplaced devices' cards inside it, then the pager to the page that draws it |
| the panel's library tabs: `innerText` of the panel had no "מועדפים" | the product: the tabs are an `sw-tabs` strip whose labels live in its own shadow root (innerText never sees them); the read also came before the library loaded | spec: the tabs by their `data-pn-libtab` hooks (favourites both houses; playlists MA only) |
| the groups page on a phone: no `[data-group-card]` with "מגבר קולנוע" | the product: a live group's card is titled by its ROOMS; device names are on the member rows, folded behind "לפי חדר" on a phone | spec: the card by its leader key, the rooms in the title, "לפי חדר" opened, four member rows, the device name |
| group leave answered `unknown`, `left` expected (MA house) | **the product**: the unjoin record was confirmed by the room's OWN `group_members`, which in the Music Assistant encoding is `[]` while the room IS grouped (only the leader and the first member list the group); the bulk ended before the leader reported, and the report said `unknown` for a room that had left | product: `services/ha_actions.still_grouped_elsewhere` - an unjoin is confirmed only when no other player still lists the room in a live group and (MA) its `active_queue` is no other MA player's; a static group (MA `group` player or a `group` helper) does not count, as in `media_model.resolve_groups`. Test: `test_media_groups.py::test_a_leave_is_read_back_from_the_group_not_only_from_the_rooms_own_empty_list` |

## 2. evidence-wiskey-people / -editor / -capture (CR-WISKEY-NOTIF-2443, DIALOG-DRAWER-ONE-2439)

Rewritten for the native people screen of CR-036 S7 (`screens/wiskey-people.ts`: `GET /api/v1/access-control/people`, rows
`[data-person-row]` in a table / list / cards view, "עוד N" paging, the person's page in `wiskey-person-drawer`), keeping what each test
proved:

- **people, part 2 (fixture WisKey):** the first page (50 of 130 by employee number, the users/query frame with an empty query, the sync
  and state badge kinds per row, no phone / card / profile value in a row); search matched by Arx on name and employee number, never
  sent to WisKey (a phone or card match finds nobody); filters and sort as WisKey's own keys from offset 0, "clear" keeps the sort;
  "עוד N" carries the snapshot and appends; a directory that changed under the paging is said ("הרשימה השתנתה") with a reload from the
  first page, and a change notice reads the shown list again; a search whose scan stopped early (scan limit, rate limit) says its total is
  a minimum; the person's page reads the person (users/get), is read again only when THAT person changed, and a person WisKey no longer has
  is "האדם לא נמצא" (404). Dropped: the page-size select and numbered pages (the native screen has neither).
- **people, part 1 (no Home Assistant):** a new fixture group `no_ha` with `frontend/tests/fixtures/no_ha_backend.py` (the real backend
  with no HA_URL / HA_TOKEN / options file; NVR and go2rtc on `.test` names): the tab is the third of the access-control row (and on the
  phone's bottom nav), the screen says "בקרת הכניסה אינה זמינה" and invents nothing; the gating follows CR-036 - without
  `access.people.read` no tab, the typed address shows "המסך הזה אינו זמין לך" and the API answers 403 (also for a viewer holding
  `access.read` only); the built-in operator (`access.people.read`) opens it.
- **editor and capture:** only the way in changed (a row -> the drawer -> "עריכה"); every editor / capture assertion is kept, except:
  the gating user is the built-in operator (reads people, does not manage them); the save notice is the screen's own "נשמר · <time>"
  (never "synced"); the delete notice is "נשלח · ממתין לאישור" then "האדם הוסר"; a new person's editor has seven sections (category and
  timing came later); the person's validity after the edit is read from the read model (the old "future" badge was dated:
  2026-10-01 has passed); a people editor without `access.cards.capture` sees NO capture block (the product dropped the note naming the
  permission: absent, never greyed); the capture gating role names `access.people.manage` and `access.people.sensitive` (the editor's PIN
  and cards sections are sensitive-level) and the new `access.people.read`.
- **fixture fix:** `wiskey_fake_ha.py` sent `applied_revision: 0` for an assignment never applied; the strict shape verdict
  (`access_grant_engine.access_shape`, R6-A4) treats 0 as a malformed bookkeeping revision, so every pending / offline person's station
  set was "unknown" and the person not editable. WisKey sends `null` there (the verdict's own docstring: "null = not applied yet"); the
  fixture does now.

Further drift of the editor and capture dialog since the specs were written, each settled the product's way (spec text only): the station
and reader lists of the capture dialog are `sw-dropdown`s (AUDIT30-H2; `ddValue` / `ddItems`), the editor's active flag is an
`sw-toggle` (HAND-SWITCH), a cancelled capture says "נשלח ביטול לקריאה" (what it knows: the cancel was SENT), an unknown outcome uses
the shared "לא ידוע אם בוצע · טענו מחדש…" and keeps WisKey's code in the attribute only (no codes on operator screens), and while a
write's outcome is unknown the server HOLDS the next write of that person (`intercom_outcome_pending`, nothing sent) - the spec now
asserts that hold (the strongest form of "never a retry") and tests the unexpected-shape answer on another person. Two more fixture
gaps: `system_info` listed only three read commands (the editor offers a save only when users/create | update | delete are listed:
`writes_listed`), and `users/create | update` refused WisKey round 3's `access_category` / `responsible_person` / `access_purpose`
(`invalid_fields` -> 422); the fixture now lists the writes it answers and takes and keeps the three fields.

## 3. The gate

`frontend/tests/fixtures/fixture_specs.json`: `evidence-media-players-live` (media_ma, media_sonos), `evidence-wiskey-people` /
`-editor` / `-capture` (wiskey) and `evidence-wiskey-people` (no_ha) are `"gate": true`; their `_why_not_gate` notes are gone.
`test_fixture_job.py` pins the new gate set and the two groups of the people spec. `docs/operations/RUNNER_FIXTURE_JOB.md` notes the
promotion. **Specs now in the gate (new):** evidence-media-players-live.spec.ts, evidence-wiskey-people.spec.ts (parts 1 and 2),
evidence-wiskey-editor.spec.ts, evidence-wiskey-capture.spec.ts. Still out: evidence-home-screen (the 18 px scroll, unchanged).

## Tests run (real results)

| What | Where / command | Result |
|---|---|---|
| `tests/test_media_groups.py` (incl. the new test) | runner, backend venv, one process | 22 passed (final head 4cbbb7d2d; it failed 1 at the first two attempts - the test first, then the static-group case it found) |
| `test_media_players_commands`, `test_media_players_api`, `test_bridge_media_players`, `test_media_commands`, `test_media_fake_ha` | runner, one process each (at 7694d7240, the same `ha_actions` change minus the static-group skip) | 20 / 23 / 17 / 59 / 75 passed |
| `tests/test_fixture_job.py` | runner | 16 passed (4cbbb7d2d) |
| ruff on the changed Python files | runner | All checks passed |
| `npm run -s typecheck` (tests + scripts) | runner | 0 errors |
| eslint on the four specs | runner | 0 errors, 4 warnings |
| `selftest_gate.py`, `selftest_engine_sync.py`, `selftest_gate_fast.py` | runner, from the branch tree | SELFTEST PASSED x3 (engine_sync: a missing `/tmp` manifest once, PASSED on the re-run) |
| `scripts/fixture_job.py` the four specs (iterations) | runner, slot B / priority | final: media_ma 49 passed / 0 failed, media_sonos 44 / 0, wiskey 22 / 0 (3 skipped: part 1), no_ha 5 / 0 (15 skipped: part 2 and the phone-only test on desktop) |
| **Fixture lane, every gate group** (`GATE_LANE=fixture GATE_RESULTS_DIR=~/work/p2520_stalespecs-lane python3 scripts/gate/release_gate.py pilot/STALE-FIXTURE-SPECS-2530 --tier L --no-visual`, the branch's own engine; nothing installed into ~/gate2) | runner at b9ba0cac7 | FAIL in 20 m: fixture 284 passed / 2 failed - `evidence-nvrless-cameras-2412` (mode b, plan editor camera placement, desktop + tablet), also in the retry; load 40.8. The four new specs: ma 49 / sonos 44 / wiskey 22 / no_ha 5, 0 failed |
| the `nvrless_cameras` group alone (`GATE_FIXTURE_GROUPS=nvrless_cameras`) | runner, at this head and at the base pilot/GATE-FIXTURE-LANE-2530 | PASS 23 / 0 on both: a load-sensitive spec, not this row |
| **Fixture lane, every gate group, final head** | runner at 4cbbb7d2d, same command | **PASS in 10 m: build 1 passed; fixture 286 passed / 0 failed / 0 flaky** (report `gate_pilot-STALE-FIXTURE-SPECS-2530_4cbbb7d2d.md`) |

NOT_RUN: a real release gate with this lane (the installed engine is not touched; it reads the groups from the worktree under test, so
the next tier-L gate of a branch carrying this JSON runs them); `fixture_lane.sh` itself (it takes the shared lock; the engine it runs was
run directly instead); the backend suite beyond the files above. On the PC: nothing ran (no venv there).

Runtime: the lane alone, 2 groups at a time, 10 m at the final head (was 7 m for the earlier gate set); the new groups cost
media_ma ~413 s, media_sonos ~413 s, wiskey ~258 s, no_ha ~128 s of slot time.

## Open questions (recommendation first)

1. `evidence-nvrless-cameras-2412` (mode b, the camera placement click) failed twice under heavy load (40.8) and passes alone at this head
   and at the base: (a) a follow-up row that waits for the canvas to be ready before the click [recommended]; (b) leave it; the gate's
   retry-alone already classifies it.
2. The stale `RUNNER_FIXTURE_JOB.md` line of GATE-FIXTURE-LANE-2530 (it calls the media spec a gate spec before it was): (a) leave it, the
   new paragraph above it is the record [recommended]; (b) rewrite it.

## Files

- `smplwise_vms/backend/smplwise/services/ha_actions.py` (product: `still_grouped_elsewhere`, used by `refresh` for `media_player.unjoin`)
- `smplwise_vms/backend/tests/test_media_groups.py` (the fake bridge's `room_only` unjoin; the new test)
- `frontend/tests/evidence-media-players-live.spec.ts`, `evidence-wiskey-people.spec.ts`, `evidence-wiskey-editor.spec.ts`,
  `evidence-wiskey-capture.spec.ts`
- `frontend/tests/fixtures/no_ha_backend.py` (new), `frontend/tests/fixtures/wiskey_fake_ha.py`, `frontend/tests/fixtures/fixture_specs.json`
- `smplwise_vms/backend/tests/test_fixture_job.py` (the gate set)
- `docs/changes/STALE-FIXTURE-SPECS-2530.md`

No UI change (no screen, no baseline, no compare page). Files of the 2.52 train rows: none touched.
