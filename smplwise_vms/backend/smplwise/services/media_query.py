"""The reads behind "הבא בתור" and the favourites / stations / playlists lists (CR-016 4.3, docs/architecture/MEDIA_PLAYERS_API.md 3.16 / 3.17).

Home Assistant is the only connection of 0.1.150 (owner decision 1ג): the music data comes from the Music Assistant integration's two response
services - `get_queue` and `get_library` - through ONE read-only bridge service (`smplwise_bridge.media_query`, bridge 0.5.0: fixed arguments, trimmed
answer, the config entry resolved inside the bridge and never a parameter), or, in a house without Music Assistant (a Sonos house), from the native
player's own state: its favourites are its `source_list` (the bridge answers them for a Sonos entity the same way), its queue is `queue_size` /
`queue_position` (read here from the stored attributes, no round trip). With neither, the reads answer `no_library`.

The bridge answer (the add-on trims it again): `{ok, request_id, query, provider, result}` with `provider` `ma` | `sonos`; `result` of a `queue` is
`{count, index, shuffle, repeat, current, next}` (an entry is `{name, artist, album, duration}`), of a `library` `{items: [{uri | source, media_type?, name,
artist?}], offset, limit}`; errors `{ok: false, error}`: `no_library`, `entity_unavailable`, `entity_not_found`, `timeout`, `arguments_invalid`,
`query_not_allowed`.

Rules this module keeps:
- Nothing that leaves is a URI or a URL: a library item travels as an opaque `item_ref` (an HMAC of the item, 24 hex digits, stable so the
  administrator's curation can name it); the add-on remembers `item_ref -> uri` for 30 minutes and the browser can only start items the server
  itself listed (`resolve_item`). Never returned: stream details, image URLs, provider mappings, queue item ids.
- A read is cached: the queue of a device 2 s, a library list 5 min. A failed read is `confirmed: false` (the panel says "לא זמין"), never an empty
  queue. No retry loop; nothing is queued.
- The caller's own HA identity signs the read, like every call through the bridge."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import logging
import secrets
import time
import uuid
from typing import Any

import httpx

from ..config import Settings
from ..db import database_of, get_setting, read_mode, set_setting
from ..errors import ApiError
from ..rbac import Principal
from . import ha_bridge, ha_client, media_model as mm, media_profiles as profiles, media_store as store

log = logging.getLogger("smplwise.media")

QUEUE_TTL_S = 2.0
LIBRARY_TTL_S = 300.0
ITEM_TTL_S = 30 * 60
PAGE_SIZE = 50
ENTRY_STALE_S = 600.0  # how long "the Music Assistant entry is not loaded" (a bridge answer) is believed by the status
KIND_TYPES: dict[str, dict[str, tuple[tuple[str, bool], ...]]] = {  # provider -> library kind -> the (media type, favourites only) reads it is made of
    "ma": {"favourites": (("playlist", True), ("album", True), ("artist", True), ("track", True)), "stations": (("radio", False),), "playlists": (("playlist", False),)},
    "sonos": {"favourites": (("track", True),), "stations": (("radio", False),)},
}
BRIDGE_ANSWER_MAX = 600_000
MONO = time.monotonic  # tests move the clock here

# what the browser may be told about an item: kind -> glyph
_GLYPH = {"radio": "antenna", "playlist": "music", "album": "music", "artist": "smile", "track": "music"}

# in memory only
_ITEMS: dict[str, dict[str, Any]] = {}
_QUEUES: dict[str, tuple[float, dict[str, Any]]] = {}
_LIBRARY: dict[tuple[str, str], tuple[float, list[dict[str, Any]]]] = {}
_KEY: list[bytes] = []
ENTRY: dict[str, Any] = {"loaded": None, "at": 0.0}  # the last thing the bridge said about the Music Assistant entry: True / False / None (never asked)


def clear() -> None:
    """Tests: forget every cache, the remembered items and what the bridge said about the entry."""
    _ITEMS.clear()
    _QUEUES.clear()
    _LIBRARY.clear()
    _KEY.clear()
    ENTRY.update(loaded=None, at=0.0)


def entry_unloaded() -> bool:
    """The bridge recently answered `no_library` for a Music Assistant player: the integration is not loaded (the status says "unavailable")."""
    return ENTRY["loaded"] is False and MONO() - ENTRY["at"] < ENTRY_STALE_S


def _note_entry(loaded: bool) -> None:
    ENTRY.update(loaded=loaded, at=MONO())


# ------------------------------------------------------------------------------------------------ item refs


def _item_key(conn: Any) -> bytes:
    """The persistent secret of the item refs (so the administrator's curation, which names refs, survives a restart). Generated once."""
    if _KEY:
        return _KEY[0]
    text = get_setting(conn, "multimedia.item_secret")
    if not text:
        text = secrets.token_hex(24)
        db = database_of(conn) if read_mode(conn) else None
        if db is None:
            conn.execute("INSERT INTO settings(key, value) VALUES ('multimedia.item_secret', ?) ON CONFLICT(key) DO NOTHING", (text,))
            text = get_setting(conn, "multimedia.item_secret") or text
        else:
            with db.write_aside() as w:
                w.execute("INSERT INTO settings(key, value) VALUES ('multimedia.item_secret', ?) ON CONFLICT(key) DO NOTHING", (text,))
                text = get_setting(w, "multimedia.item_secret") or text
    _KEY.append(text.encode("utf-8"))
    return _KEY[0]


def make_ref(conn: Any, provider: str, media_type: str, uri: str) -> str:
    return hmac.new(_item_key(conn), f"{provider}|{media_type}|{uri}".encode("utf-8"), hashlib.sha256).hexdigest()[:24]


def remember(conn: Any, provider: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Give every listed item its `item_ref`, remember `ref -> uri` for ITEM_TTL_S, and return the browser's view (no uri)."""
    now = MONO()
    for ref in [r for r, v in _ITEMS.items() if v["expires"] < now]:
        del _ITEMS[ref]
    out = []
    for it in items:
        ref = make_ref(conn, provider, it["media_type"], it["uri"])
        _ITEMS[ref] = {"uri": it["uri"], "media_type": it["media_type"], "provider": provider, "name": it["name"], "artist": it.get("artist"), "expires": now + ITEM_TTL_S}
        h = int(hashlib.sha1(it["name"].lower().encode("utf-8")).hexdigest()[:4], 16) % 360
        out.append({"item_ref": ref, "kind": it["media_type"] if it["media_type"] in _GLYPH else "track", "name": it["name"], "artist": it.get("artist"),
                    "glyph": _GLYPH.get(it["media_type"], "music"), "hue": h})
    while len(_ITEMS) > 3000:
        _ITEMS.pop(next(iter(_ITEMS)))
    return out


NAMES_KEY = "multimedia.favourite_names"


def _saved_names(conn: Any) -> dict[str, dict[str, Any]]:
    try:
        raw = json.loads(get_setting(conn, NAMES_KEY) or "{}")
    except ValueError:
        return {}
    return raw if isinstance(raw, dict) else {}


def known_names(conn: Any, refs: list[str]) -> dict[str, dict[str, Any]]:
    """`{ref: {name, artist, kind}}` for the refs the server can name: a list it issued lately, else the names saved with the curation. Never a URI."""
    saved = _saved_names(conn)
    out: dict[str, dict[str, Any]] = {}
    for ref in refs:
        hit = _ITEMS.get(ref)
        if hit is not None:
            out[ref] = {"name": hit["name"], "artist": hit.get("artist"), "kind": hit["media_type"] if hit["media_type"] in _GLYPH else "track"}
        elif isinstance(saved.get(ref), dict) and isinstance(saved[ref].get("name"), str):
            out[ref] = {"name": saved[ref]["name"][:120], "artist": saved[ref].get("artist") if isinstance(saved[ref].get("artist"), str) else None,
                        "kind": saved[ref].get("kind") if saved[ref].get("kind") in _GLYPH else "track"}
    return out


def save_names(conn: Any, refs: list[str]) -> None:
    """With the curation: keep the name of every curated item (so the editor can show a hidden one after a restart); items no longer curated are forgotten."""
    names = known_names(conn, refs)
    set_setting(conn, NAMES_KEY, json.dumps(names, ensure_ascii=False, separators=(",", ":")))


def resolve_item(ref: Any) -> dict[str, Any] | None:
    """What `play_item` starts: the item a server list issued under `ref` within the last 30 minutes (None: unknown or expired)."""
    if not isinstance(ref, str):
        return None
    hit = _ITEMS.get(ref)
    if hit is None or hit["expires"] < MONO():
        _ITEMS.pop(ref, None)
        return None
    return hit


# ------------------------------------------------------------------------------------------------ the bridge read


def call_bridge_media_query(settings: Settings, payload: dict[str, Any], timeout: float = 15.0) -> dict[str, Any]:
    """POST /api/services/smplwise_bridge/media_query?return_response (bridge >= 0.5.0): ONE read-only question about the music layer, fixed arguments, a
    trimmed answer. Errors carry a status or a class name, never the body."""
    if not ha_client.configured(settings):
        raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת.")
    try:
        with httpx.Client(timeout=timeout) as c:
            r = c.post(ha_client._rest_base(settings) + "/services/smplwise_bridge/media_query?return_response", headers=ha_client._headers(settings), content=json.dumps(payload))
    except httpx.HTTPError as exc:
        raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
    if r.status_code in (400, 404) and "not found" in r.text.lower():
        raise ApiError(503, "bridge_outdated", "נדרש עדכון של רכיב החיבור", details={"required": store.BRIDGE_PLAYERS_REQUIRED})
    if r.status_code in (401, 403):
        raise ApiError(503, "ha_forbidden", "תשתית המערכת דחתה את הקריאה.", details={"status": r.status_code})
    if r.status_code >= 400:
        raise ApiError(503, "bridge_error", "הגשר החזיר שגיאה.", details={"status": r.status_code})
    if len(r.content) > BRIDGE_ANSWER_MAX:
        raise ApiError(503, "bridge_error", "הגשר החזיר תשובה גדולה מדי.", details={"reason": "too_large"})
    try:
        body = r.json()
    except ValueError:
        return {}
    answer = (body.get("service_response") or body) if isinstance(body, dict) else {}
    return answer if isinstance(answer, dict) else {}


def _ask(conn: Any, settings: Settings, principal: Principal, query: str, **fields: Any) -> dict[str, Any]:
    """One signed read as the caller. 503 bridge_not_paired / bridge_outdated before anything is sent; the bridge's own refusal is `{ok: false, error}`."""
    if principal.source not in ("ingress", "remote") and not settings.dev_user:
        raise ApiError(403, "identity_unmapped", "לא ניתן למפות את הזהות לפעולת ההתקן.")
    bridge = store.bridge_state(conn)
    if not bridge["paired"]:
        raise ApiError(503, "bridge_not_paired", "פעולות אלו דורשות את הגשר מותקן ומצומד.")
    if not bridge["players_ready"]:
        raise ApiError(503, "bridge_outdated", "נדרש עדכון של רכיב החיבור", details={"required": store.BRIDGE_PLAYERS_REQUIRED})
    secret = ha_bridge.signing_key(conn) or ""
    payload = ha_bridge.sign(secret, {"user_id": principal.user_id, "query": query, **fields, "request_id": uuid.uuid4().hex[:12]})
    return call_bridge_media_query(settings, payload)


# ------------------------------------------------------------------------------------------------ trimming (the add-on trims again whatever the bridge says)


def _text(value: Any, limit: int = 120) -> str | None:
    return value.strip()[:limit] if isinstance(value, str) and value.strip() else None


def _entry(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    name = _text(raw.get("name"))
    if name is None:
        return None
    dur = raw.get("duration")
    return {"name": name, "artist": _text(raw.get("artist")), "album": _text(raw.get("album")), "duration_s": int(dur) if isinstance(dur, (int, float)) and not isinstance(dur, bool) and dur > 0 else None}


def _int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def trim_queue(answer: dict[str, Any]) -> dict[str, Any]:
    q = answer.get("result") if isinstance(answer.get("result"), dict) else {}
    repeat = q.get("repeat")
    return {"count": _int(q.get("count")), "index": _int(q.get("index")), "shuffle": q.get("shuffle") if isinstance(q.get("shuffle"), bool) else None,
            "repeat": repeat if repeat in ("off", "one", "all") else None, "current": _entry(q.get("current")), "next": _entry(q.get("next"))}


def trim_library(answer: dict[str, Any], provider: str, kind: str, limit: int = 100) -> list[dict[str, Any]]:
    """The listed items of a bridge answer as `{uri, media_type, name, artist}`. Music Assistant items carry an MA library / provider URI (anything else is
    dropped); a Sonos entry is `{name, source}` and its "uri" is the source name (started with `select_source`)."""
    result = answer.get("result") if isinstance(answer.get("result"), dict) else {}
    out: list[dict[str, Any]] = []
    for raw in result.get("items") if isinstance(result.get("items"), list) else []:
        if not isinstance(raw, dict):
            continue
        name = _text(raw.get("name"))
        if name is None:
            continue
        if provider == "sonos":
            source = raw.get("source") if isinstance(raw.get("source"), str) and 0 < len(raw["source"]) <= 120 else name
            out.append({"uri": source, "media_type": "radio" if kind == "stations" else "playlist", "name": name, "artist": None})
        else:
            uri, media_type = raw.get("uri"), raw.get("media_type")
            if media_type not in profiles.MA_MEDIA_TYPES or profiles.ma_uri_problem(uri) is not None:
                continue  # nothing that is not an MA library / provider URI of one of the five types is ever listed
            out.append({"uri": uri, "media_type": media_type, "name": name, "artist": _text(raw.get("artist"))})
        if len(out) >= limit:
            break
    return out


# ------------------------------------------------------------------------------------------------ up next


def _iso_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _unconfirmed() -> dict[str, Any]:
    return {"confirmed": False, "count": None, "index": None, "shuffle": None, "repeat": None, "current": None, "next": None, "read_at": None}


def queue_target(cat: store.Catalog, item: store.Item, access: store.Access) -> store.Item:
    """A member of a live group has no queue of its own: the leader's is the one that plays (when the caller may read the leader)."""
    g = cat.group_info(item.key)
    leader = cat.items.get(g["leader_key"]) if g["role"] == "member" and g["leader_key"] else None
    if leader is not None and leader.row["approved"] and access.has(store.PERM_READ, leader.row.get("anchor_entity_id")):
        return leader
    return item


def up_next(conn: Any, settings: Settings, principal: Principal, cat: store.Catalog, item: store.Item, access: store.Access) -> dict[str, Any]:
    """`GET /multimedia/devices/{key}/up-next` (MEDIA_PLAYERS_API.md 3.16): `UpNext`. 503 no_library when no music layer answers; an unreachable
    read is `confirmed: false`, never an empty queue."""
    target = queue_target(cat, item, access)
    provider = mm.music_provider_of(target.model, cat.ents)
    if provider == "sonos":
        music = cat.ents.get(target.view.prim.get("music") or "") or {}
        a = mm._attrs(music)
        size, pos = _int(a.get("queue_size")), _int(a.get("queue_position"))
        if size is None or not mm.available(music):
            return _unconfirmed()
        title = _text(a.get("media_title"))
        cur = {"name": title, "artist": _text(a.get("media_artist")), "album": _text(a.get("media_album_name")), "duration_s": None} if title else None
        store.note_queue(item.key, {"count": size, "index": pos})
        return {"confirmed": True, "count": size, "index": pos, "shuffle": a.get("shuffle") if isinstance(a.get("shuffle"), bool) else None,
                "repeat": a.get("repeat") if a.get("repeat") in ("off", "one", "all") else None, "current": cur, "next": None, "read_at": _iso_now()}
    if provider != "ma":
        raise ApiError(503, "no_library", "ספריית המוזיקה אינה זמינה.")
    entity = target.view.prim.get("music")
    if not entity or not mm.available(cat.ents.get(entity)):
        return _unconfirmed()
    hit = _QUEUES.get(target.key)
    if hit and MONO() - hit[0] < QUEUE_TTL_S:
        data = hit[1]
    else:
        try:
            answer = _ask(conn, settings, principal, "queue", entity_id=entity)
        except ApiError as exc:
            if exc.code in ("bridge_outdated", "bridge_not_paired", "identity_unmapped"):
                raise
            return _unconfirmed()
        if not answer.get("ok"):
            if answer.get("error") == "no_library":
                _note_entry(False)
                raise ApiError(503, "no_library", "ספריית המוזיקה אינה זמינה.")
            return _unconfirmed()  # entity_unavailable, timeout, anything else: not known - never "empty"
        _note_entry(True)
        data = trim_queue(answer)
        _QUEUES[target.key] = (MONO(), data)
    store.note_queue(item.key, {"count": data["count"], "index": data["index"]} if data["count"] is not None else None)
    return {"confirmed": data["count"] is not None, **data, "read_at": _iso_now()}


# ------------------------------------------------------------------------------------------------ libraries


def _bridge_items(conn: Any, settings: Settings, principal: Principal, provider: str, entity: str, kind: str) -> list[dict[str, Any]]:
    hit = _LIBRARY.get((provider, kind))
    if hit and MONO() - hit[0] < LIBRARY_TTL_S:
        return hit[1]
    items: list[dict[str, Any]] = []
    for media_type, favourite in KIND_TYPES[provider][kind]:
        answer = _ask(conn, settings, principal, "library", entity_id=entity, media_type=media_type, favorite=favourite, limit=50 if kind != "favourites" else 25, offset=0, order_by="name")
        if not answer.get("ok"):
            if answer.get("error") == "no_library":
                if provider == "ma":
                    _note_entry(False)
                raise ApiError(503, "no_library", "ספריית המוזיקה אינה זמינה.")
            raise ApiError(503, "no_library", "ספריית המוזיקה אינה זמינה כרגע.", retryable=True, details={"error": str(answer.get("error") or "unavailable")[:40]})
        if provider == "ma":
            _note_entry(True)
        items += trim_library(answer, provider, kind)
    seen: set[str] = set()
    items = [i for i in items if not (i["uri"] in seen or seen.add(i["uri"]))]
    _LIBRARY[(provider, kind)] = (MONO(), items)
    return items


def library_page(conn: Any, settings: Settings, principal: Principal, cat: store.Catalog, item: store.Item, access: store.Access, kind: str, offset: int = 0, *, show_hidden: bool = False) -> dict[str, Any]:
    """`GET /multimedia/devices/{key}/library?kind=favourites|stations|playlists&offset=` (MEDIA_PLAYERS_API.md 3.17): `LibraryPage` of the device's music
    layer, ordered and filtered by the administrator's curation (one list for everyone; `show_hidden` is the curation editor's read and adds `hidden`).
    422 not_supported when the device's capabilities do not offer the list, 503 no_library when no music layer answers."""
    if kind not in store.LIB_KINDS:
        raise ApiError(422, "validation", "סוג רשימה לא מוכר.", details={"fields": ["kind"]})
    caps = store.caps_of(cat, item)
    if not caps.get(kind):
        raise ApiError(422, "not_supported", "ההתקן אינו מציע את הרשימה הזו.", details={"reason": kind})
    provider = mm.music_provider_of(item.model, cat.ents)
    entity = item.view.prim.get("music")
    if provider not in ("ma", "sonos") or not entity:
        raise ApiError(503, "no_library", "ספריית המוזיקה אינה זמינה.")
    raw = _bridge_items(conn, settings, principal, provider, entity, kind)
    listed = remember(conn, provider, raw)
    cfg = store.favourites_config(conn)
    entries = {e["item_ref"]: e for e in cfg["items"]}
    mine = [i for i in listed if i["item_ref"] in entries]
    curated = bool(mine)
    ordered = sorted(mine, key=lambda i: (entries[i["item_ref"]].get("order") if isinstance(entries[i["item_ref"]].get("order"), int) else 10**6)) + [i for i in listed if i["item_ref"] not in entries]
    if show_hidden:
        ordered = [{**i, "hidden": bool((entries.get(i["item_ref"]) or {}).get("hidden"))} for i in ordered]
    else:
        ordered = [i for i in ordered if not (entries.get(i["item_ref"]) or {}).get("hidden")]
    return {"kind": kind, "items": ordered[max(0, offset):max(0, offset) + PAGE_SIZE], "curated": curated, "read_at": _iso_now(), "provider": provider}
