"""2.4.4 (owner 2026-10-10): the CR-021 self-update switch `update.apply_enabled` (Settings > Updates).

Default ON (today's behaviour). OFF: `POST /system/update/apply` is refused with 409 `self_update_disabled` before the infrastructure is
asked anything and before a run row exists; the refusal is audited; the Updates page data says `apply_enabled: false`. The check, the
interval and the platform restart keep working, and the switch can always be turned back on (it lives in PATCH /settings, never behind
the update path). Changing it needs system.configure and writes its own audit row. A fake Supervisor (frontend/tests/fixtures) stands in
for the infrastructure; nothing real is reached."""
from __future__ import annotations

import json

from conftest import as_user
from test_self_update import NEWER, sup, world  # noqa: F401 - fixtures
from test_self_update_s3 import KEY, SAME_ORIGIN, apply_body, audit_rows, j, rig  # noqa: F401 - fixtures

from smplwise.services import self_update, update_runs


def _switch(c, value: str, user: str = "joni"):
    return c.patch("/api/v1/settings", headers=as_user(user), json={"update.apply_enabled": value})


def test_default_is_on_and_the_state_says_so(rig):
    app, c, *_ = rig
    assert c.get("/api/v1/settings", headers=as_user("joni")).json()["settings"]["update.apply_enabled"] == "true"
    assert j(c, "get", "/state").json()["apply_enabled"] is True
    with app.state.db.connection(mode="read") as conn:
        assert self_update.apply_enabled(conn) is True


def test_off_refuses_apply_before_anything_is_sent_and_on_again_restores_it(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    r = _switch(c, "false")
    assert r.status_code == 200 and r.json()["settings"]["update.apply_enabled"] == "false"
    assert j(c, "get", "/state").json()["apply_enabled"] is False

    r = j(c, "post", "/apply", json=apply_body())
    assert r.status_code == 409 and r.json()["code"] == "self_update_disabled", r.text
    assert "תשתית המערכת" in r.json()["user_message"] and "Home Assistant" not in r.json()["user_message"]
    assert sup.log == [], "nothing is asked of the infrastructure"
    assert drain() == 0
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT count(*) FROM update_runs").fetchone()[0] == 0
    denied = [x for x in audit_rows(app, "system.update.apply") if x["decision"] == "denied"]
    assert denied and denied[-1]["reason"] == "self_update_disabled"

    # the rest of the Updates page keeps working: the manual check, the interval, the platform restart
    assert j(c, "post", "/check").status_code == 200
    assert j(c, "put", "/settings", json={"interval_hours": 12}).status_code == 200
    r = c.post("/api/v1/system/update/restart-platform", headers={**as_user("joni"), **SAME_ORIGIN}, json={"confirm": True, "idempotency_key": "r-0000000001"})
    assert r.status_code == 202, r.text

    # never a lock-out: the switch goes back on through settings and apply works again (after the restart run is closed)
    drain()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE update_runs SET state = 'succeeded', finished_at = '2026-10-10T00:00:00Z' WHERE state NOT IN ('succeeded', 'failed', 'abandoned')")
    assert _switch(c, "true").status_code == 200
    sup.log.clear()
    r = j(c, "post", "/apply", json=apply_body(key="k-0000000002"))
    assert r.status_code == 202, r.text


def test_switched_off_between_the_request_and_the_send_never_sends(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    assert _switch(c, "false").status_code == 200  # the worker has not run yet
    drain()
    with app.state.db.connection(mode="read") as conn:
        row = dict(update_runs.get_run(conn, run_id))
    assert (row["state"], row["error_code"]) == ("failed", "self_update_disabled")
    assert not [b for b in sup.bodies if b[0] == "POST" and b[1].startswith("/store/addons/")], "the update call is never made"


def test_a_replayed_key_still_returns_its_run_when_switched_off(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    first = j(c, "post", "/apply", json=apply_body())
    assert first.status_code == 202
    assert _switch(c, "false").status_code == 200
    again = j(c, "post", "/apply", json=apply_body())
    assert again.status_code == 200 and again.json()["run_id"] == first.json()["run_id"], "a replay starts nothing new"


def test_only_system_configure_changes_it_validated_and_audited(rig):
    app, c, *_ = rig
    for user in ("vera", "olga", "sam", "nobody"):
        assert _switch(c, "false", user).status_code == 403, user
    assert _switch(c, "off").status_code == 422
    assert _switch(c, "false").status_code == 200
    assert _switch(c, "false").status_code == 200  # unchanged: no second switch row
    assert _switch(c, "true").status_code == 200
    rows = audit_rows(app, "system.update.apply_enabled")
    assert [json.loads(r["details_json"])["to"] for r in rows] == [False, True]
    with app.state.db.connection(mode="read") as conn:
        n = conn.execute("SELECT count(*) FROM audit_log WHERE action = 'settings.update' AND details_json LIKE '%update.apply_enabled%'").fetchone()[0]
    assert n == 3
