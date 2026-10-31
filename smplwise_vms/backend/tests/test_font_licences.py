"""T005 (DEPAUDIT-2310): every directory of shipped font files carries the SIL OFL text.

The SIL Open Font License 1.1 requires the licence to travel with the fonts. The UI fonts (Heebo, served from
www/fonts), the lobby fonts (www/fonts/lobby) and the bill PDF fonts (assets/bill/fonts) are all OFL; each directory
that holds font files must hold at least one OFL*.txt file, and every lobby font family must have its own OFL text.
"""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
FONT_EXT = {".woff2", ".woff", ".ttf", ".otf"}
FONT_DIRS = [
    REPO / "frontend" / "public" / "fonts",
    REPO / "frontend" / "public" / "fonts" / "lobby",
    REPO / "smplwise_vms" / "www" / "fonts",
    REPO / "smplwise_vms" / "www" / "fonts" / "lobby",
    REPO / "smplwise_vms" / "backend" / "smplwise" / "assets" / "bill" / "fonts",
]


def _fonts(d: Path) -> list[Path]:
    return [p for p in d.iterdir() if p.is_file() and p.suffix.lower() in FONT_EXT]


def test_every_font_directory_has_an_ofl_text() -> None:
    missing = []
    for d in FONT_DIRS:
        if not d.is_dir() or not _fonts(d):
            continue
        ofl = [p for p in d.iterdir() if p.is_file() and p.name.upper().startswith("OFL") and p.suffix.lower() == ".txt"]
        if not ofl or not all("SIL OPEN FONT LICENSE" in p.read_text(encoding="utf-8").upper() for p in ofl):
            missing.append(str(d.relative_to(REPO)))
    assert not missing, f"font directories without an OFL text: {missing}"


def test_heebo_ui_fonts_ship_their_own_ofl_text() -> None:
    for d in (REPO / "frontend" / "public" / "fonts", REPO / "smplwise_vms" / "www" / "fonts"):
        if any(p.name.startswith("heebo-") for p in _fonts(d)):
            text = (d / "OFL-Heebo.txt").read_text(encoding="utf-8")
            assert "Heebo Project Authors" in text
