"""STATIONPERM-295 (docs/changes/CR-STATION-PERMISSIONS-295.md): a person's access per access-control station (WisKey) as a
first-class, auditable Arx decision.

One row per (WisKey person, station) in `access_station_permissions` (migration 0142, PROVISIONAL number): the person's PERSONAL
decision for that station - `allow` (with its relays), `deny` (blocked, beats any group) or `inherit` (no personal entry: the station
follows the person's WisKey groups). Arx RBAC is the only authority; WisKey executes.

Rules (CR sections 2-5):
- Permission `access.people.stations` (sensitive, station-scoped; system_admin and site_admin by default - owner decision 2026-10-21) is judged on the ONE station being changed,
  never on every station of the person. A widening (allow, more relays, inherit from deny) needs it; a holder of
  `access.people.manage` on the station without it may only REQUEST the widening (the ACCESSREQ decision (b) pattern), and the
  requester never approves his own request unless he is a system administrator (decision (a)). A narrowing (deny, fewer relays, inherit
  from allow) needs `access.people.stations` OR `access.people.manage` on the station and applies at once.
- Interactive human sessions only for widenings and approvals (the PG rule); a local (Arx-only) identity only with
  `access.external.local_approvers` on; never on the WisKey person linked to the caller's own Arx user (unless system administrator).
- A person with a live external grant is owned by the grant: refused.
- The timing policy (mode / schedule / bindings) is read whole and NEVER written here. `native` mode: an allow needs the policy to
  already bind the station; an unreadable policy refuses an allow. A block never needs the policy.
- The WisKey write (`Engine.set_station_access`) carries the COMPLETE `permission_overrides` map from a FRESH read at its revision
  (compare-and-set; every other station's entry carried over) and the relays of an allowed station - nothing else. A restricted or
  malformed read refuses the write. The decision is committed first; the WisKey call runs with no write lock held; its outcome is
  recorded afterwards (`pending` / `applied` / `unverified` / `failed`). `applied` needs a fresh read-back that proves the effect;
  a block also needs the central sync status to show no pending revocation.
- OFF: the switch `access.station_permissions` (default `off`) cannot be turned on in this build - the owner's separate go-live permit
  is `access_grants.GO_LIVE_PERMITTED` (False), which the live engine also checks. Tests drive everything with fakes only.

Audit (ids only): `access.station_permission.{allow,block,inherit,request,approve,refuse,push}` on the station, details
{person, effect, state, code}. Never a relay map, a name, a phone, a PIN or a card.
"""
from __future__ import annotations

import inspect
import json
import sqlite3
import uuid
from typing import Any

from ..db import Database, get_setting, now_iso, permission_revision
from ..errors import ApiError, forbidden
from ..rbac import LOCAL_ID_PREFIX, STATION, Principal, authorize, is_system_admin
from . import access_grants as ag
from . import intercom_authority as ia
from .access_grant_engine import RELAYS, EngineError, EnginePerson

PERMISSION = "access.people.stations"
FLAG_KEY = "access.station_permissions"
KEYS = (FLAG_KEY,)
EFFECTS = ("allow", "deny", "inherit")
SYNC_STATES = ("none", "pending", "applied", "unverified", "failed")
RESOURCE = STATION


# ---------------------------------------------------------------- switch and settings

def enabled(conn: sqlite3.Connection) -> bool:
    """On only with the setting on AND the go-live permit in the build (fail closed: an unreadable setting is off)."""
    try:
        return (get_setting(conn, FLAG_KEY) or "off") == "on" and ag.go_live_permitted()
    except sqlite3.Error:
        return False


def settings_view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {"station_permissions": "on" if enabled(conn) else "off", "go_live_permitted": ag.go_live_permitted()}


def _off() -> ApiError:
    return ApiError(404, "station_permissions_off", "הרשאות לפי עמדה כבויות במערכת זו.")


def _invalid(field_name: str, code: str) -> ApiError:
    return ApiError(422, "station_permission_invalid", "הבקשה אינה תקינה.", details={"field": field_name, "code": code})


