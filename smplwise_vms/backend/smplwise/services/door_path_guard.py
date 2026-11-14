"""CR-033 slices D6 and D8: what Arx never asks of a WisKey lock, and what the editors may not add.

D6 - WisKey does not support `lock.lock`. It is never sent to a WisKey lock: not from a lock tile, not from "lock all"
(the client skips these doors and says so; the server refuses a direct call with `wiskey_lock_unsupported`), and a
scheduled job that would lock one is listed as one that will never work (`wiskey_lock_jobs`, read-only, from Arx's own
mirror).

D8 - while the administrator setting `doors.editor_block` is `blocked` (the default; anything else reads as blocked),
the automation / script / scene editors (typed and code mode), scene capture and the schedule editor refuse, on save and
on the server, a NEW step that opens a WisKey door - and a new lock step whose target cannot be resolved. An existing step
is never touched (it may stay, be edited around, or be removed). The door itself opens from its button or from a WisKey
hold-open program. `allowed` is stored and understood, but the API only accepts it once D10a exists (new door steps stored
as Arx door steps, never as `lock.unlock` in HA)."""
from __future__ import annotations

import json
import sqlite3
from collections import Counter
from typing import Any

from ..db import get_setting
from ..errors import ApiError
from . import door_path, intercom_doors

EDITOR_KEY = "doors.editor_block"
EDITOR_VALUES = ("blocked", "allowed")
# D10a (new door steps stored as Arx door steps) does not exist yet: `allowed` cannot be selected until it does.
ALLOWED_SELECTABLE = False

OPEN_SERVICES = ("lock.unlock", "lock.open")
WISKEY_UNLOCK_SERVICE = "unlock_door"

EDITOR_REFUSAL = "לא ניתן להוסיף כאן פתיחת דלת אינטרקום. פתיחה נעשית מכפתור הדלת או מתוכנית החזקה פתוחה."
POSSIBLE_DOOR_REFUSAL = "לא ניתן להוסיף כאן פעולה על התקן וירטואלי: פעולתו אינה ידועה למערכת ועלולה לפתוח דלת אינטרקום."
LOCK_UNSUPPORTED = "לא רלוונטי - מנעול של אינטרקום אינו תומך בנעילה."
LOCK_ALL_SKIPPED = "לא רלוונטי: דלתות אינטרקום אינן נתמכות בנעילה ולא נשלחה אליהן פקודה."
NEVER_WORKS = "לא יעבוד לעולם - מנעול של אינטרקום אינו תומך בנעילה"


def editor_mode(conn: sqlite3.Connection) -> str:
    """`allowed` only when the setting says exactly `allowed`; absent or garbage reads as `blocked` (fail closed)."""
    return "allowed" if (get_setting(conn, EDITOR_KEY) or "blocked") == "allowed" else "blocked"


def refusal(entity_ids: list[str]) -> ApiError:
    return ApiError(422, "wiskey_door_step_blocked", EDITOR_REFUSAL, details={"reason": "editor_block", "entities": entity_ids})


def lock_unsupported() -> ApiError:
    return ApiError(409, "wiskey_lock_unsupported", LOCK_UNSUPPORTED, details={"outcome": "not_sent"})


# ---------------------------------------------------------------- resolving a lock target

