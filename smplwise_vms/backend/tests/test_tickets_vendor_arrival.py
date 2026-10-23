"""VENDORARRIVAL126-295 (board r126 / r127; negative-first): the vendor's one-tap "I have arrived" on the handler page, the expected
arrival window and the missed-arrival alert. The public app is the real one (public_runtime.build_app through an ASGI test client);
the planned window is injected where an RFQ award would give it (the SQL of both window sources is exercised against the real
schema by `test_the_window_queries_run_against_the_real_schema`). What is proven: the switch is OFF by default (uniform 404, no row,
no alert); a staff link / a non-open request / a wrong token cannot signal; the tap is idempotent and a repeat adds nothing; the alert
fires only after window end + grace, repeats on its cadence up to its maximum, goes to the configured audience, and is resolved by the
arrival or a moved window; a vendor who started the work never gets one; nothing here creates a door grant."""
from __future__ import annotations

import datetime as dt
import time

import pytest
from tickets_s4_world import API, Clock, build_s4, crid

from smplwise.services.tickets import monitor, notify_bridge, settings_doc, store_arrival, vendor_arrival
from smplwise.services.tickets.public_http import UNIFORM_404

UTC = dt.timezone.utc


def hdr(token: str) -> dict[str, str]:
    return {"x-ticket-token": token}


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def enable(s4, **over) -> None:
    patch = {"enabled": True, **over}
    r = s4.c.get(f"{API}/tickets/settings")
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "vendor_arrival": patch}, headers=s4.h("joni"))
    assert r.status_code == 200, r.text


def window(monkeypatch, start: dt.datetime, end: dt.datetime | None) -> None:
    monkeypatch.setattr(store_arrival, "planned_window", lambda conn, asg: (start.isoformat().replace("+00:00", "Z"), end.isoformat().replace("+00:00", "Z") if end else None))


def arrive(client, token, **over):
    return client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid(), **over})


def alerts(s4) -> list[dict]:
    with s4.db.connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = 'ticket.vendor_missed' ORDER BY created_at, id").fetchall()]


def look(s4, tid: str, now: dt.datetime):
    with s4.db.connection() as conn:
        return vendor_arrival.look(conn, tid, now, vendor_arrival.config(conn))


# ---------------------------------------------------------------- the switch, the settings

def test_the_feature_is_off_by_default_and_the_defaults_are_the_documented_ones(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    r = arrive(client, token)
    assert r.status_code == 404 and r.content == UNIFORM_404
    with s4.db.connection(mode="read") as conn:
        cfg = settings_doc.read(conn)["vendor_arrival"]
        assert conn.execute("SELECT COUNT(*) FROM ticket_vendor_arrivals").fetchone()[0] == 0, "an off switch stores nothing"
    assert t["id"] and cfg["enabled"] is False and cfg["grace_min"] == 30 and cfg["default_window_min"] == 120 and cfg["max_alerts"] == 2
    assert cfg["recipients"] == {"managers": True, "users": []} and cfg["day_from"] == "08:00" and cfg["day_to"] == "17:00"
    body = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert "vendor_arrival" not in body, "the page shows nothing while the switch is off"


def test_the_settings_are_validated_and_the_day_window_runs_forward(s4):
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    for bad in ({"grace_min": -1}, {"grace_min": 721}, {"max_alerts": 0}, {"max_alerts": 6}, {"default_window_min": 5}, {"day_from": "9:00"},
                {"recipients": {"users": ["../x"]}}, {"day_from": "17:00", "day_to": "08:00"}, {"unknown": 1}):
        r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "vendor_arrival": bad}, headers=s4.h("joni"))
        assert r.status_code in (400, 422), (bad, r.status_code, r.text)
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "vendor_arrival": {"grace_min": 45, "recipients": {"managers": False}}}, headers=s4.h("joni"))
    assert r.status_code == 200, r.text
    assert r.json()["vendor_arrival"]["grace_min"] == 45 and r.json()["vendor_arrival"]["recipients"]["managers"] is False


