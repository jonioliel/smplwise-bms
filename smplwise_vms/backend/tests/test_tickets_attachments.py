"""CR-038 section 10.6 - the ONE image validator of the module (services/tickets/attachments.py), hostile uploads included: a
decompression bomb, 16 MP + 1 pixel, a truncated JPEG, a PNG with a trailing ZIP (re-encoded away), WebP refused, SVG / HTML renamed
.jpg, HEIC, EXIF GPS stripped (the re-read file has no EXIF), 8 MiB + 1 byte (the route's body limit), the 61st photo, the storage cap
checked BEFORE any decode, the module's own decode slot (busy -> 429) - and the serving headers, the delete window."""
from __future__ import annotations

import io
import zipfile

import pytest
from PIL import Image

from smplwise.services.tickets import attachments, store
from tickets_world import API, build

MB = 1024 * 1024


@pytest.fixture()
def w(settings):
    attachments.forget_size_cache()
    world = build(settings)
    yield world
    attachments.forget_size_cache()


def _img(fmt: str = "JPEG", size=(320, 200), exif: bytes | None = None, color=(30, 140, 200)) -> bytes:
    buf = io.BytesIO()
    im = Image.new("RGB", size, color)
    kwargs = {"exif": exif} if exif is not None else {}
    im.save(buf, format=fmt, **kwargs)
    return buf.getvalue()


def _gps_exif() -> bytes:
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # Make
    gps = {1: "N", 2: (32.0, 4.0, 30.0), 3: "E", 4: (34.0, 46.0, 50.0)}
    exif[0x8825] = gps  # GPSInfo
    return exif.tobytes()


def _upload(w, ticket_id: str, data: bytes, user: str = "tom", name: str = "p.jpg", external: str = "false"):
    return w.c.post(f"{API}/tickets/{ticket_id}/attachments", files={"file": (name, data, "image/jpeg")}, data={"external": external}, headers=w.h(user))


def test_a_photo_is_re_encoded_without_exif_or_gps_and_served_safely(w):
    t = w.create("tom")
    original = _img(exif=_gps_exif(), size=(3000, 1500))
    assert Image.open(io.BytesIO(original)).getexif().get(0x8825), "the fixture really carries GPS"
    r = _upload(w, t["id"], original)
    assert r.status_code == 201, r.text
    att = r.json()["attachments"][0]
    assert (att["width"], att["height"]) == (2048, 1024), "the long side is capped at 2048 px"
    got = w.c.get(f"{API}/{att['url']}", headers=w.h("tom"))
    assert got.status_code == 200 and got.headers["content-type"] == "image/jpeg"
    assert got.headers["x-content-type-options"] == "nosniff" and got.headers["cache-control"] == "private, no-store"
    assert got.headers["content-disposition"] == f'inline; filename="ticket-{t["number"]}.jpg"'
    again = Image.open(io.BytesIO(got.content))
    assert not again.getexif() and "exif" not in again.info and "icc_profile" not in again.info
    with w.c.app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT path, sha256, bytes FROM ticket_attachments WHERE id = ?", (att["id"],)).fetchone()
    assert row["path"].startswith(f"{t['id']}/") and row["path"].endswith(".jpg") and len(row["sha256"]) == 64
    assert original not in got.content and row["bytes"] == len(got.content)


def test_png_with_a_trailing_zip_comes_out_as_a_clean_jpeg(w):
    t = w.create("tom")
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w") as z:
        z.writestr("payload.html", "<script>alert(1)</script>")
    polyglot = _img("PNG") + zbuf.getvalue()
    r = _upload(w, t["id"], polyglot, name="cute.png")
    assert r.status_code == 201, r.text
    body = w.c.get(f"{API}/{r.json()['attachments'][0]['url']}", headers=w.h("tom")).content
    assert body[:3] == b"\xff\xd8\xff" and b"PK\x03\x04" not in body and b"<script>" not in body


