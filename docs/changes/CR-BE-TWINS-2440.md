# CR-BE-TWINS-2440 - the twin helpers of electricity, water and temperature are one

Branch `pilot/CR-BE-TWINS-2440`, based on `origin/pilot/CR-WAVE2-COMBINED-2439` (`4e52e5e4a`). Code review 2026-11-13,
MASTER_PLAN section 3.4 row `CR-BE-TWINS-2436`: report 04 F20, F27 (`ha_sync`) and the adoption of theme T7 (the common
validation-error base) in these files. Behaviour is identical: every name stays where it was, with the same answers.

## What changed

| Finding | Change |
|---|---|
| 04:F20 | `services/ha_sync.py` gains `connected()` (`bool(STATE.connected)`). The six copies - `elevators.mirror_connected`, `temperature.mirror_connected`, `messaging_runtime.ws_connected`, `energy_sampler._connected`, `generator_runtime._connected`, `water_sampler._connected` - keep their names as functions in their modules (tests and callers replace them there) and return `ha_sync.connected()`, still looked up at call time. |
| 04:F20 | `water_meters._attrs` is `energy_meters._attrs` (the energy side owns it, as water already does for billing). |
| 04:F20 | `energy_meters.epoch_to_iso` and `water_meters.epoch_to_iso` are `timeutil.iso_from_epoch_or_none`: the same text for every input (table test). |
| 04:F20 | `water_settings.store` is `energy_settings.store`. |
| 04:F20 | `_ts` of `temperature_explain`, `temperature_runtime` and `water_runtime` is the new `timeutil.epoch_or_none`. |
| 04:F20 | `_rec_of` of `temperature_alerts` and `water_alerts` is the new `notify_recipients.as_lists`. |
| 04:F27 (`ha_sync`) | The one broad handler in `ha_sync.py` that left no trace (`_note_connect_gap`, the read of the last seen state) now logs at debug with the traceback. The other 29 broad handlers in the file already log or re-raise (checked by AST: no broad handler without a log call or a raise remains). |
| T7 (04:F16) | `temperature.Invalid`, `temperature_alerts.AlertsInvalid` and `water_alerts.AlertsInvalid` subclass `errors.ServiceInvalid`. Constructor, attributes, `str()` and `args` are unchanged (they call `ValueError.__init__` with the code, as before), they are still `ValueError`s, the two `AlertsInvalid` stay two separate classes, and the routers still build the 422 envelopes themselves (router side: programme 3.6, lead decision L2). |

Not merged on purpose: `list_rows` of `energy_meters` / `water_meters`. The two bodies are the same text but each reads its own
module's `AREA_SQL` (different tables), so one function would need a parameter and every caller a change - no gain.
`energy_settings.py` is in the row as the owner of `store`; it is unchanged.

Unused imports that the aliases left behind were removed in the same files (`datetime` in the two meter modules, `parse_utc`
in the three `_ts` modules, `set_setting` in `water_settings`); no other module or test reads those names from there (searched).

## Resolved file list

Row files edited: `services/ha_sync.py`, `energy_meters.py`, `water_meters.py`, `water_settings.py`, `elevators.py`,
`energy_sampler.py`, `generator_runtime.py`, `messaging_runtime.py`, `temperature.py`, `water_sampler.py`,
`temperature_explain.py`, `temperature_runtime.py`, `water_runtime.py`, `temperature_alerts.py`, `water_alerts.py`.
New: `tests/test_be_twins_2440.py`.

### Outside my rows

| File | Change | Why |
|---|---|---|
| `services/timeutil.py` | new `epoch_or_none(iso)` (additive) | the shared home of the three `_ts` copies; a time helper belongs with T9's module, not in one of the three feature modules |
| `services/notify_recipients.py` | new `as_lists(rec)` (additive) | the shared home of the two `_rec_of` copies; both alert modules already import this module (T4) |

Neither file is held by another 3A branch.

## Tests (workstation, Windows, Python 3.12 venv, `-p no:xdist`)

TESTS_PLACEHOLDER

`ruff check` (rule set F) on the 17 touched source files: clean before and after.

NOT_RUN locally: the full backend suite - left to the combined branch's entry check. No router changed, so the API inventory
is not affected.
