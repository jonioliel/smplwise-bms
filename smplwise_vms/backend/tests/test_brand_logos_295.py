"""CR-LOGOS295 (slice 2 of the CR, built on the approved mockup v3.1): the company logo upload, the SVG sanitiser, the serving rules,
the look settings (logo size, dark-background mode, browser-tab title parts), the audit trail, /me.brand and the project backup."""
from __future__ import annotations

import hashlib
import io
import json
import zipfile

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.main import create_app
from smplwise.services import brand_assets as ba
from smplwise.services import svg_sanitize as ss

GOOD_SVG = (b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100">'
            b'<title>x</title><g fill="#1e2e47" style="fill:#2767ed;position:fixed"><rect x="0" y="0" width="80" height="80"/>'
            b'<path d="M0 0L10 10" stroke="#fff"/></g></svg>')


def png(w=300, h=100, color=(30, 60, 120, 255), mode="RGBA") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, (w, h), color if mode == "RGBA" else color[:3]).save(buf, format="PNG")
    return buf.getvalue()


def jpeg(w=300, h=100) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (200, 30, 30)).save(buf, format="JPEG")
    return buf.getvalue()


def webp(w=300, h=100) -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (w, h), (10, 200, 100, 255)).save(buf, format="WEBP")
    return buf.getvalue()


# ----------------------------------------------------------------------------- the sanitiser


def test_sanitiser_rebuilds_and_drops_the_unknown():
    out = ss.sanitize(GOOD_SVG)
    text = out.data.decode()
    assert (out.width, out.height) == (300, 100)
    assert "width=" not in text.split(">", 1)[0] and "height=" not in text.split(">", 1)[0], "the consumer sizes the image"
    assert 'viewBox="0 0 300 100"' in text and "<rect" in text and "<path" in text
    assert "position" not in text, "a style property that is not a paint property is dropped"
    assert "fill:#2767ed" in text


def test_sanitiser_takes_a_size_from_width_height_when_there_is_no_viewbox():
    out = ss.sanitize(b'<svg xmlns="http://www.w3.org/2000/svg" width="120px" height="40"><rect width="9" height="9"/></svg>')
    assert (out.width, out.height) == (120, 40) and b'viewBox="0 0 120 40"' in out.data


@pytest.mark.parametrize("body", [
    b'<script>alert(1)</script>',
    b'<foreignObject><div/></foreignObject>',
    b'<image href="http://x.test/a.png"/>',
    b'<animate attributeName="x" to="3"/>',
    b'<set attributeName="x" to="3"/>',
    b'<rect width="1" height="1" onload="alert(1)"/>',
    b'<rect width="1" height="1" fill="url(http://x.test/a)"/>',
    b'<rect width="1" height="1" style="fill:url(https://x.test/a)"/>',
    b'<use href="http://x.test/a.svg#b"/>',
    b'<rect width="1" height="1" fill="javascript:alert(1)"/>',
    b'<style>@import url(http://x.test/a.css);</style>',
    b'<style>rect{fill:url(http://x.test/a)}</style>',
    b'<a href="javascript:alert(1)"><rect width="1" height="1"/></a>',
])
def test_sanitiser_refuses_anything_that_could_run_or_fetch(body):
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' + body + b'</svg>'
    with pytest.raises(ss.SvgRefused):
        ss.sanitize(svg)


def test_sanitiser_keeps_local_references_and_plain_css():
    svg = (b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>'
           b'<style>.a{fill:#123456}</style><rect class="a" width="5" height="5" fill="url(#g)"/><use href="#g"/></svg>')
    out = ss.sanitize(svg).data.decode()
    assert "url(#g)" in out and 'href="#g"' in out and ".a{fill:#123456}" in out


