"""Write frontend/public/plan3d/MANIFEST.json - the licence and provenance manifest of the Plan Studio 6 assets
(CR-029 section 6.1, LOOK_SPEC section 13).

The files were downloaded once (2026-10-09, owner-approved list `docs/design/studio6/ASSET_DOWNLOAD_LIST.md`) and
processed by the look-dev tools (`docs/design/mockups/plan-studio-6-prototype/tools/process-textures.mjs`, branch
pilot/ST7-lookdev); the product copies the processed files verbatim. This script never downloads anything: it hashes the
files that are on disk and joins them with the source table below (id, source URL, author, licence, the source archive's
sha256, the processing). Run by a human after adding or replacing an asset:

    python scripts/plan3d_manifest.py          # rewrite the manifest
    python scripts/plan3d_manifest.py --check  # exit 1 when the manifest on disk is not what the files say

frontend/tests/unit-plan3d-assets.spec.ts checks the result against the files (every file has a row, every row a file,
the hashes match, every licence is in the allowed set).
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "frontend" / "public" / "plan3d"
OUT = DIR / "MANIFEST.json"

CC0 = "CC0-1.0"
DOWNLOADED = "2026-10-09"
AMBIENTCG = "https://ambientcg.com/get?file={}_1K-JPG.zip"
KENNEY = "https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip"

# the source archives (sha256 of the download, before unpacking) - LICENSES.md of the prototype
SETS: dict[str, str] = {
    "Plaster001": "944b4831016e42ace4a89422e4e7190912ca2f7fed6f561354c48ec7bb54d3a4",
    "Plaster003": "3a47249643273c82c53d8d31c9caef43aec940a4c926cf0c74858a8e96631bf1",
    "Concrete034": "5839d284d94ffb8d2a56df742ec522b13dd311c52dbd42b8fd33f0409ceedb81",
    "Bricks059": "847dd2e4932563bbb67fdc2bad3cc08db72d74b3e81d242f31b663d8a3ea744b",
    "Tiles074": "28a40cb36d3c265f17c798c52aa3ea7cdcb8c949b80c49692b0a855e9637c677",
    "WoodFloor051": "3f493484eab1ec5e1c466b90e515003b286fc6d7f84ff8ff6485900bfc26cef5",
    "Tiles101": "8f877d511a00b905ae239ada8454d84de097704e8716acd7802150522127a1bf",
    "Carpet013": "77254e2877771524423a6ef8ce2e61aa3ec42ee5962d81d9b328a258afed7e1e",
    "Asphalt012": "c077e5d1b21a4333829bb655043ee6a45ddcf82fef850528f91f4305ac11193d",
    "Grass004": "4b63495f459db8481f4d5144e4e9069345c81cf898cc71f2216f5dd3bb344469",
    "Wood049": "74ec51bcf5ddfc2e9af6205dc5cbcc90ad51c22117e013ff8b1c7258f8ecbc69",
    "Metal032": "9e4f363905a647958c273154fa125d2a6440892d0e583f9b3af24bb08b5afc3c",
    "Fabric030": "82d4d00ccf901cf4707c5489005945ab8574933fc60437e26c6737f0436699e0",
    "Fabric024": "098a5f496cc67a4042e6394a950bee52d303740bc63d431e172d3cb49e4428da",
    "Leather011": "e499febfd8b696cec89eff289fc85d7735440c0d4862171104974b3a04b8cc1d",
    "WoodFloor040": "c83a01f1733f2a1f6e95ad6703689eb12fe259e77245d4c0a5652728d07c87cb",
}
KENNEY_SHA = "e67652d0932cee41683f74711c03d3e192a2af9979ef8e6b237711f5482d46b0"
# material id -> (set, mid, amp): the luminance target of the hue-free colour map (tools/texture-manifest.json)
COLOR: dict[str, tuple[str, int, int]] = {
    "plaster_white": ("Plaster001", 214, 7), "plaster_exterior": ("Plaster003", 210, 12), "concrete": ("Concrete034", 200, 30),
    "brick_painted": ("Bricks059", 205, 30), "tiles_white": ("Tiles074", 206, 22), "oak": ("WoodFloor051", 196, 46),
    "tiles_grey": ("Tiles101", 206, 22), "carpet": ("Carpet013", 200, 26), "asphalt": ("Asphalt012", 200, 30),
    "grass": ("Grass004", 205, 40), "wood_light": ("Wood049", 200, 28), "wood_dark": ("Wood049", 200, 28),
    "door_wood": ("Wood049", 200, 30), "metal_dark": ("Metal032", 215, 10), "metal_light": ("Metal032", 215, 10),
    "fabric_grey": ("Fabric030", 200, 26), "fabric_accent": ("Fabric030", 200, 26), "fabric_rug": ("Fabric030", 200, 26),
    "linen": ("Fabric024", 200, 22), "leather": ("Leather011", 205, 22), "floor_sport": ("WoodFloor040", 196, 40),
}
PROCESS_COLOR = ("tools/process-textures.mjs (pilot/ST7-lookdev): ambientCG Color 1024 px -> 512 px, luminance only, mean "
                 "pulled to `mid`, two standard deviations mapped onto `amp` (hue-free: the style palette is the colour); WebP q85")
PROCESS_NORMAL = "tools/process-textures.mjs: ambientCG NormalGL 1024 px -> 512 px, JPEG q92"
PROCESS_RAO = ("tools/process-textures.mjs: ambientCG Roughness (+ AmbientOcclusion where the set has one) 1024 px -> 512 px "
               "packed R = AO (255 without one), G = roughness, B = 255; JPEG q90")
PROCESS_MODEL = "copied verbatim from `Models/GLTF format/` of the kit (no Draco, no KTX2, no embedded images); material slots replaced by the style palette at load"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rows() -> list[dict]:
    out: list[dict] = []
    for f in sorted(p for p in DIR.rglob("*") if p.is_file() and p.name != "MANIFEST.json"):
        rel = f.relative_to(DIR).as_posix()
        parts = rel.split("/")
        row: dict = {"path": rel, "bytes": f.stat().st_size, "sha256": sha256(f), "licence": CC0, "downloaded": DOWNLOADED}
        if parts[0] == "textures" and parts[1] == "sets":
            s = parts[2]
            row.update(kind="texture-set", id=s, map=parts[3].split(".")[0], author="ambientCG (Lennart Demes)",
                       source_url=AMBIENTCG.format(s), source_sha256=SETS[s], processing=PROCESS_NORMAL if parts[3].startswith("normal") else PROCESS_RAO)
        elif parts[0] == "textures":
            mid = parts[1]
            s, m, a = COLOR[mid]
            row.update(kind="texture-color", id=mid, set=s, mid=m, amp=a, author="ambientCG (Lennart Demes)",
                       source_url=AMBIENTCG.format(s), source_sha256=SETS[s], processing=PROCESS_COLOR)
        elif parts[0] == "models":
            row.update(kind="model", id=parts[1].rsplit(".", 1)[0], author="Kenney (www.kenney.nl), Furniture Kit 2.0",
                       source_url=KENNEY, source_sha256=KENNEY_SHA, processing=PROCESS_MODEL)
        elif parts[0] == "LICENSES.md":
            continue
        else:
            raise SystemExit(f"plan3d: no source row for {rel} - add it to scripts/plan3d_manifest.py first")
        out.append(row)
    return out


def manifest() -> dict:
    return {
        "format": "plan3d-assets-1",
        "description": "CR-029 section 6.1 / LOOK_SPEC section 13: every Plan Studio 6 asset file with its source, author, licence, "
                       "source archive hash, processing and its own sha256. Written by scripts/plan3d_manifest.py; checked by "
                       "frontend/tests/unit-plan3d-assets.spec.ts. Allowed licences: CC0-1.0 only (owner Q6).",
        "allowed_licences": [CC0],
        "files": rows(),
    }


def main() -> int:
    text = json.dumps(manifest(), ensure_ascii=False, indent=1) + "\n"
    if "--check" in sys.argv:
        ok = OUT.exists() and OUT.read_text(encoding="utf-8") == text
        print("plan3d manifest " + ("matches the files" if ok else "is out of date: run scripts/plan3d_manifest.py"))
        return 0 if ok else 1
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(manifest()['files'])} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
