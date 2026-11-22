"""CR-RESPONSE-MODELS-C-2470: the calendars API (routers/calendar.py) answers through its response models (smplwise/wire/calendar.py).

The module state and settings routes live on `open_router` (they answer while the module is off), which the route-table test
(test_wire_routers_c_2470.py, `router` only) does not see: they are checked here, and the generator writes them into
wire-calendar.ts (scripts/gen_wire_types.py EXTRA_ROUTERS). The two JSON routes no other test answered successfully - restoring an
archived calendar and the booking preview - go through the wire oracle here (status, refusals, audit)."""
from __future__ import annotations

import datetime as dt
import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from conftest import as_user, bind
from smplwise.config import Settings
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.routers import calendar as cal_router
from smplwise.wire import calendar as W
from support import wire_oracle

API = "/api/v1"
ROOT = Path(__file__).resolve().parents[3]
NOW = dt.datetime(2026, 10, 5, 9, 0, tzinfo=dt.timezone.utc)  # a Monday


def _gen():
    spec = importlib.util.spec_from_file_location("gen_wire_types", ROOT / "scripts" / "gen_wire_types.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules.setdefault("gen_wire_types", mod)
    spec.loader.exec_module(mod)
    return mod


class Oracle:
    def __init__(self) -> None:
        self.before = dict(wire_oracle.CHECKED)

    def compared(self, *keys: str) -> None:
        missing = [k for k in keys if wire_oracle.CHECKED.get(k, 0) <= self.before.get(k, 0)]
        assert not missing, f"never compared by the oracle in this test: {missing}"


def test_open_router_routes_declare_their_models_and_reach_the_generated_types():
    gen = _gen()
    text = (ROOT / "frontend" / "src" / "api" / "generated" / "wire-calendar.ts").read_text(encoding="utf-8")
    keys = []
    for r in cal_router.open_router.routes:
        assert isinstance(r, APIRoute)
        for m in sorted(r.methods - {"HEAD", "OPTIONS"}):
            key = f"{m} {r.path}"
            keys.append(key)
            assert key not in W.NO_JSON
            assert gen.wire_models(r.response_model) and r.response_model_exclude_unset, key
            assert f'"{m} /api/v1{r.path}"' in text, key
    assert sorted(keys) == ["GET /calendar/module", "GET /calendar/settings", "POST /calendar/guests/purge", "PUT /calendar/settings"]


@pytest.fixture(scope="module")
def _app(tmp_path_factory):
    st = Settings(data_dir=tmp_path_factory.mktemp("calwire2470") / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni",
                  bootstrap_admin_username="joni", nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None,
                  log_level="warning", max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300)
    c = TestClient(create_app(st))
    c.settings_obj = st
    c.get(f"{API}/me")
    return c


@pytest.fixture()
def cc(_app, monkeypatch):
    monkeypatch.setattr(cal_router, "_now", lambda: NOW)
    with Database(_app.settings_obj.db_path).connection() as c:
        for t in ("cal_notices", "cal_occurrences", "cal_guest_details", "cal_approvals", "cal_event_rooms", "cal_events", "cal_members", "cal_sync_map", "cal_sync_bindings", "cal_calendars"):
            c.execute(f"DELETE FROM {t}")
        c.execute("DELETE FROM bindings WHERE assigned_by = 'test'")
        c.execute("DELETE FROM settings WHERE key LIKE 'calendar.%'")
    r = _app.put(f"{API}/calendar/settings", json={"enabled": True})
    assert r.status_code == 200, r.text
    return _app


def ok(r, code=200):
    assert r.status_code == code, r.text
    return r.json()


def audit(c, action, decision="allowed"):
    with Database(c.settings_obj.db_path).connection(mode="read") as conn:
        return conn.execute("SELECT resource_id, details_json FROM audit_log WHERE action = ? AND decision = ? ORDER BY rowid", (action, decision)).fetchall()


def room(c, name="חדר א", **kw):
    return ok(c.post(f"{API}/calendar/calendars", json={"name": name, "type": "room", "color": "blue", "capacity": 10, "buffer_after_min": 0, **kw}), 201)["calendar"]


def test_restore_an_archived_calendar(cc):
    o = Oracle()
    cal = room(cc)
    viewer = as_user("vic")
    bind(cc, cc.settings_obj, "vic", "viewer", "installation", "*")
    archived = ok(cc.post(f"{API}/calendar/calendars/{cal['id']}/archive", json={"revision": cal["revision"]}))
    assert archived["calendar"]["archived"] is True and archived["cancelled"] == 0
    # a viewer may not restore (the audited 403); the calendar stays archived
    r = cc.post(f"{API}/calendar/calendars/{cal['id']}/restore", headers=viewer)
    assert r.status_code in (403, 404), r.text
    assert ok(cc.get(f"{API}/calendar/calendars?include_archived=1"))["calendars"][0]["archived"] is True
    out = ok(cc.post(f"{API}/calendar/calendars/{cal['id']}/restore"))
    assert out["calendar"]["id"] == cal["id"] and out["calendar"]["archived"] is False and out["calendar"]["revision"] == archived["calendar"]["revision"] + 1
    assert set(out) == {"calendar"}
    assert [r["resource_id"] for r in audit(cc, "calendar.calendar.restore")] == [cal["id"]]
    assert cc.post(f"{API}/calendar/calendars/cal_unknown/restore").status_code == 404
    # a second calendar took the name meanwhile: the restore is refused (409), nothing changes
    ok(cc.post(f"{API}/calendar/calendars/{cal['id']}/archive", json={"revision": out["calendar"]["revision"]}))
    room(cc)
    assert cc.post(f"{API}/calendar/calendars/{cal['id']}/restore").json()["code"] == "name_taken"
    o.compared("POST /api/v1/calendar/calendars/{cid}/archive", "POST /api/v1/calendar/calendars/{cid}/restore")


def test_booking_preview(cc):
    o = Oracle()
    cal = room(cc)
    body = {"calendar_id": cal["id"], "title": "פגישה", "start": "2026-11-03T10:00:00Z", "end": "2026-11-03T11:00:00Z"}
    free = ok(cc.post(f"{API}/calendar/events/preview", json=body))
    assert free["conflicts"] == [] and free["needs_approval_by"] == [] and free["contested"] is False and free["capacity_ok"] is True
    assert list(free) == ["conflicts", "needs_approval_by", "contested", "outside_hours", "holiday_hits", "capacity_ok", "suggestions"]
    booked = ok(cc.post(f"{API}/calendar/events", json=body), 201)
    taken = ok(cc.post(f"{API}/calendar/events/preview", json=body))
    assert [c["event_id"] for c in taken["conflicts"]] == [booked["event"]["id"]]
    assert set(taken["conflicts"][0]) == {"event_id", "calendar_id", "start", "end", "state"}
    assert all(set(s) == {"start", "end"} for s in taken["suggestions"])
    # a person who may not book in the calendar is refused (the audited 403); preview writes nothing
    bind(cc, cc.settings_obj, "vic", "viewer", "installation", "*")
    r = cc.post(f"{API}/calendar/events/preview", json=body, headers=as_user("vic"))
    assert r.status_code in (403, 404), r.text
    with Database(cc.settings_obj.db_path).connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM cal_events").fetchone()[0] == 1
    o.compared("POST /api/v1/calendar/events/preview", "POST /api/v1/calendar/events")
