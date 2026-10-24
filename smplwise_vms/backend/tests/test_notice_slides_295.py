"""NOTICESLIDES-295 slice C: promo slides (shared by several boards, 10 per board), the building photo of template 2, the image pipeline,
the feed blocks (`slides[]`, `board.display.photo`), the token routes of the pictures (own board only), permissions, the LAN listener
and the backup classification. Fakes only: no network."""
from __future__ import annotations

import io
import json

import pytest
from PIL import Image

from conftest import as_user, bind
from smplwise.db import Database
from smplwise.services import backup
from smplwise.services.bill_pdf_logo import LogoError, sanitize_image
from smplwise.services.notices import display as disp
from smplwise.services.notices import listener, slides

API = "/api/v1"


def _on(client) -> None:
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug="lobby") -> tuple[str, str]:
    r = client.post(f"{API}/notices/boards", json={"name": "לוח " + slug, "slug": slug})
    assert r.status_code == 200, r.text
    return r.json()["board"]["id"], r.json()["token"]


def _png(w=1200, h=900, color=(200, 60, 40)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format="PNG")
    return buf.getvalue()


def _jpeg(w=3000, h=2000, color=(20, 90, 160), exif=True) -> bytes:
    im = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    if exif:
        ex = Image.Exif()
        ex[0x010E] = "secret camera description"
        im.save(buf, format="JPEG", quality=70, exif=ex)
    else:
        im.save(buf, format="JPEG", quality=70)
    return buf.getvalue()


def _slide(client, title="חדר הכושר פתוח", **kw) -> str:
    r = client.post(f"{API}/notices/promo-slides", json={"title": title, "text": "כל יום 06:00-23:00", **kw})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _up(client, path, data, name="p.png", mime="image/png"):
    return client.put(f"{API}{path}", files={"file": (name, data, mime)})


def _feed(client, slug, token):
    r = client.get(f"{API}/notices/display/{slug}", headers={"X-Board-Token": token})
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- the gate and the permission

def test_the_routes_are_gated_by_the_module_and_by_notices_boards(client, settings):
    assert client.get(f"{API}/notices/promo-slides/all").status_code == 404  # module off
    _on(client)
    assert client.get(f"{API}/notices/promo-slides/all").status_code == 200
    bind(client, settings, "dana", "viewer", "installation", "*")
    h = as_user("dana")
    bid, _tok = _board(client)
    sid = _slide(client)
    png = {"file": ("a.png", _png(), "image/png")}
    for method, path, kw in [
        ("get", "/notices/promo-slides/all", {}), ("post", "/notices/promo-slides", {"json": {"title": "x"}}),
        ("patch", f"/notices/promo-slides/{sid}", {"json": {"title": "y"}}), ("delete", f"/notices/promo-slides/{sid}", {}),
        ("put", f"/notices/promo-slides/{sid}/image", {"files": png}), ("delete", f"/notices/promo-slides/{sid}/image", {}),
        ("get", f"/notices/promo-slides/{sid}/image", {}), ("get", f"/notices/boards/{bid}/slides", {}),
        ("put", f"/notices/boards/{bid}/slides", {"json": {"slide_ids": []}}),
        ("put", f"/notices/boards/{bid}/photo", {"files": png}),
        ("delete", f"/notices/boards/{bid}/photo", {}), ("get", f"/notices/boards/{bid}/photo", {}),
    ]:
        assert getattr(client, method)(API + path, headers=h, **kw).status_code == 403, (method, path)


# ---------------------------------------------------------------- slides: CRUD, sharing, limits

def test_crud_validation_and_audit(client, settings):
    _on(client)
    bid, _ = _board(client)
    sid = _slide(client, seconds=20, board_ids=[bid])
    lst = client.get(f"{API}/notices/promo-slides/all").json()
    assert lst["limit"] == 10 and lst["slides"][0]["boards"] == [bid] and lst["slides"][0]["seconds"] == 20
    assert client.patch(f"{API}/notices/promo-slides/{sid}", json={"title": "חדש", "text": "", "seconds": None}).status_code == 200
    one = client.get(f"{API}/notices/boards/{bid}/slides").json()["slides"][0]
    assert one["title"] == "חדש" and one["seconds"] is None
    for bad in ({"title": ""}, {"title": "x" * 81}, {"title": "x", "text": "y" * 301}, {"title": "x", "seconds": 3}, {"title": "x", "seconds": 999},
                {"title": "x", "board_ids": ["nope"]}, {"title": "x", "extra": 1}):
        assert client.post(f"{API}/notices/promo-slides", json=bad).status_code == 422, bad
    assert client.patch(f"{API}/notices/promo-slides/missing", json={"title": "x"}).status_code == 404
    assert client.delete(f"{API}/notices/promo-slides/{sid}").status_code == 200
    assert client.get(f"{API}/notices/promo-slides/all").json()["slides"] == []
    with Database(settings.db_path).connection() as c:
        acts = {r[0] for r in c.execute("SELECT action FROM audit_log WHERE action LIKE 'notices.slide.%'").fetchall()}
    assert {"notices.slide.create", "notices.slide.update", "notices.slide.delete"} <= acts


