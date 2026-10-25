"""CR-NOTICE106 - the tables of migration 0165: notices, boards, board items, read marks."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import secrets
import sqlite3
from typing import Any

from ...db import get_setting, new_id, now_iso, set_setting
from . import model
from .model import Invalid

log = logging.getLogger(__name__)


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def settings(conn: sqlite3.Connection) -> dict[str, Any]:
    return model.settings_doc(lambda k, d: get_setting(conn, k, d))


def module_on(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, "notices.enabled", "false") or "false") == "true"


def write_settings(conn: sqlite3.Connection, values: dict[str, str]) -> dict[str, str]:
    """Stores the validated strings; returns {key: new value} for the keys that really changed."""
    changed: dict[str, str] = {}
    for k, v in values.items():
        if (get_setting(conn, k, model.SETTINGS_DEFAULTS[k]) or model.SETTINGS_DEFAULTS[k]) != v:
            set_setting(conn, k, v)
            changed[k] = v
    return changed


# ---------------------------------------------------------------- notices

def _row(r: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(r) if r is not None else None


def get_notice(conn: sqlite3.Connection, notice_id: str) -> dict[str, Any] | None:
    return _row(conn.execute("SELECT * FROM notices WHERE id = ? AND deleted_at IS NULL", (notice_id,)).fetchone())


def list_notices(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM notices WHERE deleted_at IS NULL").fetchall()]


def boards_of(conn: sqlite3.Connection, notice_ids: list[str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {n: [] for n in notice_ids}
    if not notice_ids:
        return out
    marks = ",".join("?" * len(notice_ids))
    for r in conn.execute(f"""SELECT i.notice_id, i.board_id FROM notice_board_items i JOIN notice_boards b ON b.id = i.board_id
                               WHERE b.deleted_at IS NULL AND i.notice_id IN ({marks}) ORDER BY b.name""", notice_ids).fetchall():
        out[r["notice_id"]].append(r["board_id"])
    return out


def sort_key(n: dict[str, Any]) -> tuple:
    """Pinned first, then by severity (critical first), then the newest start (section 8.5 rotation order)."""
    rank = {"critical": 0, "alert": 1, "info": 2}.get(n.get("severity"), 3)
    start = model.parse_iso(n.get("starts_at")) or utcnow()
    return (0 if n.get("pinned") else 1, rank, -start.timestamp(), n.get("id", ""))


def validate_window(severity: str, starts_at: dt.datetime, ends_at: dt.datetime | None) -> None:
    if ends_at is not None and ends_at <= starts_at:
        raise Invalid("ends_at", "סיום התוקף חייב להיות אחרי ההתחלה.")
    if severity == "critical" and ends_at is None:
        raise Invalid("ends_at", "הודעה דחופה חייבת תאריך סיום.")


def create_notice(conn: sqlite3.Connection, actor: str, data: dict[str, Any]) -> dict[str, Any]:
    nid = new_id()
    now = now_iso()
    conn.execute(
        """INSERT INTO notices(id, title, body, severity, status, starts_at, ends_at, pinned, dwell_s, when_text, audience_json,
                               created_by, created_at, updated_by, updated_at, push_requested)
           VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (nid, data["title"], data["body"], data["severity"], data["starts_at"], data["ends_at"], 1 if data["pinned"] else 0,
         data["dwell_s"], data["when_text"] or None, json.dumps(data["audience"], ensure_ascii=False), actor, now, actor, now, 1 if data.get("push_requested") else 0))
    if data.get("boards") is not None:
        set_notice_boards(conn, nid, data["boards"])
    return get_notice(conn, nid)  # type: ignore[return-value]


def update_notice(conn: sqlite3.Connection, notice_id: str, actor: str, data: dict[str, Any]) -> dict[str, Any]:
    cols = {k: data[k] for k in ("title", "body", "severity", "starts_at", "ends_at", "dwell_s", "when_text") if k in data}
    if "pinned" in data:
        cols["pinned"] = 1 if data["pinned"] else 0
    if "push_requested" in data:
        cols["push_requested"] = 1 if data["push_requested"] else 0
    if "audience" in data:
        cols["audience_json"] = json.dumps(data["audience"], ensure_ascii=False)
    if "when_text" in cols:
        cols["when_text"] = cols["when_text"] or None
    cols["updated_by"], cols["updated_at"] = actor, now_iso()
    sets = ", ".join(f"{k} = ?" for k in cols)
    conn.execute(f"UPDATE notices SET {sets} WHERE id = ?", (*cols.values(), notice_id))
    if data.get("boards") is not None:
        set_notice_boards(conn, notice_id, data["boards"])
    touch_boards_of(conn, notice_id)
    return get_notice(conn, notice_id)  # type: ignore[return-value]