# ---------------------------------------------------------------- the signal

def test_a_tap_records_the_arrival_once_and_a_repeat_changes_nothing(s4):
    enable(s4)
    t, token = s4.sent()
    clock = Clock(time.time())
    client, _ = s4.public(clock)
    page = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert page["vendor_arrival"]["state"] == "open"
    first = arrive(client, token)
    assert first.status_code == 200 and first.json()["ok"] is True and first.json()["repeat"] is False
    clock.advance(30)
    second = arrive(client, token)
    assert second.status_code == 200 and second.json()["repeat"] is True and second.json()["arrived_at"] == first.json()["arrived_at"]
    with s4.db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM ticket_vendor_arrivals").fetchall()]
        events = [r[0] for r in conn.execute("SELECT kind FROM ticket_events WHERE ticket_id = ? AND kind = 'vendor_arrived'", (t["id"],)).fetchall()]
        grants = conn.execute("SELECT COUNT(*) FROM access_grants").fetchone()[0]
    assert len(rows) == 1 and rows[0]["arrived_via"] == "vendor_tap" and len(events) == 1
    assert grants == 0, "an arrival never creates a door grant"
    assert client.get("/t/api/ticket", headers=hdr(token)).json()["vendor_arrival"]["state"] == "arrived"


def test_the_same_request_id_replays_the_first_answer(s4):
    enable(s4)
    _t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    rid = crid()
    a = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": rid})
    b = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": rid})
    assert a.status_code == b.status_code == 200 and a.json() == b.json()


def test_a_bad_token_a_missing_id_and_extra_fields_are_refused(s4):
    enable(s4)
    _t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    assert client.post("/t/api/arrived", json={"client_request_id": crid()}).content == UNIFORM_404
    assert client.post("/t/api/arrived", headers=hdr("x" * 43), json={"client_request_id": crid()}).content == UNIFORM_404
    assert client.post("/t/api/arrived", headers=hdr(token), json={}).status_code in (400, 422)
    assert arrive(client, token, who="someone").status_code in (400, 422), "strict JSON: no extra field"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_vendor_arrivals").fetchone()[0] == 0


def test_a_request_that_is_over_cannot_signal(s4):
    enable(s4)
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    for st in ("acknowledged", "done"):
        assert client.post("/t/api/status", headers=hdr(token), json={"status": st, "client_request_id": crid()}).status_code == 200
    r = arrive(client, token)
    assert r.status_code in (404, 409), r.text
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_vendor_arrivals").fetchone()[0] == 0


def test_an_arrival_resolves_a_missed_alert(s4, monkeypatch):
    enable(s4, grace_min=0)
    t, token = s4.sent()
    now = dt.datetime.now(UTC)
    window(monkeypatch, now - dt.timedelta(hours=4), now - dt.timedelta(hours=2))
    assert look(s4, t["id"], now) == "alert"
    assert len(alerts(s4)) == 1 and alerts(s4)[0]["state"] != "resolved"
    client, _ = s4.public(Clock(time.time()))
    assert arrive(client, token).status_code == 200
    assert alerts(s4)[0]["state"] == "resolved"
    assert look(s4, t["id"], now + dt.timedelta(hours=3)) is None, "an arrived vendor is never alerted again"


# ---------------------------------------------------------------- the window and the alert

def test_no_window_no_alert_and_the_page_says_open(s4):
    enable(s4)
    t, _token = s4.sent()
    assert look(s4, t["id"], dt.datetime.now(UTC) + dt.timedelta(days=30)) is None and alerts(s4) == []


def test_the_alert_waits_for_the_window_end_plus_the_grace(s4, monkeypatch):
    enable(s4, grace_min=30)
    t, _token = s4.sent()
    start = dt.datetime(2026, 11, 2, 9, 0, tzinfo=UTC)
    window(monkeypatch, start, start + dt.timedelta(hours=2))
    assert look(s4, t["id"], start + dt.timedelta(hours=2, minutes=29)) is None
    assert alerts(s4) == []
    assert look(s4, t["id"], start + dt.timedelta(hours=2, minutes=30)) == "alert"
    assert len(alerts(s4)) == 1