def test_sanitiser_refuses_entities_doctype_and_a_billion_laughs_before_parsing():
    bomb = (b'<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]>'
            b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><text>&lol2;</text></svg>')
    with pytest.raises(ss.SvgRefused) as e:
        ss.sanitize(bomb)
    assert e.value.reason == "declaration"
    with pytest.raises(ss.SvgRefused):
        ss.sanitize(b'<?xml-stylesheet href="x"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>')


def test_sanitiser_limits_and_shape():
    with pytest.raises(ss.SvgRefused):
        ss.sanitize(b'<html/>')
    with pytest.raises(ss.SvgRefused):
        ss.sanitize(b'<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>')  # no viewBox, no size
    deep = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">' + b"<g>" * 40 + b"</g>" * 40 + b"</svg>"
    with pytest.raises(ss.SvgRefused) as e:
        ss.sanitize(deep)
    assert e.value.reason == "too_deep"
    many = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">' + b"<g/>" * 5001 + b"</svg>"
    with pytest.raises(ss.SvgRefused) as e:
        ss.sanitize(many)
    assert e.value.reason == "too_many_elements"
    with pytest.raises(ss.SvgRefused) as e:
        ss.sanitize(b"<svg " + b" " * (ss.MAX_BYTES + 1))
    assert e.value.reason == "too_large"


# ----------------------------------------------------------------------------- the normaliser (types, sizes, pixels)


def test_normalise_by_content_and_converts_jpeg_to_png():
    for raw, mime in ((png(), "image/png"), (jpeg(), "image/png"), (webp(), "image/png"), (GOOD_SVG, "image/svg+xml")):
        n = ba.normalise(raw)
        assert n.mime == mime
    assert ba.normalise(jpeg()).data.startswith(b"\x89PNG"), "a JPEG is converted to PNG"
    assert ba.stamp_of(b"abc") == hashlib.sha256(b"abc").hexdigest()[:16]


def test_normalise_refuses_other_types_even_with_an_image_name():
    for raw in (b"GIF89a" + b"\0" * 40, b"BM" + b"\0" * 60, b"%PDF-1.4 " + b"\0" * 40, b"<html><svg></svg></html>", b"hello"):
        with pytest.raises(Exception) as e:
            ba.normalise(raw)
        assert getattr(e.value, "status", None) == 415, raw[:6]


def test_normalise_size_pixels_and_dimensions():
    with pytest.raises(Exception) as e:
        ba.normalise(b"\x89PNG\r\n\x1a\n" + b"\0" * ba.MAX_BYTES)
    assert e.value.status == 413
    with pytest.raises(Exception) as e:
        ba.normalise(png(63, 200))
    assert e.value.status == 422 and e.value.code == "image_too_small"
    ba.normalise(png(64, 64))  # exactly 64 on the short side is fine
    with pytest.raises(Exception) as e:
        ba.normalise(png(2001, 2000))
    assert e.value.status == 422 and e.value.code == "too_many_pixels"
    big = ba.normalise(png(2000, 1000))  # 2 MP: re-encoded, longest side <= 1200
    assert max(big.width, big.height) == 1200 and big.width == 1200 and big.height == 600


def test_normalise_warnings_aspect_alpha_and_very_light():
    assert "odd_aspect" in ba.normalise(png(700, 100)).warnings, "7:1"
    assert "odd_aspect" not in ba.normalise(png(600, 100)).warnings, "6:1 is the limit"
    assert "odd_aspect" in ba.normalise(png(100, 300)).warnings, "taller than 1:2"
    assert "no_alpha" in ba.normalise(jpeg()).warnings
    assert "very_light" in ba.normalise(png(200, 80, (250, 250, 250, 255))).warnings


def test_normalise_apng_keeps_the_first_frame_only():
    a, b = Image.new("RGBA", (120, 80), (255, 0, 0, 255)), Image.new("RGBA", (120, 80), (0, 0, 255, 255))
    buf = io.BytesIO()
    a.save(buf, format="PNG", save_all=True, append_images=[b], duration=100, loop=0)
    out = Image.open(io.BytesIO(ba.normalise(buf.getvalue()).data))
    assert getattr(out, "n_frames", 1) == 1 and out.convert("RGBA").getpixel((5, 5))[:3] == (255, 0, 0)


def test_normalise_strips_metadata_and_appended_bytes():
    im = Image.new("RGB", (200, 100), (1, 2, 3))
    buf = io.BytesIO()
    im.save(buf, format="JPEG", exif=Image.Exif())
    n = ba.normalise(buf.getvalue() + b"<?php evil ?>")
    assert b"<?php" not in n.data


def test_svg_that_is_refused_is_a_422_with_a_hebrew_message():
    with pytest.raises(Exception) as e:
        ba.normalise(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script/></svg>')
    assert e.value.status == 422 and "SVG" in e.value.user_message


# ----------------------------------------------------------------------------- the API


def _up(c, variant, raw, name="logo.png", headers=None):
    return c.post(f"/api/v1/brand/company-logo/{variant}", files={"file": (name, raw, "application/octet-stream")}, headers=headers or {})


def test_defaults_then_settings_validation_and_audit(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        pub = c.get("/api/v1/brand/public").json()
        none = {"light": None, "dark": None}
        assert pub == {"company": {"name": "", "logo": none, "logo_file": none}, "size": "m", "dark_mode": "invert",  # HOME-295: invert by default
                       "installer": {"enabled": False}}  # WHITELABEL097-295: the installer profile is off by default
        full = c.get("/api/v1/brand").json()
        assert full["title"] == {"prefix": "Smplwise Arx", "mode": "both"} and full["company"]["kind"] == "developer" and full["project"] == {"name": ""}
        assert full["company_logo_size"] == "same", "LOGOSIDE-295: the company logo follows the general scale unless chosen"
        assert full["logo_side"] == "start", "LOGOSIDE-295: the company / installer logos default to the start of the header"
        r = c.put("/api/v1/brand", json={"company_name": "  נווה   הירדן ", "company_kind": "management", "logo_size": "xl", "dark_mode": "file", "title_prefix": "Arx",
                                         "title_mode": "dev", "project_name": "מגדל A"})
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["company"]["name"] == "נווה הירדן" and v["company"]["kind"] == "management" and v["size"] == "xl" and v["dark_mode"] == "file"
        assert v["title"] == {"prefix": "Arx", "mode": "dev"} and v["project"]["name"] == "מגדל A"
        for bad in ({"logo_size": "xxl"}, {"logo_side": "left"}, {"company_logo_size": "xxl"}, {"company_logo_size": ""}, {"logo_side": ""}, {"dark_mode": "neon"}, {"title_mode": "none"}, {"company_kind": "x"}, {"company_name": "x" * 61}, {"title_prefix": "  "},
                    {"project_name": "a\nb"}, {"nope": 1}):
            assert c.put("/api/v1/brand", json=bad).status_code == 422, bad
        assert c.get("/api/v1/brand").json()["size"] == "xl", "a refused value changes nothing"
        with app.state.db.connection() as conn:
            acts = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'brand.%' AND decision = 'allowed'").fetchall()]
        assert "brand.company.update" in acts


def test_logo_side_setting_roundtrip_me_and_corrupt_value(settings):
    """LOGOSIDE-295: brand.logo_side is start | end, in GET /brand and /me.brand; a corrupt stored value reads as the default."""
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/me").json()["brand"]["logo_side"] == "start"
        r = c.put("/api/v1/brand", json={"logo_side": "end"})
        assert r.status_code == 200 and r.json()["logo_side"] == "end" and r.json()["size"] == "m", "only the sent field changes"
        assert c.get("/api/v1/me").json()["brand"]["logo_side"] == "end"
        assert c.put("/api/v1/brand", json={"logo_side": "middle"}).status_code == 422
        r = c.put("/api/v1/brand", json={"company_logo_size": "xl"})
        assert r.status_code == 200 and r.json()["company_logo_size"] == "xl" and r.json()["size"] == "m"
        assert c.get("/api/v1/me").json()["brand"]["company_logo_size"] == "xl"
        assert c.put("/api/v1/brand", json={"company_logo_size": "same"}).json()["company_logo_size"] == "same"
        assert c.get("/api/v1/brand").json()["logo_side"] == "end", "a refused value changes nothing"
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES ('brand.logo_side', 'sideways') ON CONFLICT(key) DO UPDATE SET value = 'sideways'")
        assert c.get("/api/v1/brand").json()["logo_side"] == "start"


def test_corrupt_stored_values_read_as_defaults(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES ('brand.logo_size', 'huge') ON CONFLICT(key) DO UPDATE SET value = 'huge'")
            conn.execute("INSERT INTO settings(key, value) VALUES ('brand.company.logo', 'not json') ON CONFLICT(key) DO UPDATE SET value = 'not json'")
        pub = c.get("/api/v1/brand/public").json()
        assert pub["size"] == "m" and pub["company"]["logo"] == {"light": None, "dark": None}


def test_upload_serve_replace_delete_png_and_svg(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        r = _up(c, "light", png())
        assert r.status_code == 201, r.text
        body = r.json()
        stamp = body["stamp"]
        assert stamp == ba.stamp_of(c.get("/api/v1/brand/company-logo/light").content)
        assert c.get("/api/v1/brand/public").json()["company"]["logo"] == {"light": stamp, "dark": None}
        assert c.get("/api/v1/brand/public").json()["company"]["logo_file"] == {"light": f"{stamp}.png", "dark": None}
        got =c.get(f"/api/v1/brand/company-logo/light/{stamp}.png")
        assert got.status_code == 200 and got.headers["content-type"] == "image/png"
        assert got.headers["cache-control"] == "public, max-age=31536000, immutable" and got.headers["etag"] == f'"{stamp}"'
        assert got.headers["x-content-type-options"] == "nosniff" and "set-cookie" not in got.headers
        assert c.get(f"/api/v1/brand/company-logo/light/{stamp}.png", headers={"If-None-Match": f'"{stamp}"'}).status_code == 304
        assert c.get(f"/api/v1/brand/company-logo/light/{'0' * 16}.png").status_code == 404, "an unknown stamp"
        assert c.get(f"/api/v1/brand/company-logo/dark/{stamp}.png").status_code == 404, "the stamp belongs to the light variant"
        assert c.get(f"/api/v1/brand/company-logo/light/{stamp}.svg").status_code == 404, "the extension must match the stored type"
        assert c.get("/api/v1/brand/company-logo/light/../../x").status_code == 404
        pv = c.get("/api/v1/brand/company-logo/light")
        assert pv.headers["cache-control"] == "no-store"
        # replace = a new stamp
        r2 = _up(c, "light", png(color=(5, 5, 5, 255)))
        assert r2.json()["stamp"] != stamp
        assert c.get(f"/api/v1/brand/company-logo/light/{stamp}.png").status_code == 404, "the old stamp is gone"
        # the dark file as SVG: sanitised, served with the sandboxing policy
        sv = _up(c, "dark", GOOD_SVG, "logo.svg")
        assert sv.status_code == 201 and sv.json()["mime"] == "image/svg+xml"
        s2 = sv.json()["stamp"]
        g = c.get(f"/api/v1/brand/company-logo/dark/{s2}.svg")
        assert g.headers["content-type"].startswith("image/svg+xml") and g.headers["content-security-policy"] == "default-src 'none'; style-src 'unsafe-inline'; sandbox"
        assert g.headers["content-disposition"] == "inline"
        # delete clears the stamp and the row
        d = c.delete("/api/v1/brand/company-logo/dark")
        assert d.status_code == 200 and d.json()["company"]["logo"]["dark"] is None
        assert c.get(f"/api/v1/brand/company-logo/dark/{s2}.svg").status_code == 404
        assert c.get("/api/v1/brand/company-logo/dark").status_code == 404
        with app.state.db.connection() as conn:
            acts = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'brand.company.logo.%'").fetchall()]
        assert acts.count("brand.company.logo.upload") == 3 and "brand.company.logo.remove" in acts


def test_upload_refusals(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert _up(c, "light", b"GIF89a" + b"\0" * 50, "a.png").status_code == 415
        assert _up(c, "light", png(63, 120)).status_code == 422
        assert _up(c, "light", b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script/></svg>', "a.svg").status_code == 422
        assert _up(c, "mid", png()).status_code == 404
        big = _up(c, "light", b"\x89PNG\r\n\x1a\n" + b"\0" * (ba.MAX_BYTES + 10))
        assert big.status_code == 413
        assert c.get("/api/v1/brand/public").json()["company"]["logo"]["light"] is None, "a refused file stores nothing"


def test_odd_aspect_warning_comes_back_and_the_file_is_saved(settings):
    with TestClient(create_app(settings)) as c:
        r = _up(c, "light", png(700, 100))
        assert r.status_code == 201
        assert [w["code"] for w in r.json()["warnings"]] == ["odd_aspect"]


def test_permissions_write_needs_system_configure_read_is_for_every_session(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        bind(c, settings, "dana", "viewer", "installation", "*")
        bind(c, settings, "sami", "site_admin", "installation", "*")
        for user in ("dana", "sami"):
            h = as_user(user)
            assert c.get("/api/v1/brand", headers=h).status_code == 200
            assert c.put("/api/v1/brand", json={"logo_size": "l"}, headers=h).status_code == 403
            assert c.put("/api/v1/brand", json={"logo_side": "end"}, headers=h).status_code == 403
            assert c.put("/api/v1/brand", json={"company_logo_size": "s"}, headers=h).status_code == 403
            assert _up(c, "light", png(), headers=h).status_code == 403
            assert c.delete("/api/v1/brand/company-logo/light", headers=h).status_code == 403
        assert c.get("/api/v1/brand").json()["size"] == "m"
        assert c.get("/api/v1/me", headers=as_user("dana")).json()["brand"]["size"] == "m"


def test_me_carries_the_brand_block(settings):
    with TestClient(create_app(settings)) as c:
        assert c.put("/api/v1/brand", json={"company_name": "חברה", "title_mode": "project", "project_name": "פרויקט"}).status_code == 200
        b = c.get("/api/v1/me").json()["brand"]
        assert b["company"]["name"] == "חברה" and b["title"]["mode"] == "project" and b["project"]["name"] == "פרויקט" and b["dark_mode"] == "invert"


def test_a_damaged_row_is_never_served(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        stamp = _up(c, "light", png()).json()["stamp"]
        with app.state.db.connection() as conn:
            conn.execute("UPDATE brand_assets SET data_b64 = 'AAAA' WHERE variant = 'light'")
        assert c.get(f"/api/v1/brand/company-logo/light/{stamp}.png").status_code == 404
        assert c.get("/api/v1/brand/company-logo/light").status_code == 404


def test_the_logo_travels_with_the_project_backup_with_the_same_stamps(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        stamp = _up(c, "light", png()).json()["stamp"]
        dstamp = _up(c, "dark", GOOD_SVG, "l.svg").json()["stamp"]
        assert c.put("/api/v1/brand", json={"company_name": "נווה", "logo_size": "l"}).status_code == 200
        e = c.post("/api/v1/backups", json={}).json()
        raw = c.get(f"/api/v1/backups/{e['name']}/download").content
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            rows = json.loads(z.read("data/brand_assets.json"))
        assert {r["variant"] for r in rows} == {"light", "dark"}
        assert c.delete("/api/v1/brand/company-logo/light").status_code == 200
        assert c.delete("/api/v1/brand/company-logo/dark").status_code == 200
        assert c.put("/api/v1/brand", json={"company_name": "אחר", "logo_size": "s"}).status_code == 200
        up = c.post("/api/v1/backups/upload", files={"file": ("b.zip", raw, "application/zip")})
        res = c.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
        assert res.status_code == 200, res.text
        pub = c.get("/api/v1/brand/public").json()
        assert pub["company"]["logo"] == {"light": stamp, "dark": dstamp} and pub["company"]["name"] == "נווה" and pub["size"] == "l"
        assert c.get(f"/api/v1/brand/company-logo/light/{stamp}.png").status_code == 200
        assert c.get(f"/api/v1/brand/company-logo/dark/{dstamp}.svg").status_code == 200


def test_body_limit_rule_for_the_upload_route(settings):
    from smplwise import body_limit

    n, name = body_limit.route_limit("POST", "/api/v1/brand/company-logo/light", settings)
    assert name == "brand_logo" and n == ba.MAX_BYTES + body_limit.MULTIPART_SLACK
    assert body_limit.route_limit("PUT", "/api/v1/brand", settings)[1] == "default"
