"""The one Arx rule for opening a WisKey door (CR-033 slice D3, owner decision 13 = ג: "either permission is enough").

`check(conn, principal, station_id, relay, entity_id)` is the only authority for every Arx-started opening of a WisKey
door - the devices tile (routers/ha.py), the WisKey screen and its notification deep link (routers/access_control.py) -
so no screen can diverge from another ("no second authority in Arx"). Order:

1. Refused before anything else: no identified principal (`identity_unmapped`: a developer identity outside developer
   mode), an inactive user, a wall-display account (`wall_account`: an enabled wall profile or a kiosk binding - SEC-WXD
   L1: refused as such, whatever else reaches it).
2. Deny wins across both permissions: an active deny binding that takes away `access.release` anywhere on the station's
   chain, or `door.unlock` anywhere on the lock entity's chain, refuses the request - "either permission" can never be
   used to slip past a deny the administrator wrote for the other one.
3. Allowed with `access.release` on the station's chain (the station -> its building -> its site -> installation), or with
   `door.unlock` on the lock entity's own chain (installation, or a floor it has its own anchor on - the existing entity
   scope without a shared room's mirrors; who may place or remove that anchor is `placement_allowed`, SEC-WXD M2).
4. `ha.entity.control` is NOT required for a WisKey door (it stays required for every other lock).

Viewer principals hold neither permission, so they are refused by step 3 and nothing is ever sent for them; a kiosk
account is refused at step 1 even when a grant reaches it.
The confirmation is not part of this rule: it always comes from the client and is checked by the route."""
from __future__ import annotations

import sqlite3
from dataclasses import asdict, dataclass

from ..rbac import INSTALLATION, STATION, Decision, Principal, authorize
from ..rbac import _active_bindings as rbac_active_bindings
from . import ha_scope, intercom_doors

RELEASE = "access.release"
UNLOCK = "door.unlock"


@dataclass(frozen=True)
class DoorDecision:
    allowed: bool
    reason: str
    granted_by: str | None = None  # access.release | door.unlock
    scope_type: str | None = None
    scope_id: str | None = None
    binding_id: str | None = None
    role_id: str | None = None

    def audit_fields(self) -> dict[str, str | None]:
        """What the door's audit rows record about the grant (CR-033 section 7)."""
        return {k: v for k, v in asdict(self).items() if k in ("granted_by", "scope_type", "scope_id", "binding_id")}

    def as_rbac(self) -> Decision | None:
        """The allowing decision in the shape rbac.note_grant records for the request's audit rows."""
        if not self.allowed:
            return None
        return Decision(True, "binding", self.binding_id, self.role_id, (self.scope_type or "", self.scope_id or ""))


def _from(decision: Decision, permission: str) -> DoorDecision:
    scope = decision.scope or (None, None)
    return DoorDecision(decision.allowed, decision.reason, permission if decision.allowed else None, scope[0], scope[1], decision.binding_id, decision.role_id)


def _entity_targets(conn: sqlite3.Connection, entity_id: str) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """The scope targets of a lock entity that may ALLOW door.unlock (installation, then each floor it has its own anchor
    on) and those that may only DENY (the floors a shared room mirrors it to, and every floor of such a room: a deny there
    wins, as in ha_scope.control_decision). SEC-WXD M2: a shared room widens nobody's door.unlock to another floor (the
    alarm's rule, ha_scope.own_placements); the anchors themselves are guarded by `placement_allowed`."""
    placed = ha_scope.placements(conn).get(entity_id, [])
    targets = [INSTALLATION] + [("floor", p["floor_id"]) for p in placed if not p.get("shared_from")]
    deny_only = [("floor", p["floor_id"]) for p in placed if p.get("shared_from")] + [("floor", f) for p in placed for f in p.get("share_floors") or ()]
    return targets, deny_only


def _unlock_decisions(conn: sqlite3.Connection, principal: Principal, entity_ids: list[str]) -> tuple[Decision | None, Decision | None]:
    """(first allowing door.unlock decision, first explicit deny) over every target of the given lock entities."""
    allow: Decision | None = None
    for eid in entity_ids:
        targets, shared = _entity_targets(conn, eid)
        for target in targets + shared:
            d = authorize(conn, principal, UNLOCK, target)
            if d.reason == "explicit_deny":
                return None, d
            if d.allowed and allow is None and target in targets:
                allow = d
    return allow, None