def publish(conn: sqlite3.Connection, notice_id: str, actor: str) -> None:
    now = now_iso()
    conn.execute("UPDATE notices SET status = 'published', published_at = COALESCE(published_at, ?), updated_by = ?, updated_at = ? WHERE id = ?",
                 (now, actor, now, notice_id))
    touch_boards_of(conn, notice_id)


def archive(conn: sqlite3.Connection, notice_id: str, actor: str) -> None:
    now = now_iso()
    conn.execute("UPDATE notices SET status = 'archived', archived_at = ?, updated_by = ?, updated_at = ? WHERE id = ?", (now, actor, now, notice_id))
    touch_boards_of(conn, notice_id)
    # a hold on an archived notice ends with it (section 8.6: a hold never outlives the notice)
    for b in conn.execute("SELECT id, display_json FROM notice_boards WHERE deleted_at IS NULL").fetchall():
        d = model.load_display(b["display_json"])
        if d.get("hold") == notice_id:
            d["hold"] = ""
            conn.execute("UPDATE notice_boards SET display_json = ?, updated_at = ? WHERE id = ?", (json.dumps(d, ensure_ascii=False), now, b["id"]))


def delete_draft(conn: sqlite3.Connection, notice_id: str) -> None:
    conn.execute("DELETE FROM notice_board_items WHERE notice_id = ?", (notice_id,))
    conn.execute("DELETE FROM notice_reads WHERE notice_id = ?", (notice_id,))
    conn.execute("DELETE FROM notices WHERE id = ? AND status = 'draft'", (notice_id,))


def delete_notice(conn: sqlite3.Connection, notice_id: str) -> None:
    """NOTICEDEL-295: the real deletion of a notice of any status. The boards that carried it are touched FIRST (their `updated_at` is part of
    the feed's version, so the TVs refresh at once), a hold on it ends (as in archive), then its board links, its read marks and the notice
    row go. Nothing else keys on a notice id except the open notification of its push, which the caller resolves (services/notices/push.py)."""
    now = now_iso()
    touch_boards_of(conn, notice_id)
    for b in conn.execute("SELECT id, display_json FROM notice_boards WHERE deleted_at IS NULL").fetchall():
        d = model.load_display(b["display_json"])
        if d.get("hold") == notice_id:
            d["hold"] = ""
            conn.execute("UPDATE notice_boards SET display_json = ?, updated_at = ? WHERE id = ?", (json.dumps(d, ensure_ascii=False), now, b["id"]))
    conn.execute("DELETE FROM notice_board_items WHERE notice_id = ?", (notice_id,))
    conn.execute("DELETE FROM notice_reads WHERE notice_id = ?", (notice_id,))
    conn.execute("DELETE FROM notices WHERE id = ?", (notice_id,))


def mark_read(conn: sqlite3.Connection, notice_id: str, user_id: str) -> None:
    conn.execute("INSERT OR IGNORE INTO notice_reads(notice_id, user_id, read_at) VALUES (?, ?, ?)", (notice_id, user_id, now_iso()))


def read_ids(conn: sqlite3.Connection, user_id: str) -> set[str]:
    return {r[0] for r in conn.execute("SELECT notice_id FROM notice_reads WHERE user_id = ?", (user_id,)).fetchall()}


def read_counts(conn: sqlite3.Connection) -> dict[str, int]:
    return {r[0]: r[1] for r in conn.execute("SELECT notice_id, COUNT(*) FROM notice_reads GROUP BY notice_id").fetchall()}


