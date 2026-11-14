"""WisKey background (read) channel: the closed projection of decision D-006 (B0).

What Arx keeps, caches, serves and logs from the WisKey channel that runs without an operator's identity is a closed
station-health projection, built field by field (never "everything WisKey sent, then strip"):

    {schema_version: 1, generated_at, permission_revision, stations: [{id, name, online, last_seen}]}

No `last_access`, no person name or employee number, no card / PIN / photo / profile / phone, no event identity, no user or
sync counts, no model / firmware / host. WisKey's current `overview` still carries all of that (a non-admin account with
`overview: view` receives `station.last_access.person_name` and `employee_no`; WisKey's own D-006 finding), so the
guarantee lives here: the projection is constructed from four named fields and `assert_closed` refuses anything else.
A station name is an operational label the installer chose ("Main entrance"), not a person; WisKey asks for that to be
a stated assumption, and the owner confirms it per site (ARX_DECISIONS_REPLY_3_HE.md section 3).

Two sources feed the same shape:
- the split background session (services/wiskey_background_feed.py) when the owner configured a dedicated account;
- until then, the service feed's served copy cut down to the same four fields (`from_served_copy`).
Nothing here is written to SQLite or disk.
"""
from __future__ import annotations

import datetime
from typing import Any, Iterator

SCHEMA_VERSION = 1
BACKGROUND_KEYS = ("schema_version", "generated_at", "permission_revision", "stations")
BACKGROUND_STATION_KEYS = ("id", "name", "online", "last_seen")
MAX_STATIONS = 500
MAX_TEXT = 200

# Names that must not appear as a key anywhere in a background projection, an API reply built from it, a cache entry or a
# log record: person identity, credentials, event identity and people counts (D-006: "no last_access, person, card, PIN,
# photo, profile or event identity"; Arx's reply 3: "no counts"). The tests walk every served reply for them.
PERSON_FIELD_NAMES = frozenset({
    "last_access", "person_name", "employee_no", "display_name", "person", "people", "users", "user",
    "card", "cards", "card_no", "masked_number", "pin", "pin_configured", "phone", "photo", "photo_configured", "portrait",
    "profile", "profile_fields", "event_type", "authentication", "time_source", "recovered",
    "user_count", "managed_user_count", "pending_user_count", "card_count", "unmanaged_count",
})


def _utc_z(value: Any) -> str | None:
    """`2026-09-27T08:00:00+03:00` -> `2026-09-27T05:00:00Z`; anything that is not an aware ISO instant is unknown (None)."""
    if not isinstance(value, str) or not value or len(value) > 64:
        return None
    text = value.strip()
    try:
        parsed = datetime.datetime.fromisoformat(text[:-1] + "+00:00" if text.endswith("Z") else text)
        if parsed.tzinfo is None:
            return None
        return parsed.astimezone(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    except (ValueError, OverflowError):
        return None


def _now_z() -> str:
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def closed_station(raw: Any) -> dict[str, Any] | None:
    """One station reduced to `{id, name, online, last_seen}`; None for anything without a usable id. `online` is a
    boolean or None (unknown is not offline); `last_seen` is the last successful health observation as a UTC instant, or
    None."""
    if not isinstance(raw, dict):
        return None
    sid = raw.get("id")
    if not isinstance(sid, str) or not sid.strip() or len(sid) > 128:
        return None
    name = raw.get("name")
    online = raw.get("online")
    return {
        "id": sid,
        "name": name.strip()[:MAX_TEXT] if isinstance(name, str) else "",
        "online": online if isinstance(online, bool) else None,
        "last_seen": _utc_z(raw.get("last_seen")),
    }


def _revision(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def project_background(raw: dict[str, Any], generated_at: str | None = None) -> dict[str, Any]:
    """The closed projection of one WisKey `overview` reply (the background session's read). `permission_revision` is
    the global panel permission revision WisKey reports in `access.revision`, or None when it sent none."""
    access = raw.get("access") if isinstance(raw.get("access"), dict) else {}
    stations = [s for s in (closed_station(item) for item in (raw.get("stations") or [])[:MAX_STATIONS]) if s]
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at or _now_z(),
        "permission_revision": _revision(access.get("revision")),
        "stations": stations,
    }


def from_served_copy(copy: dict[str, Any] | None, generated_at: str | None = None) -> dict[str, Any] | None:
    """The same shape from the service feed's served overview copy (id, name, online, last_seen are in it already), for
    the stretch before a dedicated background account exists. None when there is no copy. The service copy carries no
    permission revision."""
    if not isinstance(copy, dict):
        return None
    stations = [s for s in (closed_station(item) for item in (copy.get("stations") or [])[:MAX_STATIONS]) if s]
    return {"schema_version": SCHEMA_VERSION, "generated_at": generated_at or _now_z(), "permission_revision": None, "stations": stations}


def walk_keys(obj: Any, path: str = "") -> Iterator[tuple[str, str]]:
    """Every (dotted path, key) of every mapping nested in `obj`."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            here = f"{path}.{key}" if path else str(key)
            yield here, str(key)
            yield from walk_keys(value, here)
    elif isinstance(obj, (list, tuple)):
        for index, item in enumerate(obj):
            yield from walk_keys(item, f"{path}[{index}]")


def find_person_fields(obj: Any) -> list[str]:
    """The paths of every forbidden key (PERSON_FIELD_NAMES) found anywhere in `obj` (empty: none)."""
    return [path for path, key in walk_keys(obj) if key in PERSON_FIELD_NAMES]


def assert_closed(projection: Any) -> None:
    """Raise ValueError unless `projection` is exactly the D-006 shape: the four top-level keys, stations with exactly
    the four station keys and the right primitive types, and no forbidden key anywhere."""
    if not isinstance(projection, dict) or tuple(projection) != BACKGROUND_KEYS:
        raise ValueError("background projection: unexpected top-level keys")
    if projection["schema_version"] != SCHEMA_VERSION:
        raise ValueError("background projection: unknown schema_version")
    if _utc_z(projection["generated_at"]) != projection["generated_at"]:
        raise ValueError("background projection: generated_at is not a UTC instant")
    if projection["permission_revision"] is not None and _revision(projection["permission_revision"]) is None:
        raise ValueError("background projection: permission_revision")
    stations = projection["stations"]
    if not isinstance(stations, list):
        raise ValueError("background projection: stations is not a list")
    for station in stations:
        if not isinstance(station, dict) or tuple(station) != BACKGROUND_STATION_KEYS:
            raise ValueError("background projection: unexpected station keys")
        if not isinstance(station["id"], str) or not station["id"] or not isinstance(station["name"], str):
            raise ValueError("background projection: station id / name")
        if station["online"] is not None and not isinstance(station["online"], bool):
            raise ValueError("background projection: station online")
        if station["last_seen"] is not None and _utc_z(station["last_seen"]) != station["last_seen"]:
            raise ValueError("background projection: station last_seen")
    found = find_person_fields(projection)
    if found:
        raise ValueError(f"background projection carries person fields: {found}")
