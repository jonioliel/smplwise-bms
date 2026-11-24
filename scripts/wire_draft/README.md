# wire_draft - drafting wire models from recorded answers

The method used by RESPONSE-MODELS-E-2480 to model 299 routes. About 900 JSON routes are still unmodelled
(`python scripts/wire_ratchet.py --list`); later rows model them router by router with these tools.
All tools take the repo root as first argument and keep intermediate files in `$WIRE_DRAFT_DIR`
(default: `<tmp>/wire_draft`); nothing is written to the repo except by `apply.py` and `register.py`.

1. **Record** (`shaperec.py`): a pytest plugin that wraps FastAPI's `serialize_response` and merges, per route, the JSON shape of
   every answer the tests receive (keys always / sometimes present, value kinds, nesting). It also captures the drift messages the wire
   models log. Run the router's tests (or the whole backend suite, in shards) with
   `cd smplwise_vms/backend && SHAPEREC_DIR=<dir> PYTHONPATH=<this dir> python -m pytest -p shaperec -p no:cacheprovider <test files>`.
   `pick.py <repo> <n> <router>...` lists the n test files that call a router's paths most.
2. **Draft** (`draft.py <repo> <router module> <shapes dir>...`): writes `$WIRE_DRAFT_DIR/<router>.py` (`ExactModel` classes; keys that
   are always present are required, sometimes-present keys default to `None`; id-like or HA-keyed objects, stored documents and deep
   nesting become `dict[str, Any]`; numbers are `Num`) and `<router>.map.json` (function -> model | `NO_JSON` | `SKIP:<why>`).
   Read the draft against the router code and hand-correct it. A JSON route no test answers successfully is NOT modelled from the code
   alone: list it in the wire module's `UNMODELLED` (it stays counted by the ratchet).
3. **Apply** (`apply.py <repo> <router> [--only fn1,fn2]`): copies the draft to `smplwise/wire/<router>.py` and decorates the router's
   routes with `**wire(W.Model)`.
4. **Register** (`register.py <repo> <router>...`): adds the family to `FAMILIES_E` in `scripts/gen_wire_types.py` and the
   return-annotation-less routes to `UNANNOTATED_E` in `tests/support/wire_oracle.py` (use a new block / family name for a new row).
5. **Verify**: re-run the router's tests loose (`SW_WIRE_STRICT=0`, the drift is logged and captured by the plugin), redraft from the
   drift, then strict (`SW_WIRE_STRICT=1`, the suite default). Then `python scripts/gen_wire_types.py` (regenerates the TypeScript
   types, `--check` verifies), and lower the ratchet: `python scripts/wire_ratchet.py --ratchet`.

Drift is never silent: in an installation a payload that does not fit its model is logged at ERROR (once per model and field) and sent
as the route built it; under tests it raises.
