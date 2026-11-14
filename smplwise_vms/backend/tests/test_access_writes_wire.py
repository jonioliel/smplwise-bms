"""CR-036 S11: the wire shapes of the person writes the native people screen is built on.

The writes are tested in Playwright against a MOCKED backend (frontend/tests/wiskey-writes-mock.ts) whose answers have the shapes of
`frontend/tests/fixtures/access_writes_wire.json`. A mock that quietly drifts from the server would prove nothing, so the node spec
frontend/tests/unit-people-writes-wire.spec.ts holds the mock to the fixture, and this test holds the fixture to the REAL endpoints
(routers/access_control.py, routers/access_control_writes.py) over the add-on's live service session against the stateful fake WisKey
(tests/fake_wiskey.py) - nothing here contacts a device, a station, Home Assistant or WisKey.

The comparison is test_access_control_wire's: the same set of keys, the same scalar type (a `null` on either side is "any scalar"), an
empty list matches any list; the dicts whose KEYS are data (a station id) are compared by the shape of their values. The fixture's
invented values are not compared - only the shape.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_access_control_wire import merge_all, mismatches
from test_intercom_writes_s11 import API, PHOTO, SENTINEL_PIN, env, post, rev, wx  # noqa: F401 - wx is a fixture

from smplwise.services import intercom_writes as iw

FIXTURE = Path(__file__).resolve().parents[3] / "frontend" / "tests" / "fixtures" / "access_writes_wire.json"

# paths (dotted, from the top of a reply) whose dict KEYS are data (station ids): compared by the merged shape of their values
FREE_KEYS = {"person.permission_overrides", "person.timing_policy.bindings"}

WEEKLY = {"mode": "weekly", "timezone": "Asia/Jerusalem", "days": ["Thursday", "Sunday"], "dates": [], "periods": [{"start": "08:00", "end": "12:00"}]}
NATIVE = {"mode": "native", "schedule": {"mode": "dates", "timezone": "Asia/Jerusalem", "days": [], "dates": ["2026-12-01", "2026-12-02", "2026-12-05"],
                                         "periods": [{"start": "08:00", "end": "24:00"}]},
          "bindings": {"entry-a": {"template": 5, "weekly": 6, "holiday_group": 7, "holidays": [8, 9]}}}


def shape(value: Any, path: str = "") -> Any:
    if value is None:
        return "any"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "str"
    if isinstance(value, list):
        return ["empty"] if not value else [merge_all([shape(v, path) for v in value])]
    if isinstance(value, dict):
        if path in FREE_KEYS:
            return {"*": merge_all([shape(v, path + ".*") for v in value.values()]) if value else "any"}
        return {k: shape(v, f"{path}.{k}" if path else k) for k, v in value.items()}
    raise AssertionError(f"not JSON: {type(value)}")


@pytest.fixture(scope="module")
def wire() -> dict[str, Any]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def ok(r: Any) -> dict[str, Any]:
    assert r.status_code == 200, r.text
    return r.json()


def test_the_write_replies_the_mock_uses_have_the_servers_shape(wx, wire):  # noqa: F811
    fake, c, _s = wx
    # a timing on both people first (the proposal on u6, the device-enforced policy on u7), so the timing objects are compared, not "any"
    ok(c.put(API + "/people/u6", json=env(data={"access_timing_draft": WEEKLY}, revision=rev(fake, "u6")), headers=as_user("root")))
    ok(c.put(API + "/people/u7", json=env(data={"access_timing_policy": NATIVE}, revision=rev(fake, "u7")), headers=as_user("root")))
    real: dict[str, Any] = {
        "editor_context": shape(ok(c.get(API + "/people-editor/context", headers=as_user("mia")))),
        "editor_person": merge_all([shape(ok(c.get(API + f"/people/{u}/editor", headers=as_user("root")))) for u in ("u6", "u7")]),
        "editor_person_names": shape(ok(c.get(API + "/people/u6/editor", headers=as_user("nina")))),
        "write_reply": merge_all([
            shape(ok(post(c, "/people/u6/cards", "mia", card_no="AB12", label="L", revision=rev(fake, "u6")))),
            shape(ok(post(c, "/people/u6/active", "mia", active=False, revision=rev(fake, "u6")))),
            shape(ok(c.put(API + "/people/u6/photo", json=env(photo=PHOTO, revision=rev(fake, "u6")), headers=as_user("mia")))),
            shape(ok(post(c, "/people/u6/archive", "mia", revision=rev(fake, "u6"), confirmed=True))),
        ]),
        "save_reply": shape(ok(c.put(API + "/people/u6", json=env(data={"display_name": "Gal B"}, revision=rev(fake, "u6")), headers=as_user("mia")))),
    }
    fake.pin_value = SENTINEL_PIN
    real["pin_reply"] = shape(ok(c.post(API + "/people/pin-generate", json={"user_id": "u6"}, headers=as_user("mia"))))
    real["delete_reply"] = shape(ok(post(c, "/people/u7/delete", "root", revision=rev(fake, "u7"), confirmed=True)))
    problems = []
    for name, server in real.items():
        mock = {**wire[name], "sync": wire["sync"]}
        problems += [f"{name}: {p}" for p in mismatches(server, shape(mock))]
    assert not problems, "the write replies drifted from the server:\n  " + "\n  ".join(problems)


def test_the_mock_error_bodies_are_the_servers(wx, wire):  # noqa: F811
    fake, c, _s = wx
    real: dict[str, Any] = {}
    r = post(c, "/people/u1/active", "mia", active=False, revision=rev(fake, "u1"))  # u1 is shared with a station outside mia's chain
    assert r.status_code == 403
    real["scope"] = r.json()
    ok(post(c, "/people/u6/archive", "mia", revision=rev(fake, "u6"), confirmed=True))
    r = post(c, "/people/u6/archive", "mia", revision=rev(fake, "u6"), confirmed=True)
    assert r.status_code == 409
    real["refused"] = r.json()
    fake.errors_once["users/unarchive"] = "storage_write_failed"
    r = post(c, "/people/u6/unarchive", "mia", revision=rev(fake, "u6"), confirmed=True)
    assert r.status_code == 504
    real["unknown"] = r.json()
    r = c.get(API + "/people/u-none/editor", headers=as_user("root"))
    assert r.status_code == 404
    real["not_found"] = r.json()
    r = post(c, "/people/u6/active", "otto", active=False, revision=1)
    assert r.status_code == 403
    real["forbidden"] = r.json()
    for key, body in real.items():
        mock = wire["errors"][key]
        assert mock["code"] == body["code"], key
        assert mock["details"].get("outcome") == body["details"].get("outcome"), key
        assert not mismatches(shape(body), shape(mock)), (key, mismatches(shape(body), shape(mock)))


def test_the_fixture_effects_are_the_servers(wire):
    """The effect classes the mock answers with are the server's: a delete is UNKNOWN_EFFECT and pending, the rest `sync`."""
    assert (wire["delete_reply"]["effect"], wire["delete_reply"]["pending"]) == (iw.EFFECT_OF["users/delete"], True) == (iw.UNKNOWN_EFFECT, True)
    for name in ("write_reply", "save_reply"):
        assert (wire[name]["effect"], wire[name]["pending"]) == (iw.SYNC, False), name
    assert wire["editor_person"]["person"]["level"] == "sensitive" and wire["editor_person_names"]["person"]["level"] == "names"
    names = wire["editor_person_names"]["person"]
    assert all(names[k] is None for k in iw.EDITOR_SENSITIVE_KEYS), "below the sensitive level these are null (not shown), never empty"
