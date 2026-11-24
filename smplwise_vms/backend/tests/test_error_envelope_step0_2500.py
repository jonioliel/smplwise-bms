"""ADR019-STEP0-2500: ADR-019 (one field-error envelope, L2) Step 0 - the contract and the reader - and Step 1 for family 1 (the
ServiceInvalid adopters: calendar, transit, notices, emergency, maintenance, temperature, insights, generator).

* `errors.field_error()` answers `details.fields` (names, each once) and `details.problems` (`{field, code, message?}`) next to the
  family's legacy key and the endpoint's own extras; `ServiceInvalid.api_details()` adds `problems` for a class with a per-field reason.
* every `RequestValidationError` answer carries `fields` and `problems` next to the raw `errors` list (additive, all routes at once).
* the envelope models (`smplwise/wire/errors.py`) describe what the handlers build and are written to the generated
  `frontend/src/api/generated/wire-errors.ts` (`gen_wire_types.py --check`).
* the family-1 translations keep their legacy key (`field`, `code`, `problem`) and add the canonical ones.
The API tests of the family routes assert `details.fields` in their own files (calendar engine, notices, notice slides, bus times,
emergency readiness, maintenance)."""
from __future__ import annotations

import ast
import importlib.util
import sqlite3
from pathlib import Path

import pytest
from fastapi import Query
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict, Field

from smplwise.errors import ApiError, ServiceInvalid, field_error, validation_payload
from smplwise.main import create_app
from smplwise.wire.errors import MODELS, ErrorEnvelope, FieldErrorDetails, FieldProblem

REPO = Path(__file__).resolve().parents[3]


def _script(name: str):
    spec = importlib.util.spec_from_file_location(name, REPO / "scripts" / f"{name}.py")
    m = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(m)
    return m


# ---------------------------------------------------------------- errors.field_error


def test_field_error_answers_the_canonical_keys():
    e = field_error("ערך לא תקין.", ["b", "a", "b"])
    assert isinstance(e, ApiError) and (e.status, e.code, e.user_message) == (422, "validation", "ערך לא תקין.")
    assert e.details == {"fields": ["b", "a"]}  # each field once, in order; no problems when none were given
    assert field_error("x").details == {"fields": []}


def test_field_error_problems_add_their_fields_in_order():
    e = field_error("x", ["a"], problems=[{"field": "b", "code": "format", "message": "פורמט"}, {"field": "a", "code": "missing", "message": None}])
    assert e.details == {"fields": ["a", "b"], "problems": [{"field": "b", "code": "format", "message": "פורמט"}, {"field": "a", "code": "missing"}]}
    assert field_error("x", problems=[{"field": "phone", "code": "route_required"}]).details["fields"] == ["phone"]


def test_field_error_keeps_the_legacy_key_and_the_extras():
    e = field_error("x", ["to"], code="feed_refused", status=409, legacy={"field": "to"}, extra={"message_en": "x", "max": 3})
    assert (e.status, e.code) == (409, "feed_refused")
    assert e.details == {"field": "to", "message_en": "x", "max": 3, "fields": ["to"]}
    for bad in ({"legacy": {"fields": ["x"]}}, {"extra": {"problems": []}}):
        with pytest.raises(ValueError):
            field_error("x", ["a"], **bad)


def test_the_details_validate_against_the_envelope_models():
    e = field_error("x", ["a"], problems=[{"field": "a", "code": "c", "message": "m"}], legacy={"field": "a"})
    env = ErrorEnvelope.model_validate(e.payload("cid"))
    det = FieldErrorDetails.model_validate(env.details)
    assert det.fields == ["a"] and det.problems == [FieldProblem(field="a", code="c", message="m")]
    assert det.model_extra == {"field": "a"}  # the legacy key rides along as an extra


# ---------------------------------------------------------------- ServiceInvalid


class _FieldCode(ServiceInvalid):  # the emergency / maintenance shape: (field, code) where code is the field's reason
    def __init__(self, field: str, code: str) -> None:
        ValueError.__init__(self, f"{field}: {code}")
        self.field, self.code, self.fields, self.field_code = field, code, [field], code


