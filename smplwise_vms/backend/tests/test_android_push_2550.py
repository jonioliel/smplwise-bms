"""ANDROID-PUSH-2550 (CR-012 section 4C, owner roadmap 25.11 "Android push without Google"): the phone app on a phone without Google
services registers a UnifiedPush endpoint; the notification core's `app` channel sends the relay's content-less body to it as an
RFC 8291 encrypted Web Push message signed with the installation's VAPID key. Off by default (add-on option `unifiedpush_servers`
empty); the endpoint must be https on a push server the site listed; one route per device; the same reach, mutes, quiet hours,
retries and sign-out rules as the relay path. A fake push server (httpx.MockTransport) decrypts what it receives with the phone's
own keys - no network, no real push server, no account anywhere."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json

import httpx
import pytest
from conftest import as_user
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from notify_world import API, World, fake_push  # noqa: F401 - fixture

from smplwise.services import mobile_push, notify, presence, unifiedpush
from smplwise.services import push as web_push

pytestmark = pytest.mark.usefixtures("daytime_clock")

SERVERS = "push.example.org, ntfy.example.net:8443"
ENDPOINT = "https://push.example.org/upAbCdEf0123456789?up=1"


def _b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _hm(key: bytes, data: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha256).digest()


class Phone:
    """The UnifiedPush connector's half: a P-256 key pair and an auth secret; decrypts an aes128gcm record (RFC 8291 / RFC 8188)."""

    def __init__(self) -> None:
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.public = self.key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        self.auth = b"0123456789abcdef"
        self.p256dh_b64, self.auth_b64 = _b64u(self.public), _b64u(self.auth)

    def decrypt(self, body: bytes) -> dict:
        salt, rs, idlen = body[:16], int.from_bytes(body[16:20], "big"), body[20]
        as_public = body[21:21 + idlen]
        record = body[21 + idlen:]
        assert rs == 4096 and idlen == 65
        secret = self.key.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), as_public))
        ikm = _hm(_hm(self.auth, secret), b"WebPush: info\x00" + self.public + as_public + b"\x01")
        prk = _hm(salt, ikm)
        cek = _hm(prk, b"Content-Encoding: aes128gcm\x00\x01")[:16]
        nonce = _hm(prk, b"Content-Encoding: nonce\x00\x01")[:12]
        plain = AESGCM(cek).decrypt(nonce, record, None)
        assert plain.endswith(b"\x02")
        return json.loads(plain[:-1])


class FakeUpServer:
    """Stands in for a UnifiedPush push server (ntfy-like): records each POST, answers from a script per endpoint."""

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.script: dict[str, list[int]] = {}

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls.append({"url": str(request.url), "headers": dict(request.headers), "body": request.content})
        plan = self.script.get(str(request.url)) or [201]
        status = plan.pop(0) if len(plan) > 1 else plan[0]
        return httpx.Response(status, headers={"Retry-After": "0"} if status == 429 else {})


@pytest.fixture()
def upserver(monkeypatch):
    fake = FakeUpServer()
    monkeypatch.delenv("SW_PUSH_RELAY_URL", raising=False)  # no relay at all: the phone without Google is served on its own
    monkeypatch.delenv("SW_PUSH_RELAY_KEY", raising=False)
    monkeypatch.delenv(unifiedpush.ENV, raising=False)
    monkeypatch.setattr(unifiedpush, "TRANSPORT", httpx.MockTransport(fake.handler))
    monkeypatch.setattr(mobile_push, "BACKOFF_S", (0.0, 0.0, 0.0))
    monkeypatch.setattr(mobile_push, "now_utc", lambda: notify.now_utc())
    mobile_push.reset_limits()
    presence.reset_limits()
    mobile_push.reset_health()
    yield fake
    mobile_push.reset_limits()
    presence.reset_limits()
    mobile_push.reset_health()


@pytest.fixture()
def on(monkeypatch, upserver):
    monkeypatch.setenv(unifiedpush.ENV, SERVERS)
    return upserver


@pytest.fixture()
def w(settings, fake_push) -> World:
    return World(settings)


def _device_token(w: World, user: str, name: str = "הנייד שלי") -> tuple[str, dict]:
    r = w.c.post(f"{API}/presence/devices", json={"name": name, "platform": "android", "install_id": f"{user}-install-{name}-0000"[:60], "app_version": "2.2.0"},
                 headers=as_user(user))
    assert r.status_code in (200, 201), r.text  # 200: the same install again (its token is rotated)
    return r.json()["device_id"], {"Authorization": f"Bearer {r.json()['device_token']}"}