def _conflict(code: str, text: str, **details: Any) -> ApiError:
    return ApiError(409, code, text, details=details)


def _audit(conn: sqlite3.Connection, actor: Any, action: str, station_id: str, *, decision: str = "allowed", reason: str | None = None,
           request_id: str | None = None, **details: Any) -> None:
    ag._audit(conn, actor, f"access.station_permission.{action}", station_id, decision=decision, reason=reason, request_id=request_id,
              resource_type=RESOURCE, **details)


# ---------------------------------------------------------------- rows

def row_of(conn: sqlite3.Connection, person_id: str, station_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM access_station_permissions WHERE wiskey_person_id = ? AND station_id = ?", (person_id, station_id)).fetchone()
    return dict(r) if r else None


def rows_of(conn: sqlite3.Connection, person_id: str) -> dict[str, dict[str, Any]]:
    return {r["station_id"]: dict(r) for r in conn.execute("SELECT * FROM access_station_permissions WHERE wiskey_person_id = ?", (person_id,)).fetchall()}


def _relays(text: Any) -> list[int]:
    try:
        value = json.loads(text or "[]")
    except (TypeError, ValueError):
        return []
    return sorted({r for r in value if isinstance(r, int) and not isinstance(r, bool)}) if isinstance(value, list) else []


def _name_of(conn: sqlite3.Connection, user_id: str | None) -> str | None:
    if not user_id:
        return None
    r = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,)).fetchone()
    return ((r["display_name"] or r["username"]) if r else None) or None


# ---------------------------------------------------------------- validation

def valid_station(station_id: Any) -> bool:
    return ia.valid_id(station_id) and station_id not in ("*", "all")


def clean_relays(effect: str, relays: Any) -> list[int]:
    if effect != "allow":
        if relays not in (None, []):
            raise _invalid("relays", "only_for_allow")
        return []
    if not isinstance(relays, list) or not relays or not all(isinstance(r, int) and not isinstance(r, bool) and r in RELAYS for r in relays):
        raise _invalid("relays", "format")
    return sorted(set(relays))


# ---------------------------------------------------------------- who may do what

class Rights:
    """The caller's rights on ONE station (rbac.authorize: deny-overrides over the station chain)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal, station_id: str) -> None:
        def held(perm: str) -> bool:
            try:
                return authorize(conn, principal, perm, (STATION, station_id)).allowed
            except Exception:  # noqa: BLE001 - fail closed
                return False

        self.read = held(ia.PEOPLE_READ)
        self.grant = held(PERMISSION)
        self.manage = held(ia.PEOPLE_MANAGE)

    @property
    def narrow(self) -> bool:
        return self.grant or self.manage

    @property
    def request(self) -> bool:
        return self.manage and not self.grant


def _session_ok(conn: sqlite3.Connection, principal: Principal) -> bool:
    """Interactive human session (the PG rule); a local identity only when the owner allows local deciders."""
    if not ag._interactive(principal):
        return False
    if str(principal.user_id).startswith(LOCAL_ID_PREFIX) and not ag.local_approvers(conn):
        return False
    return True


def _is_admin(conn: sqlite3.Connection, principal: Principal) -> bool:
    try:
        return is_system_admin(conn, principal.user_id)
    except Exception:  # noqa: BLE001 - fail closed
        return False


def is_self(conn: sqlite3.Connection, principal: Principal, person_id: str) -> bool:
    """The WisKey person is linked to the caller's own Arx user (CR section 3: no self-service)."""
    try:
        return conn.execute("SELECT 1 FROM access_person_links WHERE wiskey_person_id = ? AND subject_kind = 'user' AND subject_id = ?",
                            (person_id, principal.user_id)).fetchone() is not None
    except sqlite3.OperationalError:
        return False


