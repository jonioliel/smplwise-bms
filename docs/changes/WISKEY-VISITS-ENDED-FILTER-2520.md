# WISKEY-VISITS-ENDED-FILTER-2520 - the visit list's `ended` status filter, offered only when WisKey supports it

Branch `pilot/WISKEY-VISITS-ENDED-FILTER-2520`, cut from `origin/release/2520-train` (`eadaa25b8`). Target 2.52. Software only: no lab,
no install, no message to WisKey.

## 1. Why

WISKEY-R6-2520 (open question 2) left the list's status filter without `ended`: rc.10 refuses it. WisKey's reply of 25.11 (item 4.4)
says the list accepts `filters.status=ended` in rc.20. This row adds the value, offered only when the connected WisKey supports it.

## 2. The signal (no version label)

WisKey's own source (read-only checkout, never modified): `access/visit_requests.py` `list_requests` at rc.19 (`3e7bfc585`) and rc.20
(`dcebb9f3`) accepts `status in STATUSES | {"all", "ended"}` and the `external_ref` filter; rc.10 accepts `STATUSES | {"all"}` only
(`invalid_fields` otherwise). `git log -S` shows the `ended` list filter and `visits/record_external_v1` arrived in **the same WisKey
commit** (`6e5a4629`, "Add guarded external visit records ..."). So the signal is the one R6 already uses for the exact `external_ref`
read: WisKey lists `visits/record_external_v1` in `overview.api.commands` (`feature_state(api, "push")`, which also fails closed on no
copy, unknown commands and an incompatible `min_client`). `api.version` is never read.

Limit of the signal: `commands` lists what WisKey offers **the add-on's identity**. A WisKey that supports the filter but does not grant
the record command to Arx's identity keeps the option hidden (fails toward "not offered", never toward sending a value WisKey refuses).

## 3. What changed

| where | change |
|---|---|
| `services/wiskey_visits.py` | `LIST_STATUSES` (the six rc.10 values), `list_statuses(api)` (+ `ended` with the record command), `capabilities.visits.statuses`, `REASON_HE["ended_filter_not_offered"]`, module note |
| `routers/access_wiskey_visits.py` | `status` Literal gains `ended`; `ended` while not offered -> 409 `wiskey_visits_unsupported`, `details = {feature: "ended_filter", reason: "ended_filter_not_offered"}`, **before any frame**. Every other value is sent as before |
| `wire/access_wiskey_visits.py` | additive: the visits capability is its own model with `statuses: list[str]`; the home answer's `push.reason` / `push.message` widened to `str \| None` (they are null while the push is available - the settings answer already had it; strict tests refused the home answer in that state) |
| `frontend/src/api/generated/wire-access-wiskey-visits.ts` | regenerated (`scripts/gen_wire_types.py`) |
| `smplwise/error_text_en.json` | the English of the new refusal text |
| `frontend/src/api/wiskey-visits.ts` | `VisitListStatus`, `VisitCapability.statuses?` |
| `frontend/src/access-external/wiskey-visits-logic.ts` | `statusFilterOptions(cap)` (null = no filter unless `statuses` includes `ended`; fixed order; unknown values dropped), `keptStatusFilter` |
| `frontend/src/access-external/wiskey-visits-panel.ts` | a status filter (`sw-chip-choice`, default look) under the "visits in the access-control system" heading, only when offered; the list is re-read with `status`; only the newest read lands; a failed filtered read keeps the filter and shows the error |
| `frontend/src/i18n/lang/en/i18n/msg/misc.ts` | "הכל" = "All", "סינון לפי מצב הביקור" = "Filter by visit status" ("הסתיים" = "Ended" came with R6) |
| `docs/user-guide/he/52-external-access_HE.md` | one bullet: the filter appears only with a system that offers it |
| tests | `tests/fake_wiskey_visits.py` (status semantics of rc.10 / rc.19), `tests/test_wiskey_visits_ended_filter_2520.py` (new), `frontend/tests/unit-wiskey-visits.spec.ts` (+3), `frontend/tests/evidence-wiskey-visits-ended-2520.spec.ts` (new) |