def target_kind(conn: sqlite3.Connection, entity_id: str) -> str:
    """`wiskey` (a WisKey lock), `other` (any other known entity) or `unknown` (a lock id the mirror does not hold: it cannot
    be resolved, so the editor refuses it while the block is on)."""
    if not entity_id.startswith("lock."):
        return "other"
    row = conn.execute("SELECT domain, platform FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    if row is None:
        return "unknown"
    return "wiskey" if (row["platform"] or "") in intercom_doors.WISKEY_PLATFORMS else "other"


def _blocked_target(conn: sqlite3.Connection, entity_id: str) -> bool:
    return target_kind(conn, entity_id) in ("wiskey", "unknown")


# ---------------------------------------------------------------- D8: the editors

def _old_step_keys(old_facts: dict[str, Any] | None) -> Counter[tuple[str, str]]:
    return Counter((s.get("action") or "", s.get("entity_id") or "") for s in (old_facts or {}).get("steps", []))


def _raw_text(raw: Any) -> str:
    try:
        return json.dumps(raw, ensure_ascii=False, sort_keys=True)
    except (TypeError, ValueError):
        return str(raw)


def _locked_block_opens(conn: sqlite3.Connection, block: dict[str, Any], wiskey_ids: set[str]) -> list[str]:
    """Entities a NEW code-mode block would open: a WisKey `unlock_door` call, an unlock / open of a WisKey (or unresolvable)
    lock, or a WisKey lock entity named in a block that opens locks. "?" stands for a target that cannot be resolved."""
    raw = block.get("raw")
    text = _raw_text(raw)
    effects = block.get("effects")
    hits: list[str] = []
    if isinstance(effects, list):
        hits = [e for e in effects if isinstance(e, str) and e.startswith("lock.") and _blocked_target(conn, e)]
    service = ""
    if isinstance(raw, dict):
        s = raw.get("action") if raw.get("action") is not None else raw.get("service")
        service = s if isinstance(s, str) else ""
    opens = service in OPEN_SERVICES or service.endswith("." + WISKEY_UNLOCK_SERVICE) or WISKEY_UNLOCK_SERVICE in text
    if opens and not hits:
        mentioned = [e for e in sorted(wiskey_ids) if e in text]
        if mentioned:
            hits = mentioned
        elif effects == "unknown" or WISKEY_UNLOCK_SERVICE in text:
            hits = ["?"]
    return hits


def check_automation_item(conn: sqlite3.Connection, kind: str, new_facts: dict[str, Any], old_facts: dict[str, Any] | None, new_draft: dict[str, Any] | None,
                          old_locked_fingerprints: set[str]) -> None:
    """Raise `wiskey_door_step_blocked` when a save adds a door step. `new_facts` / `old_facts` are automation_scope.facts_of;
    `old_locked_fingerprints` those of the stored item's locked (code-mode) blocks."""
    if editor_mode(conn) == "allowed":
        return
    old = _old_step_keys(old_facts)
    seen: Counter[tuple[str, str]] = Counter()
    bad: list[str] = []
    for s in new_facts.get("steps", []):
        eid = s.get("entity_id") or ""
        if not eid.startswith("lock."):
            continue
        key = (s.get("action") or "", eid)
        seen[key] += 1
        if kind == "scene":
            # a member is new when the lock was not a member before, or when it now opens and did not (SEC-WXD M1: a
            # member flipped from locked to unlocked is a new door opening)
            was_member = ("lock.lock", eid) in old or ("lock.unlock", eid) in old
            is_new = not was_member or (key[0] in OPEN_SERVICES and seen[key] > old[key])
        else:
            # a step is new when the item now holds more of this (action, lock) than it did: a copy of an existing one counts
            is_new = key[0] in OPEN_SERVICES and seen[key] > old[key]
        if is_new and _blocked_target(conn, eid) and eid not in bad:
            bad.append(eid)
    if new_draft is not None:
        from . import automation_model as model

        wiskey_ids = intercom_doors.wiskey_lock_ids(conn)
        for wk in model.walk_draft(new_draft):
            b = wk.block
            if b.get("kind") != "locked" or model.true_fingerprint(b) in old_locked_fingerprints:
                continue
            for e in _locked_block_opens(conn, b, wiskey_ids):
                if e not in bad:
                    bad.append(e)
    if bad:
        raise refusal([e for e in bad if e != "?"])


def check_capture(conn: sqlite3.Connection, entity_ids: list[str]) -> None:
    """Scene capture: a WisKey (or unresolvable) lock is never taken as a scene member while the block is on - nor a lock
    group or template lock that may open one (SEC-WXD M1: expanded by the shared resolver)."""
    if editor_mode(conn) == "allowed":
        return
    bad = [e for e in entity_ids if e.startswith("lock.") and _blocked_target(conn, e)]
    r = door_path.Resolver(conn)
    if r.present():
        for e in entity_ids:
            if not e.startswith("lock.") or e in bad:
                continue
            res = door_path.Resolution()
            r._lock(e, "lock.unlock", "capture", (), 0, res, frozenset(), explicit=True)
            if res.has_door:
                bad.append(e)
    if bad:
        raise refusal(bad)


# ---------------------------------------------------------------- D8 by the shared resolver (SEC-WXD M1)
#
# The typed / code-mode matchers above judge the item's OWN lock steps by entity id. The resolver of D7 / D9 also follows
# lock groups, device actions, called scripts / automations / scenes, scene member states and templates. A save is refused
# when the new content holds MORE of some door (lock entity, station, relay) or of some reason a door cannot be resolved than
# the stored content did: what was there may stay, be moved or be removed, never be added to. Applied only where a WisKey
# door exists at all (without one nothing can be a WisKey door; the matchers above still refuse unknown lock targets).

def _door_counts(res: door_path.Resolution) -> Counter[tuple[Any, ...]]:
    c: Counter[tuple[Any, ...]] = Counter()
    for s in res.door_steps:
        c[("door", s.entity_id or "", s.station_id or "", s.relay)] += 1
    for u in res.unresolved:
        c[("unresolved", u.reason)] += 1
    return c


def _added(new: door_path.Resolution, old: door_path.Resolution | None) -> tuple[list[str], bool]:
    """The entries the new content adds: door lock entity ids, or "?" for a door that cannot be resolved; and whether ONLY
    script-backed entities (template / universal, SEC-WXD M3) were added - a possible door, not a known one."""
    n, o = _door_counts(new), _door_counts(old) if old is not None else Counter()
    out: list[str] = []
    only_possible = True
    for key, count in n.items():
        if count > o[key]:
            label = key[1] if key[0] == "door" and key[1] else "?"
            if label not in out:
                out.append(label)
            only_possible = only_possible and key == ("unresolved", "template_entity")
    return out, bool(out) and only_possible


def _raise_added(added: list[str], only_possible: bool) -> None:
    if not added:
        return
    if only_possible:
        raise ApiError(422, "wiskey_door_step_blocked", POSSIBLE_DOOR_REFUSAL, details={"reason": "possible_door", "entities": []})
    raise refusal([e for e in added if e != "?"])


def check_config(conn: sqlite3.Connection, kind: str, new_config: dict[str, Any] | None, old_config: dict[str, Any] | None, entity_id: str | None = None) -> None:
    """Automations / scripts / scenes (typed builder, code mode, copy, restore): refuse a save whose content adds a door step
    or a step whose door cannot be resolved, as the D7 / D9 resolver sees it."""
    if editor_mode(conn) == "allowed" or not isinstance(new_config, dict):
        return
    r = door_path.Resolver(conn)
    if not r.present():
        return
    seen = frozenset({entity_id}) if entity_id else frozenset()
    new = r.resolve_config(kind, new_config, (), 0, None, seen)
    if not new.has_door:
        return
    old = r.resolve_config(kind, old_config, (), 0, None, seen) if isinstance(old_config, dict) else None
    _raise_added(*_added(new, old))


def check_schedule_payload(conn: sqlite3.Connection, new_item: dict[str, Any] | None, old_item: dict[str, Any] | None) -> None:
    """Schedules (create, update, split, copy, trash restore): the same rule over the component's `timeslots`."""
    if editor_mode(conn) == "allowed" or not isinstance(new_item, dict):
        return
    r = door_path.Resolver(conn)
    if not r.present():
        return
    new = r.resolve_schedule_slots(new_item)
    if not new.has_door:
        return
    old = r.resolve_schedule_slots(old_item) if isinstance(old_item, dict) else None
    _raise_added(*_added(new, old))


def _slots_item(d: dict[str, Any] | None) -> dict[str, Any] | None:
    """A schedule draft or core (`slots[].actions[]` = {service, entity_id, data}) in the component's form the resolver reads
    (`timeslots[].actions[]` = {service, entity_id, service_data})."""
    if not isinstance(d, dict):
        return None
    timeslots = []
    for slot in d.get("slots") or []:
        actions = []
        for a in (slot.get("actions") if isinstance(slot, dict) else None) or []:
            if isinstance(a, dict):
                actions.append({"service": a.get("service"), "entity_id": a.get("entity_id"), "service_data": a.get("data") if a.get("data") is not None else a.get("service_data")})
        timeslots.append({"actions": actions})
    return {"timeslots": timeslots}


def check_schedule(conn: sqlite3.Connection, draft: dict[str, Any], old_core: dict[str, Any] | None) -> None:
    """The schedule editor (create, update, split, copy, trash restore): a NEW action that opens a WisKey (or unresolvable)
    lock is refused; existing ones stay. The shared resolver judges indirect targets (scripts, groups) too (SEC-WXD M1)."""
    if editor_mode(conn) == "allowed":
        return
    check_schedule_payload(conn, _slots_item(draft), _slots_item(old_core))
    old = Counter((a.get("service") or "", a.get("entity_id") or "") for slot in (old_core or {}).get("slots", []) for a in slot.get("actions", []))
    seen: Counter[tuple[str, str]] = Counter()
    bad: list[str] = []
    for slot in draft.get("slots") or []:
        for a in slot.get("actions") or []:
            eid, svc = a.get("entity_id") or "", a.get("service") or ""
            if svc not in OPEN_SERVICES or not eid.startswith("lock."):
                continue
            seen[(svc, eid)] += 1
            if seen[(svc, eid)] > old[(svc, eid)] and _blocked_target(conn, eid) and eid not in bad:
                bad.append(eid)
    if bad:
        raise refusal(bad)


# ---------------------------------------------------------------- D6: scheduled lock jobs that will never work

def wiskey_lock_jobs(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Schedules (Arx's mirror only; no call out) with an action `lock.lock` on a WisKey lock. Alias and lock name only."""
    wiskey = intercom_doors.wiskey_lock_ids(conn)
    if not wiskey:
        return []
    try:
        rows = conn.execute("SELECT schedule_id, item_json FROM schedule_cache ORDER BY schedule_id").fetchall()
    except sqlite3.OperationalError:
        return []
    names = {e["entity_id"]: (e["name"] or e["entity_id"]) for e in intercom_doors.wiskey_locks(conn)}
    out: list[dict[str, Any]] = []
    for r in rows:
        try:
            item = json.loads(r["item_json"])
        except (TypeError, ValueError):
            continue
        hits: list[str] = []
        _collect_lock_targets(item, wiskey, hits)
        if hits:
            name = str(item.get("name") or "") if isinstance(item, dict) else ""
            out.append({"schedule_id": r["schedule_id"], "name": name, "locks": [names.get(h, h) for h in dict.fromkeys(hits)], "note": NEVER_WORKS})
    return out


def _ids_of(v: Any) -> list[str]:
    if isinstance(v, str):
        return [v]
    if isinstance(v, list):
        return [x for x in v if isinstance(x, str)]
    return []


def _collect_lock_targets(node: Any, wiskey: set[str], hits: list[str]) -> None:
    """Walk a stored schedule item for an action that calls lock.lock on a WisKey lock (any nesting, either spelling of
    the service key, entity_id / entity_ids / target.entity_id)."""
    if isinstance(node, dict):
        svc = node.get("service") if isinstance(node.get("service"), str) else node.get("action")
        if svc == "lock.lock":
            ids = _ids_of(node.get("entity_id")) + _ids_of(node.get("entity_ids"))
            tgt = node.get("target")
            if isinstance(tgt, dict):
                ids += _ids_of(tgt.get("entity_id"))
            hits.extend(i for i in ids if i in wiskey)
        for v in node.values():
            _collect_lock_targets(v, wiskey, hits)
    elif isinstance(node, list):
        for v in node:
            _collect_lock_targets(v, wiskey, hits)
