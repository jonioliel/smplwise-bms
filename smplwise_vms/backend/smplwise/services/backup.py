"""Project backups (T026 / T036): one zip with the project tables as JSON and the plan files. Written before
every version upgrade (rollback safety), once a day, on request, or uploaded by an administrator; restored in
a single transaction. Never contains secrets (the NVR connection's table and every key file stay out, CR-022 section 9) and
never video. A restore writes only the plan files its own rows reference (`restorable`): an archive member naming a key, the
database, the add-on options or any other path is ignored (CR-022 security review F1)."""
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
PROJECT_TABLES = ["settings", "sites", "buildings", "floors", "plan_assets", "plan_versions", "plan_geometry", "catalog_items", "map_anchors", "recorders", "cameras", "spatial_zones", "floor_images", "floor_image_layout", "shared_spaces", "shared_space_members", "cases", "case_items", "saved_views", "device_layouts", "alarm_zone_overrides", "notify_settings", "notify_policies", "device_bulk_protected", "device_switch_classified"]
# CR-023: every electricity table (meters and billing) is listed ONCE, in services/energy_backup (MAIN_TABLES,
# KEEP_WHEN_ABSENT, FILE_COLUMNS); the restore allow-list below is built from these lists.
from . import energy_backup as _energy_backup  # noqa: E402

PROJECT_TABLES = PROJECT_TABLES + [t for t in _energy_backup.MAIN_TABLES if t not in PROJECT_TABLES]
ACCESS_TABLES = ["users", "groups", "group_members", "bindings", "custom_roles"]
# CR-019 section 6.6: switch protection is safety state. A `replace` restore of an archive WITHOUT these tables (one written before
# them) keeps the current rows instead of emptying them - an older backup must never unprotect every switch.
KEEP_WHEN_ABSENT = frozenset({"device_bulk_protected", "device_switch_classified"}) | _energy_backup.KEEP_WHEN_ABSENT
OPTIONAL_TABLES = {"audit": ["audit_log"], "events": ["events"]}
FILE_COLUMNS = {"plan_assets": ["storage_path"], "plan_versions": ["image_path", "stylized_path"], "floor_images": ["path"], **_energy_backup.FILE_COLUMNS}
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.zip$")
KEEP = {"auto-pre-upgrade": 5, "auto-daily": 7}
SETTINGS_KEEP = {"permission_revision", "instance_id", "installation_id", "app.version", "bridge.secret", "bridge.pairing_code", "bridge.paired_at",
                 "multimedia.ma_direct",  # CR-016 17.3: the Music Assistant server address (its token is a file outside the archive)
                 "nvr.legacy_import_done",  # CR-022 section 7: a restore never re-arms the one-time import of the add-on options
                 "system.addon_restart_at"}  # CR-022 review F6: the restart guard is local state, never restored
# CR-022 section 9: `recorder_connections` (the NVR connection with its encrypted password) is deliberately NOT a backup table:
# never written to an archive, never read from one, and a `replace` restore leaves the row alone (it is not in PROJECT_TABLES).
# Its key file lives in keys/, which never enters an archive (`_rel`).
# CR-022 security review F1: what a restore may write into the data directory. Only the plan files the archive's own rows
# reference (FILE_COLUMNS), under these roots, never the key folder, a database file or the add-on options - whatever the
# archive contains. The same rule drops an archive row whose file column points anywhere else (it could steer a later read).
RESTORABLE_ROOTS = ("plans/",) + _energy_backup.RESTORABLE_ROOTS  # CR-023: stored bill PDFs and business logos (energy/bills/, energy/assets/)
_NEVER_RESTORED_NAME = re.compile(r"(^options\.json$|\.db$|\.db-|\.sqlite|-wal$|-shm$|-journal$|\.key$)", re.IGNORECASE)
# CR-020 S2C security review finding 4: runtime state of the multi-camera batches (the batch record with who started it and
# the request id, its heartbeat, the device lock). Never exported, never restored, never deleted by a `replace` restore -
# a restore in the middle of a batch must not drop the device lock, and an old archive must not bring back a stale one.
SETTINGS_KEEP_PREFIXES = ("nvr.batch.",)


def _kept_setting(key: Any) -> bool:
    return isinstance(key, str) and (key in SETTINGS_KEEP or key.startswith(SETTINGS_KEEP_PREFIXES))


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
    out = {t: [dict(r) for r in conn.execute(f"SELECT * FROM {t}").fetchall()] for t in tables if t in existing}
    if "settings" in out:  # review M3: what a restore never writes back (secrets, identity, pairing) never leaves in an archive either
        out["settings"] = [r for r in out["settings"] if not _kept_setting(r.get("key"))]
    return out


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


