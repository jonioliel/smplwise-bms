"""CR-036 S3: `intercom_authority` - the ONE projection filter between WisKey data and an Arx principal.

WisKey answers the add-on's service identity with everything it has (every station, every field: the Supervisor user is a
WisKey administrator - W? in CR-036, derived from code, never checked on the installation). Arx RBAC is therefore the only
filter (owner decision 2026-10-03, item 5), and every WisKey read the add-on serves passes through this module on its way
out (risk 1 of CR-036: a filter bug here shows everything). The rules (CR-036 2.3; owner answers of 2026-10-11 and
2026-10-12 - the later ones win; every answer that sets a field level is an administrator setting, POLICY_DEFAULTS):

- Default deny; deny overrides: every decision is `rbac.authorize` of (permission, the station) over the station's chain.
- A station outside the principal's chain is OMITTED, never greyed - a list leaves it out, a single read answers exactly as
  for a station that does not exist (no existence oracle).
- A person is visible only when at least one of their assignments is on a station where the principal holds
  `access.people.read`; a person with no assignment at all belongs to no station and is visible only to a principal
  UNRESTRICTED for the permission (WisKey's own rule for restricted operators, SCOPES "Projection placeholders"). The
  assignments on stations the principal may not see are omitted from the person.
- A person's field level is the LOWEST of the principal's levels over the person's visible stations: names
  (`access.people.read`) or sensitive (`access.people.sensitive` as well). Names level: identity, the employee number (owner
  answer 2 of 2026-10-12; `access.employee_no_sensitive` puts it back under sensitive), assignments, groups, validity,
  timing. Sensitive: the credential kinds (a PIN is set, how many cards - S7, owner answer 2: credentials are a sensitive
  field level), whether there is a phone, the phone, the person's photo, profile values, responsible person and purpose. A
  card number, a card mask and a PIN are in no read view at all (the person editor keeps the masked cards). A list row
  carries of these only the credential kinds and `phone_set`.
- A person is `editable` only when the principal holds `access.people.manage` on EVERY station the person is assigned to
  (WisKey's `operator_editable` / `person_scope_shared`; the write slice S11 enforces the same rule server-side).
- An access event is visible with `access.events.read` on its station - name, employee number and the event picture
  included (answers 2 and 4 of 2026-10-12; `access.employee_no_sensitive` / `access.event_portrait_sensitive` require
  `access.people.sensitive` on the station instead). A row without a station is visible to nobody (malformed: dropped).
- Sync error texts (a person's per-station error, a station's last error) need `access.admin.read` on the station (answer
  5: the operator sees synced / pending / error only); `access.sync_errors_everyone` shows them to everyone on the row.
- A station's technical details need `access.stations.read` on it; the Settings status data (health, sync, alerts, the
  intercom's own audit) `access.admin.read`.
- Counts WisKey computed over everything (totals, facets, per-station people counts) reach only a principal unrestricted for
  the permission; anyone else gets numbers recomputed over the rows they can see, or null (count-leak guard).
- Fields are never deleted from a WisKey dict: every view is built field by field from the adapter's closed projection, per
  level (fail closed: a key nobody listed cannot leak).
- Any error while deciding is a refusal (fail closed): an exception in a decision is logged by type only and answers False.

Decisions are cached per Authority object, i.e. per request and principal; nothing here is ever shared between principals
or requests (the adapter's caches hold principal-independent projections only and pass them through here on every serve).

Station scope - a thin dependency on CR-033 (origin/pilot/WXD-wave1, migrations 0077 / 0078): the door path owns the
`access_control_station` scope type, the station placement and `rbac.station_chain`. This module never re-implements them;
it asks `rbac.authorize(conn, principal, permission, (STATION_SCOPE, station_id))` and nothing else. Before CR-033 is merged
rbac knows no such scope type: `scope_chain` then returns the installation alone, so only installation bindings decide - the
safe reading ("S3 can start on installation scope", CR-036 4.1). After the merge the same call walks station -> building ->
site -> installation with deny-overrides, with no change here.
"""
from __future__ import annotations

import logging
import sqlite3
from typing import Any, Iterable

from .. import rbac
from ..audit import audit
from ..db import get_setting
from ..errors import forbidden
from ..rbac import INSTALLATION, Decision, Principal

log = logging.getLogger("smplwise.intercom")

