"""DATASTORE-295 phase 2: running the off-box copies - the push after the daily backup, the push / dry run / connection test an
administrator starts, the failure alert, and fetching a copy back for the restore drill.

Database work is short and never spans network I/O: the target and its sealed credentials are read first (read transaction), the
transfer runs with no transaction open, and the run row + the notification are written afterwards (`write_aside` / a short write).
One transfer at a time per process (`_LOCK`): a second request is `push_running`.

Alert (`backup.offbox_failed`, notify_policy.SOURCES): one row per target (subject `offbox:<target id>`), raised when a push of the
daily backup fails or does not verify, resolved by that target's next verified push. Its text names the target and a short reason -
never an endpoint, a host, a key or a credential. An administrator's own "push now" / "test" answers in the screen instead."""
from __future__ import annotations

import logging
import shutil
import threading
from pathlib import Path
from typing import Any, Callable

from ..config import Settings
from ..db import Database
from . import backup as backup_svc
from . import offbox_keys, offbox_store
from .backup_offbox import CREDENTIAL_FIELDS, Destination, OffboxError, RetentionPolicy, build_destination, check_connection, open_file, push

log = logging.getLogger("smplwise.backup.offbox")

SOURCE = "backup.offbox_failed"
_LOCK = threading.Lock()
# tests inject transports here (a fake S3 / SFTP client factory); None = the real ones
S3_CLIENT: Callable[[Any], Any] | None = None
SFTP_CLIENT: Callable[[Any], Any] | None = None
# GDRIVEBK-2310: tests inject an httpx.Client factory in front of the fake Drive here; None = offbox_gdrive.default_http
GDRIVE_HTTP: Callable[[], Any] | None = None

REASON_HE = {
    "auth_failed": "הפרטים לכניסה נדחו",
    "host_key_mismatch": "מפתח השרת לא תואם למפתח השמור",
    "bucket_missing": "הדלי לא קיים",
    "destination_unavailable": "היעד לא זמין",
    "permission_denied": "אין הרשאת כתיבה ביעד",
    "verify_hash_mismatch": "העותק שהועלה לא תואם",
    "verify_plain_mismatch": "העותק שהועלה לא נפתח כמו המקור",
    "credential_missing": "חסרים פרטי גישה",
    "archive_missing": "אין גיבוי להעלאה",
    "transport_not_available": "רכיב ההעברה לא מותקן",
    # GDRIVEBK-2310: Google Drive
    "quota_exceeded": "אין מספיק מקום פנוי ב־Google Drive",
    "rate_limited": "Google Drive מגביל כרגע את קצב הבקשות; ננסה שוב בגיבוי הבא",
    "gdrive_reconnect_required": "החיבור ל־Google Drive פג או בוטל; יש לחבר מחדש",
    "gdrive_not_connected": "לא חובר חשבון Google",
    "gdrive_client_invalid": "Google דחה את פרטי הלקוח (Client ID / Secret)",
    "gdrive_client_missing": "חסרים פרטי הלקוח של Google",
    "gdrive_scope_refused": "Google לא אישר גישה לתיקיית הגיבוי",
    "remote_error": "תשובה לא צפויה מהיעד",
}


def workdir(settings: Settings) -> Path:
    d = Path(settings.data_dir) / "offbox_tmp"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _build(target: dict[str, Any], settings: Settings, lookup: Callable[[str], str | None]) -> Destination:
    return build_destination({"kind": target["kind"], **target["config"]}, data_dir=Path(settings.data_dir), secret_store=lookup,
                             s3_client=S3_CLIENT, sftp_client=SFTP_CLIENT, gdrive_http=GDRIVE_HTTP)


def _load(db: Database, settings: Settings, target_id: str) -> tuple[dict[str, Any], Callable[[str], str | None]]:
    with db.connection(mode="read", label="offbox.load") as conn:
        t = offbox_store.get_target(conn, target_id)
        if t is None:
            raise OffboxError("target_missing", "no such target")
        return t, offbox_store.secret_lookup(conn, Path(settings.data_dir))


