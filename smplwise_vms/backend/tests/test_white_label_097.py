"""WHITELABEL097-295 (board row r097): the installer brand profile (white label, default OFF) and the exportable customer pack.

Covers: defaults (nothing leaves the Settings screen while off), field validation (preset accents only), logo upload / serve / delete as kind
`installer` next to the company logo, the stamped public route answering 404 while off, permissions, audit, the customer pack
(export content, round trip onto a second installation, every refusal), the e-mail header / footer and the temperature report head, and the
project backup carrying the profile."""
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
from smplwise.services import notify_email
from smplwise.services import white_label as wl

GOOD_SVG = (b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100">'
            b'<g fill="#1e2e47"><rect x="0" y="0" width="80" height="80"/></g></svg>')


def png(w=300, h=100, color=(30, 60, 120, 255)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (w, h), color).save(buf, format="PNG")
    return buf.getvalue()


def _up(c, variant, raw, name="logo.png", headers=None):
    return c.post(f"/api/v1/brand/white-label/logo/{variant}", files={"file": (name, raw, "application/octet-stream")}, headers=headers or {})


def _pack(c, raw, name="pack.zip", headers=None):
    return c.post("/api/v1/brand/white-label/pack", files={"file": (name, raw, "application/zip")}, headers=headers or {})