# CR-033 D2 names the scope type (rbac.STATION on its branch); the literal is the same string, so this module works before
# and after the merge. tests/test_intercom_authority.py pins that the two agree once rbac has it.
STATION_SCOPE: str = getattr(rbac, "STATION", "access_control_station")
# The scope types whose bindings can cover a WisKey station (CR-033 D2: station -> its building -> its site -> installation).
# A floor or a camera never contains a station, so a binding there neither grants nor restricts anything here.
COVERING_SCOPES = frozenset({"installation", "site", "building", STATION_SCOPE})
MAX_ID = 128  # station / person / event ids Arx accepts from WisKey (the routers' own Path bound)

# ---------------------------------------------------------------- the permissions (labels: routers/access.py PERMISSION_LABELS)
READ = "access.read"  # the entry center's stations (online, ringing, doors, camera stills); no person data
STATIONS_READ = "access.stations.read"  # a station's technical details
EVENTS_READ = "access.events.read"  # the entry log, person names included
EVENTS_EXPORT = "access.events.export"  # CSV export of the entry log (sensitive, audited)
PEOPLE_READ = "access.people.read"  # people: names, assignments, groups, validity
PEOPLE_SENSITIVE = "access.people.sensitive"  # employee number, photo / portrait, phone, profile values (sensitive)
PEOPLE_MANAGE = "access.people.manage"  # existing: the person editor (writes; S11 moves it onto the station chain)
PEOPLE_MESSAGE = "access.people.message"  # CR-036 WA: a WhatsApp message to a person / a selection (sensitive; services/intercom_messaging.py)
CALL = "access.call"  # answer / reject / hang up, announcement (sensitive; the endpoints move onto it in S11)
ADMIN_READ = "access.admin.read"  # Settings status: health, sync, alerts, the intercom's own audit
# the write phase (S15/S16 merged, owner answer 2): catalogue entries now, enforced when their writes exist
SCHEDULES_MANAGE = "access.schedules.manage"
STATIONS_MANAGE = "access.stations.manage"
GROUPS_MANAGE = "access.groups.manage"
# CR-036 S11 (owner decision 2026-10-12, PG): generating a person's PIN - a personal value shown once to the requesting operator,
# stored nowhere - is its own sensitive permission, required on top of access.people.manage, in an interactive session only
# (services/intercom_writes.py). Default: site_admin and system_admin, like access.cards.capture.
PIN_GENERATE = "access.pin.generate"
# WXPERM (owner decision 2026-10-13): opening a door, door only - the door rule's permission (services/door_authority.py, which
# judges it on the station chain together with door.unlock). Its legacy name access.release (rbac.LEGACY_PERMISSIONS) still
# grants it through a custom role saved with that name. Default: site_admin, system_admin, door_opener.
DOORS_OPEN = "access.doors.open"

READ_PERMISSIONS = (READ, STATIONS_READ, EVENTS_READ, PEOPLE_READ, ADMIN_READ)
SENSITIVE_PERMISSIONS = (EVENTS_EXPORT, PEOPLE_SENSITIVE, PEOPLE_MESSAGE, CALL, SCHEDULES_MANAGE, STATIONS_MANAGE, GROUPS_MANAGE, PIN_GENERATE, DOORS_OPEN)
NEW_PERMISSIONS = READ_PERMISSIONS[1:] + SENSITIVE_PERMISSIONS

# a person's field level, and a station's view level
NONE, NAMES, SENSITIVE = "none", "names", "sensitive"
BASIC, TECHNICAL = "basic", "technical"

# The owner's rule of 2026-10-12: every decision is an administrator setting; the answer only sets the default. These four are
# product settings (routers/settings.py DEFAULTS spreads them; changed with system.configure through PATCH /settings, audited
# there). Read per request, never cached across requests.
EMPLOYEE_NO_SENSITIVE = "access.employee_no_sensitive"  # answer 2: "false" - the employee number is a names-level field
PORTRAIT_SENSITIVE = "access.event_portrait_sensitive"  # answer 4: "false" - the events view alone shows the event picture
PORTRAIT_AUDIT = "access.event_portrait_audit"  # answer 4 (safest default): "true" - each event-picture view leaves an audit row
SYNC_ERRORS_EVERYONE = "access.sync_errors_everyone"  # answer 5: "false" - error texts need access.admin.read on the station
POLICY_DEFAULTS: dict[str, str] = {
    EMPLOYEE_NO_SENSITIVE: "false",
    PORTRAIT_SENSITIVE: "false",
    PORTRAIT_AUDIT: "true",
    SYNC_ERRORS_EVERYONE: "false",
}


def valid_id(value: Any) -> bool:
    """An id Arx is willing to evaluate: a non-empty string of at most MAX_ID characters without control characters."""
    return isinstance(value, str) and 0 < len(value) <= MAX_ID and not any(ord(c) < 32 for c in value)


