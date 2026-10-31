"""DEPAUDIT-2310 M1: every decode of uploaded / fetched image bytes names the formats it accepts (image_guard.open_untrusted), and the
format Pillow actually picked is checked as well. A TIFF (or any other format) behind a JPEG signature is refused everywhere. An MPO
(multi-picture JPEG, as many phones save camera photos under a .jpg name) is accepted on the paths that take photos, as its primary
picture only, re-encoded as a single-frame JPEG; the non-photo JPEG paths (camera frames, plan bakes) keep refusing it."""
from __future__ import annotations

from io import BytesIO

import pytest
from conftest import seed_tree
from fastapi.testclient import TestClient
from PIL import Image, UnidentifiedImageError

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import bill_pdf_logo, camera_image_health, floor_images, image_guard, plan_bakes, plan_render

FIRST, SECOND = (200, 40, 40), (40, 200, 40)


def _img(fmt: str, size: tuple[int, int] = (400, 300), **kw) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, (40, 120, 200)).save(buf, format=fmt, **kw)
    return buf.getvalue()


def _mpo(size: tuple[int, int] = (400, 300)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, FIRST).save(buf, format="MPO", save_all=True, append_images=[Image.new("RGB", size, SECOND)])
    data = buf.getvalue()
    assert data.startswith(b"\xff\xd8\xff"), "an MPO carries the plain JPEG magic bytes"
    return data


def _disguised_tiff(size: tuple[int, int] = (400, 300)) -> bytes:
    return b"\xff\xd8\xff" + _img("TIFF", size)  # a TIFF behind a forged JPEG signature


def _single_frame_jpeg(data: bytes) -> Image.Image:
    im = Image.open(BytesIO(data))  # unrestricted on purpose: what would any reader make of the stored file
    assert im.format == "JPEG" and getattr(im, "n_frames", 1) == 1, (im.format, getattr(im, "n_frames", 1))
    assert b"MPF\x00" not in data, "no MPF index left"
    return im


def _close(px, want, tol=12) -> bool:
    return all(abs(a - b) <= tol for a, b in zip(px[:3], want))


def test_the_fixtures_are_what_they_claim():
    with Image.open(BytesIO(_mpo())) as im:  # unrestricted, Pillow picks the MPO plugin itself
        assert im.format == "MPO" and im.n_frames == 2
    with Image.open(BytesIO(_img("TIFF"))) as im:
        assert im.format == "TIFF"


def test_open_untrusted_accepts_the_named_formats():
    with image_guard.open_untrusted(_img("JPEG"), ["JPEG"]) as im:
        assert im.format == "JPEG" and im.size == (400, 300) and im.arx_mpo_first_frame is False
    with image_guard.open_untrusted(_img("PNG"), ("PNG", "JPEG")) as im:
        assert im.format == "PNG"


@pytest.mark.parametrize("formats", [["JPEG"], ["PNG", "JPEG"], ["PNG", "JPEG", "WEBP"]])
def test_open_untrusted_refuses_a_tiff_always_and_an_mpo_by_default(formats):
    for mpo_ok in (False, True):
        with pytest.raises(UnidentifiedImageError):
            image_guard.open_untrusted(_img("TIFF"), formats, mpo_first_frame=mpo_ok)
        with pytest.raises((UnidentifiedImageError, OSError)):
            image_guard.open_untrusted(_disguised_tiff(), formats, mpo_first_frame=mpo_ok)
    with pytest.raises(UnidentifiedImageError):
        image_guard.open_untrusted(_mpo(), formats)


