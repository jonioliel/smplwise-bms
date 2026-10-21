"""WKV2-295 (round-12 audit finding F-01 / F-02): the ONE strict Arx consumer of WisKey's person access_state readback.

Both former v1-only parsers (`access_grant_engine.access_state_from_raw`, STATIONSYNC-295, and `wiskey_acr5.parse_access_state`,
WKPEER-295) now go through `parse_result` / `parse_frame` here; they only project the parsed value into their own result types.

Version dispatch on the answer's `schema_version` (a strict non-bool int):
  1  `hikvision_intercom/users/access_state` - the frozen v1 read contract, kept working as before. Additive top-level and row fields
     are ignored (they never strengthen evidence). v1 stays existing compatibility only: it is never a fallback for a v2 question.
  2  `hikvision_intercom/users/access_state_v2` - WisKey c932c553 (`person_readback.project` + `revocation_snapshot.project_v2`,
     delivery wr12/1 READBACK_V2_CONTRACT_AND_MIGRATION.txt). CLOSED schema: exactly the v1 keys plus
     `central_revocation_predicate` and `central_revoked`; an unknown key at any level is rejected (the contract lists the fields and
     names no additive rule). Every derivable field is cross-checked against the rest of the answer (WisKey's projection rules).
  anything else -> `AccessStateError("unsupported_schema")`. A caller that asked one version (`expect=`) refuses the other
  (`schema_mismatch`): no silent fallback from v2 to v1 and back.

Every failure is a typed `AccessStateError` (a ValueError) with a closed `code`; a caller maps it to UNKNOWN, never to "clean".

The v2 revocation verdict (`revocation_verdict_v2`) is the only place a v2 answer may become False ("no tracked revocation work"):
  presence present, at the requested revision (which the caller took from a fresh users/get), WisKey's `central_revoked` True,
  `revocation_pending` False, all six arrays empty, AND the F-02 cross-check against the stations Arx itself last knew for the
  person: the answer must carry bookkeeping at all (empty bookkeeping is NOT proof), and every last-known station must show a
  disabled row whose central application is proven at this revision (`applied` True). A missing last-known record, a missing row,
  an enabled row or an unproven row is UNKNOWN (None) - "not verified", never "revoked/clean". Even False is central bookkeeping
  only: not physical proof at a door, and not a fence against an older in-flight mutation.

WKV2B-295 (owner decision 2026-10-21, the revoke-proof middle path): a v1 answer NEVER proves a revoke. What v1 could only ever say
("no tracked work", the clean-looking shape) is a DIFFERENT result from a verified clean one: `EVIDENCE_UNVERIFIED` ("revoked, not
verified by the other side") against `EVIDENCE_VERIFIED` (v2 only). `evidence_of` and the callers' `revocation_evidence` carry the
distinction; the callers' boolean verdicts never return False for v1.

Pure functions, no I/O except `last_known_stations` (a read of Arx's own grant / station-permission rows). Nothing here sends anything
to WisKey; no switch, no GO_LIVE constant is read or changed."""
from __future__ import annotations

import copy
import json
import re
import sqlite3
from dataclasses import dataclass, replace
from typing import Any

SCHEMA_V1 = 1
SCHEMA_V2 = 2
SUPPORTED_SCHEMAS = (SCHEMA_V1, SCHEMA_V2)
COMMANDS = {SCHEMA_V1: "hikvision_intercom/users/access_state", SCHEMA_V2: "hikvision_intercom/users/access_state_v2"}
CAPABILITIES = {SCHEMA_V1: "person_access_state_v1", SCHEMA_V2: "person_access_state_v2"}
OBSERVATION = "durable_repository_snapshot"
SCOPE = "all_managed_stations"
CENTRAL_REVOCATION_PREDICATE = "inactive-no-enabled-assignments-no-groups-no-overrides-no-pin-v1"

V1_KEYS = frozenset({"schema_version", "observation", "scope", "user_id", "person_revision", "presence", "revocation_pending",
                     "stations_synced", "assignments", "timing_policy", "pending"})
