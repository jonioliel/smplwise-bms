# MAPPING-ASSIST-2330 - the mapping assistant ("which home-system name belongs to which of our buildings") and the multi-building switch

Owner approval 31.10 of the round-10 mockup v3 (`private/design-system-2026-10-27/round10/mapping/index.html`, `mapping3.js`, `answers.html`)
with answers 1A, 2A, 3A, 4A, 5C, 6A, and the owner requirement of 31.10 that multi-building is OFF by default and switched on explicitly.
Branch `pilot/MAPPING-ASSIST-2330` on top of `pilot/MULTIBUILDING-HOME-2330` (2.31.0 train + the site level). No merge, no runner, no live
actions; nothing is ever written to the home system.

## Owner answers -> behaviour
| Answer | Behaviour | Setting (all changeable behaviours are settings) |
|---|---|---|
| 1A remember the token table | The table "סימון ← בניין" is stored server-side; a new name with a known mark is placed by it | - |
| 2A floor inheritance | An area without a mark on a floor of a clear building goes with its floor ("לפי הקומה") | `floor_inherit` on / off, default on |
| 3A new names wait for "אשר" | Health card "N שמות חדשים - אשר N" (settings) + a chip in the home's site bar; with auto-insert the placed ones go in by themselves (kind `auto`) | `auto_insert` off / on, default off |
| 4A mark without a building | Offered "בניין חדש" first, then an existing building, then "לא משויך" | `new_token` new_first / existing_first / unassigned_first, default new_first |
| 5C merge | Choose the same building in two rows (the second is "מאוחד") AND drag a row's grip onto another row | - |
| 6A build order | slice 1, slice 2, slice 3 below, one commit each | - |
| 31.10 multi-building off by default | `home.multi_building.enabled` gates the whole site level | installation setting, default off |

## Slices
1. **First question + token table + summary/apply + the switch.** `frontend/src/api/mapping-engine.ts` (pure, the mockup's tokenizer / rule engine
   ported to TypeScript): `tokenize` per position (start / end / label / word inside) x separator chips (" · ", "-", ":", space, custom "אחר…";
   a "-" that is a minus sign - "חניון -1" - is not a separator) x token kind (letter / number / word / anything up to the separator); `detect`
   (the live "%" with "N מתוך M", separator counters, token stats and samples); `suggestSpec` (pre-selects the reading that explains the most
   names; ties: fewer distinct, then shorter marks); the table (`tableRows`, existing buildings matched by name, merge, hand-added tokens);
   `resolve` (manual > ordered rules > floor > nothing; conflicts stay OPEN with a recommended answer); `summarize`; `buildPlan` (rows of the
   existing mapping: layer-1 floor rows - our floor of the same level, else the same name, else a new floor; layer-2 area overrides; area ->
   building rows where none of our floors fits; open items are left as they are; a "new" building that exists by now is not created twice).
   UI: `<mapping-assistant>` (full-screen sheet, lists scroll inside their panels) and `<system-mapping>` = הגדרות › כללי › **בניינים ומיפוי**
   (switch "הפעל ריבוי בניינים", the buildings as the mapping reads them, versions with "חזרה לגרסה זו", the three settings, "פתח את האשף",
   "מתקדם"); the setup wizard shows the same page in its compact form as "שלב רשות · בניינים ומיפוי". A site with one building collapses to
   the existing per-floor "קישור למערכת הבית" dialog (SYNOPTIC-HA-2310), with a way into the assistant. After a successful apply the done
   screen offers "הפעל עכשיו את תצוגת ריבוי הבניינים" (explicit; audited by the switch route) when the view is off.
2. **Exceptions + health.** `screens/mapping-decide.ts`: only the exceptions, one plain question each with big buttons (the highlighted one is
   what the system would choose), "נשארו N החלטות" with a bar, "השאר את כולם לא משויך לעכשיו", the answered list with "שנה". A question about a
   mark answers the table for every name that carries it; any other answer is a manual decision (beats every rule forever).
   `screens/mapping-health.ts`: the settings health card and `<mapping-health-chip>` in the home's site bar (configurer only, only with
   something new since the last apply).
3. **"מתקדם".** `screens/mapping-rules.ts`: ordered sentence rules - "לפי טבלת הסימונים", "השם מתחיל ב-", "השם מסתיים ב-", "השם מכיל",
   "התווית היא", "ביטוי רגולרי" (a fixed building, or the first group through the table) - mixed freely, a live counter per rule, priority by
   dragging the grip (or the arrow keys on it), on/off, delete. Every rule / table change reports how many manual answers it would have
   changed ("השינוי היה משנה N החלטות ידניות - הן נשארות").

## Multi-building switch (owner 31.10)
`home.multi_building.enabled` (`on` / `off`, default **off**), read by everyone as `home.multi_building` in GET /settings (read-only there),
written only by `PUT /home/multi-building` (site.content.configure on every live site; audited `home.multi_building`). Off = the exact
one-building home: `devices-building` does not even read the catalogue / rows for the site level, so the MULTIBUILDING-HOME-2330
pixel-identity guarantee holds; the mapping data is kept. Also gated: the site entry / shared rows of Settings > home screen, my screen's
site choices and "הסתר משותף", and the "בניין משותף" check of the building edit. The assistant itself works while the view is off.

