"""CR-FLEET215: the signed daily fleet report (services/fleet_report.py, fleet_keys.py, routers/fleet.py).

Negative cases first: with either key off NOTHING happens (no build, no key file, no sequence number, no connection, no log row); the
payload carries nothing personal - a scan of the real payload built over a database seeded with sentinel names, addresses, titles and
hosts; the closed schema refuses any extra or malformed field and then nothing is signed or sent; a tampered body or signature does not
verify; the routes refuse a caller who is not a system administrator and never return the receiver URL or a private key.
FAKES ONLY: the receiver is an httpx.MockTransport; nothing leaves the test process."""
from __future__ import annotations

import base64
import datetime as dt
import json
import re
from pathlib import Path
from typing import Any

import httpx
import pytest
from conftest import as_user, bind, seed_tree

from smplwise.db import Database, new_id, now_iso
from smplwise.services import backup as backup_svc
from smplwise.services import fleet_keys
from smplwise.services import fleet_report as fr

URL = "https://fleet-receiver.test/base"
API = "/api/v1/fleet/report"
SENTINELS = ("Sentinel Lobby Cam", "רחוב הסנטינל 17", "sentinel.person@example.test", "Sentinel Alert Title", "Sentinel body text",
             "sentinel-nvr.example.test", "10.20.30.40", "Sentinel Person", "sentinel_user", "אתר בדיקה", "רחוב 1", "fleet-receiver.test")
# key names (or parts of key names) that would mean a personal / identifying / physical field slipped in
FORBIDDEN_KEY_PARTS = ("name", "title", "body", "label", "alias", "addr", "host", "url", "mail", "phone", "token", "passw", "secret",
                       "frame", "snapshot", "image", "door", "unlock", "latitude", "longitude", "serial", "mac_", "ip_", "person",
                       "user_id", "entity_id", "camera_id", "plate", "face", "place", "area", "note", "text", "detail", "error", "message")


class FakeReceiver:
    def __init__(self, status: int = 202, raise_exc: Exception | None = None) -> None:
        self.requests: list[httpx.Request] = []
        self.status = status
        self.raise_exc = raise_exc

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.raise_exc:
            raise self.raise_exc
        return httpx.Response(self.status, json={"ok": True}, headers={"location": "https://elsewhere.test/"} if 300 <= self.status < 400 else None)


@pytest.fixture()
def db(settings, client):  # `client` starts the app, which applies the migrations
    return Database(settings.db_path)


@pytest.fixture()
def receiver(monkeypatch):
    fake = FakeReceiver()
    monkeypatch.setattr(fr, "TRANSPORT", httpx.MockTransport(fake))
    return fake


@pytest.fixture()
def url_on(monkeypatch):
    monkeypatch.setenv(fr.URL_ENV, URL)


@pytest.fixture(autouse=True)
def _no_url_by_default(monkeypatch):
    monkeypatch.delenv(fr.URL_ENV, raising=False)


def _switch(db, on: bool) -> None:
    with db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                     (fr.SWITCH, "true" if on else "false"))


def _log_count(db) -> int:
    with db.connection(mode="read") as conn:
        return conn.execute("SELECT COUNT(*) FROM fleet_report_log").fetchone()[0]


