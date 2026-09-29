"""Web Push (CR-008 P3): RFC 8291 encryption (known answer), the VAPID key's lifecycle, subscription CRUD limited to the
caller's own rows, the notify path from a firing rule against a fake push service (200 / 410 / 429 with retry), scope
filtering (a user without reach gets nothing), preferences and quiet hours, rate limits, and a payload without secrets."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import json
import zipfile

import httpx
import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import push as svc
from smplwise.services import rules as rules_svc


def b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


class Browser:
    """A fake user agent: its own P-256 key and auth secret, and the receiving side of RFC 8291."""

    def __init__(self, name: str) -> None:
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.auth = hashlib.sha256(name.encode()).digest()[:16]
        self.endpoint = f"https://fcm.googleapis.com/fcm/send/{name}-{hashlib.sha1(name.encode()).hexdigest()}"

    @property
    def p256dh(self) -> str:
        return b64u(self.key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))

    def body(self) -> dict:
        return {"endpoint": self.endpoint, "keys": {"p256dh": self.p256dh, "auth": b64u(self.auth)}, "expirationTime": None}

    def decrypt(self, data: bytes) -> dict:
        salt, rs, idlen = data[:16], int.from_bytes(data[16:20], "big"), data[20]
        as_public = data[21 : 21 + idlen]
        assert rs == 4096 and idlen == 65
        ua_public = b64d(self.p256dh)
        secret = self.key.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), as_public))
        h = lambda k, d: hmac.new(k, d, hashlib.sha256).digest()  # noqa: E731
        ikm = h(h(self.auth, secret), b"WebPush: info\x00" + ua_public + as_public + b"\x01")
        prk = h(salt, ikm)
        plain = AESGCM(h(prk, b"Content-Encoding: aes128gcm\x00\x01")[:16]).decrypt(h(prk, b"Content-Encoding: nonce\x00\x01")[:12], data[21 + idlen :], None)
        assert plain.endswith(b"\x02")
        return json.loads(plain[:-1].decode("utf-8"))


class FakePushService:
    """An httpx transport standing in for FCM: answers per endpoint from a script, records every request."""

    def __init__(self) -> None:
        self.script: dict[str, list[int]] = {}
        self.calls: list[tuple[str, httpx.Request]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        self.calls.append((url, request))
        plan = self.script.get(url) or [201]
        status = plan.pop(0) if len(plan) > 1 else plan[0]
        return httpx.Response(status, headers={"Retry-After": "0"} if status == 429 else {})

    def to(self, browser: Browser) -> list[httpx.Request]:
        return [r for u, r in self.calls if u == browser.endpoint]


@pytest.fixture()
def fake_push(monkeypatch):
    fake = FakePushService()
    monkeypatch.setattr(svc, "TRANSPORT", httpx.MockTransport(fake.handler))
    monkeypatch.setattr(svc, "BACKOFF_S", (0.0, 0.0, 0.0))
    svc.reset_limits()
    yield fake
    svc.NOTIFIER.shutdown()
    svc.reset_limits()


def test_rfc8291_known_answer():
    """RFC 8291 Appendix A: the exact message for the published keys, salt and plaintext."""
    as_priv = ec.derive_private_key(int.from_bytes(b64d("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"), "big"), ec.SECP256R1())
    out = svc.encrypt(
        b"When I grow up, I want to be a watermelon",
        "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
        "BTBZMqHH6r4Tts7J_aSIgg",
        salt=b64d("DGv6ra1nlYgDCS1FRnbzlw"),
        server_key=as_priv,
    )
    assert b64u(out) == (
        "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
    )


def _verify_vapid(header: str, public_key: str, endpoint: str) -> dict:
    assert header.startswith("vapid t=") and f", k={public_key}" in header
    token = header[len("vapid t=") : header.index(", k=")]
    head, body, sig = token.split(".")
    assert json.loads(b64d(head)) == {"typ": "JWT", "alg": "ES256"}
    raw = b64d(sig)
    pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), b64d(public_key))
    pub.verify(encode_dss_signature(int.from_bytes(raw[:32], "big"), int.from_bytes(raw[32:], "big")), f"{head}.{body}".encode(), ec.ECDSA(hashes.SHA256()))
    claims = json.loads(b64d(body))
    assert claims["aud"] == "https://fcm.googleapis.com" and claims["sub"].startswith(("https://", "mailto:"))
    import time

    assert time.time() < claims["exp"] <= time.time() + 24 * 3600
    return claims


def test_vapid_key_lifecycle(settings, fake_push):
    app = create_app(settings)
    c = TestClient(app)
    key = c.get("/api/v1/push/vapid-key").json()["public_key"]
    raw = b64d(key)
    assert len(raw) == 65 and raw[0] == 4, "an uncompressed P-256 point (applicationServerKey)"
    assert c.get("/api/v1/push/vapid-key", headers=as_user("bob")).json()["public_key"] == key, "one pair per installation, not per user"
    # stable across a restart on the same data
    assert TestClient(create_app(settings)).get("/api/v1/push/vapid-key").json()["public_key"] == key
    # the private key is never served, never in the settings and never in a project backup
    with app.state.db.connection() as conn:
        pem = conn.execute("SELECT private_pem FROM push_vapid").fetchone()[0]
    marker = pem.splitlines()[1][:40]
    assert marker not in json.dumps(c.get("/api/v1/settings").json())
    b = c.post("/api/v1/backups", json={"note": "push"})
    assert b.status_code == 201, b.text
    path = settings.data_dir / "backups" / b.json()["name"]
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        blob = b"".join(z.read(n) for n in names)
    assert "data/push_vapid.json" not in names and "data/push_subscriptions.json" not in names
    assert marker.encode() not in blob
    # the Authorization header verifies against the served public key
    with app.state.db.connection() as conn:
        k = svc.signing_key(conn)
    endpoint = "https://fcm.googleapis.com/fcm/send/x"
    _verify_vapid(svc.vapid_authorization(k[0], k[1], endpoint), key, endpoint)


def test_subscription_crud_is_own_only(settings, fake_push):
    c = TestClient(create_app(settings))
    phone, laptop = Browser("phone"), Browser("laptop")
    r = c.post("/api/v1/push/subscriptions", json={**phone.body(), "user_agent": "Pixel"})
    assert r.status_code == 201, r.text
    sub = r.json()
    assert set(sub) >= {"id", "endpoint_host", "endpoint_hash", "created_at", "last_seen_at"}
    assert sub["endpoint_host"] == "fcm.googleapis.com" and "endpoint" not in sub and "p256dh" not in sub and "auth" not in sub
    assert phone.endpoint not in json.dumps(c.get("/api/v1/push/subscriptions").json()), "the capability URL is never served back"
    again = c.post("/api/v1/push/subscriptions", json=phone.body()).json()
    assert again["id"] == sub["id"], "idempotent per endpoint (the app re-syncs on every start)"
    assert c.post("/api/v1/push/subscriptions", json=laptop.body()).status_code == 201
    assert len(c.get("/api/v1/push/subscriptions").json()["subscriptions"]) == 2

    # another user sees none of them and cannot delete them (a foreign id answers like a missing one)
    assert c.get("/api/v1/push/subscriptions", headers=as_user("bob")).json()["subscriptions"] == []
    assert c.delete(f"/api/v1/push/subscriptions/{sub['id']}", headers=as_user("bob")).status_code == 404
    assert len(c.get("/api/v1/push/subscriptions").json()["subscriptions"]) == 2
    rows = c.get("/api/v1/audit", params={"prefix": "push.subscription.delete"}).json()["rows"]
    assert [(x["actor_username"], x["decision"], x["reason"]) for x in rows] == [("bob", "denied", "not_owner")], "the refused delete is audited"

    # the push service is the only place the server ever posts to
    for bad in ("http://fcm.googleapis.com/fcm/send/x", "https://127.0.0.1/x", "https://evil.example/fcm.googleapis.com", "https://fcm.googleapis.com.evil.example/x",
                "https://user:pw@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x"):
        r = c.post("/api/v1/push/subscriptions", json={**phone.body(), "endpoint": bad})
        assert r.status_code == 422 and r.json()["code"] == "push_endpoint_refused", bad
    assert c.post("/api/v1/push/subscriptions", json={**phone.body(), "keys": {"p256dh": b64u(b"\x04" + b"\x01" * 64), "auth": phone.body()["keys"]["auth"]}}).json()["code"] == "push_keys_invalid"
    assert c.post("/api/v1/push/subscriptions", json={**phone.body(), "keys": {"p256dh": phone.p256dh, "auth": b64u(b"short")}}).status_code == 422

    # a browser profile now used by another HA user: the subscription moves to them
    moved = c.post("/api/v1/push/subscriptions", json=phone.body(), headers=as_user("bob"))
    assert moved.status_code == 201 and moved.json()["id"] == sub["id"]
    assert [s["id"] for s in c.get("/api/v1/push/subscriptions", headers=as_user("bob")).json()["subscriptions"]] == [sub["id"]]
    assert sub["id"] not in [s["id"] for s in c.get("/api/v1/push/subscriptions").json()["subscriptions"]]
    # pushsubscriptionchange: the browser's new endpoint replaces its old one (only the caller's own old row goes)
    fresh = Browser("laptop-renewed")
    lap_id = [s["id"] for s in c.get("/api/v1/push/subscriptions").json()["subscriptions"]][0]
    c.post("/api/v1/push/subscriptions", json={**fresh.body(), "old_endpoint": phone.endpoint})  # bob's now: untouched
    c.post("/api/v1/push/subscriptions", json={**Browser("x").body(), "old_endpoint": laptop.endpoint})
    mine = [s["id"] for s in c.get("/api/v1/push/subscriptions").json()["subscriptions"]]
    assert lap_id not in mine and len(mine) == 2
    assert len(c.get("/api/v1/push/subscriptions", headers=as_user("bob")).json()["subscriptions"]) == 1

    # delete own
    for s in c.get("/api/v1/push/subscriptions").json()["subscriptions"]:
        assert c.delete(f"/api/v1/push/subscriptions/{s['id']}").status_code == 204
    assert c.get("/api/v1/push/subscriptions").json()["subscriptions"] == []


def _world(settings):
    """A camera on floor 2; joni = system admin; ops2 = operator on floor 2; ops3 = operator on floor 3 only."""
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()["id"]
    for f in (ids["floor2"], ids["floor3"]):
        asset = c.post(f"/api/v1/floors/{f}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
        v = c.post(f"/api/v1/floors/{f}/plan-versions", json={"asset_id": asset["id"]}).json()
        c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam, "x": 0.3, "y": 0.3}).status_code in (200, 201)
    bind(c, settings, "ops2", "operator", "floor", ids["floor2"])
    bind(c, settings, "ops3", "operator", "floor", ids["floor3"])
    rule = c.post("/api/v1/rules", json={"name": "תנועה בלובי", "trigger": {"types": ["motion", "door", "offline"], "severity_min": "info"}, "scope": {},
                                         "window": {}, "cooldown_s": 0, "actions": [{"kind": "notify", "message": "תנועה בלובי"}]})
    assert rule.status_code == 201, rule.text
    browsers = {u: Browser(u) for u in ("joni", "ops2", "ops3")}
    for u, b in browsers.items():
        assert c.post("/api/v1/push/subscriptions", json=b.body(), headers=as_user(u)).status_code == 201
    return app, c, ids, cam, browsers


def _event(app, eid: str, camera_id: str | None, etype: str = "motion", severity: str = "info", source: str = "alertstream", details: dict | None = None) -> dict:
    occurred = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, source, "VMD", etype, camera_id, 1, occurred, None, occurred, "inactive", 1, severity, "measured", json.dumps(details or {}), f"t:{eid}", occurred),
        )
    return {"id": eid, "source": source, "type": etype, "camera_id": camera_id, "severity": severity, "occurred_at": occurred, "details": details or {}}


def _fire(app, ev: dict) -> list[dict]:
    """What the alert stream does: evaluate inside its transaction, deliver after the commit."""
    fired: list[dict] = []
    with app.state.db.connection() as conn:
        fired.extend(rules_svc.evaluate_event(conn, ev, "Asia/Jerusalem", deliver=False))
    rules_svc.deliver_pending(fired)
    return fired


def test_notify_path_scope_retry_and_gone(settings, fake_push):
    app, c, ids, cam, browsers = _world(settings)
    # joni has a second, dead browser (the push service says 410); ops2's push service is busy once (429, then ok)
    dead = Browser("joni-old-laptop")
    assert c.post("/api/v1/push/subscriptions", json=dead.body()).status_code == 201
    fake_push.script[dead.endpoint] = [410]
    fake_push.script[browsers["ops2"].endpoint] = [429, 201]
    svc.NOTIFIER.start(app.state.db)

    fired = _fire(app, _event(app, "ev-cam-1", cam))
    assert [f["event_id"] for f in fired] == ["ev-cam-1"] and "_push" not in fired[0], "the push fields never leave the delivery"
    svc.NOTIFIER.drain()

    # scope: ops3 (floor 3) cannot see the floor-2 camera, so nothing was sent to their browser
    assert fake_push.to(browsers["ops3"]) == []
    assert len(fake_push.to(browsers["joni"])) == 1
    assert len(fake_push.to(browsers["ops2"])) == 2, "429 is retried"
    # 410: the dead subscription is gone; the others record their success
    with app.state.db.connection() as conn:
        rows = {r["endpoint"]: r for r in conn.execute("SELECT * FROM push_subscriptions").fetchall()}
    assert dead.endpoint not in rows
    assert rows[browsers["joni"].endpoint]["last_ok_at"] and rows[browsers["ops2"].endpoint]["last_ok_at"]
    assert rows[browsers["ops3"].endpoint]["last_ok_at"] is None

    # the request: VAPID, aes128gcm, TTL; the payload decrypts to a minimal message without any secret
    req = fake_push.to(browsers["joni"])[0]
    assert req.headers["content-encoding"] == "aes128gcm" and int(req.headers["ttl"]) > 0
    public = c.get("/api/v1/push/vapid-key").json()["public_key"]
    _verify_vapid(req.headers["authorization"], public, browsers["joni"].endpoint)
    payload = browsers["joni"].decrypt(req.content)
    assert payload["url"] == "#/investigate/events/ev-cam-1" and payload["event_id"] == "ev-cam-1" and payload["alert_id"] == fired[0]["id"]
    assert "תנועה בלובי" in payload["title"] + payload["body"] and payload["category"] == "alerts"
    assert set(payload) <= {"v", "title", "body", "url", "event_id", "alert_id", "tag", "category", "severity", "ts"}
    text = json.dumps(payload, ensure_ascii=False).lower()
    with app.state.db.connection() as conn:
        pem = conn.execute("SELECT private_pem FROM push_vapid").fetchone()[0]
    for secret in ("token", "bearer", "authorization", "password", "http", "vapid", browsers["joni"].p256dh.lower(), b64u(browsers["joni"].auth).lower(), pem.splitlines()[1][:30].lower()):
        assert secret not in text, secret
    assert ops2_payload_ok(browsers["ops2"], fake_push)


def ops2_payload_ok(browser: Browser, fake: FakePushService) -> bool:
    return all(browser.decrypt(r.content)["event_id"] == "ev-cam-1" for r in fake.to(browser))


def test_camera_less_alert_needs_installation_scope(settings, fake_push):
    app, c, ids, cam, browsers = _world(settings)
    with app.state.db.connection() as conn:
        notice = {"alert_id": "a1", "event_id": "e1", "rule_name": "דלת", "message": "דלת נפתחה", "camera_id": None, "entity_id": "binary_sensor.door",
                  "event_type": "door", "source": "ha", "severity": "alert", "occurred_at": "2026-09-29T10:00:00Z", "place": "דלת כניסה"}
        jobs, decisions = svc.plan(conn, notice, tz_name="Asia/Jerusalem")
    assert decisions == {"dev-joni": "send", "dev-ops2": "no_reach", "dev-ops3": "no_reach"}
    assert [j.user_id for j in jobs] == ["dev-joni"]
    assert json.loads(jobs[0].payload)["category"] == "doors" and "דלת כניסה" in json.loads(jobs[0].payload)["body"]


def test_prefs_quiet_hours_and_rate_limit(settings, fake_push, monkeypatch):
    app, c, ids, cam, browsers = _world(settings)
    notice = {"alert_id": "a2", "event_id": "e2", "rule_name": "מצלמה", "message": "מצלמה במצב לא מקוון", "camera_id": cam, "event_type": "offline",
              "source": "alertstream", "severity": "critical", "occurred_at": "2026-09-29T20:00:00Z"}

    def decide(when: dt.datetime) -> dict[str, str]:
        with app.state.db.connection(mode="read") as conn:
            return svc.plan(conn, notice, now=when, tz_name="Asia/Jerusalem")[1]

    noon = dt.datetime(2026, 9, 29, 9, 0, tzinfo=dt.timezone.utc)  # 12:00 local
    night = dt.datetime(2026, 9, 29, 21, 0, tzinfo=dt.timezone.utc)  # 00:00 local
    assert decide(noon)["dev-ops2"] == "send"
    # defaults, then own preferences only
    p = c.get("/api/v1/push/prefs", headers=as_user("ops2")).json()
    assert p["categories"] == {"alerts": True, "doors": True, "device_faults": True, "system": True} and p["quiet"]["enabled"] is False
    r = c.put("/api/v1/push/prefs", headers=as_user("ops2"), json={"categories": {"device_faults": False}, "quiet": {"enabled": False}})
    assert r.status_code == 200 and r.json()["categories"]["device_faults"] is False
    assert c.get("/api/v1/push/prefs").json()["categories"]["device_faults"] is True, "joni's preferences are untouched"
    assert decide(noon)["dev-ops2"] == "category_off" and decide(noon)["dev-joni"] == "send"
    assert c.put("/api/v1/push/prefs", headers=as_user("ops2"), json={"categories": {"nope": True}}).status_code == 422
    assert c.put("/api/v1/push/prefs", headers=as_user("ops2"), json={"quiet": {"enabled": True, "from": "25:00", "to": "07:00"}}).status_code == 422

    # quiet hours 22:00-07:00 local: a critical alert passes when allowed, is held back when not; outside the window all pass
    c.put("/api/v1/push/prefs", headers=as_user("ops2"), json={"quiet": {"enabled": True, "from": "22:00", "to": "07:00", "allow_critical": True}})
    assert decide(night)["dev-ops2"] == "send"
    c.put("/api/v1/push/prefs", headers=as_user("ops2"), json={"quiet": {"enabled": True, "from": "22:00", "to": "07:00", "allow_critical": False}})
    assert decide(night)["dev-ops2"] == "quiet_hours" and decide(noon)["dev-ops2"] == "send"
    notice["severity"] = "alert"
    c.put("/api/v1/push/prefs", headers=as_user("ops2"), json={"quiet": {"enabled": True, "from": "22:00", "to": "07:00", "allow_critical": True}})
    assert decide(night)["dev-ops2"] == "quiet_hours", "only a critical alert breaks through quiet hours"

    # rate limit per user: a burst beyond the bucket is dropped for that user only
    svc.reset_limits()
    monkeypatch.setattr(svc, "RATE_BURST", 2)
    monkeypatch.setattr(svc, "RATE_PER_MIN", 0.0001)
    got = [decide(noon)["dev-joni"] for _ in range(3)]
    assert got == ["send", "send", "rate_limited"]


def test_test_button(settings, fake_push):
    app = create_app(settings)
    c = TestClient(app)
    c.get("/api/v1/push/vapid-key")
    assert c.post("/api/v1/push/test").json()["code"] == "push_not_subscribed"
    phone = Browser("test-phone")
    c.post("/api/v1/push/subscriptions", json=phone.body())
    r = c.post("/api/v1/push/test")
    assert r.status_code == 200, r.text
    assert r.json()["sent"] == 1 and r.json()["results"][0]["endpoint_host"] == "fcm.googleapis.com"
    payload = phone.decrypt(fake_push.to(phone)[0].content)
    assert payload["url"] == "#/system/notifications" and payload["category"] == "test"
    assert c.post("/api/v1/push/test").status_code == 200
    assert c.post("/api/v1/push/test").status_code == 429, "3 test notifications per minute per user (the refused first one counted too)"
    # a 410 on the test removes the subscription too
    svc.reset_limits()
    fake_push.script[phone.endpoint] = [410]
    assert c.post("/api/v1/push/test").json()["results"][0]["outcome"] == "gone"
    assert c.get("/api/v1/push/subscriptions").json()["subscriptions"] == []


def test_push_worker_off_is_harmless(settings):
    """Without the worker (tests, a stopped app) rule evaluation delivers exactly as before."""
    svc.NOTIFIER.shutdown()
    app = create_app(settings)
    c = TestClient(app)
    c.post("/api/v1/rules", json={"name": "r", "trigger": {"types": ["motion"]}, "scope": {}, "window": {}, "cooldown_s": 0, "actions": [{"kind": "notify"}]})
    ev = _event(app, "e-off", None, source="system", etype="motion")
    fired = _fire(app, ev)
    assert len(fired) <= 1 and all("_push" not in f and "_pending" not in f for f in fired)
