"""DATASTORE-295 (data-store hardening, part 1): the automated restore drill.

A backup that was never restored is a hope, not a backup. The drill takes an existing project archive (the newest valid one in
`<data>/backups/` unless a file is named), restores it into a fresh scratch directory with the SAME code path an administrator's
restore uses (`backup.restore`, mode `replace`, scope `project+access`), and checks the result:

- the archive itself: a readable manifest, every member's CRC (`ZipFile.testzip`), a schema that is not newer than this build;
- `PRAGMA integrity_check` = ok and `PRAGMA foreign_key_check` empty on the restored database (and on the restored energy.db);
- the migration version: the restored database carries every migration of this build;
- row counts: every table the archive's manifest lists and a restore brings back holds exactly the archive's rows (minus the
  rows the restore drops on purpose as unsafe, reported by `restore` itself);
- the settings a restore must never take from an archive (`backup.SETTINGS_KEEP` / `SETTINGS_KEEP_PREFIXES`): absent from the
  archive's settings rows, and the scratch database's own values of those keys are unchanged by the restore.

It never touches the live database, never triggers the process-wide capture-lease hooks (`restore(process_hooks=False)`), never
needs the backup password (an encrypted sensitive section is skipped and reported as not checked) and removes the scratch
directory afterwards. The result - PASS / FAIL with per-phase timings - is written to `<data>/backup_drill/last.json` (plus a short
history); the API (routers/backup.py, `backup.manage`) shows it. A monthly run exists and is OFF by default (setting
`backup.drill.monthly` = `true`; never exported or restored, see backup.SETTINGS_KEEP).

Command line (inside the add-on, or on a copy of a data directory):
    python -m smplwise.services.backup_drill --data-dir /data [--archive FILE] [--keep-scratch] [--json] [--no-record]
(`scripts/backup_restore_drill.py` is the same entry point from a repository checkout.) Exit code 0 = PASS, 1 = FAIL."""
from __future__ import annotations

import argparse
import asyncio
import dataclasses
import datetime as dt
import hashlib
import json
import logging
import os
import shutil
import sqlite3
import sys
import threading
import time
import zipfile
from pathlib import Path
from typing import Any

from ..config import Settings
from ..db import MIGRATIONS_DIR, Database, get_setting
from . import backup as svc

log = logging.getLogger("smplwise.backup.drill")

SCHEDULE_KEY = "backup.drill.monthly"
DRILL_DIR = "backup_drill"
LAST_FILE = "last.json"
LAST_OFFBOX_FILE = "last_offbox.json"  # phase 2: the drill of the newest encrypted copy at an off-box target
HISTORY_FILE = "history.json"
HISTORY_KEEP = 12
MONTHLY_S = 30 * 24 * 3600
CHECK_EVERY_S = 6 * 3600
SPACE_MARGIN_BYTES = 64 * 1024 * 1024
# the tables the status screen names first (every table of the manifest is still counted)
KEY_TABLES = ("settings", "sites", "buildings", "floors", "plan_versions", "cameras", "recorders", "users", "bindings", "custom_roles")
# rows a restore adds on its own: notify_settings always ends with its one row (backup.restore -> notify_settings.ensure_row)
AUTO_ROW_TABLES = {"notify_settings": 1}
# kept settings the restore itself moves: the permission revision is bumped by every project+access restore
KEEP_COMPARE_EXCLUDED = frozenset({"permission_revision"})

_LOCK = threading.Lock()


class DrillBusy(RuntimeError):
    """Another drill is running in this process."""


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _iso(t: dt.datetime) -> str:
    return t.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def drill_dir(settings: Settings) -> Path:
    d = Path(settings.data_dir) / DRILL_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def code_schema_version() -> int:
    return max((int(p.name.split("_", 1)[0]) for p in MIGRATIONS_DIR.glob("*.sql")), default=0)


def minimal_settings(data_dir: Path) -> Settings:
    """Settings for a run outside the add-on process (the command line): only `data_dir` matters to the drill."""
    return Settings(data_dir=Path(data_dir), www_dir=None, in_addon=False, trusted_proxies=(), dev_user=None, bootstrap_admin_username=None,
                    nvr_host=None, nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None, log_level="info")


