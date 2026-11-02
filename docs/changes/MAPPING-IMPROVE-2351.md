# MAPPING-IMPROVE-2351 - "קומות ללא מפלס" and auto-insert in the background

Branch `pilot/MAPPING-IMPROVE-2351` from `release/2350-train`. Closes two limits listed in `docs/changes/MAPPING-ASSIST-2330.md`
("Not done / limits"). No version bump, no migration, no new route; nothing is ever written to the home system.

## 1. "קומות ללא מפלס" - a floor with no level is asked about
Before: a home-system floor with no level and no number in its name landed silently on a NEW floor of level 0 (`buildPlan` fallback).

Now:
- `api/mapping-engine.ts`: `MappingState.levels` (platform floor id -> `{t:'level', level}` | `{t:'floor', id}` ("זהה לקומה קיימת") |
  `{t:'skip'}`), read back by `stateOf` through `levelAnswerOf` (junk dropped, level -50..300). `buildPlan(..., levels, asked?)` follows the
  answer; `levelQuestions()` lists the floors that would reach the fallback (no level of their own, none in the name, no existing row in the
  building, no existing floor of the same name). Unanswered or skipped = exactly the behaviour before (a new floor of level 0). A "same as"
  answer naming a floor of another building is ignored.
- `screens/mapping-assistant.ts`: a step "קומות ללא מפלס" between the decisions and the summary, shown only when such floors exist. One row per
  floor: the name, its building, a picker - "זהה לקומה קיימת" (that building's floors), "מפלס לקומה חדשה" (-5..60), "דלג - מפלס 0, כמו היום".
  "המשך לסיכום" waits for every answer; "דלג - מפלס 0 לכולן" records `skip` for the rest. The answers are saved with the draft between steps
  (PUT state, revision check) and stored in every version's state like the other answers ("חזרה לגרסה זו" brings them back).
- Health card: a new floor still waiting for its level is never in "אשר"; it counts as "needs a decision" and opens the assistant
  (`levelWaiting`, `health(..., waiting)`).
- `subsetPlan` (the "אשר" subset) now carries only the new buildings / floors its rows name. Before, every new building / floor of the whole
  plan went along with a confirm (a latent bug: a confirm of two areas could create an unrelated building).

## 2. Auto-insert in the background
Before: with `auto_insert` on, new names went in only when a configurer opened the settings page (the engine ran in the browser).

Now `services/mapping_auto.py` (with `services/mapping_engine.py`, a port of the browser engine's resolution: tokenizer, token table, ordered
rules, manual answers, floor inheritance, plan, level answers) runs:
- after every home-system registry refresh that changed the mirror (`ha_sync._refresh_and_notify`, in the executor, off the event loop);
- once at startup (`main.py`, a daemon thread; `SW_MAPPING_AUTO_STARTUP=0` turns it off - the tests do).

Rules:
- Only sites with `auto_insert` on that were applied at least once ("new" = not in the last version's items).
- Only new names the stored rules place with no open question. A floor without a level and without a "קומות ללא מפלס" answer is not placed and
  its areas do not inherit from it meanwhile.
- Never moves what the user placed: a new name that already has a row (floor row, area row, area -> building row) is left as it is and stays
  "new" on the health card. The job only INSERTS rows (`ON CONFLICT DO NOTHING`), never updates or deletes.
- Write gate: all reads in one read transaction; the engine runs with no transaction open; each site's write is one short IMMEDIATE
  transaction that re-checks the snapshot (last version number, settings, state, the rows, our floors / buildings) and writes nothing on any
  change - the next refresh recomputes. No network I/O in the module. One run at a time per process.
- Each write is a version of kind `auto` (summary `auto_added`, `auto_areas`, `auto_floors`, `kept_manual`, `reason`, row counts) and an audit
  row `home.mapping.apply` (actor: the system; details `kind: auto`, `added`, `kept`). New buildings / floors the plan needs are created like
  the assistant does, audited `building.create` / `floor.create` with `via: home.mapping.auto`.
- Idempotent: a second run finds nothing new and writes nothing.
- The health card shows "נוספו אוטומטית N אזורים" (and "ו-M קומות" when floors went in too) for the `auto` versions at the head of the list
  (`autoAdded` / `autoNoticeText`). The browser no longer auto-inserts against a server; the static demo (no server) still does.

## Tests (run 02.11 on the workstation, one worker)
- Backend `tests/test_mapping_improve_2351.py` (9): engine port parity (marks, levels, resolution, manual wins, floor inheritance + its
  setting), the levels engine (ask / level / same-as / skip / normalization), the pruned subset, level answers persisted in the state and
  restored with a version, the job (places new names once, idempotent, version + audit + `via`), no override of manual placement (three kinds of
  rows untouched), waits for a level answer and respects the setting, skips a never-applied site, a stale snapshot writes nothing.
- Targeted run with the neighbours: test_mapping_improve_2351 + test_mapping_assist_2330 + test_home_links + test_multibuilding_home_2330 +
  test_ha_structure_refresh + test_gate_hygiene + test_db_gate + test_db_io_guard: **241 passed, 0 failed**. The mapping files also passed
  under `SW_DB_IO_GUARD=1` (findings: none).
- Unit `tests/unit-mapping-improve-2351.spec.ts`: 6 passed; with `unit-mapping-assist-2330.spec.ts`: 19 passed.
- `npx tsc --noEmit`: clean. `scripts/release_check.py`: ready. `frontend/scripts/lazy-tags-check.mjs`: OK.

## NOT_RUN
- Evidence / pixel specs on the runner (`evidence-mapping-assist-2330.spec.ts` and the settings header baselines): not run (workstation low on
  memory, runner busy with release gates). The demo data has no level-less floor, so the 2330 evidence flow should not meet the new step.
- A live structure refresh against the lab home system (no device access in this task).

## Limits
- Turning `auto_insert` on does not run the job by itself; it runs at the next structure refresh or restart.
- ~~Labels are still not synced from the home system (unchanged; the server port ignores label rules exactly like the browser on a real site).~~
  2.36.0 train: with HA-LABELS-SYNC-2351 merged, the job reads the label mirror (`mapping_auto._snapshot` through
  `home_mapping._labels`), so label rules and label conflicts give the same answer as the browser
  (`test_job_reads_the_synced_labels_like_the_browser`).
