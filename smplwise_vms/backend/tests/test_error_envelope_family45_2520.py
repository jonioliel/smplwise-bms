"""ADR019-FAMILY45-2520: ADR-019 (one field-error envelope, L2) Step 1 for family 4 (tickets main-app routes, messaging accounts,
notifications, notify) and family 5 (access control / WisKey).

* family 4: the `{field, code}` objects that the tickets helpers (`_tickets_common.invalid_fields`, `service.invalid`, the module
  `invalid()`s, the external / phone-verify / visits refusals) and the messaging-accounts router sent under `details.fields` now ride in
  `details.problems`; `details.fields` is their names (ADR-019 D1: the legacy form lives under the same key, so the readers moved to
  `problemsOf` in the same row and `fields` turned into names in one step). The refusals that named one field the old way
  (`details.field`, `details.key`: notifications, notify, the department key, the cost refusals) also send `fields`, legacy key kept.
* family 5: `details.field` (+ `code`) of the grants / cards / station permissions / external access / schedule-writes refusals stays and
  gains `fields` (and `problems` where a per-field code exists); the template / WA-queue / access-messaging settings `errors` issue lists
  stay and gain the same issues as `problems` + `fields`; the profile draft's `problems` become canonical (`{field, code}`).
* the public app's vocabulary (`PublicError`, `VendorRefused`, `ActionRefused`, the vendor-file and arrival `Refused`) is out of scope
  (D1) and the inventory counts it with the public app.
The API tests of the family routes assert `details.problems` / `fields` in their own files. No app is started here."""
from __future__ import annotations

import ast
import importlib.util
from pathlib import Path

import pytest

from smplwise.errors import ApiError, named_field_error
from smplwise.routers import access_control_template_v2 as tplv2
from smplwise.routers import messaging_accounts as ma_router
from smplwise.services.tickets import visits

REPO = Path(__file__).resolve().parents[3]
FAMILY = {"tickets", "messaging", "notifications", "notify", "access", "wiskey"}


def _inventory():
    spec = importlib.util.spec_from_file_location("error_contract_inventory", REPO / "scripts" / "error_contract_inventory.py")
    m = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(m)
    return m


# ---------------------------------------------------------------- the inventory (the family ratchet)


def test_families_four_and_five_have_no_legacy_422_left():
    """Every main-app 422 of families 4 and 5 the scan reads carries the canonical `fields` (names; a legacy key may ride along)."""
    inv = _inventory()
    err = inv.scan_errors(REPO / "smplwise_vms" / "backend" / "smplwise")
    legacy = [f'{s["module"]}:{s["line"]}' for s in err["sites"]
              if inv.family_of(s["module"]) in FAMILY and s["layer"] != "public_app" and s["status"] and 422 in s["status"] and inv.is_legacy(s)]
    assert legacy == []
    named = [f'{s["module"]}:{s["line"]}' for s in err["sites"]
             if inv.family_of(s["module"]) in FAMILY and s["layer"] != "public_app" and isinstance(s["details"], list)
             and {"field", "key"} & set(s["details"]) and "fields" not in s["details"]]
    assert named == [], "a refusal that names a field also sends `fields` (409 / 403 included)"
    objects = [f'{s["module"]}:{s["line"]}' for s in err["sites"]
               if inv.family_of(s["module"]) in FAMILY and s["layer"] != "public_app" and s.get("fields_form") in {"list[object]", "map"}]
    assert objects == [], "no main-app refusal of the families sends `fields` as objects any more"


def test_the_public_vocabulary_counts_with_the_public_app():
    inv = _inventory()
    tree = ast.parse("VendorRefused(422, 'invalid', fields=[{'field': 'a', 'code': 'b'}])\nRefused(422, 'invalid', fields=[])\n"
                     "Refused(422, 'x', 'm', fields=[])\nApiError(422, 'validation', 'm', details={'fields': ['a']})\n")
    calls = [n.value for n in tree.body]
    sites = [inv._error_site(c) for c in calls]
    assert inv._layer("services/tickets/rfq_terms.py", sites[0]["callee"]) == "public_app"
    assert inv._layer("services/access_arrival.py", sites[1]["callee"]) == "public_app"
    assert inv._layer("services/tickets/attachments.py", sites[2]["callee"]) == "service", "tickets/attachments' `Refused` is main-app"
    assert inv._layer("services/tickets/external.py", sites[3]["callee"]) == "service"
    assert inv._layer("services/tickets/public_app.py") == "public_app"


