# WISKEY-VISIT-FILTERS-2560

## What
WisKey (27.11) publishes `business_contracts["visits/list"] = {"contract": "wiskey-visit-list-filters.v1", "status_filters": [...]}`.
Arx now offers on the external visits list exactly the filters that contract lists and Arx supports (`ended` included), when `visits/list`
is published on the current direct connection. `ended` no longer depends on `visits/record_external_v1` being listed.

## Rule (`wiskey_visits.list_statuses(api, caps)`)
1. Contract valid (entry is `wiskey-visit-list-filters.v1`, `status_filters` a list of strings containing `all`, `visits/list` published):
   its filters kept to Arx's known ones, canonical order; unknown filters ignored.
2. Otherwise (absent, malformed, other contract, not published, any exception): the 2.52 rule - `ended` only with the record command.
The request already sends `offset` / `limit` (`list_visits`); unchanged. No UI change (the panel reads `capabilities.visits.statuses`).

## Files
- `smplwise_vms/backend/smplwise/services/wiskey_visits.py` (`contract_statuses`, `direct_capabilities`, `list_statuses`, `capabilities`)
- `smplwise_vms/backend/smplwise/routers/access_wiskey_visits.py` (passes the direct capabilities)
- `smplwise_vms/backend/tests/fake_wiskey_visits.py` (`filter_contract` switch), `tests/test_wiskey_visit_filters_2560.py`

## Tests
`test_wiskey_visit_filters_2560.py` 6 passed (exit 0); `test_wiskey_visits_ended_filter_2520.py` run after the fake change, exit 0 (one file per process on the PC). Playwright / pixel baselines: NOT_RUN - no look change; the existing mock spec
`evidence-wiskey-visits-ended-2520.spec.ts` already drives the panel from `capabilities.visits.statuses`.

## Open questions
A. (recommended) Keep as is. B. Also hide `all`-less contracts differently - not needed.
