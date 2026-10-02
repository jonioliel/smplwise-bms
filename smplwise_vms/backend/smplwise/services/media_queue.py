"""The full queue and the full library (CR-016 phase 2b, docs/changes/CR-016-MEDIA-PLAYERS.md section 17.7): the reads and edits behind the player
panel's reorderable "הבא בתור" list and its "ספרייה" tab.

- The queue list and its edits come from the DIRECT Music Assistant connection (services/ma_direct.py) - Home Assistant has neither. Without a ready
  direct connection a device simply has no `caps.queue_list` and the panel keeps the 0.1.150 depth (services/media_query.up_next).
- The library is BROWSED through Home Assistant (the bridge's `media_query library`, bridge 0.5.0, `favorite: false`, paged) and SEARCHED through the
  direct connection (`music/search`) when it is ready. Items travel as the same opaque `item_ref`s as the favourites lists (media_query.remember) and are
  started with the ordinary `play_item` command (HA `music_assistant.play_media` through the bridge, `enqueue` play / next / add).
- Permissions: reading the queue list = media.read (as up next); editing it = media.queue AND media.control at the device's anchor - and at every follower's
  anchor when the queue is a live leader's (it plays in their rooms too); browsing and searching = media.browse at the anchor.
- Locked rows (the current item and what MA already buffered) are never moved or deleted and nothing is moved into that zone; `clear` needs `confirmed`.
- No edit is ever retried or queued; a refused edit says MA's numeric error code only."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import unlocked
from ..errors import ApiError
from ..rbac import Principal
from . import ma_direct as ma, media_commands, media_model as mm, media_profiles as profiles, media_query, media_store as store
from .timeutil import parse_utc

EDIT_DEVICE = (2.0, 4.0)  # queue edits: 2 a second per device (a burst of 4: a few quick drags)
EDIT_USER = (0.5, 30.0)  # ... and 30 a minute per user (burst 30, refill 1 every 2 s)
SEARCH_USER = (0.5, 4.0)
BROWSE_PAGE = 50
BROWSE_TTL_S = 300.0
SEARCH_TTL_S = 60.0
QUERY_MAX = 60
OPS = ("move", "next", "delete", "clear")
_BROWSE: dict[tuple[str, int], tuple[float, list[dict[str, Any]]]] = {}
_SEARCH: dict[tuple[str, str], tuple[float, list[dict[str, Any]]]] = {}


def clear() -> None:
    _BROWSE.clear()
    _SEARCH.clear()


def _err(status: int, code: str, message: str, **details: Any) -> ApiError:
    return ApiError(status, code, message, details=details or None)


UNAVAILABLE = ("ma_unavailable", "התור המלא אינו זמין כרגע.")


# ------------------------------------------------------------------------------------------------ caps


def player_id(cat: store.Catalog, item: store.Item) -> str | None:
    """The MA player id of a device: the `unique_id` of its music-layer entity when that entity belongs to Music Assistant (derived on the server only)."""
    ref = item.view.prim.get("music")
    if not ref or not any(e.ref == ref and (e.platform or "") == "music_assistant" for e in item.model.endpoints):
        return None
    uid = str((cat.ents.get(ref) or {}).get("unique_id") or "").strip()
    return uid[:200] or None


def caps_extra(conn: sqlite3.Connection, cat: store.Catalog, item: store.Item, caps: dict[str, Any]) -> dict[str, bool]:
    """`queue_list` (the direct connection is ready and the device has an MA player), `browse` (MA through the bridge: the library tabs), `search`
    (browse + the direct connection)."""
    provider = mm.music_provider_of(item.model, cat.ents)
    ma_layer = provider == "ma" and player_id(cat, item) is not None
    direct = ma_layer and ma.usable(conn)
    browse = provider == "ma" and bool(caps.get("playlists") or caps.get("favourites") or caps.get("stations") or caps.get("up_next"))
    return {"queue_list": bool(direct and caps.get("up_next")), "browse": browse, "search": bool(browse and direct)}


# ------------------------------------------------------------------------------------------------ the queue list


def _iso_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def queue_list(conn: sqlite3.Connection, principal: Principal, cat: store.Catalog, item: store.Item, access: store.Access, offset: int | None, limit: int) -> dict[str, Any]:
    """`QueueList` (section 17.7): the rows from `offset` (default: the current item) - history rows before the current one are not listed. A member of a
    live group answers with its leader's queue. A read that fails is `confirmed: false`, never an empty queue."""
    target = media_query.queue_target(cat, item, access)
    pid = player_id(cat, target)
    if pid is None:
        raise _err(422, "not_supported", "ההתקן אינו מציע תור מלא.", reason="queue_list")
    if not ma.usable(conn):
        raise _err(503, *UNAVAILABLE)
    limit = max(1, min(ma.PAGE_MAX, limit))
    try:
        h = ma.header(conn, pid)
        lt = ma.locked_to(h)
        start = offset if offset is not None else max(0, h["index"] or 0)
        rows = ma.items(conn, h["queue_id"], start, limit)
    except ma.MaError:
        return {"confirmed": False, "count": None, "index": None, "locked_to": None, "offset": offset or 0, "items": [], "shuffle": None, "repeat": None, "read_at": None}
    view = ma.remember(principal.user_id, target.key, media_query._item_key(conn), h["queue_id"], rows)
    store.note_queue(item.key, {"count": h["count"], "index": h["index"]} if h["count"] is not None else None)
    return {"confirmed": True, "count": h["count"], "index": h["index"], "locked_to": lt, "offset": start,
            "items": [{**r, "locked": r["index"] <= lt} for r in view], "shuffle": h["shuffle"], "repeat": h["repeat"], "read_at": _iso_now()}


