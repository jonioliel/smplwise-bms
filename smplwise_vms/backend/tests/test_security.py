"""File and network security checks (T069): uploads are judged by content and size (SVG refused, corrupt PDF is a
client error, oversized is 413), path traversal in file-serving routes is refused, device XML with DOCTYPE / entity
declarations is rejected before parsing, no route takes a URL to fetch (no SSRF surface), the browser only ever gets
relative media paths, and a signed bridge message cannot be replayed."""
from __future__ import annotations

import time
from dataclasses import replace

import pytest
import xml.etree.ElementTree as ET
from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import events_ingest, ha_bridge, nvr, xmlsafe


def test_uploads_are_judged_by_content_and_size(settings):
    app = create_app(replace(settings, max_upload_bytes=3000))
    c = TestClient(app)
    ids = seed_tree(c)
    floor = ids["floor2"]
    up = lambda name, data, mime: c.post(f"/api/v1/floors/{floor}/plan-assets", files={"file": (name, data, mime)})  # noqa: E731
    assert up("plan.svg", b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "image/svg+xml").status_code == 415
    assert up("plan.png", b'<svg onload="alert(1)"></svg>', "image/png").status_code == 415, "sniffed, not trusted by name or declared type"
    assert up("plan.pdf", b"GIF89a garbage", "application/pdf").status_code == 415
    r = up("plan.pdf", b"%PDF-1.4\n%garbage that is not a pdf\n", "application/pdf")
    assert r.status_code in (415, 422), r.text
    assert r.status_code != 500
    small = png_bytes(8, 8)
    assert len(small) < 3000
    assert up("tiny.jpg", small, "image/jpeg").status_code == 201, "a PNG named .jpg is stored as PNG"
    big = png_bytes(8, 8) + b"\0" * 5000  # a real PNG header followed by bulk: the size cap trips while streaming
    assert up("big.png", big, "image/png").status_code == 413


def test_path_traversal_is_refused(client):
    seed_tree(client)
    for path in (
        "/api/v1/backups/..%2F..%2Fetc%2Fpasswd/download",
        "/api/v1/backups/../../etc/passwd/download",
        "/api/v1/backups/..%5C..%5Cwindows%5Cwin.ini",
        "/api/v1/plan-assets/..%2F..%2Fx/pages/1/preview.png",
        "/api/v1/plan-versions/..%2F..%2Fx/image.png",
        "/api/v1/exports/..%2F..%2Fx/download",
        "/api/v1/events/..%2F..%2Fx/thumbnail",
        "/api/v1/cameras/..%2F..%2Fx/frame?at=2026-09-16T08:00:00Z",
    ):
        r = client.get(path)
        assert r.status_code in (400, 404, 405, 422, 503), (path, r.status_code)
    r = client.post("/api/v1/backups/upload", files={"file": ("../../evil.zip", b"PK\x03\x04", "application/zip")})
    assert r.status_code in (400, 422), r.text


def test_device_xml_with_entities_is_refused():
    bomb = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><CMSearchResult><responseStatus>true</responseStatus><a>&lol2;</a></CMSearchResult>'
    with pytest.raises(ET.ParseError):
        xmlsafe.parse(bomb)
    with pytest.raises(ET.ParseError):
        nvr.parse_search_response(bomb, 101)
    xxe = '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><EventNotificationAlert><eventType>&xxe;</eventType></EventNotificationAlert>'
    assert events_ingest.parse_alert(xxe) is None, "an alert with an external entity is dropped, never resolved"
    plain = nvr.parse_search_response('<CMSearchResult xmlns="http://www.hikvision.com/ver20/XMLSchema"><responseStatus>true</responseStatus><responseStatusStrg>NO MATCHES</responseStatusStrg><numOfMatches>0</numOfMatches></CMSearchResult>', 101)
    assert plain.matches == []


def test_no_route_fetches_a_caller_supplied_url_and_media_paths_stay_relative(client):
    spec = client.app.openapi()
    suspicious = []
    for path, ops in spec["paths"].items():
        for op in ops.values():
            for p in op.get("parameters", []):
                if p["name"].lower() in ("url", "uri", "href", "host", "endpoint", "callback", "redirect", "target_url"):
                    suspicious.append((path, p["name"]))
            body = op.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema", {})
            ref = body.get("$ref", "")
            if ref:
                props = spec["components"]["schemas"][ref.rsplit("/", 1)[1]].get("properties", {})
                for name in props:
                    if name.lower() in ("url", "uri", "href", "callback", "redirect", "target_url", "webhook"):
                        suspicious.append((path, name))
    assert suspicious == [], f"routes that accept a URL to fetch: {suspicious}"
    seed_tree(client)
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    info = client.get(f"/api/v1/media/live/{cam['id']}").json()
    assert info["ws_path"].startswith("api/v1/media/live/") and "://" not in info["ws_path"], "the browser never learns the go2rtc address"
    text = client.get(f"/api/v1/cameras/{cam['id']}").text
    assert "rtsp://" not in text and "@" not in text.replace("dev-", ""), "camera rows carry no stream URLs or credentials"


def test_signed_bridge_messages_cannot_be_replayed_or_forged(client):
    p = client.get("/api/v1/ha/bridge/pairing").json()
    secret = p["pairing_code"]
    msg = ha_bridge.sign(secret, {"version": "0.1.0"})
    assert client.post("/api/v1/ha/bridge/ping", json=msg).status_code == 200
    assert client.post("/api/v1/ha/bridge/ping", json=msg).status_code == 401, "same nonce again is a replay"
    old = ha_bridge.sign(secret, {"version": "0.1.0"}, ts=int(time.time()) - 900)
    assert client.post("/api/v1/ha/bridge/ping", json=old).status_code == 401, "outside the signature window"
    forged = ha_bridge.sign("not-the-secret", {"version": "0.1.0"})
    assert client.post("/api/v1/ha/bridge/ping", json=forged).status_code == 401
    tampered = {**ha_bridge.sign(secret, {"version": "0.1.0"}), "version": "9.9.9"}
    assert client.post("/api/v1/ha/bridge/ping", json=tampered).status_code == 401, "body is covered by the signature"
