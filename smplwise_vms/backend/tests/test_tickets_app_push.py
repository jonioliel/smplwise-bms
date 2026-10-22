"""PUSHSVC-295: the phone app (`app` channel, services/mobile_push.py) is told about service requests - the assignee when a request is
assigned to him, the requester and the assignee when the status changes or a note is added (never the person who did it) - through the
existing CR-018 pipeline: sources `ticket.assigned` / `ticket.status_update` / `ticket.comment_added` (services/tickets/notify_sources.py,
`app` on by default), recipients = origin.user_id, visibility = access.visible, per-device category mute (`tickets`), quiet hours by the
push column. Nothing at all while the tickets module is off. The text names the number, the place and the status label - never a note."""
from __future__ import annotations

import json

import httpx
import pytest
from conftest import as_user
from tickets_world import API, build

pytestmark = pytest.mark.usefixtures("daytime_clock")

from smplwise.db import Database
from smplwise.services import mobile_push as svc
from smplwise.services import notify_channels, presence
from smplwise.services.tickets import notify_bridge

SECRET = "טקסט-פרטי-שלא-יוצא"


@pytest.fixture()
def relay(monkeypatch):
    calls: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})

    monkeypatch.setenv("SW_PUSH_RELAY_URL", "https://relay.test")
    monkeypatch.setenv("SW_PUSH_RELAY_KEY", "srvkey-test-0001")
    monkeypatch.setattr(svc, "TRANSPORT", httpx.MockTransport(handler))
    monkeypatch.setattr(svc, "BACKOFF_S", (0.0, 0.0, 0.0))
    svc.reset_limits()
    presence.reset_limits()
    yield calls
    svc.reset_limits()
    presence.reset_limits()


@pytest.fixture()
def w(settings):
    return build(settings)


def db(w) -> Database:
    return Database(w.settings.db_path)


def register(w, user: str, relay_token: str) -> tuple[str, dict]:
    r = w.c.post(f"{API}/presence/devices", json={"name": "הנייד", "platform": "ios", "install_id": f"{user}-install-0000-0000", "app_version": "1.0.0"}, headers=as_user(user))
    assert r.status_code == 201, r.text
    did, tok = r.json()["device_id"], {"Authorization": f"Bearer {r.json()['device_token']}"}
    r = w.c.post(f"{API}/notifications/devices", json={"platform": "ios", "relay_token": relay_token, "app_version": "1.0.0"}, headers=tok)
    assert r.status_code == 200, r.text
    return did, tok


def flush(w) -> None:
    notify_channels.process_outbox_now(db(w))


def messages(w, user: str) -> list[dict]:
    with db(w).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM mobile_push_messages WHERE user_id = ? ORDER BY at, id", (f"dev-{user}",)).fetchall()]


def app_deliveries(w, source: str) -> list[tuple[str, str | None]]:
    with db(w).connection(mode="read") as conn:
        return [(r["status"], r["reason"]) for r in conn.execute(
            "SELECT d.status, d.reason FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id WHERE n.source = ? AND d.channel = 'app' ORDER BY d.created_at, d.id",
            (source,)).fetchall()]


@pytest.fixture()
def world(w, relay):
    """nora asked (the requester), tom handles it; both have the app registered; mona (manager) acts."""
    register(w, "nora", "rt_nora_0123456789abcdef")
    register(w, "tom", "rt_tom__0123456789abcdef")
    t = w.create("nora", title=SECRET)
    assert w.assign("mona", t["id"], "tom").status_code == 200
    flush(w)
    relay.clear()
    return w, t, relay


def test_assignment_pushes_to_the_assignee_with_minimal_text(w, relay):
    register(w, "nora", "rt_nora_0123456789abcdef")
    register(w, "tom", "rt_tom__0123456789abcdef")
    t = w.create("nora", title=SECRET)
    assert w.assign("mona", t["id"], "tom").status_code == 200
    flush(w)
    assert [c["relay_token"] for c in relay] == ["rt_tom__0123456789abcdef"] and relay[0]["category"] == "tickets"
    assert set(relay[0]) == {"relay_token", "category", "notification_id", "priority", "server", "collapse"}, "the relay payload carries no text"
    (m,) = messages(w, "tom")
    assert SECRET not in json.dumps(m, ensure_ascii=False) and f"#{t['number']}" in m["title"]


