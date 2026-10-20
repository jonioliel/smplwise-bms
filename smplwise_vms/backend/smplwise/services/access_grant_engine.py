"""CR-ARX-WISKEY-SHARED-IDENTITY: the access engine port - the few WisKey person operations an external-person grant needs.

WisKey is the access engine (credentials, door map, validity, timing); Arx decides (AUTH01). The grant service
(services/access_grants.py) talks to WisKey ONLY through this port, so the whole flow runs against a fake in tests
(tests/fake_wiskey.py `FakeAccessEngine`) and nothing in a test can reach a station, a door or a reader.

`WiskeyServiceEngine` is the live implementation over the existing S11 people writes (the SERVICE channel, the config lane of
`intercom_sync.SYNC.action`: sent once, never queued, never retried). It refuses every call while the owner's separate go-live
permit is not in the build (`access_grants.GO_LIVE_PERMITTED`, a code constant that is False) - so in this build no grant ever
reaches a real WisKey, whatever the settings say. It was written against the shipped S11 shapes and has NOT been run against a
WisKey (NOT_RUN; the W-a..W-e questions of the CR section 9 are open).

Error kinds (`EngineError.kind`): `not_found`, `revision_conflict`, `pin_conflict`, `not_sent` (nothing reached WisKey - safe to
try again later), `unknown` (sent, no clear answer - never retried blindly: the next step is a fresh read), `refused` (WisKey
answered an error), `not_permitted` (the go-live permit is not in the build).

2.8.0 WisKey answers (reply 2, 2026-10-18; SOURCE-DERIVED static reading of WisKey's pinned code, NOT_RUN against any WisKey or hardware;
the Arx service-channel wrapper around these commands is unreviewed): revoke-all is ONE revision-checked users/update with
`{group_ids: [], permission_overrides: {}, active: false, pin: null}`; narrowing replaces the COMPLETE `permission_overrides` dict (target
station "deny", other personal entries kept); the door map is READ by projecting the enabled `assignments` (`users/get` has no
`door_permissions`); a restricted projection is UNKNOWN, never known-empty; after a revoke an empty `assignments` is no proof of physical
removal, so the worker also needs the central sync status to show no pending revocation (`Engine.revocation_pending`)."""
from __future__ import annotations

import copy
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

KEEP = object()  # `apply(pin=KEEP)`: leave the person's PIN as it is (a narrowing push)

ERROR_KINDS = ("not_found", "revision_conflict", "pin_conflict", "not_sent", "unknown", "refused", "not_permitted")


class EngineError(Exception):
    def __init__(self, kind: str, code: str = "") -> None:
        super().__init__(kind)
        self.kind = kind if kind in ERROR_KINDS else "refused"
        self.code = (code or "")[:64]


@dataclass(frozen=True)
class EnginePerson:
    """A WisKey person as the grant service needs it. Never a PIN value (only `pin_configured`), never a card value."""

    id: str
    revision: int
    display_name: str = ""
    active: bool = False
    valid_from: str | None = None
    valid_until: str | None = None
    doors: dict[str, list[int]] = field(default_factory=dict)
    stations: tuple[str, ...] = ()  # every station the person is assigned to (door map, overrides, assignments)
    pin_configured: bool = False
    timing: dict[str, Any] | None = None
    category: str = "unknown"
    # False when the WisKey record carried no `door_permissions` key at all (ManagedUser.public never does): `doors` is then {}
    # only because nothing was reported, NOT because the person has no doors. Callers must treat the door map as unknown.
    doors_known: bool = True
    employee_no: str = ""  # server-generated (nine digits) when omitted on create; stored as returned, never sent on update
    # permission_overrides as WisKey returned them ({station: "allow"|"deny"}); `overrides_known` False when they were unreadable.
    overrides: dict[str, str] = field(default_factory=dict)
    overrides_known: bool = True
    group_ids: tuple[str, ...] = ()
    # False when `pin_configured` may be unreadable (restricted projection): pin_configured=False is then NOT proof of a cleared PIN.
    pin_known: bool = True
    # R4-04 / R11-I2-01: the CENTRAL applied bookkeeping (desired / applied revisions of WisKey's journal), NOT physical proof.
    # True = every enabled assignment has desired_revision == `revision`, applied_revision == desired_revision, sync_state "synced"
    # and a valid last_sync_at; False = at least one well-formed row is explicitly behind (applied < desired, applied null = not
    # applied yet, or a known non-synced state); None = cannot tell (door map unknown, bookkeeping missing / inconsistent, no sync
    # time, a row synced for an older person revision). Recorded beside a proof of the central scope, never required by it.
    # R5-A7: None also when no assignment is enabled - "no evidence", never a vacuous True.
    stations_synced: bool | None = None
    # R11-I2-01: whether the stations PHYSICALLY hold the record. Always None (UNKNOWN) in this build: no device-side evidence
    # contract exists, and the central bookkeeping above is never promoted to it.
    physical_proof: bool | None = None
    # R5-A2: the COMPLETE `access_timing_policy` as WisKey returned it ({mode, schedule, bindings}, each key only when it was present;
    # None = no policy). `timing` above is its schedule only; a scope proof compares the whole policy (mode and bindings included).
    timing_policy: dict[str, Any] | None = None


