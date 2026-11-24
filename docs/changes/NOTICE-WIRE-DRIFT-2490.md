# NOTICE-WIRE-DRIFT-2490 - union answers no longer log a false contract drift

## Symptom
Lab add-on 2.47.0 logged `response contract drift in NoticeBoardBrief: undeclared keys [...]` and
`... NoticeBoardListBrief: full: literal_error` for correct answers of `GET /notices/boards`.

## Cause
Not a missing field: `NoticeBoard` already declares every key. The route answers `NoticeBoardListBrief | NoticeBoardListFull`
as a plain union. Outside strict mode pydantic tries every member, and `WireModel` logs a drift (and falls back to the route dict) for
each member that does not fit, so the member that was NOT the answer logged an error. Strict mode (tests) raises instead, which the union
swallows, so the strict test suite could not see it. RESPONSE-MODELS-E-2480 does not touch these models (checked: no diff in
wire/notices.py or routers/notices.py).

## Change
- `wire.tagged(tag, *models)`: a union discriminated on a Literal field the route writes itself. Used for `GET /notices/boards` (`full`).
  Trade-off: a missing/unknown tag is a 500 instead of a fallback; the route always writes `full`.
- `LocalUserLink.link` (`LocalLink | LocalLinkQueued`, `POST /identity/local-users/{id}/link`): same bug for a queued WhatsApp link;
  discriminated with a callable (`via` present -> queued).
- `scripts/gen_wire_types.py` and `tests/support/wire_oracle.py` unwrap `Annotated`. Generated TS is byte-identical
  (`gen_wire_types.py --check` rc=0), so no frontend change; the frontend reads the same keys.
- Tests: two non-strict tests in `test_wire_notices_2470.py` assert no drift record for either shape of both answers.

## Other drifts (search)
Only these response models are plain unions: the two above, `LocalSignInSession | LocalSignInPending` (the route returns a
JSONResponse itself, so the model is documentation only, no runtime validation) and `EnergyPlanPreview | EnergyTariffCorrected`
(only in `responses=`, documentation only). Any non-union drift raises under SW_WIRE_STRICT=1, which the suite sets and the gate runs
green, so none is reachable by tests. The full-suite non-strict scan was started and cancelled (about 9% after 30 min on the loaded
runner); not needed given the above.

## Tests (runner, slot B)
- `gen_wire_types.py --check`: rc=0.
- pytest: test_wire_*.py, test_notice*.py, test_notices_*.py, test_local_identity*.py: 684 passed.
- NOT_RUN: the new tests were not run against the unfixed code to prove they fail; tsc (generated types unchanged); full backend suite.
