"""The `smplwise_bridge.media_query` service (bridge 0.5.0, CR-016 4.3): a signed, READ-ONLY question about the MUSIC layer of a speaker - what is in
its queue, or what is in the library - asked by the add-on for the panel's "הבא בתור" and its favourites / stations / playlists tabs.

It exists because the two answers are Home Assistant *response* services of the Music Assistant integration (`music_assistant.get_queue`,
`music_assistant.get_library`) and the add-on talks to Home Assistant only through this bridge (owner decision 1ג: no direct Music Assistant connection in
0.1.150). Everything about it is fixed:

- three queries and nothing else (`queue`, `library`, and from 0.7.0 `search`: a text of 1-60 characters, one media type, at most 50 hits, the Music Assistant library only); the arguments are the closed sets of `media_policy.query_refusal` (a `queue` names ONE media_player;
  a `library` names a media type of the five, `favorite`, `limit` <= 100, `offset`, `order_by` and, optionally, the player whose music layer is asked) -
  never a config entry id; the only text is the 1-60 character `search` name. The answer is `{ok, request_id, query, provider, result}`: `provider` `ma` for a Music Assistant player,
  `sonos` for a Sonos one (its own queue attributes and favourites - the `source_list`), anything else is `no_library`;
- the Music Assistant config entry is found HERE (`hass.config_entries`, domain `music_assistant`, the LOADED one) and is never a parameter: a caller can
  neither name another integration's entry nor learn the id (it is not in any answer);
- the answer is TRIMMED to what a card draws: a queue's length, index, shuffle / repeat and the current and next item's name / artist / album / duration;
  a library item's URI, media type, name and artist. Never stream details, image URLs, provider mappings or queue-item ids; at most 100 items, every text
  at most 120 characters;
- the read runs as the caller's own Home Assistant user (`Context(user_id=...)`), bounded by a timeout, rate limited; every refusal is a fixed code or an
  exception CLASS NAME - the text of an exception is never forwarded.

Kept apart from `__init__.py` so it can be tested without Home Assistant: Home Assistant is imported lazily (`_ha()`), everything else is duck-typed."""
from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from types import SimpleNamespace
from typing import Any, Mapping

from . import media_policy

_LOGGER = logging.getLogger(__name__)

MA_DOMAIN = "music_assistant"
SONOS_DOMAIN = "sonos"
READ_TIMEOUT_S = 10.0
_STATION_WORDS = ("radio", "רדיו", "fm", "תחנ", "station")
RATE_WINDOW_S = 60.0
RATE_MAX = 120  # reads per window, all devices together
RATE_USER_MAX = 40  # ... of which one Home Assistant user may take this many: a reader cannot drain the whole budget (CR-016 review L3)
MAX_TEXT = 120
MAX_ITEMS = 100
COMMON_KEYS = frozenset({"user_id", "query", "request_id", "ts", "nonce", "sig"})

_calls: deque[float] = deque()
_user_calls: dict[str, deque[float]] = {}


def _refuse(msg: Mapping[str, Any], error: str) -> dict[str, Any]:
    request_id = msg.get("request_id")
    return {"ok": False, "request_id": request_id if isinstance(request_id, str) else None, "query": msg.get("query") if isinstance(msg.get("query"), str) else None, "error": error}


def _answer(msg: Mapping[str, Any], provider: str, result: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "request_id": msg["request_id"], "query": msg["query"], "provider": provider, "result": result}


def _ha() -> SimpleNamespace:
    """What this module needs from Home Assistant, imported on first use (unit tests monkeypatch this function): the call context and the entity
    registry's platform lookup."""
    from homeassistant.core import Context
    from homeassistant.helpers import entity_registry as er

    def platform_of(hass: Any, entity_id: str) -> str | None:
        entry = er.async_get(hass).async_get(entity_id)
        return entry.platform if entry is not None else None

    return SimpleNamespace(Context=Context, platform_of=platform_of)


def ma_entry_id(hass: Any) -> str | None:
    """The id of the LOADED Music Assistant config entry, or None (the integration is absent or not loaded). Never leaves this module."""
    for entry in hass.config_entries.async_entries(MA_DOMAIN):
        state = getattr(entry, "state", None)
        if str(getattr(state, "value", state)) == "loaded":
            return entry.entry_id
    return None


def _text(value: Any) -> str | None:
    return value.strip()[:MAX_TEXT] if isinstance(value, str) and value.strip() else None


def _name_of(value: Any) -> str | None:
    """A name out of a string, a `{name}` dict or the first of a list of those (Music Assistant spells artists and albums all three ways)."""
    if isinstance(value, list):
        value = value[0] if value else None
    if isinstance(value, dict):
        value = value.get("name")
    return _text(value)