def restorable(rel: str | None) -> bool:
    """True when `rel` (a path relative to the data directory, `/`-separated) is a file a restore may write: under
    RESTORABLE_ROOTS; no absolute path, drive, backslash, NUL, empty / `.` / `..` segment; never a `keys` folder, a database
    file, a key file or `options.json` (review F1)."""
    if not isinstance(rel, str) or not rel or rel.startswith("/") or "\\" in rel or ":" in rel or "\x00" in rel:
        return False
    parts = rel.split("/")
    if any(p in ("", ".", "..") for p in parts) or any(p.lower() == "keys" for p in parts):
        return False
    if not rel.startswith(RESTORABLE_ROOTS):
        return False
    return _NEVER_RESTORED_NAME.search(parts[-1]) is None


def write_zip(settings: Settings, data: dict[str, list[dict[str, Any]]], kind: str, schema: int, note: str = "", energy_history: bool = False) -> Path:
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
        from . import energy_backup  # CR-023: daily totals always, the energy.db copy only when the setting asks for it

        energy = energy_backup.add_to_zip(settings, z, with_history=energy_history)
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
            "energy": energy,
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
    from . import energy_backup

    data = snapshot(conn, include_access, include_audit, include_events)
    out = write_zip(settings, data, kind, schema_version(conn), note, energy_history=energy_backup.include_history(conn))
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
        if table == "settings" and _kept_setting(row.get("key")):
            continue
        keys = [k for k in row.keys() if k in cols_now]
        if not keys:
            continue
        cur = conn.execute(f"{verb} INTO {table}({', '.join(keys)}) VALUES ({', '.join('?' * len(keys))})", [row[k] for k in keys])
        n += max(cur.rowcount, 0)  # rows written: a merge's INSERT OR IGNORE of a row that exists writes nothing
    return n


# Never restored from an archive (CR-006 2a): the skins' control images and render records are rebuilt / kept locally;
# 2c's export of skins will add them here and must pass _unsafe_rows' path rule.
NEVER_RESTORED = ("plan_skin_controls", "plan_skin_renders")


def _unsafe_rows(settings: Settings, data: dict[str, list[dict[str, Any]]]) -> dict[str, int]:
    """Re-review 2a: drop, in place, archive rows that could steer a file path - a floor whose id is not a plain id
    (db.ID_RE; the id names `skins/<floor id>/`), every row of another table pointing at such a floor, and a
    `plan_skin*` row whose `path` does not confine to the skins root. Skipped, counted and logged (count only); the
    rest of the restore goes on. Returns {table: rows skipped}."""
    from ..db import ID_RE
    from .skins import store as skins_store

    skipped: dict[str, int] = {}
    def plain(v: Any) -> bool:
        return isinstance(v, str) and ID_RE.fullmatch(v) is not None

    bad_floors = {str(r.get("id")) for r in data.get("floors", []) if isinstance(r, dict) and not plain(r.get("id")) and r.get("id") is not None}
    for table, rows in data.items():
        keep: list[dict[str, Any]] = []
        for r in rows:
            fid = r.get("floor_id") if isinstance(r, dict) else None
            unsafe = not isinstance(r, dict) or (table == "floors" and not plain(r.get("id"))) or (fid is not None and (not isinstance(fid, str) or fid in bad_floors))
            if not unsafe and table in FILE_COLUMNS:  # review F1: a file column outside the restorable set could steer a later read
                for c in FILE_COLUMNS[table]:
                    v = r.get(c)
                    if v is not None and (not isinstance(v, str) or not restorable(_rel(settings, v))):
                        unsafe = True
            if not unsafe and table.startswith("plan_skin") and r.get("path") is not None:
                try:
                    skins_store.confine_stored(settings, r["path"])
                except skins_store.SkinStoreError:
                    unsafe = True
            if unsafe:
                skipped[table] = skipped.get(table, 0) + 1
            else:
                keep.append(r)
        rows[:] = keep
    return skipped