def set_notice_boards(conn: sqlite3.Connection, notice_id: str, board_ids: list[str]) -> None:
    known = {r[0] for r in conn.execute("SELECT id FROM notice_boards WHERE deleted_at IS NULL").fetchall()}
    unknown = [b for b in board_ids if b not in known]
    if unknown:
        raise Invalid("boards", "לוח תצוגה לא נמצא.")
    before = {r[0] for r in conn.execute("SELECT board_id FROM notice_board_items WHERE notice_id = ?", (notice_id,)).fetchall()}
    conn.execute("DELETE FROM notice_board_items WHERE notice_id = ?", (notice_id,))
    for b in dict.fromkeys(board_ids):
        pos = conn.execute("SELECT COALESCE(MAX(position), -1) + 1 FROM notice_board_items WHERE board_id = ?", (b,)).fetchone()[0]
        conn.execute("INSERT INTO notice_board_items(board_id, notice_id, position) VALUES (?, ?, ?)", (b, notice_id, pos))
    for b in before | set(board_ids):
        conn.execute("UPDATE notice_boards SET updated_at = ? WHERE id = ?", (now_iso(), b))


def touch_boards_of(conn: sqlite3.Connection, notice_id: str) -> None:
    conn.execute("UPDATE notice_boards SET updated_at = ? WHERE id IN (SELECT board_id FROM notice_board_items WHERE notice_id = ?)", (now_iso(), notice_id))


# ---------------------------------------------------------------- boards

def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


def get_board(conn: sqlite3.Connection, board_id: str) -> dict[str, Any] | None:
    return _row(conn.execute("SELECT * FROM notice_boards WHERE id = ? AND deleted_at IS NULL", (board_id,)).fetchone())


def board_by_slug(conn: sqlite3.Connection, slug: str) -> dict[str, Any] | None:
    return _row(conn.execute("SELECT * FROM notice_boards WHERE slug = ? AND deleted_at IS NULL", (slug,)).fetchone())


