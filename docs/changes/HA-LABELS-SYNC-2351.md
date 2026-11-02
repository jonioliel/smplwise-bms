# HA-LABELS-SYNC-2351 - the home system's labels synced into Arx (read-only) for the mapping assistant

Follow-up of MAPPING-ASSIST-2330 ("Not done / limits": "בתווית" explained 0% on a real site because `ha_areas` had no labels; label rules
and label conflicts only worked in the demo). Branch `pilot/HA-LABELS-SYNC-2351` from `origin/release/2350-train`. No version bump, no merge,
no runner, no device / HA access. Nothing is ever written to the home system.

## What changed
| Layer | Change |
|---|---|
| Migration **0192_ha_labels.sql** (next after 0191; sequence contiguous 0001-0192; on the 2.36.0 train 0193_calendar_feed_review follows, WisKey must move to 0194+) | `ha_labels` (label_id, name, color, icon, description, position), `ha_area_labels` (area_id, label_id, position - an area's labels in its own order), `ha_label_sync` (one row: when the label registry was last listed; NULL = never) |
| `services/ha_sync.py` | The registry refresh also lists `config/label_registry/list` (non-admin in HA; a refusal / old core = `None` = the label mirror is kept, like a failed floor listing). `apply_structure(conn, areas, floors, labels=None)` rewrites `ha_labels` when given, and rewrites `ha_area_labels` together with `ha_areas` from the area listing's `labels` (label ids). `label_registry_updated` joins `REGISTRY_EVENTS` (it is on HA's non-admin subscribe allow-list); a changed assignment already fires `area_registry_updated`. `mirror_fingerprint` covers both new tables, so a rename / recolour / assignment change sends `structure_changed` |
| Write rules | All HA calls are made before `_apply`; the label rows are written in the existing short `_structure` transaction (durable=False mirror write, `_busy_retry`, under `mirror_lock`) - no network I/O inside a transaction (tested) |
| `routers/ha.py` (developer seed `POST /ha/dev/registry`) | Optional `labels` listing (omitted = keep the label mirror) |
| `routers/home_mapping.py` GET `/sites/{id}/mapping` | `items.areas[].labels` = the area's label **names** (what the engine's rules compare; an id the label table does not know is skipped), `items.labels` = the registry `{id, name, color, icon, areas}`, `items.labels_synced_at` |
| `frontend/src/api/mapping.ts` | Types for the new keys; `MappingData.haLabels` (null when never listed - "not read" is not "no labels"); the demo builds its label registry from its areas |
| `frontend/src/api/mapping-engine.ts` | `labelPointsTo`, `labelCoverage` (areas, labelled, placed by a label, per label: areas / by label / agrees / differs, the building it points to), `labelCoverageText` |
| `frontend/src/screens/mapping-health.ts` | The health card gains one line on the coverage by label ("תוויות: 4 מתוך 5 אזורים מסומנים בתווית - …; N משויכים לפי התווית; ב-1 התווית מצביעה על בניין אחר מהשם"), also before the first apply (a quiet "תוויות ממערכת הבית" card - previously no card at all before an apply) |

No new route, no new permission (the GET route keeps `site.content.configure`), no setting.

## Tests (run 02.11 on the workstation, one worker / one process)
- Backend `tests/test_ha_labels_sync_2351.py` (7, the real HaSync session against the fake HA of test_ha_structure_refresh with a label
  registry): list + store + read by the assistant (names in area order, counts, synced time); an assignment change and a rename arriving by
  `area_registry_updated` / `label_registry_updated` (one notice each); deletion (a stale id skipped on read, then gone); an idempotent
  resync (identical rows, "no change", no notice); an old core refusing the label listing keeps the label mirror; no HA call while a write
  transaction is open (counted around `db.connection`); `apply_structure` keeps labels when not given. **7 passed.**
- `tests/test_ha_structure_refresh.py`: one test's `apply_structure` stand-in took the old 3-argument signature - updated to pass `labels`.
- Targeted backend run (test_ha_labels_sync_2351, test_ha_structure_refresh, test_mapping_assist_2330, test_devices, test_plan_area_links,
  test_home_links, test_db_template): **111 passed, 0 failed, 0 skipped**. The full backend suite was not run (workstation memory): NOT_RUN.
- Frontend unit `tests/unit-ha-labels-2351.spec.ts` (6, on a server-shaped answer): `toData` + registry presence, "התווית היא" rules
  (priority, exact name), the token table read from labels, a name-vs-label question, coverage numbers + sentence, not-synced vs no labels.
  With `unit-mapping-assist-2330`: **19 passed**.
- `npx tsc --noEmit`: clean. Lints: unit-token-lint, unit-menu-lint, unit-a11y-polished-lint 24 passed; `scripts/lazy-tags-check.mjs` OK.
- NOT_RUN: the browser evidence / pixel specs (no local vite on this workstation; the runner runs release gates). The new pre-apply
  label card changes the settings "בניינים ומיפוי" page before an apply: the MAPPING-ASSIST-2330 evidence screenshots / any pixel
  baseline of that page may need a refresh on the runner. Not checked against a real home system (no HA access in this task).

## Limits
- Areas only. Device and entity labels (in the device / entity registry listings) are not stored; the mapping assistant reads areas and
  floors, and HA floors carry no labels.
- A label deleted in HA is removed from its areas by HA's own area registry; until that refresh the stale id stays in `ha_area_labels` and
  is skipped on read.
- Auto-insert still runs only when a configurer opens the settings page (unchanged).

## Rollback
Revert the branch commits. Migration 0192 only adds tables; an older build ignores them (no column of an existing table changes).