def identity_ok(principal: Principal, dev_mode: bool) -> bool:
    """An identified principal: a Home Assistant user through Ingress or the Arx remote channel; a developer identity only
    in developer identity mode (never in the add-on, where `dev-<name>` principals do not exist)."""
    return principal.source in ("ingress", "remote") or (principal.source == "dev" and dev_mode)


KIOSK_ROLE = "kiosk"


def is_wall_account(conn: sqlite3.Connection, user_id: str) -> bool:
    """SEC-WXD L1: a wall-display account - an enabled wall profile, or an active `kiosk` allow binding (direct or through a
    group). Such an account is an unattended screen, never a person who opens doors (CR-033 4.1 step 1)."""
    try:
        if conn.execute("SELECT 1 FROM wall_profiles WHERE user_id = ? AND enabled = 1", (user_id,)).fetchone():
            return True
    except sqlite3.OperationalError:
        pass
    p = Principal(user_id, "", "", "internal")
    return any(b["role_id"] == KIOSK_ROLE and b["effect"] == "allow" for b in rbac_active_bindings(conn, p))


def check(conn: sqlite3.Connection, principal: Principal, station_id: str, relay: int | None = None, entity_id: str | None = None, *, dev_mode: bool = False) -> DoorDecision:
    """May `principal` open this WisKey door? `entity_id` when the request named a lock entity (the tile path); else the
    entities the door map links to (station, relay) - or to any relay of the station when `relay` is None (the WisKey
    screen's permission gate, before the body names the relay)."""
    if not identity_ok(principal, dev_mode):
        return DoorDecision(False, "identity_unmapped")
    user = conn.execute("SELECT active FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    if user is not None and not user["active"]:
        return DoorDecision(False, "user_inactive")
    if is_wall_account(conn, principal.user_id):
        return DoorDecision(False, "wall_account")
    release = authorize(conn, principal, RELEASE, (STATION, station_id))
    if release.reason == "explicit_deny":
        return _from(release, RELEASE)
    entities = [entity_id] if entity_id else intercom_doors.entities_for(conn, station_id, relay)
    unlock, unlock_deny = _unlock_decisions(conn, principal, entities)
    if unlock_deny is not None:
        return _from(unlock_deny, UNLOCK)
    if release.allowed:
        return _from(release, RELEASE)
    if unlock is not None:
        return _from(unlock, UNLOCK)
    return DoorDecision(False, release.reason if release.reason == "user_inactive" else "no_binding")


def is_door_entity(conn: sqlite3.Connection, entity_id: str) -> bool:
    """A WisKey lock entity, or any entity the door map links to a relay."""
    return intercom_doors.is_wiskey_lock(conn, entity_id) or intercom_doors.map_row(conn, entity_id) is not None


def placement_allowed(conn: sqlite3.Connection, principal: Principal, entity_id: str) -> bool:
    """SEC-WXD M2 (the T055 B1 rule for cameras, applied to WisKey doors): placing a door's lock entity on a floor - or
    taking it off one, which can lift a deny that sat there - widens or changes who holds `door.unlock` for that door, so
    only someone who already holds `door.unlock` for it on its CURRENT chain (installation, or a floor it has its own
    anchor on; an unplaced one: installation only), with no deny on any of its floors, may do it. A role administrator
    (`rbac.roles.manage` at the installation) may too: they can grant door.unlock directly anyway."""
    if authorize(conn, principal, "rbac.roles.manage", INSTALLATION).allowed:
        return True
    allow, deny = _unlock_decisions(conn, principal, [entity_id])
    return allow is not None and deny is None


def may_open_some_door(conn: sqlite3.Connection, principal: Principal, station_id: str, *, dev_mode: bool = False) -> DoorDecision:
    """The WisKey screen's gate (before the body names the relay) and its per-station button: may this principal open at
    least one relay of this station."""
    return check(conn, principal, station_id, None, None, dev_mode=dev_mode)


def door_access_map(conn: sqlite3.Connection, principal: Principal, station_ids: list[str], *, dev_mode: bool = False) -> dict[str, bool]:
    """Per station: whether this principal may open a door there (the WisKey screen shows the open button only then)."""
    return {sid: may_open_some_door(conn, principal, sid, dev_mode=dev_mode).allowed for sid in station_ids}