# ---------------------------------------------------------------- family 4


def test_messaging_accounts_problems_and_names():
    e = ma_router._problems([{"code": "use_unknown", "field": "uses.x"}, {"code": "pacing_out_of_range", "field": "accounts[0].pacing.per_hour"},
                             {"code": "use_account_removed", "field": "uses.x"}])
    assert (e.status, e.code, e.user_message) == (422, "validation", "ערך לא תקין.")
    assert e.details == {"fields": ["uses.x", "accounts[0].pacing.per_hour"],
                         "problems": [{"field": "uses.x", "code": "use_unknown"}, {"field": "accounts[0].pacing.per_hour", "code": "pacing_out_of_range"},
                                      {"field": "uses.x", "code": "use_account_removed"}]}


@pytest.mark.parametrize(("raw_from", "raw_to", "field", "code"), [
    ("nope", "2026-11-25T10:00:00Z", "planned_from", "format"),
    ("2026-11-25T10:00:00Z", "nope", "planned_to", "format"),
    ("2026-11-25T10:00:00Z", "2026-11-25T09:00:00Z", "planned_to", "order"),
])
def test_a_visit_refusal_carries_problems_for_the_tickets_envelope(raw_from, raw_to, field, code):
    import datetime as dt

    with pytest.raises(visits.VisitRefused) as ex:
        visits.parse_window(None, raw_from, raw_to, dt.datetime(2026, 11, 25, 8, tzinfo=dt.UTC))
    assert (ex.value.status, ex.value.extra) == (422, {"problems": [{"field": field, "code": code}]})


def test_a_service_refusal_that_names_one_field_also_answers_fields():
    e = named_field_error(422, "quiet_invalid", "שעה לא תקינה (HH:MM).", {"field": "quiet.from"})
    assert (e.status, e.code, e.user_message, e.details) == (422, "quiet_invalid", "שעה לא תקינה (HH:MM).", {"field": "quiet.from", "fields": ["quiet.from"]})
    e = named_field_error(422, "validation", "ערך מספרי מחוץ לטווח.", {"field": "budget_pct", "min": 1, "max": 100})
    assert e.details == {"field": "budget_pct", "min": 1, "max": 100, "fields": ["budget_pct"]}
    # nothing to add: no field, a field already canonical, a retryable refusal keeps its flag
    assert named_field_error(429, "rate_limited", "x", {"retry_after_s": 9}, retryable=True).details == {"retry_after_s": 9}
    assert named_field_error(429, "rate_limited", "x", {"retry_after_s": 9}, retryable=True).retryable is True
    assert named_field_error(422, "validation", "x", {"fields": ["a"], "field": "a"}).details == {"fields": ["a"], "field": "a"}
    assert named_field_error(422, "validation", "x", None).details == {}
    assert type(named_field_error(422, "validation", "x", {"field": "a"})) is ApiError


# ---------------------------------------------------------------- family 5


def test_the_template_send_issue_list_is_also_problems():
    issues = [{"path": "templates.1", "code": "duplicate"}, {"path": "enabled", "code": "not_a_boolean"}]
    e = tplv2._invalid(issues)
    assert (e.status, e.code) == (422, "template_send_invalid")
    assert e.details == {"errors": issues, "fields": ["templates.1", "enabled"],
                         "problems": [{"field": "templates.1", "code": "duplicate"}, {"field": "enabled", "code": "not_a_boolean"}]}


def test_family_five_field_refusals_keep_their_legacy_keys():
    from smplwise.services import access_cards, access_grants, access_station_permissions

    e = access_grants._invalid("valid_until", "range")
    assert (e.status, e.code) == (422, "access_grant_invalid")
    assert e.details == {"field": "valid_until", "code": "range", "fields": ["valid_until"], "problems": [{"field": "valid_until", "code": "range"}]}
    e = access_station_permissions._invalid("station_id", "format")
    assert (e.code, e.details["field"], e.details["code"], e.details["fields"]) == ("station_permission_invalid", "station_id", "format", ["station_id"])
    e = access_cards._invalid_number()
    assert (e.code, e.details["field"], e.details["fields"], e.details["problems"]) == ("access_grant_invalid", "card_no", ["card_no"],
                                                                                         [{"field": "card_no", "code": "format"}])