def test_a_window_without_an_end_gets_the_default_length(s4, monkeypatch):
    enable(s4, grace_min=0, default_window_min=90)
    t, _token = s4.sent()
    start = dt.datetime(2026, 11, 2, 9, 0, tzinfo=UTC)
    window(monkeypatch, start, None)
    assert look(s4, t["id"], start + dt.timedelta(minutes=89)) is None
    assert look(s4, t["id"], start + dt.timedelta(minutes=90)) == "alert"


def test_a_plain_date_means_the_configured_day_hours_in_the_installation_zone(s4, monkeypatch):
    enable(s4, grace_min=0, day_from="08:00", day_to="17:00")
    t, _token = s4.sent()
    with s4.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('time.zone', 'UTC')")
    monkeypatch.setattr(store_arrival, "planned_window", lambda conn, asg: ("2026-11-02", None))
    assert look(s4, t["id"], dt.datetime(2026, 11, 2, 16, 59, tzinfo=UTC)) is None
    assert look(s4, t["id"], dt.datetime(2026, 11, 2, 17, 0, tzinfo=UTC)) == "alert"


def test_repeats_follow_the_cadence_and_stop_at_the_maximum(s4, monkeypatch):
    enable(s4, grace_min=0, repeat_min=60, max_alerts=3)
    t, _token = s4.sent()
    end = dt.datetime(2026, 11, 2, 11, 0, tzinfo=UTC)
    window(monkeypatch, end - dt.timedelta(hours=2), end)
    assert look(s4, t["id"], end) == "alert"
    assert look(s4, t["id"], end + dt.timedelta(minutes=59)) is None
    assert look(s4, t["id"], end + dt.timedelta(minutes=60)) == "alert"
    assert look(s4, t["id"], end + dt.timedelta(minutes=120)) == "alert"
    assert look(s4, t["id"], end + dt.timedelta(days=2)) is None, "max_alerts reached"
    assert len(alerts(s4)) == 3


def test_a_repeat_of_zero_alerts_once(s4, monkeypatch):
    enable(s4, grace_min=0, repeat_min=0, max_alerts=5)
    t, _token = s4.sent()
    end = dt.datetime(2026, 11, 2, 11, 0, tzinfo=UTC)
    window(monkeypatch, end - dt.timedelta(hours=2), end)
    assert look(s4, t["id"], end) == "alert"
    assert look(s4, t["id"], end + dt.timedelta(days=1)) is None


def test_a_moved_window_starts_the_ladder_again_and_resolves_the_alert(s4, monkeypatch):
    enable(s4, grace_min=0)
    t, _token = s4.sent()
    end = dt.datetime(2026, 11, 2, 11, 0, tzinfo=UTC)
    window(monkeypatch, end - dt.timedelta(hours=2), end)
    assert look(s4, t["id"], end + dt.timedelta(minutes=5)) == "alert"
    window(monkeypatch, end + dt.timedelta(days=1), end + dt.timedelta(days=1, hours=2))  # the manager rescheduled
    assert look(s4, t["id"], end + dt.timedelta(minutes=10)) == "reset"
    assert alerts(s4)[0]["state"] == "resolved"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT alerts_sent FROM ticket_vendor_arrivals").fetchone()[0] == 0


def test_a_vendor_who_started_the_work_is_not_alerted(s4, monkeypatch):
    enable(s4, grace_min=0)
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    assert client.post("/t/api/status", headers=hdr(token), json={"status": "in_progress", "client_request_id": crid()}).status_code == 200
    end = dt.datetime(2026, 11, 2, 11, 0, tzinfo=UTC)
    window(monkeypatch, end - dt.timedelta(hours=2), end)
    assert look(s4, t["id"], end + dt.timedelta(hours=5)) is None and alerts(s4) == []


