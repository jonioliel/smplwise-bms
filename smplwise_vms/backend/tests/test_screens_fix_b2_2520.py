"""SCREENS-FIX-B2-2520: `GET /me/calendar` gives each pending request its revision (additive), so the home interface can withdraw a
request it holds no booking row of (it sent `{}` and got 409 "stale")."""
from __future__ import annotations

from test_calendar_engine_2300 import API, T, _app, book, cc, enable, members, ok, room, user  # noqa: F401 - `_app` / `cc` are fixtures

from smplwise.wire import calendar as W


def test_my_pending_request_carries_its_revision_and_is_withdrawn_with_it(cc):  # noqa: F811
    enable(cc)
    a = room(cc, approval_mode="always")
    op = user(cc, "ofra")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-ofra", "cal_role": "book"}])
    ev = ok(book(cc, a, T(3, 10), T(3, 11), op), 201)["event"]
    mine = ok(cc.get(f"{API}/me/calendar", headers=op))
    p = next(x for x in mine["pending"] if x["event_id"] == ev["id"])
    assert p["revision"] == ev["revision"] and isinstance(p["revision"], int)
    assert set(p) == {"event_id", "title", "start", "end", "calendar_id", "revision"}  # additive: every earlier key is still there
    # the old home body: no revision -> the server's 409 "stale" (unchanged)
    r = cc.post(f"{API}/calendar/events/{ev['id']}/withdraw", json={}, headers=op)
    assert r.status_code == 409 and r.json()["code"] == "stale"
    # with the revision of the pending item: withdrawn
    out = ok(cc.post(f"{API}/calendar/events/{ev['id']}/withdraw", json={"revision": p["revision"]}, headers=op))
    assert out["event"]["state"] == "withdrawn"
    assert all(x["event_id"] != ev["id"] for x in ok(cc.get(f"{API}/me/calendar", headers=op))["pending"])


def test_the_revision_follows_a_change_of_the_request(cc):  # noqa: F811
    """The pending item's revision is the request's current one: after the request changed, the item read again withdraws it."""
    enable(cc)
    a = room(cc, approval_mode="always")
    op = user(cc, "ofra")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-ofra", "cal_role": "book"}])
    ev = ok(book(cc, a, T(4, 10), T(4, 11), op), 201)["event"]
    ok(cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": ev["revision"], "title": "ישיבת ועד"}, headers=op))
    p = next(x for x in ok(cc.get(f"{API}/me/calendar", headers=op))["pending"] if x["event_id"] == ev["id"])
    assert p["revision"] == ev["revision"] + 1
    assert cc.post(f"{API}/calendar/events/{ev['id']}/withdraw", json={"revision": ev["revision"]}, headers=op).status_code == 409
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/withdraw", json={"revision": p["revision"]}, headers=op))


def test_the_wire_model_declares_the_revision():
    assert W.CalPending.model_fields["revision"].annotation is int