# ------------------------------------------------------------------------------------------------ queue edits


def _audit(conn: sqlite3.Connection, principal: Principal, request_id: str | None, key: str, op: str, decision: str, reason: str | None = None, **details: Any) -> None:
    audit(conn, actor=principal, action="media.queue", decision=decision, resource_type="media_device", resource_id=key, reason=reason, request_id=request_id,
          details={"op": op, **details})


def _deny(conn: sqlite3.Connection, principal: Principal, request_id: str | None, key: str, op: str, exc: ApiError) -> ApiError:
    _audit(conn, principal, request_id, key, op, "denied", exc.code, **({"reason": exc.details.get("reason")} if isinstance(exc.details, dict) and exc.details.get("reason") else {}))
    return exc


def early(conn: sqlite3.Connection, principal: Principal, request_id: str | None, cat: store.Catalog, item: store.Item, access: store.Access, op: str) -> store.Item:
    """Permission, then the leader rule: media.queue + media.control at the device (and the leader it follows) and at every follower of that leader. Returns
    the queue's owner (the leader for a member)."""
    target = media_query.queue_target(cat, item, access)
    for it in {item.key: item, target.key: target}.values():
        anchor = it.row.get("anchor_entity_id")
        if not (access.has(store.PERM_QUEUE, anchor) and access.has(store.PERM_CONTROL, anchor)):
            raise _deny(conn, principal, request_id, item.key, op, _err(403, "forbidden", "אין הרשאה לערוך את התור.", permission=store.PERM_QUEUE))
    g = cat.group_info(target.key)
    if g["role"] == "leader":
        for k in g["member_keys"]:
            m = cat.items.get(k)
            if k == target.key or m is None:
                continue
            anchor = m.row.get("anchor_entity_id")
            if not (access.has(store.PERM_QUEUE, anchor) and access.has(store.PERM_CONTROL, anchor)):
                raise _deny(conn, principal, request_id, item.key, op, _err(403, "forbidden", "אין הרשאה לערוך את התור.", permission=store.PERM_QUEUE, reason="group_member"))
    return target