def grant_live(conn: sqlite3.Connection, person_id: str) -> bool:
    """A live external grant owns this person's door map (CR section 2, external grants)."""
    marks = ",".join("?" * len(ag.LIVE))
    try:
        return conn.execute(
            f"""SELECT 1 FROM access_person_links l JOIN access_grants g
                  ON (g.link_id = l.id OR (g.subject_kind = l.subject_kind AND g.subject_id = l.subject_id))
                WHERE l.wiskey_person_id = ? AND g.state IN ({marks}) LIMIT 1""", (person_id, *ag.LIVE)).fetchone() is not None
    except sqlite3.OperationalError:
        return False


def timing_problem(person: EnginePerson | None, station_id: str, effect: str) -> str | None:
    """Mode / schedule / bindings stay together: judged whole, never written. Only an allow can be refused."""
    if effect != "allow":
        return None
    if person is None:
        return "station_permission_unreadable"
    policy = person.timing_policy
    if policy is None:
        return None
    if policy.get("malformed") or policy.get("extra") or set(policy) - {"mode", "schedule", "bindings"} or policy.get("mode") not in ("ha", "native"):
        return "station_permission_timing_unreadable"
    if policy.get("mode") == "native":
        bindings = policy.get("bindings")
        if not isinstance(bindings, dict) or station_id not in bindings:
            return "station_permission_timing_binding"
    return None


TIMING_TEXT = {
    "station_permission_unreadable": "לא ניתן לקרוא את האדם ב-WisKey כרגע. נסו שוב.",
    "station_permission_timing_unreadable": "לא ניתן לקרוא את לוח הזמנים של האדם ב-WisKey.",
    "station_permission_timing_binding": "לוח הזמנים של האדם אינו כולל את העמדה הזו.",
}


# ---------------------------------------------------------------- reading the person (engine port: fakes in tests)

def _read(db: Database, person_id: str) -> tuple[EnginePerson | None, str | None]:
    """A fresh WisKey read. (person, None) or (None, error kind). `not_found` is NOT proof of absence (a scoped answer looks the same)."""
    try:
        return ag.engine_for(db).get_person(person_id), None
    except EngineError as exc:
        return None, exc.kind
    except Exception:  # noqa: BLE001 - an unexpected answer is "unreadable", never an empty person
        return None, "unknown"


def _personal(person: EnginePerson | None, station_id: str) -> tuple[str | None, list[int]]:
    """The person's personal entry for the station as WisKey shows it: (allow|deny|inherit, relays) or (None, []) when unreadable."""
    if person is None or not person.overrides_known:
        return None, []
    mode = person.overrides.get(station_id)
    relays = sorted(person.doors.get(station_id, [])) if person.doors_known else []
    return (mode if mode in ("allow", "deny") else "inherit"), relays


def is_widening(effect: str, relays: list[int], current: str | None, current_relays: list[int]) -> bool:
    """CR section 3: allow / more relays / inherit from deny widen; deny / fewer relays / inherit from allow narrow. An unknown current
    state is treated as the widest change (fail closed): allow and inherit widen, deny narrows."""
    if effect == "deny":
        return False
    if current is None:
        return True
    if effect == "allow":
        return current != "allow" or bool(set(relays) - set(current_relays))
    return current == "deny"  # inherit


def _visible(conn: sqlite3.Connection, principal: Principal, person: EnginePerson | None, station_ids: list[str]) -> bool:
    auth = ia.Authority(conn, principal)
    if person is not None and person.doors_known:
        return auth.person_level(person.stations) != ia.NONE
    return any(auth.station(ia.PEOPLE_READ, s) for s in station_ids)


# ---------------------------------------------------------------- the person's view

