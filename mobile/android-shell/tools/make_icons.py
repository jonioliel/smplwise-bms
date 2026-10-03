"""Generate the Android shell's launcher icons from the PWA icons (frontend/public/icons/).

Run from the repository root with the project venv:  <venv-python> mobile/android-shell/tools/make_icons.py
Deterministic (Pillow only); re-run after the PWA icons change and commit the PNGs under
mobile/android-shell/app/src/main/res/. Adapted from the Trusted Web Activity branch's android/tools/make_icons.py; the
shell needs no splash PNG (the Android 12 splash API draws the adaptive foreground) and no notification icon.

- mipmap-*/ic_launcher.png         legacy square icon (API < 26), from arx-512.png (the rounded tile)
- mipmap-*/ic_launcher_round.png   legacy round icon, a circle cut from arx-maskable-512.png (full-bleed tile)
- mipmap-*/ic_launcher_foreground.png  adaptive-icon foreground (108 dp): the white glyph alone, sized into the 66 dp
                                   safe circle; the background is the theme colour (values/colors.xml) and the same
                                   layer serves as the Android 13 themed (monochrome) icon and as the splash icon
"""
from __future__ import annotations

from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
ICONS = ROOT / "frontend" / "public" / "icons"
RES = ROOT / "mobile" / "android-shell" / "app" / "src" / "main" / "res"
DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}


def _save(img: Image.Image, folder: str, name: str) -> None:
    out = RES / folder
    out.mkdir(parents=True, exist_ok=True)
    img.save(out / name, format="PNG", optimize=True)


def _glyph(maskable: Image.Image) -> Image.Image:
    """The white glyph of the maskable icon as white-on-transparent, cropped to its bounding box."""
    rgba = maskable.convert("RGBA")
    # whiteness of each pixel against the blue tile: min(R, G, B) is ~0x2f on the tile and 0xff on the glyph
    r, g, b, _ = rgba.split()
    mins = [min(px) for px in zip(r.tobytes(), g.tobytes(), b.tobytes())]
    tile = Counter(mins).most_common(1)[0][0] + 8  # the tile's own value (the commonest) plus a little noise margin
    span = max(1, 255 - tile)
    alpha = Image.new("L", rgba.size)
    alpha.putdata([max(0, min(255, round((m - tile) * 255 / span))) for m in mins])
    white = Image.new("RGBA", rgba.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    return white.crop(bbox)


def _fit(glyph: Image.Image, canvas_px: int, box_px: float) -> Image.Image:
    """The glyph scaled so its bounding box fits a centred square of box_px, on a transparent canvas."""
    scale = box_px / max(glyph.size)
    w, h = max(1, round(glyph.width * scale)), max(1, round(glyph.height * scale))
    small = glyph.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_px, canvas_px), (255, 255, 255, 0))
    canvas.alpha_composite(small, ((canvas_px - w) // 2, (canvas_px - h) // 2))
    return canvas


def _circle(img: Image.Image, size: int) -> Image.Image:
    big = img.convert("RGBA").resize((size * 4, size * 4), Image.LANCZOS)
    mask = Image.new("L", big.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big.width - 1, big.height - 1), fill=255)
    big.putalpha(mask)
    return big.resize((size, size), Image.LANCZOS)


def main() -> None:
    tile = Image.open(ICONS / "arx-512.png").convert("RGBA")
    maskable = Image.open(ICONS / "arx-maskable-512.png").convert("RGBA")
    glyph = _glyph(maskable)
    for name, k in DENSITIES.items():
        launcher = round(48 * k)
        _save(tile.resize((launcher, launcher), Image.LANCZOS), f"mipmap-{name}", "ic_launcher.png")
        _save(_circle(maskable, launcher), f"mipmap-{name}", "ic_launcher_round.png")
        # adaptive foreground: 108 dp canvas; the glyph's box is at most 46 dp, so even its corners (the glyph is a
        # little taller than wide) stay inside the 66 dp safe circle every launcher mask keeps
        _save(_fit(glyph, round(108 * k), 46 * k), f"mipmap-{name}", "ic_launcher_foreground.png")
    print(f"icons written under {RES.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
