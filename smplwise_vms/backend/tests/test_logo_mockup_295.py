"""LOGOKIT-295 (was NOTICEPUSH-295 slice L): the SmplWise logo of the PDF reports is the approved developer-kit artwork (the horizontal logo,
brand tone: SW symbol #0062FF, name #0E3054), never the mint PNG of the 2026-09-14 design baseline. Fakes only; WeasyPrint is not
installed in every environment, so the fetcher is driven with a stand-in `weasyprint.urls`."""
from __future__ import annotations

import io
import sys
import types
from pathlib import Path

import pytest
from PIL import Image

from smplwise.services import bill_pdf_engine as eng
from smplwise.services.bill_pdf_html import BRAND_FILE, BRAND_URL

ROOT = Path(__file__).resolve().parents[3]
KIT_BLUE = (0x00, 0x62, 0xFF)
KIT_NAVY = (0x0E, 0x30, 0x54)


def _px(path: Path, x: int, y: int) -> tuple[int, int, int, int]:
    with Image.open(path) as im:
        return im.convert("RGBA").getpixel((x, y))


def _near(a: tuple[int, ...], b: tuple[int, ...], tol: int = 6) -> bool:
    return all(abs(p - q) <= tol for p, q in zip(a, b))


def test_the_bundled_pdf_logo_is_the_kit_artwork_not_the_mint_png():
    p = ROOT / "smplwise_vms/backend/smplwise/assets/bill/brand/smplwise-word.png"
    with Image.open(p) as im:
        assert im.size == (1024, 162) and im.mode == "RGBA"
        rgba = im.convert("RGBA")
    opaque = {px[:3] for px in rgba.get_flattened_data() if px[3] > 250} if hasattr(rgba, "get_flattened_data") else {px[:3] for px in rgba.getdata() if px[3] > 250}
    assert any(_near(c, KIT_BLUE, 2) for c in opaque), "the SW symbol is the kit blue"
    assert any(_near(c, KIT_NAVY, 2) for c in opaque), "the name is the kit navy"
    assert rgba.getpixel((0, 0))[3] == 0, "the picture is transparent around the artwork"
    assert not (ROOT / "frontend/public/brand/smplwise-logo.png").exists(), "the mint PNG stays deleted"


def test_the_pdf_fetcher_serves_exactly_one_brand_file(monkeypatch):
    urls = types.ModuleType("weasyprint.urls")

    class Resp:
        def __init__(self, url, body, headers=None):
            self.url, self.body, self.headers = url, body, headers

    urls.URLFetcherResponse = Resp  # type: ignore[attr-defined]
    pkg = types.ModuleType("weasyprint")
    pkg.urls = urls  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "weasyprint", pkg)
    monkeypatch.setitem(sys.modules, "weasyprint.urls", urls)
    f = eng.LockedFetcher(None)
    got = f.fetch(BRAND_URL)
    assert got.headers["Content-Type"] == "image/png" and Image.open(io.BytesIO(got.body)).size == (1024, 162)
    assert BRAND_FILE == "smplwise-word.png"
    for bad in ("bill-brand:../fonts/Heebo-la-400.ttf", "bill-brand:other.png", "bill-brand:", "file:///etc/passwd", "https://example.com/a.png", "data:image/png;base64,AAAA"):
        with pytest.raises(ValueError):
            f.fetch(bad)
    assert len(f.blocked) == 6