@pytest.mark.parametrize("data, status, code", [
    (b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 64, 415, "webp_refused"),
    (b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic" + b"\x00" * 64, 415, "heic_refused"),
    (b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", 415, "unsupported_format"),
    (b"<html><body>hi</body></html>", 415, "unsupported_format"),
    (b"GIF89a" + b"\x00" * 64, 415, "unsupported_format"),
])
def test_formats_other_than_jpeg_and_png_are_refused(w, data, status, code):
    t = w.create("tom")
    r = _upload(w, t["id"], data, name="looks-fine.jpg")
    assert r.status_code == status and r.json()["code"] == code, r.text


def test_webp_is_refused_even_when_pillow_could_read_it(w):
    t = w.create("tom")
    r = _upload(w, t["id"], _img("WEBP"))
    assert r.status_code == 415 and r.json()["code"] == "webp_refused"


def test_broken_images_are_422_even_when_truncated_images_are_allowed_process_wide(w, monkeypatch):
    from PIL import ImageFile

    monkeypatch.setattr(ImageFile, "LOAD_TRUNCATED_IMAGES", True)  # what WeasyPrint does at import (2.5.0 gate)
    t = w.create("tom")
    jpeg = _img(size=(800, 600))
    r = _upload(w, t["id"], jpeg[: len(jpeg) // 3])
    assert r.status_code == 422 and r.json()["code"] == "image_invalid"
    assert ImageFile.LOAD_TRUNCATED_IMAGES is True


def test_truncated_and_broken_images_are_422(w):
    t = w.create("tom")
    jpeg = _img(size=(800, 600))
    r = _upload(w, t["id"], jpeg[: len(jpeg) // 3])
    assert r.status_code == 422 and r.json()["code"] == "image_invalid"
    r = _upload(w, t["id"], b"\xff\xd8\xff" + b"garbage" * 50)
    assert r.status_code == 422 and r.json()["code"] == "image_invalid"


def test_the_pixel_budget_is_judged_on_the_header_before_any_decode(w, monkeypatch):
    t = w.create("tom")
    # 16 MP + 1 pixel: a valid PNG header that declares more pixels than the budget (never decoded)
    big = Image.new("1", (4001, 4000))
    buf = io.BytesIO()
    big.save(buf, format="PNG", optimize=True)
    assert 4001 * 4000 > attachments.MAX_PIXELS
    from PIL import ImageFile

    decoded = []
    real_load = ImageFile.ImageFile.load
    monkeypatch.setattr(ImageFile.ImageFile, "load", lambda self, *a, **k: decoded.append(self.size) or real_load(self, *a, **k))
    r = _upload(w, t["id"], buf.getvalue(), name="bomb.png")
    assert r.status_code == 422 and r.json()["code"] == "too_many_pixels" and r.json()["details"]["max_pixels"] == attachments.MAX_PIXELS
    assert decoded == [], "refused before a single pixel was decoded"
    exact = Image.new("1", (4000, 4000))
    buf = io.BytesIO()
    exact.save(buf, format="PNG", optimize=True)
    assert _upload(w, t["id"], buf.getvalue(), name="ok.png").status_code == 201, "exactly 16 MP passes"


def test_a_decompression_bomb_is_refused(w):
    t = w.create("tom")
    bomb = Image.new("1", (20000, 20000))  # 400 MP declared, a few kB on disk
    buf = io.BytesIO()
    bomb.save(buf, format="PNG", optimize=True)
    assert len(buf.getvalue()) < 200_000
    r = _upload(w, t["id"], buf.getvalue(), name="bomb.png")
    assert r.status_code == 422 and r.json()["code"] == "too_many_pixels"


def test_eight_mib_plus_one_byte_is_refused_by_the_body_limit(w):
    t = w.create("tom")
    data = b"\xff\xd8\xff" + b"\x00" * (attachments.MAX_BYTES + 64 * 1024)
    r = _upload(w, t["id"], data)
    assert r.status_code == 413 and r.json()["code"] == "payload_too_large"
    with pytest.raises(attachments.Refused) as e:
        attachments.store(w.settings.data_dir, t["id"], b"\xff\xd8\xff" + b"\x00" * attachments.MAX_BYTES)
    assert e.value.status == 413


def test_the_sixty_first_photo_is_refused(w, monkeypatch):
    assert attachments.PER_TICKET_MAX == 60
    t = w.create("tom")
    monkeypatch.setattr(attachments, "PER_TICKET_MAX", 3)  # the same rule, without uploading sixty pictures
    for _ in range(3):
        assert _upload(w, t["id"], _img()).status_code == 201
    r = _upload(w, t["id"], _img())
    assert r.status_code == 409 and r.json()["code"] == "too_many_photos" and r.json()["details"]["max"] == 3


def test_the_storage_cap_is_checked_before_any_decode(w, monkeypatch):
    t = w.create("tom")
    monkeypatch.setattr(attachments, "STORAGE_CAP", 10)
    decoded = []
    monkeypatch.setattr(attachments, "reencode", lambda data: decoded.append(1) or (b"", 1, 1))
    r = _upload(w, t["id"], _img())
    assert r.status_code == 507 and r.json()["code"] == "storage_full" and decoded == []


def test_the_module_has_its_own_decode_slot(w, monkeypatch):
    t = w.create("tom")
    monkeypatch.setattr(attachments, "DECODE_WAIT_S", 0.05)
    held = attachments._DECODE.acquire(timeout=1)
    try:
        r = _upload(w, t["id"], _img())
        assert r.status_code == 429 and r.json()["code"] == "busy" and r.json()["retryable"] is True
    finally:
        if held:
            attachments._DECODE.release()
    from smplwise.routers import ui_background

    assert attachments._DECODE is not ui_background._DECODE, "anonymous uploads (slice 4) never wait in the administrator's background slot"
    assert _upload(w, t["id"], _img()).status_code == 201


def test_delete_rules_and_the_file_goes(w, monkeypatch):
    t = w.create("tom")
    r = _upload(w, t["id"], _img(), user="tom")
    att = r.json()["attachments"][0]
    with w.c.app.state.db.connection(mode="read") as conn:
        path = attachments.path_of(w.settings.data_dir, store.attachment(conn, t["id"], att["id"])["path"])
    assert path.is_file()
    assert w.c.delete(f"{API}/tickets/{t['id']}/attachments/{att['id']}", headers=w.h("gil")).status_code == 403, "another member"
    with w.c.app.state.db.connection() as conn:  # the uploader's 10 minutes are over
        conn.execute("UPDATE ticket_attachments SET created_at = '2026-01-01T00:00:00Z' WHERE id = ?", (att["id"],))
    assert w.c.delete(f"{API}/tickets/{t['id']}/attachments/{att['id']}", headers=w.h("tom")).status_code == 403
    r = w.c.delete(f"{API}/tickets/{t['id']}/attachments/{att['id']}", headers=w.h("mona"))
    assert r.status_code == 200 and r.json()["attachments"] == [] and r.json()["events"][-1]["kind"] == "photo_removed"
    assert not path.exists()
    assert w.c.get(f"{API}/{att['url']}", headers=w.h("mona")).status_code == 404
    own = _upload(w, t["id"], _img(), user="tom").json()["attachments"][0]
    assert w.c.delete(f"{API}/tickets/{t['id']}/attachments/{own['id']}", headers=w.h("tom")).status_code == 200, "within 10 minutes"


def test_paths_are_confined():
    from pathlib import Path

    base = Path("/data")
    for bad in ("../secrets/x.jpg", "abc/../../x.jpg", "abc/0123456789abcdef.png", "/abs/0123456789abcdef.jpg", "abc\\0123456789abcdef.jpg", ""):
        with pytest.raises(ValueError):
            attachments.path_of(base, bad)
    assert attachments.path_of(base, "abc/0123456789abcdef.jpg").name == "0123456789abcdef.jpg"


def test_size_is_never_more_than_eight_megabytes():
    assert attachments.MAX_BYTES == 8 * MB and attachments.MAX_PIXELS == 16_000_000 and attachments.LONG_SIDE == 2048 and attachments.QUALITY == 82
