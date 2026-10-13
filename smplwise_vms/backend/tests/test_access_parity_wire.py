"""CR-036 S12: the parity report's mock (frontend/tests/fixtures/access_parity_wire.json, served by frontend/tests/access-parity-mocks.ts)
has exactly the keys and value types the real GET /api/v1/access-control/parity produces - against the fake WisKey, nothing here contacts a
device, a station, Home Assistant or WisKey. The same comparison rules as tests/test_access_control_wire.py (S8 / S10)."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_access_control_wire import mismatches, shape
from test_intercom_adapter import ac  # noqa: F401 - a fixture

from smplwise.services import intercom_parity

FIXTURE = Path(__file__).resolve().parents[3] / "frontend" / "tests" / "fixtures" / "access_parity_wire.json"


@pytest.fixture(scope="module")
def wire() -> dict[str, Any]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.mark.parametrize("name,params", [("admin", {}), ("operator", {"as_user": "dev-sara", "hours": 168})])
def test_the_mock_report_has_the_shape_of_the_real_endpoint(ac, wire, monkeypatch, name, params):  # noqa: F811
    _fake, c, _s = ac
    monkeypatch.setattr(intercom_parity, "_now", lambda: datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc))
    r = c.get("/api/v1/access-control/parity", headers=as_user("root"), params=params)
    assert r.status_code == 200, r.text
    real = r.json()
    mock = {**wire[name], "sync": json.loads((FIXTURE.parent / "access_control_wire.json").read_text(encoding="utf-8"))["sync"]}
    problems = mismatches(shape(real), shape(mock))
    assert not problems, f"{name} drifted from the server:\n  " + "\n  ".join(problems)
    # the mock's screens, outcomes and rules are the server's own words
    assert [s["screen"] for s in mock["parity"]["screens"]] == list(intercom_parity.SCREENS)
    assert {s["outcome"] for s in mock["parity"]["screens"]} <= set(intercom_parity.OUTCOMES)
    assert set(mock["parity"]["summary"]) == set(intercom_parity.OUTCOMES)
    assert {s["rule"] for s in mock["parity"]["screens"]} <= {None, "station_scope", "installation_wide", "permission"}


def test_the_mock_busy_error_is_the_servers(ac, wire):  # noqa: F811
    _fake, c, _s = ac
    assert intercom_parity._RUNNING.acquire(blocking=False)
    try:
        r = c.get("/api/v1/access-control/parity", headers=as_user("root"))
    finally:
        intercom_parity._RUNNING.release()
    assert r.status_code == 409
    assert r.json()["code"] == wire["busy"]["code"] and not mismatches(shape(r.json()), shape(wire["busy"]))