V2_KEYS = V1_KEYS | {"central_revocation_predicate", "central_revoked"}
ROW_KEYS = frozenset({"station_id", "enabled", "allowed_locks", "desired_revision", "applied_revision", "sync_state", "applied"})
QUEUES = ("bindings", "tombstones", "cards", "pins", "operations", "unverified")
REMOVAL_QUEUES = QUEUES[:5]  # central work still owed to a station; `unverified` is kept apart (never cleanup, never "pending")
PRESENCES = ("present", "delete_pending", "absent")
SYNC_STATES = ("synced", "pending", "syncing", "offline", "conflict", "error", "delete_pending")  # WisKey models.SYNC_STATES
RELAYS = (1, 2)

# Bounds (Arx-side; WisKey states none for v2 - an open question in CR-WISKEY-V2-CONSUMER-295): a revision fits a JSON-safe integer,
# an id is WisKey's `_identifier` (1..128 chars, no control char) and not blank, the arrays are capped well above one installation.
MAX_REVISION = 2 ** 53 - 1
MAX_ID = 128
MAX_ROWS = 1024
MAX_QUEUE = 1024

DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
SCHEDULE_KEYS = frozenset({"mode", "timezone", "days", "dates", "periods"})
POLICY_KEYS = frozenset({"mode", "schedule", "bindings"})
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")

ERROR_CODES = frozenset({"malformed_envelope", "error", "missing_field", "unknown_field", "unsupported_schema", "schema_mismatch",
                         "unsupported_observation", "user_mismatch", "revision_conflict", "malformed", "oversize", "inconsistent"})


class AccessStateError(ValueError):
    """A typed refusal of an access_state answer. `code` is from ERROR_CODES, or WisKey's own error code (an id) for an error envelope.
    A ValueError so the existing `except ValueError` / `except Exception` callers keep failing closed."""

    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(f"access_state {code}" + (f": {detail}" if detail else ""))
        self.code = code
        self.detail = detail[:64]


# ---------------------------------------------------------------- scalar checks


def strict_int(value: Any) -> bool:
    """An int that is not a bool (True / False are ints in Python, never a revision or a lock number)."""
    return isinstance(value, int) and not isinstance(value, bool)


def revision_ok(value: Any) -> bool:
    """A revision: strict int, 1 <= value <= MAX_REVISION."""
    return strict_int(value) and 1 <= value <= MAX_REVISION


def id_ok(value: Any) -> bool:
    """WisKey's `_identifier` (1..128 chars, no C0 control, no DEL) and not blank (a whitespace-only id is never a station or a person)."""
    return (isinstance(value, str) and 1 <= len(value) <= MAX_ID and value.strip() != ""
            and not any(ord(c) < 32 or ord(c) == 127 for c in value))


def _flag(value: Any) -> bool:
    return value is None or isinstance(value, bool)


# ---------------------------------------------------------------- schedules / timing policy (shared with ACR5-02)


def schedule_ok(s: Any) -> bool:
    """Structural check of a canonical-shape schedule (the five required keys); semantics stay WisKey's normalizer's."""
    if not isinstance(s, dict) or set(s) != SCHEDULE_KEYS or s["mode"] not in ("weekly", "dates"):
        return False
    if not isinstance(s["timezone"], str) or not s["timezone"] or len(s["timezone"]) > 128:
        return False
    days, dates, periods = s["days"], s["dates"], s["periods"]
    if not isinstance(days, list) or len(days) > 7 or len(set(map(str, days))) != len(days) or any(d not in DAYS for d in days):
        return False
    if (not isinstance(dates, list) or len(dates) > 64 or any(not isinstance(d, str) or not DATE_RE.fullmatch(d) for d in dates)
            or len(set(dates)) != len(dates)):
        return False
    if not isinstance(periods, list) or not 1 <= len(periods) <= 8:
        return False
    return all(isinstance(p, dict) and set(p) == {"start", "end"} and isinstance(p["start"], str) and isinstance(p["end"], str) for p in periods)


