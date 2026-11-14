"""DATASTORE-295 phase 2: the storage of the off-box targets (migration 0136, built as provisional 0132). All SQL of the three tables lives here.

- targets: the non-secret configuration (`config_json`) and the retention; the credential fields hold `store:offbox.<target>.<field>`
  references, never a value;
- secrets: one sealed value per (target, field) - services/connection_store.seal_app_secret with the name `offbox_<target>_<field>`
  (the installation key in /data/keys; a blob of another target or field never decrypts). `secret_lookup` resolves a `store:`
  reference for the transport, at connect time; nothing here logs or returns a value (`secret_state` answers configured / not);
- runs: codes and counts of each push / test / drill."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Callable

from ..db import new_id, now_iso
from .backup_offbox import CREDENTIAL_FIELDS, OffboxError, RetentionPolicy
from .connection_store import SecretError, open_app_secret, seal_app_secret

SECRET_FIELDS = ("access_key", "secret_key", "key", "client_secret", "refresh_token")  # the last two: gdrive (migration 0186)
RUNS_KEPT = 50


def _secret_name(target_id: str, field: str) -> str:
    # the app-secret associated data allows lowercase letters, digits and `_` (connection_store._app_secret_aad): target ids are
    # 16 lowercase hex (db.new_id), the fields are lowercase words - `offbox_<id>_<field>` is unique per target and field
    return f"offbox_{target_id}_{field}"


def store_ref(target_id: str, field: str) -> str:
    return f"store:offbox.{target_id}.{field}"


def _row(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "name": r["name"], "kind": r["kind"], "enabled": bool(r["enabled"]), "config": json.loads(r["config_json"] or "{}"),
            "retention": json.loads(r["retention_json"] or "{}"), "revision": r["revision"], "created_at": r["created_at"],
            "updated_at": r["updated_at"], "updated_by": r["updated_by"]}


def list_targets(conn: sqlite3.Connection, *, enabled_only: bool = False) -> list[dict[str, Any]]:
    sql = "SELECT * FROM backup_offbox_targets" + (" WHERE enabled = 1" if enabled_only else "") + " ORDER BY created_at, id"
    return [_row(r) for r in conn.execute(sql).fetchall()]


def get_target(conn: sqlite3.Connection, target_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM backup_offbox_targets WHERE id = ?", (target_id,)).fetchone()
    return _row(r) if r else None


def insert_target(conn: sqlite3.Connection, *, name: str, kind: str, enabled: bool, config: dict[str, Any], retention: RetentionPolicy,
                  actor: str | None) -> str:
    tid = new_id()
    now = now_iso()
    cfg = {**config, **{f: store_ref(tid, f) for f in CREDENTIAL_FIELDS.get(kind, ())}}
    conn.execute("INSERT INTO backup_offbox_targets(id, name, kind, enabled, config_json, retention_json, created_at, created_by, updated_at, updated_by) "
                 "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                 (tid, name, kind, int(enabled), json.dumps(cfg), json.dumps(retention.as_dict()), now, actor, now, actor))
    return tid


def update_target(conn: sqlite3.Connection, target_id: str, *, name: str, enabled: bool, config: dict[str, Any], retention: RetentionPolicy,
                  actor: str | None) -> None:
    cur = get_target(conn, target_id)
    if cur is None:
        raise OffboxError("target_missing", "no such target")
    cfg = {**config, **{f: store_ref(target_id, f) for f in CREDENTIAL_FIELDS.get(cur["kind"], ())}}
    conn.execute("UPDATE backup_offbox_targets SET name = ?, enabled = ?, config_json = ?, retention_json = ?, revision = revision + 1, "
                 "updated_at = ?, updated_by = ? WHERE id = ?",
                 (name, int(enabled), json.dumps(cfg), json.dumps(retention.as_dict()), now_iso(), actor, target_id))


def set_enabled(conn: sqlite3.Connection, target_id: str, enabled: bool, actor: str | None) -> None:
    conn.execute("UPDATE backup_offbox_targets SET enabled = ?, revision = revision + 1, updated_at = ?, updated_by = ? WHERE id = ?",
                 (int(enabled), now_iso(), actor, target_id))


def delete_target(conn: sqlite3.Connection, target_id: str) -> bool:
    conn.execute("DELETE FROM backup_offbox_secrets WHERE target_id = ?", (target_id,))
    conn.execute("DELETE FROM backup_offbox_runs WHERE target_id = ?", (target_id,))
    return conn.execute("DELETE FROM backup_offbox_targets WHERE id = ?", (target_id,)).rowcount > 0


# ---- secrets


def set_secret(conn: sqlite3.Connection, data_dir: Path, target_id: str, field: str, value: str, actor: str | None) -> None:
    if field not in SECRET_FIELDS:
        raise OffboxError("secret_field_invalid", "not a secret field")
    if not isinstance(value, str) or not value or len(value) > 16384:
        raise OffboxError("secret_invalid", "a secret must be 1-16384 characters")
    try:
        blob = seal_app_secret(Path(data_dir), _secret_name(target_id, field), value)
    except SecretError:
        raise OffboxError("secret_store_unavailable", "the installation key is not available") from None
    conn.execute("INSERT INTO backup_offbox_secrets(target_id, field, value_enc, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) "
                 "ON CONFLICT(target_id, field) DO UPDATE SET value_enc = excluded.value_enc, updated_at = excluded.updated_at, "
                 "updated_by = excluded.updated_by", (target_id, field, blob, now_iso(), actor))


def clear_secret(conn: sqlite3.Connection, target_id: str, field: str) -> None:
    conn.execute("DELETE FROM backup_offbox_secrets WHERE target_id = ? AND field = ?", (target_id, field))


def secret_state(conn: sqlite3.Connection, target_id: str) -> dict[str, dict[str, Any]]:
    """{field: {configured, updated_at}} - never a value."""
    return {r["field"]: {"configured": True, "updated_at": r["updated_at"]}
            for r in conn.execute("SELECT field, updated_at FROM backup_offbox_secrets WHERE target_id = ?", (target_id,)).fetchall()}


def secret_lookup(conn: sqlite3.Connection, data_dir: Path) -> Callable[[str], str | None]:
    """The resolver of `store:offbox.<target>.<field>` references (read now, opened lazily when the transport connects)."""
    blobs = {(r["target_id"], r["field"]): r["value_enc"] for r in conn.execute("SELECT target_id, field, value_enc FROM backup_offbox_secrets").fetchall()}

    def lookup(name: str) -> str | None:
        parts = name.split(".")
        if len(parts) != 3 or parts[0] != "offbox":
            return None
        blob = blobs.get((parts[1], parts[2]))
        if blob is None:
            return None
        try:
            return open_app_secret(Path(data_dir), _secret_name(parts[1], parts[2]), blob)
        except SecretError:
            return None

    return lookup


# ---- runs


def start_run(conn: sqlite3.Connection, target_id: str, action: str, trigger: str) -> int:
    cur = conn.execute("INSERT INTO backup_offbox_runs(target_id, action, trigger, started_at) VALUES (?, ?, ?, ?)",
                       (target_id, action, trigger, now_iso()))
    return int(cur.lastrowid)


def finish_run(conn: sqlite3.Connection, run_id: int, result: dict[str, Any]) -> None:
    sealed = result.get("sealed") or {}
    detail = {k: result[k] for k in ("timings_ms", "steps", "message", "bad_copy_removed", "dry_run", "objects", "detail", "drill_result") if k in result}
    if isinstance(result.get("plan"), dict):
        detail["plan"] = {"keep": len(result["plan"].get("keep") or []), "delete": len(result["plan"].get("delete") or []),
                          "unmanaged": len(result["plan"].get("unmanaged") or [])}
    conn.execute("UPDATE backup_offbox_runs SET finished_at = ?, ok = ?, error = ?, object = ?, key_id = ?, sealed_bytes = ?, verified = ?, "
                 "deleted_count = ?, detail_json = ? WHERE id = ?",
                 (now_iso(), int(bool(result.get("ok"))), result.get("error"), result.get("object"), sealed.get("key_id"), sealed.get("sealed_bytes"),
                  int(bool(result.get("verified"))), len(result.get("deleted") or []), json.dumps(detail)[:8000], run_id))
    tid = conn.execute("SELECT target_id FROM backup_offbox_runs WHERE id = ?", (run_id,)).fetchone()
    if tid:
        conn.execute("DELETE FROM backup_offbox_runs WHERE target_id = ? AND id NOT IN (SELECT id FROM backup_offbox_runs WHERE target_id = ? "
                     "ORDER BY id DESC LIMIT ?)", (tid[0], tid[0], RUNS_KEPT))


def runs(conn: sqlite3.Connection, target_id: str, limit: int = 10, action: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM backup_offbox_runs WHERE target_id = ?" + (" AND action = ?" if action else "") + " ORDER BY id DESC LIMIT ?"
    args: tuple[Any, ...] = (target_id, action, limit) if action else (target_id, limit)
    return [{"id": r["id"], "action": r["action"], "trigger": r["trigger"], "started_at": r["started_at"], "finished_at": r["finished_at"],
             "ok": bool(r["ok"]), "error": r["error"], "object": r["object"], "key_id": r["key_id"], "sealed_bytes": r["sealed_bytes"],
             "verified": bool(r["verified"]), "deleted_count": r["deleted_count"], "detail": json.loads(r["detail_json"] or "{}")}
            for r in conn.execute(sql, args).fetchall()]