class Authority:
    """One principal's decisions for one request. Never cached beyond the object; never shared between principals.

    Every public method answers False / the lowest level when anything goes wrong (fail closed)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal) -> None:
        self.conn = conn
        self.principal = principal
        self._station: dict[tuple[str, str], bool] = {}
        self._installation: dict[str, Decision] = {}
        self._unrestricted: dict[str, bool] = {}
        self._anywhere: dict[str, bool] = {}
        self._bindings: list[dict[str, Any]] | None = None
        self._policy: dict[str, bool] = {}

    # -- the administrator's settings (owner answers 2026-10-12)
    def policy(self, key: str) -> bool:
        """One of POLICY_DEFAULTS as a boolean. A value that cannot be read, or is neither "true" nor "false", reads as the
        SAFE choice (fail closed): a field stays sensitive, the audit row stays on, error texts stay hidden."""
        if key not in self._policy:
            safe = key != SYNC_ERRORS_EVERYONE
            try:
                value = get_setting(self.conn, key, POLICY_DEFAULTS[key])
                self._policy[key] = {"true": True, "false": False}.get(str(value), safe)
            except Exception as exc:  # noqa: BLE001 - fail closed
                log.warning("intercom authority: setting %s could not be read (%s); the safe choice applies", key, type(exc).__name__)
                self._policy[key] = safe
        return self._policy[key]

    # -- primitive decisions
    def installation(self, permission: str) -> Decision:
        """`rbac.authorize` at the installation itself (cached per permission)."""
        if permission not in self._installation:
            try:
                self._installation[permission] = rbac.authorize(self.conn, self.principal, permission, INSTALLATION)
            except Exception as exc:  # noqa: BLE001 - fail closed
                log.warning("intercom authority: installation decision for %s failed (%s); refused", permission, type(exc).__name__)
                self._installation[permission] = Decision(False, "error")
        return self._installation[permission]

    def station(self, permission: str, station_id: Any) -> bool:
        """Whether `permission` is held on this station's chain (deny overrides). An id Arx will not evaluate is False."""
        if not valid_id(station_id):
            return False
        key = (permission, station_id)
        if key not in self._station:
            try:
                self._station[key] = rbac.authorize(self.conn, self.principal, permission, (STATION_SCOPE, station_id)).allowed
            except Exception as exc:  # noqa: BLE001 - fail closed
                log.warning("intercom authority: station decision for %s failed (%s); refused", permission, type(exc).__name__)
                self._station[key] = False
        return self._station[key]

    def _active(self) -> list[dict[str, Any]]:
        """The principal's active bindings (direct and through groups) - the very rows `rbac.authorize` evaluates (its own
        `_active_bindings`; `bindings_of` is not used because it also names every scope, which a scope type unknown to this
        build would break)."""
        if self._bindings is None:
            try:
                self._bindings = [
                    {k: row[k] for k in ("id", "role_id", "scope_type", "scope_id", "effect")}
                    for row in rbac._active_bindings(self.conn, self.principal)
                ]
            except Exception as exc:  # noqa: BLE001 - fail closed: no binding is known, so nothing is granted beyond installation
                log.warning("intercom authority: bindings could not be read (%s)", type(exc).__name__)
                self._bindings = []
        return self._bindings

    def _holds(self, binding: dict[str, Any], permission: str) -> bool:
        try:
            return permission in rbac.role_permissions(self.conn, binding["role_id"])
        except Exception:  # noqa: BLE001 - fail closed
            return False

    def unrestricted(self, permission: str) -> bool:
        """The permission covers EVERY station, present and future: allowed at the installation, and no deny binding of a
        role carrying it at any scope that can contain a station (a site, a building, a station). A conservative reading:
        a site or building deny counts even when no station is placed there right now."""
        if permission not in self._unrestricted:
            allowed = self.installation(permission).allowed
            if allowed:
                allowed = not any(
                    b.get("effect") == "deny" and b.get("scope_type") in COVERING_SCOPES and self._holds(b, permission)
                    for b in self._active()
                )
            self._unrestricted[permission] = allowed
        return self._unrestricted[permission]

    def anywhere(self, permission: str) -> bool:
        """The permission is held at the installation or on some scope that can contain a station: the endpoint gate. A
        caller who passes it may still see nothing - every row is decided by `station`."""
        if permission not in self._anywhere:
            decision = self.installation(permission)
            if decision.allowed:
                held = True
            elif decision.reason in ("explicit_deny", "user_inactive", "error"):
                held = False
            else:
                held = any(
                    b.get("effect") == "allow" and b.get("scope_type") in COVERING_SCOPES and self._holds(b, permission)
                    for b in self._active()
                )
            self._anywhere[permission] = held
        return self._anywhere[permission]

    # -- levels
    def station_level(self, station_id: Any) -> str:
        """NONE (omitted), BASIC (`access.read`: the entry-center fields) or TECHNICAL (`access.stations.read` too)."""
        if not self.station(READ, station_id):
            return NONE
        return TECHNICAL if self.station(STATIONS_READ, station_id) else BASIC

    def person_level(self, station_ids: Iterable[Any]) -> str:
        """NONE (not visible), NAMES or SENSITIVE for a person assigned to `station_ids` (see the module rules)."""
        ids = [s for s in station_ids]
        if not ids:
            if not self.unrestricted(PEOPLE_READ):
                return NONE
            return SENSITIVE if self.unrestricted(PEOPLE_SENSITIVE) else NAMES
        visible = [s for s in ids if self.station(PEOPLE_READ, s)]
        if not visible:
            return NONE
        return SENSITIVE if all(self.station(PEOPLE_SENSITIVE, s) for s in visible) else NAMES

    def person_editable(self, station_ids: Iterable[Any]) -> bool:
        """`access.people.manage` on every station of the person (none: unrestricted). Not visibility: callers check that."""
        ids = [s for s in station_ids]
        if not ids:
            return self.unrestricted(PEOPLE_MANAGE)
        return all(self.station(PEOPLE_MANAGE, s) for s in ids)

    def event_level(self, station_id: Any) -> str:
        """NONE (omitted), NAMES (`access.events.read`) or SENSITIVE (`access.people.sensitive` on the station as well)."""
        if not self.station(EVENTS_READ, station_id):
            return NONE
        return SENSITIVE if self.station(PEOPLE_SENSITIVE, station_id) else NAMES

    # -- the field rules that depend on the administrator's settings
    def employee_no_for(self, level: str) -> bool:
        """Whether a person / event row at `level` carries the employee number (answer 2: names level, unless the
        administrator made it sensitive again)."""
        return level == SENSITIVE or (level == NAMES and not self.policy(EMPLOYEE_NO_SENSITIVE))

    def employee_no_everywhere(self) -> bool:
        """Whether every employee number the principal could meet is visible to them: the condition for handing WisKey a
        filter, a search or a sort that matches on employee numbers (otherwise it would answer about hidden values)."""
        return not self.policy(EMPLOYEE_NO_SENSITIVE) or self.unrestricted(PEOPLE_SENSITIVE)

    def event_portrait(self, station_id: Any) -> bool:
        """Answer 4: the events view on the station shows the event picture, unless the administrator made it sensitive."""
        if not self.station(EVENTS_READ, station_id):
            return False
        return not self.policy(PORTRAIT_SENSITIVE) or self.station(PEOPLE_SENSITIVE, station_id)

    def sync_errors(self, station_id: Any) -> bool:
        """Answer 5: sync error texts on this station - `access.admin.read` there, unless the administrator shows them to
        everyone who sees the row."""
        return self.policy(SYNC_ERRORS_EVERYONE) or self.station(ADMIN_READ, station_id)

    def visible_stations(self, permission: str, station_ids: Iterable[Any]) -> list[str]:
        """The ids of `station_ids` on which `permission` is held, in their order, without duplicates."""
        out: list[str] = []
        for sid in station_ids:
            if isinstance(sid, str) and sid not in out and self.station(permission, sid):
                out.append(sid)
        return out