def test_one_slide_on_several_boards_and_ten_per_board(client):
    _on(client)
    a, _ = _board(client, "a")
    b, _ = _board(client, "b")
    shared = _slide(client, "משותפת", board_ids=[a, b])
    assert sorted(client.get(f"{API}/notices/promo-slides/all").json()["slides"][0]["boards"]) == sorted([a, b])
    for i in range(9):
        _slide(client, f"s{i}", board_ids=[a])
    assert len(client.get(f"{API}/notices/boards/{a}/slides").json()["slides"]) == 10
    assert len(client.get(f"{API}/notices/boards/{b}/slides").json()["slides"]) == 1
    r = client.post(f"{API}/notices/promo-slides", json={"title": "אחת עשרה", "board_ids": [a]})
    assert r.status_code == 422 and r.json()["details"]["field"] == "board_ids"
    assert client.patch(f"{API}/notices/promo-slides/{shared}", json={"board_ids": [b]}).status_code == 200  # leaving a board is fine
    free = _slide(client, "חופשית")
    assert client.patch(f"{API}/notices/promo-slides/{free}", json={"board_ids": [a]}).status_code == 200  # now 9 + 1
    assert client.patch(f"{API}/notices/promo-slides/{shared}", json={"board_ids": [a, b]}).status_code == 422  # a is full again


def test_order_and_board_delete_keeps_the_library(client):
    _on(client)
    a, _ = _board(client, "a")
    x, y, z = (_slide(client, t, board_ids=[a]) for t in "xyz")
    assert [s["id"] for s in client.get(f"{API}/notices/boards/{a}/slides").json()["slides"]] == [x, y, z]
    assert client.put(f"{API}/notices/boards/{a}/slides", json={"slide_ids": [z, x]}).json()["slides"][0]["id"] == z
    assert [s["id"] for s in client.get(f"{API}/notices/boards/{a}/slides").json()["slides"]] == [z, x, y]
    assert client.put(f"{API}/notices/boards/{a}/slides", json={"slide_ids": ["alien"]}).status_code == 422
    assert client.delete(f"{API}/notices/boards/{a}").status_code == 200
    assert len(client.get(f"{API}/notices/promo-slides/all").json()["slides"]) == 3


# ---------------------------------------------------------------- the image pipeline

def test_sanitize_image_rules():
    mime, out = sanitize_image(_jpeg(), max_bytes=2_000_000, max_side=1920)
    im = Image.open(io.BytesIO(out))
    assert mime == "image/jpeg" and max(im.size) == 1920 and not im.getexif() and b"secret camera" not in out
    rgba = io.BytesIO()
    Image.new("RGBA", (300, 200), (255, 0, 0, 90)).save(rgba, format="PNG")
    mime, out = sanitize_image(rgba.getvalue(), max_bytes=1_000_000, max_side=800)
    assert mime == "image/png" and Image.open(io.BytesIO(out)).mode == "RGBA"
    for bad, code in [(b"", "logo_empty"), (b"GIF89a....", "logo_type"), (b"<svg xmlns='x'/>", "logo_type"), (b"RIFF1234WEBPVP8 ", "logo_type"),
                      (b"\x89PNG\r\n\x1a\n" + b"junk", "logo_undecodable"), (_png() + b"0" * 1_100_000, "logo_too_large")]:
        with pytest.raises(LogoError, match=code):
            sanitize_image(bad, max_bytes=1_000_000, max_side=800)


def test_slide_picture_is_scaled_to_800_stored_and_served(client):
    _on(client)
    bid, _ = _board(client)
    sid = _slide(client, board_ids=[bid])
    big = _jpeg(2400, 1600)
    assert len(big) < 1_000_000
    assert _up(client, f"/notices/promo-slides/{sid}/image", big, "a.jpg", "image/jpeg").status_code == 200
    got = client.get(f"{API}/notices/promo-slides/{sid}/image")
    assert got.status_code == 200 and got.headers["content-type"] == "image/jpeg" and max(Image.open(io.BytesIO(got.content)).size) == 800
    assert client.get(f"{API}/notices/promo-slides/all").json()["slides"][0]["has_image"] is True
    assert client.delete(f"{API}/notices/promo-slides/{sid}/image").status_code == 200
    assert client.get(f"{API}/notices/promo-slides/{sid}/image").status_code == 404