def _row_view(conn: sqlite3.Connection, principal: Principal, sid: str, row: dict[str, Any] | None, person: EnginePerson | None,
              admin: bool, session: bool, self_: bool, owned: bool, names: dict[str, str]) -> dict[str, Any]:
    rights = Rights(conn, principal, sid)
    enabled_now = (sid in person.doors) if person is not None and person.doors_known else None
    personal, relays = _personal(person, sid)
    if personal is None:
        source = "unknown"
    elif personal == "deny":
        source = "blocked"
    elif personal == "allow":
        source = "personal"
    else:
        source = "group" if enabled_now else "none"
    record = None
    request = None
    if row:
        if row["effect"]:
            record = {"effect": row["effect"], "relays": _relays(row["relays_json"]), "sync_state": row["sync_state"], "decided_at": row["decided_at"],
                      "decided_by_name": _name_of(conn, row["decided_by"]), "proof_at": row["proof_at"], "last_error": row["last_error"]}
        if row["request_effect"]:
            mine = row["requested_by"] == principal.user_id
            request = {"effect": row["request_effect"], "relays": _relays(row["request_relays_json"]), "requested_at": row["requested_at"],
                       "requested_by_name": _name_of(conn, row["requested_by"]), "mine": mine}
    can = not owned and not (self_ and not admin)
    widen_ok = can and session and (rights.grant or rights.request)
    narrow_ok = can and rights.narrow
    current = record["effect"] if record else personal
    actions = {
        "allow": widen_ok,
        "deny": narrow_ok and current != "deny",
        "inherit": (widen_ok if current == "deny" else narrow_ok) and current in ("allow", "deny"),
        "approve": can and session and bool(request) and rights.grant and (admin or not (request or {}).get("mine")),
        "refuse": can and bool(request) and (rights.grant or bool((request or {}).get("mine"))),
        "sync": narrow_ok and bool(record) and record["sync_state"] != "applied",
    }
    return {"station_id": sid, "name": names.get(sid), "enabled": enabled_now, "relays": relays, "source": source, "record": record, "request": request,
            "revision": row["revision"] if row else 0, "decides": rights.grant, "request_only": rights.request, "actions": actions}


def person_view(db: Database, principal: Principal, person_id: str) -> dict[str, Any]:
    with db.connection(mode="read") as conn:
        if not enabled(conn):
            raise _off()
    person, err = _read(db, person_id)
    with db.connection(mode="read") as conn:
        rows = rows_of(conn, person_id)
        stations = list(dict.fromkeys([*(person.stations if person else ()), *rows]))
        if err == "not_found" or not _visible(conn, principal, person, stations):
            from .intercom_writes import uniform_not_found

            raise uniform_not_found()
        auth = ia.Authority(conn, principal)
        admin, session = _is_admin(conn, principal), _session_ok(conn, principal)
        self_, owned = is_self(conn, principal, person_id), grant_live(conn, person_id)
        names = _station_names()
        shown = [s for s in stations if auth.station(ia.PEOPLE_READ, s)]
        out = [_row_view(conn, principal, s, rows.get(s), person, admin, session, self_, owned, names) for s in shown]
        addable = []
        if person is not None and person.doors_known and not owned and not (self_ and not admin):
            for st in _served_stations():
                sid = st["station_id"]
                if sid in stations or not auth.station(ia.PEOPLE_READ, sid):
                    continue
                r = Rights(conn, principal, sid)
                if r.grant or r.request:
                    addable.append({**st, "request_only": r.request})
        policy = person.timing_policy if person else None
        return {"person_id": person_id, "read": "fresh" if person is not None else "unavailable", "wiskey_revision": person.revision if person else None,
                "timing_mode": (policy or {}).get("mode") if isinstance((policy or {}).get("mode"), str) else None,
                "grant_live": owned, "self": self_, "system_admin": admin, "stations": out, "addable": addable}


def _served_stations() -> list[dict[str, Any]]:
    """Station names and relays from the served WisKey copy (never the device). Empty without a copy."""
    try:
        from .intercom_sync import SYNC

        out = []
        for s in SYNC.stations():
            sid = str(s.get("id") or "")
            if valid_station(sid):
                relays = sorted({lk.get("physical_index") for lk in s.get("locks") or [] if isinstance(lk, dict) and lk.get("physical_index") in RELAYS})
                out.append({"station_id": sid, "name": str(s.get("name") or "")[:64] or None, "relays": relays or [1]})
        return out
    except Exception:  # noqa: BLE001 - no copy: nothing to add
        return []


