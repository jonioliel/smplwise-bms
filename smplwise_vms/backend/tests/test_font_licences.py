"""T005 (DEPAUDIT-2310): every directory of shipped font files carries the SIL OFL text.

The SIL Open Font License 1.1 requires the licence to travel with the fonts. The UI fonts (Heebo, served from
www/fonts), the lobby fonts and the bill PDF fonts (assets/bill/fonts) are all OFL; each directory that holds font files
must hold at least one OFL*.txt file, and every lobby font family must have its own OFL text.

CR-TV-FONTS-ESCAPE-2443 (review 08:F04): the lobby woff2 sources moved from frontend/public/fonts/lobby (Vite copied them
into www, where nothing read them) to frontend/fonts-src/lobby; the TV page gets them inlined in the generated
tv-fonts-<family>.css. The OFL texts stay in frontend/public/fonts/lobby too, so they still ship with the add-on.
"""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
FONT_EXT = {".woff2", ".woff", ".ttf", ".otf"}
FONT_DIRS = [
    REPO / "frontend" / "public" / "fonts",
    REPO / "frontend" / "public" / "fonts" / "lobby",
    REPO / "frontend" / "fonts-src" / "lobby",
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


LOBBY_SRC = REPO / "frontend" / "fonts-src" / "lobby"
LOBBY_OFL = ("OFL-IBMPlexSansHebrew.txt", "OFL-IBMPlexMono.txt", "OFL-FrankRuhlLibre.txt", "OFL-DavidLibre.txt", "OFL-BodoniModa.txt")


def test_lobby_fonts_have_one_ofl_text_per_family_at_the_source_and_in_the_shipped_folder() -> None:
    assert _fonts(LOBBY_SRC), "the lobby woff2 sources are in frontend/fonts-src/lobby"
    for d in (LOBBY_SRC, REPO / "frontend" / "public" / "fonts" / "lobby"):
        for name in LOBBY_OFL:
            assert "SIL OPEN FONT LICENSE" in (d / name).read_text(encoding="utf-8").upper(), f"{d.relative_to(REPO)}/{name}"


def test_lobby_woff2_files_are_not_copied_into_the_built_ui() -> None:
    # everything under frontend/public is copied into www: the lobby fonts reach the TV page inlined, never by their own URL
    assert not _fonts(REPO / "frontend" / "public" / "fonts" / "lobby")


def test_generated_lobby_font_sheets_are_current() -> None:
    import subprocess
    import sys

    script = REPO / "scripts" / "notice_tv_fonts.py"
    got = subprocess.run([sys.executable, str(script), "--check"], capture_output=True, text=True, timeout=120)
    assert got.returncode == 0, got.stdout + got.stderr


def test_each_lobby_face_carries_the_unicode_range_of_its_own_subset() -> None:
    # CR-FE-SMALL-2440: "plex-sans-hebrew-latin-*" (family name contains "hebrew") got the Hebrew range, so Latin letters and
    # digits in Lumen / Axis / Prism were drawn in the fallback (Heebo) and the Plex Latin files drew no glyph.
    import re

    sheets = REPO / "frontend" / "src" / "notice-tv"
    faces = []
    for css in sorted(sheets.glob("tv-fonts-*.css")):
        faces += re.findall(r'font-family: "(\w+)"; font-style: normal; font-weight: ([\d ]+);.*?unicode-range: ([^;]+);', css.read_text(encoding="utf-8"))
    assert faces, "the generated lobby sheets define faces"
    latin = [(fam, wt) for fam, wt, rng in faces if rng.startswith("U+0000-00FF")]
    hebrew = [(fam, wt) for fam, wt, rng in faces if "U+0590-05FF" in rng and not rng.startswith("U+0000")]
    assert len(latin) + len(hebrew) == len(faces)
    # every LobbySans weight has one Hebrew and one Latin face (IBM Plex Sans Hebrew ships both subsets)
    for wt in ("200", "300", "400", "500", "600"):
        assert ("LobbySans", wt) in latin, f"LobbySans {wt} latin"
        assert ("LobbySans", wt) in hebrew, f"LobbySans {wt} hebrew"
    assert sum(1 for fam, _ in latin if fam == "LobbySans") == 5


def test_licence_documents_point_at_the_real_lobby_font_files() -> None:
    # CR-FE-SMALL-2440: after CR-TV-FONTS-ESCAPE-2443 moved the woff2 files, the notices and the dependency audit still named
    # frontend/public/fonts/lobby as their home. Every path a lobby-font row names must exist, and the row names the real sources.
    import re

    docs = (REPO / "THIRD_PARTY_NOTICES.md", REPO / "smplwise_vms" / "THIRD_PARTY_NOTICES.md",
            REPO / "docs" / "security" / "DEPENDENCY_AND_SECRETS_AUDIT.md")
    for doc in docs:
        rows = [ln for ln in doc.read_text(encoding="utf-8").splitlines() if ln.startswith("| Lobby fonts")]
        assert len(rows) == 1, f"{doc.relative_to(REPO)}: one lobby-font row"
        paths = re.findall(r"`((?:frontend|smplwise_vms|docs|scripts)/[^`*]+)`", rows[0])
        assert "frontend/fonts-src/lobby/" in paths, f"{doc.relative_to(REPO)} names the woff2 sources"
        for rel in paths:
            if rel == "smplwise_vms/www/assets/":
                continue  # build output, hashed names
            assert (REPO / rel).exists(), f"{doc.relative_to(REPO)} names a missing path: {rel}"