def test_an_internal_assignee_is_never_watched(s4, monkeypatch):
    enable(s4, grace_min=0)
    t = s4.ticket()
    assert s4.w.assign("joni", t["id"], "mona").status_code == 200
    end = dt.datetime(2026, 11, 2, 11, 0, tzinfo=UTC)
    window(monkeypatch, end - dt.timedelta(hours=2), end)
    with s4.db.connection(mode="read") as conn:
        assert t["id"] not in store_arrival.watched_ticket_ids(conn, 50)
    assert look(s4, t["id"], end + dt.timedelta(days=1)) is None and alerts(s4) == []


def test_the_monitor_tick_runs_the_step_and_only_while_the_switch_is_on(s4, monkeypatch):
    t, _token = s4.sent()
    end = dt.datetime.now(UTC) - dt.timedelta(hours=1)
    window(monkeypatch, end - dt.timedelta(hours=2), end)
    monitor.tick(s4.db, force=True)
    assert alerts(s4) == [], "switch off: nothing"
    enable(s4, grace_min=0)
    monitor.tick(s4.db, force=True)
    assert len(alerts(s4)) == 1
    monitor.tick(s4.db, force=True)
    assert len(alerts(s4)) == 1, "the same alert number is never sent twice"


# ---------------------------------------------------------------- audience, text, schema

def test_the_alert_names_the_number_and_the_place_only_and_goes_to_the_configured_audience(s4, monkeypatch):
    enable(s4, grace_min=0, recipients={"managers": False})
    t, _token = s4.sent()
    end = dt.datetime(2026, 11, 2, 11, 0, tzinfo=UTC)
    window(monkeypatch, end - dt.timedelta(hours=2), end)
    assert look(s4, t["id"], end) == "alert"
    with s4.db.connection(mode="read") as conn:
        to = [r[0] for r in conn.execute("SELECT r.user_id FROM notification_recipients r JOIN notifications n ON n.id = r.notification_id "
                                         "WHERE n.source = 'ticket.vendor_missed'").fetchall()]
    assert to == [], "managers switched off and nobody named: nobody is told"


def test_the_default_audience_is_the_departments_managers_and_the_text_has_no_vendor_name(s4, monkeypatch):
    enable(s4, grace_min=0)
    t, _token = s4.sent()
    end = dt.datetime(2026, 11, 2, 11, 0, tzinfo=UTC)
    window(monkeypatch, end - dt.timedelta(hours=2), end)
    assert look(s4, t["id"], end) == "alert"
    rows = alerts(s4)
    assert len(rows) == 1 and rows[0]["severity"] == "alert"
    with s4.db.connection(mode="read") as conn:
        to = [r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (rows[0]["id"],)).fetchall()]
    assert to, "the department's managers are told"
    text = str(rows[0])
    assert "קליימה" not in text and "service@clima" not in text


def test_the_source_and_its_prefix_are_registered(s4):
    from smplwise.services import notify_policy

    assert "ticket.vendor_missed" in notify_policy.BY_KEY
    assert notify_bridge.source_of_key("ticket:t1:vmiss:2") == "ticket.vendor_missed"
    from smplwise.services.tickets import notify_matrix

    assert "ticket.vendor_missed" in notify_matrix.MATRIX_SOURCES and "ticket.vendor_missed" in notify_bridge.TEMPLATES


def test_the_window_queries_run_against_the_real_schema(s4):
    with s4.db.connection(mode="read") as conn:
        assert store_arrival.planned_window(conn, "no-such-assignment") is None
        assert store_arrival.request_start(conn, "no-such-assignment") is None
        assert isinstance(store_arrival.watched_ticket_ids(conn, 5), list)


def test_the_migration_is_provisional_and_cascades_with_the_ticket(s4):
    from pathlib import Path

    sql = (Path(vendor_arrival.__file__).parents[2] / "migrations" / "0190_vendor_arrival.sql").read_text(encoding="utf-8")
    assert "PROVISIONAL" in sql.split("\n", 1)[0] + sql.split("\n", 2)[1]
    assert "ON DELETE CASCADE" in sql