def latest_archive(settings: Settings) -> Path | None:
    """The newest archive whose manifest reads (an invalid file is never the drill's subject by default)."""
    d = Path(settings.data_dir) / "backups"
    if not d.is_dir():
        return None
    for e in svc.list_backups(settings):
        if e.get("valid"):
            return d / e["name"]
    return None


# ---------------------------------------------------------------- result store


def read_last(settings: Settings, name: str = LAST_FILE) -> dict[str, Any] | None:
    p = Path(settings.data_dir) / DRILL_DIR / name
    try:
        out = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return out if isinstance(out, dict) else None


def read_history(settings: Settings) -> list[dict[str, Any]]:
    p = Path(settings.data_dir) / DRILL_DIR / HISTORY_FILE
    try:
        out = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    return [r for r in out if isinstance(r, dict)] if isinstance(out, list) else []


def _write_json(path: Path, value: Any) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def summary_of(result: dict[str, Any]) -> dict[str, Any]:
    return {k: result.get(k) for k in ("result", "trigger", "started_at", "finished_at")} | {
        "archive": (result.get("archive") or {}).get("name"),
        "source": (result.get("source") or {}).get("kind", "local"),
        "target_id": (result.get("source") or {}).get("target_id"),
        "total_ms": (result.get("timings_ms") or {}).get("total"),
        "failed": [c["name"] for c in result.get("checks", []) if c.get("severity") == "fail" and not c.get("ok")],
    }


def record(settings: Settings, result: dict[str, Any]) -> None:
    d = drill_dir(settings)
    offbox = (result.get("source") or {}).get("kind") == "offbox"
    _write_json(d / (LAST_OFFBOX_FILE if offbox else LAST_FILE), result)
    history = [summary_of(result), *read_history(settings)][:HISTORY_KEEP]
    _write_json(d / HISTORY_FILE, history)


# ---------------------------------------------------------------- checks


class _Run:
    def __init__(self) -> None:
        self.checks: list[dict[str, Any]] = []
        self.timings: dict[str, int] = {}

    def check(self, name: str, ok: bool, detail: Any = None, severity: str = "fail") -> bool:
        self.checks.append({"name": name, "ok": bool(ok), "severity": severity, **({"detail": detail} if detail is not None else {})})
        return bool(ok)

    def timed(self, phase: str, started: float) -> None:
        self.timings[phase] = int(round((time.monotonic() - started) * 1000))


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def db_checks(path: Path) -> dict[str, Any]:
    """`integrity_check` and `foreign_key_check` of one SQLite file (read-only open). Returns {integrity, fk_violations{table: n}}."""
    conn = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    try:
        rows = [r[0] for r in conn.execute("PRAGMA integrity_check").fetchall()]
        fk: dict[str, int] = {}
        for r in conn.execute("PRAGMA foreign_key_check").fetchall():
            fk[str(r[0])] = fk.get(str(r[0]), 0) + 1
    finally:
        conn.close()
    return {"integrity": "ok" if rows == ["ok"] else "; ".join(str(x) for x in rows[:5]), "fk_violations": fk}


def _kept_values(conn: sqlite3.Connection) -> dict[str, Any]:
    return {r[0]: r[1] for r in conn.execute("SELECT key, value FROM settings").fetchall() if svc._kept_setting(r[0]) and r[0] not in KEEP_COMPARE_EXCLUDED}


def _space_needed(z: zipfile.ZipFile) -> int:
    return 2 * sum(i.file_size for i in z.infolist()) + SPACE_MARGIN_BYTES


def run_drill(settings: Settings, archive: Path | None = None, *, trigger: str = "manual", keep_scratch: bool = False,
              write_result: bool = True) -> dict[str, Any]:
    """Run one drill (blocking). Raises DrillBusy when another drill of this process runs; never raises otherwise - every failure
    is a FAIL result with the failing check named."""
    if not _LOCK.acquire(blocking=False):
        raise DrillBusy("a restore drill is already running")
    try:
        return _run_locked(settings, archive, trigger=trigger, keep_scratch=keep_scratch, write_result=write_result)
    finally:
        _LOCK.release()


def running() -> bool:
    return _LOCK.locked()


