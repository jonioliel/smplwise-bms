"""Project backups (T026 / T036): one zip with the project tables as JSON and the plan files. Written before
every version upgrade (rollback safety), once a day, on request, or uploaded by an administrator; restored in
a single transaction. Never contains secrets (they live in the add-on options) and never video."""
from __future__ import annotations

import asyncio
import datetime as dt
import io
import json
import logging
import re
import sqlite3
import zipfile
from pathlib import Path
from typing import Any

from .. import __version__
from ..config import Settings
from ..db import Database, bump_permission_revision, get_setting, set_setting

log = logging.getLogger("smplwise.backup")

FORMAT = 1
PROJECT_TABLES = ["settings", "sites", "buildings", "floors", "plan_assets", "plan_versions", "plan_geometry", "catalog_items", "map_anchors", "recorders", "cameras", "spatial_zones", "cases", "case_items", "saved_views"]
ACCESS_TABLES = ["users", "groups", "group_members", "bindings", "custom_roles"]
OPTIONAL_TABLES = {"audit": ["audit_log"], "events": ["events"]}
FILE_COLUMNS = {"plan_assets": ["storage_path"], "plan_versions": ["image_path", "stylized_path"]}
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.zip$")
KEEP = {"auto-pre-upgrade": 5, "auto-daily": 7}
SETTINGS_KEEP = {"permission_revision", "instance_id", "app.version", "bridge.secret", "bridge.pairing_code", "bridge.paired_at"}
MAX_UPLOAD = 200 * 1024 * 1024
DAILY_SECONDS = 24 * 3600


def backups_dir(settings: Settings) -> Path:
    d = settings.data_dir / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _tables(conn: sqlite3.Connection) -> set[str]:
    return {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}


def _columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]


def schema_version(conn: sqlite3.Connection) -> int:
    if "schema_migrations" not in _tables(conn):
        return 0
    row = conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()
    return int(row[0] or 0)


def snapshot(conn: sqlite3.Connection, include_access: bool = True, include_audit: bool = False, include_events: bool = False) -> dict[str, list[dict[str, Any]]]:
    existing = _tables(conn)
    tables = PROJECT_TABLES + (ACCESS_TABLES if include_access else []) + (OPTIONAL_TABLES["audit"] if include_audit else []) + (OPTIONAL_TABLES["events"] if include_events else [])
    return {t: [dict(r) for r in conn.execute(f"SELECT * FROM {t}").fetchall()] for t in tables if t in existing}


def _file_refs(data: dict[str, list[dict[str, Any]]]) -> list[str]:
    refs: list[str] = []
    for table, cols in FILE_COLUMNS.items():
        for row in data.get(table, []):
            for c in cols:
                v = row.get(c)
                if v and v not in refs:
                    refs.append(str(v))
    return refs


def _rel(settings: Settings, ref: str) -> str | None:
    """Zip member name for a stored file reference (paths are kept relative to the data directory)."""
    p = Path(ref)
    if p.is_absolute():
        try:
            p = p.relative_to(settings.data_dir)
        except ValueError:
            return None
    rel = p.as_posix()
    if rel.startswith("../") or "/../" in rel or rel.startswith("/"):
        return None
    if rel == "keys" or rel.startswith("keys/"):
        return None  # private signing keys never enter a backup (T067); a restored installation gets its own key
    return rel


def write_zip(settings: Settings, data: dict[str, list[dict[str, Any]]], kind: str, schema: int, note: str = "") -> Path:
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")
    out = backups_dir(settings) / f"{kind}-{stamp}.zip"
    n = 1
    while out.exists():
        n += 1
        out = backups_dir(settings) / f"{kind}-{stamp}-{n}.zip"
    files = 0
    missing: list[str] = []
    tmp = out.with_name(out.name + ".tmp")
    with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for table, rows in data.items():
            z.writestr(f"data/{table}.json", json.dumps(rows, ensure_ascii=False))
        for ref in _file_refs(data):
            rel = _rel(settings, ref)
            src = (settings.data_dir / rel) if rel else None
            if rel and src and src.is_file():
                z.write(src, f"files/{rel}")
                files += 1
            else:
                missing.append(ref)
        manifest = {
            "format": FORMAT,
            "app_version": __version__,
            "schema_version": schema,
            "created_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "kind": kind,
            "note": note,
            "tables": {t: len(rows) for t, rows in data.items()},
            "files": files,
            "missing_files": missing[:50],
        }
        z.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=1))
    tmp.replace(out)
    return out


