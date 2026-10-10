"""CRY (2026-10-10): turn the rendered PNGs of scripts/crystal-backgrounds.mjs into the WebP files the product ships
(frontend/public/backgrounds/crystal-{day,night}.webp), each under 250 KB, and print the luminance facts the design record quotes.

    py -3.12 scripts/export_backgrounds.py <png-dir> [--quality 82]

Pillow only (the backend's own image library); no third-party assets are involved at any step."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageStat

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "public" / "backgrounds"
LIMIT = 250 * 1024


def luminance(im: Image.Image) -> tuple[float, float, float]:
    """Mean, 5th and 95th percentile of the relative luminance (0..1) over the picture (a 320 px thumbnail is enough)."""
    small = im.convert("L").resize((320, 180))
    hist = small.histogram()
    total = sum(hist)
    acc = 0
    p5 = p95 = None
    for v, n in enumerate(hist):
        acc += n
        if p5 is None and acc >= total * 0.05:
            p5 = v
        if p95 is None and acc >= total * 0.95:
            p95 = v
    mean = ImageStat.Stat(small).mean[0]
    return mean / 255, (p5 or 0) / 255, (p95 or 0) / 255


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", help="the folder with crystal-day.png / crystal-night.png")
    ap.add_argument("--quality", type=int, default=82)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    ok = True
    for name in ("crystal-day", "crystal-night"):
        im = Image.open(Path(args.src) / f"{name}.png").convert("RGB")
        target = OUT / f"{name}.webp"
        q = args.quality
        while True:
            im.save(target, format="WEBP", quality=q, method=6)
            size = target.stat().st_size
            if size <= LIMIT or q <= 50:
                break
            q -= 4
        mean, p5, p95 = luminance(im)
        print(f"{target.name}: {size} bytes (quality {q}); luminance mean {mean:.2f}, p5 {p5:.2f}, p95 {p95:.2f}")
        ok = ok and size <= LIMIT
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
