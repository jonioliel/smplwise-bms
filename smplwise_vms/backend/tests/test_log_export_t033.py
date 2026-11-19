"""T033 acceptance 2 (R066 / AT066): the redacted log export.

The add-on's recent log lines come out of an in-memory ring with the correlation id of the request each was written for, next to the
health checks and a recommendation per problem; tokens, credentials inside URLs (RTSP), cookies, IP and MAC addresses, serial numbers,
e-mail addresses, phone numbers and embedded frames never leave raw. system.configure only, explicit consent, audited with counts only.
Fakes only: no device, no Home Assistant."""
from __future__ import annotations

import json
import logging

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import log_export as lx

URL = "/api/v1/health/logs/export"

# what a careless log line could carry (made-up values; nothing here belongs to a real site)
SECRETS = {
    "rtsp_password": "Pa55word-rtsp",
    "token": "tok_8f3a9c2e71b04d5f",
    "jwt": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhcngtdGVzdCJ9.c2lnbmF0dXJlLXRlc3Q",
    "ip": "10.20.30.40",
    "mac": "a4:14:37:0b:cd:ef",
    "serial": "8P0820200101CCRRD12345678WCVU",
    "email": "owner@example.com",
    "phone": "052-7654321",
    "frame": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD",
}


@pytest.mark.parametrize(("raw", "expected"), [
    ("rtsp://admin:Pa55word@192.168.1.64:554/Streaming/Channels/101", "rtsp://<credentials>@<ip>/Streaming/Channels/101"),
    ("GET /api/states?access_token=abc123secret&x=1", "GET /api/states?access_token=<redacted>&x=1"),
    ('{"password": "hunter2", "user": "op"}', '{"password": <redacted>, "user": "op"}'),
    ("Authorization: Bearer abcDEF1234567890", "Authorization: <redacted> <token>"),
    ("ha eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc", "ha <token>"),
    ("mac AA:BB:CC:11:22:33 / 00-1a-2b-3c-4d-5e", "mac <mac> / <mac>"),
    ("v6 fe80::1ff:fe23:4567:890a and 2001:db8:0:0:0:0:2:1", "v6 <ip> and <ip>"),
    ("device DS-7608NI-K2/8P0820200101CCRRD12345678WCVU", "device DS-7608NI-K2/<serial>"),
    ("<serialNumber>ABC123</serialNumber>", "<serialNumber><serial></serialNumber>"),
    ("serialNumber=XYZ987 sn: Q1W2E3", "serialNumber=<serial> sn: <serial>"),
    ("mail a.b@example.co.il, phone +972 52 123 4567 or 03-1234567", "mail <email>, phone <phone> or <phone>"),
    ("sha 3f786850e387550fdab836ed7e6dc881de23001b3f786850e387550fdab836ed", "sha <token>"),
    ("frame data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==", "frame <image>"),
    ("pin=1234 sid=xyz", "pin=<redacted> sid=<redacted>"),
])
def test_redaction_rules(raw, expected):
    assert lx.redact(raw) == expected


@pytest.mark.parametrize("plain", [
    "version 2.43.8 at 12:30:45.123 on 2026-11-19, took 0.512 s",
    'File "/usr/lib/python3.12/site-packages/starlette/middleware/base_http_module.py", line 12, in __call__',
    "model DS-7608NI-K2 channel 101, 3 cameras, session_count=3 token_count=5 spin=1",
    "correlation id 3fa85f6457b2, playback generation 4",
])
def test_ordinary_text_is_kept(plain):
    assert lx.redact(plain) == plain


def test_redaction_counts_per_rule():
    counts: dict[str, int] = {}
    lx.redact("rtsp://u:p@10.0.0.1/x and 10.0.0.2 and aa:bb:cc:dd:ee:ff", counts)
    assert counts == {"url_credentials": 1, "ipv4": 2, "mac": 1}


def test_the_ring_is_bounded_and_counts_what_it_dropped():
    ring = lx.LogRing(capacity=3)
    log = logging.getLogger("smplwise.test.ring")
    log.addHandler(ring)
    try:
        for i in range(5):
            log.warning("line %d", i)
    finally:
        log.removeHandler(ring)
    snap = ring.snapshot()
    assert [r[4] for r in snap] == ["line 2", "line 3", "line 4"] and ring.dropped == 2
    doc = lx.build(None, ring=ring, min_level="WARNING")
    assert [r["message"] for r in doc["records"]] == ["line 2", "line 3", "line 4"]
    assert doc["ring"] == {"capacity": 3, "held": 3, "dropped_since_start": 2}


