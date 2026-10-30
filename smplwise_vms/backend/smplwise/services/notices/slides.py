"""NOTICESLIDES-295 - promo / info slides of the TV boards and the building photo of template 2 (tables of migration 0172).

A slide is text (title + line) with an optional picture; one slide may be shown on several boards (owner answer 281) through
`notice_board_slides`. The building photo is a `kind = 'photo'` row linked to ONE board (at most one per board) and never counts as a
slide. Pictures pass the bill-logo pipeline (`bill_pdf_logo.sanitize_image`: PNG / JPEG by magic bytes, pixel ceiling, EXIF and every
ancillary chunk dropped, re-encoded): slides up to 1 MB scaled to 800 px, the photo up to 2 MB scaled to 1920 px. The sanitised
bytes are stored as base64 text (the brand_assets precedent), so no file path is ever trusted and an archive could carry them.

The feed carries only what a lobby screen may show: id, title, text, seconds and the picture URL - no author, no board list."""
from __future__ import annotations

import base64
import hashlib
import sqlite3
from typing import Any

from ...db import new_id, now_iso
from ..bill_pdf_logo import LogoError, sanitize_image
from .model import Invalid

TITLE_MAX, TEXT_MAX = 80, 300
SECONDS_MIN, SECONDS_MAX = 6, 120
SLIDES_PER_BOARD = 10
SLIDE_IMAGE_BYTES, SLIDE_IMAGE_SIDE = 1_000_000, 800
PHOTO_IMAGE_BYTES, PHOTO_IMAGE_SIDE = 2_000_000, 1920


# ---------------------------------------------------------------- reading

def _slide(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "title": r["title"], "text": r["body"], "seconds": r["seconds"], "has_image": bool(r["image_b64"]),
            "stamp": r["image_stamp"] or "", "updated_at": r["updated_at"]}


def get(conn: sqlite3.Connection, slide_id: str, kind: str = "slide") -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM notice_slides WHERE id = ? AND kind = ?", (slide_id, kind)).fetchone()


def boards_of(conn: sqlite3.Connection) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for r in conn.execute("""SELECT l.slide_id, l.board_id FROM notice_board_slides l JOIN notice_boards b ON b.id = l.board_id
                             WHERE b.deleted_at IS NULL ORDER BY l.position, l.slide_id""").fetchall():
        out.setdefault(r["slide_id"], []).append(r["board_id"])
    return out