On rc.10 (the lab) nothing changes: `statuses` has no `ended`, the panel renders no filter, and the list is read without a status, as
before. No setting: the filter is a read-only view that appears only with the capability (default = today's panel). No migration.
Rollback: revert the commit.

Note on the panel: it had **no** status filter before (the spec assumed one). The filter is therefore new UI, shown only on a WisKey that
offers `ended` - see Q1.

## 4. Tests

PC (one file, repo venv): `pytest -q -p no:cacheprovider tests/test_wiskey_visits_ended_filter_2520.py` exit 0 (first run: 1 failure,
the strict home answer with `push.reason` null - fixed in the wire model, see section 3); `ruff check` on the five Python files: all
checks passed.

Runner (`~/work/p2520_wkended_run.sh`, slot B, at `6411218e9`; backend one pytest process per file, `SW_WIRE_STRICT=1`):

| command | exit | result |
|---|---|---|
| `scripts/gen_wire_types.py --check` | 0 | committed TS matches the models |
| `scripts/wire_ratchet.py` | 0 | 897 unmodelled = baseline |
| `scripts/design_ratchet.py` | 0 | no count above the baseline |
| `ruff check` (5 files) | 0 | all checks passed |
| `pytest tests/test_wiskey_visits_ended_filter_2520.py` (new) | 0 | 7 passed |
| `pytest tests/test_wiskey_visits_2407.py` | 0 | 18 passed |
| `pytest tests/test_wiskey_visits_b8_2520.py` | 0 | 51 passed |
| `pytest tests/test_i18n_errors_en_2520.py` | 0 | 9 passed |
| `pytest tests/test_admin_gate_2438.py` | 0 | 22 passed |
| `pytest tests/test_wire_routers_e_2480.py` | 0 | 95 passed |
| `pytest tests/test_wire_consumption_2450.py` | 0 | 13 passed |
| frontend `tsc --noEmit` / `-p tsconfig.tests.json` | 0 / 0 | no errors |
| `eslint` on the changed frontend files | 0 | 0 errors (2 "file ignored" warnings for spec files) |
| unused-exports (report only) | 0 | none of the new exports listed |
| unit `unit-wiskey-visits.spec.ts` | 0 | 10 passed (+3 new) |
| unit `unit-i18n-en-ratchet-2490.spec.ts` / `unit-i18n-lang-packs-2443.spec.ts` | 0 / 0 | 6 / 10 passed |
| `npm run build` (head and base) | 0 / 0 | - |
| `evidence-wiskey-visits-ended-2520.spec.ts`, desktop + mobile, light + dark, head | 0 | 8 passed (rc.10: no filter, list read without a status; rc.19: 7 chips, "הסתיים" reads `status=ended`, 2 rows, chip pressed) |
| same spec on the base (`SW_BEFORE=1`, shots only) | 0 | 8 passed |

Pixel baselines: no pixel spec renders this panel (the external-access settings dialog is not in any `pixel-*` spec), so no baseline
changed or was refreshed. The rc.10 "before" and "after" screenshots of the panel are **byte-identical** (md5 equal for all four:
desktop / phone x light / dark). Compare page (local): `private/planning/wiskey-visits-ended-filter-2520_compare_2026-11-25.html`.

NOT_RUN: the full backend suite, the full Playwright e2e and pixel suites (the train gate runs them); producer rc.19 / rc.20 and the lab
(NOT_MEASURED by rule: no lab, no install, no contact with WisKey; the lab has rc.10, where nothing changes).

## 5. Open questions (owner; unanswered = recommendation)

1. The visits panel had no status filter at all. a) show the whole status filter (all + six statuses + "הסתיים") only when the
   connected system offers `ended`; on rc.10 the panel stays exactly as it is (recommended, built) b) show the filter on every version,
   `ended` only when offered (changes the lab's panel today) c) backend only, no panel filter.
2. A WisKey that supports the filter but does not list the record command for Arx's identity: a) keep `ended` hidden there (recommended,
   built; no version-label guessing) b) ask WisKey for an explicit discovery flag for list filters (e.g. `visits/list` filter names in
   discovery) in the next handoff.

## 6. Files other rows own

`services/wiskey_visits.py`, `routers/access_wiskey_visits.py`, `wire/access_wiskey_visits.py`, `tests/fake_wiskey_visits.py`,
`frontend/src/access-external/wiskey-visits-*.ts` and the user-guide section are WISKEY-R6-2520's (already on the train; this row is
cut from the train head). `smplwise/error_text_en.json` (I18N-REST-2520) gains one sorted line; `misc.ts` (en) two keys. All additive.
