"""ONVIF-API-2500: the HTTP routes of camera discovery (routers/camera_discovery.py over services/camera_discovery MANAGER), their wire
models (smplwise/wire/camera_discovery.py -> frontend/src/api/generated/wire-camera-discovery.ts), the settings registration
(`cameras.discovery*`), RBAC, the error envelope (ADR-019 D1: `details.fields` / `details.problems`), the rate-limit answers and the
no-secret rule. Design docs/design/onvif-discovery-2412 sections 7 and 14; owner decisions 2026-11-22 Q55-Q61.

No real network: the fake ONVIF network of tests/fixtures/fake_onvif.py (UDP transport + httpx.MockTransport), the site network a
fixed list, no Supervisor. Addresses are a made-up RFC 1918 network (10.77.0.0/24); users, passwords and serials are made up, and the
tests that carry one grep every answer, the audit log and the captured log for it."""
from __future__ import annotations

import importlib
import importlib.util
import ipaddress
import json
import logging
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.routing import APIRoute

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))

from conftest import as_user, make_client  # noqa: E402
from fake_onvif import FakeNetwork, FakeOnvifDevice, hik_scopes  # noqa: E402
from support.audit import audit_details, audit_rows  # noqa: E402

from smplwise.db import Database, set_setting  # noqa: E402
from smplwise.services.camera_discovery import onvif_http, ranges, service as svc  # noqa: E402
from smplwise.wire import WireModel  # noqa: E402
from smplwise.wire import camera_discovery as W  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
API = "/api/v1/cameras/discovery"
RANGE = "10.77.0.64/27"
HOST = "10.77.0.10/24"
USER, PASSWORD, WRONG = "onvif-op-77", "Cam-Pass-1", "Wrong-Pass-9"
SERIALS = ("FAKESERIAL0001", "FAKESERIAL0002", "NVRSERIAL0009")
SECRETS = (PASSWORD, WRONG, *SERIALS)
ENVELOPE = {"code", "user_message", "retryable", "correlation_id", "details"}


