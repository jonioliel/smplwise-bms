"""DEPAUDIT-2310 M1: every decode of uploaded / fetched image bytes names the formats it accepts (image_guard.open_untrusted), and the
format Pillow actually picked is checked as well - an MPO (multi-picture JPEG, JPEG magic bytes) or a TIFF sent as a JPEG is refused,
never handed to the MPO / TIFF loaders."""
from __future__ import annotations

from io import BytesIO

import pytest
from conftest import seed_tree
from fastapi.testclient import TestClient
from PIL import Image, UnidentifiedImageError

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import bill_pdf_logo, camera_image_health, floor_images, image_guard, plan_bakes, plan_render


def _img(fmt: str, size: tuple[int, int] = (400, 300), **kw) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, (40, 120, 200)).save(buf, format=fmt, **kw)
    return buf.getvalue()


def _mpo(size: tuple[int, int] = (400, 300)) -> bytes:
    buf = BytesIO()
    first, second = Image.new("RGB", size, (200, 40, 40)), Image.new("RGB", size, (40, 200, 40))
    first.save(buf, format="MPO", save_all=True, append_images=[second])
    data = buf.getvalue()
    assert data.startswith(b"\xff\xd8\xff"), "an MPO carries the plain JPEG magic bytes"
    return data


def test_the_fixtures_are_what_they_claim():
    with Image.open(BytesIO(_mpo())) as im:  # unrestricted, Pillow picks the MPO plugin itself
        assert im.format == "MPO" and im.n_frames == 2
    with Image.open(BytesIO(_img("TIFF"))) as im:
        assert im.format == "TIFF"


def test_open_untrusted_accepts_the_named_formats():
    with image_guard.open_untrusted(_img("JPEG"), ["JPEG"]) as im:
        assert im.format == "JPEG" and im.size == (400, 300)
    with image_guard.open_untrusted(_img("PNG"), ("PNG", "JPEG")) as im:
        assert im.format == "PNG"


@pytest.mark.parametrize("formats", [["JPEG"], ["PNG", "JPEG"], ["PNG", "JPEG", "WEBP"]])
def test_open_untrusted_refuses_an_mpo_and_a_tiff_disguised_as_jpeg(formats):
    with pytest.raises(UnidentifiedImageError):
        image_guard.open_untrusted(_mpo(), formats)
    with pytest.raises(UnidentifiedImageError):
        image_guard.open_untrusted(_img("TIFF"), formats)


def test_the_upload_paths_refuse_an_mpo(tmp_path):
    mpo, tiff = _mpo((800, 600)), _img("TIFF", (800, 600))
    for bad in (mpo, tiff):
        with pytest.raises(floor_images.FloorImageError) as e:
            floor_images.validate(bad if bad is mpo else b"\xff\xd8\xff" + bad)  # the TIFF behind a forged JPEG signature
        assert e.value.code == "corrupt_image"
    with pytest.raises(ApiError) as e:
        camera_image_health.decode(mpo)
    assert e.value.code == "decode_failed"
    with pytest.raises(plan_bakes.BakeError) as e:
        plan_bakes._decode(mpo, "image/jpeg")
    assert e.value.code == "corrupt_image"
    with pytest.raises(bill_pdf_logo.LogoError):
        bill_pdf_logo.sanitize_logo(mpo)
    with pytest.raises(bill_pdf_logo.LogoError):
        bill_pdf_logo.sanitize_image(mpo, max_bytes=1 << 22, max_side=800)
    src = tmp_path / "plan.jpg"
    src.write_bytes(mpo)
    with pytest.raises(UnidentifiedImageError):
        plan_render.normalize_image(src, tmp_path / "out.png", 1600)
    assert not (tmp_path / "out.png").exists()
    # a plain JPEG still goes through each of them
    good = _img("JPEG", (800, 600))
    assert floor_images.validate(good) == ("image/jpeg", 800, 600)
    assert camera_image_health.decode(good).ndim == 2
    plan_render.normalize_image(_write(tmp_path / "ok.jpg", good), tmp_path / "ok.png", 1600)
    assert (tmp_path / "ok.png").exists()


def _write(path, data: bytes):
    path.write_bytes(data)
    return path


def test_the_catalog_photo_upload_refuses_an_mpo(settings):
    with TestClient(create_app(settings)) as c:
        seed_tree(c)
        site = c.get("/api/v1/sites?tree=true").json()["sites"][0]
        r = c.post(f"/api/v1/sites/{site['id']}/image", files={"file": ("x.jpg", _mpo(), "image/jpeg")})
        assert r.status_code == 422 and r.json()["code"] == "corrupt_image", r.text
        r = c.post(f"/api/v1/sites/{site['id']}/image", files={"file": ("x.jpg", _img("JPEG"), "image/jpeg")})
        assert r.status_code == 200, r.text