def list_boards(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM notice_boards WHERE deleted_at IS NULL ORDER BY name, id").fetchall()]


def item_counts(conn: sqlite3.Connection) -> dict[str, int]:
    return {r[0]: r[1] for r in conn.execute(
        """SELECT i.board_id, COUNT(*) FROM notice_board_items i JOIN notices n ON n.id = i.notice_id
           WHERE n.deleted_at IS NULL AND n.status != 'archived' GROUP BY i.board_id""").fetchall()}


def create_board(conn: sqlite3.Connection, actor: str, name: str, slug: str, display: dict[str, Any]) -> tuple[dict[str, Any], str]:
    if conn.execute("SELECT 1 FROM notice_boards WHERE slug = ?", (slug,)).fetchone():
        raise Invalid("slug", "כתובת הלוח תפוסה.")
    bid, now, token = new_id(), now_iso(), new_token()
    conn.execute("""INSERT INTO notice_boards(id, name, slug, enabled, display_json, token_hash, token_generation, token_rotated_at,
                                              created_by, created_at, updated_by, updated_at)
                    VALUES (?, ?, ?, 1, ?, ?, 1, ?, ?, ?, ?, ?)""",
                 (bid, name, slug, json.dumps(display, ensure_ascii=False), token_hash(token), now, actor, now, actor, now))
    return get_board(conn, bid), token  # type: ignore[return-value]


def update_board(conn: sqlite3.Connection, board_id: str, actor: str, cols: dict[str, Any]) -> dict[str, Any]:
    cols = dict(cols)
    if "display" in cols:
        cols["display_json"] = json.dumps(cols.pop("display"), ensure_ascii=False)
    if "enabled" in cols:
        cols["enabled"] = 1 if cols["enabled"] else 0
    cols["updated_by"], cols["updated_at"] = actor, now_iso()
    sets = ", ".join(f"{k} = ?" for k in cols)
    conn.execute(f"UPDATE notice_boards SET {sets} WHERE id = ?", (*cols.values(), board_id))
    return get_board(conn, board_id)  # type: ignore[return-value]


def rotate_token(conn: sqlite3.Connection, board_id: str, actor: str) -> str:
    token, now = new_token(), now_iso()
    conn.execute("""UPDATE notice_boards SET token_hash = ?, token_generation = token_generation + 1, token_rotated_at = ?, updated_by = ?, updated_at = ?
                    WHERE id = ?""", (token_hash(token), now, actor, now, board_id))
    return token


def set_sealed_token(conn: sqlite3.Connection, board_id: str, sealed: str | None) -> None:
    """NOTICEPERM-295: the AEAD-sealed copy of the link token (services/connection_store); the hash alone is what the feed checks."""
    conn.execute("UPDATE notice_boards SET token_sealed = ? WHERE id = ?", (sealed, board_id))


def delete_board(conn: sqlite3.Connection, board_id: str, actor: str) -> None:
    now = now_iso()
    conn.execute("UPDATE notice_boards SET deleted_at = ?, token_hash = NULL, token_sealed = NULL, updated_by = ?, updated_at = ? WHERE id = ?", (now, actor, now, board_id))
    conn.execute("DELETE FROM notice_board_items WHERE board_id = ?", (board_id,))
    from . import slides  # NOTICESLIDES-295: the board's photo and slide links go with it

    slides.drop_board(conn, board_id)


def set_board_items(conn: sqlite3.Connection, board_id: str, notice_ids: list[str]) -> None:
    known = {r[0] for r in conn.execute("SELECT id FROM notices WHERE deleted_at IS NULL AND status != 'archived'").fetchall()}
    if any(n not in known for n in notice_ids):
        raise Invalid("notice_ids", "הודעה לא נמצאה.")
    conn.execute("DELETE FROM notice_board_items WHERE board_id = ?", (board_id,))
    for pos, nid in enumerate(dict.fromkeys(notice_ids)):
        conn.execute("INSERT INTO notice_board_items(board_id, notice_id, position) VALUES (?, ?, ?)", (board_id, nid, pos))
    conn.execute("UPDATE notice_boards SET updated_at = ? WHERE id = ?", (now_iso(), board_id))


def board_notices(conn: sqlite3.Connection, board_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute(
        """SELECT n.*, i.position FROM notice_board_items i JOIN notices n ON n.id = i.notice_id
           WHERE i.board_id = ? AND n.deleted_at IS NULL ORDER BY i.position""", (board_id,)).fetchall()]


def set_control(conn: sqlite3.Connection, board_id: str, cmd: str, lease_s: int = 60) -> dict[str, Any]:
    """Section 8.6: a manual next / previous / pause / play for the real TVs, carried by the feed for a 60 s lease."""
    row = conn.execute("SELECT control_json FROM notice_boards WHERE id = ?", (board_id,)).fetchone()
    try:
        prev = json.loads(row["control_json"] or "{}") if row else {}
    except ValueError:
        prev = {}
    ctl = {"seq": int(prev.get("seq") or 0) + 1, "cmd": cmd, "until": model.iso(utcnow() + dt.timedelta(seconds=lease_s))}
    conn.execute("UPDATE notice_boards SET control_json = ?, updated_at = ? WHERE id = ?", (json.dumps(ctl), now_iso(), board_id))
    return ctl


_LAST_SWEEP: dict[str, float] = {}


def janitor(db: Any) -> None:
    """The hourly retention step of the main janitor (a no-op while the module's tables are empty)."""
    import time

    key = str(getattr(db, "path", "db"))
    if time.time() - _LAST_SWEEP.get(key, 0) < 3600:
        return
    _LAST_SWEEP[key] = time.time()
    with db.connection(label="notices.retention") as conn:
        retention_sweep(conn)
        try:  # NOTICEPUSH-295: the notifications of notices that ended (archive resolves its own at once)
            from . import push as notice_push

            notice_push.resolve_ended(conn)
        except Exception:  # noqa: BLE001 - the janitor never stops on a notification problem
            log.warning("notice push resolve failed", exc_info=True)


def retention_sweep(conn: sqlite3.Connection, now: dt.datetime | None = None) -> int:
    """Section 3.2 / 10: archived and expired notices older than `notices.retention_days` are soft-deleted; soft-deleted rows are
    purged 30 days later. Returns the number of rows soft-deleted."""
    now = now or utcnow()
    keep = settings(conn)["retention_days"]
    cutoff = model.iso(now - dt.timedelta(days=keep))
    n = conn.execute("""UPDATE notices SET deleted_at = ? WHERE deleted_at IS NULL AND status != 'draft'
                        AND ((status = 'archived' AND archived_at < ?) OR (status = 'published' AND ends_at IS NOT NULL AND ends_at < ?))""",
                     (model.iso(now), cutoff, cutoff)).rowcount
    purge = model.iso(now - dt.timedelta(days=30))
    gone = [r[0] for r in conn.execute("SELECT id FROM notices WHERE deleted_at IS NOT NULL AND deleted_at < ?", (purge,)).fetchall()]
    for nid in gone:
        conn.execute("DELETE FROM notice_board_items WHERE notice_id = ?", (nid,))
        conn.execute("DELETE FROM notice_reads WHERE notice_id = ?", (nid,))
        conn.execute("DELETE FROM notices WHERE id = ?", (nid,))
    return n
