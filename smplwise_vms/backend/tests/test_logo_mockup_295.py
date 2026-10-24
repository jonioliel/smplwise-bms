"""NOTICEPUSH-295 slice L: the SmplWise logo of the PDF reports and of the bundled rasters is the approved mockup artwork (blue tile mark
#2767ed, "Smpl" grey / white, "Wise" #2767ed / #8fb2ff), never the mint PNG of the 2026-09-14 design baseline. Fakes only; WeasyPrint is not
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
TILE_BLUE = (0x27, 0x67, 0xED)


def _px(path: Path, x: int, y: int) -> tuple[int, int, int, int]:
    with Image.open(path) as im:
        return im.convert("RGBA").getpixel((x, y))


def _near(a: tuple[int, ...], b: tuple[int, ...], tol: int = 6) -> bool:
    return all(abs(p - q) <= tol for p, q in zip(a, b))


def test_the_bundled_rasters_are_the_mockup_artwork_not_the_mint_png():
    mark = ROOT / "frontend/public/brand/smplwise-mark.png"
    with Image.open(mark) as im:
        assert im.size == (256, 256) and im.mode == "RGBA"
    assert _near(_px(mark, 30, 128)[:3], TILE_BLUE), "the tile is the mockup blue"
    assert _px(mark, 2, 2)[3] == 0, "the tile's corner is rounded and transparent"
    for rel, scale in (("smplwise_vms/backend/smplwise/assets/bill/brand/smplwise-word.png", 4),):
        p = ROOT / rel
        with Image.open(p) as im:
            assert im.size == (236 * scale, 64 * scale), rel
        assert _near(_px(p, 8 * scale, 32 * scale)[:3], TILE_BLUE), rel


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
    assert got.headers["Content-Type"] == "image/png" and Image.open(io.BytesIO(got.body)).size == (944, 256)
    assert BRAND_FILE == "smplwise-word.png"
    for bad in ("bill-brand:../fonts/Heebo-la-400.ttf", "bill-brand:other.png", "bill-brand:", "file:///etc/passwd", "https://example.com/a.png", "data:image/png;base64,AAAA"):
        with pytest.raises(ValueError):
            f.fetch(bad)
    assert len(f.blocked) == 6