def policy_ok(p: Any) -> bool:
    """The mode / schedule / bindings triple, required together; mode `ha` requires empty bindings."""
    if not isinstance(p, dict) or set(p) != POLICY_KEYS or p["mode"] not in ("ha", "native") or not isinstance(p["bindings"], dict):
        return False
    if p["mode"] == "ha" and p["bindings"] != {}:
        return False
    return schedule_ok(p["schedule"])


# ---------------------------------------------------------------- the parsed value


@dataclass(frozen=True)
class Assignment:
    station_id: str
    enabled: bool
    allowed_locks: tuple[int, ...]
    desired_revision: int | None
    applied_revision: int | None
    sync_state: str | None
    applied: bool | None


@dataclass(frozen=True)
class PendingQueues:
    bindings: tuple[str, ...]
    tombstones: tuple[str, ...]
    cards: tuple[str, ...]
    pins: tuple[str, ...]
    operations: tuple[str, ...]
    unverified: tuple[str, ...]

    def __bool__(self) -> bool:
        raise TypeError("the six pending queues are never collapsed into one boolean")

    def removal_queues(self) -> dict[str, tuple[str, ...]]:
        return {q: getattr(self, q) for q in REMOVAL_QUEUES}

    def as_dict(self) -> dict[str, tuple[str, ...]]:
        return {q: getattr(self, q) for q in QUEUES}

    def anything_tracked(self) -> bool:
        return any(getattr(self, q) for q in QUEUES)

    def removal_pending(self) -> bool:
        return any(getattr(self, q) for q in REMOVAL_QUEUES)


@dataclass(frozen=True)
class AccessState:
    """One strictly parsed access_state answer (v1 or v2). `central_revocation_predicate` / `central_revoked` are None for v1.
    Station ids are WisKey's; nothing shows them before Arx RBAC station scope has filtered them."""

    user_id: str
    person_revision: int | None
    presence: str
    revocation_pending: bool | None
    stations_synced: bool | None
    assignments: tuple[Assignment, ...]
    timing_policy: dict[str, Any] | None
    pending: PendingQueues
    schema_version: int = SCHEMA_V1
    central_revocation_predicate: str | None = None
    central_revoked: bool | None = None

    def row(self, station_id: str) -> Assignment | None:
        return next((r for r in self.assignments if r.station_id == station_id), None)

    def bookkeeping_empty(self) -> bool:
        """F-02: no assignment row and all six arrays empty - nothing in the answer says anything about any station."""
        return not self.assignments and not self.pending.anything_tracked()


# ---------------------------------------------------------------- envelope


def unwrap_frame(frame: Any) -> dict[str, Any]:
    """The HA WebSocket result envelope -> the result object, or AccessStateError (WisKey's error code when it answered one)."""
    if not isinstance(frame, dict) or frame.get("type") != "result" or not revision_ok(frame.get("id")):
        raise AccessStateError("malformed_envelope")
    if frame.get("success") is False:
        err = frame.get("error")
        code = err.get("code") if isinstance(err, dict) else None
        raise AccessStateError(code if id_ok(code) else "error")
    if frame.get("success") is not True or not isinstance(frame.get("result"), dict):
        raise AccessStateError("malformed_envelope")
    return frame["result"]


def parse_frame(frame: Any, *, user_id: str, revision: int | None = None, expect: int | None = None) -> AccessState:
    return parse_result(unwrap_frame(frame), user_id=user_id, revision=revision, expect=expect)


# ---------------------------------------------------------------- the parser


def _ids(value: Any, where: str) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise AccessStateError("malformed", where)
    if len(value) > MAX_QUEUE:
        raise AccessStateError("oversize", where)
    if not all(id_ok(s) for s in value) or len(set(value)) != len(value):
        raise AccessStateError("malformed", where)
    return tuple(sorted(value))


def _queues(raw: Any) -> PendingQueues:
    if not isinstance(raw, dict):
        raise AccessStateError("malformed", "pending")
    if set(raw) - set(QUEUES):
        raise AccessStateError("unknown_field", "pending")
    if set(raw) != set(QUEUES):
        raise AccessStateError("missing_field", "pending")
    return PendingQueues(**{q: _ids(raw[q], q) for q in QUEUES})