def latest_archive(settings: Settings) -> Path | None:
    d = backup_svc.backups_dir(settings)
    for e in backup_svc.list_backups(settings):
        if e.get("valid"):
            return d / e["name"]
    return None


def view(conn: Any, target: dict[str, Any]) -> dict[str, Any]:
    """What the API shows: the configuration without the credential references, which secrets are set, the last runs."""
    cfg = {k: v for k, v in target["config"].items() if k not in CREDENTIAL_FIELDS.get(target["kind"], ())}
    state = offbox_store.secret_state(conn, target["id"])
    last = {a: (offbox_store.runs(conn, target["id"], 1, a) or [None])[0] for a in ("push", "test", "drill")}
    out = {**{k: target[k] for k in ("id", "name", "kind", "enabled", "retention", "revision", "updated_at")}, "config": cfg,
           "secrets": {f: bool(state.get(f, {}).get("configured")) for f in CREDENTIAL_FIELDS.get(target["kind"], ())},
           "last": last}
    if target["kind"] == "gdrive":  # GDRIVEBK-2310: whether an account is connected / a consent is waiting (never the token)
        from . import offbox_gdrive_connect

        out["gdrive"] = {"connected": out["secrets"].get("refresh_token", False), "pending": offbox_gdrive_connect.pending(target["id"]),
                         "connected_at": state.get("refresh_token", {}).get("updated_at")}
    return out


def _notify(db: Database, target: dict[str, Any], result: dict[str, Any]) -> None:
    from . import notify

    code = result.get("error") or ""
    try:
        with db.connection(label="offbox.notify") as conn:
            if result.get("ok"):
                notify.emit_full(conn, notify.Signal(SOURCE, "system", f"offbox:{target['id']}", resolve=True, params={"name": target["name"]}))
            else:
                notify.emit_full(conn, notify.Signal(SOURCE, "system", f"offbox:{target['id']}",
                                                     params={"name": target["name"], "detail": REASON_HE.get(code, "שגיאה בהעברה")}))
    except Exception:  # noqa: BLE001 - the alert never breaks the backup loop
        log.warning("off-box alert could not be recorded", exc_info=True)


def _record(db: Database, target_id: str, action: str, trigger: str, result: dict[str, Any]) -> None:
    try:
        with db.write_aside(label="offbox.run") as conn:
            run_id = offbox_store.start_run(conn, target_id, action, trigger)
            offbox_store.finish_run(conn, run_id, result)
    except Exception:  # noqa: BLE001
        log.warning("off-box run could not be recorded", exc_info=True)


def run_push(db: Database, settings: Settings, target_id: str, *, trigger: str, archive: Path | None = None, dry_run: bool = False,
             alert: bool | None = None) -> dict[str, Any]:
    """Seal + upload + verify + prune the newest valid backup (or `archive`) to one target. Never raises for a transfer problem:
    the answer says ok / error. `alert` (default: the daily trigger raises / resolves `backup.offbox_failed`, any other trigger only
    resolves it on success)."""
    if not _LOCK.acquire(blocking=False):
        raise OffboxError("push_running", "another off-box transfer is running")
    try:
        target, lookup = _load(db, settings, target_id)
        archive = archive or latest_archive(settings)
        if archive is None:
            result: dict[str, Any] = {"ok": False, "error": "archive_missing", "dry_run": dry_run, "verified": False, "deleted": []}
        else:
            try:
                key = offbox_keys.load(Path(settings.data_dir), create=True).active_key()
                dest = _build(target, settings, lookup)
            except OffboxError as exc:
                result = {"ok": False, "error": exc.code, "dry_run": dry_run, "verified": False, "deleted": [], "object": None}
            else:
                try:
                    result = push(archive, dest, key, policy=RetentionPolicy(**(target["retention"] or {})), dry_run=dry_run,
                                  workdir=workdir(settings))
                finally:
                    dest.close()
        result.pop("destination", None)  # describe() is safe, but the run row and the answer do not need it
        _record(db, target_id, "dry_run" if dry_run else "push", trigger, result)
        # the daily push raises / resolves the alert; an administrator's own push only resolves it (its failure is on the screen)
        if not dry_run and (alert if alert is not None else (trigger == "daily" or bool(result.get("ok")))):
            _notify(db, target, result)
        if not result.get("ok"):
            log.warning("off-box push to target %s (%s): %s", target_id, trigger, result.get("error"))
        return result
    finally:
        _LOCK.release()


