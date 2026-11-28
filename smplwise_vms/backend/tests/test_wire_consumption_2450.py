"""CR-RESPONSE-MODELS-CONSUMPTION-2450 (code review 07:F8 step 2, MASTER_PLAN 3.6): the consumption family - electricity meters and
billing, water meters and billing - answers through explicit response models (smplwise/wire), and the frontend's wire types are
generated from them (scripts/gen_wire_types.py).

The characterisation is the wire oracle (tests/support/wire_oracle.py, installed by conftest): every answer a test of these routers
receives is compared, in the same request, with the route's pre-model serialisation - keys, values and number / boolean types must be
identical. This file checks what the oracle cannot see: that every JSON route of the family HAS a model, that the routes answering with
their own JSONResponse (FastAPI does not validate those) fit their documented model, that the generated client types are current, and the
production behaviour on drift (logged, answered unchanged) next to the test behaviour (refused)."""
from __future__ import annotations

import importlib
import importlib.util
import json
import logging
import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi.routing import APIRoute
from pydantic import TypeAdapter, ValidationError

from support import wire_oracle
from test_energy_billing_api import SEPT, draft, golden_readings, issue, setup_billing, w  # noqa: F401 - `w` is the billing world fixture
from test_water_billing_s3 import account as water_account, app, bill as water_bill, setup_billing as water_setup  # noqa: F401 - `app` fixture
from smplwise.wire import WireModel
from smplwise.wire import energy_billing as EW
from smplwise.wire import water_billing as WW

ROOT = Path(__file__).resolve().parents[3]
FAMILY = ("energy_meters", "energy_billing", "water", "water_billing")
# routes that answer no JSON body (a file, a CSV, an image, 204) - the only routes of the family without a response model
NO_JSON = {
    "DELETE /energy/customers/{cid}", "DELETE /energy/accounts/{aid}", "DELETE /energy/tariffs/{tid}", "DELETE /energy/tariffs/{tid}/versions/{vid}",
    "DELETE /energy/vat-rates/{vid}", "DELETE /energy/billing-settings/logo", "GET /energy/billing-settings/logo", "DELETE /energy/bills/{bid}",
    "GET /energy/bills/{bid}/pdf", "GET /infra/water/consumption.csv", "DELETE /infra/water/customers/{cid}", "DELETE /infra/water/tariffs/{tid}",
    "DELETE /infra/water/tariffs/{tid}/versions/{vid}", "DELETE /infra/water/accounts/{aid}", "DELETE /infra/water/bills/{bid}",
    "GET /infra/water/bills/{bid}/pdf",
}