def _row(raw: Any, schema: int) -> Assignment:
    if not isinstance(raw, dict):
        raise AccessStateError("malformed", "assignment")
    if not ROW_KEYS <= set(raw):
        raise AccessStateError("missing_field", "assignment")
    if schema == SCHEMA_V2 and set(raw) - ROW_KEYS:
        raise AccessStateError("unknown_field", "assignment")
    locks = raw["allowed_locks"]
    if not (id_ok(raw["station_id"]) and isinstance(raw["enabled"], bool) and isinstance(locks, list)):
        raise AccessStateError("malformed", "assignment")
    if any(not strict_int(x) or x not in RELAYS for x in locks) or locks != sorted(set(locks)):
        raise AccessStateError("malformed", "allowed_locks")
    for k in ("desired_revision", "applied_revision"):
        if raw[k] is not None and not revision_ok(raw[k]):
            raise AccessStateError("malformed", k)
    if raw["sync_state"] is not None and raw["sync_state"] not in SYNC_STATES:
        raise AccessStateError("malformed", "sync_state")
    if not _flag(raw["applied"]):
        raise AccessStateError("malformed", "applied")
    return Assignment(raw["station_id"], raw["enabled"], tuple(locks), raw["desired_revision"], raw["applied_revision"], raw["sync_state"],
                      raw["applied"])


def parse_result(raw: Any, *, user_id: str, revision: int | None = None, expect: int | None = None) -> AccessState:
    """The single strict parser. `user_id` must match exactly; `revision` (when given: the revision of the caller's fresh users/get)
    must equal a present person's `person_revision` (else `revision_conflict`); `expect` pins the schema the caller asked for."""
    if not isinstance(raw, dict):
        raise AccessStateError("malformed", "record")
    schema = raw.get("schema_version")
    if not strict_int(schema) or schema not in SUPPORTED_SCHEMAS:
        raise AccessStateError("unsupported_schema")
    if expect is not None and schema != expect:
        raise AccessStateError("schema_mismatch")
    keys = V2_KEYS if schema == SCHEMA_V2 else V1_KEYS
    if not keys <= set(raw):
        raise AccessStateError("missing_field", ",".join(sorted(keys - set(raw)))[:64])
    if schema == SCHEMA_V2 and set(raw) - keys:
        raise AccessStateError("unknown_field")
    if raw["observation"] != OBSERVATION or raw["scope"] != SCOPE:
        raise AccessStateError("unsupported_observation")
    if not isinstance(raw["user_id"], str) or not isinstance(user_id, str) or raw["user_id"] != user_id or not id_ok(user_id):
        raise AccessStateError("user_mismatch")
    presence, rev, pending_flag, synced = raw["presence"], raw["person_revision"], raw["revocation_pending"], raw["stations_synced"]
    if presence not in PRESENCES:
        raise AccessStateError("malformed", "presence")
    if presence == "present":
        if not revision_ok(rev):
            raise AccessStateError("malformed", "person_revision")
        if revision is not None and rev != revision:
            raise AccessStateError("revision_conflict")
    elif rev is not None:
        raise AccessStateError("malformed", "person_revision")
    if not _flag(pending_flag) or not _flag(synced):
        raise AccessStateError("malformed", "flags")
    if not isinstance(raw["assignments"], list):
        raise AccessStateError("malformed", "assignments")
    if len(raw["assignments"]) > MAX_ROWS:
        raise AccessStateError("oversize", "assignments")
    rows = tuple(_row(r, schema) for r in raw["assignments"])
    if len({r.station_id for r in rows}) != len(rows):
        raise AccessStateError("malformed", "assignments")
    policy = raw["timing_policy"]
    if policy is not None and not policy_ok(policy):
        raise AccessStateError("malformed", "timing_policy")
    queues = _queues(raw["pending"])
    # consistency both former v1 parsers enforced: only a present person can be "not pending" (absence is never cleanup). The two
    # caller-specific v1 rules stay with their callers unchanged (`v1_engine_consistent`, `v1_acr5_consistent`); v2 checks all in `_v2`.
    if pending_flag is False and presence != "present":
        raise AccessStateError("inconsistent", "revocation_pending")
    state = AccessState(user_id=user_id, person_revision=rev, presence=presence, revocation_pending=pending_flag, stations_synced=synced,
                        assignments=tuple(sorted(rows, key=lambda r: r.station_id)), timing_policy=copy.deepcopy(policy), pending=queues,
                        schema_version=schema)
    if schema == SCHEMA_V2:
        state = _v2(raw, state)
    return state