def test_build_filters_and_recommends():
    ring = lx.LogRing(capacity=50)
    log = logging.getLogger("smplwise.test.build")
    log.setLevel(logging.DEBUG)  # the root logger's level is whatever the test session left; this logger decides for itself
    log.addHandler(ring)
    tok = lx.correlation_id.CURRENT.set("req-aaaa1111")
    try:
        log.info("nvr probe to %s failed", "10.1.2.3")
        log.error("export failed for rtsp://admin:pw@10.1.2.3/x")
        log.error("second failure")
    finally:
        lx.correlation_id.CURRENT.reset(tok)
        log.removeHandler(ring)
    log.addHandler(ring)
    try:
        log.debug("not in the file at INFO")
        log.error("an error outside any request")
    finally:
        log.removeHandler(ring)
    health = {"status": "error", "checks": [
        {"id": "db", "label": "מסד נתונים", "status": "ok", "detail": "תקין"},
        {"id": "nvr", "label": "NVR", "status": "error", "detail": "אין תשובה מ-10.1.2.3"},
        {"id": "brand_new_check", "label": "בדיקה חדשה", "status": "warn", "detail": "x"},
    ]}
    doc = lx.build(health, ring=ring)
    msgs = [r["message"] for r in doc["records"]]
    assert "not in the file at INFO" not in msgs and "10.1.2.3" not in json.dumps(doc)
    assert [r["correlation_id"] for r in doc["records"]] == ["req-aaaa1111", "req-aaaa1111", "req-aaaa1111", None]
    assert doc["errors"]["count"] == 3
    assert doc["errors"]["by_correlation_id"][0]["correlation_id"] == "req-aaaa1111" and doc["errors"]["by_correlation_id"][0]["count"] == 2
    recs = doc["recommendations"]
    assert [(r["source"], r["check"]) for r in recs] == [("health", "nvr"), ("health", "brand_new_check"), ("log", None)]
    assert recs[0]["text_he"] == lx.RECOMMEND_HE["nvr"] and "בדיקה חדשה" in recs[1]["text_he"] and "req-aaaa1111" in recs[2]["text_he"]
    assert doc["health"]["checks"][1]["detail"] == "אין תשובה מ-<ip>"
    assert doc["redaction"]["replaced"]["ipv4"] >= 2 and doc["redaction"]["replaced"]["url_credentials"] == 1
    one = lx.build(None, ring=ring, only_correlation_id="req-aaaa1111")
    assert len(one["records"]) == 3 and one["health"] is None


def _audit(app) -> list[dict]:
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(
            "SELECT decision, request_id, details_json FROM audit_log WHERE action = 'health.logs.export' ORDER BY id").fetchall()]


def test_the_export_endpoint(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    lx.RING.clear()
    log = logging.getLogger("smplwise.test.export")
    log.error("go2rtc source rtsp://admin:%s@%s:554/ch1 token=%s jwt %s mac %s serial %s mail %s phone %s %s",
              SECRETS["rtsp_password"], SECRETS["ip"], SECRETS["token"], SECRETS["jwt"], SECRETS["mac"], SECRETS["serial"],
              SECRETS["email"], SECRETS["phone"], SECRETS["frame"])

    # consent is required, and only a system administrator may export
    assert c.post(URL, json={}).status_code == 422
    assert c.post(URL, json={"consent": False}).json()["code"] == "consent_required"
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    assert c.post(URL, json={"consent": True}, headers=as_user("ron")).status_code == 403
    assert c.post(URL, json={"consent": True, "correlation_id": "bad id!"}).status_code == 422
    assert c.post(URL, json={"consent": True, "minutes": 0}).status_code == 422

    r = c.post(URL, json={"consent": True}, headers={"X-Correlation-Id": "export-req-2440"})
    assert r.status_code == 200, r.text
    assert r.headers["content-disposition"].startswith('attachment; filename="arx-logs-') and r.headers["cache-control"] == "no-store"
    text = r.text
    for name, value in SECRETS.items():
        assert value not in text, f"{name} leaked into the export"
    doc = r.json()
    assert doc["format"] == lx.FORMAT and doc["export_correlation_id"] == "export-req-2440" and doc["version"]
    line = next(x for x in doc["records"] if x["logger"] == "smplwise.test.export")
    assert "rtsp://<credentials>@<ip>/ch1" in line["message"] and "<serial>" in line["message"] and "<image>" in line["message"]
    assert line["level"] == "ERROR"
    ids_checks = [x["id"] for x in doc["health"]["checks"]]
    assert "db" in ids_checks and "backups" in ids_checks
    # a fresh installation has no backup: that check is an error and gets its recommendation
    assert any(x["check"] == "backups" and x["text_he"] == lx.RECOMMEND_HE["backups"] for x in doc["recommendations"])
    assert set(doc["excluded"]) >= {"video", "frames and snapshots", "floor plans"}

    # the request's own log lines carry its correlation id: an export of one request id returns only those
    rows = _audit(app)
    assert rows[-1]["decision"] == "allowed" and rows[-1]["request_id"] == "export-req-2440"
    details = json.loads(rows[-1]["details_json"])
    assert details["records"] == len(doc["records"]) and details["redactions"] == doc["redaction"]["total"] > 0
    assert not any(v in rows[-1]["details_json"] for v in SECRETS.values())

    only = c.post(URL, json={"consent": True, "correlation_id": "export-req-2440", "include_health": False}).json()
    assert only["health"] is None and all(x["correlation_id"] == "export-req-2440" for x in only["records"])


def test_log_lines_of_a_request_carry_its_correlation_id(settings):
    """The middleware sets correlation_id.CURRENT for the request; a line logged inside the handler (here a sync route, run in the
    threadpool) is stamped with the id the response announces, and the variable is reset afterwards."""
    app = create_app(settings)

    def noisy() -> dict:
        logging.getLogger("smplwise.test.noisy").warning("inside the handler")
        return {"ok": True}

    app.add_api_route("/api/v1/_test/noisy", noisy, methods=["GET"])
    lx.RING.clear()
    c = TestClient(app)
    r = c.get("/api/v1/_test/noisy", headers={"X-Correlation-Id": "noisy-req-2440"})
    assert r.headers["x-correlation-id"] == "noisy-req-2440"
    stamped = [(rec[3], rec[4]) for rec in lx.RING.snapshot() if rec[2] == "smplwise.test.noisy"]
    assert stamped == [("noisy-req-2440", "inside the handler")]
    assert lx.correlation_id.current() is None


def test_install_is_idempotent(settings):
    create_app(settings)
    create_app(settings)
    assert sum(1 for h in logging.getLogger().handlers if h is lx.RING) == 1
