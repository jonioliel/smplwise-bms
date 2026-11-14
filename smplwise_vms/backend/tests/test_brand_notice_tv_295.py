"""CR-LOGOS295 P7: the notice-board TV draws the installation's company logo (brand_assets) through the board token - the light file in
`logos.company`, the dark file in `logos.company_dark`, the size scale and dark-background mode in `board.brand` - and keeps the older
notices-only logo as the fallback. Fakes only."""
from __future__ import annotations

import io

from PIL import Image

API = "/api/v1"
SVG = (b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" fill="#1e2e47"/></svg>')


def _png(color=(30, 60, 120, 255)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (300, 100), color).save(buf, format="PNG")
    return buf.getvalue()


def _board(client, display=None) -> str:
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200
    r = client.post(f"{API}/notices/boards", json={"name": "לוח הלובי", "slug": "lobby", "display": display})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _up(client, variant, raw, name="l.png"):
    r = client.post(f"{API}/brand/company-logo/{variant}", files={"file": (name, raw, "application/octet-stream")})
    assert r.status_code == 201, r.text
    return r.json()["stamp"]


def _feed(client, token):
    return client.get(f"{API}/notices/display/lobby", headers={"X-Board-Token": token})


def _logo(client, token, qs=""):
    return client.get(f"{API}/notices/display/lobby/logo/company{qs}", headers={"X-Board-Token": token})


def test_no_logo_at_all_the_feed_has_no_brand_block_and_the_route_is_404(client):
    token = _board(client)
    doc = _feed(client, token).json()
    assert doc["board"]["logos"] == {} and "brand" not in doc["board"]
    assert _logo(client, token).status_code == 404


def test_light_and_dark_files_size_and_mode_reach_the_feed_and_the_version_moves(client):
    token = _board(client)
    ls = _up(client, "light", _png())
    doc = _feed(client, token).json()
    assert doc["board"]["logos"] == {"company": f"api/v1/notices/display/lobby/logo/company?variant=light&v={ls}"}
    assert doc["board"]["brand"] == {"size": "m", "dark_mode": "invert", "name": ""}  # HOME-295: invert by default
    v1 = doc["board"]["version"]
    ds = _up(client, "dark", SVG, "d.svg")
    assert client.put(f"{API}/brand", json={"company_name": "נווה", "logo_size": "xl", "dark_mode": "file"}).status_code == 200
    doc2 = _feed(client, token).json()
    assert doc2["board"]["logos"]["company_dark"].endswith(f"variant=dark&v={ds}")
    assert doc2["board"]["brand"] == {"size": "xl", "dark_mode": "file", "name": "נווה"}
    assert client.put(f"{API}/brand", json={"company_logo_size": "s"}).status_code == 200  # LOGOSIDE-295: the company logo's own scale rides the feed
    assert _feed(client, token).json()["board"]["brand"]["company_size"] == "s"
    assert client.put(f"{API}/brand", json={"company_logo_size": "same"}).status_code == 200
    assert "company_size" not in _feed(client, token).json()["board"]["brand"]
    assert doc2["board"]["version"] != v1, "a TV that polls the version picks the new logo / size up"


def test_the_logo_route_serves_each_variant_through_the_token_only(client):
    token = _board(client)
    _up(client, "light", _png())
    _up(client, "dark", SVG, "d.svg")
    a = _logo(client, token, "?variant=light")
    assert a.status_code == 200 and a.headers["content-type"] == "image/png" and a.content[:4] == b"\x89PNG"
    b = _logo(client, token, "?variant=dark")
    assert b.status_code == 200 and b.headers["content-type"].startswith("image/svg+xml") and b"<script" not in b.content
    assert "default-src 'none'" in b.headers["content-security-policy"] and b.headers["x-content-type-options"] == "nosniff"
    assert _logo(client, token, "?variant=bogus").content[:4] == b"\x89PNG", "an unknown variant reads as light"
    assert client.get(f"{API}/notices/display/lobby/logo/company").status_code == 404, "no token, the uniform 404"
    assert client.get(f"{API}/notices/display/lobby/logo/company", headers={"X-Board-Token": "x" * 43}).status_code == 404


def test_company_logo_block_off_hides_the_logo_from_the_feed(client):
    token = _board(client, {"blocks": {"company_logo": False}})
    _up(client, "light", _png())
    doc = _feed(client, token).json()
    assert doc["board"]["logos"] == {} and "brand" not in doc["board"]


def test_removing_the_brand_logo_falls_back_to_none(client):
    token = _board(client)
    _up(client, "light", _png())
    assert client.delete(f"{API}/brand/company-logo/light").status_code == 200
    doc = _feed(client, token).json()
    assert doc["board"]["logos"] == {}
    assert _logo(client, token).status_code == 404


def test_email_header_carries_the_company_name_as_text_only():
    from smplwise.services import notify_email as ne

    n = {"id": "a1", "title": "אזעקה", "place": "לובי", "severity": "alert", "count": 1, "last_at": "2026-10-23T06:00:00Z"}
    plain = ne.compose_notification(n, mode="new", tz_name="Asia/Jerusalem")
    named = ne.compose_notification(n, mode="new", tz_name="Asia/Jerusalem", brand="נווה <b>הירדן")
    assert ">Arx</div>" in plain.html and "<img" not in plain.html
    assert " · Arx</div>" in named.html and "נווה" in named.html and "<b>הירדן" not in named.html and "<img" not in named.html, "escaped, text only"
    assert named.subject == plain.subject and named.text == plain.text
