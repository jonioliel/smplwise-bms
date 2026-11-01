"""OFFBOX-RESTORE-2300: restore a live installation FROM an encrypted off-box copy (disaster recovery on a fresh or an existing install).

Until now the product pushed encrypted copies off-box (services/backup_offbox.py) and could PROVE one opens (the restore drill, into a
scratch directory) - but nothing carried a copy back into a running installation. This module is that path. It reuses everything that
already exists and adds only the glue:

  list_copies(dest)        what the destination holds, newest first (names + sizes + the time stamp the name carries)
  prepare(dest, name, ...) STEP 1. Download the copy, check its hash (when the operator supplies the one the upload recorded),
                           decrypt it with the keyring (the key the header names - a wrong key is `key_mismatch`, a changed or
                           truncated copy is `sealed_damaged`), check the zip (CRC of every member), read the manifest, refuse a
                           schema newer than this installation (`schema_newer`) and a disk that cannot hold it (`disk_insufficient`).
                           The verified archive is STAGED under <data>/offbox_restore/<stage id>/ with a small meta file; nothing in
                           the database or the project files is touched.
  restore_staged(...)      STEP 2 (after an explicit confirmation by the caller). Re-checks the staged archive's hash, writes a
                           PRE-RESTORE SAFETY ARCHIVE (kind `auto-pre-restore`, kept in backups/), then calls the existing
                           `backup.restore` - so the schema-newer refusal, the encrypted sensitive section and its password, the
                           allow-listed files, door-block disarming, the capture-lease cancellation and the revocation-stream reset
                           are exactly the ones every other restore gets.

Nothing here writes to the off-box destination. Credentials are never logged or returned; errors are fixed codes (`OffboxError.code`)
that the API and the command line translate. One transfer at a time per process (`offbox_runtime._LOCK`)."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import re
import secrets
import shutil
import sqlite3
import time
import zipfile
from pathlib import Path
from typing import Any

from ..config import Settings
from . import backup as backup_svc
from . import backup_sensitive as sens
from . import offbox_keys, restore_safety
from .backup_offbox import OBJECT_RE, STAMP_RE, Destination, OffboxError, check_name, header_key_id, open_file, sha256_file

log = logging.getLogger("smplwise.backup.offbox.restore")

STAGE_DIR = "offbox_restore"
STAGE_TTL_S = 30 * 60
STAGE_ID_RE = re.compile(r"^[0-9a-f]{16}$")
SPACE_MARGIN_BYTES = 64 * 1024 * 1024
SAFETY_KIND = restore_safety.SAFETY_KIND
SHA_RE = re.compile(r"^[0-9a-f]{64}$")


def stage_root(settings: Settings) -> Path:
    d = Path(settings.data_dir) / STAGE_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def free_bytes(path: Path) -> int:
    """Free space on the volume holding `path`. Tests replace this to simulate a full disk."""
    return shutil.disk_usage(path).free


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _iso(t: dt.datetime) -> str:
    return t.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stamp_of(name: str) -> str | None:
    """The archive time stamp a copy's name carries, as an ISO instant (UTC), or None."""
    m = STAMP_RE.search(name)
    if not m:
        return None
    try:
        return _iso(dt.datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S").replace(tzinfo=dt.timezone.utc))
    except ValueError:
        return None


# ---------------------------------------------------------------- listing


def list_copies(dest: Destination) -> list[dict[str, Any]]:
    """The copies at `dest`, newest first. Raises OffboxError for a destination problem."""
    try:
        objects = dest.list()
    except OffboxError:
        raise
    except Exception as exc:  # noqa: BLE001 - a transport library's own error: named by type only
        raise OffboxError("transport_error", type(exc).__name__) from None
    rows = [{"name": o.name, "bytes": int(o.size), "stamp": stamp_of(o.name)} for o in objects if OBJECT_RE.fullmatch(o.name)]
    rows.sort(key=lambda r: (r["stamp"] or "", r["name"]), reverse=True)
    return rows


# ---------------------------------------------------------------- step 1: download, decrypt, verify, stage


def _meta_path(d: Path) -> Path:
    return d / "meta.json"


def _check_zip(path: Path) -> dict[str, Any]:
    """The archive-level checks: a readable zip whose members' CRCs match, a Arx manifest of format 1. Returns the manifest."""
    try:
        with zipfile.ZipFile(path) as z:
            try:
                bad = z.testzip()
            except Exception as exc:  # noqa: BLE001 - a broken deflate stream raises zlib.error
                raise OffboxError("archive_invalid", f"unreadable member ({type(exc).__name__})") from None
            if bad:
                raise OffboxError("archive_invalid", "a member of the archive is damaged")
            needed = 2 * sum(i.file_size for i in z.infolist()) + SPACE_MARGIN_BYTES
        manifest = backup_svc.read_manifest(path)
    except (ValueError, zipfile.BadZipFile, KeyError, OSError) as exc:
        raise OffboxError("archive_invalid", f"not a valid Arx backup ({type(exc).__name__})") from None
    manifest["_needed_bytes"] = needed
    return manifest


def prepare(dest: Destination, name: str, settings: Settings, *, current_schema: int, keys: dict[str, bytes] | None = None,
            expected_sealed_sha256: str | None = None, actor: str | None = None, target_id: str | None = None) -> dict[str, Any]:
    """STEP 1 (see the module text). Returns the staged copy's summary (stage id, object, key id, hashes, sizes, the manifest's
    app version / schema / kind / created_at / table counts, `warnings`). Raises OffboxError; on any failure the partial files are
    removed. Never touches the database."""
    name = check_name(name)
    if expected_sealed_sha256 is not None and not SHA_RE.fullmatch(expected_sealed_sha256.strip().lower()):
        raise OffboxError("hash_invalid", "the expected hash must be 64 hexadecimal characters")
    keys = keys if keys is not None else offbox_keys.load(Path(settings.data_dir)).key_map()
    if not keys:
        raise OffboxError("key_missing", "this installation holds no off-box key; import the exported key first")
    t0 = time.monotonic()
    purge_stale(settings)
    copies = {c["name"]: c for c in list_copies(dest)}
    if name not in copies:
        raise OffboxError("object_missing", "the destination holds no such copy")
    size = copies[name]["bytes"]
    root = stage_root(settings)
    if free_bytes(root) < 2 * size + SPACE_MARGIN_BYTES:  # the sealed copy and its decrypted archive side by side
        raise OffboxError("disk_insufficient", "not enough free disk space to download and decrypt the copy")
    stage_id = secrets.token_hex(8)
    d = root / stage_id
    d.mkdir()
    try:
        sealed, archive = d / name, d / "archive.zip"
        try:
            dest.get(name, sealed)
        except OffboxError:
            raise
        except OSError as exc:
            raise OffboxError("io_error", type(exc).__name__) from None
        except Exception as exc:  # noqa: BLE001
            raise OffboxError("transport_error", type(exc).__name__) from None
        sealed_sha = sha256_file(sealed)
        if expected_sealed_sha256 and sealed_sha != expected_sealed_sha256.strip().lower():
            raise OffboxError("verify_hash_mismatch", "the downloaded copy does not match the expected hash")
        kid = header_key_id(sealed)  # `sealed_invalid` for a file that is not an SWXB copy
        info = open_file(sealed, archive, keys)  # key_mismatch / sealed_invalid / sealed_damaged; the plain output is removed on error
        sealed.unlink(missing_ok=True)
        manifest = _check_zip(archive)
        schema = int(manifest.get("schema_version") or 0)
        if schema > current_schema:
            raise OffboxError("schema_newer", f"the copy's schema {schema} is newer than this installation ({current_schema}); update the add-on first")
        needed = manifest.pop("_needed_bytes")
        if free_bytes(Path(settings.data_dir)) < needed:
            raise OffboxError("disk_insufficient", "not enough free disk space to restore the copy")
        warnings: list[str] = []
        if (manifest.get("sensitive") or {}).get("state") == "encrypted":
            warnings.append("backup_password_required")
        elif (manifest.get("sensitive") or {}).get("state") == "omitted":
            warnings.append("local_passwords_not_in_copy")
        meta = {"id": stage_id, "object": name, "target_id": target_id, "actor": actor, "created_at": _iso(_now()), "key_id": kid,
                "sealed_sha256": sealed_sha, "sealed_bytes": size, "plain_sha256": info["plain_sha256"], "plain_bytes": info["plain_bytes"],
                "app_version": manifest.get("app_version"), "schema_version": schema, "kind": manifest.get("kind"),
                "archive_created_at": manifest.get("created_at"), "tables": manifest.get("tables") or {}, "files": manifest.get("files", 0),
                "sensitive": (manifest.get("sensitive") or {}).get("state"), "warnings": warnings}
        _meta_path(d).write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
        meta["timings_ms"] = {"total": int(round((time.monotonic() - t0) * 1000))}
        return meta
    except BaseException:
        shutil.rmtree(d, ignore_errors=True)
        raise


def purge_stale(settings: Settings) -> int:
    """Remove staged copies older than the time-to-live (and any directory without a readable meta). Returns how many."""
    n = 0
    root = Path(settings.data_dir) / STAGE_DIR
    if not root.is_dir():
        return 0
    now = time.time()
    for d in root.iterdir():
        if not d.is_dir():
            continue
        try:
            fresh = now - _meta_path(d).stat().st_mtime < STAGE_TTL_S
        except OSError:
            fresh = now - d.stat().st_mtime < STAGE_TTL_S  # a download in flight has no meta yet
        if not fresh:
            shutil.rmtree(d, ignore_errors=True)
            n += 1
    return n


def discard(settings: Settings, stage_id: str) -> bool:
    if not STAGE_ID_RE.fullmatch(stage_id or ""):
        return False
    d = Path(settings.data_dir) / STAGE_DIR / stage_id
    existed = d.is_dir()
    shutil.rmtree(d, ignore_errors=True)
    return existed


def load_stage(settings: Settings, stage_id: str) -> tuple[dict[str, Any], Path]:
    """The staged copy: (meta, archive path). `stage_missing` (unknown id / expired / discarded), `stage_changed` (the staged archive no
    longer hashes to what was verified)."""
    if not STAGE_ID_RE.fullmatch(stage_id or ""):
        raise OffboxError("stage_missing", "no such staged copy")
    purge_stale(settings)
    d = Path(settings.data_dir) / STAGE_DIR / stage_id
    try:
        meta = json.loads(_meta_path(d).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise OffboxError("stage_missing", "no such staged copy (it may have expired)") from None
    archive = d / "archive.zip"
    if not archive.is_file() or sha256_file(archive) != meta.get("plain_sha256"):
        raise OffboxError("stage_changed", "the staged copy changed after it was verified")
    return meta, archive


# ---------------------------------------------------------------- step 2: safety archive + the existing restore


def restore_staged(settings: Settings, conn: sqlite3.Connection, stage_id: str, *, mode: str = "replace", scope: str | None = None,
                   actor_user_id: str | None = None, backup_password: str | None = None, skip_sensitive: bool = False,
                   safety_password: str | None = None, process_hooks: bool = True) -> dict[str, Any]:
    """STEP 2. The caller has obtained the operator's explicit confirmation. Writes the pre-restore safety archive, runs
    `backup.restore` in the caller's transaction and, on success, removes the stage. Returns {"safety": <entry>, "meta": ..., "result": ...}.
    Anything `backup.restore` raises (ValueError, SensitiveError) propagates AFTER the safety archive made for this attempt is removed
    again and with the stage kept, so the operator can retry (a password typed wrongly) without downloading again. `scope=None` takes the
    setting `backup.offbox_restore_scope` (default "project+access"); the scope used is returned as "scope"."""
    scope = scope or restore_safety.default_scope(conn)
    meta, archive = load_stage(settings, stage_id)
    if int(meta.get("schema_version") or 0) > backup_svc.schema_version(conn):
        raise OffboxError("schema_newer", "the staged copy is newer than this installation; update the add-on first")
    restore_safety.check_password(conn, safety_password)  # `safety_password_*` before anything is written
    try:
        safety = restore_safety.write(settings, conn, f"before restore from off-box copy {meta.get('object')}", safety_password)
    except (OffboxError, sens.SensitiveError):
        raise
    except Exception as exc:  # noqa: BLE001 - a restore without its way back is never started
        raise OffboxError("safety_failed", f"the pre-restore safety archive could not be written ({type(exc).__name__})") from None
    try:
        result = backup_svc.restore(settings, conn, archive, mode, scope, actor_user_id=actor_user_id, backup_password=backup_password,
                                    skip_sensitive=skip_sensitive, process_hooks=process_hooks)
    except BaseException:
        restore_safety.remove(settings, safety)
        raise
    backup_svc.prune(settings)
    discard(settings, stage_id)
    return {"safety": restore_safety.summary(safety), "meta": meta, "result": result, "scope": scope}


# ---------------------------------------------------------------- from a saved target (the API's way in)


def _transfer_lock():
    from . import offbox_runtime

    return offbox_runtime._LOCK


def list_target_copies(db: Any, settings: Settings, target_id: str) -> list[dict[str, Any]]:
    from . import offbox_runtime

    if not _transfer_lock().acquire(blocking=False):
        raise OffboxError("push_running", "another off-box transfer is running")
    try:
        target, lookup = offbox_runtime._load(db, settings, target_id)
        dest = offbox_runtime._build(target, settings, lookup)
        try:
            return list_copies(dest)
        finally:
            dest.close()
    finally:
        _transfer_lock().release()


def prepare_from_target(db: Any, settings: Settings, target_id: str, name: str, *, current_schema: int, expected_sealed_sha256: str | None = None,
                        actor: str | None = None) -> dict[str, Any]:
    from . import offbox_runtime

    if not _transfer_lock().acquire(blocking=False):
        raise OffboxError("push_running", "another off-box transfer is running")
    try:
        target, lookup = offbox_runtime._load(db, settings, target_id)
        dest = offbox_runtime._build(target, settings, lookup)
        try:
            return prepare(dest, name, settings, current_schema=current_schema, expected_sealed_sha256=expected_sealed_sha256, actor=actor,
                           target_id=target_id)
        finally:
            dest.close()
    finally:
        _transfer_lock().release()


# ---------------------------------------------------------------- the command line (a fresh installation, the UI not configured yet)


def _read_secret_text(env_name: str | None, file_path: str | None) -> str | None:
    """A value from an environment variable or a file - never from the command line itself (shell history, process list)."""
    import os

    if env_name:
        v = os.environ.get(env_name)
        if not v:
            raise OffboxError("credential_missing", f"environment variable {env_name} is not set")
        return v.strip()
    if file_path:
        try:
            return Path(file_path).read_text(encoding="utf-8").strip()
        except OSError:
            raise OffboxError("credential_missing", "the file could not be read") from None
    return None


def _destination(args: Any, settings: Settings, db: Any) -> tuple[Destination, str | None]:
    from . import offbox_runtime
    from .backup_offbox import build_destination

    if args.dest_json:
        try:
            cfg = json.loads(Path(args.dest_json).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raise OffboxError("destination_invalid", "the destination file could not be read as JSON") from None
        # credentials are references only (env:NAME or file:/absolute/path); `store:` needs a saved target (--target-id)
        return build_destination(cfg, data_dir=Path(settings.data_dir),
                                 s3_client=offbox_runtime.S3_CLIENT, sftp_client=offbox_runtime.SFTP_CLIENT,
                                 gdrive_http=offbox_runtime.GDRIVE_HTTP), None
    if not args.target_id:
        raise OffboxError("destination_invalid", "give --target-id (a target saved in this installation) or --dest-json FILE")
    target, lookup = offbox_runtime._load(db, settings, args.target_id)
    return offbox_runtime._build(target, settings, lookup), args.target_id


def _pick(dest: Destination, args: Any) -> str:
    if args.object:
        return check_name(args.object)
    copies = list_copies(dest)
    if not copies:
        raise OffboxError("object_missing", "the destination holds no copy")
    return copies[0]["name"]


def main(argv: list[str] | None = None) -> int:
    import argparse
    import os
    import sys

    from ..db import Database
    from .backup_drill import code_schema_version, minimal_settings

    ap = argparse.ArgumentParser(prog="offbox_restore", description="List, fetch and restore encrypted off-box backup copies "
                                 "(works on a fresh installation: no UI needed). Credentials are read from files / environment variables only.")
    ap.add_argument("command", choices=["list", "fetch", "restore", "import-key"])
    ap.add_argument("--data-dir", default=os.environ.get("SW_DATA_DIR") or "/data")
    ap.add_argument("--target-id", help="a target saved in this installation (uses its sealed credentials)")
    ap.add_argument("--dest-json", help="a destination configuration file with credential REFERENCES (env:NAME / file:/abs/path), "
                    "for an installation that has no saved target yet")
    ap.add_argument("--object", help="the copy to use (see `list`); default: the newest")
    ap.add_argument("--expected-sha256", help="the sealed copy's SHA-256, when you recorded it")
    ap.add_argument("--key-env", help="NAME of an environment variable holding the exported key (SWXB-KEY-1:...)")
    ap.add_argument("--key-file", help="a file holding the exported key")
    ap.add_argument("--password-env", help="NAME of an environment variable holding the backup password of the copy's encrypted section")
    ap.add_argument("--skip-sensitive", action="store_true", help="restore without the encrypted section (local accounts then need an administrator link)")
    ap.add_argument("--mode", choices=["replace", "merge"], default="replace")
    ap.add_argument("--scope", choices=list(restore_safety.SCOPES), default=None,
                    help="default: the installation's setting backup.offbox_restore_scope (project+access when unset)")
    ap.add_argument("--out", help="fetch: where to write the verified, decrypted archive (.zip)")
    ap.add_argument("--confirm", default="", help="restore: must be RESTORE")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    data_dir = Path(args.data_dir)
    if not data_dir.is_dir():
        print(f"data directory not found: {data_dir}", file=sys.stderr)
        return 2
    settings = minimal_settings(data_dir)

    def say(obj: Any, text: str) -> None:
        print(json.dumps(obj, ensure_ascii=False, indent=1) if args.json else text)

    try:
        key_text = _read_secret_text(args.key_env, args.key_file)
        if key_text:
            kid = offbox_keys.import_key(data_dir, key_text)
            say({"key_imported": kid}, f"key {kid} added to the keyring")
        if args.command == "import-key":
            return 0 if key_text else 2
        if args.command == "restore" and args.confirm != "RESTORE":
            print("restore is destructive: add --confirm RESTORE (stop the add-on first, or restart it right after)", file=sys.stderr)
            return 2
        db = Database(settings.db_path)
        if args.command == "restore":
            db.migrate()  # a fresh data directory gets its schema first; an existing one is already current
        dest, target_id = _destination(args, settings, db)
        try:
            if args.command == "list":
                rows = list_copies(dest)
                say({"copies": rows}, "\n".join(f"{r['name']}  {r['bytes']} bytes  {r['stamp'] or '-'}" for r in rows) or "(no copies)")
                return 0
            name = _pick(dest, args)
            if args.command == "restore":
                with db.connection() as conn:
                    schema = backup_svc.schema_version(conn)
            else:
                schema = code_schema_version()
            meta = prepare(dest, name, settings, current_schema=schema, expected_sealed_sha256=args.expected_sha256, actor=None, target_id=target_id)
        finally:
            dest.close()
        summary = {k: meta[k] for k in ("id", "object", "key_id", "sealed_sha256", "plain_sha256", "plain_bytes", "app_version", "schema_version",
                                        "kind", "archive_created_at", "sensitive", "warnings")}
        if args.command == "fetch":
            if not args.out:
                discard(settings, meta["id"])
                say({"verified": summary}, f"verified: {name} (key {meta['key_id']}, schema {meta['schema_version']}); give --out FILE to keep the archive")
                return 0
            shutil.copyfile(Path(settings.data_dir) / STAGE_DIR / meta["id"] / "archive.zip", args.out)
            discard(settings, meta["id"])
            say({"verified": summary, "out": args.out}, f"verified and written: {args.out}")
            return 0
        password = os.environ.get(args.password_env) if args.password_env else None
        with db.connection() as conn:
            args.scope = args.scope or restore_safety.default_scope(conn)
            out = restore_staged(settings, conn, meta["id"], mode=args.mode, scope=args.scope, actor_user_id=None, backup_password=password,
                                 skip_sensitive=args.skip_sensitive, process_hooks=False)
            from ..audit import audit

            audit(conn, actor=None, action="backup.offbox.restore", decision="allowed", resource_type="backup_offbox_target", resource_id=target_id or "",
                  details={"object": name, "key_id": meta["key_id"], "safety": out["safety"]["name"], "mode": args.mode, "scope": args.scope,
                           "tables": out["result"]["tables"], "files": out["result"]["files"], "via": "cli"})
        say({"restored": summary, "safety_archive": out["safety"]["name"], "tables": out["result"]["tables"], "files": out["result"]["files"]},
            f"restored {name}; pre-restore safety archive: {out['safety']['name']}. RESTART the add-on now (live leases and caches are in memory).")
        return 0
    except sens.SensitiveError as exc:
        print(f"error: {exc.code} (the copy holds an encrypted section: give --password-env NAME, or --skip-sensitive)", file=sys.stderr)
        return 1
    except OffboxError as exc:
        print(f"error: {exc.code}: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"error: restore_refused: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    raise SystemExit(main())
