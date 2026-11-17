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


# ---------------------------------------------------------------- CR-PATH-CONFINE-2438 (code review 2026-11-13, 05:P2-13, P3-06)
# One containment rule for the module checks that build a path themselves (floor images, bakes, skins, maintenance and ticket
# files, wall photos, bundle import, the public shell assets, the restore writer), and one root per stored file column: a
# restored `plan_versions.image_path` may name only its own plan folder, never a bill, a bake, a ticket photo or a key.

PLAN_SHARED_FOLDERS = ("floor-images", "bakes")  # plans/<name>/ folders that belong to another module, never to a plan asset


def inside(root: Path, candidate: Any) -> Path | None:
    """`candidate` resolved (symlinks and junctions followed, `..` collapsed) when it lies strictly under `root` resolved
    (the root itself is not inside); None otherwise, and when either path cannot be resolved."""
    try:
        base = Path(root).resolve()
        p = Path(candidate).resolve()
    except (OSError, RuntimeError, ValueError, TypeError):
        return None
    return p if base in p.parents else None


def stored_under(data_dir: Path, root: Path, rel: Any) -> Path | None:
    """A stored path relative to the data directory (`confine`'s plain-path rule) that resolves strictly under `root`."""
    p = confine(data_dir, rel)
    return inside(root, p) if p is not None else None


def _row_value(row: Any, key: str) -> Any:
    try:
        return row[key]
    except (KeyError, IndexError, TypeError):
        return None


def plan_asset_dir(data_dir: Path, asset_id: Any) -> Path | None:
    """`plans/<asset id>/` (routers/plans._asset_dir) - only for a plain id that is not a shared plans folder."""
    if not isinstance(asset_id, str) or re.fullmatch(_ID, asset_id) is None or asset_id in PLAN_SHARED_FOLDERS:
        return None
    return Path(data_dir) / "plans" / asset_id


# (table, column) -> the folder that column's file lives in, from the row. The product writes every one of these shapes:
# routers/plans.py (`plans/<asset id>/source.*`, `version-*.png`, `*.stylized.png`), services/floor_images.py, plan_bakes.py,
# routers/energy_billing.py (`energy/bills/<year>/<id>.pdf`) and services/energy_billing.py (`energy/assets/<sha>.png`).
COLUMN_ROOTS: dict[tuple[str, str], Any] = {
    ("plan_assets", "storage_path"): lambda d, row: plan_asset_dir(d, _row_value(row, "id")),
    ("plan_versions", "image_path"): lambda d, row: plan_asset_dir(d, _row_value(row, "asset_id")),
    ("plan_versions", "stylized_path"): lambda d, row: plan_asset_dir(d, _row_value(row, "asset_id")),
    ("floor_images", "path"): lambda d, row: Path(d) / "plans" / "floor-images",
    ("plan_bakes", "path"): lambda d, row: Path(d) / "plans" / "bakes",
    ("energy_bills", "pdf_path"): lambda d, row: Path(d) / "energy" / "bills",
    ("energy_assets", "storage_path"): lambda d, row: Path(d) / "energy" / "assets",
}


def column_file(data_dir: Path, table: str, column: str, row: Any) -> Path | None:
    """The file a stored `table.column` value names, confined to that column's own folder (COLUMN_ROOTS); None when the value
    is empty, not a plain relative path, or resolves anywhere else. The serving routes and the restore use the same rule."""
    root = COLUMN_ROOTS[(table, column)](data_dir, row)
    if root is None:
        return None
    return stored_under(data_dir, root, _row_value(row, column))