def test_open_untrusted_reads_an_mpo_as_its_first_frame_only(tmp_path):
    with image_guard.open_untrusted(_mpo(), ["PNG", "JPEG"], mpo_first_frame=True) as im:
        assert im.format == "JPEG" and im.arx_mpo_first_frame is True and getattr(im, "n_frames", 1) == 1
        assert _close(im.convert("RGB").getpixel((10, 10)), FIRST)
    p = tmp_path / "phone.jpg"
    p.write_bytes(_mpo())
    with image_guard.open_untrusted(p, ["JPEG"], mpo_first_frame=True) as im:  # by path too
        assert im.format == "JPEG" and _close(im.convert("RGB").getpixel((10, 10)), FIRST)
    with pytest.raises(UnidentifiedImageError):  # only where JPEG itself is allowed
        image_guard.open_untrusted(_mpo(), ["PNG"], mpo_first_frame=True)


def test_the_photo_paths_take_an_mpo_as_a_single_frame_jpeg(tmp_path):
    mpo = _mpo((800, 600))
    mime, w, h, stored = floor_images.validate_and_clean(mpo)
    assert (mime, w, h) == ("image/jpeg", 800, 600) and stored != mpo
    assert _close(_single_frame_jpeg(stored).convert("RGB").getpixel((10, 10)), FIRST)
    good = _img("JPEG", (800, 600))
    assert floor_images.validate_and_clean(good) == ("image/jpeg", 800, 600, good), "a plain JPEG is stored as it came"
    png = bill_pdf_logo.sanitize_logo(mpo)
    with Image.open(BytesIO(png)) as im:
        assert im.format == "PNG" and _close(im.convert("RGB").getpixel((10, 10)), FIRST)
    mime, pic = bill_pdf_logo.sanitize_image(mpo, max_bytes=1 << 22, max_side=800)
    assert mime == "image/jpeg" and _close(_single_frame_jpeg(pic).convert("RGB").getpixel((10, 10)), FIRST)
    src = tmp_path / "plan.jpg"
    src.write_bytes(mpo)
    plan_render.normalize_image(src, tmp_path / "out.png", 1600)
    with Image.open(tmp_path / "out.png") as im:
        assert im.format == "PNG" and im.size == (800, 600)


def test_the_photo_paths_refuse_a_disguised_tiff(tmp_path):
    bad = _disguised_tiff((800, 600))
    with pytest.raises(floor_images.FloorImageError) as e:
        floor_images.validate(bad)
    assert e.value.code == "corrupt_image"
    with pytest.raises(bill_pdf_logo.LogoError):
        bill_pdf_logo.sanitize_logo(bad)
    src = tmp_path / "plan.jpg"
    src.write_bytes(bad)
    with pytest.raises((UnidentifiedImageError, OSError)):
        plan_render.normalize_image(src, tmp_path / "out.png", 1600)
    assert not (tmp_path / "out.png").exists()


def test_the_non_photo_jpeg_paths_still_refuse_an_mpo():
    mpo = _mpo((800, 600))
    with pytest.raises(ApiError) as e:
        camera_image_health.decode(mpo)
    assert e.value.code == "decode_failed"
    with pytest.raises(plan_bakes.BakeError) as e:
        plan_bakes._decode(mpo, "image/jpeg")
    assert e.value.code == "corrupt_image"
    assert camera_image_health.decode(_img("JPEG", (800, 600))).ndim == 2


def test_the_catalog_photo_upload_stores_an_mpo_as_a_single_frame_jpeg(settings):
    with TestClient(create_app(settings)) as c:
        seed_tree(c)
        site = c.get("/api/v1/sites?tree=true").json()["sites"][0]
        r = c.post(f"/api/v1/sites/{site['id']}/image", files={"file": ("phone.jpg", _mpo(), "image/jpeg")})
        assert r.status_code == 200, r.text
        got = c.get(f"/api/v1/catalog/images/site/{site['id']}")
        assert got.status_code == 200 and got.headers["content-type"] == "image/jpeg"
        assert _close(_single_frame_jpeg(got.content).convert("RGB").getpixel((10, 10)), FIRST)
        r = c.post(f"/api/v1/sites/{site['id']}/image", files={"file": ("x.jpg", _disguised_tiff(), "image/jpeg")})
        assert r.status_code == 422 and r.json()["code"] == "corrupt_image", r.text