def _zip(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for n, d in files.items():
            z.writestr(n, d)
    return buf.getvalue()


def _profile(**over) -> dict:
    doc = {"schema": wl.SCHEMA, "version": wl.SCHEMA_VERSION, "name": "מתקין בע\"מ", "contact": "טלפון 03-1234567", "accent": "teal", "logos": {}}
    doc.update(over)
    return doc


def _pj(doc) -> bytes:
    return json.dumps(doc, ensure_ascii=False).encode("utf-8")


# ----------------------------------------------------------------------------- defaults and settings


def test_default_is_off_and_nothing_public(settings):
    with TestClient(create_app(settings)) as c:
        assert c.get("/api/v1/brand/public").json()["installer"] == {"enabled": False}
        assert c.get("/api/v1/me").json()["brand"]["installer"] == {"enabled": False}
        full = c.get("/api/v1/brand/white-label").json()
        assert full["enabled"] is False and full["name"] == "" and full["contact"] == "" and full["accent"] == "default"
        assert full["logo"] == {"light": None, "dark": None} and full["files"] == {"light": None, "dark": None}


def test_profile_is_public_only_while_enabled(settings):
    with TestClient(create_app(settings)) as c:
        st = _up(c, "light", png()).json()["stamp"]
        assert c.put("/api/v1/brand/white-label", json={"name": "  מתקין   א ", "contact": "support@example.test", "accent": "orange"}).status_code == 200
        assert c.get("/api/v1/brand/public").json()["installer"] == {"enabled": False}, "filled in but switched off: nothing leaves Settings"
        assert c.get(f"/api/v1/brand/white-label/logo/light/{st}.png").status_code == 404, "the stamped public file is 404 while off"
        assert c.get("/api/v1/brand/white-label/logo/light").status_code == 200, "the Settings preview works while off"
        assert c.put("/api/v1/brand/white-label", json={"enabled": True}).status_code == 200
        inst = c.get("/api/v1/brand/public").json()["installer"]
        assert inst == {"enabled": True, "name": "מתקין א", "contact": "support@example.test", "accent": "orange", "logo": {"light": st, "dark": None},
                        "logo_file": {"light": f"{st}.png", "dark": None}}
        got = c.get(f"/api/v1/brand/white-label/logo/light/{st}.png")
        assert got.status_code == 200 and got.headers["cache-control"] == "public, max-age=31536000, immutable" and got.headers["x-content-type-options"] == "nosniff"
        assert c.get("/api/v1/me").json()["brand"]["installer"]["name"] == "מתקין א"
        assert c.put("/api/v1/brand/white-label", json={"enabled": False}).status_code == 200
        assert c.get(f"/api/v1/brand/white-label/logo/light/{st}.png").status_code == 404


def test_validation_accent_is_a_preset_only(settings):
    with TestClient(create_app(settings)) as c:
        for bad in ({"accent": "#ff0000"}, {"accent": "neon"}, {"name": "x" * 61}, {"contact": "x" * 121}, {"name": "a\nb"}, {"contact": "a\tb"},
                    {"enabled": "maybe"}, {"nope": 1}):
            assert c.put("/api/v1/brand/white-label", json=bad).status_code == 422, bad
        ok = c.put("/api/v1/brand/white-label", json={"accent": "graphite", "name": "ש"}).json()
        assert ok["accent"] == "graphite"
        assert c.put("/api/v1/brand/white-label", json={"accent": "default"}).json()["accent"] == "default"


def test_a_corrupt_stored_accent_reads_as_default(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES ('brand.wl.accent', '#123456') ON CONFLICT(key) DO UPDATE SET value = '#123456'")
        assert c.get("/api/v1/brand/white-label").json()["accent"] == "default"


# ----------------------------------------------------------------------------- logos (kind installer, independent of the company logo)


def test_installer_logo_is_independent_of_the_company_logo(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        company = c.post("/api/v1/brand/company-logo/light", files={"file": ("a.png", png(color=(1, 2, 3, 255)), "image/png")}).json()["stamp"]
        inst = _up(c, "light", png(color=(200, 10, 10, 255)))
        assert inst.status_code == 201, inst.text
        s = inst.json()["stamp"]
        assert s != company
        assert c.get("/api/v1/brand").json()["company"]["logo"]["light"] == company, "the company logo is untouched"
        assert ba.stamp_of(c.get("/api/v1/brand/white-label/logo/light").content) == s
        assert _up(c, "dark", GOOD_SVG, "l.svg").json()["mime"] == "image/svg+xml"
        d = c.delete("/api/v1/brand/white-label/logo/dark")
        assert d.status_code == 200 and d.json()["logo"]["dark"] is None
        assert c.get("/api/v1/brand").json()["company"]["logo"]["light"] == company
        with app.state.db.connection() as conn:
            kinds = sorted(r[0] for r in conn.execute("SELECT kind FROM brand_assets").fetchall())
            acts = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'brand.installer.%'").fetchall()]
        assert kinds == ["company", "installer"]
        assert "brand.installer.logo.upload" in acts and "brand.installer.logo.remove" in acts


def test_logo_upload_uses_the_same_safe_pipeline(settings):
    with TestClient(create_app(settings)) as c:
        assert _up(c, "light", b"GIF89a" + b"\0" * 50, "a.png").status_code == 415
        assert _up(c, "light", png(63, 120)).status_code == 422
        assert _up(c, "light", b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script/></svg>', "a.svg").status_code == 422
        assert _up(c, "mid", png()).status_code == 404
        assert _up(c, "light", b"\x89PNG\r\n\x1a\n" + b"\0" * (ba.MAX_BYTES + 10)).status_code == 413
        assert c.get("/api/v1/brand/white-label").json()["logo"]["light"] is None


def test_permissions(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        bind(c, settings, "dana", "viewer", "installation", "*")
        bind(c, settings, "sami", "site_admin", "installation", "*")
        for user in ("dana", "sami"):
            h = as_user(user)
            assert c.get("/api/v1/brand/white-label", headers=h).status_code == 200
            assert c.put("/api/v1/brand/white-label", json={"name": "x"}, headers=h).status_code == 403
            assert _up(c, "light", png(), headers=h).status_code == 403
            assert c.delete("/api/v1/brand/white-label/logo/light", headers=h).status_code == 403
            assert c.get("/api/v1/brand/white-label/pack", headers=h).status_code == 403
            assert _pack(c, _zip({wl.PROFILE_NAME: _pj(_profile())}), headers=h).status_code == 403
        assert c.get("/api/v1/brand/white-label").json()["name"] == ""


# ----------------------------------------------------------------------------- the customer pack


def test_export_content(settings):
    with TestClient(create_app(settings)) as c:
        _up(c, "light", png())
        _up(c, "dark", GOOD_SVG, "l.svg")
        c.put("/api/v1/brand/white-label", json={"name": "מתקין", "contact": "03-1", "accent": "purple", "enabled": True})
        r = c.get("/api/v1/brand/white-label/pack")
        assert r.status_code == 200 and r.headers["content-type"] == "application/zip" and "attachment" in r.headers["content-disposition"]
        z = zipfile.ZipFile(io.BytesIO(r.content))
        assert sorted(z.namelist()) == ["README_HE.txt", "brand-profile.json", "logos/dark.svg", "logos/light.png"]
        doc = json.loads(z.read("brand-profile.json"))
        assert doc["schema"] == wl.SCHEMA and doc["version"] == 1 and doc["name"] == "מתקין" and doc["contact"] == "03-1" and doc["accent"] == "purple"
        assert "enabled" not in doc, "the master switch is not part of a pack"
        assert doc["logos"]["light"]["sha256"] == hashlib.sha256(z.read("logos/light.png")).hexdigest()
        readme = z.read("README_HE.txt").decode("utf-8")
        assert "SmplWise Arx" in readme and "לא מדליק" in readme
        # deterministic: the same profile is the same bytes
        assert c.get("/api/v1/brand/white-label/pack").content == r.content


def test_round_trip_onto_a_second_installation_keeps_the_switch_off(settings, tmp_path):
    with TestClient(create_app(settings)) as c:
        _up(c, "light", png())
        _up(c, "dark", GOOD_SVG, "l.svg")
        c.put("/api/v1/brand/white-label", json={"name": "מתקין", "contact": "03-1", "accent": "teal", "enabled": True})
        raw = c.get("/api/v1/brand/white-label/pack").content
        src = c.get("/api/v1/brand/white-label").json()
    import dataclasses

    other = dataclasses.replace(settings, data_dir=tmp_path / "other")
    with TestClient(create_app(other)) as c2:
        assert c2.get("/api/v1/brand/white-label").json()["name"] == ""
        r = _pack(c2, raw)
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["enabled"] is False, "an import never switches the profile on"
        assert (v["name"], v["contact"], v["accent"]) == ("מתקין", "03-1", "teal")
        assert v["logo"] == src["logo"], "same bytes, same stamps"
        assert c2.get("/api/v1/brand/public").json()["installer"] == {"enabled": False}


def test_import_replaces_and_removes_a_variant_the_pack_lacks(settings):
    with TestClient(create_app(settings)) as c:
        _up(c, "light", png())
        _up(c, "dark", png(color=(9, 9, 9, 255)))
        light = png(color=(100, 100, 100, 255))
        doc = _profile(logos={"light": {"file": "logos/light.png", "mime": "image/png", "sha256": hashlib.sha256(light).hexdigest()}})
        r = _pack(c, _zip({wl.PROFILE_NAME: _pj(doc), "logos/light.png": light, wl.README_NAME: b"x"}))
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["logo"]["light"] and v["logo"]["dark"] is None and v["files"]["dark"] is None
        with c.app.state.db.connection() as conn:
            assert conn.execute("SELECT COUNT(*) FROM brand_assets WHERE kind = 'installer'").fetchone()[0] == 1
            assert "brand.installer.pack.import" in [x[0] for x in conn.execute("SELECT action FROM audit_log").fetchall()]


def test_import_sanitises_logos_again_even_when_the_hash_matches(settings):
    with TestClient(create_app(settings)) as c:
        evil = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script>alert(1)</script></svg>'
        doc = _profile(logos={"light": {"file": "logos/light.svg", "mime": "image/svg+xml", "sha256": hashlib.sha256(evil).hexdigest()}})
        r = _pack(c, _zip({wl.PROFILE_NAME: _pj(doc), "logos/light.svg": evil}))
        assert r.status_code == 422
        assert c.get("/api/v1/brand/white-label").json()["name"] == "", "a refused pack writes nothing (not even the name)"


def _expect_refused(c, raw, status=422, code="brand_pack_invalid"):
    r = _pack(c, raw)
    assert r.status_code == status, r.text
    assert code in r.text
    v = c.get("/api/v1/brand/white-label").json()
    assert v["name"] == "" and v["logo"] == {"light": None, "dark": None}, "a refused pack changes nothing"


def test_import_refusals(settings):
    light = png()
    ok_logo = {"light": {"file": "logos/light.png", "mime": "image/png", "sha256": hashlib.sha256(light).hexdigest()}}
    with TestClient(create_app(settings)) as c:
        _expect_refused(c, b"not a zip at all")
        _expect_refused(c, _zip({"README_HE.txt": b"x"}))  # no profile
        _expect_refused(c, _zip({wl.PROFILE_NAME: b"{not json"}))
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile(schema="other"))}))
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile(version=2))}))
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile(accent="#ff0000"))}))  # a free colour
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile(name="x" * 61))}))
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile(name=5))}))
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(["a"])}))
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile()), "extra.txt": b"x"}))  # an entry outside the allowlist
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile()), "../evil.png": b"x"}))  # a path
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile()), "logos/light.png": light}))  # a logo the profile does not declare
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile(logos=ok_logo))}))  # a declared logo that is missing
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile(logos={"light": {**ok_logo["light"], "sha256": "0" * 64}})), "logos/light.png": light}))  # hash mismatch
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile(logos={"light": {**ok_logo["light"], "file": "logos/dark.png"}})), "logos/dark.png": light}))  # wrong variant
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile(logos={"mid": ok_logo["light"]})), "logos/light.png": light}))
        _expect_refused(c, _zip({wl.PROFILE_NAME: _pj(_profile(logos={"light": {"file": "logos/light.png", "sha256": hashlib.sha256(b"GIF89a" + b"\0" * 50).hexdigest()}})),
                                 "logos/light.png": b"GIF89a" + b"\0" * 50}), status=415, code="unsupported_format")


