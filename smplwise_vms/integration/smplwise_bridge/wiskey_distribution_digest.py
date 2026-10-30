"""Canonical complete distribution digest; shared byte-identical in both loaders and installer."""

import hashlib
import json
from pathlib import Path


def files(root):
    root = Path(root)
    rows = []
    for p in sorted(root.rglob("*")):
        rel = p.relative_to(root)
        if (
            "__pycache__" in rel.parts
            or p.suffix == ".pyc"
            or p.name in {".DS_Store", ".smplwise_installed.json"}
        ):
            continue
        if p.is_symlink():
            raise ValueError("component_symlink")
        if p.is_file():
            data = p.read_bytes()
            rows.append(
                {
                    "path": rel.as_posix(),
                    "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                }
            )
        elif not p.is_dir():
            raise ValueError("component_non_regular")
    if not any(r["path"] == "manifest.json" for r in rows):
        raise ValueError("component_manifest_missing")
    return rows


def digest(root):
    return hashlib.sha256(
        json.dumps(files(root), sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


