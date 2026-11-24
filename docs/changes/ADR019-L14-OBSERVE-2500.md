# ADR019-L14-OBSERVE-2500 - observing request base model (ADR-019 L14 step 1)

Branch `pilot/ADR019-L14-OBSERVE-2500` from origin/main `d6f09395e` (v2.48.0). Scope: L14 step (1) and step (2) for family 1 only. Does not touch `errors.py` / `client.ts` (L2 is in `pilot/ADR019-STEP0-2500`). No model flips to `forbid`.

## What changed

* `smplwise_vms/backend/smplwise/wire/request.py`: `RequestModel`, a request base in the style of `WireModel`.
  * `extra="ignore"`: production behaviour is unchanged, an unknown key is dropped as before.
  * A `model_validator(mode="before")` compares incoming keys with the model's field names and aliases (`alias`, `validation_alias`, `AliasChoices`). Per unknown key it logs one WARNING line per (model, key) per process (model and key only, never a value; the correlation id when there is one) and counts it. The table is bounded (500 pairs, then an overflow counter).
  * `SW_REQUEST_STRICT=1` raises instead (a 422 for a route, `ValidationError` in a unit test).
  * A subclass that sets `extra="forbid"` or `extra="allow"` has decided already and is not observed.
  * `counts()` feeds the `/health` diagnostics block (`request_unknown_keys`: distinct, total, overflow, top 20), diagnostics callers only.
  * `SW_REQUEST_OBSERVE_DUMP=<file>` (test aid, unset in production) appends `model<TAB>key` for every unknown key, also in strict mode.
  * Registered with `register_reset`, so tests start from an empty table.
* `tests/conftest.py`: `os.environ.setdefault("SW_REQUEST_STRICT", "1")`.
* `smplwise/routers/health.py`: the diagnostics key above.

## Step 2, family 1 (calendar, transit, notices, emergency, maintenance, temperature, insights, generator)

Finding: nothing to adopt. An AST scan of every pydantic model under `smplwise/` that belongs to these families (router and service modules, direct and via the `_Body` bases) shows all request models are already `extra="forbid"`. The only exception is `routers/calendar.py` `Body`, `extra="allow"` by design (free-form, the module validators refuse unknown keys), which ADR-019 D2 keeps. So no model changed in this family. The 134 tolerant web-UI models counted by the ADR are in other families. Tolerant models in the door family that the next steps will meet: `routers/door_windows.py` `CalendarDay`, `CalendarBody` (not touched here).

## Tests

| Test | Where | Result |
|---|---|---|
| `tests/test_request_model_observe_2500.py` (log once per model and key, counter, strict raises, forbid/allow not observed, bounded table, dump file, conftest sets strict), plus `tests/test_singletons_registered.py` and `tests/test_health_process_stats.py` | test server, slot B | PASS (exit 0) |
| ruff on the changed files | PC | PASS |
| Full backend suite, 6 shards by file, `-m "not timing_lane"`, `SW_REQUEST_STRICT=1`, `SW_REQUEST_OBSERVE_DUMP` set | test server (`~/work/adr019b_run.sh`) | IN PROGRESS at hand-off (shard 0 of 6 at about 2%); not complete, so NOT_RUN to completion |

Final outputs land in `~/work/adr019b-out/` on the server: `summary.log` (one line per shard with its exit code, then `DONE`), `shard_0N.log` (failures via `-rf`), `dump.tsv` (every unknown model and key). The lead appends the final results below. Failures caused only by strict mode are findings, not blockers; if the whole suite cannot pass, set strict per family and say so.

## Unknown keys the tests send (input for L14 step 3)

PARTIAL, at hand-off: no real model/key pair yet. The only lines in `dump.tsv` so far come from the base model's own unit tests (`_Plain`: `extra_key`, `k0`-`k5`, `other`, `ssid_hash`). Replace this section with the final `sort dump.tsv | uniq -c` once `summary.log` says `DONE`.

## Known limits, rollback

* In strict mode a refused request can hide a second extra key later in the same test; the dump still lists every key of the refused request.
* Rollback: revert the commit; no data, API shape or permission changes (the only visible addition is the `/health` diagnostics key).