# ---------------------------------------------------------------- views
# Each view takes ONE closed superset projection of services/intercom_adapter.py (principal-independent, person data never
# cached) and builds the principal's copy field by field. `None` from a view = omitted (never a placeholder row).

STATION_BASIC_KEYS = ("id", "name", "online", "call_state", "sync_state", "lock_enabled", "locks", "has_camera", "camera_entity", "last_seen", "zone")
STATION_TECHNICAL_KEYS = ("loaded", "model", "firmware", "capabilities", "clock", "event_status", "scanned_at", "scanning", "reconciled_at", "last_poll_ms")
STATION_ERROR_KEYS = ("last_error", "scan_error")


def view_station(auth: Authority, station: dict[str, Any]) -> dict[str, Any] | None:
    """A station as this principal may see it: omitted without `access.read` on it; the entry-center fields with it (the
    call state is there: answer 3 of 2026-10-12, no caller name exists in it); `technical` with `access.stations.read` as
    well, else null; `errors` (the station's last sync / scan error texts) under the sync-error rule, else null."""
    sid = station.get("id")
    level = auth.station_level(sid)
    if level == NONE:
        return None
    out = {k: _copy(station.get(k)) for k in STATION_BASIC_KEYS}
    tech = station.get("technical")
    if not isinstance(tech, dict):  # not known (the feed withheld it): unknown stays null, never a dict of empty fields
        out["technical"] = out["errors"] = None
        return out
    out["technical"] = {k: _copy(tech.get(k)) for k in STATION_TECHNICAL_KEYS} if level == TECHNICAL else None
    out["errors"] = {k: _copy(tech.get(k)) for k in STATION_ERROR_KEYS} if auth.sync_errors(sid) else None
    return out


