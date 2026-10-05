"""CR-027 phase 2: push to the phone app through the SmplWise relay - registration with a relay token, categories and per-device
mutes, the `app` channel inside the CR-018 dispatch (generic payload only, the real text fetched by the device with its token,
24 h expiry, reach and quiet hours and rate limits like every channel), the relay's 410 dropping the registration, retries on
429, the unconfigured relay, the test push, and the cross-device rules."""
from __future__ import annotations

import datetime as dt
import json

import httpx
import pytest
from conftest import as_user
from notify_world import API, World, fake_push  # noqa: F401 - fixture

pytestmark = pytest.mark.usefixtures("daytime_clock")

from smplwise.services import mobile_push as svc
from smplwise.services import notify, notify_channels, presence
from smplwise.services import push as web_push


class FakeRelay:
    """Stands in for the SmplWise push relay: records every /v1/push and answers per relay token from a script."""

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.script: dict[str, list[int]] = {}
        self.auth: list[str] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.auth.append(request.headers.get("authorization", ""))
        body = json.loads(request.content)
        self.calls.append({"url": str(request.url), **body})
        plan = self.script.get(body["relay_token"]) or [200]
        status = plan.pop(0) if len(plan) > 1 else plan[0]
        return httpx.Response(status, headers={"Retry-After": "0"} if status == 429 else {}, json={"ok": status == 200})


@pytest.fixture()
def relay(monkeypatch):
    fake = FakeRelay()
    monkeypatch.setenv("SW_PUSH_RELAY_URL", "https://relay.test")
    monkeypatch.setenv("SW_PUSH_RELAY_KEY", "srvkey-test-0001")
    monkeypatch.setattr(svc, "TRANSPORT", httpx.MockTransport(fake.handler))
    monkeypatch.setattr(svc, "BACKOFF_S", (0.0, 0.0, 0.0))
    svc.reset_limits()
    presence.reset_limits()
    yield fake
    svc.reset_limits()
    presence.reset_limits()


@pytest.fixture()
def w(settings, fake_push) -> World:
    return World(settings)


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(w: World, user: str, name: str = "הנייד שלי", relay_token: str | None = "rt_0123456789abcdef0123") -> tuple[str, dict]:
    r = w.c.post(f"{API}/presence/devices", json={"name": name, "platform": "ios", "install_id": f"{user}-install-0000-0000", "app_version": "1.0.0"}, headers=as_user(user))
    assert r.status_code == 201, r.text
    did, tok = r.json()["device_id"], bearer(r.json()["device_token"])
    if relay_token:
        r = w.c.post(f"{API}/notifications/devices", json={"platform": "ios", "relay_token": relay_token, "app_version": "1.0.0"}, headers=tok)
        assert r.status_code == 200, r.text
        assert r.json()["push"]["registered"] is True and r.json()["push"]["platform"] == "ios"
    return did, tok


# ---------------------------------------------------------------- registration and categories

def test_push_registration_validation_mutes_and_unregister(w, relay):
    did, tok = register(w, "ops2")
    assert w.c.post(f"{API}/notifications/devices", json={"platform": "ios", "relay_token": "x"}, headers=tok).json()["code"] == "invalid_relay_token"
    assert w.c.post(f"{API}/notifications/devices", json={"platform": "windows", "relay_token": "rt_0123456789abcdef0123"}, headers=tok).json()["code"] == "invalid_platform"
    assert w.c.post(f"{API}/notifications/devices", json={"platform": "ios", "relay_token": "rt_0123456789abcdef0123"}, headers=as_user("ops2")).status_code == 401  # device token only
    cats = w.c.get(f"{API}/notifications/categories", headers=tok).json()["categories"]
    assert [c["id"] for c in cats] == ["safety", "alerts", "doors", "device_faults", "automations", "system", "security"] and cats[0] == {"id": "safety", "name": "בטיחות", "critical": True}
    assert w.c.get(f"{API}/notifications/categories", headers=as_user("ops2")).status_code == 200  # a session reads it too (the web app's device card)
    r = w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": ["automations", "system"]}, headers=tok)
    assert r.status_code == 200 and r.json()["push"]["muted"] == ["automations", "system"]
    assert w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": ["spam"]}, headers=tok).status_code == 422
    assert w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": []}, headers=as_user("ops2")).json()["push"]["muted"] == []
    # another user's session or device cannot touch it; the administrator may unregister push; the device stays registered
    assert w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": []}, headers=as_user("vera")).status_code == 404
    assert w.c.delete(f"{API}/notifications/devices/{did}", headers=as_user("vera")).status_code == 404
    assert w.c.delete(f"{API}/notifications/devices/{did}").status_code == 204
    mine = w.c.get(f"{API}/presence/devices/me", headers=as_user("ops2")).json()["devices"]
    assert mine[0]["push"]["registered"] is False and mine[0]["device_id"] == did
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action IN ('notify.app.register', 'notify.app.unregister') AND decision = 'allowed'").fetchone()[0] == 2