def _station_names() -> dict[str, str]:
    try:
        from .intercom_sync import SYNC

        return {str(s.get("id")): str(s.get("name") or "")[:64] for s in SYNC.stations() if s.get("id") and s.get("name")}
    except Exception:  # noqa: BLE001
        return {}


# ---------------------------------------------------------------- decisions

def _guards(conn: sqlite3.Connection, principal: Principal, person_id: str, station_id: str, action: str, request_id: str | None) -> bool:
    """The refusals common to every change. Returns whether the caller is a system administrator."""
    admin = _is_admin(conn, principal)
    if grant_live(conn, person_id):
        _audit(conn, principal, action, station_id, decision="denied", reason="grant_live", request_id=request_id, person=person_id)
        raise _conflict("station_permission_grant_live", "לאדם יש גישה זמנית פעילה; הדלתות שלו מנוהלות שם.")
    if is_self(conn, principal, person_id) and not admin:
        _audit(conn, principal, action, station_id, decision="denied", reason="self", request_id=request_id, person=person_id)
        raise ApiError(403, "station_permission_self", "לא ניתן לשנות את הגישה של עצמך.")
    return admin


def _deny(conn: sqlite3.Connection, principal: Principal, action: str, station_id: str, person_id: str, reason: str, request_id: str | None) -> ApiError:
    _audit(conn, principal, action, station_id, decision="denied", reason=reason, request_id=request_id, person=person_id)
    return forbidden(permission=PERMISSION, target_type=RESOURCE, target_id=station_id, reason=reason)


def decide(db: Database, principal: Principal, person_id: str, station_id: str, effect: str, relays: Any, revision: int,
           request_id: str | None = None) -> dict[str, Any]:
    """Allow / block / follow groups on one station (CR sections 2-5). A widening by a request-only manager is stored as a request."""
    if effect not in EFFECTS:
        raise _invalid("effect", "unknown")
    if not valid_station(station_id):
        raise _invalid("station_id", "format")
    relays = clean_relays(effect, relays)
    with db.connection(mode="read") as conn:
        if not enabled(conn):
            raise _off()
    person, err = _read(db, person_id)
    action = {"allow": "allow", "deny": "block", "inherit": "inherit"}[effect]
    with db.connection(label="station_permissions.decide") as conn:
        if not enabled(conn):
            raise _off()
        stations = [*(person.stations if person else ()), station_id]
        if err == "not_found" or not _visible(conn, principal, person, stations):
            from .intercom_writes import uniform_not_found

            raise uniform_not_found()
        admin = _guards(conn, principal, person_id, station_id, action, request_id)
        row = row_of(conn, person_id, station_id)
        if (row["revision"] if row else 0) != revision:
            raise _conflict("station_permission_revision", "ההרשאה השתנתה בינתיים. רעננו ונסו שוב.", revision=row["revision"] if row else 0)
        current, current_relays = _personal(person, station_id)
        if row and row["effect"]:
            current, current_relays = row["effect"], _relays(row["relays_json"])
        widen = is_widening(effect, relays, current, current_relays)
        rights = Rights(conn, principal, station_id)
        if widen:
            if not (rights.grant or rights.request):
                raise _deny(conn, principal, action, station_id, person_id, "no_binding", request_id)
            if not _session_ok(conn, principal):
                raise _deny(conn, principal, action, station_id, person_id, "not_interactive", request_id)
            problem = timing_problem(person, station_id, effect) if effect == "allow" else (None if person is not None else "station_permission_unreadable")
            if problem:
                _audit(conn, principal, action, station_id, decision="denied", reason=problem, request_id=request_id, person=person_id)
                raise _conflict(problem, TIMING_TEXT[problem])
        elif not rights.narrow:
            raise _deny(conn, principal, action, station_id, person_id, "no_binding", request_id)
        at = now_iso()
        if widen and not rights.grant:
            _store_request(conn, row, person_id, station_id, effect, relays, principal, at)
            _audit(conn, principal, "request", station_id, request_id=request_id, person=person_id, effect=effect, state="requested")
            return {"outcome": "requested"}
        _store_decision(conn, row, person_id, station_id, effect, relays, principal, at)
        _audit(conn, principal, action, station_id, request_id=request_id, person=person_id, effect=effect, state="pending", system_admin=admin or None)
    result = push(db, principal, person_id, station_id, request_id, check_rights=False)
    return {"outcome": "decided", **result}


