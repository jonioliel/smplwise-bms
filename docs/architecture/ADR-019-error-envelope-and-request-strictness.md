# ADR-019 — One field-error envelope (L2) and `extra="forbid"` per client (L14)

Status: proposed 2026-11-22 (lead decisions L2 and L14 of the code-review master plan of 2026-11-13, section 4.2; owner informed, no owner decision needed)
Owner / date / linked tasks / requirements: Claude Code (lead) / 2026-11-22 / API-CONTRACT-ADR-2490 (2.49.0 row), review findings 04:F16 (router side) and 05:P2-22 / MASTER_SPEC ch. 32 (error model), ADR-015 (pilot contract lock)

This ADR decides the contract and the migration path. It changes no product code: every step below is its own row behind the
generated client, family by family. The numbers come from `scripts/error_contract_inventory.py` (static scan, run 2026-11-22 on
`release/2470-train` at `4d244a419`); a status or `details` built at run time counts as `dynamic`, and a wrapper the pattern does not
recognise is missed, so the counts are a floor, not an audit of every handler.

## Context and evidence

### What is already uniform

The main app answers every error through the handlers in `smplwise/main.py` (lines 166-210) with ONE top-level envelope
(ADR-015, MASTER_SPEC ch. 32):

```json
{"code": "validation", "user_message": "<Hebrew>", "retryable": false, "correlation_id": "<id>", "details": {}}
```

* `ApiError` (3 280 direct constructions, plus the `errors.py` helpers and about 25 module-local wrappers such as `svc.err`,
  `CostRefused`, `PresenceError`, `PartnerError`; 4 592 error-constructor sites in all, 107 of them in the public app) -> `ApiError.payload()`.
* pydantic body / query errors (`RequestValidationError`) -> `errors.validation_payload()`: code `validation`, a Hebrew message
  that names each field and its constraint, `details.errors = [{loc, type, msg, ctx}]` (raw, for a developer).
* `HTTPException`, a busy database (500 `database_busy`, `Retry-After`), a full disk (507 `storage_full`) and any unexpected error
  (500 `internal_error`) -> the same five keys.
* 19 direct `JSONResponse` answers outside `main.py` and the public app whose status is an error or computed: 5 pass
  `ApiError.payload()` (429 with a `Retry-After` header), 2 build the five keys by hand (`routers/local_identity.py:122`,
  `routers/local_passkeys.py:300`), 12 forward a `(status, payload)` pair from a service or a stored idempotent reply (automations,
  blueprints, schedules, cast, multimedia, tickets) - the scanner cannot prove those payloads are enveloped; each family row checks
  its own.

The frontend client (`frontend/src/api/client.ts`, `errorBody()`) normalises exactly these five keys into `ApiErrorBody` and
falls back to `http_<status>`; `describeError()` shows `user_message`. That part needs no decision.

### What is not uniform: the field names inside `details`

There are 1 478 sites that can answer 422 in the main app (public app excluded). By the keys they put under `details`:

| Shape | Sites | Modules | Example |
|---|---|---|---|
| none (no details) | 525 | 136 | `ApiError(422, "scope_unknown", ...)` - the refusal is about the request as a whole |
| `fields` | 442 | 96 | `details={"fields": ["station_id"]}` (`routers/access_control_capture.py:376`) |
| other keys only | 272 | 88 | `reason` (69), `path` (24), `error` (13), `max`, `id`, `issues`, `choices`, `locks`, ... |
| `field` (one name) | 178 | 44 | `details={"field": exc.field}` (`routers/calendar.py:58`) |
| `key` | 26 | 9 | `services/generator_log.py` (`Invalid(key)`) |
| `errors` (issue list) | 14 | 11 | `details={"errors": [{"path", "code", "message"}]}` (`services/automation_ops.py:206`) |
| dynamic | 21 | 16 | `details=exc.details` |

And the same key has several forms:

* `fields`: a list of names in 275 sites (plus 66 empty / mixed lists and 48 computed), a list of OBJECTS in 52
  (`[{"field", "code"}]`, e.g. messaging accounts), and a MAP field -> message in electricity / water billing (the frontend reads
  both: `elecFieldErrors()` in `frontend/src/api/electricity-billing.ts:730`).
