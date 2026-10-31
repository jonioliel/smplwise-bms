"""WISKEY-RELAYMAP-2310: the production writer of the WisKey relay map (`wiskey_relay_map`, migration 0145).

The relay map is Arx's record of which WisKey api relay of a station drives which physical relay (an Arx door is keyed by the
physical relay, `door_windows._sync_doors`; WisKey grants carry both, `wiskey_feature_exec.relay_row_for_door`). Rows are written
ONLY by an explicit approval of an authorised person, one station at a time:

- the save names every api relay of the station (1 and 2, the values the table allows) with a physical relay or None ("disabled");
- one station revision (`wiskey_relay_map_stations`, migration 0187) is compared and set: a stale revision writes nothing;
- one active row per (station, api_relay) (the primary key) and per (station, physical_relay) (checked here, over the result);
- a physical relay must be one of the station's relays in the served WisKey copy;
- no row is invented: an api relay that has no row and stays disabled gets none; an unchanged row is not rewritten (its row revision,
  which live WisKey grants carry, does not move);
- nothing is sent to a station, a door or WisKey: the map is information the feature policy hands to WisKey grants.
"""
from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from . import wiskey_feature_exec as fx

API_RELAYS = (1, 2)  # wiskey_relay_map.api_relay CHECK (api_relay IN (1, 2))
PHYSICAL_RELAYS = (1, 2)  # wiskey_relay_map.physical_relay CHECK (physical_relay IN (1, 2))
CONFIRM_WORD = "אשר"  # the typed confirmation of a change that touches a door with a door automation