def test_refused_uploads(client):
    _on(client)
    bid, _ = _board(client)
    sid = _slide(client, board_ids=[bid])
    r = _up(client, f"/notices/promo-slides/{sid}/image", b"<svg xmlns='http://www.w3.org/2000/svg'/>", "a.svg", "image/svg+xml")
    assert r.status_code == 422 and r.json()["code"] == "image_refused" and r.json()["details"]["reason"] == "logo_type"
    r = _up(client, f"/notices/promo-slides/{sid}/image", _png() + b"0" * 1_100_000)
    assert r.status_code == 413 or r.json()["details"]["reason"] == "logo_too_large"  # the body-size rule answers first (1 MB + framing)
    r = _up(client, f"/notices/boards/{bid}/photo", _png() + b"0" * 2_100_000)
    assert r.status_code in (413, 422)
    assert _up(client, "/notices/promo-slides/missing/image", _png()).status_code == 404
    assert client.get(f"{API}/notices/promo-slides/all").json()["slides"][0]["has_image"] is False


# ---------------------------------------------------------------- the feed

def test_feed_slides_only_with_the_promo_block_and_photo_only_on_template_2(client):
    _on(client)
    bid, token = _board(client)
    sid = _slide(client, seconds=15, board_ids=[bid])
    assert _up(client, f"/notices/promo-slides/{sid}/image", _png()).status_code == 200
    assert "slides" not in _feed(client, "lobby", token)  # `promo` is off by default (owner decision 258)
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"blocks": {"promo": True}}}).status_code == 200
    f = _feed(client, "lobby", token)
    assert set(f["slides"][0]) == {"id", "title", "text", "seconds", "image"} and f["slides"][0]["seconds"] == 15
    assert f["slides"][0]["image"].startswith(f"api/v1/notices/display/lobby/slide/{sid}?v=")
    assert "photo" not in f["board"]["display"]
    assert _up(client, f"/notices/boards/{bid}/photo", _jpeg(2600, 1700)).status_code == 200
    assert "photo" not in _feed(client, "lobby", token)["board"]["display"]  # template 1
    client.patch(f"{API}/notices/boards/{bid}", json={"display": {"template": 2}})
    f = _feed(client, "lobby", token)
    assert f["board"]["display"]["photo"].startswith("api/v1/notices/display/lobby/photo?v=")
    blob = json.dumps(f)
    assert "created_by" not in blob and "board_ids" not in blob and "image_b64" not in blob


def test_feed_version_changes_with_slides_and_photo(client):
    _on(client)
    bid, token = _board(client)
    client.patch(f"{API}/notices/boards/{bid}", json={"display": {"blocks": {"promo": True}, "template": 2}})
    v0 = _feed(client, "lobby", token)["board"]["version"]
    sid = _slide(client, board_ids=[bid])
    v1 = _feed(client, "lobby", token)["board"]["version"]
    _up(client, f"/notices/promo-slides/{sid}/image", _png())
    v2 = _feed(client, "lobby", token)["board"]["version"]
    _up(client, f"/notices/boards/{bid}/photo", _jpeg(1000, 700))
    v3 = _feed(client, "lobby", token)["board"]["version"]
    assert len({v0, v1, v2, v3}) == 4


def test_preview_uses_the_signed_in_urls(client):
    _on(client)
    bid, _ = _board(client)
    sid = _slide(client, board_ids=[bid])
    _up(client, f"/notices/promo-slides/{sid}/image", _png())
    _up(client, f"/notices/boards/{bid}/photo", _jpeg(1000, 700))
    r = client.post(f"{API}/notices/boards/{bid}/preview", json={"display": {"blocks": {"promo": True}, "template": 2}}).json()
    assert r["slides"][0]["image"].startswith(f"api/v1/notices/promo-slides/{sid}/image?v=")
    assert r["board"]["display"]["photo"].startswith(f"api/v1/notices/boards/{bid}/photo?v=")
    assert client.get(f"{API}/notices/boards/{bid}/photo").headers["content-type"] == "image/jpeg"


# ---------------------------------------------------------------- the token routes

