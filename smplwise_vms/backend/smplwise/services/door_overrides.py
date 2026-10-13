"""WXUNBLK (owner decision 2026-10-13): an administrator's explicit, audited, per-entity release of the door path's block on a
script-backed entity.

Where a WisKey door exists, the door path blocks every entity whose platform runs an action sequence Arx does not hold (a template
switch / cover / light / lock / button, a universal media player - `door_path.SCRIPT_BACKED_PLATFORMS`): an action on it could be
a door opening that never passed the door authority, so a tile / map-card action, a bulk action, an automation, script, scene or
schedule that touches it is refused, and the editors refuse a NEW step that does (SEC-WXD M3). The owner wants one more way: the
system administrator may look at what is blocked and release ONE entity by hand - "even if it goes through WisKey" - and put it
back. This module is that list and nothing else.

What a release is:
- one row per entity: why (a note, required), who, when - kept here and in the audit log (`intercom.door.entity_unblocked` /
  `intercom.door.entity_reblocked`, routers/doors.py);
- honoured by the static resolver (services/door_path.py) for that ENTITY only: the steps that were unresolved because of it
  stop being unresolved;
- reversible at any time (re-block removes the row).

What a release is NOT (kept by construction, tested in tests/test_wiskey_door_overrides.py):
- it never touches a step that opens a WisKey door: an automation, script, scene, schedule or launcher button with a real door step
  stays refused (`door_step_not_converted`) with its message, until WisKey's automation-actor appendix exists (D10a);
- it never applies to a WisKey lock, to an entity the administrator mapped to an intercom door, or to any entity that is not
  script-backed (services/door_blocks.py refuses to store one);
- it does not change `door_execute_guard` (the add-on's own block of `execute` for WisKey doors) or the door authority;
- it does not release any other unresolved reason (a computed service or target, a label, an unknown item, a lock group).

Storage: one settings key holding JSON (no migration): `{"entities": {"<entity_id>": {"note", "by", "by_name", "at"}}}`. The key is
not a product setting (it is not in routers/settings.DEFAULTS), so `GET /settings` never serves it. Reads fail closed: an absent,
unreadable or hand-edited value releases nothing, and an entry without a valid entity id or without a note is ignored."""
from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass
from typing import Any

from ..db import get_setting, now_iso, set_setting

KEY = "doors.entity_unblocked"
MAX_ENTRIES = 500
NOTE_MIN = 3
NOTE_MAX = 300
ENTITY_ID = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")


class OverrideError(ValueError):
    """A release the list cannot store: `code` is `note_required`, `note_too_long`, `bad_entity` or `too_many`."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Override:
    entity_id: str
    note: str
    by: str  # the administrator's user id
    by_name: str  # and the name Arx knew them by then
    at: str  # when (UTC)

    def public(self) -> dict[str, str]:
        """What a screen gets: the why, the person's name (the id only when no name was known) and the instant."""
        return {"note": self.note, "by": self.by_name or self.by, "at": self.at}


def clean_note(value: Any) -> str:
    """The note as stored: whitespace collapsed (a note is one line); anything that is not text is empty."""
    return " ".join(value.split()) if isinstance(value, str) else ""


def read(conn: sqlite3.Connection) -> dict[str, Override]:
    """The stored releases. Fail closed: an absent, unreadable or malformed value releases nothing; an entry whose entity id is
    not an entity id, or whose note is missing or shorter than NOTE_MIN, is ignored (the note is the reason it exists)."""
    raw = get_setting(conn, KEY)
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except ValueError:
        return {}
    entries = data.get("entities") if isinstance(data, dict) else None
    if not isinstance(entries, dict):
        return {}
    out: dict[str, Override] = {}
    for entity_id, entry in entries.items():
        if not isinstance(entity_id, str) or not ENTITY_ID.fullmatch(entity_id) or not isinstance(entry, dict):
            continue
        note = clean_note(entry.get("note"))
        if len(note) < NOTE_MIN:
            continue
        out[entity_id] = Override(entity_id, note[:NOTE_MAX], str(entry.get("by") or ""), str(entry.get("by_name") or ""), str(entry.get("at") or ""))
    return out


def unblocked_ids(conn: sqlite3.Connection) -> frozenset[str]:
    """The entity ids the guards treat as released (the resolver reads this once per request)."""
    return frozenset(read(conn))


def _write(conn: sqlite3.Connection, entries: dict[str, Override]) -> None:
    payload = {"entities": {e.entity_id: {"note": e.note, "by": e.by, "by_name": e.by_name, "at": e.at} for e in sorted(entries.values(), key=lambda o: o.entity_id)}}
    set_setting(conn, KEY, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


def release(conn: sqlite3.Connection, entity_id: str, *, note: str, by: str, by_name: str) -> Override:
    """Store (or replace) the release of one entity. The caller has checked that the entity may be released and audits it."""
    if not ENTITY_ID.fullmatch(entity_id):
        raise OverrideError("bad_entity")
    text = clean_note(note)
    if len(text) < NOTE_MIN:
        raise OverrideError("note_required")
    if len(text) > NOTE_MAX:
        raise OverrideError("note_too_long")
    entries = read(conn)
    if entity_id not in entries and len(entries) >= MAX_ENTRIES:
        raise OverrideError("too_many")
    entry = Override(entity_id, text, by, by_name, now_iso())
    entries[entity_id] = entry
    _write(conn, entries)
    return entry


def reblock(conn: sqlite3.Connection, entity_id: str) -> Override | None:
    """Take a release away (the entity is blocked again). Returns the removed one, None when there was none."""
    entries = read(conn)
    removed = entries.pop(entity_id, None)
    if removed is not None:
        _write(conn, entries)
    return removed