def _v2(raw: dict[str, Any], state: AccessState) -> AccessState:
    """v2: the two new fields plus WisKey's projection rules, so a self-contradicting answer is refused instead of half-believed."""
    if raw["central_revocation_predicate"] != CENTRAL_REVOCATION_PREDICATE:
        raise AccessStateError("unsupported_observation", "central_revocation_predicate")
    revoked = raw["central_revoked"]
    q = state.pending
    if state.presence == "present":
        if not isinstance(revoked, bool):
            raise AccessStateError("malformed", "central_revoked")
        if revoked and any(r.enabled for r in state.assignments):
            raise AccessStateError("inconsistent", "central_revoked")
        expected = True if q.removal_pending() else (None if q.unverified else False)
    else:
        if revoked is not None:
            raise AccessStateError("inconsistent", "central_revoked")
        if state.assignments or state.timing_policy is not None or state.stations_synced is not None:
            raise AccessStateError("inconsistent", "absent_person_data")
        expected = True if (state.presence == "delete_pending" or q.removal_pending()) else None
    if state.revocation_pending is not expected:
        raise AccessStateError("inconsistent", "revocation_pending")
    checks: list[bool | None] = []
    for r in state.assignments:
        if r.enabled and not r.allowed_locks:
            raise AccessStateError("inconsistent", "enabled_without_locks")
        if r.applied is True and not (r.desired_revision == state.person_revision and r.applied_revision == r.desired_revision
                                      and r.sync_state == "synced"):
            raise AccessStateError("inconsistent", "applied_true")
        if r.applied is False and not (r.desired_revision == state.person_revision and r.applied_revision is not None
                                       and r.sync_state is not None and (r.applied_revision != r.desired_revision or r.sync_state != "synced")
                                       and r.station_id in q.operations):
            raise AccessStateError("inconsistent", "applied_false")
        if r.applied is None and r.station_id not in q.unverified:
            raise AccessStateError("inconsistent", "applied_unknown")
        if r.enabled:
            checks.append(r.applied)
    derived = None if not checks else False if False in checks else None if None in checks else True
    if state.stations_synced is not derived:
        raise AccessStateError("inconsistent", "stations_synced")
    return replace(state, central_revocation_predicate=raw["central_revocation_predicate"], central_revoked=revoked)


def v1_engine_consistent(state: AccessState) -> None:
    """The extra v1 rule of the STATIONSYNC-295 consumer, kept exactly: a not-pending (False) answer must have all six arrays empty."""
    if state.schema_version == SCHEMA_V1 and state.revocation_pending is False and state.pending.anything_tracked():
        raise AccessStateError("inconsistent", "revocation_pending")


def v1_acr5_consistent(state: AccessState) -> None:
    """The extra v1 rule of the WKPEER-295 consumer, kept exactly: delete_pending must say revocation_pending True."""
    if state.schema_version == SCHEMA_V1 and state.presence == "delete_pending" and state.revocation_pending is not True:
        raise AccessStateError("inconsistent", "delete_pending")


def try_parse(raw: Any, **kw: Any) -> AccessState | AccessStateError:
    try:
        return parse_result(raw, **kw)
    except AccessStateError as exc:
        return exc


# ---------------------------------------------------------------- the revocation evidence (WKV2B-295)