def _walk(obj: Any, path: str = ""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield ("key", f"{path}.{k}" if path else k, k)
            yield from _walk(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _walk(v, f"{path}[{i}]")
    else:
        yield ("value", path, obj)


def _seed_personal(client, settings, db) -> None:
    """Sentinel personal / identifying data in every place a careless builder might copy from."""
    seed_tree(client)
    client.get("/api/v1/me", headers=as_user("sentinel_user"))
    with db.connection() as conn:
        conn.execute("UPDATE users SET display_name = 'Sentinel Person' WHERE username = 'sentinel_user'")
        conn.execute("INSERT INTO recorders(id, name, model, firmware, created_at) VALUES ('nvr-1', 'sentinel-nvr.example.test', 'DS-SENTINEL', 'V9', ?)", (now_iso(),))
        conn.execute("""INSERT INTO cameras(id, recorder_id, channel, name_source, alias, created_at, updated_at)
                        VALUES (?, 'nvr-1', 1, 'Sentinel Lobby Cam', 'Sentinel Lobby Cam', ?, ?)""", (new_id(), now_iso(), now_iso()))
        conn.execute("""INSERT INTO notifications(id, source, category, severity, subject_kind, title, body, place, dedupe_key, first_at, last_at, created_at)
                        VALUES (?, 'test', 'test', 'critical', 'camera', 'Sentinel Alert Title', 'Sentinel body text sentinel.person@example.test',
                                'רחוב הסנטינל 17', 'k1', ?, ?, ?)""", (new_id(), now_iso(), now_iso(), now_iso()))
        conn.execute("""INSERT INTO ha_entities(entity_id, name, domain, area_name, attributes_json, first_seen_at, updated_at)
                        VALUES ('lock.sentinel_front_door', 'Sentinel Person front door', 'lock', 'רחוב הסנטינל 17', '{"ip": "10.20.30.40"}', ?, ?)""",
                     (now_iso(), now_iso()))


# ================================================================ negative cases first

def test_switch_off_sends_nothing_builds_nothing_creates_nothing(settings, client, db, receiver, url_on, monkeypatch):
    built = []
    monkeypatch.setattr(fr, "build_body", lambda *a, **k: built.append(1) or {})
    out = fr.send_once(db, settings)
    assert out == {"sent": False, "result": "switch_off"}
    assert fr.tick(db, settings) is None
    assert receiver.requests == [] and built == []
    assert not fleet_keys.fleet_dir(settings).exists(), "no key, no id and no sequence number exist while the switch is off"
    assert _log_count(db) == 0
    with db.connection(mode="read") as conn:
        assert fr.switch_on(conn) is False, "the switch defaults OFF"
        assert conn.execute("SELECT COUNT(*) FROM settings WHERE key LIKE 'fleet.%'").fetchone()[0] == 0


def test_switch_on_without_the_add_on_option_sends_nothing(settings, client, db, receiver):
    _switch(db, True)
    assert fr.send_once(db, settings) == {"sent": False, "result": "receiver_not_configured"}
    assert fr.tick(db, settings) is None
    assert receiver.requests == [] and _log_count(db) == 0
    assert not fleet_keys.fleet_dir(settings).exists()
    r = client.post(API + "/send")
    assert r.status_code == 409 and r.json()["code"] == "receiver_not_configured", r.text
    assert receiver.requests == []


@pytest.mark.parametrize("bad", ["http://fleet.test", "https://user:pw@fleet.test", "https://fleet.test/x?a=1", "https://fleet.test/#f", "ftp://fleet.test",
                                 "fleet.test", "https://:443/", "https://fleet.test:99999/"])
def test_an_unusable_receiver_url_sends_nothing(settings, db, receiver, monkeypatch, bad):
    monkeypatch.setenv(fr.URL_ENV, bad)
    _switch(db, True)
    out = fr.send_once(db, settings)
    assert out["sent"] is False and out["result"] == "receiver_url_invalid"
    assert receiver.requests == [] and _log_count(db) == 0


def test_the_payload_carries_nothing_personal(settings, client, db, receiver, url_on):
    _seed_personal(client, settings, db)
    _switch(db, True)
    out = fr.send_once(db, settings)
    assert out["result"] == "ok", out
    assert len(receiver.requests) == 1
    raw = receiver.requests[0].content
    text = raw.decode("ascii")  # canonical JSON is pure ASCII: no Hebrew text can be inside
    payload = json.loads(text)
    for s in SENTINELS:
        assert s not in text and s.encode("utf-8") not in raw, s
    assert not re.search(r"\b\d{1,3}(\.\d{1,3}){3}\b", text), "no IPv4 address"
    assert "@" not in text and "://" not in text and "\\u05" not in text, "no e-mail, no URL, no (escaped) Hebrew"
    for kind, path, item in _walk(payload):
        if kind == "key":
            low = item.lower()
            assert not any(part in low for part in FORBIDDEN_KEY_PARTS) or path.startswith("components."), path
        elif isinstance(item, str):
            ok = (item == fr.SCHEMA or fr.ID_RE.match(item) or fr.TIME_RE.match(item) or fr.VERSION_RE.match(item) or item in fr.STATES
                  or item in fr.MODES or item in fr.UPDATE_CHECKS)
            assert ok, f"{path} carries a free string"
            assert len(item) <= 64, path
    # the seeded rows ARE counted (counters are allowed), proving the scan ran over a populated database
    assert payload["counts"]["cameras"] == 1 and payload["alerts_open"]["critical"] == 1 and payload["counts"]["ha_entities"] == 1
    assert payload["counts"]["users_active"] >= 2


def test_the_component_keys_are_subsystem_names_only():
    assert set(fr.COMPONENTS) == {"db", "storage", "nvr", "go2rtc", "ha_sync", "bridge", "events_ingest", "events_derive", "discovery",
                                  "thumbnails", "exports", "backups", "frigate"}


def test_the_whole_key_set_is_exactly_the_documented_schema(settings, client, db, receiver, url_on):
    _switch(db, True)
    fr.send_once(db, settings)
    payload = json.loads(receiver.requests[0].content)

    def paths(spec, prefix=""):
        for k, v in spec.items():
            p = f"{prefix}.{k}" if prefix else k
            yield p
            if isinstance(v, dict):
                yield from paths(v, p)
    got = {p for kind, p, _ in _walk(payload) if kind == "key"}
    assert got == set(paths(fr.SCHEMA_KEYS))
    doc = (Path(__file__).resolve().parents[3] / "docs" / "changes" / "CR-FLEET215.md").read_text(encoding="utf-8")
    for p in sorted(got):
        assert f"`{p}`" in doc, f"the change record does not justify `{p}`"


def test_an_extra_field_is_refused_by_the_schema_and_nothing_is_signed_or_sent(settings, db, receiver, url_on, monkeypatch):
    _switch(db, True)
    real = fr.collect

    def leaky(*a, **k):
        body = real(*a, **k)
        body["counts"]["camera_names"] = ["Sentinel Lobby Cam"]
        return body

    monkeypatch.setattr(fr, "collect", leaky)
    signed = []
    monkeypatch.setattr(fleet_keys, "sign", lambda *a, **k: signed.append(1) or ("k", "s"))
    out = fr.send_once(db, settings)
    assert out["result"] == "schema_refused" and out["sent"] is False
    assert receiver.requests == [] and signed == []
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT result, payload_json, kid FROM fleet_report_log").fetchone()
    assert row["result"] == "schema_refused" and row["payload_json"] is None and row["kid"] is None


def _valid_body() -> dict[str, Any]:
    import importlib.util

    spec = importlib.util.spec_from_file_location("gen_fixtures", Path(__file__).resolve().parents[3] / "services" / "fleet-receiver" / "tools" / "gen_fixtures.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.fixture_body()


NOW = dt.datetime(2026, 10, 22, 3, 0, tzinfo=dt.timezone.utc)


@pytest.mark.parametrize("mutate,why", [
    (lambda b: b.update(site="x"), "unexpected_key"),
    (lambda b: b["versions"].update(addon="2.12.1 (Lobby)"), "bad_version"),
    (lambda b: b["components"].update(nvr="down at 10.0.0.1"), "not_in_enum"),
    (lambda b: b["counts"].update(cameras=True), "bad_integer"),
    (lambda b: b["counts"].update(cameras=-1), "bad_integer"),
    (lambda b: b["disk"].update(free_pct=101), "bad_integer"),
    (lambda b: b["readiness"].update(missing=["backup", "backup"]), "bad_id_list"),
    (lambda b: b["readiness"].update(missing=["backup_recent"]), "bad_id_list"),  # READYFLEET-295: the old FLEET215 ids are gone
    (lambda b: b["readiness"].update(missing=["call 050-0000000"]), "bad_id_list"),
    (lambda b: b.pop("alerts_open"), "missing_key"),
    (lambda b: b.update(demo_mode="yes"), "bad_boolean"),
    (lambda b: b.update(schema="other/1"), "wrong_constant"),
    (lambda b: b["counts"].update(recorders_by_vendor={"hikvision": 1}), "missing_key"),
])
def test_the_closed_schema_refuses_every_deviation(mutate, why):
    body = _valid_body()
    fr.assemble(body, installation_id="a" * 32, seq=1, now=NOW)  # control: the untouched body passes
    mutate(body)
    with pytest.raises(fr.FleetSchemaError) as exc:
        fr.assemble(body, installation_id="a" * 32, seq=1, now=NOW)
    assert exc.value.why == why
    assert "Lobby" not in str(exc.value) and "10.0.0.1" not in str(exc.value), "the error names the place, never the value"


@pytest.mark.parametrize("iid,seq", [("A" * 32, 1), ("a" * 31, 1), ("a" * 32, 0), ("a" * 32, "1")])
def test_identity_fields_are_checked_too(iid, seq):
    with pytest.raises(fr.FleetSchemaError):
        fr.assemble(_valid_body(), installation_id=iid, seq=seq, now=NOW)


def test_a_tampered_body_or_signature_does_not_verify(settings, db, receiver, url_on):
    _switch(db, True)
    assert fr.send_once(db, settings)["result"] == "ok"
    req = receiver.requests[0]
    body, sig, kid = req.content, req.headers["x-arx-fleet-sig"], req.headers["x-arx-fleet-kid"]
    pub = fleet_keys.peek(settings)["public_key"]
    assert kid == fleet_keys.peek(settings)["kid"]
    assert fleet_keys.verify(pub, body, sig) is True  # control
    tampered = body.replace(b'"cameras":0', b'"cameras":9')
    assert tampered != body and fleet_keys.verify(pub, tampered, sig) is False
    raw = bytearray(base64.b64decode(sig))
    raw[0] ^= 1
    assert fleet_keys.verify(pub, body, base64.b64encode(bytes(raw)).decode()) is False
    # no domain separation -> no reuse: the bare body signature is not this signature
    from cryptography.hazmat.primitives import serialization

    priv = serialization.load_pem_private_key((fleet_keys.fleet_dir(settings) / f"{kid}.key").read_bytes(), password=None)
    bare = base64.b64encode(priv.sign(body)).decode()
    assert fleet_keys.verify(pub, body, bare) is False
    other = fleet_keys.verify(base64.b64encode(b"\x01" * 32).decode(), body, sig)
    assert other is False


def test_a_redirect_is_not_followed_and_counts_as_rejected(settings, db, url_on, monkeypatch):
    fake = FakeReceiver(status=302)
    monkeypatch.setattr(fr, "TRANSPORT", httpx.MockTransport(fake))
    _switch(db, True)
    out = fr.send_once(db, settings)
    assert out["result"] == "rejected" and out["http_status"] == 302
    assert len(fake.requests) == 1 and str(fake.requests[0].url) == URL + fr.REPORT_PATH


def test_unreachable_is_recorded_and_retried_after_three_hours(settings, db, url_on, monkeypatch):
    fake = FakeReceiver(raise_exc=httpx.ConnectError("refused"))
    monkeypatch.setattr(fr, "TRANSPORT", httpx.MockTransport(fake))
    _switch(db, True)
    out = fr.send_once(db, settings)
    assert out["result"] == "unreachable" and out["sent"] is False
    with db.connection(mode="read") as conn:
        assert fr.due(conn) is False
        import time

        assert fr.due(conn, now=time.time() + fr.PERIOD_RETRY_S + 1) is True
        row = conn.execute("SELECT result, payload_json FROM fleet_report_log").fetchone()
    assert row["result"] == "unreachable" and row["payload_json"], "the body that was attempted is kept for the customer to see"


# ================================================================ the allowed path

def test_a_report_is_signed_numbered_logged_and_daily(settings, db, receiver, url_on):
    _switch(db, True)
    first = fr.send_once(db, settings)
    second = fr.send_once(db, settings, trigger="manual", actor="dev-joni")
    assert (first["seq"], second["seq"]) == (1, 2) and first["result"] == second["result"] == "ok"
    r0, r1 = receiver.requests
    assert str(r0.url) == URL + "/v1/report" and r0.method == "POST"
    assert r0.headers["content-type"] == "application/json" and r0.headers["x-arx-fleet-schema"] == fr.SCHEMA
    p0, p1 = json.loads(r0.content), json.loads(r1.content)
    assert p0["installation_id"] == p1["installation_id"] == fleet_keys.peek(settings)["installation_id"]
    assert p0["generated_at"].endswith(":00Z"), "minute precision only"
    assert r0.content == fr.canonical(p0), "the signed bytes are the canonical form"
    with db.connection(mode="read") as conn:
        rows = fr.log_rows(conn)
        assert fr.due(conn) is False, "the next scheduled report is a day later"
    assert [r["seq"] for r in rows] == [2, 1] and rows[0]["trigger"] == "manual"
    assert rows[1]["payload"] == p0 and rows[0]["payload"] == p1, "the log keeps exactly what was sent"
    assert not any(k in json.dumps(rows) for k in ("x-arx-fleet-sig", "PRIVATE", URL))


def test_the_log_keeps_only_the_last_thirty(settings, db, receiver, url_on, monkeypatch):
    monkeypatch.setattr(fr, "LOG_KEEP", 3)
    _switch(db, True)
    for _ in range(5):
        fr.send_once(db, settings)
    with db.connection(mode="read") as conn:
        assert [r["seq"] for r in fr.log_rows(conn)] == [5, 4, 3]


def test_the_sequence_and_id_live_outside_the_database(settings, db, receiver, url_on):
    _switch(db, True)
    fr.send_once(db, settings)
    state = json.loads((fleet_keys.fleet_dir(settings) / fleet_keys.STATE_NAME).read_text())
    assert state["seq"] == 1 and fr.ID_RE.match(state["installation_id"])
    with db.connection(mode="read") as conn:
        dump = "\n".join(str(tuple(r)) for r in conn.execute("SELECT key, value FROM settings"))
    assert state["installation_id"] not in dump and state["kid"] not in dump
    key_file = fleet_keys.fleet_dir(settings) / f"{state['kid']}.key"
    assert key_file.exists() and "PRIVATE KEY" in key_file.read_text()
    assert fleet_keys.fleet_dir(settings) != (settings.data_dir / "keys"), "not the evidence key ring"
    # separate from the evidence bundles' installation id
    from smplwise.services import bundle

    with db.connection() as conn:
        assert bundle.installation_id(conn, create=True) != state["installation_id"]


def test_backups_never_carry_the_fleet_or_demo_state():
    assert "fleet_report_log" in backup_svc.NEVER_EXPORTED_TABLES
    from smplwise.services import demo_mode

    for key in (fr.SWITCH, "fleet.last_result", demo_mode.ALLOW_REMOTE):
        assert backup_svc._kept_setting(key), key


def test_the_enrollment_code_is_public_data_only(settings):
    facts = fleet_keys.ensure(settings)
    code = fleet_keys.enrollment_code(facts)
    m = re.match(r"^arx-fleet-1\.([0-9a-f]{32})\.([0-9a-f]{16})\.([A-Za-z0-9_-]{43})$", code)
    assert m and m.group(1) == facts["installation_id"] and m.group(2) == facts["kid"]
    assert base64.urlsafe_b64decode(m.group(3) + "=") == base64.b64decode(facts["public_key"])
    assert fleet_keys.ensure(settings) == facts, "idempotent: no second key, no new id"


# ================================================================ routes

def test_routes_refuse_who_is_not_a_system_administrator(client, settings, db, receiver, url_on):
    for method, path in (("GET", API), ("PUT", API), ("GET", API + "/enrollment"), ("GET", API + "/preview"), ("GET", API + "/log"), ("POST", API + "/send")):
        r = client.request(method, path, json={"enabled": True} if method == "PUT" else None, headers=as_user("nobody"))
        assert r.status_code == 403, (method, path, r.text)
    bind(client, settings, "otto", "site_admin", "installation", "*")
    r = client.put(API, json={"enabled": True}, headers=as_user("otto"))
    assert r.status_code == 403, r.text
    with db.connection(mode="read") as conn:
        assert fr.switch_on(conn) is False
    assert receiver.requests == [] and not fleet_keys.fleet_dir(settings).exists()


def test_switch_route_audits_and_status_never_shows_the_url(client, settings, db, receiver, url_on):
    r = client.get(API)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["enabled"] is False and body["receiver_configured"] is True and body["installation_id"] is None
    assert "fleet-receiver.test" not in r.text
    assert client.put(API, json={"enabled": True, "url": "https://x.test"}).status_code == 422, "no extra fields"
    r = client.put(API, json={"enabled": True})
    assert r.status_code == 200 and r.json()["enabled"] is True and r.json()["sending"] is True
    assert fr.ID_RE.match(r.json()["installation_id"])
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT decision, details_json FROM audit_log WHERE resource_id = 'fleet.report' AND action = 'settings.changed'").fetchall()
    assert [json.loads(x["details_json"]) for x in rows] == [{"key": fr.SWITCH, "before": "off", "after": "on"}]
    assert receiver.requests == [], "switching on does not send by itself"


def test_preview_shows_what_would_be_sent_and_creates_nothing(client, settings, db, receiver, url_on):
    r = client.get(API + "/preview")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["preview"] is True and body["id_assigned"] is False and body["payload"]["seq"] == 1
    fr.validate(body["payload"])
    assert not fleet_keys.fleet_dir(settings).exists() and receiver.requests == [] and _log_count(db) == 0


def test_enrollment_route_returns_public_facts_only(client, settings):
    r = client.get(API + "/enrollment")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"installation_id", "kid", "alg", "public_key", "code"}
    assert "PRIVATE" not in r.text and "BEGIN" not in r.text


def test_send_route_is_refused_while_the_switch_is_off_then_sends_and_audits(client, settings, db, receiver, url_on):
    r = client.post(API + "/send")
    assert r.status_code == 409 and r.json()["code"] == "fleet_report_off"
    assert receiver.requests == []
    client.put(API, json={"enabled": True})
    r = client.post(API + "/send")
    assert r.status_code == 200 and r.json()["result"] == "ok", r.text
    assert len(receiver.requests) == 1
    log = client.get(API + "/log").json()["items"]
    assert len(log) == 1 and log[0]["trigger"] == "manual" and log[0]["payload"]["seq"] == 1
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'fleet.report.send' ORDER BY id").fetchall()
    assert [(x["decision"], x["reason"]) for x in rows] == [("denied", "fleet_report_off"), ("allowed", None)]


def test_the_schema_file_and_options_are_wired():
    from smplwise.services import self_update

    assert self_update.OPTION_TYPES["fleet_report_url"] == "str?"
    text = (Path(__file__).resolve().parents[2] / "config.yaml").read_text(encoding="utf-8")
    assert '  fleet_report_url: ""' in text and "  fleet_report_url: str?" in text


# ================================================================ settings UI slice: silence threshold + the "reporting stopped" message

def test_silence_threshold_defaults_to_36_is_editable_in_range_and_audited(client, settings, db, receiver, url_on):
    st = client.get(API).json()
    assert st["silent_after_h"] == 36 and st["silent_range_h"] == [fr.SILENT_MIN_H, fr.SILENT_MAX_H] and st["silent_default_h"] == 36
    r = client.put(API, json={"silent_after_h": 48})
    assert r.status_code == 200 and r.json()["silent_after_h"] == 48 and r.json()["enabled"] is False, "only the threshold changed"
    for bad in (fr.SILENT_MIN_H - 1, fr.SILENT_MAX_H + 1, 0, -5):
        assert client.put(API, json={"silent_after_h": bad}).status_code == 422, bad
    assert client.put(API, json={}).status_code == 422, "an empty change is refused"
    assert client.put(API, json={"silent_after_h": "x"}).status_code == 422
    assert client.get(API).json()["silent_after_h"] == 48
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE resource_id = 'fleet.report' AND action = 'settings.changed'").fetchall()
    assert [json.loads(x["details_json"]) for x in rows] == [{"key": fr.SILENT_KEY, "before": 36, "after": 48}]
    assert receiver.requests == []


def test_the_silence_threshold_travels_as_one_header_not_in_the_signed_body(settings, db, receiver, url_on):
    _switch(db, True)
    with db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES(?, ?)", (fr.SILENT_KEY, "60"))
    assert fr.send_once(db, settings)["result"] == "ok"
    req = receiver.requests[0]
    assert req.headers["x-arx-fleet-silent-after-h"] == "60"
    assert "silent" not in req.content.decode(), "the report body (52 fields) is unchanged"


def test_switching_off_sends_one_last_signed_stop_message(client, settings, db, receiver, url_on):
    assert client.put(API, json={"enabled": True}).status_code == 200
    assert client.post(API + "/send").json()["result"] == "ok"
    receiver.requests.clear()
    r = client.put(API, json={"enabled": False})
    assert r.status_code == 200 and r.json()["enabled"] is False and r.json()["stopped_result"] == "ok" and r.json()["stopped_at"]
    assert len(receiver.requests) == 1
    req = receiver.requests[0]
    assert str(req.url) == URL + fr.STOP_PATH and req.headers["x-arx-fleet-schema"] == fr.STOP_SCHEMA
    body = json.loads(req.content)
    facts = fleet_keys.peek(settings)
    assert set(body) == set(fr.STOP_KEYS) and body["schema"] == fr.STOP_SCHEMA and body["seq"] == 2
    assert body["installation_id"] == facts["installation_id"]
    assert fleet_keys.verify(facts["public_key"], req.content, req.headers["x-arx-fleet-sig"]) is True
    log = client.get(API + "/log").json()["items"]
    assert log[0]["trigger"] == "stop" and log[0]["result"] == "ok" and log[0]["payload"]["schema"] == fr.STOP_SCHEMA
    with db.connection(mode="read") as conn:  # the daily state is untouched by the stop message
        assert conn.execute("SELECT value FROM settings WHERE key = 'fleet.last_result'").fetchone()["value"] == "ok"


def test_no_stop_message_when_it_was_already_off_or_without_the_add_on_option(client, settings, db, receiver, url_on, monkeypatch):
    assert client.put(API, json={"enabled": False}).status_code == 200, "off -> off"
    assert receiver.requests == []
    client.put(API, json={"enabled": True})
    monkeypatch.delenv(fr.URL_ENV)
    r = client.put(API, json={"enabled": False})
    assert r.status_code == 200 and receiver.requests == [], "without the add-on option nothing leaves"
    assert r.json()["stopped_at"] is None


def test_a_failed_stop_message_never_blocks_the_switch(client, settings, db, url_on, monkeypatch):
    client.put(API, json={"enabled": True})
    monkeypatch.setattr(fr, "TRANSPORT", httpx.MockTransport(FakeReceiver(raise_exc=httpx.ConnectError("refused"))))
    r = client.put(API, json={"enabled": False})
    assert r.status_code == 200 and r.json()["enabled"] is False and r.json()["stopped_result"] == "unreachable"


def test_stop_body_refuses_a_bad_id():
    with pytest.raises(fr.FleetSchemaError):
        fr.stop_body("not-an-id", 1, dt.datetime.now(dt.timezone.utc))
