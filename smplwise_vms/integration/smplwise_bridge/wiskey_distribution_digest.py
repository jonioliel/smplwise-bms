"""Versioned portable file-set digest. No host case-fold ordering or path aliases."""

import hashlib
import json
import re
import stat
from pathlib import Path

DIGEST_ALGORITHM = "wiskey-posix-tree-sha256.v1"
_RESERVED = {"CON", "PRN", "AUX", "NUL"} | {
    prefix + str(i) for prefix in ("COM", "LPT") for i in range(1, 10)
}


def canonical_rows(rows):
    """Exact POSIX names, case-sensitive Unicode ordering and compact UTF-8 JSON.

    Case-insensitive aliases are refused, never renamed or used to sort. This
    makes the same accepted file set representable on every supported host.
    """
    result, names, portable = [], set(), set()
    for row in rows:
        if type(row) is not dict or set(row) != {"path", "bytes", "sha256"}:
            raise ValueError("component_row_invalid")
        name = row["path"]
        if type(name) is not str or not name or "\\" in name:
            raise ValueError("component_path_invalid")
        parts = name.split("/")
        if any(
            not part
            or part in {".", ".."}
            or part[-1] in {".", " "}
            or any(ord(c) < 32 or ord(c) == 127 or c in ':*?"<>|' for c in part)
            or part.split(".", 1)[0].upper() in _RESERVED
            for part in parts
        ):
            raise ValueError("component_path_invalid")
        if name in names or name.casefold() in portable:
            raise ValueError("component_path_collision")
        if (
            type(row["bytes"]) is not int
            or row["bytes"] < 0
            or type(row["sha256"]) is not str
            or re.fullmatch("[0-9a-f]{64}", row["sha256"]) is None
        ):
            raise ValueError("component_row_invalid")
        names.add(name)
        portable.add(name.casefold())
        result.append(dict(row))
    return sorted(result, key=lambda row: row["path"])


def files(root):
    root = Path(root)
    if root.is_symlink():
        raise ValueError("component_symlink")
    rows = []
    for p in root.rglob("*"):
        mode = p.lstat().st_mode
        if stat.S_ISLNK(mode):
            raise ValueError("component_symlink")
        if not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
            raise ValueError("component_non_regular")
        rel = p.relative_to(root)
        if (
            "__pycache__" in rel.parts
            or p.suffix == ".pyc"
            or p.name in {".DS_Store", ".smplwise_installed.json"}
        ):
            continue
        if stat.S_ISREG(mode):
            data = p.read_bytes()
            rows.append(
                {
                    "path": rel.as_posix(),
                    "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                }
            )
    rows = canonical_rows(rows)
    if not any(row["path"] == "manifest.json" for row in rows):
        raise ValueError("component_manifest_missing")
    return rows


def digest_rows(rows):
    return hashlib.sha256(
        json.dumps(
            canonical_rows(rows),
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    ).hexdigest()


def digest(root):
    return digest_rows(files(root))