def test_pictures_need_the_board_token_and_never_cross_boards(client):
    _on(client)
    a, ta = _board(client, "a")
    b, tb = _board(client, "b")
    sa = _slide(client, "a", board_ids=[a])
    sb = _slide(client, "b", board_ids=[b])
    for s in (sa, sb):
        _up(client, f"/notices/promo-slides/{s}/image", _png())
    _up(client, f"/notices/boards/{a}/photo", _jpeg(1000, 700))
    ok = client.get(f"{API}/notices/display/a/slide/{sa}", headers={"X-Board-Token": ta})
    assert ok.status_code == 200 and ok.headers["content-type"] == "image/jpeg"
    assert ok.headers["cache-control"] == "private, max-age=3600" and ok.headers["x-content-type-options"] == "nosniff"
    assert client.get(f"{API}/notices/display/a/slide/{sa}").status_code == 404  # no token
    assert client.get(f"{API}/notices/display/a/slide/{sa}", headers={"X-Board-Token": tb}).status_code == 404  # another board's token
    assert client.get(f"{API}/notices/display/a/slide/{sb}", headers={"X-Board-Token": ta}).status_code == 404  # another board's slide
    assert client.get(f"{API}/notices/display/a/slide/..%2F..", headers={"X-Board-Token": ta}).status_code == 404
    assert client.get(f"{API}/notices/display/a/photo", headers={"X-Board-Token": ta}).status_code == 200
    assert client.get(f"{API}/notices/display/b/photo", headers={"X-Board-Token": tb}).status_code == 404  # b has no photo
    assert client.get(f"{API}/notices/display/a/photo").status_code == 404


def test_the_listener_routes_the_pictures(client, settings):
    _on(client)
    a, ta = _board(client, "a")
    sa = _slide(client, "a", board_ids=[a])
    _up(client, f"/notices/promo-slides/{sa}/image", _png())
    _up(client, f"/notices/boards/{a}/photo", _jpeg(1000, 700))
    db = Database(settings.db_path)
    svc = disp.DisplayService(lambda: db.connection(mode="read"), settings.data_dir, limiter=disp.RateLimiter())
    h = {"x-board-token": ta}
    assert listener.route(svc, settings.www_dir, "GET", f"/api/v1/notices/display/a/slide/{sa}?v=1", h, "1.1.1.1").status == 200
    assert listener.route(svc, settings.www_dir, "GET", "/api/v1/notices/display/a/photo?v=1", h, "1.1.1.1").status == 200
    assert listener.route(svc, settings.www_dir, "GET", f"/api/v1/notices/display/a/slide/{sa}", {}, "1.1.1.2").status == 404
    assert listener.route(svc, settings.www_dir, "GET", "/api/v1/notices/display/a/photo/x", h, "1.1.1.1").status == 404


# ---------------------------------------------------------------- photo replace / delete, backup classification, migration

def test_photo_is_replaced_not_stacked_and_never_counts_as_a_slide(client, settings):
    _on(client)
    bid, _ = _board(client)
    _up(client, f"/notices/boards/{bid}/photo", _jpeg(1000, 700))
    _up(client, f"/notices/boards/{bid}/photo", _jpeg(1200, 800, (1, 2, 3)))
    out = client.get(f"{API}/notices/boards/{bid}/slides").json()
    assert out["photo"]["has"] is True and out["slides"] == []
    with Database(settings.db_path).connection() as c:
        assert c.execute("SELECT count(*) FROM notice_slides WHERE kind = 'photo'").fetchone()[0] == 1
        assert slides.count_on(c, bid) == 0
    assert client.delete(f"{API}/notices/boards/{bid}/photo").status_code == 200
    assert client.get(f"{API}/notices/boards/{bid}/photo").status_code == 404
    assert client.get(f"{API}/notices/boards/{bid}/slides").json()["photo"]["has"] is False


def test_backup_classification_matches_the_other_notice_tables():
    for t in ("notice_slides", "notice_board_slides"):
        assert t not in backup.PROJECT_TABLES and t not in backup.NEVER_EXPORTED_TABLES
    assert "notice_boards" not in backup.PROJECT_TABLES  # the slide links hang off board ids an archive does not carry


def test_the_migration_is_idempotent(settings, client):
    from smplwise.db import MIGRATIONS_DIR

    sql = (MIGRATIONS_DIR / "0172_notice_slides.sql").read_text(encoding="utf-8")
    with Database(settings.db_path).connection() as c:
        c.executescript(sql)  # a second run changes nothing
        cols = {r[1] for r in c.execute("PRAGMA table_info(notice_slides)")}
        assert {"kind", "title", "body", "seconds", "image_mime", "image_b64", "image_stamp"} <= cols
        assert {r[1] for r in c.execute("PRAGMA table_info(notice_board_slides)")} == {"board_id", "slide_id", "position"}