EVIDENCE_PENDING = "pending"                # tracked revocation work is still owed (v1 or v2)
EVIDENCE_VERIFIED = "verified_clean"        # v2 only: WisKey's central_revoked + no tracked work + the F-02 per-station cross-check
EVIDENCE_UNVERIFIED = "revoked_unverified"  # v1 only: the answer looked clean, but v1 cannot prove a revoke - "not verified by the other side"
EVIDENCES = (EVIDENCE_PENDING, EVIDENCE_VERIFIED, EVIDENCE_UNVERIFIED)


def evidence_of(state: Any, verdict_v1: bool | None, *, person_id: str, revision: Any, last_known_stations: frozenset[str] | None) -> str | None:
    """One answer -> what it shows about the revoke. `verdict_v1` is the calling consumer's own v1 judgement (True = work owed, False = the
    clean-looking shape, None = cannot tell), kept per caller exactly as before; a v2 answer is judged here by `revocation_verdict_v2`.
    v1 True -> pending; v1 False -> UNVERIFIED (never VERIFIED); v2 False -> VERIFIED. None = UNKNOWN."""
    if not isinstance(state, AccessState):
        return None
    if state.schema_version == SCHEMA_V2:
        v = revocation_verdict_v2(state, person_id=person_id, revision=revision, last_known_stations=last_known_stations)
        return EVIDENCE_PENDING if v is True else EVIDENCE_VERIFIED if v is False else None
    if state.schema_version != SCHEMA_V1:
        return None
    return EVIDENCE_PENDING if verdict_v1 is True else EVIDENCE_UNVERIFIED if verdict_v1 is False else None


# ---------------------------------------------------------------- the v2 revocation verdict (F-01 / F-02)


def revocation_verdict_v2(state: Any, *, person_id: str, revision: Any, last_known_stations: frozenset[str] | None) -> bool | None:
    """True = tracked revocation work is still owed; False = WisKey proves central revocation AND no tracked work at `revision` AND
    every station Arx last knew shows a proven disabled row; None = cannot tell (UNKNOWN, "not verified").
    `revision` must be the revision of the caller's fresh users/get (the answer is refused for any other). A v1 answer is never judged
    here (None): v1 is not an alternate revocation proof for a v2 question."""
    if not isinstance(state, AccessState) or state.schema_version != SCHEMA_V2 or state.user_id != person_id or not revision_ok(revision):
        return None
    if state.presence == "delete_pending":
        return True
    if state.presence == "absent":
        return True if state.pending.removal_pending() else None  # absence is never cleanup
    if state.person_revision != revision:
        return None
    if state.revocation_pending is True or state.pending.removal_pending():
        return True
    if state.revocation_pending is not False or state.pending.unverified or state.central_revoked is not True:
        return None
    # F-02: a present person with entirely empty bookkeeping reads revocation_pending=false at WisKey - that is "no tracked work", not
    # "every station cleaned". Arx requires positive per-station evidence for every station it last knew.
    if state.bookkeeping_empty() or last_known_stations is None:
        return None
    for sid in last_known_stations:
        row = state.row(sid)
        if row is None or row.enabled or row.applied is not True:
            return None
    return False


def station_removal_verdict_v2(state: Any, *, person_id: str, revision: Any, station_id: str) -> bool | None:
    """ECCACT-295: whether the removal of ONE station's access for a still-present person is proven at `revision` (a station block /
    inherit-to-deny, not a revocation of the whole person).
    True = tracked removal work naming this station is still owed; False = the answer carries a disabled row for exactly this station,
    applied at this revision (desired == applied == person_revision, synced), no removal queue names the station, nothing for it is
    unverified and WisKey's own `revocation_pending` is False; None = cannot tell. v1 is never judged here (None): only v2 proves."""
    if not isinstance(state, AccessState) or state.schema_version != SCHEMA_V2 or state.user_id != person_id or not revision_ok(revision) or not id_ok(station_id):
        return None
    queues = state.pending.removal_queues()
    named = any(station_id in ids for ids in queues.values())
    if state.presence == "delete_pending":
        return True
    if state.presence != "present" or state.person_revision != revision:
        return True if named else None
    if named:
        return True
    if state.revocation_pending is not False or station_id in state.pending.unverified:
        return None
    row = state.row(station_id)
    if row is None or row.enabled or row.applied is not True:
        return None
    if not (row.desired_revision == revision and row.applied_revision == revision and row.sync_state == "synced"):
        return None
    return False