def _entry(raw: Any) -> dict[str, Any] | None:
    """One queue item as a card draws it: `{name, artist, album, duration}`."""
    if not isinstance(raw, dict):
        return None
    media = raw.get("media_item") if isinstance(raw.get("media_item"), dict) else {}
    name = _text(raw.get("name")) or _text(media.get("name"))
    if name is None:
        return None
    duration = raw.get("duration", media.get("duration"))
    return {"name": name, "artist": _name_of(media.get("artists") or media.get("artist")) or _name_of(raw.get("artist")), "album": _name_of(media.get("album")) or _name_of(raw.get("album")),
            "duration": int(duration) if isinstance(duration, (int, float)) and not isinstance(duration, bool) and duration > 0 else None}


def _index(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def trim_queue(response: Any, entity_id: str) -> dict[str, Any] | None:
    """`music_assistant.get_queue`'s answer (keyed by the entity id, or the queue itself) reduced to the length, the index, shuffle / repeat and the current
    and next item. None when it is not a queue."""
    data = response.get(entity_id) if isinstance(response, dict) and isinstance(response.get(entity_id), dict) else response
    if not isinstance(data, dict):
        return None
    repeat = data.get("repeat_mode", data.get("repeat"))
    shuffle = data.get("shuffle_enabled", data.get("shuffle"))
    return {"count": _index(data.get("items")), "index": _index(data.get("current_index")), "shuffle": shuffle if isinstance(shuffle, bool) else None,
            "repeat": repeat if repeat in media_policy.REPEAT_MODES else None, "current": _entry(data.get("current_item")), "next": _entry(data.get("next_item"))}


def sonos_queue(attributes: Mapping[str, Any]) -> dict[str, Any]:
    """A Sonos player's queue as its own attributes report it: the size and the position - no names beyond what `media_*` attributes give."""
    return {"count": _index(attributes.get("queue_size")), "index": _index(attributes.get("queue_position")), "current": None, "next": None}


def sonos_library(attributes: Mapping[str, Any], media_type: str, limit: int, offset: int) -> dict[str, Any]:
    """A Sonos house without Music Assistant: the favourites are the player's own `source_list` (started with `select_source`), a "station" one named like a
    radio entry, and there are no playlists (UNVERIFIED shape: Sonos mixes favourites and inputs in one list)."""
    names = [n for n in attributes.get("source_list") or [] if isinstance(n, str) and 0 < len(n) <= MAX_TEXT] if isinstance(attributes.get("source_list"), list) else []
    picked = [] if media_type == "playlist" else [n for n in names if any(w in n.lower() for w in _STATION_WORDS)] if media_type == "radio" else names
    page = picked[offset:offset + limit]
    return {"items": [{"name": n, "source": n} for n in page], "offset": offset, "limit": limit}


def trim_library(response: Any) -> list[dict[str, Any]]:
    """`music_assistant.get_library`'s items reduced to `{uri, media_type, name, artist}`; an item whose URI is not an MA library / provider URI of one of the
    five types is dropped (nothing the add-on could not safely play is listed)."""
    raw = response.get("items") if isinstance(response, dict) else None
    out: list[dict[str, Any]] = []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        uri, kind, name = item.get("uri"), item.get("media_type"), _text(item.get("name"))
        if kind not in media_policy.MA_MEDIA_TYPES or name is None or media_policy.ma_uri_problem(uri):
            continue
        out.append({"uri": uri, "media_type": kind, "name": name, "artist": _name_of(item.get("artists") or item.get("artist"))})
        if len(out) >= MAX_ITEMS:
            break
    return out


_SEARCH_KEYS = {"track": "tracks", "album": "albums", "artist": "artists", "playlist": "playlists", "radio": "radio"}


def trim_search(response: Any, media_type: str, limit: int) -> list[dict[str, Any]]:
    """`music_assistant.search`'s answer (lists keyed `tracks`, `albums`, `artists`, `playlists`, `radio`) reduced to the asked media type's items as
    `{uri, media_type, name, artist}` - the same four keys and the same URI rule as `trim_library`; at most `limit` (<= 50) items."""
    raw = response.get(_SEARCH_KEYS[media_type]) if isinstance(response, dict) else None
    return trim_library({"items": [i for i in raw if isinstance(i, dict)]} if isinstance(raw, list) else {})[:limit]


def _rate_limited(now: float, user_id: str | None = None) -> bool:
    """The global budget (`RATE_MAX` a window) with a per-user share (`RATE_USER_MAX`): a refusal by the share never takes a global slot."""
    while _calls and now - _calls[0] > RATE_WINDOW_S:
        _calls.popleft()
    mine: deque[float] | None = None
    if user_id is not None:
        mine = _user_calls.setdefault(user_id, deque())
        while mine and now - mine[0] > RATE_WINDOW_S:
            mine.popleft()
        if len(mine) >= RATE_USER_MAX:
            return True
    if len(_calls) >= RATE_MAX:
        return True
    _calls.append(now)
    if mine is not None:
        mine.append(now)
    if len(_user_calls) > 200:  # users long gone
        for k in [k for k, q in _user_calls.items() if not q or now - q[-1] > RATE_WINDOW_S]:
            del _user_calls[k]
    return False


async def async_handle_media_query(hass: Any, verifier: Any, msg: dict[str, Any]) -> dict[str, Any]:
    """Run one signed `media_query`. Always answers a dict, never raises for a refusal. The order: signature / replay window -> the shape of the request
    (`media_policy.query_refusal`) -> rate limit -> an active Home Assistant user -> the read -> the shape of the answer. Fails closed at every step."""
    reason = verifier.verify(msg)
    if reason:
        _LOGGER.warning("smplwise_bridge.media_query refused: %s", reason)
        return _refuse(msg, reason)
    if not isinstance(msg.get("user_id"), str) or not isinstance(msg.get("request_id"), str):
        return _refuse(msg, "invalid_request")
    query = msg.get("query")
    fields = {k: v for k, v in msg.items() if k not in COMMON_KEYS}
    ha = _ha()
    refusal = media_policy.query_refusal(query, fields)
    if refusal:
        _LOGGER.warning("smplwise_bridge.media_query refused: %s", refusal)
        return _refuse(msg, refusal)
    if _rate_limited(time.monotonic(), msg["user_id"]):
        _LOGGER.warning("smplwise_bridge.media_query refused: rate_limited")
        return _refuse(msg, "rate_limited")
    user = await hass.auth.async_get_user(msg["user_id"])
    if user is None or not user.is_active:
        return _refuse(msg, "unknown_user")
    context = ha.Context(user_id=user.id)
    entity_id = fields.get("entity_id")
    provider = "ma"  # a library or search read without a player asks Music Assistant
    attributes: Mapping[str, Any] = {}
    if entity_id is not None:
        state = hass.states.get(entity_id)
        if state is None:
            return _refuse(msg, "entity_not_found")
        if state.state in ("unavailable", "unknown"):
            return _refuse(msg, "entity_unavailable")
        platform = ha.platform_of(hass, entity_id)
        provider = "ma" if platform == MA_DOMAIN else "sonos" if platform == SONOS_DOMAIN else ""
        attributes = dict(state.attributes)
    if not provider or (provider == "ma" and ma_entry_id(hass) is None):
        return _refuse(msg, "no_library")  # neither Music Assistant (absent, or its entry is not loaded) nor a native provider
    try:
        if query == "queue":
            if provider == "sonos":
                return _answer(msg, provider, sonos_queue(attributes))
            response = await asyncio.wait_for(hass.services.async_call(MA_DOMAIN, "get_queue", {"entity_id": entity_id}, blocking=True, return_response=True, context=context), READ_TIMEOUT_S)
            queue = trim_queue(response, entity_id)
            return _refuse(msg, "bad_answer") if queue is None else _answer(msg, provider, queue)
        if query == "search":
            if provider == "sonos":
                return _refuse(msg, "no_library")  # a Sonos player has no library to search
            limit = fields.get("limit", media_policy.SEARCH_LIMIT_MAX)
            data = {"config_entry_id": ma_entry_id(hass), "name": media_policy.clean_name(fields["name"]), "media_type": [fields["media_type"]], "limit": limit, "library_only": True}
            response = await asyncio.wait_for(hass.services.async_call(MA_DOMAIN, "search", data, blocking=True, return_response=True, context=context), READ_TIMEOUT_S)
            return _answer(msg, provider, {"items": trim_search(response, fields["media_type"], limit), "limit": limit})
        limit, offset = fields.get("limit", 50), fields.get("offset", 0)
        if provider == "sonos":
            return _answer(msg, provider, sonos_library(attributes, fields["media_type"], limit, offset))
        data = {"config_entry_id": ma_entry_id(hass), **{k: v for k, v in fields.items() if k in ("media_type", "favorite", "limit", "offset", "order_by")}}
        response = await asyncio.wait_for(hass.services.async_call(MA_DOMAIN, "get_library", data, blocking=True, return_response=True, context=context), READ_TIMEOUT_S)
        return _answer(msg, provider, {"items": trim_library(response), "offset": offset, "limit": limit})
    except asyncio.TimeoutError:
        return _refuse(msg, "timeout")
    except Exception as exc:  # noqa: BLE001 - class name only: an exception text may carry an address or a provider detail
        _LOGGER.warning("smplwise_bridge.media_query failed: %s", type(exc).__name__)
        return _refuse(msg, type(exc).__name__)