def run_offbox_drill(db: Database, settings: Settings, target_id: str, *, trigger: str = "manual", keep_scratch: bool = False,
                     write_result: bool = True) -> dict[str, Any]:
    """Phase 2: the same drill on the newest ENCRYPTED copy at an off-box target - downloaded, decrypted with the keyring (the key
    the copy's header names; a rotated-out key still opens its copies), then restored and verified like a local archive. Recorded in
    `last_offbox.json` and as a `drill` run of the target. A copy that cannot be fetched or opened is a FAIL naming `offbox_fetch`."""
    from . import offbox_runtime
    from .backup_offbox import OffboxError

    if not _LOCK.acquire(blocking=False):
        raise DrillBusy("a restore drill is already running")
    fetch_dir = drill_dir(settings) / f"offbox-{_now().strftime('%Y%m%d-%H%M%S')}-{os.getpid()}"
    try:
        for stale in drill_dir(settings).glob("offbox-*"):
            shutil.rmtree(stale, ignore_errors=True)
        fetch_dir.mkdir(parents=True)
        t_total = time.monotonic()
        run = _Run()
        source: dict[str, Any] = {"kind": "offbox", "target_id": target_id}
        zip_path: Path | None = None
        t = time.monotonic()
        try:
            got = offbox_runtime.fetch_latest_copy(db, settings, target_id, fetch_dir)
        except OffboxError as exc:
            run.check("offbox_fetch", False, {"error": exc.code})
        except Exception as exc:  # noqa: BLE001
            run.check("offbox_fetch", False, {"error": "transport_error", "type": type(exc).__name__})
        else:
            zip_path = got["zip"]
            source.update({"object": got["object"], "key_id": got["key_id"], "sealed_bytes": got["sealed_bytes"]})
            run.check("offbox_fetch", True)
            run.check("offbox_decrypt", True, {"key_id": got["key_id"]})
        run.timed("fetch", t)
        result = _run_locked(settings, zip_path, trigger=trigger, keep_scratch=keep_scratch, write_result=write_result, source=source,
                             prelude=run, t_total=t_total)
    finally:
        shutil.rmtree(fetch_dir, ignore_errors=True)
        _LOCK.release()
    try:
        with db.write_aside(label="offbox.drill") as conn:
            from . import offbox_store

            run_id = offbox_store.start_run(conn, target_id, "drill", trigger)
            failed = [c["name"] for c in result["checks"] if not c["ok"] and c["severity"] == "fail"]
            offbox_store.finish_run(conn, run_id, {"ok": result["result"] == "PASS", "error": failed[0] if failed else None,
                                                   "object": source.get("object"), "verified": result["result"] == "PASS",
                                                   "sealed": {"key_id": source.get("key_id"), "sealed_bytes": source.get("sealed_bytes")},
                                                   "timings_ms": result.get("timings_ms"), "drill_result": result["result"]})
    except Exception:  # noqa: BLE001 - the drill result file is the record; the run row is a convenience
        log.warning("off-box drill run could not be recorded", exc_info=True)
    return result