def edit(conn: sqlite3.Connection, settings: Settings, principal: Principal, request_id: str | None, cat: store.Catalog, item: store.Item, access: store.Access,
         body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """One queue edit (`op` move | next | delete | clear): (HTTP status, `{status: accepted | refused, op, error?}`). Refusals before anything is sent are
    raised (audited): 403, 409 expired / confirm_required / locked / queue_changed, 422 validation / unknown_item / not_supported, 429, 503."""
    op, crid = body["op"], body["client_request_id"]
    again = ma.done(principal.user_id, crid)
    if again is not None:
        return again
    try:
        expires = parse_utc(body["expires_at"])
    except (ValueError, AttributeError):
        raise _deny(conn, principal, request_id, item.key, op, _err(422, "validation", "הבקשה אינה תקינה.", fields=["expires_at"])) from None
    now = dt.datetime.now(dt.timezone.utc)
    if expires <= now:
        raise _deny(conn, principal, request_id, item.key, op, _err(409, "expired", "הבקשה פגה."))
    if expires > now + dt.timedelta(seconds=media_commands.EXPIRY_MAX_S):
        raise _deny(conn, principal, request_id, item.key, op, _err(422, "validation", "הבקשה אינה תקינה.", fields=["expires_at"]))
    target = early(conn, principal, request_id, cat, item, access, op)
    if not media_commands.BUCKETS.take("queue-device", target.key, EDIT_DEVICE):
        media_commands._audit_limited(conn, principal, request_id, item.key, f"queue_{op}", "device")
        raise _err(429, "rate_limited", "יותר מדי בקשות; נסו שוב.", scope="device")
    if not media_commands.BUCKETS.take("queue-user", principal.user_id, EDIT_USER):
        media_commands.BUCKETS.refund("queue-device", target.key, EDIT_DEVICE)
        media_commands._audit_limited(conn, principal, request_id, item.key, f"queue_{op}", "user")
        raise _err(429, "rate_limited", "יותר מדי בקשות; נסו שוב.", scope="user")
    pid = player_id(cat, target)
    if pid is None:
        raise _deny(conn, principal, request_id, item.key, op, _err(422, "not_supported", "ההתקן אינו מציע תור מלא.", reason="queue_list"))
    if not ma.usable(conn):
        raise _deny(conn, principal, request_id, item.key, op, _err(503, *UNAVAILABLE))
    ref = None
    if op != "clear":
        ref = ma.resolve(principal.user_id, target.key, body.get("item"))
        if ref is None:
            raise _deny(conn, principal, request_id, item.key, op, _err(422, "unknown_item", "הפריט אינו מוכר; רעננו את התור."))
    answer: dict[str, Any] = {"status": "accepted", "op": op}
    try:
        with unlocked(conn):  # the network phase never holds the write lock
            h = ma.header(conn, pid, fresh=True)
            lt = ma.locked_to(h)
            if op == "clear":
                pending = max(0, (h["count"] or 0) - (lt + 1))
                if body.get("confirmed") is not True:
                    raise _err(409, "confirm_required", "לנקות את התור?", count=pending)
                ma.call(conn, "player_queues/clear", {"queue_id": h["queue_id"]})
            else:
                assert ref is not None
                if ref["queue_id"] != h["queue_id"]:
                    raise _err(409, "queue_changed", "התור השתנה; רעננו.")
                start = max(0, h["index"] or 0)
                rows = ma.items(conn, h["queue_id"], start, 500)
                idx = next((r["index"] for r in rows if r["queue_item_id"] == ref["queue_item_id"]), None)
                if idx is None:
                    raise _err(409, "queue_changed", "התור השתנה; רעננו.")
                if idx <= lt:
                    raise _err(409, "locked", "השיר הזה כבר מתנגן.")
                last = start + len(rows) - 1
                if op == "delete":
                    ma.call(conn, "player_queues/delete_item", {"queue_id": h["queue_id"], "item_id_or_index": ref["queue_item_id"]})
                else:
                    to = lt + 1 if op == "next" else body.get("to")
                    if isinstance(to, bool) or not isinstance(to, int) or not lt < to <= max(last, lt + 1):
                        raise _err(422, "validation", "מיקום לא תקין בתור.", fields=["to"])
                    shift = to - idx
                    if shift:
                        ma.call(conn, "player_queues/move_item", {"queue_id": h["queue_id"], "queue_item_id": ref["queue_item_id"], "pos_shift": shift})
                    answer["to"] = to
    except ApiError as exc:
        raise _deny(conn, principal, request_id, item.key, op, exc) from None
    except ma.MaError as exc:
        ma.forget_queue(pid)
        if exc.state == "refused":
            answer = {"status": "refused", "op": op, "error": exc.ma_code}
            _audit(conn, principal, request_id, item.key, op, "denied", "ma_refused", ma_code=exc.ma_code)
            ma.note_done(principal.user_id, crid, 200, answer)
            return 200, answer
        raise _deny(conn, principal, request_id, item.key, op, _err(503, *UNAVAILABLE, state=exc.state)) from None
    ma.forget_queue(pid)
    _audit(conn, principal, request_id, item.key, op, "allowed", **({"leader_key": target.key} if target.key != item.key else {}))
    ma.note_done(principal.user_id, crid, 202, answer)
    return 202, answer


# ------------------------------------------------------------------------------------------------ the library: browse (HA) and search (direct)


def _browse_items(conn: sqlite3.Connection, settings: Settings, principal: Principal, entity: str, media_type: str, offset: int) -> list[dict[str, Any]]:
    hit = _BROWSE.get((media_type, offset))
    if hit and media_query.MONO() - hit[0] < BROWSE_TTL_S:
        return hit[1]
    try:
        answer = media_query._ask(conn, settings, principal, "library", entity_id=entity, media_type=media_type, favorite=False, limit=BROWSE_PAGE, offset=offset, order_by="name")
    except ApiError as exc:
        if exc.code in ("bridge_outdated", "bridge_not_paired", "identity_unmapped", "rate_limited"):
            raise
        raise _err(503, "no_library", "ספריית המוזיקה אינה זמינה כרגע.", error=exc.code) from None
    if not answer.get("ok"):
        raise _err(503, "no_library", "ספריית המוזיקה אינה זמינה כרגע.", error=str(answer.get("error") or "unavailable")[:40])
    items = media_query.trim_library(answer, "ma", "browse", limit=BROWSE_PAGE)
    _BROWSE[(media_type, offset)] = (media_query.MONO(), items)
    if len(_BROWSE) > 200:
        _BROWSE.pop(next(iter(_BROWSE)))
    return items


def _search_items(conn: sqlite3.Connection, media_type: str, q: str) -> list[dict[str, Any]]:
    key = (media_type, q.casefold())
    hit = _SEARCH.get(key)
    if hit and media_query.MONO() - hit[0] < SEARCH_TTL_S:
        return hit[1]
    try:
        raw = ma.search(conn, media_type, q, BROWSE_PAGE)
    except ma.MaError as exc:
        raise _err(503, "search_unavailable", "החיפוש אינו זמין כרגע.", state=exc.state) from None
    items = [i for i in raw if i["media_type"] == media_type and profiles.ma_uri_problem(i["uri"]) is None]
    _SEARCH[key] = (media_query.MONO(), items)
    if len(_SEARCH) > 200:
        _SEARCH.pop(next(iter(_SEARCH)))
    return items


def browse(conn: sqlite3.Connection, settings: Settings, principal: Principal, cat: store.Catalog, item: store.Item, access: store.Access, media_type: str, q: str | None,
           offset: int) -> dict[str, Any]:
    """`BrowsePage`: one page of the library of one media type (`q`: a search through the direct connection). 403 without media.browse at the anchor;
    422 not_supported without `caps.browse` (or `caps.search` for `q`)."""
    anchor = item.row.get("anchor_entity_id")
    if not access.has(store.PERM_BROWSE, anchor):
        raise _err(403, "forbidden", "אין הרשאה לעיין בספרייה.", permission=store.PERM_BROWSE)
    if media_type not in profiles.MA_MEDIA_TYPES:
        raise _err(422, "validation", "סוג פריט לא מוכר.", fields=["type"])
    caps = store.caps_of(cat, item)
    extra = caps_extra(conn, cat, item, caps)
    text = (q or "").strip()
    if not extra["browse"] or (text and not extra["search"]):
        raise _err(422, "not_supported", "ההתקן אינו מציע את הספרייה.", reason="search" if text and extra["browse"] else "browse")
    if len(text) > QUERY_MAX or any(ord(c) < 32 or ord(c) == 127 for c in text):
        raise _err(422, "validation", "חיפוש: טקסט עד 60 תווים.", fields=["q"])
    if text:
        raw = _search_items(conn, media_type, text)[offset:offset + BROWSE_PAGE]
        more = False
    else:
        entity = item.view.prim.get("music") or ""
        raw = _browse_items(conn, settings, principal, entity, media_type, offset)
        more = len(raw) >= BROWSE_PAGE
    cfg = store.favourites_config(conn)
    hidden = {e["item_ref"] for e in cfg["items"] if e.get("hidden")}
    raw = [i for i in raw if media_query.make_ref(conn, "ma", i["media_type"], i["uri"]) not in hidden]  # an item the administrator hid stays hidden here too
    listed = media_query.remember(conn, "ma", raw, principal.user_id, item.key)
    return {"type": media_type, "q": text or None, "items": listed, "offset": offset, "more": more, "read_at": _iso_now(), "provider": "ma"}