class RelayMapError(Exception):
    def __init__(self, code: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.details = details or {}


@dataclass(frozen=True)
class MapRow:
    api_relay: int
    physical_relay: int
    active: bool
    revision: int
    updated_at: str


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def station_state(conn: sqlite3.Connection, station_id: str) -> dict[str, Any]:
    r = conn.execute("SELECT revision, approved_by, approved_at FROM wiskey_relay_map_stations WHERE station_id = ?", (station_id,)).fetchone()
    return {"revision": r[0], "approved_by": r[1], "approved_at": r[2]} if r else {"revision": 0, "approved_by": None, "approved_at": None}


def map_rows(conn: sqlite3.Connection, station_id: str) -> dict[int, MapRow]:
    out = {}
    for r in conn.execute("SELECT api_relay, physical_relay, active, revision, updated_at FROM wiskey_relay_map WHERE station_id = ?", (station_id,)):
        out[int(r[0])] = MapRow(int(r[0]), int(r[1]), r[2] == 1, int(r[3]), r[4])
    return out


def mapped_station_ids(conn: sqlite3.Connection) -> list[str]:
    ids = {r[0] for r in conn.execute("SELECT station_id FROM wiskey_relay_map")} | {r[0] for r in conn.execute("SELECT station_id FROM wiskey_relay_map_stations")}
    return sorted(ids)


def effective(current: Mapping[int, MapRow]) -> dict[int, int | None]:
    """api relay -> the physical relay it drives now (None: no active row)."""
    return {a: (current[a].physical_relay if a in current and current[a].active else None) for a in API_RELAYS}


def automated_doors(conn: sqlite3.Connection, station_id: str) -> list[int]:
    """The physical relays of this station that a (not deleted) door automation names, in any state."""
    out: set[int] = set()
    for (policy_json,) in conn.execute("SELECT policy_json FROM door_automations WHERE deleted_at IS NULL"):
        try:
            doors = json.loads(policy_json or "{}").get("doors") or []
        except (ValueError, AttributeError):
            continue
        for d in doors if isinstance(doors, list) else []:
            if isinstance(d, dict) and d.get("station_id") == station_id and type(d.get("relay")) is int:
                out.add(d["relay"])
    return sorted(out)


def validate(wanted: Any, known_relays: Iterable[int]) -> dict[int, int | None]:
    """The full station map (`{api_relay: physical_relay | None}` over exactly API_RELAYS), checked; RelayMapError otherwise."""
    if not isinstance(wanted, Mapping) or set(wanted) != set(API_RELAYS):
        raise RelayMapError("relay_map_invalid", {"fields": ["rows"]})
    known = {r for r in known_relays if r in PHYSICAL_RELAYS}
    out: dict[int, int | None] = {}
    for api in API_RELAYS:
        p = wanted[api]
        if p is not None and (type(p) is not int or p not in PHYSICAL_RELAYS):
            raise RelayMapError("relay_map_invalid", {"fields": ["rows"], "api_relay": api})
        if p is not None and p not in known:
            raise RelayMapError("relay_map_unknown_relay", {"api_relay": api, "physical_relay": p})
        out[api] = p
    active = [p for p in out.values() if p is not None]
    if len(active) != len(set(active)):
        raise RelayMapError("relay_map_duplicate_physical", {"physical_relay": sorted({p for p in active if active.count(p) > 1})})
    return out


def affected_doors(before: Mapping[int, int | None], after: Mapping[int, int | None]) -> list[int]:
    """The physical relays (doors) whose api relay changes: the old and the new physical relay of every changed api relay."""
    out: set[int] = set()
    for api in API_RELAYS:
        if before.get(api) != after.get(api):
            out.update(p for p in (before.get(api), after.get(api)) if p is not None)
    return sorted(out)


def as_list(m: Mapping[int, int | None]) -> list[dict[str, Any]]:
    return [{"api_relay": a, "physical_relay": m.get(a)} for a in API_RELAYS]


@dataclass(frozen=True)
class SaveResult:
    revision: int
    revision_before: int
    before: dict[int, int | None]
    after: dict[int, int | None]
    affected: list[int]
    automated: list[int]


def save(conn: sqlite3.Connection, *, station_id: str, rows: Any, expected_revision: Any, by: str, known_relays: Iterable[int],
         confirm_text: str | None = None, now: str | None = None) -> SaveResult:
    """Approve one station's full map. Every check runs before the first write (an API refusal still commits its audit row)."""
    if type(expected_revision) is not int or not 0 <= expected_revision < 9007199254740991:
        raise RelayMapError("relay_map_invalid", {"fields": ["expected_revision"]})
    after = validate(rows, known_relays)
    state = station_state(conn, station_id)
    if state["revision"] != expected_revision:
        raise RelayMapError("revision_conflict", {"revision": state["revision"]})
    current = map_rows(conn, station_id)
    before = effective(current)
    if before == after:
        raise RelayMapError("relay_map_unchanged")
    affected = affected_doors(before, after)
    automated = sorted(set(affected) & set(automated_doors(conn, station_id)))
    if automated and (confirm_text or "").strip() != CONFIRM_WORD:
        raise RelayMapError("confirm_required", {"doors": automated, "word": CONFIRM_WORD})
    at = now or _now()
    for api in API_RELAYS:
        if before[api] == after[api]:
            continue
        row = current.get(api)
        target = after[api]
        if target is None:
            if row is None:
                continue  # never invent a row to record "disabled"
            fx.set_relay_map(conn, station_id=station_id, api_relay=api, physical_relay=row.physical_relay, confirmed_by=by,
                             expected_revision=row.revision, active=False, now=at)
        else:
            fx.set_relay_map(conn, station_id=station_id, api_relay=api, physical_relay=target, confirmed_by=by,
                             expected_revision=row.revision if row else 0, active=True, now=at)
    new = expected_revision + 1
    conn.execute("INSERT INTO wiskey_relay_map_stations(station_id, revision, approved_by, approved_at) VALUES (?,?,?,?) "
                 "ON CONFLICT(station_id) DO UPDATE SET revision = excluded.revision, approved_by = excluded.approved_by, approved_at = excluded.approved_at",
                 (station_id, new, by, at))
    return SaveResult(new, expected_revision, before, after, affected, automated)
