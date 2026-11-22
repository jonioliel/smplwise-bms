"""CR-RESPONSE-MODELS-C-2470: the recorder connection routes no other test called successfully - `POST /recorders/{id}/connection/test`
and `PUT /recorders/{id}/connection` - answered through their response models (smplwise/wire/recorders.py) under the wire oracle
(SW_WIRE_STRICT=1, conftest): the modelled answer equals the route's own dict, key for key and type for type.

Every device is a fake (tests/fixtures/fake_devices.py through test_multi_nvr's fixtures); the passwords are made-up canaries."""
from __future__ import annotations

import json

from conftest import as_user, bind
from fastapi.testclient import TestClient

from support import wire_oracle
from test_multi_nvr import ADD, PW2, base, fakes, rows, two_recorders  # noqa: F401 - base / fakes are fixtures

FIELDS = ("vendor", "host", "http_port", "rtsp_port", "username")


def test_a_recorders_connection_test_answers_coarsely_through_its_model_and_is_audited(base, fakes):  # noqa: F811
    app, c = two_recorders(base, fakes)
    body = {**{k: ADD[k] for k in FIELDS}, "password": PW2}
    before = wire_oracle.CHECKED.get("POST /api/v1/recorders/{recorder_id}/connection/test", 0)
    r = c.post("/api/v1/recorders/nvr-2/connection/test", json=body)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["ok"] is True and out["code"] == "ok"
    assert not [k for k in out if k.startswith("_")], "the device serial never leaves the server"
    assert PW2 not in r.text
    assert wire_oracle.CHECKED.get("POST /api/v1/recorders/{recorder_id}/connection/test", 0) == before + 1, "compared by the oracle"
    (row,) = rows(base, "SELECT decision, details_json FROM audit_log WHERE action = 'nvr.connection.test' AND resource_id = 'connection:nvr-2' ORDER BY id DESC LIMIT 1")
    assert row["decision"] == "allowed" and json.loads(row["details_json"])["outcome"] == "ok"
    # the stored password stands in when none is typed
    r = c.post("/api/v1/recorders/nvr-2/connection/test", json={**{k: ADD[k] for k in FIELDS}, "use_stored_password": True})
    assert r.status_code == 200 and r.json()["ok"] is True, r.text
    # an operator may not test (system.configure), and the refusal is audited; an unknown recorder is a 404 for the administrator
    bind(c, base, "olga", "operator", "installation", "*")
    u = TestClient(app)
    u.headers.update(as_user("olga"))
    assert u.post("/api/v1/recorders/nvr-2/connection/test", json=body).status_code == 403
    assert rows(base, "SELECT COUNT(*) AS n FROM audit_log WHERE decision = 'denied' AND actor_username = 'olga'")[0]["n"] >= 1
    assert c.post("/api/v1/recorders/nvr-9/connection/test", json=body).status_code == 404


def test_saving_a_recorders_connection_answers_the_view_through_its_model(base, fakes):  # noqa: F811
    app, c = two_recorders(base, fakes)
    view = c.get("/api/v1/recorders/nvr-2/connection").json()
    body = {**{k: ADD[k] for k in FIELDS}, "password": PW2, "if_revision": view["revision"]}
    before = wire_oracle.CHECKED.get("PUT /api/v1/recorders/{recorder_id}/connection", 0)
    r = c.put("/api/v1/recorders/nvr-2/connection", json=body)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["saved"] is True and out["restart_required"] is True and out["recorder_id"] == "nvr-2"
    assert out["revision"] == view["revision"] + 1 and out["host"] == ADD["host"] and out["has_password"] is True
    assert out["device"] is not None and out["untested"] is False
    assert PW2 not in r.text
    assert wire_oracle.CHECKED.get("PUT /api/v1/recorders/{recorder_id}/connection", 0) == before + 1, "compared by the oracle"
    assert rows(base, "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'nvr.connection.update' AND decision = 'allowed'")[0]["n"] >= 1
    # the old revision is stale now
    r = c.put("/api/v1/recorders/nvr-2/connection", json=body)
    assert r.status_code == 409, r.text