def test_import_cuts_a_zip_bomb_and_an_oversized_pack(settings):
    with TestClient(create_app(settings)) as c:
        bomb = _zip({wl.PROFILE_NAME: b"{" + b" " * (wl.MAX_TEXT_BYTES * 4) + b"}"})
        assert len(bomb) < 5000, "highly compressible"
        assert _pack(c, bomb).status_code == 422
        huge = _zip({wl.PROFILE_NAME: _pj(_profile()), wl.README_NAME: b"x" * (wl.MAX_TEXT_BYTES * 2)})
        assert _pack(c, huge).status_code == 422
        big = b"PK" + b"\0" * (wl.MAX_PACK_BYTES + 10)
        assert _pack(c, big).status_code in (413, 422)


def test_parse_pack_reads_bounded(settings):
    # a lying header (declared small, real data large) is cut by the bounded read, not trusted
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(wl.PROFILE_NAME, b"{" + b" " * (wl.MAX_TEXT_BYTES + 100) + b"}")
    with pytest.raises(Exception) as e:
        wl.parse_pack(buf.getvalue())
    assert getattr(e.value, "status", None) == 422


# ----------------------------------------------------------------------------- applications: e-mail, report, backup


def test_email_header_and_footer_carry_the_installer_only_while_on(settings):
    n = {"id": "n1", "title": "טמפרטורה גבוהה", "place": "מקרר", "severity": "alert", "count": 1, "first_at": "2026-10-24T08:00:00Z", "last_at": "2026-10-24T08:00:00Z"}
    plain = notify_email.compose_notification(n, mode="new", tz_name="Asia/Jerusalem")
    assert "מתקין" not in plain.html and plain.html.count(">Arx<") == 1
    r = notify_email.compose_notification(n, mode="new", tz_name="Asia/Jerusalem", installer=("מתקין <b>", "03-1234567"))
    assert "מתקין &lt;b&gt; · Arx" in r.html and "מתקין <b>" not in r.html, "the name is escaped"
    assert "03-1234567" in r.html and "03-1234567" in r.text
    assert notify_email.FOOTER in r.html, "the product's own footer stays"
    assert r.subject == plain.subject, "the subject keeps the product's name"
    with TestClient(create_app(settings)) as c:
        app = c.app
        with app.state.db.connection() as conn:
            assert wl.email_line(conn) is None
        c.put("/api/v1/brand/white-label", json={"name": "מתקין", "contact": "03-9"})
        with app.state.db.connection() as conn:
            assert wl.email_line(conn) is None, "named but switched off"
        c.put("/api/v1/brand/white-label", json={"enabled": True})
        with app.state.db.connection() as conn:
            assert wl.email_line(conn) == ("מתקין", "03-9")
        c.put("/api/v1/brand/white-label", json={"name": ""})
        with app.state.db.connection() as conn:
            assert wl.email_line(conn) is None, "no name, no header decoration"