def test_service_invalid_adds_problems_for_a_per_field_reason():
    e = _FieldCode("phone", "format")
    assert e.field_problems() == [{"field": "phone", "code": "format"}]
    api = e.to_api_error("ערך לא תקין.", code="validation", legacy={"code": e.code})
    assert (api.status, api.code) == (422, "validation")
    assert api.details == {"code": "format", "fields": ["phone"], "problems": [{"field": "phone", "code": "format"}]}
    assert ServiceInvalid("x", fields=["a"]).field_problems() == [] and ServiceInvalid("x", fields=["a"]).api_details() == {"fields": ["a"]}


def test_to_api_error_canonical_keys_win_over_legacy_and_extra():
    e = ServiceInvalid("m", fields=["a"], details={"max": 3})
    api = e.to_api_error(legacy={"field": "a"}, extra={"message_en": "M"}, status=409)
    assert api.status == 409 and api.details == {"field": "a", "message_en": "M", "max": 3, "fields": ["a"]}


# ---------------------------------------------------------------- the global RequestValidationError handler


def test_validation_payload_derives_fields_and_problems():
    errs = [{"loc": ("body", "name"), "type": "string_too_long", "msg": "too long", "ctx": {"max_length": 5}},
            {"loc": ("body", "name"), "type": "missing", "msg": "m"},
            {"loc": ("query", "limit"), "type": "less_than_equal", "msg": "le", "ctx": {"le": 10}},
            {"loc": ("body",), "type": "json_invalid", "msg": "bad"}]
    p = validation_payload(errs, "cid")
    d = p["details"]
    assert [e["loc"] for e in d["errors"]] == [["name"], ["name"], ["limit"], []]  # the raw list stays
    assert d["fields"] == ["name", "limit", "body"]
    assert d["problems"] == [{"field": "name", "code": "string_too_long", "message": "ארוך מדי (עד 5 תווים)"},
                             {"field": "name", "code": "missing", "message": "שדה חובה"},
                             {"field": "limit", "code": "less_than_equal", "message": "לכל היותר 10"},
                             {"field": "body", "code": "json_invalid", "message": "JSON לא תקין"}]
    ErrorEnvelope.model_validate(p)
    FieldErrorDetails.model_validate(d)


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(max_length=5)
    count: int


def test_every_request_validation_answer_carries_fields_and_problems(settings):
    app = create_app(settings)

    def echo(body: _Body, limit: int = Query(default=1, le=10)) -> dict:
        return {"ok": True}

    app.add_api_route("/t/echo", echo, methods=["POST"])
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.post("/t/echo?limit=11", json={"name": "abcdefg", "surprise": 1})
        assert r.status_code == 422
        body = r.json()
        assert set(body) == {"code", "user_message", "retryable", "correlation_id", "details"} and body["code"] == "validation"
        d = body["details"]
        assert {"errors", "fields", "problems"} <= set(d)
        assert len(d["problems"]) == len(d["errors"]) and [p["field"] for p in d["problems"]] == [".".join(e["loc"]) or "body" for e in d["errors"]]
        assert set(d["fields"]) == {"name", "count", "surprise", "limit"}
        codes = {p["field"]: p["code"] for p in d["problems"]}
        assert codes["surprise"] == "extra_forbidden" and codes["count"] == "missing" and codes["limit"] == "less_than_equal"
        assert all(p["message"] for p in d["problems"])
        r = c.post("/t/echo", content=b"{not json", headers={"Content-Type": "application/json"})
        d = r.json()["details"]
        assert r.status_code == 422 and d["fields"] and len(d["problems"]) == len(d["errors"]), r.text
        assert any(p["code"] == "json_invalid" for p in d["problems"]), r.text


# ---------------------------------------------------------------- generated types and the inventory


def test_the_envelope_models_are_generated_into_wire_errors_ts():
    gen = _script("gen_wire_types")
    assert gen.NON_ROUTE["wire-errors.ts"] == ("smplwise.wire.errors", "MODELS")
    text = gen.render_models("smplwise.wire.errors", "MODELS")
    path = REPO / "frontend" / "src" / "api" / "generated" / "wire-errors.ts"
    assert path.read_text(encoding="utf-8") == text, "run `python scripts/gen_wire_types.py`"
    for model in MODELS:
        assert f"export interface {model.__name__} {{" in text
    assert "Routes {" not in text  # no route map in a non-route file


