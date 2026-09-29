"""Import of an evidence bundle (T050): a bundle made by another installation (or by this one, earlier) becomes a NEW
case here, marked `imported`, after it verified cleanly. What an imported bundle may do - and what it may not:

- it may add one case with read-only items: notes (copied text), clips and snapshots (copies of the verified files,
  stored under <data>/imported/<bundle sha256>/ with the manifest and its signature for provenance) and bookmarks
  that were never preserved at the source (no file, the window and the source camera's NAME only);
- it never becomes a camera, an event, a plan, a user, a binding or a setting; no id from the bundle is used as a
  reference into this installation's tables, no file name from it reaches the disk unless it matches a strict
  allow-list, and nothing in it is executed or rendered (report.html and notes.md are hashed, never served);
- the same bundle (by the SHA-256 of the ZIP) is imported at most once while its case exists; the imported bytes
  count in the storage screen and are removed with the case."""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import secrets
import shutil
import sqlite3
import time
import zipfile
from pathlib import Path
from typing import Any

from ..config import Settings
from . import bundle as bundle_svc
from . import signing

FILE_RE = re.compile(r"^(clips|snapshots)/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$")
PROVENANCE_FILES = ("manifest.json", "MANIFEST.sha256", signing.SIG_NAME)
KINDS = ("event", "clip", "note", "snapshot")
MAX_ITEMS = 5000
STAGING_MAX_AGE_S = 6 * 3600


def imported_root(settings: Settings) -> Path:
    return settings.data_dir / "imported"


def staging_root(settings: Settings) -> Path:
    p = imported_root(settings) / ".staging"
    p.mkdir(parents=True, exist_ok=True)
    return p


def case_dir(settings: Settings, bundle_sha: str) -> Path:
    if not bundle_svc.SHA_RE.match(bundle_sha or ""):
        raise ValueError("not a sha256")
    return imported_root(settings) / bundle_sha


def sweep_staging(settings: Settings, max_age_s: float = STAGING_MAX_AGE_S) -> int:
    """Remove upload / extraction leftovers of a crashed request (older than max_age_s). Returns entries removed."""
    root = imported_root(settings) / ".staging"
    if not root.is_dir():
        return 0
    n = 0
    cutoff = time.time() - max_age_s
    for p in root.iterdir():
        try:
            if p.stat().st_mtime > cutoff:
                continue
            shutil.rmtree(p) if p.is_dir() else p.unlink()
            n += 1
        except OSError:
            pass
    return n


def dir_size(p: Path) -> int:
    total = 0
    if not p.exists():
        return 0
    for root, _dirs, files in os.walk(p):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


def local_usage(settings: Settings, conn: sqlite3.Connection) -> dict[str, Any]:
    """The add-on's own disk (/data) as the storage screen shows it: free / total and what the product stores there.
    Imported evidence is counted per imported case (their folders), so deleting a case frees exactly that."""
    out: dict[str, Any] = {"total_bytes": None, "free_bytes": None}
    try:
        du = shutil.disk_usage(settings.data_dir)
        out["total_bytes"], out["free_bytes"] = du.total, du.free
    except OSError:
        pass
    rows = conn.execute("SELECT import_sha256 FROM cases WHERE origin = 'imported' AND import_sha256 IS NOT NULL").fetchall()
    imported = sum(dir_size(case_dir(settings, r[0])) for r in rows if bundle_svc.SHA_RE.match(r[0] or ""))
    out["imported"] = {"cases": len(rows), "bytes": imported}
    out["exports_bytes"] = dir_size(settings.data_dir / "exports")
    out["cases_bytes"] = dir_size(settings.data_dir / "cases")  # snapshots and the bundles built here
    return out


def free_bytes(settings: Settings) -> int:
    """Free space of the data directory (where SQLite lives too); a test seam."""
    return shutil.disk_usage(settings.data_dir).free


def detach_case_files(settings: Settings, bundle_sha: str | None) -> Path | None:
    """Move an imported case's folder into the staging area (a rename: call it under the write lock, after checking
    that no case row refers to the hash any more), so a concurrent re-import of the same bundle can never lose its new
    files to this deletion. The caller removes the returned folder outside the lock (sweep_staging catches leftovers)."""
    if not bundle_sha or not bundle_svc.SHA_RE.match(bundle_sha):
        return None
    d = case_dir(settings, bundle_sha)
    if not d.exists():
        return None
    trash = staging_root(settings) / f"trash-{secrets.token_hex(8)}"
    d.rename(trash)
    return trash


def _ts(value: Any) -> str | None:
    return bundle_svc._ts(value)


def _s(value: Any, n: int = 200) -> str | None:
    return bundle_svc._s(value, n)


def files_to_store(manifest: dict[str, Any]) -> dict[str, str]:
    """The listed files that are copied into this installation: clips (with their export manifests) and snapshots,
    whose names pass the allow-list. {path: sha256}. report.html and notes.md stay inside the manifest's hashes."""
    out: dict[str, str] = {}
    for f in manifest.get("files") or []:
        if isinstance(f, dict) and isinstance(f.get("path"), str) and FILE_RE.match(f["path"]) and bundle_svc.SHA_RE.match(str(f.get("sha256"))):
            out[f["path"]] = f["sha256"]
    return out