def test_status_change_pushes_to_the_requester_not_to_the_one_who_acted(world):
    w, t, relay = world
    assert w.status("tom", t["id"], "acknowledged").status_code == 200
    flush(w)
    assert [c["relay_token"] for c in relay] == ["rt_nora_0123456789abcdef"], "the requester hears it, the acting assignee does not"
    (m,) = messages(w, "nora")
    assert m["category"] == "tickets" and m["severity"] == "info" and f"#{t['number']}" in m["title"]  # the body follows the lock-screen level


def test_manager_status_change_tells_both_the_requester_and_the_assignee(world):
    w, t, relay = world
    assert w.status("mona", t["id"], "cancelled", note=SECRET).status_code == 200
    flush(w)
    assert sorted(c["relay_token"] for c in relay) == ["rt_nora_0123456789abcdef", "rt_tom__0123456789abcdef"]
    assert all(SECRET not in json.dumps(m, ensure_ascii=False) for u in ("nora", "tom") for m in messages(w, u))


def test_comment_pushes_to_the_requester_and_never_carries_the_text(world):
    w, t, relay = world
    assert w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": SECRET}, headers=w.h("tom")).status_code == 201
    flush(w)
    assert [c["relay_token"] for c in relay] == ["rt_nora_0123456789abcdef"]
    (m,) = messages(w, "nora")
    assert "נוספה הערה" in m["title"] and SECRET not in json.dumps(m, ensure_ascii=False)


def test_an_internal_manager_note_does_not_reach_the_requester(world):
    w, t, relay = world
    assert w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": SECRET}, headers=w.h("mona")).status_code == 201
    flush(w)
    # tom is a department member (sees the whole timeline); nora, the requester, may not read an internal note and must not be told of it
    assert [c["relay_token"] for c in relay] == ["rt_tom__0123456789abcdef"]
    assert messages(w, "nora") == []


def test_module_off_means_no_ticket_notification_at_all(world):
    w, t, relay = world
    assert w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    with db(w).connection() as conn:
        notify_bridge.ticket_status(conn, t["id"], "assigned", "in_progress", actor="assignee")
        notify_bridge.ticket_comment(conn, t["id"], "dev-tom", 1, True)
    flush(w)
    assert relay == []
    with db(w).connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notifications WHERE source IN ('ticket.status_update', 'ticket.comment_added')").fetchone()[0] == 0
    keys = {p["source"] for p in w.c.get(f"{API}/notify/policies").json()["policies"]}
    assert not {"ticket.status_update", "ticket.comment_added", "ticket.assigned"} & keys


def test_no_app_registered_means_no_push_but_the_inbox_still_has_it(w, relay):
    t = w.create("nora")
    assert w.assign("mona", t["id"], "tom").status_code == 200
    assert w.status("tom", t["id"], "acknowledged").status_code == 200
    flush(w)
    assert relay == [] and app_deliveries(w, "ticket.status_update") == []
    rows = w.c.get(f"{API}/notifications", headers=w.h("nora")).json()["notifications"]
    assert [r["source"] for r in rows] == ["ticket.status_update"]


def test_a_device_that_muted_the_tickets_category_gets_nothing(w, relay):
    did, tok = register(w, "nora", "rt_nora_0123456789abcdef")
    register(w, "tom", "rt_tom__0123456789abcdef")
    assert w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": ["tickets"]}, headers=tok).status_code == 200
    t = w.create("nora")
    assert w.assign("mona", t["id"], "tom").status_code == 200
    flush(w)
    relay.clear()
    assert w.status("tom", t["id"], "acknowledged").status_code == 200
    flush(w)
    assert relay == [] and app_deliveries(w, "ticket.status_update") == [("skipped", "muted")]