def test_the_inventory_counts_field_error_as_canonical():
    inv = _script("error_contract_inventory")
    call = ast.parse('field_error("m", ["a"], code="feed_refused", legacy={"field": "a"}, extra={"max": 3}, problems=[])').body[0].value
    site = inv._error_site(call)
    assert site == {"callee": "field_error", "status": [422], "code": "feed_refused", "details": ["fields", "problems", "field", "max"], "fields_form": "list[str]"}
    assert inv.shape_of(site["details"]) == "fields" and not inv.is_legacy(site)
    assert inv._error_site(ast.parse('errors.field_error("m", ["a"], status=409)').body[0].value)["status"] == [409]


def test_family_one_has_no_legacy_only_422_left():
    """Every 422 of family 1 that the scan reads carries the canonical `fields` (the legacy key may ride along)."""
    inv = _script("error_contract_inventory")
    err = inv.scan_errors(REPO / "smplwise_vms" / "backend" / "smplwise")
    family = {"calendar", "transit", "notices", "emergency", "maintenance", "temperature", "insights", "generator"}
    legacy = [f'{s["module"]}:{s["line"]}' for s in err["sites"]
              if inv.family_of(s["module"]) in family and s["status"] and 422 in s["status"] and inv.is_legacy(s)]
    assert legacy == []


# ---------------------------------------------------------------- family 1 translations (no app: the helpers the routes raise)


def test_calendar_invalid_keeps_field_and_adds_fields():
    from smplwise.routers import calendar as r
    from smplwise.services.calendar import model

    conn = sqlite3.connect(":memory:")
    with pytest.raises(ApiError) as ex:
        with r._errors(conn, None, None):  # type: ignore[arg-type]
            raise model.Invalid("color: one of ...", "color", "validation")
    assert (ex.value.status, ex.value.code) == (422, "validation") and ex.value.details == {"field": "color", "fields": ["color"]}
    with pytest.raises(ApiError) as ex:
        r._instant(None, "from")
    assert ex.value.details == {"field": "from", "fields": ["from"]}


def test_calendar_events_422_with_a_field():
    from smplwise.services.calendar import events

    e = events._422("past_start", "שעת הסיום כבר עברה.", field="end")
    assert (e.code, e.details) == ("past_start", {"field": "end", "fields": ["end"]})
    e = events._422("duration_out_of_bounds", "x", calendar_id="c", min=5)
    assert e.details == {"calendar_id": "c", "min": 5}  # no field named: unchanged


def test_notices_and_transit_invalid():
    from smplwise.routers import notices
    from smplwise.services.transit import model as transit_model

    e = notices._invalid(notices.Invalid("ends_at", "נדרש מועד סיום."))
    assert (e.code, e.user_message, e.details) == ("validation", "נדרש מועד סיום.", {"field": "ends_at", "fields": ["ends_at"]})
    t = transit_model.Invalid("clock_after_min", "דקות בין 0 ל-240.").to_api_error("דקות בין 0 ל-240.", legacy={"field": "clock_after_min"})
    assert t.details == {"field": "clock_after_min", "fields": ["clock_after_min"]}


def test_generator_routing_refusal_names_its_field():
    from smplwise.routers import generator
    from smplwise.services import generator_alerts as alerts

    e = generator._routing_error(alerts.RoutingInvalid("template_invalid", "x", {"field": "template_he", "unknown": ["a"], "allowed": ["b"]}), 400)
    assert (e.status, e.code) == (400, "template_invalid")
    assert e.details == {"field": "template_he", "unknown": ["a"], "allowed": ["b"], "fields": ["template_he"]}
    e = generator._routing_error(alerts.RoutingInvalid("revision_conflict", "x", {"row_version": 3}), 409)
    assert (e.status, e.details) == (409, {"row_version": 3})


def test_temperature_invalid_keeps_fields_and_message_en():
    from smplwise.routers import temperature
    from smplwise.services import temperature as t

    e = temperature._invalid(t.Invalid("rule_invalid", ["rules.high"]))
    assert (e.status, e.code, e.details) == (422, "rule_invalid", {"message_en": "Invalid rule value.", "fields": ["rules.high"]})
    assert temperature._invalid(t.Invalid("rule_invalid")).details["fields"] == []  # as before: the key is there, empty


def test_maintenance_and_emergency_invalid():
    from smplwise.services.maintenance import model as mmodel
    from smplwise.services.maintenance import service as msvc

    e = msvc.invalid(mmodel.Invalid("place", "unknown"))
    assert (e.code, e.user_message) == ("validation", "ערך לא תקין: place")
    assert e.details == {"problem": "unknown", "fields": ["place"], "problems": [{"field": "place", "code": "unknown"}]}