def _up_body(phone: Phone, endpoint: str = ENDPOINT, **over) -> dict:
    return {"platform": "android", "kind": "unifiedpush", "endpoint": endpoint, "p256dh": phone.p256dh_b64, "auth": phone.auth_b64, "app_version": "2.2.0", **over}


def _register(w: World, user: str, phone: Phone, endpoint: str = ENDPOINT, name: str = "הנייד שלי") -> tuple[str, dict]:
    did, tok = _device_token(w, user, name)
    r = w.c.post(f"{API}/notifications/devices", json=_up_body(phone, endpoint), headers=tok)
    assert r.status_code == 200, r.text
    return did, tok


def _device(w: World, user: str = "ops2") -> dict:
    return w.c.get(f"{API}/presence/devices/me", headers=as_user(user)).json()["devices"][0]


def _app_rows(w: World, nid: str) -> list[tuple[str, str | None]]:
    return [(r["status"], r["reason"]) for r in w.deliveries(nid) if r["channel"] == "app"]


# ---------------------------------------------------------------- off by default: a clear "not configured" state

def test_off_by_default_the_app_is_told_registration_refused_and_the_admin_sees_why(w, upserver):
    did, tok = _device_token(w, "ops2")
    cfg = w.c.get(f"{API}/presence/config", headers=tok).json()
    assert cfg["unifiedpush"] == {"enabled": False, "vapid_public_key": None}
    r = w.c.post(f"{API}/notifications/devices", json=_up_body(Phone()), headers=tok)
    assert r.status_code == 409 and r.json()["code"] == "unifiedpush_off" and "UnifiedPush" in r.json()["user_message"]
    h = w.c.get(f"{API}/notify/stats").json()["app_unifiedpush"]
    assert h["enabled"] is False and h["state"] == "off" and "unifiedpush_servers" in h["message"] and h["servers"] == 0
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT push_up_endpoint FROM mobile_devices WHERE id = ?", (did,)).fetchone()[0] is None
    assert upserver.calls == []


# ---------------------------------------------------------------- the site's list of push servers

@pytest.mark.parametrize("raw,servers,bad", [
    ("", 0, 0),
    ("push.example.org", 1, 0),
    ("push.example.org, ntfy.example.net:8443 ;  push.example.org", 2, 0),  # a duplicate counts once
    ("PUSH.Example.ORG:443", 1, 0),  # case and the default port fold
    ("192.0.2.10, localhost, https://push.example.org, push.example.org/x, push.example.999, a..b", 0, 6),
    ("192.0.2.10 push.example.org", 1, 1),
])
def test_the_server_list_takes_plain_host_names_only(monkeypatch, raw, servers, bad):
    monkeypatch.setenv(unifiedpush.ENV, raw)
    assert len(unifiedpush.allowed_servers()) == servers and unifiedpush._parse(raw)[1] == bad
    h = unifiedpush.health()
    assert h["state"] == ("ok" if servers else ("invalid" if bad else "off")) and h["invalid_entries"] == bad
    assert "192.0.2.10" not in json.dumps(h) and "example" not in json.dumps(h)  # never a host name in the health answer


@pytest.mark.parametrize("endpoint,ok", [
    (ENDPOINT, True),
    ("https://push.example.org:443/up?x=1", True),
    ("https://ntfy.example.net:8443/upX", True),
    ("https://ntfy.example.net/upX", False),  # the entry names a port: only that port
    ("https://push.example.org:8443/upX", False),
    ("http://push.example.org/upX", False),
    ("https://user:pw@push.example.org/upX", False),
    ("https://push.example.org/upX#frag", False),
    ("https://evil.push.example.org/upX", False),  # exact host, no sub-domains
    ("https://push.example.org.evil.net/upX", False),
    ("https://192.0.2.10/upX", False),
    ("https://push.example.org/up X", False),
    ("https://push.example.org/" + "x" * 2100, False),
    (None, False), (5, False), ("", False),
])
def test_an_endpoint_must_be_https_on_a_listed_server(monkeypatch, endpoint, ok):
    monkeypatch.setenv(unifiedpush.ENV, SERVERS)
    assert unifiedpush.allowed_endpoint(endpoint) is ok


# ---------------------------------------------------------------- registration