def list_all(conn: sqlite3.Connection, board_id: str | None = None) -> list[dict[str, Any]]:
    """Every slide (with the boards that show it), or the slides of one board in its order."""
    links = boards_of(conn)
    if board_id:
        rows = conn.execute("""SELECT s.* FROM notice_board_slides l JOIN notice_slides s ON s.id = l.slide_id
                               WHERE l.board_id = ? AND s.kind = 'slide' ORDER BY l.position, s.created_at, s.id""", (board_id,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM notice_slides WHERE kind = 'slide' ORDER BY created_at, id").fetchall()
    return [{**_slide(r), "boards": links.get(r["id"], [])} for r in rows]


def count_on(conn: sqlite3.Connection, board_id: str) -> int:
    return conn.execute("""SELECT count(*) FROM notice_board_slides l JOIN notice_slides s ON s.id = l.slide_id
                           WHERE l.board_id = ? AND s.kind = 'slide'""", (board_id,)).fetchone()[0]


def photo_row(conn: sqlite3.Connection, board_id: str, night: bool = False) -> sqlite3.Row | None:
    """The building photo of a board. LOBBY-STYLES-2300: a second photo (the building at night, for the luxury lobby styles) is the same
    `kind = 'photo'` row linked with position 1 - no migration; position 0 is the day photo of template 2 and of the luxury styles."""
    return conn.execute("""SELECT s.* FROM notice_board_slides l JOIN notice_slides s ON s.id = l.slide_id
                           WHERE l.board_id = ? AND s.kind = 'photo' AND l.position = ? ORDER BY s.created_at DESC LIMIT 1""", (board_id, 1 if night else 0)).fetchone()


def image_of(conn: sqlite3.Connection, board_id: str, row_id: str | None, kind: str) -> tuple[str, bytes, str] | None:
    """(mime, bytes, stamp) of a slide picture shown by this board, or the board's photo (row_id None). A slide the board does not
    show answers None, so a token of one board never reads another board's pictures."""
    if kind in ("photo", "photo-night"):
        r = photo_row(conn, board_id, kind == "photo-night")
    else:
        r = conn.execute("""SELECT s.* FROM notice_board_slides l JOIN notice_slides s ON s.id = l.slide_id
                            WHERE l.board_id = ? AND s.id = ? AND s.kind = 'slide'""", (board_id, row_id or "")).fetchone()
    if r is None or not r["image_b64"]:
        return None
    try:
        return r["image_mime"] or "image/png", base64.b64decode(r["image_b64"]), r["image_stamp"] or ""
    except ValueError:
        return None


def feed_block(conn: sqlite3.Connection, board: dict[str, Any], *, public: bool, logo_base: str = "") -> tuple[list[dict[str, Any]], str, str]:
    """(`slides[]`, the day photo URL or '', the night photo URL or '') of one board. `public` = the URLs go through the board-token routes (the TV); otherwise
    (the Settings preview) through the signed-in stamped routes."""
    slug = board["slug"]
    out: list[dict[str, Any]] = []
    for s in list_all(conn, board["id"])[:SLIDES_PER_BOARD]:
        item: dict[str, Any] = {"id": s["id"], "title": s["title"], "text": s["text"]}
        if s["seconds"]:
            item["seconds"] = int(s["seconds"])
        if s["has_image"]:
            item["image"] = (f"{logo_base}api/v1/notices/display/{slug}/slide/{s['id']}?v={s['stamp']}" if public
                             else f"api/v1/notices/promo-slides/{s['id']}/image?v={s['stamp']}")
        out.append(item)
    urls = []
    for night, leaf in ((False, "photo"), (True, "photo-night")):
        p = photo_row(conn, board["id"], night)
        urls.append("")
        if p is not None and p["image_b64"]:
            urls[-1] = (f"{logo_base}api/v1/notices/display/{slug}/{leaf}?v={p['image_stamp']}" if public
                        else f"api/v1/notices/boards/{board['id']}/{leaf}?v={p['image_stamp']}")
    return out, urls[0], urls[1]


def newest_stamp(conn: sqlite3.Connection, board_id: str) -> str:
    r = conn.execute("""SELECT max(s.updated_at) FROM notice_board_slides l JOIN notice_slides s ON s.id = l.slide_id WHERE l.board_id = ?""",
                     (board_id,)).fetchone()
    return r[0] or ""


# ---------------------------------------------------------------- validation

def clean_text(value: Any, field: str, limit: int, *, required: bool = False) -> str:
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise Invalid(field, "ערך לא תקין.")
    v = value.strip()
    if any(ord(c) < 32 and c not in "\n\t" for c in v):
        raise Invalid(field, "ערך לא תקין.")
    if len(v) > limit:
        raise Invalid(field, f"עד {limit} תווים.")
    if required and not v:
        raise Invalid(field, "שדה חובה.")
    return v


def clean_seconds(value: Any) -> int | None:
    if value in (None, 0):
        return None
    if isinstance(value, bool) or not isinstance(value, int) or not SECONDS_MIN <= value <= SECONDS_MAX:
        raise Invalid("seconds", f"{SECONDS_MIN}-{SECONDS_MAX} שניות.")
    return value


def _known_boards(conn: sqlite3.Connection, board_ids: list[str]) -> list[str]:
    ids = list(dict.fromkeys(board_ids))
    known = {r[0] for r in conn.execute("SELECT id FROM notice_boards WHERE deleted_at IS NULL").fetchall()}
    if any(b not in known for b in ids):
        raise Invalid("board_ids", "לוח לא נמצא.")
    return ids


# ---------------------------------------------------------------- writing

def _touch_boards(conn: sqlite3.Connection, board_ids: list[str]) -> None:
    now = now_iso()
    for b in board_ids:
        conn.execute("UPDATE notice_boards SET updated_at = ? WHERE id = ?", (now, b))


def _check_link(conn: sqlite3.Connection, slide_id: str | None, board_ids: list[str]) -> tuple[list[str], set[str]]:
    """Validate the boards that are to show a slide (nothing is written): they exist and none goes over the limit."""
    ids = _known_boards(conn, board_ids)
    before = ({r[0] for r in conn.execute("SELECT board_id FROM notice_board_slides WHERE slide_id = ?", (slide_id,)).fetchall()}
              if slide_id else set())
    for b in ids:
        if b not in before and count_on(conn, b) >= SLIDES_PER_BOARD:
            raise Invalid("board_ids", f"עד {SLIDES_PER_BOARD} שקופיות בלוח.")
    return ids, before


def _link(conn: sqlite3.Connection, slide_id: str, board_ids: list[str]) -> list[str]:
    """Replace the boards that show this slide. Each board keeps its other slides; a board over the limit refuses the whole change."""
    ids, before = _check_link(conn, slide_id, board_ids)
    conn.execute("DELETE FROM notice_board_slides WHERE slide_id = ?", (slide_id,))
    for b in ids:
        pos = conn.execute("SELECT coalesce(max(position), -1) + 1 FROM notice_board_slides WHERE board_id = ?", (b,)).fetchone()[0]
        conn.execute("INSERT INTO notice_board_slides(board_id, slide_id, position) VALUES (?, ?, ?)", (b, slide_id, pos))
    _touch_boards(conn, sorted(before | set(ids)))
    return ids


def create(conn: sqlite3.Connection, actor: str, data: dict[str, Any]) -> str:
    title = clean_text(data.get("title"), "title", TITLE_MAX, required=True)
    text = clean_text(data.get("text"), "text", TEXT_MAX)
    seconds = clean_seconds(data.get("seconds"))
    _check_link(conn, None, list(data.get("board_ids") or []))  # everything is validated before the first write
    sid = new_id()
    now = now_iso()
    conn.execute("INSERT INTO notice_slides(id, kind, title, body, seconds, created_by, created_at, updated_by, updated_at) VALUES (?, 'slide', ?, ?, ?, ?, ?, ?, ?)",
                 (sid, title, text, seconds, actor, now, actor, now))
    _link(conn, sid, list(data.get("board_ids") or []))
    return sid


def update(conn: sqlite3.Connection, actor: str, slide_id: str, data: dict[str, Any]) -> None:
    row = get(conn, slide_id)
    if row is None:
        raise KeyError(slide_id)
    cols: dict[str, Any] = {}
    if "title" in data:
        cols["title"] = clean_text(data["title"], "title", TITLE_MAX, required=True)
    if "text" in data:
        cols["body"] = clean_text(data["text"], "text", TEXT_MAX)
    if "seconds" in data:
        cols["seconds"] = clean_seconds(data["seconds"])
    if "board_ids" in data:
        _link(conn, slide_id, list(data["board_ids"] or []))
    cols["updated_by"], cols["updated_at"] = actor, now_iso()
    conn.execute(f"UPDATE notice_slides SET {', '.join(k + ' = ?' for k in cols)} WHERE id = ?", (*cols.values(), slide_id))
    _touch_boards(conn, boards_of(conn).get(slide_id, []))


def delete(conn: sqlite3.Connection, slide_id: str) -> None:
    boards = boards_of(conn).get(slide_id, [])
    conn.execute("DELETE FROM notice_board_slides WHERE slide_id = ?", (slide_id,))
    conn.execute("DELETE FROM notice_slides WHERE id = ? AND kind = 'slide'", (slide_id,))
    _touch_boards(conn, boards)


def set_order(conn: sqlite3.Connection, board_id: str, slide_ids: list[str]) -> None:
    """The slides of one board in this order; slides not named stay linked after them."""
    have = [r[0] for r in conn.execute("""SELECT l.slide_id FROM notice_board_slides l JOIN notice_slides s ON s.id = l.slide_id
                                          WHERE l.board_id = ? AND s.kind = 'slide' ORDER BY l.position""", (board_id,)).fetchall()]
    if any(s not in have for s in slide_ids):
        raise Invalid("slide_ids", "שקופית לא נמצאה בלוח.")
    order = list(dict.fromkeys(slide_ids)) + [s for s in have if s not in slide_ids]
    for pos, sid in enumerate(order):
        conn.execute("UPDATE notice_board_slides SET position = ? WHERE board_id = ? AND slide_id = ?", (pos, board_id, sid))
    _touch_boards(conn, [board_id])


def _store_image(conn: sqlite3.Connection, slide_id: str, actor: str, mime: str, data: bytes) -> str:
    stamp = hashlib.sha256(data).hexdigest()[:12]
    conn.execute("UPDATE notice_slides SET image_mime = ?, image_b64 = ?, image_stamp = ?, updated_by = ?, updated_at = ? WHERE id = ?",
                 (mime, base64.b64encode(data).decode("ascii"), stamp, actor, now_iso(), slide_id))
    return stamp


def put_image(conn: sqlite3.Connection, actor: str, slide_id: str, raw: bytes) -> None:
    """Sanitise and store a slide's picture. Raises LogoError (a stable machine code) when it is refused."""
    mime, data = sanitize_image(raw, max_bytes=SLIDE_IMAGE_BYTES, max_side=SLIDE_IMAGE_SIDE)
    _store_image(conn, slide_id, actor, mime, data)
    _touch_boards(conn, boards_of(conn).get(slide_id, []))


def remove_image(conn: sqlite3.Connection, actor: str, slide_id: str) -> None:
    conn.execute("UPDATE notice_slides SET image_mime = NULL, image_b64 = NULL, image_stamp = NULL, updated_by = ?, updated_at = ? WHERE id = ?",
                 (actor, now_iso(), slide_id))
    _touch_boards(conn, boards_of(conn).get(slide_id, []))


def put_photo(conn: sqlite3.Connection, actor: str, board_id: str, raw: bytes, night: bool = False) -> str:
    """Sanitise and store the building photo of one board (replaces the previous one of that variant). Raises LogoError when refused."""
    mime, data = sanitize_image(raw, max_bytes=PHOTO_IMAGE_BYTES, max_side=PHOTO_IMAGE_SIDE)
    drop_photo(conn, board_id, night)
    pid = new_id()
    now = now_iso()
    conn.execute("INSERT INTO notice_slides(id, kind, created_by, created_at, updated_by, updated_at) VALUES (?, 'photo', ?, ?, ?, ?)", (pid, actor, now, actor, now))
    conn.execute("INSERT INTO notice_board_slides(board_id, slide_id, position) VALUES (?, ?, ?)", (board_id, pid, 1 if night else 0))
    stamp = _store_image(conn, pid, actor, mime, data)
    _touch_boards(conn, [board_id])
    return stamp


def drop_photo(conn: sqlite3.Connection, board_id: str, night: bool | None = None) -> bool:
    """Remove the building photo: the day one (night=False), the night one (night=True), or both (night=None, the default; a deleted board)."""
    ids = [r[0] for r in conn.execute("""SELECT s.id FROM notice_board_slides l JOIN notice_slides s ON s.id = l.slide_id
                                         WHERE l.board_id = ? AND s.kind = 'photo' AND (? IS NULL OR l.position = ?)""",
                                      (board_id, None if night is None else 1, None if night is None else (1 if night else 0))).fetchall()]
    for i in ids:
        conn.execute("DELETE FROM notice_board_slides WHERE slide_id = ?", (i,))
        conn.execute("DELETE FROM notice_slides WHERE id = ?", (i,))
    if ids:
        _touch_boards(conn, [board_id])
    return bool(ids)


def drop_board(conn: sqlite3.Connection, board_id: str) -> None:
    """A deleted board: its photos go, its slides stay in the library (another board may show them)."""
    drop_photo(conn, board_id, None)
    conn.execute("DELETE FROM notice_board_slides WHERE board_id = ?", (board_id,))


__all__ = ["LogoError", "SLIDES_PER_BOARD"]