* `errors`: four forms under one key - the global handler's `[{loc, type, msg, ctx}]`, the automations / scenarios / template
  issue list `[{path, code, message}]`, the wall settings `[{loc, msg}]` (`routers/wall.py:346`) and plain strings
  (`routers/device_layouts.py:547`).
* 12 modules mix two or more of these shapes in their own 422s (`routers/nvr_connection.py`, `services/energy_billing.py`,
  `services/presence.py`, `routers/access_control_template_v2.py`, ...).
* The routers translate service exceptions at 167 `except ...Invalid / ...Error as` sites (the review counted 53 of the
  `...Invalid` kind), each with its own mapping. `errors.ServiceInvalid` (CR-CORE-HELPERS-2438) already gives the service classes
  one shape (`code`, `fields`, `message`, `details`) and one `to_api_error()`; the routers do not use it yet (lead decision L2 held it).

### Who reads which shape

| Client | What it reads from an error | Depends on |
|---|---|---|
| Web UI (shipped in the same image as the backend) | `code`, `user_message`, status everywhere; `details.*` in about 70 places | `details.fields` as NAMES (insights, electricity customer number, maintenance task form, water customers, meter readings), as a MAP (electricity billing wizard) and as OBJECTS `{field, code}` (tickets RFQ compare, tickets locations, tickets rules, tickets contacts directory, messaging accounts); `details.field` (NVR connection form, NVR camera edit), `details.errors` 6 (automations, scenarios panel, schedule editor, electricity settings, access messaging), `details.key` 1 (scenario settings), `details.problems` 1 (access profiles); the rest read endpoint extras (`retry_after_s`, `outcome`, `wiskey_code`, `capture`, `run_id`, `can_skip`, ...) |
| HA bridge (`custom_components/smplwise_bridge`, released separately) | the HTTP status only: pairing ping 200 / 401 / other (`config_flow.py:43`), directory push 200 / other (`__init__.py:638`) | nothing in the body |
| Phone apps (`docs/api/mobile-presence-contract.md` v2.2) | the five keys, the stable `code`s of the contract, `details.reason` / `details.required` of `csrf_refused` | codes, not field keys |
| Public pages (`/t/*`, CR-038: a SECOND FastAPI app, `services/tickets/public_app.py`) | `{code, retry_after_s?, attempts_left?, fields?: [{field, code}], version?}` - no `user_message` by design (the page holds the words in four languages, nothing is echoed) | its own vocabulary; 107 error sites, all inside the public app |

The exact file:line list of each read is in the inventory's "Frontend reads of error details" section; it is regex-based and
also counts a few comments.

### Request bodies (L14)

453 pydantic models are request bodies of a route (a body parameter or `X.model_validate(...)` in the handler):