def _run_locked(settings: Settings, archive: Path | None, *, trigger: str, keep_scratch: bool, write_result: bool,
                source: dict[str, Any] | None = None, prelude: _Run | None = None, t_total: float | None = None) -> dict[str, Any]:
    run = prelude or _Run()
    started_at = _now()
    t_total = t_total if t_total is not None else time.monotonic()
    result: dict[str, Any] = {"result": "FAIL", "trigger": trigger, "started_at": _iso(started_at), "archive": None, "schema": None,
                              "tables": {}, "restore": None, "error": None, "source": source or {"kind": "local"}}
    scratch: Path | None = None
    try:
        base = drill_dir(settings)
        for stale in base.glob("scratch-*"):  # a drill that died midway (power cut) left its scratch copy behind
            shutil.rmtree(stale, ignore_errors=True)
        if any(not c["ok"] and c["severity"] == "fail" for c in run.checks):
            return result  # the off-box fetch / decrypt already failed (named in the prelude)
        path = Path(archive) if archive is not None else latest_archive(settings)
        if not run.check("archive_present", path is not None and path.is_file(), None if path else "no valid archive in backups/"):
            return result
        assert path is not None
        # ---- the archive itself
        t = time.monotonic()
        try:
            manifest = svc.read_manifest(path)
        except (ValueError, zipfile.BadZipFile, KeyError, OSError) as exc:
            run.check("archive_readable", False, f"{type(exc).__name__}: {str(exc)[:120]}")
            return result
        st = path.stat()
        result["archive"] = {"name": path.name, "bytes": st.st_size, "sha256": _sha256(path), "kind": manifest.get("kind"),
                             "created_at": manifest.get("created_at"), "app_version": manifest.get("app_version"),
                             "schema_version": manifest.get("schema_version"),
                             "sensitive": (svc._sensitive_summary(manifest) or {}).get("state")}
        with zipfile.ZipFile(path) as z:
            try:
                bad = z.testzip()  # the first member whose CRC does not match
            except Exception as exc:  # noqa: BLE001 - a broken deflate stream raises zlib.error instead
                bad = f"unreadable member ({type(exc).__name__})"
            needed = _space_needed(z)
            archive_settings = []
            if bad is None and "data/settings.json" in z.namelist():
                try:
                    archive_settings = json.loads(z.read("data/settings.json").decode("utf-8"))
                except (ValueError, UnicodeDecodeError):
                    archive_settings = [{"key": None, "unreadable": True}]
            if not isinstance(archive_settings, list):
                archive_settings = []
        run.check("archive_readable", True)
        run.check("archive_crc", bad is None, None if bad is None else f"first damaged member: {bad}")
        code_schema = code_schema_version()
        archive_schema = int(manifest.get("schema_version") or 0)
        run.check("archive_schema_supported", archive_schema <= code_schema, {"archive": archive_schema, "code": code_schema})
        carried = sorted({r.get("key") for r in archive_settings if isinstance(r, dict) and svc._kept_setting(r.get("key"))})
        run.check("archive_without_kept_settings", not carried, {"carried": carried[:20]} if carried else None)
        free = shutil.disk_usage(base).free
        run.check("disk_space", free >= needed, {"needed_bytes": needed, "free_bytes": free})
        run.timed("archive_check", t)
        if bad is not None or archive_schema > code_schema or free < needed:
            return result
        # ---- a fresh database with this build's schema
        t = time.monotonic()
        scratch = base / f"scratch-{started_at.strftime('%Y%m%d-%H%M%S')}-{os.getpid()}"
        scratch.mkdir(parents=True)
        scratch_settings = dataclasses.replace(settings, data_dir=scratch)
        sdb = Database(scratch_settings.db_path)
        sdb.migrate()
        sdb.ensure_migration_objects()
        run.timed("scratch_schema", t)
        # ---- the restore, through the administrator's code path
        t = time.monotonic()
        with sdb.connection(mode="read", label="backup_drill.before") as conn:
            kept_before = _kept_values(conn)
        try:
            with sdb.connection(label="backup_drill.restore") as conn:
                restored = svc.restore(scratch_settings, conn, path, mode="replace", scope="project+access", actor_user_id=None,
                                       backup_password=None, skip_sensitive=True, process_hooks=False)
        except Exception as exc:  # noqa: BLE001 - a refused / crashing restore is exactly what the drill must report
            run.timed("restore", t)
            run.check("restore", False, f"{type(exc).__name__}: {str(exc)[:200]}")
            return result
        run.timed("restore", t)
        run.check("restore", True)
        result["restore"] = {k: restored.get(k) for k in ("files", "files_skipped", "skipped_unsafe", "kept_current", "roles_pruned", "backgrounds_rejected")} | {
            "sensitive": restored.get("sensitive", {}).get("state"), "sensitive_checked": False if restored.get("sensitive", {}).get("state") == "encrypted" else None}
        # ---- verification
        t = time.monotonic()
        checks = db_checks(scratch_settings.db_path)
        run.check("integrity_check", checks["integrity"] == "ok", None if checks["integrity"] == "ok" else checks["integrity"])
        run.check("foreign_key_check", not checks["fk_violations"], checks["fk_violations"] or None)
        energy_db = scratch / "energy.db"
        if energy_db.exists():
            e = db_checks(energy_db)
            run.check("energy_integrity_check", e["integrity"] == "ok" and not e["fk_violations"], None if e["integrity"] == "ok" and not e["fk_violations"] else e)
        with sdb.connection(mode="read", label="backup_drill.verify") as conn:
            restored_schema = svc.schema_version(conn)
            recorded = {r[0] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()}
            expected_versions = {int(p.name.split("_", 1)[0]) for p in MIGRATIONS_DIR.glob("*.sql")}
            result["schema"] = {"archive": archive_schema, "code": code_schema, "restored": restored_schema}
            missing_versions = sorted(expected_versions - recorded)
            run.check("migration_version", restored_schema == code_schema and not missing_versions,
                      None if not missing_versions else {"missing": missing_versions[:20]})
            # row counts
            in_scope = set(svc.PROJECT_TABLES + svc.ACCESS_TABLES)
            existing = svc._tables(conn)
            mismatched: list[str] = []
            for table, n in sorted((manifest.get("tables") or {}).items()):
                if table not in in_scope or table in svc.NEVER_EXPORTED_TABLES:
                    result["tables"][table] = {"archive": n, "restored": None, "note": "not restored by design"}
                    continue
                if table not in existing:
                    result["tables"][table] = {"archive": n, "restored": None, "note": "table missing in this build"}
                    mismatched.append(table)
                    continue
                skipped = int((restored.get("skipped_unsafe") or {}).get(table, 0))
                if table == "settings":
                    have = sum(1 for r in conn.execute("SELECT key FROM settings").fetchall() if not svc._kept_setting(r[0]))
                else:
                    have = int(conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
                want = int(n) - skipped
                ok = have == want or (table in AUTO_ROW_TABLES and want == 0 and have == AUTO_ROW_TABLES[table])
                result["tables"][table] = {"archive": int(n), "restored": have, "skipped_unsafe": skipped, "ok": ok, "key": table in KEY_TABLES}
                if not ok:
                    mismatched.append(table)
            run.check("row_counts", not mismatched, {"mismatched": mismatched[:20]} if mismatched else None)
            kept_after = _kept_values(conn)
        changed = sorted(k for k in set(kept_before) | set(kept_after) if kept_before.get(k) != kept_after.get(k))
        run.check("kept_settings_untouched", not changed, {"changed": changed[:20]} if changed else None)
        files_expected = int(manifest.get("files") or 0)
        run.check("files_restored", int(restored.get("files") or 0) == files_expected,
                  {"archive": files_expected, "restored": restored.get("files"), "skipped": restored.get("files_skipped")}, severity="warn")
        run.timed("verify", t)
        if all(c["ok"] for c in run.checks if c["severity"] == "fail"):
            result["result"] = "PASS"
        return result
    except Exception as exc:  # noqa: BLE001 - never let the drill itself crash its caller
        log.warning("restore drill crashed", exc_info=True)
        result["error"] = f"{type(exc).__name__}: {str(exc)[:200]}"
        run.check("drill", False, result["error"])
        return result
    finally:
        if scratch is not None:
            from . import energy_store

            energy_store.forget_store(scratch / energy_store.FILE_NAME)
            if keep_scratch:
                result["scratch_dir"] = str(scratch)
            else:
                shutil.rmtree(scratch, ignore_errors=True)
        run.timed("total", t_total)
        result["checks"] = run.checks
        result["timings_ms"] = run.timings
        result["finished_at"] = _iso(_now())
        if result["result"] != "PASS":
            log.warning("restore drill FAILED: %s", ", ".join(c["name"] for c in run.checks if not c["ok"] and c["severity"] == "fail") or result["error"])
        else:
            log.info("restore drill PASS (%s, %d ms)", (result.get("archive") or {}).get("name"), run.timings.get("total", 0))
        if write_result:
            try:
                record(settings, result)
            except OSError:
                log.warning("restore drill result could not be written", exc_info=True)


# ---------------------------------------------------------------- background run and the monthly schedule


def start_background(settings: Settings, archive: Path | None = None, trigger: str = "manual", *, db: Database | None = None,
                     offbox_target: str | None = None) -> bool:
    """Start a drill on a thread of its own (the API answers 202 at once). False when one is running already. `offbox_target`
    (with `db`): drill the newest encrypted copy at that target instead of a local archive."""
    if running():
        return False

    def _go() -> None:
        try:
            if offbox_target and db is not None:
                run_offbox_drill(db, settings, offbox_target, trigger=trigger)
            else:
                run_drill(settings, archive, trigger=trigger)
        except DrillBusy:
            pass

    threading.Thread(target=_go, name="backup-drill", daemon=True).start()
    return True


def schedule_enabled(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, SCHEDULE_KEY) or "false") == "true"