def read_manifest(path: Path) -> dict[str, Any]:
    with zipfile.ZipFile(path) as z:
        if "manifest.json" not in z.namelist():
            raise ValueError("not a SMPLWISE backup (manifest.json missing)")
        m = json.loads(z.read("manifest.json").decode("utf-8"))
    if not isinstance(m, dict) or m.get("format") != FORMAT:
        raise ValueError("unsupported backup format")
    return m


def entry(path: Path) -> dict[str, Any]:
    st = path.stat()
    try:
        m = read_manifest(path)
    except (ValueError, zipfile.BadZipFile, KeyError, json.JSONDecodeError):
        m = {}
    kind = m.get("kind") or ("upload" if path.name.startswith("upload-") else "manual")
    return {
        "name": path.name,
        "bytes": st.st_size,
        "created_at": m.get("created_at") or dt.datetime.fromtimestamp(st.st_mtime, dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "kind": kind,
        "note": m.get("note", ""),
        "app_version": m.get("app_version"),
        "schema_version": m.get("schema_version"),
        "tables": m.get("tables", {}),
        "files": m.get("files", 0),
        "valid": bool(m),
    }


def list_backups(settings: Settings) -> list[dict[str, Any]]:
    items = [entry(p) for p in backups_dir(settings).glob("*.zip")]
    items.sort(key=lambda e: e["created_at"], reverse=True)
    return items


def prune(settings: Settings) -> list[str]:
    """Keep the newest N automatic backups per kind; manual and uploaded ones are never removed here."""
    removed: list[str] = []
    for kind, keep in KEEP.items():
        rows = sorted((p for p in backups_dir(settings).glob(f"{kind}-*.zip")), key=lambda p: p.stat().st_mtime, reverse=True)
        for p in rows[keep:]:
            try:
                p.unlink()
                removed.append(p.name)
            except OSError:
                pass
    return removed


def create(settings: Settings, conn: sqlite3.Connection, kind: str = "manual", note: str = "", include_access: bool = True, include_audit: bool = False, include_events: bool = False) -> dict[str, Any]:
    data = snapshot(conn, include_access, include_audit, include_events)
    out = write_zip(settings, data, kind, schema_version(conn), note)
    return entry(out)


def create_standalone(settings: Settings, db: Database, kind: str, note: str = "") -> dict[str, Any]:
    with db.connection() as conn:
        return create(settings, conn, kind, note)


def _actor_rows(conn: sqlite3.Connection, user_id: str | None) -> dict[str, list[dict[str, Any]]]:
    """The acting administrator's own identity rows, kept across an access restore so nobody locks themselves out."""
    if not user_id:
        return {}
    out: dict[str, list[dict[str, Any]]] = {}
    existing = _tables(conn)
    if "users" in existing:
        out["users"] = [dict(r) for r in conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchall()]
    if "bindings" in existing:
        out["bindings"] = [dict(r) for r in conn.execute("SELECT * FROM bindings WHERE subject_kind = 'user' AND subject_id = ?", (user_id,)).fetchall()]
    if "group_members" in existing:
        col = next((c for c in _columns(conn, "group_members") if c in ("user_id", "member_id", "subject_id")), None)
        if col:
            out["group_members"] = [dict(r) for r in conn.execute(f"SELECT * FROM group_members WHERE {col} = ?", (user_id,)).fetchall()]
    return out


def _insert_rows(conn: sqlite3.Connection, table: str, rows: list[dict[str, Any]], replace: bool) -> int:
    """Write the archive's rows of one table; returns how many rows were written (what the restore answer reports)."""
    cols_now = set(_columns(conn, table))
    n = 0
    verb = "INSERT OR REPLACE" if replace else "INSERT OR IGNORE"
    for row in rows:
        if table == "settings" and row.get("key") in SETTINGS_KEEP:
            continue
        keys = [k for k in row.keys() if k in cols_now]
        if not keys:
            continue
        cur = conn.execute(f"{verb} INTO {table}({', '.join(keys)}) VALUES ({', '.join('?' * len(keys))})", [row[k] for k in keys])
        n += max(cur.rowcount, 0)  # rows written: a merge's INSERT OR IGNORE of a row that exists writes nothing
    return n


def restore(settings: Settings, conn: sqlite3.Connection, path: Path, mode: str = "replace", scope: str = "project", actor_user_id: str | None = None) -> dict[str, Any]:
    """Load a backup into the current database inside the caller's transaction. `replace` empties every table of
    the scope first, also one the archive does not have (a backup older than the table): the restored project equals
    the backup, and no row is left pointing at a parent row being replaced (R-T7-1). Identity rows of the acting user
    are kept. `merge` only adds missing rows. Files are written before the commit; a failure rolls the rows back."""
    if mode not in ("replace", "merge"):
        raise ValueError("mode must be replace | merge")
    if scope not in ("project", "project+access"):
        raise ValueError("scope must be project | project+access")
    manifest = read_manifest(path)
    current_schema = schema_version(conn)
    if int(manifest.get("schema_version") or 0) > current_schema:
        raise ValueError(f"backup schema {manifest.get('schema_version')} is newer than this installation ({current_schema}); update the add-on first")
    existing = _tables(conn)
    tables = [t for t in PROJECT_TABLES + (ACCESS_TABLES if scope == "project+access" else []) if t in existing]
    data: dict[str, list[dict[str, Any]]] = {}
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())
        for t in tables:
            member = f"data/{t}.json"
            if member in names:
                data[t] = json.loads(z.read(member).decode("utf-8"))
        keep = _actor_rows(conn, actor_user_id) if scope == "project+access" else {}
        if mode == "replace":
            for t in reversed(tables):  # children before parents; a table missing from the archive is emptied too
                if t == "settings":
                    conn.execute(f"DELETE FROM settings WHERE key NOT IN ({', '.join('?' * len(SETTINGS_KEEP))})", list(SETTINGS_KEEP))
                else:
                    conn.execute(f"DELETE FROM {t}")
        counts: dict[str, int] = {}
        for t in tables:
            if t in data:
                counts[t] = _insert_rows(conn, t, data[t], replace=(mode == "replace"))
        for t, rows in keep.items():
            if rows:
                _insert_rows(conn, t, rows, replace=False)
        files = 0
        for member in names:
            if not member.startswith("files/") or member.endswith("/"):
                continue
            rel = member[len("files/"):]
            if rel.startswith("/") or ".." in rel.split("/"):
                continue
            dest = settings.data_dir / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            with z.open(member) as src, open(dest, "wb") as dst:
                dst.write(src.read())
            files += 1
    if scope == "project+access":
        bump_permission_revision(conn)
    return {"mode": mode, "scope": scope, "tables": counts, "files": files, "app_version": manifest.get("app_version"), "created_at": manifest.get("created_at")}