def _gen():
    spec = importlib.util.spec_from_file_location("gen_wire_types", ROOT / "scripts" / "gen_wire_types.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules.setdefault("gen_wire_types", mod)
    spec.loader.exec_module(mod)
    return mod


def _routes() -> list[tuple[str, APIRoute]]:
    out = []
    for name in FAMILY:
        for r in importlib.import_module(f"smplwise.routers.{name}").router.routes:
            if isinstance(r, APIRoute):
                for m in sorted(r.methods - {"HEAD", "OPTIONS"}):
                    out.append((f"{m} {r.path}", r))
    return out


def strict_fit(model: Any, body: Any) -> None:
    """`body` (an answer FastAPI did not validate) fits `model` exactly: no undeclared key, every type right, and the model's own
    serialisation of it is the same JSON."""
    ta = TypeAdapter(model)
    value = ta.validate_python(body)
    again = json.loads(ta.dump_json(value, by_alias=True, exclude_unset=True))
    assert wire_oracle.same(again, body) is None, wire_oracle.same(again, body)


# ---------------------------------------------------------------- the route table

def test_every_json_route_of_the_family_declares_a_wire_model():
    gen = _gen()
    missing, stale = [], []
    for key, r in _routes():
        if key in NO_JSON:
            if r.response_model is not None:
                stale.append(key)
            continue
        if not gen.wire_models(r.response_model):
            missing.append(key)
        elif not r.response_model_exclude_unset:
            missing.append(key + " (exclude_unset)")
    assert not missing, f"JSON routes without a response model: {missing}"
    assert not stale, f"routes listed as non-JSON but modelled: {stale}"
    assert len(_routes()) >= 120


def test_no_raw_sql_left_in_the_family_routers():
    """Review 05 SQL boundary: the statements of these routers live in their store modules (services/*_store.py)."""
    spec = importlib.util.spec_from_file_location("sql_boundary_report", ROOT / "scripts" / "sql_boundary_report.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    base = ROOT / "smplwise_vms" / "backend" / "smplwise"
    for name in FAMILY:
        found = mod.scan_file(base / "routers" / f"{name}.py")
        assert found["sql"] == 0 and found["execute_calls"] == 0, (name, found)


def test_the_generated_client_types_are_current():
    """frontend/src/api/generated/ is what scripts/gen_wire_types.py writes from the models (run it after a model change)."""
    assert _gen().main(["--check"]) == 0


def test_the_route_map_names_every_modelled_route():
    text = (ROOT / "frontend" / "src" / "api" / "generated" / "wire-consumption.ts").read_text(encoding="utf-8")
    for key, r in _routes():
        if key not in NO_JSON:
            method, path = key.split(" ", 1)
            assert f'"{method} /api/v1{path}"' in text, key


def test_the_oracle_is_installed_for_this_test_process():
    import fastapi.routing as fr

    assert fr.serialize_response.__name__ == "checked", "tests/support/wire_oracle.install() runs from conftest.py"


# ---------------------------------------------------------------- drift: logged and unchanged in production, refused in tests

BAD = {"items": [{"id": "v1", "effective_from": "2025-01-01", "rate_percent": 18, "extra": True}], "current": None}


def test_drift_is_refused_under_strict(monkeypatch):
    monkeypatch.setenv("SW_WIRE_STRICT", "1")
    with pytest.raises(ValidationError):
        TypeAdapter(EW.EnergyVatRates).validate_python(BAD)
    with pytest.raises(ValidationError, match="undeclared keys"):
        TypeAdapter(EW.EnergyVatRates).validate_python({"items": [], "current": None, "added": 1})


def test_drift_is_logged_once_and_answered_unchanged_in_production(monkeypatch, caplog):
    import warnings

    from smplwise import wire

    monkeypatch.setenv("SW_WIRE_STRICT", "0")
    wire._REPORTED.clear()
    ta = TypeAdapter(EW.EnergyVatRates)
    with caplog.at_level(logging.ERROR, logger="smplwise.wire"), warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for _ in range(2):
            out = json.loads(ta.dump_json(ta.validate_python(BAD), by_alias=True, exclude_unset=True))
            assert wire_oracle.same(out, wire_oracle.legacy_json(BAD)) is None
    drift = [r for r in caplog.records if "contract drift" in r.getMessage()]
    assert len(drift) == 1 and "EnergyVatRate" in drift[0].getMessage()
    assert drift[0].levelno == logging.ERROR  # RESPONSE-MODELS-E-2480: drift stays at ERROR level
    ok = {"items": [], "current": None, "added": [1]}  # an undeclared key passes through, logged
    assert json.loads(ta.dump_json(ta.validate_python(ok), exclude_unset=True)) == ok
    wire._REPORTED.clear()


def test_a_key_left_out_stays_absent_and_is_never_null():
    ta = TypeAdapter(EW.EnergyCustomer)
    row = {"id": "c1", "customer_number": "0001", "name": "x", "revision": 1, "created_at": "a", "updated_at": "b", "account_count": 0}
    assert json.loads(ta.dump_json(ta.validate_python(row), exclude_unset=True)) == row  # no contact fields without the permission


def test_every_model_is_a_wire_model():
    for mod in ("energy_meters", "energy_billing", "water", "water_billing"):
        m = importlib.import_module(f"smplwise.wire.{mod}")
        for name, obj in vars(m).items():
            if isinstance(obj, type) and issubclass(obj, WireModel) and obj.__module__ == m.__name__:
                assert obj.model_config.get("extra") == "allow", name


# ---------------------------------------------------------------- the routes that answer with their own JSONResponse

def test_electricity_bill_create_correct_state_and_price_correction_fit_their_models(w):  # noqa: F811 - the imported fixture
    golden_readings(w)
    s = setup_billing(w)
    aid = s["account"]["id"]
    d = draft(w, aid, SEPT, request_id="req-wire-0001")
    assert d.status_code == 201, d.text
    strict_fit(EW.EnergyBill, d.json())
    again = draft(w, aid, SEPT, request_id="req-wire-0001")
    assert again.status_code == 200
    strict_fit(EW.EnergyBill, again.json())
    i = issue(w, d.json())
    assert i.status_code == 200, i.text
    corr = w.c.post(f"/api/v1/energy/bills/{d.json()['id']}/correct", json={"client_request_id": "req-wire-0002"})
    assert corr.status_code == 201, corr.text
    strict_fit(EW.EnergyBill, corr.json())
    st = w.c.get("/api/v1/energy/bills/state")
    assert st.status_code == 200
    strict_fit(EW.EnergyBillsState, st.json())
    t = s["tariff"]
    body = {"effective_from": "2026-01-01", "price": "0.6000", "price_mode": "ex_vat", "replace_version_id": t["versions"][0]["id"]}
    plan = w.c.post(f"/api/v1/energy/tariffs/{t['id']}/versions", json=body)
    assert plan.status_code == 200, plan.text
    strict_fit(EW.EnergyPlanPreview, plan.json())
    done = w.c.post(f"/api/v1/energy/tariffs/{t['id']}/versions", json={**body, "confirm": True})
    assert done.status_code == 200, done.text
    strict_fit(EW.EnergyTariffCorrected, done.json())


def test_water_bill_create_and_correct_fit_their_models(app):  # noqa: F811 - the imported fixture
    c, st = app
    ids = water_setup(c, st)
    acc = water_account(c, ids, "דירה 12", {"m": ids["apt"]})
    b = water_bill(c, acc["id"], "req-wire-0003")
    strict_fit(WW.WaterBill, b)
    again = c.post(f"/api/v1/infra/water/accounts/{acc['id']}/bills", json={"period": {"from": "2026-09-01", "to": "2026-09-30"}, "client_request_id": "req-wire-0003"})
    assert again.status_code == 200
    strict_fit(WW.WaterBill, again.json())
    r = c.post(f"/api/v1/infra/water/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": "issue-wire-1"})
    assert r.status_code == 200, r.text
    corr = c.post(f"/api/v1/infra/water/bills/{b['id']}/correct", json={"client_request_id": "correct-wire-1"})
    assert corr.status_code == 201, corr.text
    strict_fit(WW.WaterBill, corr.json())


# ---------------------------------------------------------------- routes no other test reaches: through the oracle here

def _through_oracle(*keys: str) -> None:
    missing = [k for k in keys if not wire_oracle.CHECKED.get(k)]
    assert not missing, f"never compared by the oracle: {missing}"


def test_energy_routes_without_another_test_answer_as_before(w):  # noqa: F811 - the imported fixture
    golden_readings(w)
    s = setup_billing(w)
    aid, tid = s["account"]["id"], s["tariff"]["id"]
    api = "/api/v1/energy"
    assert w.c.get(f"{api}/accounts/{aid}/periods").status_code == 200
    d = draft(w, aid, SEPT)
    assert d.status_code == 201, d.text
    assert w.c.get(f"{api}/accounts/{aid}/periods").status_code == 200
    assert w.c.get(f"{api}/accounts/{aid}/bills").status_code == 200
    r = w.c.patch(f"{api}/tariffs/{tid}", json={"name": "תעריף מעודכן"})
    assert r.status_code == 200, r.text
    _through_oracle(f"GET {api}/accounts/{{aid}}/periods", f"GET {api}/accounts/{{aid}}/bills", f"PATCH {api}/tariffs/{{tid}}")


def test_water_routes_without_another_test_answer_as_before(app):  # noqa: F811 - the imported fixture
    c, st = app
    api = "/api/v1/infra/water"
    ids = water_setup(c, st)
    acc = water_account(c, ids, "דירה 12", {"m": ids["apt"]})
    aid, cid, tid = acc["id"], ids["customer"]["id"], ids["tariff"]["id"]
    for path in ("customers", "customers/next-number", f"accounts/{aid}", f"accounts/{aid}/history", f"accounts/{aid}/bills", f"meters/{ids['apt']}/manual-readings"):
        r = c.get(f"{api}/{path}")
        assert r.status_code == 200, (path, r.text)
    r = c.patch(f"{api}/customers/{cid}", json={"base_revision": ids["customer"]["revision"], "phone": "000-0000000"})
    assert r.status_code == 200, r.text
    assert c.patch(f"{api}/tariffs/{tid}", json={"name": "מים וביוב - מעודכן"}).status_code == 200
    r = c.post(f"{api}/tariffs/{tid}/versions", json={"effective_from": "2026-12-01", "water_price": "11.00", "sewage_price": "5.10"})
    assert r.status_code == 201, r.text
    r = c.patch(f"{api}/accounts/{aid}", json={"base_revision": acc["revision"], "name": "דירה 12 - מעודכן"})
    assert r.status_code == 200, r.text
    b = water_bill(c, aid, "req-wire-0004")
    assert c.get(f"{api}/bills/{b['id']}/events").status_code == 200
    r = c.post(f"{api}/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": "issue-wire-2"})
    assert r.status_code == 200, r.text
    r = c.post(f"{api}/bills/{b['id']}/void", json={"reason": "בדיקת חוזה"})
    assert r.status_code == 200, r.text
    garden = c.get(f"{api}/meters/{ids['garden']}").json()
    # BACKEND-SUITE-COST-2560: one second after the counter life began, as test_route_char_consumption_2460.py does. With `at`
    # omitted (= now) a fast run replaced the meter in its creation second, which the service refuses by design (422).
    import datetime as _dt

    started = _dt.datetime.strptime(garden["epochs"][0]["started_at"][:19], "%Y-%m-%dT%H:%M:%S")
    at = (started + _dt.timedelta(seconds=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    r = c.post(f"{api}/meters/{ids['garden']}/replace", json={"revision": garden["revision"], "at": at})
    assert r.status_code == 200, r.text
    r = c.delete(f"{api}/meters/{ids['garden']}?revision={r.json()['revision']}")
    assert r.status_code == 200, r.text
    r = c.put(f"{api}/alerts", json={"snooze": {"durations": [15, 60], "default": 60, "max": 10080}})
    assert r.status_code == 200, r.text
    _through_oracle(f"GET {api}/customers", f"GET {api}/customers/next-number", f"GET {api}/accounts/{{aid}}", f"GET {api}/accounts/{{aid}}/history",
                    f"GET {api}/accounts/{{aid}}/bills", f"GET {api}/meters/{{meter_id}}/manual-readings", f"PATCH {api}/customers/{{cid}}",
                    f"PATCH {api}/tariffs/{{tid}}", f"POST {api}/tariffs/{{tid}}/versions", f"PATCH {api}/accounts/{{aid}}", f"GET {api}/bills/{{bid}}/events",
                    f"POST {api}/bills/{{bid}}/void", f"POST {api}/meters/{{meter_id}}/replace", f"DELETE {api}/meters/{{meter_id}}", f"PUT {api}/alerts")