def next_due(last: dict[str, Any] | None) -> dt.datetime | None:
    """When the monthly drill is due again (None = due now: no drill ever ran)."""
    if not last or not isinstance(last.get("finished_at"), str):
        return None
    try:
        t = dt.datetime.fromisoformat(last["finished_at"].replace("Z", "+00:00"))
    except ValueError:
        return None
    return t + dt.timedelta(seconds=MONTHLY_S)


def due(enabled: bool, last: dict[str, Any] | None, now: dt.datetime) -> bool:
    if not enabled:
        return False
    nxt = next_due(last)
    return nxt is None or now >= nxt


def offbox_drill_targets(db: Database, settings: Settings) -> list[str]:
    """Phase 2: the enabled off-box targets whose copies this installation can open (the keyring holds a key)."""
    from . import offbox_keys, offbox_store

    try:
        if not offbox_keys.load(Path(settings.data_dir)).keys:
            return []
        with db.connection(mode="read", label="backup_drill.offbox_targets") as conn:
            return [t["id"] for t in offbox_store.list_targets(conn, enabled_only=True)]
    except Exception:  # noqa: BLE001 - a database before migration 0136 / an unreadable keyring: no off-box drill
        return []


def monthly_tick(db: Database, settings: Settings, now: dt.datetime | None = None) -> dict[str, Any] | None:
    """One check of the schedule: runs the drill (blocking) when it is switched on and due - the local archive, then (phase 2) the
    newest encrypted copy of every enabled off-box target, when the keyring holds a key. Returns the local result or None."""
    with db.connection(mode="read", label="backup_drill.schedule") as conn:
        enabled = schedule_enabled(conn)
    if not due(enabled, read_last(settings), now or _now()):
        return None
    try:
        local = run_drill(settings, trigger="monthly")
    except DrillBusy:
        return None
    for target_id in offbox_drill_targets(db, settings):
        try:
            run_offbox_drill(db, settings, target_id, trigger="monthly")
        except DrillBusy:
            break
    return local