def save_upload(settings: Settings, content: bytes) -> dict[str, Any]:
    if len(content) > MAX_UPLOAD:
        raise ValueError("backup file too large")
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as z:
            if "manifest.json" not in z.namelist():
                raise ValueError("not a SMPLWISE backup (manifest.json missing)")
            m = json.loads(z.read("manifest.json").decode("utf-8"))
    except zipfile.BadZipFile as exc:
        raise ValueError("not a zip file") from exc
    if m.get("format") != FORMAT:
        raise ValueError("unsupported backup format")
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")
    out = backups_dir(settings) / f"upload-{stamp}.zip"
    n = 1
    while out.exists():
        n += 1
        out = backups_dir(settings) / f"upload-{stamp}-{n}.zip"
    tmp = out.with_name(out.name + ".tmp")
    tmp.write_bytes(content)
    tmp.replace(out)
    return entry(out)


# ---- start-up safety and the daily copy ----


def pre_upgrade(settings: Settings) -> Path | None:
    """Before migrations run: if the stored application version differs from this build, write a backup of the
    existing data so a bad upgrade can be undone (T036). Returns the file, or None when nothing was needed."""
    if not settings.db_path.exists():
        return None
    try:
        conn = sqlite3.connect(settings.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            if "settings" not in _tables(conn):
                return None
            stored = get_setting(conn, "app.version")
            if stored == __version__:
                return None
            data = snapshot(conn)
            out = write_zip(settings, data, "auto-pre-upgrade", schema_version(conn), note=f"before upgrade {stored or 'unknown'} -> {__version__}")
        finally:
            conn.close()
        prune(settings)
        return out
    except (sqlite3.Error, OSError, ValueError) as exc:  # never block start-up because of the safety copy
        log.warning("pre-upgrade backup skipped: %s", exc)
        return None


def record_version(db: Database) -> None:
    with db.connection() as conn:
        if get_setting(conn, "app.version") != __version__:
            set_setting(conn, "app.version", __version__)


async def daily_loop(db: Database, settings: Settings, interval_s: int = DAILY_SECONDS) -> None:
    """One automatic copy a day (the first one a day after start-up, so restarts do not pile up copies)."""
    from starlette.concurrency import run_in_threadpool

    while True:
        await asyncio.sleep(interval_s)
        try:
            e = await run_in_threadpool(create_standalone, settings, db, "auto-daily", "daily")
            removed = await run_in_threadpool(prune, settings)
            log.info("daily backup %s (%d bytes); pruned %s", e["name"], e["bytes"], removed or "nothing")
        except Exception as exc:  # noqa: BLE001 - keep the loop alive
            log.warning("daily backup failed: %s", exc)
