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

## 5. Second pass: RBAC administration, notification policies, automation sentences, health report, codec hint

Same mechanism, same rule: a user-visible text is a `Msg` whose string value IS the Hebrew the code wrote before; only the edge that
answers one request renders it in the requester's `ui.lang`. `generator_catalog` is NOT converted: it is a data catalogue that already
carries both languages (`AlertType.title_he` / `title_en`, stored as `generator_alert_types.title_he` / `title_en` and compared by
tests/test_generator.py); its role labels are served by routers/generator.py (a later pass).

### 5.1 Per module (lines with Hebrew literals at `1a7913b32` -> now; catalogue keys)

| module | before | after | keys | what is now in the user's language | what stays Hebrew on purpose (and why) |
| --- | ---: | ---: | ---: | --- | --- |
| `services/rbac_admin.py` | 202 | 171 | `perm.*` 171, `rbac.*` 30 (`services/rbac_admin_text.py`) | every permission label (`PERMISSION_LABELS` values are `Msg`s; `rendered_labels(conn, lang)` fills the tickets `{module}` token with the module's name in that language), the scope picker's "the whole installation" / "site · X", every refusal of the binding / custom-role writes (the 30 texts, incl. `LOCAL_*_HE`) | the 171 remaining lines are the label table itself (the Hebrew source of each `Msg`, proven equal by a test); other modules' f-strings that quote a label (`automation_scope`, `schedule_view`, `routers/ha.py`) read the Hebrew - those sentences belong to those modules |
| `services/notify_policy.py` | 149 | 139 | `notify.label.*` 157 (131 own + tickets module + 26 generator types from their `title_en`), `notify.*` 12 (`services/notify_policy_text.py`) | each source's settings label (GET / PUT `/notify/policies`), the 10 policy-edit refusals, the 404 / 412 of the policy routes | a source's title, body and resolve text and `SEVERITY_LABEL_HE`: written into the notification row and sent by push, e-mail, the phone app and WhatsApp (stored + sent) |
| `services/automation_text.py` (+ `building_presence_blocks` sentences) | 117 (+10) | 17 (+5) | `auto.*` 311 (164 words + 147 per-service verb / label / word, `services/automation_text_i18n.py`) | every trigger / condition / action / item sentence and locked-block label, the action picker labels, the building-presence sentences | the remaining 17 lines are `ACTION_VERBS` (the Hebrew source of the verb keys, a test keeps both tables in step) and docstrings; the 5 left in `building_presence_blocks` are its `validate()` problems (another producer); `automation_trace`'s run summary ("רצה ב־...") and `automation_ext`'s schedule step sentence are their own f-strings (later) |
| `services/health_report.py` | 75 | 0 | `health.*` 108 (`services/health_report_text.py`) | every check label and detail of `/health/report`, every top-bar item of `/health/summary`, and therefore the health labels quoted in readiness' "connections" facts | - (the fleet report, the notification monitor and `readiness.evaluate` read it without a user: Hebrew) |
| `services/stream_codecs.py` | 7 | 7 | `codec.*` 6 | the main-stream hint (`main_hint`) in the wizard's codec warning, the camera capabilities `video.hint`, the health report's `main_not_webrtc` | `camera_name()`'s "ערוץ N" fallback (also written to the NVR's channel name by `nvr_settings`), the NVR menu path (the device's own English words); the 7 remaining lines are the inline catalogue and comments |

English is written by hand with the words of the frontend's English catalogue: api-automation.ts / time.ts (the client mirror of the
sentences: every key of api/automations.ts and api/automations-presence.ts), api-notify.ts and tickets/*.ts (source labels), misc.ts
(the access-control permission labels of access-control/access.ts), api-system.ts (health words). Where the frontend shares one key
between a status label and a sentence word (`מופעל` -> "On", `נפתח` -> "Opening", `ננעל` -> "Locked"), the sentence uses the verb form
that reads as a sentence ("is on", "opens", "locks").

### 5.2 Mechanism additions

* `i18n.Cat` / `cat()` / `join()`: a sentence made of parts (a `Msg` and data, a list joined by "or" / "and"). Its string value is the
  concatenation of the parts' Hebrew (so `" או ".join(...)` and `s += f", אם ..."` keep their bytes) and each part renders on its own.
  copy / deepcopy / pickle keep the parts.
* Edges added: `routers/health.py` (report, summary), `routers/cameras.py` (capabilities `video`), `routers/notifications.py` (policy
  list / one / put), `routers/access_roles.py`, `access_audit.py`, `access_custom_roles.py`, `access_groups.py` (`labels`),
  `access_directory.py` (`assign_scopes`, the delegated directory), `routers/ha_users.py` (`scopes`), `routers/automations.py` (every
  answer through `_out` / `_reply`), `routers/automation_blueprints.py` (preview, instantiate), `routers/automation_ext.py` (conflicts,
  wall buttons, device tests). A Hebrew reader of the automation routes gets the `Msg`s as they are (no copy of the answer).
* Errors raised with a `Msg` (`rbac.*`, `notify.*`) reach English users through the error envelope of section 2 with no change there.

### 5.3 Tests (second pass)

`tests/test_i18n_backend_2490b.py` (new): the namespaces and `Cat` / `join` (Hebrew bytes, English, JSON, copies); the codec hint
(Hebrew literal, English, data kept); the health report and summary per user (Hebrew labels / details as before, English without a
Hebrew letter, same ids and statuses, readiness' connections facts in English) and its background readers (Hebrew); every notification
source label a `Msg` with its old Hebrew, stored texts plain Hebrew, the policy list / one / 422 / 404 per user; every permission label a
`Msg`, the role catalogue labels (`{module}` filled with "Tickets" in English), the scope picker and the 422 `role_unknown` per user; the
verb tables in step, a full automation sentence in Hebrew (old bytes) and English, locked labels, building-presence sentences, and the
automation preview per user (same machine fields).

Runs, 2026-11-23:

* Workstation (Windows, Python 3.12, the main `.venv`): `test_i18n_backend_2490b.py` (13), `test_i18n_backend_2490.py` (14),
  `test_singletons_registered.py` (4), `test_automation_text.py` (6): 37 passed, exit 0. `test_fake_doorwin_closed_rule_sr1.py` after the
  pin below: exit 0.
* **Hebrew byte-identity, golden run on the runner** (slot A, Linux, Python 3.12): the same scratch pytest plugin as section 4, widened
  (wraps `stream_codecs.main_hint` / `hints` / `summary`, `health_report.build` / `summary` / the video and recorder-clock checks,
  `notify_policy.render` / `validate_update`, the rbac_admin refusals and checks, every public sentence function of `automation_text`
  and its re-exports in `automation_model`, `ApiError.payload`, and the body of every TestClient response), base `1a7913b32` and this
  pass side by side in 6 shards each, over the same 218 test files (every file that touches these modules, their routes or
  `PERMISSION_LABELS`). Base: 7,382 passed, 4 failed, 2 skipped, 3 xfailed. Pass 2: 7,382 passed, 4 failed, 2 skipped, 3 xfailed.
  Failures: `test_media_groups.py` x3 in BOTH (a `TypeError` in `/multimedia/groups/join`, unrelated, already at the base);
  `test_soak_edges_2450.py::test_d1_...` base only (timing); `test_fake_doorwin_closed_rule_sr1.py::test_ha_lock_service_sites_are_pinned`
  pass 2 only - the new English verb table names `lock.unlock` as a key; pinned in commit `7a22a3975` (a label, never a call).
  Compared: 4,274 tests that produced records (226,927 records: 48,923 HTTP bodies, 8,368 error envelopes, ~171,000 sentence results,
  the health / codec / notify / rbac results), and in them every string holding a Hebrew letter (329,780) as a per-test multiset after
  normalising noise (timestamps, ids, sizes, numbers); also the static tables (every source label, every permission label, the severity
  words): equal. 24 tests differ: 2 are `test_i18n_backend_2490.py` tests whose user is English (readiness' connections facts now carry
  the health labels in English - the intended change); 22 are noise: zipped backup archives whose bytes fall in the Hebrew range (6),
  random ids / key fingerprints inside Hebrew data texts (7), the NVR clock-drift sign measured against the wall clock (7),
  background-thread timing (2: `backup.failed` in `test_notify_sources`, a WisKey station name in `test_wiskey_final281`). No Hebrew text
  produced by the converted modules differs. Not covered by this golden run: the `_out` / `_reply` edges of the three automation routers
  (added after the run's snapshot; Hebrew path = the value unchanged) - covered by the head run below.
* Runner, pushed head: `scripts/gate/lint_backend.py --strict` 0 findings (ruff 0.17.5), `scripts/gen_wire_types.py --check` exit 0.
  Runner slot B at `7a22a3975`: the 30 automation route test files (every file that calls `/automations`, `/automation-blueprints`,
  `/automations-ext` or the automations fixture), `test_i18n_backend_2490.py`, `test_i18n_backend_2490b.py`,
  `test_fake_doorwin_closed_rule_sr1.py`, `test_health_report.py`, `test_health_summary.py`, `test_notify_core.py`, `test_access.py`,
  `test_custom_roles.py`, `test_ha_users.py`, `test_capabilities.py`, `test_media_groups.py`: 774 passed, 3 failed - the same three
  `test_media_groups.py` tests that fail at the base (see above).
* Frontend `tsc`: NOT_RUN - no frontend file changed.

### 5.4 Next producers (not in this pass)

`rbac.role_name` / `scope_name` (rbac.py: role and scope names on the same screens), `routers/generator.py` role labels, the tickets
module's notification titles, `automation_trace` run summaries and `automation_ext` schedule step sentences, `building_presence_blocks`
and `automation_scope` / `schedule_view` refusal sentences (they quote the permission labels in Hebrew), and the remaining modules of
section 1's list (`wiskey_pairing`, `offbox_gdrive_diagnose`, `schedule_ops`, `ha_bridge`, `plan_geometry`, ...).

## 6. Third pass: role and scope names, generator roles, tickets matrix labels, run traces, the editors' extension, refusals

Same mechanism and rule as sections 2 and 5. The producers of section 5.4's list, except the remaining modules of section 1.

### 6.1 Per module (lines with Hebrew literals at `aaf634ef2` -> now; catalogue keys)

| module | before | after | keys | what is now in the user's language | what stays Hebrew on purpose (and why) |
| --- | ---: | ---: | ---: | --- | --- |
| `rbac.py` (+ `roles.json` names) | 3 | 0 | `role.*` 35, `scope.*` 5 (`smplwise/rbac_text.py`) | every built-in role name (`ROLE_NAMES_HE` values are `Msg`s; `role_name()` returns a `Lit` - see 6.2 - whose `{tickets}` token is filled with the tickets module's configured name in each language), every scope name (`scope_name()`: the whole installation, `מצלמה · X`, `ערוץ N`, `עמדה · X`, the unavailable station) | site / building / floor / camera / station names (data). The local users' CSV export keeps Hebrew role and scope names (a file, not an answer) |
| `routers/generator.py` | 24 | 25 | `generator.role.*` 3 | the routing screen's recipient-role labels (`GET /generator/devices/{id}/policies`) | the route's 21 `ApiError` messages (another producer, not in this pass); +1 line = the inline catalogue |
| `services/tickets/notify_matrix.py` | 1 | 1 | reuses `notify.label.*` | the matrix screen's source labels (`GET /tickets/settings/notify-matrix`, with its role names) and the digest detail's `event_label` (`notify.serialize`, read now, never stored) | stored and sent: the digest's title (`תקציר {ticket}: {n} אירועים`, the 1 remaining line) and body (an f-string over the labels: plain Hebrew); every `notify_bridge` title / body template (`T_*`), its status, reason and return words - written into the notification row and sent by push, e-mail, the phone app and WhatsApp |
| `services/automation_trace.py` | 13 | 0 | `trace.*` 24 (`services/automation_trace_text.py`) | a run's summary sentence, the trace sentence, the trigger description words, the "condition" fallback | Home Assistant's own description of an unknown trigger (data) |
| `services/automation_ext.py` | 14 | 0 | `ext.*` 16, `action.label.*` 76 (`services/automation_ext_text.py`) | the conflict title / detail, the button-reuse and device-unavailable warnings, the critical-sound and bridge refusals, the 429, and a schedule's test-step sentence (`<time> · <action> · <device>`: the action label of `ha_bridge.ACTIONS`, a test keeps both tables in step); the schedules catalogue's action labels use the same keys | `ha_bridge.ACTIONS` labels themselves (another producer; its own routes still answer Hebrew) |
| `services/automation_scope.py` | 17 | 13 | `ascope.*` 16 (`services/automation_scope_text.py`) | every reason message (`REASON_MESSAGES` values are `Msg`s), the grant refusal that quotes a permission label (rendered in the same language), the control and unknown-effects refusals | the 13 remaining lines are the `REASON_MESSAGES` table itself (the Hebrew source of each `Msg`, proven equal at import and by a test) |
| `services/schedule_view.py` | 28 | 11 | `sched.*` 25 | every reason message, the control / door / alarm / media / public-screen refusals (two quote a permission label), the script refusals, the three schedule warnings and the five catalogue "why not" texts | the 9 lines of the `REASON_MESSAGES` table (as above) and `display_name()`'s fallback name ("תזמון ללא שם", "X · N משבצות": a name, sorted and searched as one) |
| `services/building_presence_blocks.py` | 5 | 0 | `auto.bp.err.*` 5 | `validate()`'s five problems (reach the user through the automation preview / save answers) | - |

Edges added (the answer rendered in the requester's language; a Hebrew reader gets the value as it is): `routers/me.py` (bindings), `access_roles`, `access_bindings` (list, create), `access_audit` (preview), `access_groups` (every group answer, impact), `access_custom_roles` (preview, update), `access_directory` (users), `ha_users`, `local_identity` (list, one, every write answer), `doors` (placement, door grants), `door_windows` (the emergency state, prepare, incidents, grants), `intercom_calls` (settings), `tickets_admin_people` (holders), `tickets_admin_settings` (notify matrix), `notices` (audience options), `scenarios` (choices), `generator` (policies), `schedules` (every view / ops answer through `_out` / `_reply`), `notify.serialize` (the digest detail). The automation routes already had theirs (section 5.2).

### 6.2 Mechanism additions

* `i18n.Lit`: a `Msg` that carries its words per language (`{"he": ..., "en": ...}`), for a text built from installation data in each language (a role name with the tickets module's configured name). copy / deepcopy / pickle keep it.
* `i18n.localize_for(conn, principal, value)`: the edge helper - `localize` in the requester's language, the value itself for a Hebrew reader.
* Signatures: `rbac.role_name` / `scope_name` keep theirs (they return a `str` subclass, as before a `str`); `routers/schedules._reply(result, conn=None, principal=None)` keeps its positional form (`home_family` calls it with one argument). No subclass overrides a touched method: the only `payload` override outside `errors.py` is `media_groups.ConfirmRequired` (fixed in `aaf634ef2`); `Msg.render` is overridden by `Cat` and `Lit` only, both with the base signature.

### 6.3 Tests and runs (third pass)

`tests/test_i18n_backend_2490c.py` (new, 19 tests): the new namespaces (English without a Hebrew letter, the same slots), `Lit`, every
role name equal to roles.json, `role_name`'s `{tickets}` per language, the scope names (the old f-string bytes), the role screens per user
(`/me`, `/access/roles`, `/access/bindings`, `/identity/users`), the generator routing roles, the matrix labels (the digest body stays a plain
Hebrew `str`) and the matrix screen, run summaries and traces, the conflict lines, the action labels in step with `ha_bridge.ACTIONS` and
the step sentence's bytes, the schedule test plan per user, the reason tables, the refusals that quote a permission label, a schedule 403
and a read-only reason per user, the building-presence problems.

Runs, 2026-11-23, workstation only (Windows, Python 3.12, the main `.venv`; the runner was busy with the 2.48.0 gate):

* `test_i18n_backend_2490c.py` (19), `test_i18n_backend_2490.py` (14), `test_i18n_backend_2490b.py` (13), `test_singletons_registered.py` (4):
  exit 0.
* Sanity subset on the converted modules: `test_kav079_checks`, `test_rbac_matrix`, `test_custom_roles`, `test_generator`,
  `test_tickets_notify_matrix`, `test_building_presence_cockpit_2271`, `test_kavdevtest_295`, `test_schedules_review`, the two earlier i18n
  files, `test_singletons_registered`: 150 passed, exit 0.
* `ruff check smplwise` (ruff 0.17.5, the pyflakes rules of pyproject.toml): all checks passed (it found three F402 - the i18n `t` shadowed by
  a loop variable in `automation_ext` / `schedule_view` - fixed by importing it as `_t`). `scripts/gen_wire_types.py --check`: exit 0.
* **Hebrew byte-identity, golden run:** a scratch plugin as in section 4 (wraps `role_name`, `scope_name`, `bindings_of`, the trace,
  extension, scope and schedule-view producers, `validate`, `notify_matrix.detail_for` / `_digest_text`, `rbac_admin._binding_dict` /
  `_role_impact` / `assign_scopes`, the door emergency views, `ApiError.payload`, every TestClient body) over 42 test files (RBAC / access,
  local identity, HA users, door windows and emergency, intercom calls, tickets admin / naming / matrix, notices, generator, every
  `test_automations_*`, `test_kav079_*`, `test_kavdevtest_295`, every `test_schedules_*`, building presence), base `aaf634ef2` (a `git
  archive` in scratch) and this pass side by side. NOT FINISHED at the time of this commit (the workstation was at 100% CPU: about 10% after
  15 minutes); its result is recorded by a later commit.
* Runner: NOT_RUN (lead's instruction: the 2.48.0 gate holds it). Frontend `tsc`: NOT_RUN - no frontend file changed.

### 6.4 Next producers (not in this pass)

The `ApiError` messages of `routers/generator.py` and of `schedule_ops` / `automation_model` (their own literals), `ha_bridge.ACTIONS`
labels and `RISK_LABEL` on their own routes, `door_emergency.KIND_HE`, `schedule_view.display_name`'s fallback, the local users' CSV export,
and the remaining modules of section 1's list.

## Rollback

Revert the branch's commits. Nothing stored changes shape or content, so no data step.