async def monthly_loop(db: Database, settings: Settings, interval_s: int = CHECK_EVERY_S) -> None:
    """Checks the schedule every few hours; the drill itself is OFF until an administrator switches it on."""
    from starlette.concurrency import run_in_threadpool

    while True:
        await asyncio.sleep(interval_s)
        try:
            await run_in_threadpool(monthly_tick, db, settings)
        except Exception as exc:  # noqa: BLE001 - keep the loop alive
            log.warning("monthly restore drill check failed: %s", type(exc).__name__)


# ---------------------------------------------------------------- command line


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="backup_drill", description="Restore a project backup into a scratch directory and verify it.")
    ap.add_argument("--data-dir", default=os.environ.get("SW_DATA_DIR") or "/data", help="the installation's data directory (default: SW_DATA_DIR or /data)")
    ap.add_argument("--archive", help="the archive to drill (default: the newest valid one in <data-dir>/backups)")
    ap.add_argument("--keep-scratch", action="store_true", help="leave the scratch directory for inspection")
    ap.add_argument("--no-record", action="store_true", help="do not write <data-dir>/backup_drill/last.json")
    ap.add_argument("--json", action="store_true", help="print the whole result as JSON")
    args = ap.parse_args(argv)
    data_dir = Path(args.data_dir)
    if not data_dir.is_dir():
        print(f"data directory not found: {data_dir}", file=sys.stderr)
        return 2
    result = run_drill(minimal_settings(data_dir), Path(args.archive) if args.archive else None, trigger="cli",
                       keep_scratch=args.keep_scratch, write_result=not args.no_record)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=1))
    else:
        a = result.get("archive") or {}
        print(f"restore drill: {result['result']}  archive={a.get('name')}  schema={result.get('schema')}")
        for c in result["checks"]:
            mark = "ok  " if c["ok"] else ("WARN" if c["severity"] == "warn" else "FAIL")
            print(f"  [{mark}] {c['name']}" + (f"  {json.dumps(c['detail'], ensure_ascii=False)}" if "detail" in c else ""))
        print("  timings_ms: " + ", ".join(f"{k}={v}" for k, v in result["timings_ms"].items()))
        if result.get("scratch_dir"):
            print(f"  scratch kept at {result['scratch_dir']}")
    return 0 if result["result"] == "PASS" else 1


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    raise SystemExit(main())
