"""BACKEND-SAFETY-2435 (code review 2026-11-13, P1-06): one containment rule for file paths read from the database.

A backup archive is unsigned, so a restored row can carry any `case_items.file_path` or `sites` / `buildings`
`image_path`. Every place that joins such a stored value to a directory and then reads, serves, copies or deletes the
file goes through `confine` first: the stored value must be a plain relative path, and once resolved (symlinks
included) it must lie strictly under the root. An absolute value never replaces the root (`Path("/x") / "/abs"`).

`restore_path_ok` is the stricter restore-time check: the exact shapes the product itself writes.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

_ID = r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}"  # db.ID_RE without the anchors
# routers/cases.py writes `cases/<case id>/<item id>.jpg`; services/bundle_import.py writes
# `imported/<bundle sha256>/<clips|snapshots>/<name>` (its FILE_RE)
CASE_FILE_RE = re.compile(rf"^(?:cases/{_ID}/{_ID}\.jpg|imported/[0-9a-f]{{64}}/(?:clips|snapshots)/[A-Za-z0-9][A-Za-z0-9._-]{{0,200}})$")
# routers/catalog.py writes `<site|building>-<id>.jpg` inside data/catalog_images
CATALOG_IMAGE_RE = re.compile(rf"^(?:site|building)-{_ID}\.jpg$")
CASE_FILE_ROOTS = ("cases", "imported")

# restore check: (table, column) -> the shape a restored value must have
RESTORE_SHAPES: dict[tuple[str, str], re.Pattern[str]] = {
    ("case_items", "file_path"): CASE_FILE_RE,
    ("sites", "image_path"): CATALOG_IMAGE_RE,
    ("buildings", "image_path"): CATALOG_IMAGE_RE,
}


def _plain_relative(rel: Any) -> bool:
    if not isinstance(rel, str) or not rel or len(rel) > 1024:
        return False
    if rel.startswith(("/", "\\")) or "\\" in rel or ":" in rel or "\x00" in rel:
        return False
    return all(p not in ("", ".", "..") for p in rel.split("/"))


def confine(root: Path, rel: Any, first: tuple[str, ...] | None = None) -> Path | None:
    """The resolved file `root / rel`, or None when `rel` is not a plain relative path or resolves outside `root`.
    `first`: when given, the first path segment must be one of these names."""
    if not _plain_relative(rel):
        return None
    if first is not None and rel.split("/", 1)[0] not in first:
        return None
    base = Path(root).resolve()
    try:
        p = (base / rel).resolve()
    except (OSError, RuntimeError, ValueError):
        return None
    if base not in p.parents:
        return None
    return p


def case_file(data_dir: Path, rel: Any) -> Path | None:
    """A case item's stored file (snapshot or imported copy): under data/cases or data/imported, never elsewhere."""
    return confine(data_dir, rel, CASE_FILE_ROOTS)


def restore_path_ok(data_dir: Path, table: str, column: str, value: Any) -> bool:
    """True when a restored `table.column` value has the shape the product writes and stays inside its root."""
    if value is None:
        return True
    shape = RESTORE_SHAPES[(table, column)]
    if not isinstance(value, str) or shape.fullmatch(value) is None:
        return False
    if table == "case_items":
        return case_file(data_dir, value) is not None
    return confine(Path(data_dir) / "catalog_images", value) is not None