def test_server_id_is_returned_everywhere_and_matches_the_relay_payload(w, relay):
    """The app maps a push's `server` to the origin it registered at: the same opaque id comes back from the registration,
    the config (device token and session), the push routes, and is what the relay payload carries; it holds no address."""
    r = w.c.post(f"{API}/presence/devices", json={"name": "הנייד שלי", "platform": "ios", "install_id": "ops2-install-0000-0000", "app_version": "1.0.0"}, headers=as_user("ops2"))
    assert r.status_code == 201
    sid = r.json()["server_id"]
    assert sid.startswith("srv_") and len(sid) <= 64 and "." not in sid and "/" not in sid
    tok = bearer(r.json()["device_token"])
    did = r.json()["device_id"]
    assert w.c.get(f"{API}/presence/config", headers=tok).json()["server_id"] == sid
    assert w.c.get(f"{API}/presence/config", headers=as_user("ops2")).json()["server_id"] == sid
    r = w.c.post(f"{API}/notifications/devices", json={"platform": "ios", "relay_token": "rt_0123456789abcdef0123", "app_version": "1.0.0"}, headers=tok)
    assert r.json()["server_id"] == sid
    assert w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": []}, headers=tok).json()["server_id"] == sid
    # re-registering the same install keeps the id (it is the installation's, not the device's)
    assert w.c.post(f"{API}/presence/devices", json={"name": "הנייד שלי", "platform": "ios", "install_id": "ops2-install-0000-0000"}, headers=as_user("ops2")).json()["server_id"] == sid
    w.set_policy("camera.offline", channels={"webpush": False, "email": False, "app": True})
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    w.flush()
    assert [c["server"] for c in relay.calls] == [sid]


def test_relay_url_is_returned_with_server_id_and_never_the_key(w, relay, monkeypatch):
    did, tok = register(w, "ops2")
    cfg = w.c.get(f"{API}/presence/config", headers=tok).json()
    assert cfg["relay_url"] == "https://relay.test"
    r = w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": []}, headers=tok).json()
    assert r["relay_url"] == "https://relay.test"
    assert w.c.post(f"{API}/notifications/devices", json={"platform": "ios", "relay_token": "rt_0123456789abcdef0123"}, headers=tok).json()["relay_url"] == "https://relay.test"
    assert "srvkey-test-0001" not in json.dumps([cfg, r])
    monkeypatch.delenv("SW_PUSH_RELAY_URL")
    assert w.c.get(f"{API}/presence/config", headers=tok).json()["relay_url"] is None


def test_server_id_created_by_the_config_route_when_no_push_ever_ran(w, relay):
    r = w.c.post(f"{API}/presence/devices", json={"name": "הנייד שלי", "platform": "ios", "install_id": "ops2-install-0000-0000"}, headers=as_user("ops2"))
    tok = bearer(r.json()["device_token"])
    with w.db.connection() as conn:
        conn.execute("DELETE FROM settings WHERE key = 'push.server_id'")
    first = w.c.get(f"{API}/presence/config", headers=tok).json()["server_id"]
    assert first.startswith("srv_") and w.c.get(f"{API}/presence/config", headers=tok).json()["server_id"] == first


# ---------------------------------------------------------------- the channel

