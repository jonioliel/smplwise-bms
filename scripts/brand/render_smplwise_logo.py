"""NOTICEPUSH-295 slice L: renders the raster files of the approved SmplWise logo (logos-mockup-v3.html: #sw-mark, #sw-word, #sw-word-dark)
from the ONE artwork constant in frontend/src/design/sw-logo-art.ts (SW_MARK_INNER), so a raster can never drift from the inline SVG.

    py -3.12 scripts/brand/render_smplwise_logo.py          # writes the files listed in OUTPUTS, prints their sizes

Needs Pillow and PyMuPDF (both are in the backend requirements). The mark (tile, S stroke, dot) is rendered by MuPDF from the SVG; the
word "Smpl" + "Wise" is set with the bundled Heebo 700 (smplwise_vms/backend/smplwise/assets/bill/fonts/Heebo-la-700.ttf; 700 is the heaviest
weight the application ships, the mockup asks for 800) at the mockup's size 34 / letter-spacing -1 on its 236 x 64 grid. Light: "Smpl" grey
#5e6d88, "Wise" #2767ed. Dark: "Smpl" #ffffff, "Wise" #8fb2ff. Transparent background."""
from __future__ import annotations

import re
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ART = (ROOT / "frontend/src/design/sw-logo-art.ts").read_text(encoding="utf-8")
MARK_INNER = re.search(r"SW_MARK_INNER =\s*'(.*?)';", ART, re.S).group(1)  # type: ignore[union-attr]
FONT = ROOT / "smplwise_vms/backend/smplwise/assets/bill/fonts/Heebo-la-700.ttf"

LIGHT = ("#5e6d88", "#2767ed")
DARK = ("#ffffff", "#8fb2ff")

OUTPUTS = {
    "frontend/public/brand/smplwise-mark.png": ("mark", None, 4),
    "smplwise_vms/backend/smplwise/assets/bill/brand/smplwise-word.png": ("word", LIGHT, 4),
}


def render_mark(scale: int) -> Image.Image:
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">{MARK_INNER}</svg>'.encode()
    doc = pymupdf.open(stream=svg, filetype="svg")
    pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=True)
    return Image.frombytes("RGBA", (pix.width, pix.height), pix.samples)


def render_word(colors: tuple[str, str], scale: int) -> Image.Image:
    img = Image.new("RGBA", (236 * scale, 64 * scale), (0, 0, 0, 0))
    img.alpha_composite(render_mark(scale), (0, 0))
    font = ImageFont.truetype(str(FONT), 34 * scale)
    draw = ImageDraw.Draw(img)
    x, base = 76 * scale, 45 * scale
    for ch, col in [(c, colors[0]) for c in "Smpl"] + [(c, colors[1]) for c in "Wise"]:
        draw.text((x, base), ch, font=font, fill=col, anchor="ls")
        x += font.getlength(ch) - 1 * scale  # letter-spacing -1 on the 236 grid
    return img


def main() -> None:
    for rel, (kind, colors, scale) in OUTPUTS.items():
        out = ROOT / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        img = render_mark(scale) if kind == "mark" else render_word(colors, scale)  # type: ignore[arg-type]
        img.save(out, optimize=True)
        print(f"{rel}: {img.size[0]}x{img.size[1]}, {out.stat().st_size} bytes")
    svg = ROOT / "frontend/public/brand/smplwise-mark.svg"
    svg.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{MARK_INNER}</svg>\n', encoding="utf-8", newline="\n")
    print(f"frontend/public/brand/smplwise-mark.svg: {svg.stat().st_size} bytes")


if __name__ == "__main__":
    main()