def _store_request(conn: sqlite3.Connection, row: dict[str, Any] | None, person_id: str, station_id: str, effect: str, relays: list[int],
                   principal: Principal, at: str) -> None:
    if row is None:
        conn.execute("""INSERT INTO access_station_permissions(id, wiskey_person_id, station_id, effect, relays_json, sync_state, request_effect,
                        request_relays_json, requested_by, requested_at, created_at, updated_at, revision)
                        VALUES (?, ?, ?, NULL, '[]', 'none', ?, ?, ?, ?, ?, ?, 1)""",
                     (uuid.uuid4().hex, person_id, station_id, effect, json.dumps(relays), principal.user_id, at, at, at))
    else:
        conn.execute("""UPDATE access_station_permissions SET request_effect = ?, request_relays_json = ?, requested_by = ?, requested_at = ?,
                        updated_at = ?, revision = revision + 1 WHERE id = ?""", (effect, json.dumps(relays), principal.user_id, at, at, row["id"]))


def _store_decision(conn: sqlite3.Connection, row: dict[str, Any] | None, person_id: str, station_id: str, effect: str, relays: list[int],
                    principal: Principal, at: str) -> None:
    rev = permission_revision(conn)
    if row is None:
        conn.execute("""INSERT INTO access_station_permissions(id, wiskey_person_id, station_id, effect, relays_json, sync_state, decided_by, decided_at,
                        approval_revision, created_at, updated_at, revision) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 1)""",
                     (uuid.uuid4().hex, person_id, station_id, effect, json.dumps(relays), principal.user_id, at, rev, at, at))
    else:
        # a direct decision settles any request waiting on the station (the decider saw it on the same screen)
        conn.execute("""UPDATE access_station_permissions SET effect = ?, relays_json = ?, sync_state = 'pending', decided_by = ?, decided_at = ?,
                        approval_revision = ?, request_effect = NULL, request_relays_json = NULL, requested_by = NULL, requested_at = NULL,
                        proof_at = NULL, last_error = NULL, attempts = 0, updated_at = ?, revision = revision + 1 WHERE id = ?""",
                     (effect, json.dumps(relays), principal.user_id, at, rev, at, row["id"]))


def approve(db: Database, principal: Principal, person_id: str, station_id: str, revision: int, request_id: str | None = None) -> dict[str, Any]:
    with db.connection(mode="read") as conn:
        if not enabled(conn):
            raise _off()
    person, err = _read(db, person_id)
    with db.connection(label="station_permissions.approve") as conn:
        if not enabled(conn):
            raise _off()
        row = row_of(conn, person_id, station_id)
        if row is None or not row["request_effect"] or not _visible(conn, principal, person, [*(person.stations if person else ()), station_id]) or err == "not_found":
            from .intercom_writes import uniform_not_found

            raise uniform_not_found()
        admin = _guards(conn, principal, person_id, station_id, "approve", request_id)
        if row["revision"] != revision:
            raise _conflict("station_permission_revision", "ההרשאה השתנתה בינתיים. רעננו ונסו שוב.", revision=row["revision"])
        if not Rights(conn, principal, station_id).grant:
            raise _deny(conn, principal, "approve", station_id, person_id, "no_binding", request_id)
        if not _session_ok(conn, principal):
            raise _deny(conn, principal, "approve", station_id, person_id, "not_interactive", request_id)
        if row["requested_by"] == principal.user_id and not admin:
            _audit(conn, principal, "approve", station_id, decision="denied", reason="self_approval", request_id=request_id, person=person_id)
            raise ApiError(403, "station_permission_self_approval", "מי שביקש אינו יכול לאשר את בקשתו.")
        effect, relays = row["request_effect"], _relays(row["request_relays_json"])
        problem = timing_problem(person, station_id, effect) if effect == "allow" else (None if person is not None else "station_permission_unreadable")
        if problem:
            _audit(conn, principal, "approve", station_id, decision="denied", reason=problem, request_id=request_id, person=person_id)
            raise _conflict(problem, TIMING_TEXT[problem])
        _store_decision(conn, row, person_id, station_id, effect, relays, principal, now_iso())
        _audit(conn, principal, "approve", station_id, request_id=request_id, person=person_id, effect=effect, state="pending")
    return {"outcome": "decided", **push(db, principal, person_id, station_id, request_id, check_rights=False)}