## Server (no engine on the server; it checks and stores)
Migration **0189_home_mapping.sql** (next free after 0188): `home_area_buildings` (area -> building rows of the site level),
`home_mapping_state` (state + settings + revision per site), `home_mapping_versions` (state, rows before / after, items seen, summary).
`routers/home_mapping.py`:
| Route | What |
|---|---|
| GET `/sites/{site_id}/mapping` | state, revision, settings, multi_building, can_toggle, versions, items seen by the last apply, platform floors / areas (registry), our buildings + floors, the site's rows |
| PUT `/sites/{site_id}/mapping/state` | the draft (revision check, 409 when stale), audited `home.mapping.state` |
| PUT `/sites/{site_id}/mapping/settings` | the three settings, audited `home.mapping.settings` |
| POST `/sites/{site_id}/mapping/apply` | one transaction: checks every id first (422, nothing written), creates new buildings / floors (audited `building.create` / `floor.create` with `via`), writes layer-1 / layer-2 / area->building rows, stores the state, records a version (`apply` / `confirm` / `auto`), audited `home.mapping.apply` |
| POST `/sites/{site_id}/mapping/versions/{n}/restore` | "חזרה לגרסה זו": a new version (`restore`) with version n's rows and state; this site's rows only; nothing deleted; audited `home.mapping.restore` |
| PUT `/home/multi-building` | the switch (see above) |
GET `/home-links` gains `buildings` (area -> building rows the caller may read); `api/home-site.siteModel` consumes them (an area outside our
floors counts in its building, `SiteBuilding.loose`; a floor match always wins). Permission everywhere: `site.content.configure` on the site
(the permission that creates buildings / floors and links floors).

## Demo
Static demo with the mockup's synthetic tree (169 names: 28 floors, 141 areas, the messy cases) in `api/mapping-demo.ts`, an in-memory store
in `api/mapping.ts`: `?mb=1` the view on, `?mb=off` four mapped buildings with the view off (the home shows one building), `?mbmap=applied`
mapped once already with three names new since. Settings page: `#/system/diagnostics?tab=buildings`.

## Tests (run 31.10 on the workstation, one worker)
- `npx tsc --noEmit`: clean.
- Unit `tests/unit-mapping-assist-2330.spec.ts`: 13 passed (tokenizer per position / separator / kind, detection %, table + merge, floor
  inheritance + its setting, exceptions, 4A order, rule priority / mixed kinds / regex group, manual wins + impact count, the plan incl.
  no double creation, health + "אשר" subset, state read-back, the site level consuming area -> building rows). With home-site-2330,
  home-screen-295, xs-floor-match: 47 passed.
- Evidence `tests/evidence-mapping-assist-2330.spec.ts`: 9 tests x desktop / tablet / mobile = 27 passed (off by default with 4 mapped
  buildings = no site UI; switch on / off; the first question 96% and live recompute; the table + merge; exceptions -> summary -> apply ->
  version 1 -> explicit switch offer; versions + restore; health + "אשר" + home chip; advanced rules + keyboard priority; dark). Each step's
  sheet fits the viewport, no horizontal overflow. Screenshots `docs/evidence/MAPPING-ASSIST-2330/`.
- Backend `tests/test_mapping_assist_2330.py` (8): defaults + registry items, state / settings round trip + 409, apply (rows, new building /
  floor, version, audit), validation writes nothing, restore, deleted building rows hidden, switch off by default + audited + permission,
  every route 403 without the site-configure permission. `test_home_links.py` updated for the `buildings` key. Targeted run
  (test_mapping_assist_2330 + test_home_links + test_multibuilding_home_2330 + test_home_screen_options_295): 27 passed, 0 failed.
- A wider backend run (`-k "catalog or building or site or migration or schema or prefs or home or settings or mapping or setup"`) reached
  1 failure: `test_setup_wizard.py::test_a_slow_device_is_cut_off_at_the_check_deadline` (a wall-clock assertion: 5.28 s vs < 5 s on the
  loaded workstation; the setup-wizard backend is not touched by this branch). The same selection re-run later: 1164 tests, 1154 passed,
  10 skipped, 0 failed (the timing test passed on the quieter machine).
- Pixel identity: the MULTIBUILDING-HOME-2330 evidence spec re-run on this branch (21 passed); the one-building home screenshots are
  identical to `before/` on all three projects (sampled pixel compare, 0 differences).

## Not done / limits
- Labels: the home system's labels are not synced into our registry (`ha_areas` has no labels), so on a real site "בתווית" explains 0% and
  label rules / label conflicts only work in the demo data. Syncing labels is a follow-up.
- Auto-insert (3A setting on) runs when a configurer opens the settings page (no background job; the engine is client-side).
- A platform floor with no level and no number in its name lands on a new floor of level 0 (no "which floor?" question yet).
- The health chip on the home appears only with the multi-building view on (it lives in the site bar).
- Restoring a version does not delete buildings / floors created after it (by design: nothing is deleted).
- Adding the "בניינים ומיפוי" settings tab adds one tab to the settings strip; pixel baselines of the settings header may need a refresh on
  the runner (not run here).
