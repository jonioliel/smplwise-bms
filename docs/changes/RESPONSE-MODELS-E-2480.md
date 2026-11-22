# RESPONSE-MODELS-E-2480 - the response-model ratchet, ExactModel, and response models for the next routers

Branch `pilot/RESPONSE-MODELS-E-2480`, base `origin/release/2470-train` (`2c211966d`). Target 2.48.0. Code review 07:F8 step 2
(MASTER_PLAN 3.6), the row after CR-RESPONSE-MODELS-C-2470 / -D-2470. No route, status code, key, value or number type changed; no
migration; no version bump; no frontend behaviour change (generated type files only); no pixel change expected.

## What changed

### 1. The ratchet: "every JSON route has a model" (`scripts/wire_ratchet.py`, `tests/test_wire_ratchet_2480.py`)

- Walks the application's own route table (`create_app` with the settings of `scripts/api_inventory.py`, so Step-mounted, root and
  developer-only routes count), and counts per router module (the module that defines the handler) the routes that declare no wire
  model. Modelled = `**wire(Model)` with `exclude_unset`, or a model documented with `responses=` (what `gen_wire_types.py` reads).
  Not counted: routes in the wire module's `NO_JSON` (no JSON body: file, picture, stream, 204, download).
- Baseline `scripts/wire_ratchet_baseline.json` (sorted per router, so parallel rows merge line by line). The check fails when a count is
  ABOVE its baseline (a new route without a model, a removed model, a new router) and also when it is BELOW (lower it with `--update`
  in the same change), so the count can only go down. `--list [ROUTER]` prints what is left.
- The test also checks that the baseline is sorted and consistent, that `NO_JSON` entries name real routes, and that a fake new
  unmodelled route (new router, or a router already at zero) fails the check.
- Base count: 1215 unmodelled JSON routes in 146 router modules (of 1902 HTTP routes).

### 2. `wire.ExactModel` (strict mode)

The models of this row derive from `ExactModel` (pydantic strict mode, otherwise WireModel): a value of another type than declared is
drift (strict tests: refused; installation: the object goes out exactly as the route built it, logged once), never a silent
conversion (`2.0` -> `2`, `1` -> `true`, `"5"` -> `5`). Numbers are declared `Num` (int | float): TypeScript sees `number` either way and
an int / float difference can never drift. This is what makes models drafted from recorded answers safe for the wire.

### 3. Method

1. A shape recorder (scratch pytest plugin, not committed) wrapped FastAPI's `serialize_response` and merged, per route, the JSON shape of
   every answer the tests received (keys present always / sometimes, value kinds, nesting), and the drift the wire models logged.
2. A drafter turned the shapes into `ExactModel` classes per route (keys always present = required; sometimes = default `None`, absent
   under `exclude_unset`; id-like / HA-domain keyed objects, stored documents and deep nesting = `dict[str, Any]`), read against the
   router code; the routes were decorated with `**wire(W.Model)`.
3. The routers' suites ran again with the models in a "loose" pass (`SW_WIRE_STRICT=0`, the oracle on, drift captured), the models were
   redrafted from all the answers seen, and the final pass ran strict (`SW_WIRE_STRICT=1`, the default of the suite).
4. A JSON route no test answers successfully (or that answers something other than one object) is NOT modelled from the code alone: it
   is listed in the wire module's `UNMODELLED` and stays counted by the ratchet. `tests/test_wire_routers_d_2470.py` and the new
   `tests/test_wire_routers_e_2480.py` accept that list (and fail on a stale entry).

### 4. Routers modelled

(filled below)

## Tests actually run

(filled below)

## Risks

(filled below)

## Open questions

(filled below)