def refuse(db: Database, principal: Principal, person_id: str, station_id: str, revision: int, request_id: str | None = None) -> dict[str, Any]:
    with db.connection(label="station_permissions.refuse") as conn:
        if not enabled(conn):
            raise _off()
        row = row_of(conn, person_id, station_id)
        if row is None or not row["request_effect"] or not ia.Authority(conn, principal).station(ia.PEOPLE_READ, station_id):
            from .intercom_writes import uniform_not_found

            raise uniform_not_found()
        if row["revision"] != revision:
            raise _conflict("station_permission_revision", "ההרשאה השתנתה בינתיים. רעננו ונסו שוב.", revision=row["revision"])
        if not (Rights(conn, principal, station_id).grant or row["requested_by"] == principal.user_id):
            raise _deny(conn, principal, "refuse", station_id, person_id, "no_binding", request_id)
        at = now_iso()
        if row["effect"] is None:
            conn.execute("DELETE FROM access_station_permissions WHERE id = ?", (row["id"],))
        else:
            conn.execute("""UPDATE access_station_permissions SET request_effect = NULL, request_relays_json = NULL, requested_by = NULL, requested_at = NULL,
                            updated_at = ?, revision = revision + 1 WHERE id = ?""", (at, row["id"]))
        _audit(conn, principal, "refuse", station_id, request_id=request_id, person=person_id, effect=row["request_effect"],
               withdrawn=True if row["requested_by"] == principal.user_id else None)
    return {"outcome": "refused"}


# ---------------------------------------------------------------- the WisKey write and the read-back (engine port)

def _revocation_pending(engine: Any, person_id: str, revision: int) -> bool | None:
    """The central sync status; main's port takes the person id, the STATIONSYNC branch adds the read-back revision."""
    try:
        params = inspect.signature(engine.revocation_pending).parameters
        value = engine.revocation_pending(person_id, revision) if len(params) >= 2 else engine.revocation_pending(person_id)
    except EngineError:
        return None
    except Exception:  # noqa: BLE001 - unknown, never "no pending"
        return None
    return value if isinstance(value, bool) else None


def proven(person: EnginePerson, station_id: str, effect: str, relays: list[int], pending: bool | None) -> bool:
    if not person.overrides_known:
        return False
    mode = person.overrides.get(station_id)
    if effect == "inherit":
        return mode is None
    if not person.doors_known:
        return False
    if effect == "allow":
        return mode == "allow" and sorted(person.doors.get(station_id, [])) == sorted(relays)
    return mode == "deny" and station_id not in person.doors and pending is False


def plan(person: EnginePerson, station_id: str, effect: str, relays: list[int]) -> tuple[dict[str, str], dict[str, list[int]]]:
    """The complete overrides map (every other entry carried over) and the door map of the write. Refuses a restricted read."""
    if not person.overrides_known or not person.doors_known:
        raise EngineError("not_sent", "projection_restricted")
    overrides = dict(person.overrides)
    if effect == "inherit":
        overrides.pop(station_id, None)
    else:
        overrides[station_id] = effect
    return overrides, ({station_id: list(relays)} if effect == "allow" else {})