def run_check(db: Database, settings: Settings, target_id: str, *, trigger: str = "manual") -> dict[str, Any]:
    """The connection test: a tiny marker written, read back and deleted (backup_offbox.check_connection)."""
    if not _LOCK.acquire(blocking=False):
        raise OffboxError("push_running", "another off-box transfer is running")
    try:
        target, lookup = _load(db, settings, target_id)
        try:
            dest = _build(target, settings, lookup)
        except OffboxError as exc:
            result: dict[str, Any] = {"ok": False, "error": exc.code, "steps": []}
        else:
            try:
                result = check_connection(dest, workdir=workdir(settings))
            finally:
                dest.close()
        result.pop("destination", None)
        _record(db, target_id, "test", trigger, result)
        return result
    finally:
        _LOCK.release()


def after_backup(db: Database, settings: Settings, archive_name: str | None = None) -> list[dict[str, Any]]:
    """Called by the daily backup loop: push the new archive to every enabled target. Never raises."""
    out: list[dict[str, Any]] = []
    try:
        with db.connection(mode="read", label="offbox.targets") as conn:
            targets = offbox_store.list_targets(conn, enabled_only=True)
    except Exception:  # noqa: BLE001 - a database before migration 0136, or a locked moment: the next day tries again
        log.warning("off-box targets could not be read", exc_info=True)
        return out
    archive = backup_svc.backups_dir(settings) / archive_name if archive_name else None
    for t in targets:
        try:
            out.append({"target": t["id"], **run_push(db, settings, t["id"], trigger="daily", archive=archive)})
        except Exception as exc:  # noqa: BLE001
            log.warning("off-box push to target %s failed: %s", t["id"], type(exc).__name__)
            out.append({"target": t["id"], "ok": False, "error": getattr(exc, "code", "push_failed")})
    return out


def fetch_latest_copy(db: Database, settings: Settings, target_id: str, dest_dir: Path) -> dict[str, Any]:
    """The restore drill's source: the newest copy at the target, downloaded and decrypted with the keyring into `dest_dir`.
    Returns {zip, object, key_id, sealed_bytes}; raises OffboxError (no copy, a key the ring does not hold, a damaged copy)."""
    target, lookup = _load(db, settings, target_id)
    keys = offbox_keys.load(Path(settings.data_dir)).key_map()
    if not keys:
        raise OffboxError("key_missing", "this installation holds no off-box key")
    dest = _build(target, settings, lookup)
    try:
        objects = dest.list()
        if not objects:
            raise OffboxError("object_missing", "the target holds no copy")
        newest = max(objects, key=lambda o: (_stamp(o.name), o.name))  # names carry the archive's time stamp
        sealed = Path(dest_dir) / newest.name
        dest.get(newest.name, sealed)
    finally:
        dest.close()
    out = Path(dest_dir) / newest.name.removesuffix(".swxb")
    opened = open_file(sealed, out, keys)
    size = sealed.stat().st_size
    sealed.unlink(missing_ok=True)
    return {"zip": out, "object": newest.name, "key_id": opened["key_id"], "sealed_bytes": size}


def _stamp(name: str) -> str:
    from .backup_offbox import STAMP_RE

    m = STAMP_RE.search(name)
    return (m.group(1) + m.group(2)) if m else ""


def clear_tmp(settings: Settings) -> None:
    shutil.rmtree(Path(settings.data_dir) / "offbox_tmp", ignore_errors=True)