def test_registration_validates_returns_no_endpoint_and_is_audited(w, on):
    phone = Phone()
    did, tok = _device_token(w, "ops2")
    cfg = w.c.get(f"{API}/presence/config", headers=tok).json()["unifiedpush"]
    assert cfg["enabled"] is True and len(web_push.b64u_dec(cfg["vapid_public_key"])) == 65  # the key the distributor may need
    assert w.c.get(f"{API}/presence/config", headers=as_user("ops2")).json()["unifiedpush"] == cfg  # a session reads the same
    bad = [
        (_up_body(phone, "https://not-listed.example.com/up1"), 400, "unifiedpush_endpoint_refused", ["endpoint"]),
        (_up_body(phone, p256dh="AAAA"), 400, "push_keys_invalid", ["p256dh"]),
        (_up_body(phone, auth=_b64u(b"short")), 400, "push_keys_invalid", ["p256dh"]),
        (_up_body(phone, platform="ios"), 400, "invalid_platform", ["platform"]),
        (_up_body(phone, kind="carrier-pigeon"), 400, "invalid_push_kind", ["kind"]),
    ]
    for body, status, code, fields in bad:
        r = w.c.post(f"{API}/notifications/devices", json=body, headers=tok)
        assert r.status_code == status and r.json()["code"] == code and r.json()["details"]["fields"] == fields, (body, r.text)
        assert ENDPOINT not in r.text and "not-listed" not in r.text
    assert w.c.post(f"{API}/notifications/devices", json=_up_body(phone), headers=as_user("ops2")).status_code == 401  # device token only
    r = w.c.post(f"{API}/notifications/devices", json=_up_body(phone), headers=tok)
    assert r.status_code == 200
    out = r.json()
    assert out["push"]["registered"] is True and out["push"]["kind"] == "unifiedpush" and out["push"]["platform"] == "android"
    assert ENDPOINT not in r.text and phone.auth_b64 not in r.text and phone.p256dh_b64 not in r.text
    dev = _device(w)
    assert dev["push"]["registered"] is True and dev["push"]["kind"] == "unifiedpush" and "upAbCdEf" not in json.dumps(dev)
    # idempotent: the same call again keeps the mutes
    w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": ["automations"]}, headers=tok)
    assert w.c.post(f"{API}/notifications/devices", json=_up_body(phone), headers=tok).json()["push"]["muted"] == ["automations"]
    with w.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'notify.app.register' AND decision = 'allowed'").fetchall()
    assert rows and all("upAbCdEf" not in (r[0] or "") for r in rows)
    assert {json.loads(r[0]).get("kind") for r in rows} == {"unifiedpush"}


def test_one_route_per_device_and_one_endpoint_per_phone(w, on):
    phone = Phone()
    did, tok = _register(w, "ops2", phone)
    # moving to the relay clears the endpoint ...
    r = w.c.post(f"{API}/notifications/devices", json={"platform": "android", "relay_token": "rt_0123456789abcdef0123"}, headers=tok)
    assert r.json()["push"]["kind"] == "relay"
    with w.db.connection(mode="read") as conn:
        assert tuple(conn.execute("SELECT push_up_endpoint, push_up_p256dh, push_up_auth FROM mobile_devices WHERE id = ?", (did,)).fetchone()) == (None, None, None)
    # ... and back clears the relay token (an absent `kind` is the v2 body: relay)
    assert w.c.post(f"{API}/notifications/devices", json=_up_body(phone), headers=tok).json()["push"]["kind"] == "unifiedpush"
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT push_relay_token FROM mobile_devices WHERE id = ?", (did,)).fetchone()[0] is None
    # the same endpoint registered by another device row of this server (another user signed in on the phone): the older row loses it
    did3, tok3 = _register(w, "ops3", phone, name="אחר")
    assert _device(w)["push"]["registered"] is False and _device(w, "ops3")["push"]["kind"] == "unifiedpush"


# ---------------------------------------------------------------- the channel

