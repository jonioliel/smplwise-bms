"""CR-RESPONSE-MODELS-C-2470: `GET /tickets/costs/departments` (the Settings tab's department defaults) had no test that read it; the wire
oracle (conftest, SW_WIRE_STRICT=1) compares its modelled answer with the route's own dict here. The PUT answers the same document."""
from __future__ import annotations

import pytest

from support import wire_oracle
from tickets_s4_world import API, build_s4


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def test_department_cost_defaults_through_the_oracle(s4):
    before = wire_oracle.CHECKED.get("GET /api/v1/tickets/costs/departments", 0)
    r = s4.c.get(f"{API}/tickets/costs/departments")
    assert r.status_code == 200, r.text
    assert wire_oracle.CHECKED.get("GET /api/v1/tickets/costs/departments", 0) == before + 1
    body = r.json()
    assert list(body) == ["departments", "installation"]
    dept = next(d for d in body["departments"] if d["id"] == "dept-maintenance")
    assert type(dept["active"]) is int and dept["allowed_line_kinds"] is None
    put = s4.c.put(f"{API}/tickets/costs/departments/dept-maintenance", json={"cost_claim": "optional"})
    assert put.status_code == 200, put.text
    assert next(d for d in put.json()["departments"] if d["id"] == "dept-maintenance")["cost_claim"] == "optional"
    assert put.json()["installation"] == body["installation"]