def extract(zip_path: Path, wanted: dict[str, str], dest: Path) -> dict[str, dict[str, Any]]:
    """Copy the wanted entries (already verified) and the provenance files into `dest`, re-hashing while copying;
    a hash that differs now raises ValueError (the temp file changed under us). Names come from the allow-list only."""
    stored: dict[str, dict[str, Any]] = {}
    dest.mkdir(parents=True, exist_ok=True)
    root = dest.resolve()
    with zipfile.ZipFile(zip_path) as z:
        names = set(z.namelist())
        todo = [(p, s) for p, s in wanted.items() if p in names] + [(p, None) for p in PROVENANCE_FILES if p in names]
        for path, sha in todo:
            target = (dest / path).resolve()
            if root not in target.parents:
                raise ValueError(f"unsafe target for {path}")
            target.parent.mkdir(parents=True, exist_ok=True)
            with open(target, "wb") as out:
                actual, n = bundle_svc.hash_member(z, path, out)
            if sha is not None and actual != sha:
                raise ValueError(f"hash changed during import: {path}")
            stored[path] = {"sha256": actual, "bytes": n}
    return stored


def plan_items(manifest: dict[str, Any], stored: dict[str, dict[str, Any]], bundle_sha: str, source_iid: str | None) -> list[dict[str, Any]]:
    """The case items an imported manifest becomes. No camera, event or user reference survives: the source camera is
    a name, the event a short description, the author a name - all inside origin_json."""
    rows: list[dict[str, Any]] = []
    items = manifest.get("items") if isinstance(manifest.get("items"), list) else []
    for idx, it in enumerate(items[:MAX_ITEMS]):
        if not isinstance(it, dict) or it.get("kind") not in KINDS:
            continue
        kind = it["kind"]
        f = it.get("file") if isinstance(it.get("file"), dict) else None
        path = f.get("path") if f else None
        in_bundle = bool(f)
        file_path = file_sha = None
        if kind != "note" and isinstance(path, str) and path in stored:
            file_path, file_sha = f"imported/{bundle_sha}/{path}", stored[path]["sha256"]
        ev = it.get("event") if isinstance(it.get("event"), dict) else None
        src = it.get("source") if isinstance(it.get("source"), dict) else None
        origin = {
            "bundle_sha256": bundle_sha, "source_installation_id": source_iid, "source_item_id": _s(it.get("item_id"), 64), "kind": kind,
            "camera_id": _s(it.get("camera_id"), 64), "camera_name": _s(it.get("camera_name"), 120),
            "event": {**{k: _s(ev.get(k), 60) for k in ("type", "severity", "confidence", "source")}, **{k: _ts(ev.get(k)) for k in ("occurred_at", "ended_at")}} if ev else None,
            "added_by": _s(it.get("added_by"), 120), "created_at": _ts(it.get("created_at")), "preservation": _s(it.get("preservation"), 20),
            "source": {k: _s(src.get(k), 80) for k in ("kind", "job_id", "requested_from", "requested_to", "actual_from", "actual_to", "sha256_at_export", "sha256_at_capture", "taken_at") if src.get(k) is not None} if src else None,
            "file": {"path": _s(path, 256), "sha256": _s(f.get("sha256"), 64), "bytes": f.get("bytes") if isinstance(f.get("bytes"), int) else None} if f else None,
            "in_bundle": in_bundle, "stored": file_path is not None,
        }
        rows.append({
            "kind": kind, "from_at": _ts(it.get("from_at")), "to_at": _ts(it.get("to_at")), "note": (_s(it.get("note"), 4000) or "").strip(),
            "file_path": file_path, "file_sha256": file_sha, "origin": origin, "sort_order": idx,
        })
    return rows


def provenance(manifest: dict[str, Any], report: dict[str, Any], bundle: dict[str, Any], stored: dict[str, dict[str, Any]], importer: Any, now: str) -> dict[str, Any]:
    o = report.get("origin") or {}
    case = manifest.get("case") if isinstance(manifest.get("case"), dict) else {}
    sig = report.get("signature") or {}
    return {
        "source_installation_id": o.get("installation_id"), "source_app_version": o.get("app_version"), "exported_at": o.get("exported_at"),
        "exported_by": o.get("exported_by"), "exported_by_display": o.get("exported_by_display"), "timezone": o.get("timezone"),
        "this_installation": o.get("this_installation"), "confirmed_by_signature": bool(o.get("confirmed_by_signature")), "basis": o.get("basis"),
        # this_confirmed (signed by a key of this installation) | this_claimed (our id, not our signature) | other | unknown
        "producer": o.get("producer") or "unknown",
        "bundle_sha256": bundle["sha256"], "bundle_bytes": bundle["bytes"], "bundle_name": _s(bundle.get("name"), 200),
        "signature": {k: sig.get(k) for k in ("present", "valid", "trust", "kid", "known", "retired")},
        "verification": {"ok": bool(report.get("ok")), "files": len(report.get("files") or []), "schema": report.get("schema"), "verified_at": now},
        "source_case": {**{k: _s(case.get(k), 120) for k in ("id", "title", "status", "owner_username")}, **{k: _ts(case.get(k)) for k in ("created_at", "updated_at")}},
        "imported_at": now, "imported_by": getattr(importer, "username", None),
        "files_stored": sum(1 for p in stored if p not in PROVENANCE_FILES), "bytes_stored": sum(v["bytes"] for v in stored.values()),
        "skipped_at_source": len(manifest.get("skipped") or []) if isinstance(manifest.get("skipped"), list) else 0,
    }


def new_staging_dir(settings: Settings) -> Path:
    d = staging_root(settings) / f"x-{secrets.token_hex(8)}"
    d.mkdir()
    return d


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)