class Engine(Protocol):
    def create_person(self, *, display_name: str, category: str, responsible_person: str, access_purpose: str,
                      employee_no: str | None = None) -> EnginePerson: ...

    def get_person(self, person_id: str) -> EnginePerson: ...

    def apply(self, person_id: str, revision: int, *, doors: dict[str, list[int]], valid_from: str, valid_until: str,
              timing: dict[str, Any] | None, active: bool, pin: Any = KEEP, overrides: dict[str, str] | None = None) -> EnginePerson: ...

    def strip(self, person_id: str, revision: int) -> EnginePerson: ...

    def revocation_pending(self, person_id: str, revision: int) -> bool | None:
        """Central sync status of the person AT `revision` (the revision of the fresh readback the caller is judging, R11-I1-03):
        True = a revocation is still pending, False = none, None = cannot tell. False only through `revocation_pending_verdict`
        (present, same revision, all six pending arrays empty); a revision mismatch, absence or a scoped 404 is None. A False here
        is never enough alone: the caller also needs `central_revoked` on that same readback (`revocation_proven`)."""
        ...

    def pin_generate(self, person_id: str) -> str: ...

    def rename(self, person_id: str, revision: int, display_name: str) -> EnginePerson: ...

    def delete(self, person_id: str, revision: int) -> None: ...


# ---------------------------------------------------------------- the live engine (refused in this build)

def _doors_of(raw: Any) -> dict[str, list[int]]:
    out: dict[str, list[int]] = {}
    if isinstance(raw, dict):
        for sid, relays in raw.items():
            if isinstance(sid, str) and isinstance(relays, list):
                out[sid] = sorted({r for r in relays if isinstance(r, int) and not isinstance(r, bool)})
    return out