def test_the_channel_sends_an_encrypted_content_less_body_and_the_phone_fetches_the_text(w, on):
    phone = Phone()
    did, tok = _register(w, "ops2", phone)
    w.set_policy("camera.offline", channels={"webpush": False, "email": False, "app": True})
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id
    w.flush()
    assert len(on.calls) == 1, on.calls
    call = on.calls[0]
    assert call["url"] == ENDPOINT
    h = call["headers"]
    assert h["content-encoding"] == "aes128gcm" and h["ttl"] == "3600" and h["urgency"] == "normal" and h["authorization"].startswith("vapid t=")
    assert h["authorization"].endswith("k=" + w.c.get(f"{API}/presence/config", headers=tok).json()["unifiedpush"]["vapid_public_key"])
    for forbidden in ("לובי".encode(), w.cam.encode(), b"ops2", b"#/"):
        assert forbidden not in call["body"]  # the push server sees ciphertext only
    data = phone.decrypt(call["body"])
    sid = w.c.get(f"{API}/presence/config", headers=tok).json()["server_id"]
    assert set(data) == {"notification_id", "category", "server", "priority"} and data["server"] == sid and data["category"] == "device_faults" and data["priority"] == "normal"
    msg = w.c.get(f"{API}/notifications/app/{data['notification_id']}", headers=tok).json()
    assert msg["notification_id"] == nid and "מצלמה" in msg["title"] and msg["deep_link"] == f"#/notifications/{nid}"
    assert _app_rows(w, nid) == [("sent", None)]
    assert _device(w)["push"]["last_ok_at"]
    assert w.c.get(f"{API}/notify/stats").json()["app_unifiedpush"]["sent"] >= 1
    # critical: urgency high, priority high
    w.set_policy("camera.offline", severity="critical")
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="crit")
    w.flush()
    assert on.calls[-1]["headers"]["urgency"] == "high" and phone.decrypt(on.calls[-1]["body"])["priority"] == "high"


def test_reach_mutes_and_quiet_hours_hold_like_the_relay(w, on, monkeypatch):
    import datetime as dt

    phone2, phone3 = Phone(), Phone()
    did, tok = _register(w, "ops2", phone2)
    _register(w, "ops3", phone3, endpoint="https://ntfy.example.net:8443/upOps3", name="של ops3")
    w.set_policy("camera.offline", channels={"webpush": False, "email": False, "app": True})
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="r1").id
    w.flush()
    assert [c["url"] for c in on.calls] == [ENDPOINT] and "ops3" not in w.recipients(nid)  # floor-3 operator never hears of a floor-2 camera
    w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": ["device_faults"]}, headers=tok)
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="r2").id
    w.flush()
    assert len(on.calls) == 1 and _app_rows(w, nid) == [("skipped", "muted")]
    w.c.patch(f"{API}/notifications/devices/{did}", json={"muted": []}, headers=tok)
    monkeypatch.setattr(notify, "now_utc", lambda: dt.datetime(2026, 10, 1, 20, 0, tzinfo=dt.timezone.utc))  # 23:00 local
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="q1").id
    w.flush()
    assert len(on.calls) == 1 and _app_rows(w, nid) == [("skipped", "quiet_hours")]


def test_gone_retry_and_a_server_removed_from_the_list(w, on, monkeypatch):
    phone = Phone()
    did, tok = _register(w, "ops2", phone)
    w.set_policy("camera.offline", channels={"webpush": False, "email": False, "app": True})
    # 429 then 201: retried on the notifier's heap after the re-check
    on.script[ENDPOINT] = [429, 201]
    n = w.notifier()
    from smplwise.services import notify_channels

    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="a").id
    notify_channels.process_outbox(n)
    assert len(on.calls) == 1 and [r["status"] for r in w.deliveries(nid) if r["channel"] == "app"] == ["retry"]
    assert n.run_due() == 1 and len(on.calls) == 2 and _app_rows(w, nid) == [("sent", None)]
    # the site takes the server off its list: the device is skipped (channel_unavailable), its registration kept, nothing is called
    monkeypatch.setenv(unifiedpush.ENV, "ntfy.example.net:8443")
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="b").id
    w.flush()
    assert len(on.calls) == 2 and _app_rows(w, nid) == [("skipped", "channel_unavailable")] and _device(w)["push"]["registered"] is True
    r = w.c.post(f"{API}/notifications/app/test", headers=tok)
    assert r.json() == {"message_id": r.json()["message_id"], "sent": False, "reason": "endpoint_refused"} and _device(w)["push"]["registered"] is True
    assert _device(w)["push"]["failures"] == 0  # the site's setup, not the phone: no failure counted
    # back on the list; the push server answers 410: the endpoint is gone, the device row stays
    monkeypatch.setenv(unifiedpush.ENV, SERVERS)
    on.script[ENDPOINT] = [410]
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}, dedupe_key="c").id
    w.flush()
    assert _app_rows(w, nid)[0][0] == "gone"
    dev = _device(w)
    assert dev["push"]["registered"] is False and dev["push"]["kind"] is None and dev["push"]["last_error"] == "unifiedpush_410"
    # a redirect is never followed
    assert w.c.post(f"{API}/notifications/devices", json=_up_body(phone), headers=tok).status_code == 200
    on.script[ENDPOINT] = [302]
    r = w.c.post(f"{API}/notifications/app/test", headers=tok)
    assert r.json()["sent"] is False and r.json()["reason"] == "unifiedpush_redirect" and len([c for c in on.calls if c["url"] == ENDPOINT]) == 4


