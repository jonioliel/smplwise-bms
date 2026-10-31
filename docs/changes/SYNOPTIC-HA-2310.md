# SYNOPTIC-HA-2310 - the cross-section / synoptic map read every home-system floor, and a clean section panel

Owner report (31.10): on his system the synoptic map and the building cross-section showed "אין מידע מהקומה" and "-" on every floor although
the home system has areas with devices on each floor (the home screen shows them). Cause: `areasOfFloor` (frontend/src/xsection/xs-model.ts)
matched our floor to the home system only through map-linked areas or an identical floor NAME; his floors ("קרקע", "קומה -1", "קומה -2")
and the home-system floor names differ, so nothing matched.

## Model - aligned with docs/changes/PROPOSAL-MULTI-BUILDING-HOME.md (branch pilot/MULTI-BUILDING-HOME-PLAN, not merged)
Generic mapping rows keyed by the PLATFORM id -> our floor id (migration `0186_home_links.sql`, provisional number):
- layer 1 `home_floor_links(ha_floor_id PK, floor_id)` - one row per home-system floor (several may point at one of our floors);
- layer 2 `home_area_links(area_id PK, floor_id NULL)` - per-area override: our floor, or NULL = taken off every floor ("לא משויך");
- layer 3 map placement - the plan room's own area link (`spatial_zones.ha_area_id`, 0056), not stored here; it wins over 1 and 2.
Our floor already belongs to a building, so a building level can be added later without migrating the rows.

Resolution per AREA (xs-model `matchFloors`): map placement > area row > the floor row of its home-system floor > automatic for a
home-system floor no row names: the same `level` only when exactly ONE home-system floor has that level, exactly one of the building's
floors has it AND the site has one building; the same name only on exact normalized equality (direction marks / spaces / dashes / maqaf
folded, never a substring), unique on both sides, one-building site. Everything else is a SUGGESTION the user confirms (a level or name on a
multi-building site, the home-system floor most of a floor's map-placed areas sit on) - never applied silently. Unresolved = no data and
the hint says "לא משויכת". ALL areas of a home-system floor count, not only the ones placed on a map - the same floors -> areas projection
the home screen draws (`getDevicesTree`).

## Where the owner edits it
Floors screen (Explore > building > Floors): select a floor > "קישור למערכת הבית"; also the "לשיוך הקומות" link of the hint under the
cross-section, and the synoptic map's hint / per-floor "קישור" (they open `#/explore/buildings/<id>/floors?ha=<floor>`). The dialog: the
floor's home-system floors (by hand, or "אוטומטי · לפי מפלס/שם"), a suggestion with "אישור ההצעה", assign another floor ("now on <floor>"
when another floor holds it); the floor's areas with their source (ידני / קומה שנקבעה / מפה / מפלס / שם), remove (an area the floor brings
becomes "לא משויך"; one added by hand returns to automatic), restore, add any area (grouped by home-system floor), "חזרה לאוטומטי". The lists
are computed live with the same matching.

## API
`GET /home-links` -> `{floors: [{ha_floor_id, floor_id}], areas: [{area_id, floor_id|null}]}` (rows of floors the caller may read;
an unassigned area row names no floor and is always listed). `PUT /floors/{floor_id}/home-link` `{ha_floor_ids?: [...], areas?: {area_id:
include|exclude|auto}}` - `site.content.configure` on the floor AND on every other floor a row is taken from; unknown ids 422 (except ids
already in a row); audited `floor.home_link`. contracts/API_INVENTORY.md regenerated (+2 routes).

## Cross-section panel (sw-xsection)
Beside the floor cards each row takes its card's top and height (measured, ResizeObserver), so a card and its row are one line; the panel
loses its card chrome there (the rows are wells like the cards) and the title, totals, hint and legend sit under the rows. No empty top band
(rows no longer bottom-aligned), no selection notch, no shaft header icon, no lone shaft dot (a shaft needs two floors), no label on the
ground line, one border treatment for every row. A floor without data draws no facade, chip or "-": its second line says why once, or
"אין נתונים" when the density hides that line. The floor cards give way inside the page height (at 12 floors they ran under the action row
before). Phone tiles / compact card: no empty facade, no stripes. Synoptic: the row's second line names the home-system floor and how; with
many floors (rows too short for two lines) the selected floor's detail line carries it.

## Demo switches (static build only)
`?xsdemo=1..40`, `?xsdata=ha` (the real matching against a synthetic tree: level / name / one unassigned floor), `?xsdata=none` (nothing
matches), `?xsnames=long`. Evidence: docs/evidence/SYNOPTIC-HA-2310/{before,after}/ (frontend/tests/evidence-synoptic-ha-2310.spec.ts).