def test_app_channel_sends_a_generic_payload_and_the_device_fetches_the_text(w, relay):
    did, tok = register(w, "ops2")
    w.set_policy("camera.offline", channels={"webpush": False, "email": False, "app": True})
    assert w.get_policy_enabled("camera.offline")
    assert w.c.get(f"{API}/notify/policies/camera.offline").json()["channels"]["app"] is True
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id
    w.flush()
    assert len(relay.calls) == 1, relay.calls
    call = relay.calls[0]
    assert call["url"] == "https://relay.test/v1/push" and call["relay_token"] == "rt_0123456789abcdef0123" and call["category"] == "device_faults" and call["priority"] == "normal"
    assert call["server"].startswith("srv_") and call["collapse"] == nid
    assert set(call) == {"url", "relay_token", "category", "notification_id", "priority", "server", "collapse"}
    assert relay.auth == ["Bearer srvkey-test-0001"]
    blob = json.dumps(call, ensure_ascii=False)
    for forbidden in ("לובי", w.cam, "ops2", "dev-", "http://", "#/"):
        assert forbidden not in blob, forbidden
    mid = call["notification_id"]
    # the delivery log row and the device counters
    rows = w.deliveries(nid)
    assert [(r["channel"], r["status"], r["user_id"]) for r in rows] == [("app", "sent", "dev-ops2")] and rows[0]["target_ref"].startswith("app:")
    dev = w.c.get(f"{API}/presence/devices/me", headers=as_user("ops2")).json()["devices"][0]
    assert dev["push"]["last_ok_at"] and dev["push"]["failures"] == 0
    # the device fetches the text with its token; another device cannot; a session cannot
    msg = w.c.get(f"{API}/notifications/app/{mid}", headers=tok).json()
    assert msg == {"message_id": mid, "notification_id": nid, "title": msg["title"], "body": msg["body"], "category": "device_faults", "severity": msg["severity"], "deep_link": f"#/notifications/{nid}", "at": msg["at"], "mode": "new"}
    assert msg["title"].endswith(" · לובי") and "מצלמה" in msg["title"]  # the catalogue's title + the place (type_place level)
    _, tok3 = register(w, "ops3", name="אחר", relay_token=None)
    assert w.c.get(f"{API}/notifications/app/{mid}", headers=tok3).status_code == 404
    assert w.c.get(f"{API}/notifications/app/{mid}", headers=as_user("ops2")).status_code == 401
    assert w.c.get(f"{API}/notifications/app/nope", headers=tok).status_code == 404
    # expiry: 24 h
    with w.db.connection() as conn:
        conn.execute("UPDATE mobile_push_messages SET expires_at = ? WHERE id = ?", ("2026-01-01T00:00:00Z", mid))
    assert w.c.get(f"{API}/notifications/app/{mid}", headers=tok).status_code == 404
    # the generic lock-screen level still gives the device the generic text only
    w.set_settings(lockscreen="generic")
    nid2 = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="second").id
    w.flush()
    msg2 = w.c.get(f"{API}/notifications/app/{relay.calls[-1]['notification_id']}", headers=tok).json()
    assert (msg2["title"], msg2["body"], msg2["notification_id"]) == ("Arx", "התראה חדשה", nid2)


def test_app_channel_respects_policy_reach_mutes_quiet_hours_and_critical(w, relay, monkeypatch):
    did, tok = register(w, "ops2")
    did3, tok3 = register(w, "ops3", name="של ops3", relay_token="rt_ops3_0123456789abcdef")
    # the channel off in the policy: nothing goes out, no row is invented
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    w.flush()
    assert relay.calls == [] and [r for r in w.deliveries() if r["channel"] == "app"] == []
    w.set_policy("camera.offline", channels={"webpush": False, "email": False, "app": True})
    # reach: ops3 (floor 3) never hears of a floor-2 camera - no target at all (not even a skipped row, as with web push)
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="r1").id
    w.flush()
    assert [c["relay_token"] for c in relay.calls] == ["rt_0123456789abcdef0123"] and "ops3" not in w.recipients(nid)  # joni (admin) is a recipient without a device
    # a muted category is skipped with its reason; a critical row passes anyway
    w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": ["device_faults"]}, headers=tok)
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="r2").id
    w.flush()
    assert len(relay.calls) == 1 and [(r["status"], r["reason"]) for r in w.deliveries(nid) if r["channel"] == "app"] == [("skipped", "muted")]
    w.set_policy("camera.offline", severity="critical")
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="r3").id
    w.flush()
    assert len(relay.calls) == 2 and relay.calls[-1]["priority"] == "high"
    w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": []}, headers=tok)
    w.set_policy("camera.offline", severity="alert")
    # quiet hours: the app follows the matrix's push column (alert held, critical passes)
    monkeypatch.setattr(notify, "now_utc", lambda: dt.datetime(2026, 10, 1, 20, 0, tzinfo=dt.timezone.utc))  # 23:00 local
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="q1").id
    w.flush()
    assert len(relay.calls) == 2 and [(r["status"], r["reason"]) for r in w.deliveries(nid) if r["channel"] == "app"] == [("skipped", "quiet_hours")]
    w.set_policy("camera.offline", severity="critical")
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="q2")
    w.flush()
    assert len(relay.calls) == 3