# ---------------------------------------------------------------- Arx's own last-known doors record (no migration)


def last_known_stations(conn: sqlite3.Connection, wiskey_person_id: str) -> frozenset[str] | None:
    """Every station Arx itself ever wrote for this WisKey person: the door maps of its grants that may have reached WisKey
    (`access_grants.pushed`, through `access_person_links`) and its per-station decisions (`access_station_permissions` with a WisKey
    revision or an allow effect). None (UNKNOWN) when the record cannot be read or a stored door map is unreadable - never "no doors"."""
    if not id_ok(wiskey_person_id):
        return None
    stations: set[str] = set()
    try:
        rows = conn.execute("""SELECT g.doors_json FROM access_grants g JOIN access_person_links l ON l.id = g.link_id
                               WHERE l.wiskey_person_id = ? AND g.pushed = 1""", (wiskey_person_id,)).fetchall()
        for (doors_json,) in rows:
            doors = json.loads(doors_json or "{}")
            if not isinstance(doors, dict) or not all(id_ok(k) for k in doors):
                return None
            stations |= set(doors)
        perm = conn.execute("""SELECT station_id FROM access_station_permissions WHERE wiskey_person_id = ?
                               AND (wiskey_revision IS NOT NULL OR effect = 'allow')""", (wiskey_person_id,)).fetchall()
        for (sid,) in perm:
            if not id_ok(sid):
                return None
            stations.add(sid)
    except (sqlite3.Error, ValueError, TypeError):
        return None
    return frozenset(stations)


# ---------------------------------------------------------------- ECCACT-295: capability negotiation

@dataclass(frozen=True)
class Negotiated:
    """The outcome of `negotiate`: which readback command Arx may send, and whether the answer could ever prove a revocation.
    `version` None = no usable readback (`reason` says why); the caller then keeps every revoke at UNKNOWN (no weaker fallback)."""

    version: int | None
    command: str | None
    reason: str

    @property
    def can_prove_revocation(self) -> bool:
        return self.version == SCHEMA_V2  # a v1 answer is never a revocation proof (ECCACT-295 / WKV2B owner decision 2026-10-20)


NEGOTIATED_NONE = "unsupported"


def _listed(commands: Any) -> frozenset[str] | None:
    if isinstance(commands, (set, frozenset, list, tuple)) and all(isinstance(c, str) for c in commands):
        return frozenset(c[len("hikvision_intercom/"):] if c.startswith("hikvision_intercom/") else c for c in commands)
    return None


def negotiate(commands: Any, capabilities: Any) -> Negotiated:
    """WisKey's `overview.api.commands` and `.capabilities` decide: a version is usable only when BOTH its command is listed AND its
    capability advertised (a disabled candidate is neither). v2 is preferred; v1 is a compatibility READ only (it never proves a
    revocation). Missing, mistyped or empty lists, or neither pair, give `version=None` - never a guess from the WisKey version."""
    listed, caps = _listed(commands), _listed(capabilities)
    if listed is None or caps is None:
        return Negotiated(None, None, "not_listed")
    for version in (SCHEMA_V2, SCHEMA_V1):
        command = COMMANDS[version][len("hikvision_intercom/"):]
        if command in listed and CAPABILITIES[version] in caps:
            return Negotiated(version, COMMANDS[version], "ok")
    if COMMANDS[SCHEMA_V2][len("hikvision_intercom/"):] in listed or COMMANDS[SCHEMA_V1][len("hikvision_intercom/"):] in listed:
        return Negotiated(None, None, "capability_missing")
    return Negotiated(None, None, NEGOTIATED_NONE)