_EMPLOYEE_NO = re.compile(r"[A-Za-z0-9_-]{1,32}")
_VALID_MIN = datetime(1970, 1, 1, tzinfo=timezone.utc)
_VALID_MAX = datetime(2037, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
NAME_MAX = 32  # WisKey: 32 Unicode code points (Python str slicing counts code points)


def _clean_name(name: Any, fallback: str = "Guest") -> str:
    return (str(name or "").strip()[:NAME_MAX]).strip() or fallback


def _iso_z(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def default_validity(at: datetime | None = None) -> tuple[str, str]:
    """A valid (valid_from < valid_until) timezone-aware pair for a person that is created inactive: WisKey rejects a contractor/visitor
    without one (`invalid_validity`) even when `active` is false. The real window is written later by `apply`."""
    start = (at or datetime.now(timezone.utc)).astimezone(timezone.utc).replace(microsecond=0)
    start = min(max(start, _VALID_MIN), _VALID_MAX - timedelta(days=1))
    return _iso_z(start), _iso_z(start + timedelta(days=1))


def create_payload(*, display_name: str, category: str, responsible_person: str, access_purpose: str,
                   employee_no: str | None = None, at: datetime | None = None) -> dict[str, Any]:
    """The users/create `data`. Never null for phone/responsible_person/access_purpose (WisKey rejects null; `phone` is simply not sent);
    access_purpose may be ""; responsible_person is non-empty; validity always present. `employee_no` is normally OMITTED: WisKey then
    generates a nine-digit one and returns it (Arx stores what comes back); an explicit value must match ASCII [A-Za-z0-9_-] 1..32."""
    valid_from, valid_until = default_validity(at)
    data: dict[str, Any] = {"display_name": _clean_name(display_name), "access_category": category,
                            "responsible_person": (str(responsible_person or "").strip()[:64]).strip() or "Arx",
                            "access_purpose": str(access_purpose or "").strip()[:128], "active": False, "valid_from": valid_from,
                            "valid_until": valid_until}
    if employee_no is not None:
        if not isinstance(employee_no, str) or not _EMPLOYEE_NO.fullmatch(employee_no):
            raise ValueError("employee_no must be ASCII [A-Za-z0-9_-] 1..32")
        data["employee_no"] = employee_no
    return data


def apply_payload(*, doors: dict[str, list[int]], valid_from: str, valid_until: str, timing: dict[str, Any] | None, active: bool, pin: Any = KEEP,
                  overrides: dict[str, str] | None = None) -> dict[str, Any]:
    """The users/update `data` of a grant push. `door_permissions` replaces the lock list of each SUPPLIED station only - leaving a station
    out does NOT revoke it; stations to drop travel in `overrides` (the COMPLETE permission_overrides dict, see `plan_overrides`).
    `employee_no` is never sent on update."""
    data: dict[str, Any] = {"door_permissions": doors, "valid_from": valid_from, "valid_until": valid_until, "active": active,
                            "access_timing_policy": requested_policy(timing)}
    if overrides is not None:
        data["permission_overrides"] = overrides
    if pin is not KEEP:
        data["pin"] = pin
    return data


def plan_overrides(person: EnginePerson, doors: dict[str, list[int]]) -> dict[str, str] | None:
    """The COMPLETE `permission_overrides` replacement that makes the person's enabled stations equal `doors`' stations: stations to drop get
    "deny" (a deny beats an inherited allow), stations to add get "allow", every other personal entry is kept (a one-entry dict is not a
    merge and would erase the rest). None = nothing to change. Raises `not_sent` when the person's access fields were not readable: a
    replacement built on a restricted view could erase exceptions."""
    if not person.doors_known or not person.overrides_known:
        raise EngineError("not_sent", "projection_restricted")
    have, want = set(person.doors), set(doors)
    new = dict(person.overrides)
    for sid in have - want:
        new[sid] = "deny"
    for sid in want - have:
        new[sid] = "allow"
    return new if new != person.overrides else None


def strip_payload() -> dict[str, Any]:
    """The revoke-all write (WisKey-stated, source-derived, NOT_RUN): group_ids [] + permission_overrides {} remove every central grant
    (`door_permissions: {}` does not), active false, and `pin: null` is the explicit PIN clear (omitting pin keeps it, "" is invalid) - the
    ONE allowed null (phone/responsible_person/access_purpose are never null). Sent with sync_now; the answer is the public person object.
    It is not proof of physical removal: the worker waits for a readback AND the central sync status (see `Worker.strip`)."""
    return {"group_ids": [], "permission_overrides": {}, "active": False, "pin": None}


_ACCESS_FIELDS = frozenset({"assignments", "group_ids", "permission_overrides"})
_CREDENTIAL_FIELDS = frozenset({"pin_configured", "pin", "cards"})


def _redacted(raw: Any) -> tuple[bool, bool]:
    """(access fields unreadable, credential fields unreadable) from `redacted_fields`. A present but unparseable marker blocks both."""
    if raw in (None, [], {}, ()):
        return False, False
    names = set(raw) if isinstance(raw, (list, tuple, set, dict)) else None
    if names is None or not all(isinstance(n, str) for n in names):
        return True, True
    return bool(names & _ACCESS_FIELDS), bool(names & _CREDENTIAL_FIELDS)


@dataclass(frozen=True)
class AccessShape:
    """R8-A1 / R6-A4 (ARX-N03): the ONE strict completeness verdict over a WisKey person record's access fields, shared by the grant
    engine (`person_from_raw`) and every authorization projection (`intercom_sync.person_scope` -> `project_person`,
    `intercom_adapter.project_person`, `intercom_authority.person_station_ids`). Shape only: redaction markers are judged by
    `person_scope`, not here.

    `missing`: the access containers that are absent / null (`assignments`, `permission_overrides`, `group_ids`) - unreadable, the map
    is UNKNOWN but nothing is malformed. `malformed`: the fields present in a shape WisKey does not send - a container of the wrong
    type, an assignment row with a non-string / blank key, a non-object row, a non-boolean `enabled` (disabled rows too), a lock list
    that is not a list of supported relays (`RELAYS`), a present bookkeeping revision that is not a positive int, a blank or
    non-string group id, a blank override key or a value other than allow / deny, and a missing / non-boolean `active`.
    `complete` = nothing missing and nothing malformed. A malformed record is never an empty complete map: no consumer may filter the
    bad rows out and present the rest as the full set."""

    complete: bool
    missing: tuple[str, ...]
    malformed: tuple[str, ...]


def _row_ok(sid: Any, row: Any) -> bool:
    if not isinstance(sid, str) or not sid.strip() or not isinstance(row, dict) or not isinstance(row.get("enabled"), bool):
        return False
    locks = row.get("allowed_locks")
    if not isinstance(locks, list) or not all(_strict_int(r) and r in RELAYS for r in locks):
        return False
    return all(v is None or _positive_int(v) for v in (row.get("desired_revision"), row.get("applied_revision")))


def access_shape(raw: Any) -> AccessShape:
    """The strict verdict (see `AccessShape`). A non-object record is all-missing and malformed (`record`)."""
    if not isinstance(raw, dict):
        return AccessShape(False, ("assignments", "permission_overrides", "group_ids"), ("record",))
    missing: list[str] = []
    malformed: list[str] = []
    assignments = raw.get("assignments")
    if assignments is None:
        missing.append("assignments")
    elif not isinstance(assignments, dict) or not all(_row_ok(sid, row) for sid, row in assignments.items()):
        malformed.append("assignments")
    overrides = raw.get("permission_overrides")
    if overrides is None:
        missing.append("permission_overrides")
    elif not isinstance(overrides, dict) or not all(isinstance(k, str) and k.strip() and v in ("allow", "deny") for k, v in overrides.items()):
        malformed.append("permission_overrides")
    groups = raw.get("group_ids")
    if groups is None:
        missing.append("group_ids")
    elif not isinstance(groups, list) or not all(isinstance(g, str) and g.strip() for g in groups):
        malformed.append("group_ids")
    if not isinstance(raw.get("active"), bool):
        malformed.append("active")
    return AccessShape(not missing and not malformed, tuple(missing), tuple(malformed))


def person_from_raw(raw: Any) -> EnginePerson:
    """A WisKey person record (users/get or a save's answer: `ManagedUser.public`, WisKey-stated) -> EnginePerson. Raises ValueError
    on anything that is not a person record (after a write that is "outcome unknown").

    The record has NO `door_permissions`. The desired door map is the projection of the ENABLED `assignments` to their `allowed_locks`;
    a disabled row keeps historical locks and is skipped. The projection is UNKNOWN (`doors_known=False`, never known-empty) when
    assignments / permission_overrides / group_ids are missing or unreadable or `redacted_fields` names an access field; `pin_known` is
    False when the credential fields may be unreadable (then pin_configured=False proves nothing).

    R5-A7 (fail closed on malformed input): the id is a non-empty string and the revision an int that is not a bool (else ValueError); a
    malformed assignment row (a non-string key, a row that is not an object, `enabled` that is not a boolean, `allowed_locks` that is not
    a list of ints) or a malformed `permission_overrides` / `group_ids` entry makes the door map UNKNOWN - it is never skipped, so a
    malformed row cannot shrink a known map; no enabled assignment is `stations_synced` None (no evidence), never True.

    R6-A4 / ACR6-03 (the remaining malformed shapes, all -> door map UNKNOWN, never dropped): the record revision must be a positive int
    (else not a person); `active` must be an explicit boolean; EVERY assignment row - disabled ones too - needs an explicit boolean
    `enabled`, a lock list of supported relays (`RELAYS`) and, when present (null = not applied yet), positive int bookkeeping revisions;
    group ids and override keys must be non-blank strings.

    R8-A1 (ARX-N03): "malformed" is the shared `access_shape` verdict - the same one the authorization projections use - so the engine
    and the people / scope views can never disagree about whether a record's access fields are complete."""
    if (not isinstance(raw, dict) or not isinstance(raw.get("id"), str) or not raw["id"] or not _positive_int(raw.get("revision"))):
        raise ValueError("unexpected person record")
    shape = access_shape(raw)
    access_redacted, credential_redacted = _redacted(raw.get("redacted_fields"))
    # WisKey round 3 (R3-03): WisKey names the withheld CATEGORIES (`access`, `credentials`), and a record projected for a restricted
    # caller (`redacted_fields` or `operator_editable` present, even with nothing listed) may hold only the stations that caller sees -
    # the door map of such a record is never the complete one.
    from .intercom_sync import person_scope

    scope = person_scope(raw)
    access_redacted = access_redacted or not scope["stations_known"]
    credential_redacted = credential_redacted or not scope["credentials_known"]
    assignments = raw.get("assignments")
    overrides_raw = raw.get("permission_overrides")
    groups = raw.get("group_ids")
    doors: dict[str, list[int]] = {}
    stations: set[str] = set()
    # R5-A7 / R6-A4 / R8-A1: EVERY row is validated by `access_shape`, a disabled one too - `enabled` must be an explicit boolean (a
    # missing key is not "disabled"), the lock list a list of supported relays, a present bookkeeping revision a positive int (null = not
    # applied yet). Never skipped: a malformed row makes the whole map unknown (the loop below only builds the map of a valid record).
    malformed = bool(shape.malformed)
    checks: list[bool | None] = []
    if isinstance(assignments, dict):
        for sid, row in assignments.items():
            if not _row_ok(sid, row):
                continue
            locks = row["allowed_locks"]
            stations.add(sid)
            if row["enabled"] is True:
                doors[sid] = sorted(set(locks))
                checks.append(_row_synced(row, raw["revision"]))
    # R11-I2-01: one explicitly behind row makes the person False; otherwise any unknown row makes it UNKNOWN. R5-A7: nothing enabled
    # is no evidence of application, not a vacuous "synced".
    synced: bool | None = None if not checks else False if False in checks else None if None in checks else True
    overrides: dict[str, str] = {}
    if isinstance(overrides_raw, dict):
        overrides = {k: v for k, v in overrides_raw.items() if isinstance(k, str) and k.strip() and v in ("allow", "deny")}
        stations |= set(overrides)
    # R6-A4: a blank group id / override key and a missing / non-boolean `active` are in `shape.malformed` (an unreadable `active` is
    # unknown, never "inactive" - it could otherwise read as revoked)
    active = raw.get("active")
    if not isinstance(active, bool):
        active = False
    overrides_known = isinstance(overrides_raw, dict) and not access_redacted and not malformed
    doors_known = shape.complete and not access_redacted
    if not doors_known:
        doors = {}
        synced = None
    policy = raw.get("access_timing_policy") if isinstance(raw.get("access_timing_policy"), dict) else None
    return EnginePerson(
        id=raw["id"], revision=raw["revision"], display_name=str(raw.get("display_name") or "")[:32], active=active,
        valid_from=raw.get("valid_from") if isinstance(raw.get("valid_from"), str) else None,
        valid_until=raw.get("valid_until") if isinstance(raw.get("valid_until"), str) else None,
        doors=doors, doors_known=doors_known, stations=tuple(sorted(stations)),
        pin_configured=bool(raw.get("pin_configured")), pin_known=isinstance(raw.get("pin_configured"), bool) and not credential_redacted,
        timing=policy.get("schedule") if policy and isinstance(policy.get("schedule"), dict) else None,
        category=raw.get("access_category") if raw.get("access_category") in ("staff", "visitor", "contractor") else "unknown",
        employee_no=str(raw.get("employee_no") or "")[:32], overrides=overrides, overrides_known=overrides_known,
        group_ids=tuple(g for g in groups if isinstance(g, str)) if isinstance(groups, list) else (), stations_synced=synced,
        timing_policy=_policy_of(raw.get("access_timing_policy")),
    )


SYNC_STATES = frozenset({"synced", "pending", "syncing", "offline", "conflict", "error", "delete_pending"})  # WisKey models.SYNC_STATES


def _valid_sync_time(value: Any) -> bool:
    """R11-I2-01: a valid `last_sync_at` is an ISO 8601 string WITH a timezone (a naive time, a number or a free text is not)."""
    if not isinstance(value, str) or not 10 <= len(value) <= 40:
        return False
    try:
        moment = datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)
    except ValueError:
        return False
    return moment.tzinfo is not None and moment.utcoffset() is not None


def _row_synced(row: dict[str, Any], revision: int) -> bool | None:
    """R11-I2-01 (WisKey person_readback rule, adopted by Arx): the CENTRAL applied bookkeeping of one enabled, shape-valid row.

    UNKNOWN (None) when the bookkeeping is missing or inconsistent: no positive desired_revision, desired ahead of the person's
    revision, an absent `applied_revision` key (a present null is "not applied yet"), applied ahead of desired, a sync_state outside
    WisKey's set. False only for a well-formed row that is explicitly behind: applied null or below desired, or a known state other
    than "synced". True only when desired == the person's revision, applied == desired, "synced" and a valid `last_sync_at`; a row
    synced for an OLDER person revision, or without a valid sync time, proves nothing about this revision (None)."""
    desired, applied, state = row.get("desired_revision"), row.get("applied_revision"), row.get("sync_state")
    if not _positive_int(desired) or desired > revision or "applied_revision" not in row:
        return None
    if applied is not None and (not _positive_int(applied) or applied > desired):
        return None
    if not isinstance(state, str) or state not in SYNC_STATES:
        return None
    if applied is None or applied < desired or state != "synced":
        return False
    if desired != revision or not _valid_sync_time(row.get("last_sync_at")):
        return None
    return True


def _strict_int(value: Any) -> bool:
    """R5-A7: an int that is not a bool (True / False are ints in Python, never a revision or a lock number)."""
    return isinstance(value, int) and not isinstance(value, bool)


def _positive_int(value: Any) -> bool:
    """R6-A4: a revision is a strict int >= 1 (0 / negative is not a revision WisKey issues)."""
    return _strict_int(value) and value >= 1


RELAYS = frozenset({1, 2})  # R6-A4: the lock relays Arx knows (the same domain as intercom_adapter's door projection); anything else is malformed


def _policy_of(raw: Any) -> dict[str, Any] | None:
    """R5-A2: the timing policy as WisKey returned it - mode, schedule and bindings, each only when it was present (an absent key stays
    absent, so it can never compare equal to the requested `{mode: "ha", ..., bindings: {}}`). A non-object policy is kept as a marker
    that compares unequal to everything Arx requests. No normalisation: WisKey's `normalize_user` (ACR5-02) is a frozen v1 read contract
    the owner accepted for integration review, but Arx has NOT built or wired a client for it (R8 stale-comment fix, ARX-N05) - so Arx
    compares exactly and a reordered equivalent schedule fails closed (never widened, never an invented equivalence)."""
    if raw is None:
        return None
    if not isinstance(raw, dict):
        return {"malformed": True}
    return {k: copy.deepcopy(raw[k]) for k in ("mode", "schedule", "bindings") if k in raw} | ({"extra": True} if set(raw) - {"mode", "schedule", "bindings"} else {})


def requested_policy(timing: dict[str, Any] | None) -> dict[str, Any] | None:
    """The `access_timing_policy` a grant push writes (`apply_payload`), as the readback must show it."""
    return {"mode": "ha", "schedule": timing, "bindings": {}} if timing else None


# ---------------------------------------------------------------- R11-I1-03 / R11-I1-04: the revision-bound revocation predicate
#
# WisKey's ACR5-01 `users/access_state(user_id, revision)` is PROPOSED, not delivered; Arx has NO client for it. What is built here is
# the Arx side of the contract only: a strict consumer of the answer, the verdict, and a typed reader seam that only fakes fill.
# Nothing below sends anything; the live engine passes no reader (UNKNOWN) and stays behind GO_LIVE_PERMITTED (False).

ACCESS_STATE_SCHEMA = 1
ACCESS_STATE_OBSERVATION = "durable_repository_snapshot"
ACCESS_STATE_SCOPE = "all_managed_stations"
PRESENCES = ("present", "delete_pending", "absent")
PENDING_QUEUES = ("bindings", "tombstones", "cards", "pins", "operations")  # central work still owed to a station
PENDING_UNVERIFIED = "unverified"  # work that disappeared without a positive device readback - never cleanup, never "pending" either


class AccessStateReader(Protocol):
    """The typed seam for ACR5-01: returns WisKey's raw access_state answer for `user_id` bound to `revision`, or raises (an
    `EngineError("revision_conflict")` when WisKey's person is at another revision). Only fakes implement it in this build."""

    def __call__(self, user_id: str, revision: int) -> Any: ...


@dataclass(frozen=True)
class AccessState:
    """A strictly parsed access_state answer (R11-I3-01). All six pending arrays are kept (R11-I1-04): the five central queues in
    `pending`, `unverified` apart - never collapsed to a boolean, and an empty array is never cleanup on its own. Station ids are
    WisKey's; nothing shows them before Arx RBAC station scope (intercom_authority) has filtered them - no view does today."""

    user_id: str
    person_revision: int | None
    presence: str
    revocation_pending: bool | None
    stations_synced: bool | None
    pending: dict[str, tuple[str, ...]]
    unverified: tuple[str, ...]

    @property
    def has_pending(self) -> bool:
        return any(self.pending.values())


def _station_ids(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list) or not all(isinstance(s, str) and 1 <= len(s) <= 128 and s.strip() for s in value) or len(set(value)) != len(value):
        raise ValueError("access_state pending array")
    return tuple(sorted(value))


def access_state_from_raw(raw: Any, *, user_id: str) -> AccessState:
    """The strict consumer (ValueError on anything off contract): schema_version exactly int 1, the fixed observation and scope, the
    exact user_id asked for, presence in PRESENCES, person_revision a positive int for a present person and null otherwise,
    revocation_pending / stations_synced a strict bool or null, `pending` with exactly the six arrays of unique non-blank station ids.
    A not-pending (False) answer must be internally consistent: present, and every array - unverified included - empty."""
    if not isinstance(raw, dict):
        raise ValueError("access_state record")
    if not _strict_int(raw.get("schema_version")) or raw["schema_version"] != ACCESS_STATE_SCHEMA:
        raise ValueError("access_state schema_version")
    if raw.get("observation") != ACCESS_STATE_OBSERVATION or raw.get("scope") != ACCESS_STATE_SCOPE:
        raise ValueError("access_state observation / scope")
    if not isinstance(raw.get("user_id"), str) or raw["user_id"] != user_id:
        raise ValueError("access_state user_id")
    presence = raw.get("presence")
    if presence not in PRESENCES:
        raise ValueError("access_state presence")
    revision = raw.get("person_revision")
    if (presence == "present") != _positive_int(revision) or (presence != "present" and revision is not None):
        raise ValueError("access_state person_revision")
    flags = (raw.get("revocation_pending"), raw.get("stations_synced"))
    if not all(f is None or isinstance(f, bool) for f in flags):
        raise ValueError("access_state flags")
    pending_raw = raw.get("pending")
    if not isinstance(pending_raw, dict) or set(pending_raw) != {*PENDING_QUEUES, PENDING_UNVERIFIED}:
        raise ValueError("access_state pending")
    pending = {k: _station_ids(pending_raw[k]) for k in PENDING_QUEUES}
    unverified = _station_ids(pending_raw[PENDING_UNVERIFIED])
    if flags[0] is False and (presence != "present" or any(pending.values()) or unverified):
        raise ValueError("access_state inconsistent")
    return AccessState(user_id=user_id, person_revision=revision, presence=presence, revocation_pending=flags[0], stations_synced=flags[1],
                       pending=pending, unverified=unverified)


def revocation_pending_verdict(state: AccessState, *, person_id: str, revision: int) -> bool | None:
    """R11-I1-03: the central revocation status of `person_id` at `revision`. None (UNKNOWN) for another person, or a present person
    at any other revision; True when anything is still owed (a central queue, delete_pending, or WisKey's own True); None when the
    person is absent (absence / a scoped 404 is never cleanup), when only `unverified` work remains, or when WisKey did not say False;
    False only for a present person at exactly `revision` with all six arrays empty and WisKey's flag False."""
    if state.user_id != person_id or (state.presence == "present" and state.person_revision != revision):
        return None
    if state.has_pending or state.presence == "delete_pending" or state.revocation_pending is True:
        return True
    if state.presence != "present" or state.unverified or state.revocation_pending is not False:
        return None
    return False


def revocation_pending_from(reader: AccessStateReader | None, person_id: str, revision: Any) -> bool | None:
    """Ask `reader` for `person_id` at `revision` and judge the answer. No reader, an unusable revision (not a positive int), any
    failure of the reader (a revision_conflict included) or an off-contract answer: None - a revoke stays `revoking`."""
    if reader is None or not isinstance(person_id, str) or not person_id or not _positive_int(revision):
        return None
    try:
        state = access_state_from_raw(reader(person_id, revision), user_id=person_id)
    except Exception:  # noqa: BLE001 - every failure is UNKNOWN, never "not pending"
        return None
    return revocation_pending_verdict(state, person_id=person_id, revision=revision)


def central_revoked(person: EnginePerson) -> bool:
    """The separate CENTRAL revocation predicate over one fresh readback: door map, overrides and PIN all KNOWN, and no door, no group,
    no personal override, inactive, no PIN. A restricted projection is UNKNOWN and never counts."""
    return (person.doors_known and person.overrides_known and person.pin_known and not person.doors and not person.group_ids
            and not person.overrides and not person.active and not person.pin_configured)


def revocation_proven(person: EnginePerson, pending: bool | None) -> bool:
    """A revoke is done only when BOTH hold for the same readback: the central predicate on `person` and a revocation status of
    exactly False obtained for `person.revision` (`Engine.revocation_pending(person.id, person.revision)`)."""
    return central_revoked(person) and pending is False


class WiskeyServiceEngine:
    """The S11 people writes on the service channel. Every method refuses (`not_permitted`) while the go-live permit is not in the
    build; nothing below the guard has run against a WisKey (NOT_RUN)."""

    WHO = "system:access_grants"

    def __init__(self, settings: Any, access_state_reader: AccessStateReader | None = None) -> None:
        self.settings = settings
        # R11-I1-03: no ACR5-01 client is built, so production passes none (revocation status UNKNOWN); only tests inject a fake.
        self.access_state_reader = access_state_reader

    def _guard(self) -> None:
        from . import access_grants

        if not access_grants.go_live_permitted():
            raise EngineError("not_permitted", "access_grants_not_permitted")

    @staticmethod
    def _map(exc: Exception) -> EngineError:
        from ..errors import ApiError

        if isinstance(exc, ApiError):
            details = exc.details if isinstance(getattr(exc, "details", None), dict) else {}
            wcode = str(details.get("wiskey_code") or "")
            if exc.code in ("intercom_person_not_found",) or wcode == "user_not_found":
                return EngineError("not_found", wcode or exc.code)
            if exc.code == "intercom_revision_conflict" or wcode == "revision_conflict":
                return EngineError("revision_conflict", wcode or exc.code)
            if wcode in ("pin_conflict", "intercom_pin_conflict") or exc.code == "intercom_pin_conflict":
                return EngineError("pin_conflict", wcode or exc.code)
            outcome = details.get("outcome")
            if outcome == "not_sent":
                return EngineError("not_sent", wcode or exc.code)
            if outcome == "unknown" or exc.code == "intercom_outcome_unknown":
                return EngineError("unknown", wcode or exc.code)
            return EngineError("refused", wcode or exc.code)
        if isinstance(exc, ValueError):
            return EngineError("unknown", "invalid_response")
        return EngineError("unknown", type(exc).__name__)

    def _write(self, send: Any, person_id: str | None = None) -> EnginePerson:
        """One people write. With `person_id` (every write to an existing person) an `unknown` outcome blocks the next write to that
        person until `get_person` has read it fresh (WisKey round 3, R3-06): that write is refused here as `not_sent`
        (`outcome_pending` / `readback_required`), never replayed."""
        from . import intercom_sync

        target = intercom_sync.person_target(person_id) if person_id is not None else None
        try:
            reply = intercom_sync.SYNC.action(self.settings, "person", send, person_from_raw_dict, self.WHO, lane="config", target=target)
        except Exception as exc:  # noqa: BLE001 - mapped to the closed kinds
            raise self._map(exc) from None
        raw = reply.get("person")
        if not isinstance(raw, dict):
            raise EngineError("unknown", "invalid_response")
        return person_from_raw(raw)

    def create_person(self, *, display_name: str, category: str, responsible_person: str, access_purpose: str,
                      employee_no: str | None = None) -> EnginePerson:
        self._guard()
        from . import intercom_client

        data = create_payload(display_name=display_name, employee_no=employee_no, category=category, responsible_person=responsible_person,
                              access_purpose=access_purpose)
        return self._write(lambda call: intercom_client.users_create(call, data, True))

    def get_person(self, person_id: str) -> EnginePerson:
        """A fresh `users/get`. R3-06: while an earlier write to this person is still out (its outcome unknown, WisKey may yet save
        it) no readback can decide anything: `not_sent outcome_pending`, the caller reads again on a later pass. A readback sent
        after that write's call was over settles it (writes to the person are allowed again). R3-03 / round 3: WisKey's
        `user_not_found` here is `not_found`, but it is NOT proof of absence (a person outside the caller's scope may answer the
        same) - the worker never marks a grant revoked on it."""
        self._guard()
        from . import intercom_client, intercom_sync

        target = intercom_sync.person_target(person_id)
        if intercom_sync.SYNC.write_gate(target) == "outcome_pending":  # also a write to the person still in flight (R4-07)
            raise EngineError("not_sent", "outcome_pending")
        try:
            reply = intercom_sync.SYNC.command(self.settings, "person", lambda call: intercom_client.users_get(call, person_id), person_from_raw_dict, who=self.WHO,
                                               target=target)
        except Exception as exc:  # noqa: BLE001
            raise self._map(exc) from None
        raw = reply.get("person")
        if not isinstance(raw, dict):
            raise EngineError("not_sent", str(reply.get("last_error") or reply.get("state") or "unavailable"))
        return person_from_raw(raw)

    def apply(self, person_id: str, revision: int, *, doors: dict[str, list[int]], valid_from: str, valid_until: str,
              timing: dict[str, Any] | None, active: bool, pin: Any = KEEP, overrides: dict[str, str] | None = None) -> EnginePerson:
        self._guard()
        from . import intercom_client

        data = apply_payload(doors=doors, valid_from=valid_from, valid_until=valid_until, timing=timing, active=active, pin=pin, overrides=overrides)
        return self._write(lambda call: intercom_client.users_update(call, person_id, revision, data, True), person_id)

    def strip(self, person_id: str, revision: int) -> EnginePerson:
        self._guard()
        from . import intercom_client

        data = strip_payload()
        return self._write(lambda call: intercom_client.users_update(call, person_id, revision, data, True), person_id)

    def revocation_pending(self, person_id: str, revision: int) -> bool | None:
        """WisKey's ACR5-01 access_state is PROPOSED and Arx has built no client for it (R11-I3-01), and the overview projection drops
        tombstones / revocations (B0, D-006): with no reader this is UNKNOWN - a live revoke stays `revoking`. With a reader (tests
        only) the answer is bound to `revision` and judged by `revocation_pending_verdict`; while a write to the person is unsettled
        no status can be judged (None)."""
        self._guard()
        if self.access_state_reader is None:
            return None
        from . import intercom_sync

        if intercom_sync.SYNC.write_gate(intercom_sync.person_target(person_id)) is not None:
            return None
        return revocation_pending_from(self.access_state_reader, person_id, revision)

    def pin_generate(self, person_id: str) -> str:
        """users/pin_generate is a read in WisKey (the value is not reserved); it is NOT a readback of the person, so it carries no
        `target` (a target on `command` would count as the fresh read that settles an unknown write). R4-07: it is still refused while
        a write to the person is unsettled - the PIN could only be written after a fresh read anyway."""
        self._guard()
        from . import intercom_client, intercom_sync

        if intercom_sync.SYNC.write_gate(intercom_sync.person_target(person_id)) is not None:
            raise EngineError("not_sent", "outcome_pending")
        try:
            reply = intercom_sync.SYNC.command(self.settings, "pin", lambda call: intercom_client.users_pin_generate(call, person_id), intercom_sync.project_pin,
                                               who=self.WHO)
        except Exception as exc:  # noqa: BLE001
            raise self._map(exc) from None
        pin = (reply.get("pin") or {}).get("pin") if isinstance(reply.get("pin"), dict) else None
        if not isinstance(pin, str):
            raise EngineError("not_sent", "pin_unavailable")
        return pin

    def rename(self, person_id: str, revision: int, display_name: str) -> EnginePerson:
        self._guard()
        from . import intercom_client

        return self._write(lambda call: intercom_client.users_update(call, person_id, revision, {"display_name": _clean_name(display_name)}, True), person_id)

    def delete(self, person_id: str, revision: int) -> None:
        self._guard()
        from . import intercom_client, intercom_sync

        try:
            intercom_sync.SYNC.action(self.settings, "deleted", lambda call: intercom_client.users_delete(call, person_id, revision), intercom_sync.project_accepted,
                                      self.WHO, lane="config", target=intercom_sync.person_target(person_id))
        except Exception as exc:  # noqa: BLE001
            raise self._map(exc) from None


def person_from_raw_dict(raw: Any) -> dict[str, Any]:
    """The projection the sync layer serves under `person`: the raw record checked to be a person (kept as a dict; the grant
    service maps it with `person_from_raw`)."""
    person_from_raw(raw)
    return dict(raw)
