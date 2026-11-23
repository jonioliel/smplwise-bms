# I18N-BACKEND-2490 - server texts in the user's interface language (setup wizard, readiness, error envelope)

Branch `pilot/I18N-BACKEND-2490`, cut from `origin/pilot/I18N-EN-2490` at `d144aa612` (it carries the backend language helper
`services/default_names.py` with `lang_of(conn, principal)`). Target 2.49.0.

Problem: on a live installation the server writes user-visible texts in Hebrew, so an English interface shows them in Hebrew. This
row covers the three producers the owner sees first: the setup wizard (`services/setup_wizard.py`), the readiness report
(`services/readiness.py`) and the error envelope's `user_message` (`errors.py` and the handlers in `main.py`).

## 1. Inventory (base `d144aa612`)

Counted with a tokenizer pass over `smplwise/` (string literals and f-string parts that hold a Hebrew letter, docstrings excluded).

| area | lines with Hebrew literals | what they are |
| --- | ---: | --- |
| `services/setup_wizard.py` | 178 | 6 step titles, 9 settings-link labels (+7 inline), every step's facts (label + value), summaries, problem message + action, warnings, the NVR-less texts, the time-out texts, the 429 rate-limit message |
| `services/readiness.py` | 63 | 3 level texts, 11 check titles, every check's summary / facts / "next" link label, the settings 422s, the attest 404 |
| `routers/setup.py`, `routers/readiness.py` | 1 + 2 | 404 "step not found", 429 "check just ran", 409 "confirmation required" |
| `capabilities.py` | 6 | the unsupported-installation message + action (shown in the wizard's `installation` block and the health pill), the 409 `capability_unavailable` texts |
| `errors.py` | 21 | `forbidden()` / `not_found()` default messages (every `rbac.require` refusal is `forbidden()`), the 16 pydantic constraint texts + prefix of `validation_payload()` |
| `main.py` handlers | 3 | `database_busy`, `storage_full`, `internal_error` |

How the error envelope gets its words today: 2,780 `ApiError(...)` constructions carry a Hebrew literal on the same line (all
modules); 66 sites in 17 modules already send an English text next to it as `details.message_en` (elevators, temperature,
insights, shift summary, announcements, ...), which no frontend code reads. The ADR-019 envelope (`docs/architecture/ADR-019-*`,
branch `pilot/API-CONTRACT-ADR-2490`) fixes the five top-level keys and the `details.fields` / `problems` shape; it says nothing
about the language of `user_message`. The frontend already keys on `code` where it has its own sentence:
`frontend/src/api/closed-errors.ts` (3 closed codes, he / en) is consulted first by `describeError()`, then `user_message`.

Other big backend producers of Hebrew text (NOT fixed here; lines with Hebrew literals): `services/rbac_admin.py` 202,
`services/notify_policy.py` 149, `services/generator_catalog.py` 121, `services/automation_text.py` 117,
`services/wiskey_pairing.py` 104, `services/offbox_gdrive_diagnose.py` 102, `services/schedule_ops.py` 98,
`services/ha_bridge.py` 97, `services/plan_geometry.py` 96, `services/automation_ops.py` 92, `services/presence.py` 82,
`services/access_grants.py` 79, `services/automation_blueprints.py` 76, `services/health_report.py` 75 (its check labels show
inside readiness' "connections" check), `services/schedule_model.py` 72, `services/wiskey_feature_status.py` 69,
`services/energy_billing.py` 69, `services/wiskey_live_validation.py` 68, `services/recorders/provision_isr.py` 67,
`services/device_bulk.py` 65, `services/intercom_sync.py` 59, `services/automation_model.py` 59, `services/door_conversion.py` 57,
`services/door_emergency.py` 56, `routers/cases.py` 56, `services/tickets/rfq.py` 55, `services/energy_tou.py` 54,
`routers/plans.py` 54. In all 8,711 lines in the package. Also `services/stream_codecs.main_hint` (the wizard's "main stream
will not play over WebRTC" warning per camera) stays Hebrew.

## 2. Design

**A text is a `Msg`** (`smplwise/i18n.py`): a `str` subclass that carries a stable catalogue key (`wizard.nvr.unavailable`,
`readiness.title.backup`, `error.forbidden`, ...) and its params, and whose string value IS the Hebrew rendering. Consequences:

* Hebrew output is byte-identical by construction: every reader that treats the text as a string (JSON, logs, audit details,
  the fleet report, the health report's string concatenation, tests comparing with a literal) sees exactly the old Hebrew.
* The setup wizard caches device probes process-wide (`_live`, shared by every administrator, built in a worker thread with no
  request context). The cache holds `Msg`s, so one probe serves a Hebrew and an English administrator; nothing is built "in a
  language" before the answer.
* The language is chosen only at the edge that answers ONE request: `localize(value, lang)` walks the answer and renders every
  `Msg` (and the `Msg` params inside it, e.g. a link label inside a sentence) as a plain `str`; containers are copied, never
  changed in place.
* The language is the requesting user's `ui.lang` (`default_names.lang_of`, I18N-EN-2490). No user, no stored value, an unknown
  value, a background reader (fleet report, health report) = Hebrew.
* Nothing stored is migrated, and nothing stored holds words: the readiness history row keeps statuses and fractions only; the
  hand-over attestation keeps the customer name the user typed.
* Catalogues are module-local tables `{name: (hebrew, english)}` registered under a namespace
  (`services/setup_wizard_text.py` 237 keys, `services/readiness_text.py` 92, `errors.py` 5, `capabilities.py` 6). The Hebrew of each
  entry is the literal the code wrote before (copied, then proven equal by the golden run in section 4); the English is written
  by hand with the words of the frontend's English catalogue (`frontend/src/i18n/lang/en/i18n/msg/api-system.ts` - the wizard and
  readiness demo stores -, `msg/api-automation.ts` for the forbidden text). Breadcrumbs use `›` in English as in Hebrew (Unicode
  mirrors it in RTL, so it points the reading direction in both).

**The error envelope.** The top-level keys and `code` do not change (ADR-015 / ADR-019). `ApiError.payload(cid, lang)` picks
`user_message` in this order: a `Msg` message rendered in the language; else, for English, `details.message_en` when the raising
code put one there (the 66 existing sites now reach English users with no change at those sites); else the message as raised
(Hebrew). The language is read only when the error has another-language text (`ApiError.translatable()`): `auth._principal`
notes the resolved user id on `request.state` (`i18n.remember_user`), and `main.py`'s handlers read that user's `ui.lang` on a
short read-only connection of their own, off the event loop (`i18n.request_lang`); any failure, or no resolved user (a refusal
before sign-in), answers Hebrew. `validation_payload(errors, cid, lang)` has an English constraint table next to the Hebrew one
(same keys, enforced by a test); the field names stay the request model's. `database_busy`, `storage_full` and `internal_error`
are catalogue texts too.

Why not codes-only on the wire (the frontend translating `problem.code` / `warning.code`): the wizard and readiness texts carry
many params (counts, versions, offsets, names, nested link labels) and ~330 sentences; moving them to the frontend would need a
wire contract for every param and a second copy of every Hebrew sentence. The stable codes exist (the catalogue keys, and
`problem.code` / `warning.code` / `code` on the wire as before); exposing the key + params per text on the wire is a possible
later step and needs no change to the catalogues. No wire model changed, so `scripts/gen_wire_types.py --check` is unaffected.

Not translated on purpose: values that are data (camera / floor / building names, device model and firmware strings, the go2rtc
stream names, the identity source, time-zone names), and the Hebrew texts produced by other modules that appear inside these
answers - the health report's check labels in readiness' "connections" facts and `stream_codecs.main_hint` in the wizard's codec
warnings (section 1 lists them as next producers).

## 3. Files

* `smplwise/i18n.py` (new) - `Msg`, `t()`, `register()`, `localize()`, `lang_of()`, `remember_user()`, `request_lang()`.
* `smplwise/services/setup_wizard_text.py`, `smplwise/services/readiness_text.py` (new) - the catalogues.
* `smplwise/services/setup_wizard.py`, `smplwise/services/readiness.py`, `smplwise/capabilities.py` - texts read from the catalogues.
* `smplwise/routers/setup.py`, `smplwise/routers/readiness.py` - answers rendered in the requester's language.
* `smplwise/errors.py` - `ApiError.translatable()` / `message_in()` / `payload(cid, lang)`, English constraint table, catalogue defaults.
* `smplwise/main.py` - the handlers read the requester's language; `smplwise/auth.py` - `remember_user` after the principal resolves.
* `tests/test_i18n_backend_2490.py` (new, 14 tests).

## 4. Tests actually run

All on the workstation (Windows, Python 3.12, the main repo's `.venv`), 2026-11-23, against commit `523c7e916` unless noted.

* **Hebrew byte-identity, golden run.** A scratch pytest plugin wrapped `setup_wizard.build_state`, `readiness.evaluate`,
  `ApiError.payload` and `errors.validation_payload` and recorded every result per test, first on the base `d144aa612`, then on this
  branch, over the same 24 test files (`test_setup_wizard`, `test_readiness_96`, `test_readyfleet_295`, `test_nvr_less`,
  `test_installation_capabilities`, `test_nvrless_cameras_2411`, `test_unlock_reason_2370`, `test_stream_codecs`,
  `test_admin_gate_2438`, `test_multi_nvr_identity`, `test_nvr_connection`, `test_error_envelope_unexpected`,
  `test_core_helpers_2438`, `test_be_small_unify_2440`, `test_be_twins_2440`, `test_outage_run_t035`, `test_rbac`,
  `test_rbac_matrix`, `test_frigate_forbidden_2341`, `test_automation_validate_draft_char_2450`, `test_t06_admission_295`,
  `test_externalbuild_297`, `test_alignment_controller`, `test_cr022_security_review`). Base: exit 0. Branch: 1,284 passed,
  1 skipped, 3 xfailed, exit 0. Records compared: 691 in 257 tests (534 error envelopes, 110 wizard states, 44 readiness reports,
  3 validation envelopes). After normalising run-to-run noise (free disk bytes and the sizes printed from them, clock-drift
  seconds measured against the wall clock, random ids) the Hebrew output is identical in all 691 records; the one remaining
  difference is a random 12-hex `action_id` in `test_outage_run_t035`.
* `tests/test_i18n_backend_2490.py`: 14 passed - the catalogue (every key Hebrew + English, English without Hebrew letters, same
  slots), `Msg` behaviour (str value, JSON, deepcopy / pickle, nested params, one-pass fill, `localize` copies), the old Hebrew tables
  other modules read, the wizard in Hebrew (old literals) and English (every text, the same machine fields), one cached NVR probe
  read by a Hebrew and an English administrator, wizard 404 / 429, readiness in both languages (score / statuses unchanged), the
  history row and a background `evaluate()` stay Hebrew / word-free, readiness 429 / 422, the 403 `forbidden` per user, a refused
  body (422 `validation`) per user, `validation_payload` tables, `details.message_en` promotion, an error before sign-in is Hebrew,
  the 500 `internal_error` in English.
* `tests/test_singletons_registered.py`: 4 passed (after recording `smplwise.i18n.CATALOGUE` as a constant registry in
  `tests/singletons_constant_tables.txt`; the first run flagged it, as it should).
* `python scripts/gen_wire_types.py --check`: exit 0 (no model changed).
* Frontend `tsc`: NOT_RUN - no frontend file changed.
* Runner (slot B, `~/work/slotb.sh`): queued behind three other slot-B jobs at the time of this commit - lint (`scripts/gate/lint_backend.py --strict`), `gen_wire_types --check` and 178 backend test files (the 24 above, every test file that reads `user_message` or sets `ui.lang`, the package-walking meta tests, the wire tests). Result: NOT_RUN until a later commit records it.

## Rollback

Revert the branch's commits. Nothing stored changes shape or content, so no data step.