def test_relay_410_drops_the_registration_429_retries_and_unconfigured_skips(w, relay, monkeypatch):
    did, tok = register(w, "ops2")
    w.set_policy("camera.offline", channels={"webpush": False, "email": False, "app": True})
    # 429 then 200: the retry runs on the notifier's heap after a re-check
    relay.script["rt_0123456789abcdef0123"] = [429, 200]
    n = w.notifier()
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="a").id
    notify_channels.process_outbox(n)
    assert len(relay.calls) == 1 and [r["status"] for r in w.deliveries(nid) if r["channel"] == "app"] == ["retry"]
    assert n.run_due() == 1 and len(relay.calls) == 2
    assert [(r["status"], r["attempt"]) for r in w.deliveries(nid) if r["channel"] == "app"] == [("sent", 2)]
    # a retry whose notification was resolved meanwhile is skipped by the re-check
    relay.script["rt_0123456789abcdef0123"] = [503, 200]
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="b").id
    notify_channels.process_outbox(n)
    with w.db.connection() as conn:
        conn.execute("UPDATE notifications SET state = 'resolved' WHERE id = ?", (nid,))
    before = len(relay.calls)
    assert n.run_due() == 1 and len(relay.calls) == before
    # 410: the push registration is dropped, the delivery says gone, the device row stays
    relay.script["rt_0123456789abcdef0123"] = [410]
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="c").id
    w.flush()
    assert [r["status"] for r in w.deliveries(nid) if r["channel"] == "app"] == ["gone"]
    dev = w.c.get(f"{API}/presence/devices/me", headers=as_user("ops2")).json()["devices"][0]
    assert dev["push"]["registered"] is False and dev["push"]["last_error"] == "relay_410"
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT kind FROM notification_events WHERE notification_id = ? AND kind = 'delivery_failed'", (nid,)).fetchone()
    # re-registered, but the relay is not configured: a skipped row with its reason, no call
    w.c.post(f"{API}/notifications/devices", json={"platform": "ios", "relay_token": "rt_0123456789abcdef0123"}, headers=tok)
    monkeypatch.delenv("SW_PUSH_RELAY_URL")
    before = len(relay.calls)
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="d").id
    w.flush()
    assert len(relay.calls) == before and [(r["status"], r["reason"]) for r in w.deliveries(nid) if r["channel"] == "app"] == [("skipped", "channel_unavailable")]
    r = w.c.post(f"{API}/notifications/app/test", headers=tok)
    assert r.status_code == 200 and r.json()["sent"] is False and r.json()["reason"] == "relay_unconfigured"


def test_test_push_is_rate_limited_and_stored_for_the_device(w, relay):
    web_push_sent_before = web_push.STATS["sent"]  # module-level counter: other test files in the same process add to it
    did, tok = register(w, "ops2")
    r = w.c.post(f"{API}/notifications/app/test", headers=tok)
    assert r.status_code == 200 and r.json()["sent"] is True
    mid = r.json()["message_id"]
    assert relay.calls[-1]["notification_id"] == mid and relay.calls[-1]["category"] == "system"
    msg = w.c.get(f"{API}/notifications/app/{mid}", headers=tok).json()
    assert msg["mode"] == "test" and msg["title"] == "Arx · התראת בדיקה" and msg["notification_id"] is None
    w.c.post(f"{API}/notifications/app/test", headers=tok)
    w.c.post(f"{API}/notifications/app/test", headers=tok)
    assert w.c.post(f"{API}/notifications/app/test", headers=tok).status_code == 429
    # a device without push registration
    _, tok3 = register(w, "ops3", name="בלי", relay_token=None)
    assert w.c.post(f"{API}/notifications/app/test", headers=tok3).json()["code"] == "push_not_registered"
    # the web-push test path is untouched by the app channel
    assert web_push.STATS["sent"] == web_push_sent_before


def test_unregistering_the_device_drops_push_and_its_messages(w, relay):
    did, tok = register(w, "ops2")
    r = w.c.post(f"{API}/notifications/app/test", headers=tok)
    mid = r.json()["message_id"]
    assert w.c.delete(f"{API}/presence/devices/{did}", headers=tok).status_code == 204
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM mobile_push_messages WHERE id = ?", (mid,)).fetchone()[0] == 0
        row = conn.execute("SELECT push_relay_token, revoked_at FROM mobile_devices WHERE id = ?", (did,)).fetchone()
        assert row[0] is None and row[1]
    # the message of a revoked device is unreachable (its token died with it)
    assert w.c.get(f"{API}/notifications/app/{mid}", headers=tok).status_code == 401
