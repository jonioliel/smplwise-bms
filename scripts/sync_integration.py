"""Mirror the SMPLWISE Bridge integration into the add-on build context.

The canonical source is `custom_components/smplwise_bridge/` at the repository root (what HACS and Home
Assistant expect). The Supervisor builds the add-on image from `smplwise_vms/` only, so the same files are
mirrored to `smplwise_vms/integration/smplwise_bridge/` and copied into the image. Run this after editing
the integration; `--check` exits 1 when the mirror is stale (the backend test suite runs the same check).
"""
from __future__ import annotations

import filecmp
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "custom_components" / "smplwise_bridge"
DST = ROOT / "smplwise_vms" / "integration" / "smplwise_bridge"
README_TEXT = (
    "Generated mirror of `custom_components/smplwise_bridge` for the add-on image (the Supervisor builds from\n"
    "`smplwise_vms/` only). Edit the source at the repository root and run `python scripts/sync_integration.py`.\n"
    "\n"
    "`hikvision_intercom/` is NOT generated: it is the WisKey component, byte-exact to the delivered managed ZIP (since\n"
    "WISKEY-MANAGED-INSTALL-2382: `WISKEY_ARX_MANAGED_2.0.1-rc.10.zip`), with its pin (`hikvision_intercom.pin.json`) and WisKey's\n"
    "`MANAGED_MANIFEST.json` (`hikvision_intercom.managed_manifest.json`). Never edit them by hand.\n"
)
IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store")


def differences() -> list[str]:
    if not DST.is_dir():
        return ["<mirror missing>"]
    out: list[str] = []

    def walk(a: Path, b: Path, rel: str = "") -> None:
        cmp = filecmp.dircmp(a, b, ignore=["__pycache__", ".DS_Store"])
        out.extend(f"{rel}{n} (only in source)" for n in cmp.left_only if not n.endswith(".pyc"))
        out.extend(f"{rel}{n} (only in mirror)" for n in cmp.right_only if not n.endswith(".pyc"))
        out.extend(f"{rel}{n} (differs)" for n in cmp.diff_files)
        for sub in cmp.common_dirs:
            walk(a / sub, b / sub, f"{rel}{sub}/")

    walk(SRC, DST)
    return out


def sync() -> None:
    if DST.exists():
        shutil.rmtree(DST)
    shutil.copytree(SRC, DST, ignore=IGNORE)
    (DST.parent / "README.md").write_bytes(README_TEXT.encode("utf-8"))  # bytes: LF on every platform (.gitattributes enforces LF)


if __name__ == "__main__":
    if "--check" in sys.argv:
        diff = differences()
        if diff:
            print("integration mirror is stale:\n  " + "\n  ".join(diff))
            sys.exit(1)
        print("integration mirror is up to date")
    else:
        sync()
        print(f"mirrored {sum(1 for p in DST.rglob('*') if p.is_file())} files to {DST.relative_to(ROOT)}")