def push(db: Database, principal: Principal, person_id: str, station_id: str, request_id: str | None = None, *, check_rights: bool = True,
         revision: int | None = None) -> dict[str, Any]:
    """Send the station's current decision to WisKey and read it back. No write lock is held during the WisKey calls."""
    with db.connection(mode="read") as conn:
        if not enabled(conn):
            raise _off()
        row = row_of(conn, person_id, station_id)
        if check_rights:
            if row is None or not row["effect"] or not ia.Authority(conn, principal).station(ia.PEOPLE_READ, station_id):
                from .intercom_writes import uniform_not_found

                raise uniform_not_found()
            if revision is not None and row["revision"] != revision:
                raise _conflict("station_permission_revision", "ההרשאה השתנתה בינתיים. רעננו ונסו שוב.", revision=row["revision"])
    if check_rights:
        with db.connection(label="station_permissions.sync") as conn:
            _guards(conn, principal, person_id, station_id, "push", request_id)
            if not Rights(conn, principal, station_id).narrow:
                raise _deny(conn, principal, "push", station_id, person_id, "no_binding", request_id)
    assert row is not None
    effect, relays, seen = row["effect"], _relays(row["relays_json"]), row["revision"]
    engine = ag.engine_for(db)
    state, code, after = _send(engine, person_id, station_id, effect, relays)
    with db.connection(label="station_permissions.result") as conn:
        cur = conn.execute("""UPDATE access_station_permissions SET sync_state = ?, last_error = ?, wiskey_revision = COALESCE(?, wiskey_revision),
                              proof_at = ?, attempts = attempts + 1, updated_at = ?, revision = revision + 1 WHERE id = ? AND revision = ?""",
                           (state, code, after.revision if after else None, now_iso() if state == "applied" else None, now_iso(), row["id"], seen))
        superseded = cur.rowcount == 0
        _audit(conn, principal, "push", station_id, decision="allowed" if state in ("applied", "unverified", "pending") else "failed",
               request_id=request_id, person=person_id, effect=effect, state=state if not superseded else "superseded", code=code)
    return {"sync_state": state, "code": code}


def _send(engine: Any, person_id: str, station_id: str, effect: str, relays: list[int]) -> tuple[str, str | None, EnginePerson | None]:
    """(sync_state, closed code, the last person read). One retry on a revision conflict (a fresh read first); an unknown outcome is
    never retried blindly - it is read back."""
    for attempt in range(2):
        try:
            person = engine.get_person(person_id)
        except EngineError as exc:
            return ("unverified" if exc.kind == "not_found" else "pending"), exc.kind, None
        if effect == "allow":
            problem = timing_problem(person, station_id, effect)
            if problem:
                return "failed", problem, person
        try:
            overrides, doors = plan(person, station_id, effect, relays)
        except EngineError as exc:
            return "pending", exc.code or exc.kind, person
        if proven(person, station_id, effect, relays, _revocation_pending(engine, person_id, person.revision) if effect == "deny" else None):
            return "applied", None, person  # already so in WisKey: nothing to write
        try:
            engine.set_station_access(person_id, person.revision, overrides=overrides, doors=doors)
        except EngineError as exc:
            if exc.kind == "revision_conflict" and attempt == 0:
                continue
            if exc.kind in ("not_sent", "not_permitted", "revision_conflict"):
                return "pending", exc.kind, person
            if exc.kind == "unknown":
                break  # read back, never resend
            return "failed", exc.kind, person
        break
    try:
        after = engine.get_person(person_id)
    except EngineError as exc:
        return "unverified", exc.kind, None
    pending = _revocation_pending(engine, person_id, after.revision) if effect == "deny" else None
    if proven(after, station_id, effect, relays, pending):
        return "applied", None, after
    return "unverified", ("revocation_pending" if effect == "deny" and pending is not False else "readback"), after