def devices() -> list[FakeOnvifDevice]:
    return [
        FakeOnvifDevice("10.77.0.71", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000071", scopes=hik_scopes("DS-2CD2143G2-I"), serial=SERIALS[0]),
        FakeOnvifDevice("10.77.0.72", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000072", scopes=hik_scopes("IPC-HDW2431T", "Dahua IPC-HDW2431T"),
                        manufacturer="Dahua", model="IPC-HDW2431T", serial=SERIALS[1]),
        FakeOnvifDevice("10.77.0.80", "urn:uuid:aaaaaaaa-0000-4000-8000-000000000080", scopes=hik_scopes("DS-7608NI-K2"), model="DS-7608NI-K2",
                        serial=SERIALS[2]),  # a recorder calling itself a video transmitter (Q59)
    ]


@pytest.fixture()
def env(settings, monkeypatch):
    client = make_client(settings)
    assert client.get("/api/v1/me").status_code == 200  # joni: the bootstrap system administrator
    net = FakeNetwork(devices())
    for d in net.devices.values():
        d.username = USER  # a distinctive user name, so the grep below means something
    m = svc.MANAGER
    m.transport_factory = net
    m.run_inline = True  # the sweep runs inside the request (no thread to wait for)
    m.listen_s = 0.05
    m.resolve = lambda name: []
    monkeypatch.setattr(onvif_http, "TRANSPORT", net.transport())
    monkeypatch.setattr(ranges, "SITE_INTERFACES", lambda s: [ipaddress.ip_interface(HOST)])
    db = Database(settings.db_path)
    with db.connection() as conn:
        set_setting(conn, svc.K_RATE, "200")
    return SimpleNamespace(c=client, net=net, db=db, settings=settings, m=m)


def start(env, rng: str | None = RANGE, **kw):
    return env.c.post(f"{API}/scans", json={} if rng is None else {"range": rng}, **kw)


def by_addr(job: dict) -> dict[str, dict]:
    return {d["address"]: d for d in job["devices"]}


def no_secret(text: str, where: str) -> None:
    for s in SECRETS:
        assert s not in text, f"{s!r} {where}"


def envelope(r, status: int, code: str) -> dict:
    assert r.status_code == status, r.text
    body = r.json()
    assert set(body) == ENVELOPE, body
    assert body["code"] == code and isinstance(body["user_message"], str) and body["user_message"]
    assert isinstance(body["details"], dict) and isinstance(body["retryable"], bool)
    return body


def field_refusal(body: dict, fields: list[str]) -> None:
    """ADR-019 D1: the field names, and one problem per field with a machine code."""
    assert body["details"]["fields"] == fields, body
    probs = body["details"]["problems"]
    assert [p["field"] for p in probs][: len(fields)] == fields or sorted({p["field"] for p in probs}) == sorted(fields), body
    assert all(isinstance(p["code"], str) and p["code"] for p in probs)


# ================================================================ the route table, the wire models, the generated types

def _gen():
    spec = importlib.util.spec_from_file_location("gen_wire_types", ROOT / "scripts" / "gen_wire_types.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules.setdefault("gen_wire_types", mod)
    spec.loader.exec_module(mod)
    return mod


def _routes() -> list[tuple[str, APIRoute]]:
    out = []
    for r in importlib.import_module("smplwise.routers.camera_discovery").router.routes:
        if isinstance(r, APIRoute):
            for m in sorted(r.methods - {"HEAD", "OPTIONS"}):
                out.append((f"{m} {r.path}", r))
    return out


def test_every_route_has_an_exact_wire_model_and_the_generated_types_name_it():
    gen = _gen()
    keys = [k for k, _r in _routes()]
    assert keys == ["GET /cameras/discovery/capabilities", "GET /cameras/discovery/scans", "POST /cameras/discovery/scans",
                    "GET /cameras/discovery/scans/{scan_id}", "DELETE /cameras/discovery/scans/{scan_id}",
                    "POST /cameras/discovery/scans/{scan_id}/identify"]
    for key, r in _routes():
        models = gen.wire_models(r.response_model)
        assert models and r.response_model_exclude_unset, key
    assert gen.FAMILIES["CameraDiscovery"] == ("wire-camera-discovery.ts", ("camera_discovery",))
    text = (ROOT / "frontend" / "src" / "api" / "generated" / "wire-camera-discovery.ts").read_text(encoding="utf-8")
    for key in keys:
        method, path = key.split(" ", 1)
        assert f'"{method} /api/v1{path}"' in text, key
    assert gen.main(["--check"]) == 0
    assert W.NO_JSON == frozenset()


def test_the_models_are_exact_and_have_no_secret_field():
    for name, obj in vars(W).items():
        if isinstance(obj, type) and issubclass(obj, WireModel) and obj.__module__ == W.__name__:
            assert obj.model_config.get("extra") == "allow" and obj.model_config.get("strict") is True, name
            for field in obj.model_fields:
                assert not any(w in field for w in ("password", "username", "user", "serial", "mac", "url", "creds")), (name, field)
    with pytest.raises(Exception):
        W.ScanProgress.model_validate({"checked": 1.0, "total": 2})  # strict: 1.0 is never turned into 1


def test_the_discovery_routes_come_before_the_camera_routes():
    """`GET /cameras/{camera_id}/capabilities` (routers/cameras.py) would swallow `GET /cameras/discovery/capabilities`."""
    from smplwise.routers import ROUTERS, Mount

    order = [e.module for e in ROUTERS if isinstance(e, Mount)]
    assert order.index("camera_discovery") < order.index("cameras")


# ================================================================ the happy path

def test_capabilities_scan_poll_list_identify(env, caplog):
    caplog.set_level(logging.DEBUG)
    caps = env.c.get(f"{API}/capabilities")
    assert caps.status_code == 200, caps.text
    assert caps.json() == {"enabled": True, "engines": [{"id": "unicast", "available": True}], "suggested_range": "10.77.0.0/24",
                           "max_addresses": 1024, "running": False}

    r = start(env)
    assert r.status_code == 202, r.text
    job = r.json()
    assert job["state"] == "done" and job["range"] == RANGE and job["progress"] == {"checked": 30, "total": 30}
    assert job["counts"] == {"found": 3, "cameras": 2, "recorders": 1, "unknown": 0, "known": 0, "addable": 2}
    devs = by_addr(job)
    assert devs["10.77.0.71"]["kind"] == "camera" and devs["10.77.0.71"]["addable"] is True and "recorder_prefill" not in devs["10.77.0.71"]
    rec = devs["10.77.0.80"]
    assert rec["kind"] == "nvr" and rec["addable"] is False
    assert rec["recorder_prefill"] == {"host": "10.77.0.80", "http_port": 80, "vendor": "hikvision", "name": "HIKVISION DS-7608NI-K2"}

    poll = env.c.get(f"{API}/scans/{job['id']}")
    assert poll.status_code == 200 and poll.json() == job
    listed = env.c.get(f"{API}/scans").json()
    assert listed == {"scans": [{k: v for k, v in job.items() if k != "devices"}]}

    ids = [devs["10.77.0.71"]["id"], devs["10.77.0.72"]["id"], rec["id"]]
    r = env.c.post(f"{API}/scans/{job['id']}/identify", json={"device_ids": ids, "username": USER, "password": PASSWORD, "same_for_all": True})
    assert r.status_code == 200, r.text
    got = {d["address"]: d for d in r.json()["devices"]}
    assert got["10.77.0.71"]["auth"] == "ok" and got["10.77.0.71"]["firmware"] == "V5.7.3 build 220112"
    assert got["10.77.0.72"]["auth"] == "ok" and got["10.77.0.72"]["manufacturer"] == "Dahua"
    assert got["10.77.0.80"]["auth"] == "skipped"  # Q59: the recorder is never sent the camera password
    assert [d.auth_requests for d in env.net.devices.values()] == [1, 1, 0]  # ONE attempt per camera (Q57)

    rows = audit_rows(env.settings, "camera.discovery.scan") + audit_rows(env.settings, "camera.discovery.identify")
    assert [r["decision"] for r in rows] == ["allowed", "allowed"]
    assert audit_details(env.settings, "camera.discovery.identify")[0]["results"] == {"ok": 2, "skipped": 1}
    no_secret(json.dumps([caps.json(), job, listed, r.json()]), "in an answer")
    no_secret(json.dumps(rows, default=str), "in the audit log")
    no_secret(caplog.text, "in the log")
    assert USER not in json.dumps(rows, default=str) + caplog.text + r.text


def test_a_wrong_password_then_the_same_pair_is_not_sent_again(env, caplog):
    caplog.set_level(logging.DEBUG)
    job = start(env).json()
    cam = by_addr(job)["10.77.0.71"]["id"]
    body = {"device_ids": [cam], "username": USER, "password": WRONG}
    r1 = env.c.post(f"{API}/scans/{job['id']}/identify", json=body)
    r2 = env.c.post(f"{API}/scans/{job['id']}/identify", json=body)
    assert [r1.json()["devices"][0]["auth"], r2.json()["devices"][0]["auth"]] == ["wrong_password", "wrong_password"]
    assert env.net.devices["10.77.0.71"].auth_requests == 1  # the refused pair was not sent a second time
    no_secret(r1.text + r2.text + caplog.text + json.dumps(audit_rows(env.settings, "camera.discovery.identify"), default=str), "after a refusal")


def test_cancel_forgets_the_scan_for_identification(env):
    job = start(env).json()
    r = env.c.delete(f"{API}/scans/{job['id']}")
    assert r.status_code == 200 and r.json() == {"cancelled": True}
    assert env.c.get(f"{API}/scans/{job['id']}").json()["state"] == "cancelled"
    cam = by_addr(job)["10.77.0.71"]["id"]
    r = env.c.post(f"{API}/scans/{job['id']}/identify", json={"device_ids": [cam], "username": USER, "password": PASSWORD})
    envelope(r, 409, "scan_not_active")
    assert env.net.devices["10.77.0.71"].auth_requests == 0
    assert [d["was"] for d in audit_details(env.settings, "camera.discovery.cancel")] == ["done"]


# ================================================================ RBAC

@pytest.mark.parametrize("method, path, body", [
    ("GET", "/capabilities", None),
    ("GET", "/scans", None),
    ("POST", "/scans", {"range": RANGE}),
    ("GET", "/scans/{sid}", None),
    ("DELETE", "/scans/{sid}", None),
    ("POST", "/scans/{sid}/identify", {"device_ids": ["d1"], "username": USER, "password": PASSWORD}),
])
def test_every_route_needs_system_configure_and_the_refusal_is_audited(env, method, path, body):
    job = start(env).json()
    env.c.get("/api/v1/me", headers=as_user("guard"))
    before = len(audit_rows(env.settings, "system.configure"))
    r = env.c.request(method, API + path.format(sid=job["id"]), json=body, headers=as_user("guard"))
    envelope(r, 403, "forbidden")
    rows = audit_rows(env.settings, "system.configure")
    assert len(rows) == before + 1 and rows[-1]["decision"] == "denied" and rows[-1]["actor_username"] == "guard"
    no_secret(r.text + json.dumps(rows, default=str), "in a refusal")
    assert all(d.auth_requests == 0 for d in env.net.devices.values())


@pytest.mark.parametrize("path", ["/scans", "/scans/{sid}/identify"])
def test_a_refused_caller_gets_the_403_before_the_body_is_read(env, path):
    job = start(env).json()
    env.c.get("/api/v1/me", headers=as_user("guard"))
    r = env.c.post(API + path.format(sid=job["id"]), content=b"not json at all", headers={**as_user("guard"), "content-type": "text/plain"})
    envelope(r, 403, "forbidden")


# ================================================================ the error contract (ADR-019 D1)

@pytest.mark.parametrize("rng, status, code", [
    ("10.0.0.0/24", 422, "range_refused"),  # an arbitrary private range (Q56)
    ("10.77.0.0/21", 422, "range_too_large"),
    ("not a range", 422, "range_invalid"),
])
def test_a_refused_range_names_the_field(env, rng, status, code):
    body = envelope(start(env, rng), status, code)
    field_refusal(body, ["range"])
    assert body["details"]["problems"][0]["code"] == code and body["details"]["max_addresses"] == 1024
    assert env.net.sent == []


def test_an_unknown_site_network_and_a_switched_off_feature(env, monkeypatch):
    with env.db.connection() as conn:
        set_setting(conn, svc.K_MODE, "off")
    body = envelope(start(env), 409, "discovery_off")
    assert "fields" not in body["details"]
    assert env.c.get(f"{API}/capabilities").json()["enabled"] is False
    with env.db.connection() as conn:
        set_setting(conn, svc.K_MODE, "manual")
    monkeypatch.setattr(ranges, "SITE_INTERFACES", lambda s: [])
    ranges._reset_for_tests()
    envelope(start(env, None), 422, "site_network_unknown")
    caps = env.c.get(f"{API}/capabilities").json()
    assert caps["suggested_range"] is None and caps["engines"] == [{"id": "unicast", "available": False, "reason": "site_network_unknown"}]
    assert env.net.sent == []


def test_an_empty_body_scans_the_suggested_range(env):
    r = env.c.post(f"{API}/scans")
    assert r.status_code == 202 and r.json()["range"] == "10.77.0.0/24"


@pytest.mark.parametrize("payload, fields, code", [
    ({"range": RANGE, "engines": ["go2rtc"]}, ["engines"], "extra_forbidden"),
    ({"range": 24}, ["range"], "string_type"),
    ({"range": "x" * 65}, ["range"], "string_too_long"),
])
def test_a_bad_scan_body_names_its_fields(env, payload, fields, code):
    body = envelope(env.c.post(f"{API}/scans", json=payload), 422, "validation")
    field_refusal(body, fields)
    assert body["details"]["problems"][0]["code"] == code
    assert env.net.sent == []


def test_a_body_that_is_not_a_json_object(env):
    r = env.c.post(f"{API}/scans", content=b"[1, 2]", headers={"content-type": "application/json"})
    field_refusal(envelope(r, 422, "validation"), ["body"])
    r = env.c.post(f"{API}/scans", content=b"{not json", headers={"content-type": "application/json"})
    field_refusal(envelope(r, 422, "validation"), ["body"])
    envelope(env.c.post(f"{API}/scans", content=b"range=1", headers={"content-type": "text/plain"}), 415, "unsupported_media_type")


def test_identify_refusals_name_the_field_and_never_echo_the_password(env, caplog):
    caplog.set_level(logging.DEBUG)
    job = start(env).json()
    devs = by_addr(job)
    a, b = devs["10.77.0.71"]["id"], devs["10.77.0.72"]["id"]
    url = f"{API}/scans/{job['id']}/identify"
    cases = [
        ({"device_ids": [a, b], "username": USER, "password": PASSWORD}, 422, "same_for_all_required", ["same_for_all"]),
        ({"device_ids": ["d000000000000"], "username": USER, "password": PASSWORD}, 422, "device_unknown", ["device_ids"]),
        ({"device_ids": [a], "username": USER, "password": ""}, 422, "credentials_invalid", ["password"]),
        ({"device_ids": [a], "username": "  ", "password": PASSWORD}, 422, "credentials_invalid", ["username"]),
        ({"device_ids": [a], "username": USER, "password": PASSWORD + "x" * 200}, 422, "validation", ["password"]),
        ({"device_ids": [], "username": USER, "password": PASSWORD}, 422, "validation", ["device_ids"]),
        ({"device_ids": [a], "username": USER, "password": PASSWORD, "same_for_all": "yes"}, 422, "validation", ["same_for_all"]),
        ({"device_ids": [a], "username": USER, "password": PASSWORD, "remember": True}, 422, "validation", ["remember"]),
    ]
    texts = []
    for payload, status, code, fields in cases:
        r = env.c.post(url, json=payload)
        field_refusal(envelope(r, status, code), fields)
        texts.append(r.text)
    assert all(d.auth_requests == 0 for d in env.net.devices.values())
    no_secret("".join(texts) + caplog.text, "in a refusal")
    envelope(env.c.post(f"{API}/scans/0123456789abcdef/identify", json=cases[2][0] | {"password": PASSWORD}), 404, "scan_not_found")
    envelope(env.c.get(f"{API}/scans/{'z' * 300}"), 404, "scan_not_found")
    envelope(env.c.delete(f"{API}/scans/0123456789abcdef"), 404, "scan_not_found")


# ================================================================ rate limits: 429 with Retry-After

def test_the_scan_rate_limit_answers_429_with_retry_after(env):
    for _ in range(svc.SCANS_PER_10MIN_USER):
        assert start(env).status_code == 202
    r = start(env)
    body = envelope(r, 429, "rate_limited")
    assert body["retryable"] is True and body["details"]["retry_after_s"] >= 1
    assert r.headers["Retry-After"] == str(body["details"]["retry_after_s"])
    assert audit_rows(env.settings, "camera.discovery.scan")[-1]["reason"] == "rate_limited"


def test_the_identify_rate_limit_answers_429_with_retry_after(env):
    job = start(env).json()
    cam = by_addr(job)["10.77.0.71"]["id"]
    for _ in range(svc.IDENTIFY_PER_10MIN_USER):
        env.m.limits.hit("identify:dev-joni", svc._IDENTIFY_LIMITS)
    r = env.c.post(f"{API}/scans/{job['id']}/identify", json={"device_ids": [cam], "username": USER, "password": PASSWORD})
    body = envelope(r, 429, "rate_limited")
    assert int(r.headers["Retry-After"]) == body["details"]["retry_after_s"] > 0
    assert env.net.devices["10.77.0.71"].auth_requests == 0
    no_secret(r.text, "in the 429")


# ================================================================ settings registration

def test_the_discovery_settings_are_registered_validated_and_followed(env):
    r = env.c.patch("/api/v1/settings", json={"cameras.discovery_allowed_ranges": "10.77.0.64/26,  10.77.0.64/26 192.168.5.0/24",
                                              "cameras.discovery_range_max": "/24", "cameras.discovery_http_fallback": "on",
                                              "cameras.discovery_rate_pps": "100", "cameras.discovery_job_ttl_min": "30"})
    assert r.status_code == 200, r.text
    s = r.json()["settings"]
    assert s["cameras.discovery_allowed_ranges"] == "10.77.0.64/26, 192.168.5.0/24"  # normalised, duplicates dropped
    assert (s["cameras.discovery"], s["cameras.discovery_range_max"], s["cameras.discovery_http_fallback"]) == ("manual", "/24", "on")
    with env.db.connection(mode="read") as conn:
        pol = svc.policy(conn)
    assert (pol.max_addresses, pol.http_fallback, pol.rate_pps, pol.job_ttl_s) == (256, True, 100, 1800.0)
    assert [str(n) for n in pol.allowed] == ["10.77.0.64/26", "192.168.5.0/24"]
    assert env.c.get(f"{API}/capabilities").json()["max_addresses"] == 256
    job = start(env, "10.77.0.64/27").json()
    assert job["engines"] == ["unicast", "http"]
    field_refusal(envelope(start(env, "10.77.0.0/26"), 422, "range_refused"), ["range"])  # outside the allowed ranges

    # the ranges describe the site's network: system.configure only
    env.c.get("/api/v1/me", headers=as_user("guard"))
    assert "cameras.discovery_allowed_ranges" not in env.c.get("/api/v1/settings", headers=as_user("guard")).json()["settings"]
    assert "cameras.discovery" in env.c.get("/api/v1/settings", headers=as_user("guard")).json()["settings"]
    assert env.c.get("/api/v1/settings").json()["settings"]["cameras.discovery_allowed_ranges"] == "10.77.0.64/26, 192.168.5.0/24"

    r = env.c.patch("/api/v1/settings", json={"cameras.discovery": "off"})
    assert r.status_code == 200
    envelope(start(env), 409, "discovery_off")
    r = env.c.patch("/api/v1/settings", json={"cameras.discovery_allowed_ranges": ""})
    assert r.status_code == 200 and r.json()["settings"]["cameras.discovery_allowed_ranges"] == ""


@pytest.mark.parametrize("key, value", [
    ("cameras.discovery_allowed_ranges", "8.8.8.0/24"),  # public
    ("cameras.discovery_allowed_ranges", "172.30.32.0/24"),  # the Supervisor's own network
    ("cameras.discovery_allowed_ranges", "fd00::/64"),
    ("cameras.discovery_allowed_ranges", "10.77.0.0/24, garbage"),
    ("cameras.discovery_allowed_ranges", " ".join(f"10.77.{i}.0/24" for i in range(33))),
    ("cameras.discovery_range_max", "/21"),
    ("cameras.discovery", "weekly"),  # Q60: no periodic scan
    ("cameras.discovery_rate_pps", "500"),
    ("cameras.discovery_job_ttl_min", "120"),
    ("cameras.discovery_http_fallback", "true"),
])
def test_a_bad_discovery_setting_is_refused(env, key, value):
    r = env.c.patch("/api/v1/settings", json={key: value})
    assert r.status_code == 422, r.text
    if key == "cameras.discovery_allowed_ranges" and len(value) <= 600:
        body = envelope(r, 422, "validation")
        field_refusal(body, [key])
        assert value not in r.text
    unchanged = {"cameras.discovery": "manual", "cameras.discovery_range_max": "/22", "cameras.discovery_allowed_ranges": "",
                 "cameras.discovery_rate_pps": "200", "cameras.discovery_job_ttl_min": "15", "cameras.discovery_http_fallback": "off"}
    assert env.c.get("/api/v1/settings").json()["settings"][key] == unchanged[key]  # nothing was stored (the fixture stored the rate)