def test_a_relay_phone_and_a_unifiedpush_phone_of_one_user_each_use_their_route(w, on, monkeypatch):
    """Relay unconfigured: the relay phone is skipped, the UnifiedPush phone still gets its push."""
    phone = Phone()
    _register(w, "ops2", phone, name="בלי גוגל")
    _, tok_relay = _device_token(w, "ops2", name="עם גוגל")
    w.c.post(f"{API}/notifications/devices", json={"platform": "android", "relay_token": "rt_0123456789abcdef0123"}, headers=tok_relay)
    w.set_policy("camera.offline", channels={"webpush": False, "email": False, "app": True})
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id
    w.flush()
    assert len(on.calls) == 1 and sorted(_app_rows(w, nid)) == [("sent", None), ("skipped", "channel_unavailable")]


def test_the_test_push_goes_to_the_endpoint(w, on):
    phone = Phone()
    did, tok = _register(w, "ops2", phone)
    r = w.c.post(f"{API}/notifications/app/test", headers=tok)
    assert r.status_code == 200 and r.json()["sent"] is True
    data = phone.decrypt(on.calls[-1]["body"])
    assert data["notification_id"] == r.json()["message_id"] and data["category"] == "system"
    assert w.c.get(f"{API}/notifications/app/{data['notification_id']}", headers=tok).json()["mode"] == "test"


# ---------------------------------------------------------------- sign-out and revocation end the endpoint

def test_unregister_revoke_and_sign_out_clear_the_endpoint(w, on):
    phone = Phone()
    did, tok = _register(w, "ops2", phone)
    assert w.c.delete(f"{API}/notifications/devices/{did}", headers=tok).status_code == 204
    with w.db.connection(mode="read") as conn:
        assert tuple(conn.execute("SELECT push_up_endpoint, push_up_auth FROM mobile_devices WHERE id = ?", (did,)).fetchone()) == (None, None)
    w.c.post(f"{API}/notifications/devices", json=_up_body(phone), headers=tok)
    with w.db.connection() as conn:
        assert presence.end_device_credentials(conn, "dev-ops2", "test_sign_out") == 1
        assert conn.execute("SELECT push_up_endpoint FROM mobile_devices WHERE id = ?", (did,)).fetchone()[0] is None
    did2, tok2 = _register(w, "ops2", Phone(), endpoint="https://push.example.org/upSecond", name="שני")
    assert w.c.delete(f"{API}/presence/devices/{did2}", headers=tok2).status_code == 204
    with w.db.connection(mode="read") as conn:
        assert tuple(conn.execute("SELECT push_up_endpoint, revoked_at IS NOT NULL FROM mobile_devices WHERE id = ?", (did2,)).fetchone()) == (None, 1)


def test_a_vapid_key_rotation_drops_the_endpoints_so_the_app_registers_again(w, on):
    phone = Phone()
    did, tok = _register(w, "ops2", phone)
    old = w.c.get(f"{API}/presence/config", headers=tok).json()["unifiedpush"]["vapid_public_key"]
    with w.db.connection() as conn:
        new, _ = web_push.rotate_key(conn)
    assert new != old and w.c.get(f"{API}/presence/config", headers=tok).json()["unifiedpush"]["vapid_public_key"] == new
    assert _device(w)["push"]["registered"] is False
    assert w.c.post(f"{API}/notifications/devices", json=_up_body(phone), headers=tok).json()["push"]["kind"] == "unifiedpush"
    r = w.c.post(f"{API}/notifications/app/test", headers=tok)
    assert r.json()["sent"] is True and on.calls[-1]["headers"]["authorization"].endswith("k=" + new)


def test_the_option_is_wired_in_the_manifest_and_the_options_writer():
    from pathlib import Path

    from smplwise.services import self_update

    assert self_update.OPTION_TYPES["unifiedpush_servers"] == "str?"
    text = (Path(__file__).resolve().parents[2] / "config.yaml").read_text(encoding="utf-8")
    assert '  unifiedpush_servers: ""' in text and "  unifiedpush_servers: str?" in text


def test_config_reads_the_option_into_the_environment(tmp_path, monkeypatch):
    from smplwise import config

    monkeypatch.delenv(unifiedpush.ENV, raising=False)
    opts = tmp_path / "options.json"
    opts.write_text(json.dumps({"bootstrap_admin_username": "joni", "unifiedpush_servers": "push.example.org"}), encoding="utf-8")
    config.load_settings(opts)
    import os

    assert os.environ.get(unifiedpush.ENV) == "push.example.org" and unifiedpush.enabled()