def test_temperature_report_head_names_the_installer_when_on(settings):
    from smplwise.services import temperature_report as tr

    model = {"v": 1, "lang": "he", "from": 0, "to": 3600, "zone": "Asia/Jerusalem", "generated": 3600, "units": [], "chart": False, "events": False,
             "signature": None, "layout": "standard", "samples": False, "digest": "0" * 64}
    assert 'class="inst"' not in tr.html_of(model)
    model["installer"] = {"name": "מתקין <i>", "contact": "03-1"}
    assert tr.digest(model) != tr.digest({k: v for k, v in model.items() if k != "installer"}), "the head is part of the content digest"


def test_profile_travels_with_the_project_backup(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        st = _up(c, "light", png()).json()["stamp"]
        c.put("/api/v1/brand/white-label", json={"name": "מתקין", "contact": "03-1", "accent": "pink", "enabled": True})
        e = c.post("/api/v1/backups", json={}).json()
        raw = c.get(f"/api/v1/backups/{e['name']}/download").content
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            rows = json.loads(z.read("data/brand_assets.json"))
        assert "installer" in {r["kind"] for r in rows}
        assert c.delete("/api/v1/brand/white-label/logo/light").status_code == 200
        assert c.put("/api/v1/brand/white-label", json={"name": "אחר", "enabled": False, "accent": "default"}).status_code == 200
        up = c.post("/api/v1/backups/upload", files={"file": ("b.zip", raw, "application/zip")})
        res = c.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
        assert res.status_code == 200, res.text
        v = c.get("/api/v1/brand/white-label").json()
        assert (v["name"], v["accent"], v["enabled"]) == ("מתקין", "pink", True) and v["logo"]["light"] == st


def test_migration_0193_widens_the_kind_check_and_keeps_company_rows(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        c.post("/api/v1/brand/company-logo/light", files={"file": ("a.png", png(), "image/png")})
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT COUNT(*) FROM brand_assets WHERE kind = 'company'").fetchone()[0] == 1
            assert conn.execute("SELECT 1 FROM schema_migrations WHERE version = 193").fetchone() is not None
            with pytest.raises(Exception):
                conn.execute("INSERT INTO brand_assets(kind, variant, stamp, mime, width, height, data_b64, uploaded_at) VALUES('bogus','light','a','image/png',1,1,'x','t')")