def view_stations(auth: Authority, stations: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return [v for s in stations if (v := view_station(auth, s)) is not None]


PERSON_NAME_KEYS = ("id", "display_name", "active", "archived", "valid_from", "valid_until", "revision", "access_category", "user_type", "identity_locked")
# Sensitive-level fields (owner answer 2 of 2026-10-12: photo, phone and credentials are sensitive field levels). `credentials`
# is the KINDS only (a PIN is set, how many enabled cards) and `phone_set` whether there is a phone - never a card number, a PIN
# or a phone in a LIST row: those leave only with one person's page (`detail`, GET /access-control/people/{id}).
PERSON_SENSITIVE_KEYS = ("phone", "phone_set", "credentials", "photo_configured", "profile", "responsible_person", "access_purpose")
PERSON_ROW_SENSITIVE_KEYS = ("phone_set", "credentials")
ASSIGNMENT_KEYS = ("station_id", "enabled", "doors", "sync_state", "last_sync_at")


def person_station_ids(person: dict[str, Any]) -> list[str] | None:
    """The stations a superset person is assigned to; None when WisKey did not say (a redacted `access` category: unknown,
    not "no assignment" - such a person can only be shown to a principal unrestricted for people)."""
    assignments = person.get("assignments")
    if not isinstance(assignments, list):
        return None
    return [a["station_id"] for a in assignments if isinstance(a, dict) and isinstance(a.get("station_id"), str)]


def person_level_of(auth: Authority, person: dict[str, Any]) -> str:
    """The principal's level on a superset person (NONE = not visible)."""
    ids = person_station_ids(person)
    if ids is None:  # unknown assignments: attributable to no station
        if not auth.unrestricted(PEOPLE_READ):
            return NONE
        return SENSITIVE if auth.unrestricted(PEOPLE_SENSITIVE) else NAMES
    return auth.person_level(ids)


def view_person(auth: Authority, person: dict[str, Any], *, legacy: bool = False, detail: bool = True) -> dict[str, Any] | None:
    """A person as this principal may see them, or None (not visible). NAMES: identity with the employee number (unless the
    administrator made it sensitive), the visible assignments (sync state; the error text under the sync-error rule),
    groups, validity and timing; SENSITIVE adds the credential kinds, whether there is a phone, the phone itself, the photo
    flag, profile values, responsible person and purpose. `detail=False` is a LIST row: no timing, and of the sensitive fields
    only the credential kinds and `phone_set` (the phone, the photo flag, the profile values, the responsible person and the
    purpose leave only with one person's page). `editable`: `access.people.manage` on every one of the person's stations (and
    WisKey's own `operator_editable` when it sent one). `legacy`: the field set of the phase-1b endpoints (GET /intercom/people*)."""
    level = person_level_of(auth, person)
    if level == NONE:
        return None
    ids = person_station_ids(person)
    employee_no = person.get("employee_no") if auth.employee_no_for(level) else None
    assignments = person.get("assignments") if isinstance(person.get("assignments"), list) else None
    visible = None
    if assignments is not None:
        visible = []
        for a in assignments:
            if isinstance(a, dict) and auth.station(PEOPLE_READ, a.get("station_id")):
                row = {k: _copy(a.get(k)) for k in ASSIGNMENT_KEYS}
                row["last_error"] = a.get("last_error") if auth.sync_errors(a.get("station_id")) else None
                visible.append(row)
    if legacy:
        return {
            "id": person.get("id"),
            "employee_no": employee_no,
            "display_name": person.get("display_name"),
            "active": person.get("active"),
            "valid_from": person.get("valid_from"),
            "valid_until": person.get("valid_until"),
            "revision": person.get("revision"),
            "group_ids": _copy(person.get("group_ids")) if isinstance(person.get("group_ids"), list) else [],
            "stations": [{"station_id": a["station_id"], "enabled": a["enabled"], "doors": a["doors"], "sync_state": a["sync_state"]} for a in visible or []],
        }
    out = {k: _copy(person.get(k)) for k in PERSON_NAME_KEYS}
    out["employee_no"] = employee_no
    out["group_ids"] = _copy(person.get("group_ids"))
    out["stations"] = visible
    # R4-09: the station list is the COMPLETE set only when WisKey's record is complete (no restricted projection) AND this principal
    # sees every assignment of it; otherwise an empty or short list means "not shown", never "no stations"
    out["stations_known"] = bool(person.get("stations_known", False)) and visible is not None and len(visible) == len(assignments or [])
    out["timing"] = _copy(person.get("timing")) if detail else None
    out["level"] = level
    wiskey_editable = person.get("operator_editable")
    out["editable"] = bool(ids is not None and auth.person_editable(ids)) and wiskey_editable is not False
    for k in PERSON_SENSITIVE_KEYS:
        out[k] = _copy(person.get(k)) if level == SENSITIVE and (detail or k in PERSON_ROW_SENSITIVE_KEYS) else None
    return out


EVENT_NAME_KEYS = ("id", "station_id", "timestamp", "received_at", "time_source", "person_name", "authentication", "result", "event_type", "recovered", "door")
EVENT_DETAIL_KEYS = ("evidence", "source_identity")


def view_event(auth: Authority, event: dict[str, Any], *, detail: bool = False) -> dict[str, Any] | None:
    """An access event as this principal may see it, or None (omitted). The row with the person's name and employee number
    (answer 2; the administrator may make the number sensitive); `portrait` says whether the event has a picture the
    principal may open (answer 4; null when they may not); `evidence` / `source_identity` (detail only) are operational
    metadata without a person field."""
    sid = event.get("station_id")
    level = auth.event_level(sid)
    if level == NONE:
        return None
    out = {k: _copy(event.get(k)) for k in EVENT_NAME_KEYS}
    out["employee_no"] = event.get("employee_no") if auth.employee_no_for(level) else None
    out["portrait"] = bool(event.get("portrait_ref")) if auth.event_portrait(sid) else None
    if detail:
        for k in EVENT_DETAIL_KEYS:
            out[k] = _copy(event.get(k))
    return out


def view_groups(auth: Authority, groups: dict[str, Any]) -> dict[str, Any]:
    """The groups as this principal may see them (WisKey's own restricted projection, SCOPES): unrestricted for people - all;
    otherwise only groups whose every station is visible (`access.people.read`), and never a group that grants no station.
    The custom field definitions go to a holder of `access.people.sensitive` (they label profile values) or of the Settings
    status (`access.admin.read`, unrestricted)."""
    everything = auth.unrestricted(PEOPLE_READ)
    out = []
    for g in groups.get("groups") or []:
        ids = g.get("station_ids")
        if everything:
            out.append(_copy(g))
        elif isinstance(ids, list) and ids and all(auth.station(PEOPLE_READ, s) for s in ids):
            out.append(_copy(g))
    fields = _copy(groups.get("fields")) if (auth.anywhere(PEOPLE_SENSITIVE) or auth.unrestricted(ADMIN_READ)) else None
    return {"revision": groups.get("revision"), "photo_enabled": groups.get("photo_enabled"), "groups": out, "fields": fields}


def status_station(auth: Authority, station_id: Any) -> bool:
    """A station on the Settings status page: the entry center's `access.read` AND `access.admin.read` on it."""
    return auth.station(READ, station_id) and auth.station(ADMIN_READ, station_id)


SYNC_COUNT_KEYS = ("pending_users", "managed_users", "revocations_pending", "card_removals_pending", "pin_removals_pending", "deletions_pending")


def view_sync_status(auth: Authority, status: dict[str, Any]) -> dict[str, Any]:
    """Per-station sync counts for the stations the principal sees on the status page, and totals over exactly those
    (count-leak guard: never WisKey's own totals). Error texts under the sync-error rule."""
    rows = []
    for s in status.get("stations") or []:
        sid = s.get("station_id")
        if not status_station(auth, sid):
            continue
        row = {k: _copy(s.get(k)) for k in ("station_id", "name", "sync_state", "reconciled_at", "operations", *SYNC_COUNT_KEYS)}
        row["last_error"] = s.get("last_error") if auth.sync_errors(sid) else None
        rows.append(row)
    totals: dict[str, Any] = {k: sum(r[k] or 0 for r in rows) for k in SYNC_COUNT_KEYS}
    totals["operations"] = {state: sum((r["operations"] or {}).get(state, 0) for r in rows) for state in ("pending", "failed", "verified", "settled")}
    return {"stations": rows, "totals": totals}


def view_alerts(auth: Authority, alerts: dict[str, Any], *, offset: int, limit: int) -> dict[str, Any]:
    """Fleet alerts of the stations the principal sees on the status page, paged and counted over exactly those."""
    items = [_copy(i) for i in alerts.get("items") or [] if status_station(auth, i.get("station_id"))]
    page = items[offset:offset + limit]
    per_station = alerts.get("station_thresholds_seconds") or {}
    return {
        "items": page,
        "total": len(items),
        "active_count": sum(1 for i in items if not i.get("suppressed")),
        "suppressed_count": sum(1 for i in items if i.get("suppressed")),
        "offset": offset,
        "limit": limit,
        "next_offset": offset + limit if offset + limit < len(items) else None,
        "complete": bool(alerts.get("fetched_all")),
        "thresholds_seconds": _copy(alerts.get("thresholds_seconds")),
        "station_thresholds_seconds": {sid: _copy(v) for sid, v in per_station.items() if status_station(auth, sid)},
        "generated_at": alerts.get("generated_at"),
    }


def _person_block(auth: Authority, person: Any, station_ids: list[str]) -> dict[str, Any] | None:
    """The person a status / audit row concerns, as this principal may see them on those stations: None when not visible."""
    if not isinstance(person, dict):
        return None
    level = auth.person_level(station_ids)
    if level == NONE:
        return None
    return {"id": person.get("id"), "display_name": person.get("display_name"), "employee_no": person.get("employee_no") if auth.employee_no_for(level) else None}


def view_conflicts(auth: Authority, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sync conflicts of the stations on the status page; the person on each row as the people rules allow on that station."""
    out = []
    for r in rows:
        sid = r.get("station_id")
        if not status_station(auth, sid):
            continue
        out.append({
            "kind": r.get("kind"), "station_id": sid, "sync_state": r.get("sync_state"),
            "last_error": r.get("last_error") if auth.sync_errors(sid) else None,
            "person": _person_block(auth, r.get("person"), [sid]),
        })
    return out


def view_audit_page(auth: Authority, page: dict[str, Any]) -> dict[str, Any]:
    """The intercom's own action log (Settings; the route requires `access.admin.read` unrestricted): each record's person as
    the people rules allow on the stations it touched; the stations listed only when the principal sees them."""
    records = []
    for r in page.get("records") or []:
        stations = [s for s in r.get("stations") or [] if isinstance(s, str)]
        records.append({
            **{k: _copy(r.get(k)) for k in ("sequence", "time", "action", "actor_name", "fields", "revision_before", "revision_after", "reason_code")},
            "stations": [s for s in stations if auth.station(READ, s)],
            "person": _person_block(auth, r.get("person"), stations),
        })
    return {"records": records, "next_cursor": page.get("next_cursor"), "total": page.get("total"), "retention_days": page.get("retention_days")}


def require_unrestricted(auth: Authority, permission: str, request_id: str | None = None) -> None:
    """For WisKey's installation-wide views (its audit, conflicts, schedule library, policy versions - WisKey itself serves
    them to unrestricted operators only): a principal restricted to some stations is refused with an audited 403."""
    if auth.unrestricted(permission):
        return
    audit(auth.conn, actor=auth.principal, action=permission, decision="denied", resource_type="installation", resource_id="*", reason="station_scoped", request_id=request_id)
    raise forbidden(permission=permission, target_type="installation", target_id="*", reason="station_scoped")


def _copy(value: Any) -> Any:
    """A detached copy of a JSON value (views never hand out an object the adapter's cache still holds)."""
    if isinstance(value, dict):
        return {k: _copy(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_copy(v) for v in value]
    return value


def require_anywhere(conn: sqlite3.Connection, principal: Principal, permission: str, request_id: str | None = None) -> Authority:
    """The endpoint gate of a station-scoped read: the permission somewhere a station can be (`Authority.anywhere`), checked
    before any query parameter is looked at. A refusal is audited like `rbac.require` (action = the permission, decision
    denied) and raised as 403 `forbidden`. Returns the request's Authority (its decisions are reused for the rows)."""
    auth = Authority(conn, principal)
    if not auth.anywhere(permission):
        decision = auth.installation(permission)
        audit(conn, actor=principal, action=permission, decision="denied", resource_type="installation", resource_id="*",
              reason=decision.reason if decision.reason != "binding" else "no_binding", request_id=request_id, under=decision)
        raise forbidden(permission=permission, target_type="installation", target_id="*", reason=decision.reason)
    decision = auth.installation(permission)
    if decision.allowed:
        rbac.note_grant(decision, permission)
    else:
        for b in auth._active():
            if b.get("effect") == "allow" and b.get("scope_type") in COVERING_SCOPES and auth._holds(b, permission):
                rbac.note_grant(Decision(True, "binding", b.get("id"), b.get("role_id"), (str(b.get("scope_type")), str(b.get("scope_id")))), permission)
                break
    return auth


# ---------------------------------------------------------------- C03: who may look up an OLD action's status (CR-WISKEY-LEASE-REVOCATION-EVENT 5)
#
# Owner decision 2026-10-16 (question 1, option a; question 5): whoever CURRENTLY holds the Arx permission for the original action on
# that target, at the current permission revision; the system administrator may widen it with `access.lookup_scope` =
# `holder_or_audit_readers` (also `audit.read` at installation scope). Explicit deny of the original permission on the target wins
# under BOTH values (HA_IDENTITY_RBAC section 15). The answer's existence rules (pending | not_found_or_expired, no oracle) are
# WisKey's; Arx contributes this decision and the audit row `intercom.lookup.decide` (ids only). EXTENSION POINT: the transport
# that carries WisKey's lookup question to Arx is part of WisKey's revised C04 (W?) - nothing calls this over the wire yet.

LOOKUP_ACTIONS: dict[str, tuple[str, ...]] = {  # a CLOSED table: an action not listed here is refused
    "cards/capture_start": ("access.cards.capture", PEOPLE_MANAGE),
    "cards/capture_status": ("access.cards.capture", PEOPLE_MANAGE),
    "cards/capture_confirm": ("access.cards.capture", PEOPLE_MANAGE),
    "cards/capture_cancel": ("access.cards.capture", PEOPLE_MANAGE),
    "stations/test_unlock": ("@door",),
    "door_open": ("@door",),
    "users/create": (PEOPLE_MANAGE,),
    "users/update": (PEOPLE_MANAGE,),
    "users/delete": (PEOPLE_MANAGE,),
    "users/set_cards": (PEOPLE_MANAGE,),
    "users/set_assignments": (PEOPLE_MANAGE,),
}
AUDIT_READ = "audit.read"


def lookup_allowed(conn: sqlite3.Connection, principal: Principal, original_action: Any, logical_target_id: Any, binding_revision: Any = None,
                   *, request_id: str | None = None, dev_mode: bool = False) -> bool:
    """The fresh Arx decision for a status lookup of an old action on `logical_target_id` (a station id). Fail closed: an
    unknown action, an id Arx will not evaluate or any error refuses. Audited `intercom.lookup.decide` (ids, the action, the
    basis - never a name, a card value or the binding revision's meaning; the opaque value is recorded as given, bounded)."""
    allowed, basis = False, "refused"
    try:
        perms = LOOKUP_ACTIONS.get(original_action) if isinstance(original_action, str) else None
        if perms is None or not valid_id(logical_target_id):
            basis = "unknown_action" if perms is None else "invalid_target"
        else:
            denied, held = False, True
            for perm in perms:
                if perm == "@door":
                    from . import door_authority

                    d = door_authority.check(conn, principal, logical_target_id, dev_mode=dev_mode)
                    denied = denied or d.reason == "explicit_deny"
                    held = held and d.allowed
                else:
                    d2 = rbac.authorize(conn, principal, perm, (STATION_SCOPE, logical_target_id))
                    denied = denied or d2.reason in ("explicit_deny", "user_inactive")
                    held = held and d2.allowed
            if denied:
                basis = "explicit_deny"
            elif held:
                allowed, basis = True, "holder"
            else:
                from . import capture_lease

                if capture_lease.lookup_scope(conn) == "holder_or_audit_readers" and rbac.authorize(conn, principal, AUDIT_READ, INSTALLATION).allowed:
                    allowed, basis = True, "audit_reader"
    except Exception as exc:  # noqa: BLE001 - fail closed
        log.warning("intercom lookup decision failed (%s); refused", type(exc).__name__)
        allowed, basis = False, "error"
    try:
        audit(conn, actor=principal, action="intercom.lookup.decide", decision="allowed" if allowed else "denied", resource_type="intercom_station",
              resource_id=logical_target_id if valid_id(logical_target_id) else "*", reason=None if allowed else basis, request_id=request_id,
              details={"original_action": original_action if isinstance(original_action, str) and len(original_action) <= 64 else None, "basis": basis,
                       "binding_revision": binding_revision if isinstance(binding_revision, str) and len(binding_revision) <= 128 else None})
    except Exception:  # noqa: BLE001 - the decision stands; a failed audit write is logged
        log.warning("intercom lookup decision: audit row not written")
    return allowed