| Client | `forbid` | default (= `ignore`) | `ignore` (explicit) | `allow` |
|---|---|---|---|---|
| Web UI | 311 | 134 | - | 1 (`routers/calendar.py:79` `Body`: free-form, the module's validators refuse unknown keys themselves) |
| Phone app | 3 (`AckIn`, `RenameIn`, `MutedIn`) | - | 2 (`presence.RegisterIn`, `presence.EventsIn`) + 1 (`mobile_notifications.PushRegisterIn`) | - |
| Browser push | - | - | 1 (`push.SubscriptionIn`: `PushSubscription.toJSON()` also carries `expirationTime`) | - |

Plus 87 models reached only as nested fields (62 forbid, 24 default, 1 allow: `ha.DevAttributesIn`, HA attributes are an open bag)
and 18 routes that take a plain `dict` body: the two bridge routes (`/ha/bridge/ping`, `/ha/bridge/directory`, signed messages
whose key set grows with the bridge version) and 16 web-UI settings documents (`/notify/settings`, `/presence/settings`,
`/multimedia/cast/config`, ...) validated by their module. The public app reads every body through `read_json()` with a strict
model (`extra=forbid`, no duplicate keys, no NaN).

Who sends extra keys today:

* **Phone apps - yes, by contract.** v2.1 apps still send `ssid_hash`; the contract promises "nothing an app built to v2.1 sends is
  refused while `value_check` is `off`". Apps are released on their own schedule, so a newer app talks to an older server.
* **Browser push - yes.** The browser adds `expirationTime` and may add more.
* **HA bridge - yes, by design.** Each bridge version adds keys to the directory push (`local_identity_extended`,
  `wiskey_execute_policy`, ...); an older add-on must accept a newer bridge and the reverse.
* **Web UI - unknown.** It ships in the same image, but nothing proves that no screen sends an extra key to the 134 tolerant models
  (a draft spread from a GET answer into a PUT, a renamed field still sent by one screen). A static scan cannot answer this: bodies
  are built from variables in most API modules.

## Constraints and source versions

* ADR-015 compatibility rule: additive changes in any version; a removed or renamed field needs an ADR entry and a changelog
  line. This ADR is that entry for the `details` keys it retires, and it retires them only after the web UI stopped reading them.
* FastAPI / pydantic v2 as pinned in `smplwise_vms/backend/constraints.txt`; the response models of `smplwise/wire` and
  `scripts/gen_wire_types.py` (generated TypeScript under `frontend/src/api/generated/`, `--check` in the backend tests).
* The bridge and the phone apps are released separately from the add-on; nothing here may require a new bridge or app.
* No pixel change: error texts on screens stay the same words in the same places.

## Alternatives considered

### L2 - the field-error key

1. **Status quo, documented.** No risk, no gain: every new screen keeps writing its own defensive reader, and a 422 still cannot be
   shown under the right field by shared code. Rejected.
2. **`details.field` (one name) everywhere.** Loses the multi-field refusals (442 sites already name several). Rejected.
3. **RFC 9457 `application/problem+json`** (`type`, `title`, `status`, `detail`, `errors`). Changes the top-level envelope that the UI,
   the phone-app contract and the fixtures rely on, for no user benefit. Rejected.
4. **Big bang: rewrite every 422 to a new key in one release.** About 270 legacy sites (plus ~50 computed ones) and ~30 screen readers at once; one missed reader is a
   silent regression (the message under the wrong field). Rejected.
5. **Chosen: canonical `details.fields` (names) + optional `details.problems` (per-field reasons), dual-emitted next to the legacy
   key, migrated family by family behind one frontend reader, legacy keys removed by a ratchet.** The majority form already is
   `fields: [names]` (275 sites, `ServiceInvalid.api_details()`), so most families change nothing or add one key.

### L14 - unknown keys in request bodies

1. **`extra="forbid"` on every model now.** Breaks the phone apps, browser push and (for dict bodies) the bridge by design, and
   turns an unknown web-UI extra into a refused save in the field. Rejected.
2. **Leave the 134 tolerant web-UI models as they are.** A misspelt or renamed field is silently dropped - a save that "worked" but
   lost a value. Rejected.
3. **Chosen: per client.** Tolerant forever where the client is released separately (phone app, browser push, bridge dict bodies,
   HA attribute bags); strict for the web UI after an OBSERVATION step that proves, model by model, that the UI sends no extra key.

## Decision and rationale

### D1 (L2) - one field-error envelope

The five-key top-level envelope stays exactly as it is for every error of the main app. Inside `details`, an error that is about
one or more input fields (422, and the few 400 / 409 refusals that name a field) carries:

```text
details.fields:   string[]                                         REQUIRED when the refusal names a field
details.problems: {field: string, code: string, message?: string}[]  OPTIONAL, one entry per field and reason
```

* `field` is the dotted path relative to the body or the query (`doors.pairs[0].lock_entity_id`, `name`, `body` for an unreadable
  body) - the request model's field names, never a Hebrew label. `fields` lists each field once, in the order of the problems.
* `code` is a stable machine word: the pydantic error type for model validation (`missing`, `string_too_long`, `extra_forbidden`,
  ...), a domain word otherwise (`out_of_range`, `duplicate`, `not_allowed`). `message` is the server's Hebrew text for that field
  when it has one; the screen may show its own words for a known `code` instead.
* `code` of the envelope stays what it is (`validation` or the domain code, e.g. `period_overlap`); the refusal's other `details`
  (limits, `current`, `revision`, `allowed`, `reason`, ...) stay endpoint-specific extras - not part of this decision.
* `details.errors` is reserved for the global handler's raw pydantic list (developer detail). Domain issue lists move to `problems`.
* Retired once each family is migrated: `details.field`, `details.key`, `details.fields` as objects or as a map, domain
  `details.errors` issue lists. During the migration a family sends the canonical keys AND its legacy key (additive under ADR-015).
  Where the legacy form lives under the same key (`fields` as objects - tickets, messaging accounts - or as a map - billing), the
  two cannot be sent side by side: there the family first adds `problems`, then every reader of that family moves to the shared
  reader (which accepts both forms of `fields`), and only then `fields` turns into names, in one step.
* The public app (CR-038) is out of scope: its `{code, fields: [{field, code}]}` answers are a deliberate, minimal, non-echoing
  vocabulary of a separate app with its own pages. Its `fields` already matches `problems` field by field; nothing changes there.
* The bridge reads statuses only and is unaffected; the phone-app contract gains `details.fields` / `problems` on its 422s as an
  additive v2.3 note when its family is migrated (`presence`, `mobile_notifications`).

### D2 (L14) - `extra` per client

| Client | Rule |
|---|---|
| Web UI | `extra="forbid"` on every body model, after the observation step proves the model receives no extra key. New models are `forbid` from now on (already the norm: 311 of 446). |
| Phone apps | Stay tolerant (`ignore`) where they are today; the three `forbid` phone models stay `forbid` (their shape is pinned by the contract). A phone-model change is a contract version, never a silent flip. Strict checking of sensor values stays the server setting `presence.value_check`. |
| Browser push | `ignore`, permanently (a browser-owned shape). |
| HA bridge | Plain signed `dict` bodies, permanently tolerant of unknown keys in both directions (version skew); each handler checks the keys it uses. |
| HA attribute bags, free-form documents | `allow` stays where the value is an open bag by nature (`ha.DevAttributesIn`, `calendar.Body`); their module validators decide. |
| Public app | Already strict (`read_json`); unchanged. |

The observation step is a request base model in the style of `WireModel` (`smplwise/wire/__init__.py`): `extra="ignore"` (so the
behaviour does not change) plus a `model_validator(mode="before")` that compares the incoming keys with the model's fields and
aliases and, for an unknown key, logs `(model, key, route)` once per process and counts it in the diagnostics; under
`SW_REQUEST_STRICT=1` (set by the backend tests, like `SW_WIRE_STRICT`) it raises, so a test that sends an extra key fails. A model
moves to `forbid` when (a) the backend tests pass in strict mode, (b) the web-UI API module that sends it builds its body from named
keys (checked by reading it), and (c) one release in the lab logged no unknown key for it. A `forbid` model answers an unknown key
with the D1 envelope: `fields: ["<key>"]`, `problems: [{field, code: "extra_forbidden"}]` (the Hebrew "שדה לא מוכר" text already
exists in `errors._CONSTRAINT_HE`).

## Migration plan

Every step is a separate row, pixel-neutral, with its tests; no step needs a new bridge or app.

**Step 0 - contract and reader (one row, no envelope change).**
1. Backend: `wire/errors.py` with `ErrorEnvelope`, `FieldProblem`, `FieldErrorDetails` pydantic models (documentation and type
   generation only; the handlers keep building dicts). `gen_wire_types.py` learns a short list of non-route models and writes
   `frontend/src/api/generated/wire-errors.ts`; `ApiErrorBody` in `client.ts` is typed from it.
2. Backend: `errors.field_error(message, fields, *, problems=None, code="validation", status=422, legacy=None)` returns an `ApiError`
   with the canonical keys plus, while a family migrates, its legacy key (`legacy={"field": ...}`); `ServiceInvalid.api_details()`
   adds `problems` when the class has per-field codes.
3. Frontend: `fieldsOf(err): string[]` and `problemsOf(err): FieldProblem[]` in `frontend/src/api/client.ts`, reading the canonical
   keys first and every legacy form second (`field`, `key`, `fields` as names / objects / map, `errors` with `path` or `loc`).
   Screens move to these readers without any visible change.
4. The global `RequestValidationError` handler adds `fields` and `problems` derived from `errors[].loc` / `type` (additive: every
   route at once; `errors` stays).

**Step 1..n - family by family.** For each family: (a) its screens read through `fieldsOf` / `problemsOf`; (b) its routers raise
`field_error(...)` / `exc.to_api_error()` with the legacy key still sent; (c) its API tests assert `details.fields`; (d) one release
later, after the inventory shows no frontend reader of the legacy key in that family, the legacy key goes, with a changelog line.
Order (the families whose service classes already carry `fields` first, then the largest legacy counts; "legacy" = the inventory's
422 sites with `details.field`, `details.key`, an `errors` issue list or `fields` as objects / a map - 270 today; 48 more sites build
`fields` at run time and are classified by each family row by reading them):

| Order | Family (inventory `family_of`) | Legacy sites today | Note |
|---|---|---|---|
| 1 | ServiceInvalid adopters: calendar (11), transit (2), notices (1), plus emergency, maintenance, temperature, insights, generator | 14 + the `key` / `(code, fields)` translations | the classes already set `fields`; routers switch to `to_api_error()` |
| 2 | presence (35), mobile (1) | 36 | mostly `field`; contract v2.3 note for the phone-app routes (additive) |
| 3 | NVR (28), recorders (26 + 4), connection (2), camera (5), device layouts, wall (1) | 66 | `field`, `errors` as strings / `{loc, msg}` |
| 4 | tickets (main-app routes, 41), messaging accounts, notifications (6), notify (1) | 48 | `fields` as objects `{field, code}`: objects -> `problems`, then `fields` -> names; the public page reader (`frontend/src/public-ticket/api.ts` `failure()`) reads the PUBLIC app's `fields` objects and stays as it is |
| 5 | access control / WisKey (25; 44 sites already canonical) | 25 | template / WA-queue / schedule-writes `errors` issue lists -> `problems` |
| 6 | automations (2), scenarios (3 + 2), schedules (1), blueprints | 8 | `errors` issue lists `{path, code, message}` -> `problems`; the forwarded `(status, payload)` replies are checked to be `ApiError.payload()` |
| 7 | electricity (2) and water billing | 2 + computed | `fields` as a map (built at run time, so the scan undercounts) -> names + `problems[].message`; `elecFieldErrors()` reads `problemsOf` |
| 8 | the rest (app 15, media 9, home 6, local 6, incidents 4, settings 4, door 4, ...), then the hand-built envelopes (`local_identity._error`, `local_passkeys:300`) -> `ApiError` | ~70 | |

**L14 steps (after Step 0, in parallel with the families).** (1) the observing base model and `SW_REQUEST_STRICT=1` in the backend
test settings; (2) the 134 tolerant web-UI models and 24 nested ones adopt it family by family (same order as above); (3) a model
flips to `forbid` under the three conditions of D2; (4) the 16 plain-dict settings documents get a model (or a documented
`allow`) when their family is touched - a separate decision per document, not forced by this ADR.

## Effects on API, data, UX, permissions and operations

* API: additive `details` keys first (ADR-015 compatible); a legacy key disappears only after its readers did, one family per
  release, each with a changelog line. Statuses and envelope `code`s do not change.
* UX: none visible; texts and their placement stay. Afterwards a new screen gets field-level errors from one reader.
* Data, permissions: none. A `forbid` model refuses a request that today silently drops a key - only after the observation step
  showed no client sends one.
* Operations: the observation step adds one log line per (model, key) per process and a diagnostics counter.
* HA bridge, phone apps, public pages: no change required; see D1 / D2.

## Validation evidence / rollback

Tests that guard the decision (each lands with its step):

* `tests/test_error_contract_inventory_2490.py` (this row): the inventory's classifier, request-model and client attribution on a
  small tree, and that it runs on the real code.
* Step 0: a backend contract test that every `RequestValidationError` answer carries `fields` and `problems` next to `errors`;
  `gen_wire_types.py --check` covers `wire-errors.ts`; a frontend unit spec (`tests/unit-error-fields.spec.ts`) feeding
  `fieldsOf` / `problemsOf` every legacy form and the canonical one.
* A ratchet test (like `scripts/design_ratchet.py`): the inventory's "legacy 422 shapes by family" counts and the number of
  tolerant web-UI request models may only go down; a baseline JSON next to the script is lowered by each family row.
* Per family: API tests assert `details.fields` (and `problems` where present) for the refusals the screens show under a field,
  and the screen specs keep their current pixels.
* L14: the backend suite in `SW_REQUEST_STRICT=1`; for each flipped model an API test that an unknown key answers 422
  `extra_forbidden` with the D1 envelope, and a phone-app / bridge test that their tolerant bodies still accept an extra key.

Rollback: every step is additive until its legacy key is removed; a family row is reverted on its own. A model flipped to `forbid`
goes back to the observing base in one line if the lab logs an unknown key.

Approver / supersedes: lead (decisions L2, L14), owner informed / extends ADR-015 (error model, compatibility rule); closes the
router side of review 04:F16 and 05:P2-22 as a plan.