def restore(settings: Settings, conn: sqlite3.Connection, path: Path, mode: str = "replace", scope: str = "project", actor_user_id: str | None = None) -> dict[str, Any]:
    """Load a backup into the current database inside the caller's transaction. `replace` empties every table of
    the scope first, also one the archive does not have (a backup older than the table): the restored project equals
    the backup, and no row is left pointing at a parent row being replaced (R-T7-1) - except KEEP_WHEN_ABSENT (CR-019's
    switch protection): an archive without them keeps the current rows (`kept_current` in the answer). Identity rows of
    the acting user are kept. `merge` only adds missing rows. Files are written before the commit; a failure rolls the rows back."""
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
        kept_current = [t for t in tables if t in KEEP_WHEN_ABSENT and t not in data]
        if mode == "replace":
            for t in reversed(tables):  # children before parents; a table missing from the archive is emptied too
                if t in kept_current:
                    continue  # CR-019: never emptied by an archive that does not have it
                if t == "settings":
                    conn.execute(f"DELETE FROM settings WHERE key NOT IN ({', '.join('?' * len(SETTINGS_KEEP))})"
                                 + "".join(" AND substr(key, 1, ?) <> ?" for _ in SETTINGS_KEEP_PREFIXES),
                                 [*SETTINGS_KEEP, *(v for p in SETTINGS_KEEP_PREFIXES for v in (len(p), p))])
                else:
                    conn.execute(f"DELETE FROM {t}")
        skipped = _unsafe_rows(settings, data)
        counts: dict[str, int] = {}
        for t in tables:
            if t in data:
                counts[t] = _insert_rows(conn, t, data[t], replace=(mode == "replace"))
        if "notify_settings" in tables:  # CR-018: an archive without the table must not leave the notification settings without their one row
            from .notify_settings import ensure_row

            ensure_row(conn)
        for t, rows in keep.items():
            if rows:
                _insert_rows(conn, t, rows, replace=False)
        roles_pruned = _prune_role_permissions(conn) if "custom_roles" in data else []
        files = 0
        files_skipped = 0
        # review F1: only the files the archive's own (kept) rows reference, each inside the restorable set
        wanted = {rel for rel in (_rel(settings, ref) for ref in _file_refs(data)) if rel is not None and restorable(rel)}
        for member in names:
            if not member.startswith("files/") or member.endswith("/"):
                continue
            rel = member[len("files/"):]
            if rel not in wanted or not restorable(rel):
                files_skipped += 1
                continue
            dest = settings.data_dir / rel
            base = settings.data_dir.resolve()
            if base not in dest.resolve().parents:  # re-review 2a: never write outside the data dir, whatever the name
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with z.open(member) as src, open(dest, "wb") as dst:
                dst.write(src.read())
            files += 1
        energy: dict[str, Any] = {}
        if "energy_meters" in tables:  # CR-023: the allow-listed energy.db part, only for meters the restored project has
            from . import energy_backup

            allowed = {r[0] for r in conn.execute("SELECT id FROM energy_meters").fetchall()}
            energy = energy_backup.restore_from_zip(settings, z, names, allowed_meters=allowed, replace=(mode == "replace"))
    if scope == "project+access":
        bump_permission_revision(conn)
    # CR-006 2a review: a replaced project may no longer have a floor whose skin control images are stored
    from .skins import store as skins_store

    swept = skins_store.sweep_orphans(settings, conn) if "plan_skin_controls" in existing else 0
    if skipped:
        log.warning("restore skipped %s row(s) with an unsafe id or path", sum(skipped.values()))
    if files_skipped:
        log.warning("restore skipped %s archive file(s) outside the restorable set", files_skipped)
    return {"mode": mode, "scope": scope, "tables": counts, "files": files, "files_skipped": files_skipped, "skin_controls_swept": swept, "skipped_unsafe": skipped,
            "kept_current": kept_current, "roles_pruned": roles_pruned, "energy": energy, "app_version": manifest.get("app_version"), "created_at": manifest.get("created_at")}


def _prune_role_permissions(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """CR-020 S2 review L6: a restored archive from an older version can carry custom roles naming a permission this version
    no longer has (nvr.config.stream, removed by migration 0050) or one that only built-in roles may hold. Such a role would
    grant nothing for it and its next edit would fail (422 permission_unknown), so the permission is dropped here - the same
    rule migration 0050 applied - and the role's revision moves. Returns [{role_id, removed}] for the answer and the audit row."""
    from ..routers.access import PERMISSION_LABELS, SYSTEM_PERMISSIONS  # local import: the permission catalogue lives with the roles API

    def keep(p: Any) -> bool:
        return isinstance(p, str) and p in PERMISSION_LABELS and p not in SYSTEM_PERMISSIONS

    out: list[dict[str, Any]] = []
    for r in conn.execute("SELECT id, permissions_json, sensitive_json FROM custom_roles").fetchall():
        try:
            perms = json.loads(r["permissions_json"] or "[]")
            sens = json.loads(r["sensitive_json"] or "[]")
        except ValueError:
            continue
        if not isinstance(perms, list) or not isinstance(sens, list):
            continue
        removed = sorted({str(p)[:64] for p in perms + sens if not keep(p)})
        if not removed:
            continue
        conn.execute("UPDATE custom_roles SET permissions_json = ?, sensitive_json = ?, revision = revision + 1 WHERE id = ?",
                     (json.dumps([p for p in perms if keep(p)]), json.dumps([p for p in sens if keep(p)]), r["id"]))
        out.append({"role_id": r["id"], "removed": removed})
    return out


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
            from . import notify_sources  # CR-018: the administrators hear about a failed automatic backup (resolved by the next good one)

            await run_in_threadpool(notify_sources.backup_failed, db)
