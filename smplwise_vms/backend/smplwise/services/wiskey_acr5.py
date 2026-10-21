"""WKPEER-295 (WisKey round 10 section 2.2, round 11 R11-I1-03 / R11-I1-04 / R11-I2-01 / R11-I3-01..04): the Arx CONSUMER interfaces of
ACR5-01..04, each behind its own OFF switch. Fake-backed; NOT wired into the grant engine, the revoke path or any view.

Source contract: the frozen v1 read contract (ARX_REPLY6_FROZEN_READ_CONTRACT_V1.txt + ARX_REPLY6_WIRE_SHAPES_V1.json, WisKey round 6,
FROZEN_FOR_REVIEW / NOT_RELEASED). Arx accepts the interface only after reviewing WisKey's delivered code; nothing here asserts that it
is on the wire.

WKV2-295: ACR5-01 parsing is done by the ONE strict consumer `wiskey_access_state` (shared with access_grant_engine); this module only
  projects its value. It also accepts `users/access_state_v2` (schema 2, closed, cross-checked; `acr5_01_v2` capability
  `person_access_state_v2`); a v2 False additionally needs WisKey's central_revoked and the F-02 last-known-stations cross-check.
ACR5-01 `users/access_state` (user_id, revision) - `parse_access_state` is strict: every required key (nulls included), schema_version 1,
  the observation / scope constants, the EXACT user_id, a positive non-bool person_revision that equals the revision Arx asked about
  (else `revision_conflict`), presence-consistent nulls, every assignment row and all SIX pending queues (bindings, tombstones, cards,
  pins, operations, unverified) as separate tuples. `PendingQueues` refuses `bool()`: the queues are never collapsed into one flag, an
  empty array is never cleanup proof, `unverified` is kept apart from the five removal queues. Additive result fields are ignored and
  can never strengthen evidence. `revocation_verdict` is REVISION-BOUND (R11-I1-03): False only for presence=present at the requested
  revision, WisKey's own `revocation_pending: false`, no tracked queue at all, AND Arx's separate central revoked predicate proven by a
  fresh users/get at that SAME revision (`central_revoked_at`). delete_pending -> True; absent -> True when anything is tracked, else
  None; never False. `stations_synced_verdict` is central applied bookkeeping (never physical proof) taken from the revision-bound
  answer and cross-checked against its rows (R11-I2-01). `visible_pending` filters station ids through the actor's Arx station scope
  before anything is shown; an unknown scope shows nothing. Not a create-recovery feed (no provenance / purpose / receipt).
ACR5-02 `schedules/normalize_user` - mode / schedule / bindings are judged TOGETHER: a different mode or different bindings is never
  equivalent, whatever the schedule; schedules are compared only after both went through the same normalizer version; any failure is
  UNKNOWN (None). The grant proof additionally requires mode `ha` with empty bindings (never equivalence to native).
ACR5-03 presence (shares access_state) - diagnostic only: `is_cleanup_proof` is always False.
ACR5-04 feature dry plans - parsed strictly; a plan that claims `execution_available` or `authority_verified` is UNKNOWN; a plan is
  never executable and `consume_plan` refuses (no adapter exists on either side).

Switches: `wiskey.acr5_access_state`, `wiskey.acr5_normalize_user`, `wiskey.acr5_presence`, `wiskey.acr5_feature_plans` (default off)
AND the build constant `GO_LIVE_PERMITTED` (False). A switch set to `on` alone changes nothing."""
from __future__ import annotations

import copy
import re
import sqlite3
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Protocol

from ..db import get_setting
from . import wiskey_access_state as was
from .wiskey_access_state import (  # noqa: F401 - re-exported: WKV2-295 moved them into the single parser
    POLICY_KEYS,
    PRESENCES,
    QUEUES,
    REMOVAL_QUEUES,
    ROW_KEYS,
    SCHEDULE_KEYS,
    SYNC_STATES,
    AccessState,
    Assignment,
    PendingQueues,
    policy_ok,
    schedule_ok,
)

GO_LIVE_PERMITTED = False
FLAGS = {
    "acr5_01": "wiskey.acr5_access_state",
    "acr5_02": "wiskey.acr5_normalize_user",
    "acr5_03": "wiskey.acr5_presence",
    "acr5_04": "wiskey.acr5_feature_plans",
}
CAPABILITIES = {"acr5_01": "person_access_state_v1", "acr5_02": "user_schedule_normalization_v1", "acr5_03": "person_access_state_v1",
                "acr5_01_v2": "person_access_state_v2"}
ACCESS_STATE_TYPE = was.COMMANDS[was.SCHEMA_V1]
ACCESS_STATE_V2_TYPE = was.COMMANDS[was.SCHEMA_V2]
NORMALIZE_TYPE = "hikvision_intercom/schedules/normalize_user"
NORMALIZATION = "wiskey-user-schedule-v1"
ACCESS_KEYS = was.V1_KEYS
PLAN_KEYS = frozenset({"schema_version", "feature", "draft", "execution_available", "authority_verified", "status"})
ID_RE = re.compile(r"[^\x00-\x1f]{1,128}")
FEATURE_RE = re.compile(r"[a-z][a-z0-9_]{0,63}")


class ConsumerOff(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Unknown:
    code: str


def go_live_permitted() -> bool:
    return GO_LIVE_PERMITTED is True


def consumer_mode(conn: sqlite3.Connection, key: str) -> str:
    setting = FLAGS.get(key)
    if setting is None:
        return "off"
    try:
        return "on" if (get_setting(conn, setting) or "off") == "on" else "off"
    except sqlite3.Error:
        return "off"


def consumer_on(conn: sqlite3.Connection, key: str) -> bool:
    return consumer_mode(conn, key) == "on" and go_live_permitted()


def capability_ok(advertised: Iterable[str], key: str) -> bool:
    """Command AND capability must both be advertised; ACR5-04 has no capability (draft planners are not on the wire)."""
    cap = CAPABILITIES.get(key)
    return cap is not None and cap in set(advertised)


def _pos_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 1


def _id(value: Any) -> bool:
    return isinstance(value, str) and ID_RE.fullmatch(value) is not None


def _result(frame: Any) -> dict[str, Any] | Unknown:
    """The HA result envelope, checked by the single parser's `unwrap_frame` (WKV2-295)."""
    try:
        return was.unwrap_frame(frame)
    except was.AccessStateError as exc:
        return Unknown(exc.code)


# ---------------------------------------------------------------- schedules (shared by ACR5-01 timing_policy and ACR5-02)

# ---------------------------------------------------------------- ACR5-01 / ACR5-03 users/access_state

def access_state_request(user_id: Any, revision: Any, *, version: int = 1) -> dict[str, Any]:
    """The request payload (the transport adds `id`); `api_contract` is omitted (a READ). `version` 2 names users/access_state_v2."""
    if not _id(user_id) or not _pos_int(revision) or not (_pos_int(version) and version in was.COMMANDS):
        raise ValueError("invalid access_state request")
    return {"type": was.COMMANDS[version], "user_id": user_id, "revision": revision}


def parse_access_state(frame: Any, *, user_id: str, revision: int, expect: int | None = None) -> AccessState | Unknown:
    """WKV2-295: the ONE strict parser (`wiskey_access_state.parse_frame`, v1 and v2); every refusal is `Unknown(<typed code>)`.
    `expect` pins the schema of the command that was sent (no fallback between v1 and v2)."""
    try:
        state = was.parse_frame(frame, user_id=user_id, revision=revision, expect=expect)
        was.v1_acr5_consistent(state)  # this consumer's own v1 rule, unchanged
        return state
    except was.AccessStateError as exc:
        return Unknown(exc.code)


def revocation_verdict(state: AccessState | Unknown, *, requested_revision: int, central_revoked_at: int | None,
                       last_known_stations: frozenset[str] | None = None) -> bool | None:
    """True = a revocation is still pending, False = none, None = cannot tell. See the module docstring. A v2 answer is judged by
    `wiskey_access_state.revocation_verdict_v2` (WisKey's central_revoked, the F-02 last-known cross-check) AND Arx's own central
    predicate at the same revision (`central_revoked_at`); `last_known_stations` None leaves a v2 answer UNKNOWN."""
    if not isinstance(state, AccessState):
        return None
    if state.schema_version == was.SCHEMA_V2:
        verdict = was.revocation_verdict_v2(state, person_id=state.user_id, revision=requested_revision, last_known_stations=last_known_stations)
        if verdict is False and (not _pos_int(central_revoked_at) or central_revoked_at != requested_revision):
            return None
        return verdict
    if state.schema_version != was.SCHEMA_V1:
        return None
    if state.presence == "delete_pending":
        return True
    if state.presence == "absent":
        return True if (state.revocation_pending is True or state.pending.anything_tracked()) else None
    if state.person_revision != requested_revision:
        return None
    if state.revocation_pending is True:
        return True
    if state.revocation_pending is None or state.pending.anything_tracked():
        return None
    if not _pos_int(central_revoked_at) or central_revoked_at != requested_revision:
        return None
    return False


class RevisionBoundAccessState(Protocol):
    def access_state(self, user_id: str, revision: int) -> Any: ...


def revocation_pending_at(port: RevisionBoundAccessState, user_id: str, revision: int, *, central_revoked_at: int | None,
                          expect: int | None = None, last_known_stations: frozenset[str] | None = None) -> bool | None:
    """R11-I1-03: the revision travels WITH the question; any failure is UNKNOWN. Not wired to `Engine.revocation_pending`.
    WKV2-295: `expect` = the schema of the command the port sent (2 for users/access_state_v2: a v1 answer is then refused, never
    used as a weaker proof); `last_known_stations` feeds the v2 F-02 cross-check."""
    try:
        frame = port.access_state(user_id, revision)
    except Exception:  # noqa: BLE001 - a transport loss is UNKNOWN
        return None
    return revocation_verdict(parse_access_state(frame, user_id=user_id, revision=revision, expect=expect), requested_revision=revision,
                              central_revoked_at=central_revoked_at, last_known_stations=last_known_stations)


def _row_current(row: Assignment, person_revision: int) -> bool:
    return (row.desired_revision == person_revision and row.applied_revision == row.desired_revision and row.sync_state == "synced")


def stations_synced_verdict(state: AccessState | Unknown) -> bool | None:
    """Central applied bookkeeping (never physical proof), from the revision-bound answer; rows that contradict it make it None."""
    if not isinstance(state, AccessState) or state.presence != "present" or state.person_revision is None:
        return None
    enabled = [r for r in state.assignments if r.enabled]
    if state.stations_synced is True:
        return True if enabled and all(_row_current(r, state.person_revision) for r in enabled) else None
    if state.stations_synced is False:
        behind = [r for r in enabled if r.desired_revision is not None and not _row_current(r, state.person_revision)]
        return False if behind else None
    return None


ALL_STATIONS = object()  # an unrestricted actor (installation-wide station scope)


@dataclass(frozen=True)
class PendingView:
    queues: dict[str, tuple[str, ...]]
    complete: bool  # False when anything was withheld (no count of what)


def visible_pending(pending: PendingQueues, allowed: Any) -> PendingView | None:
    """Station ids filtered by the actor's Arx station scope (frozenset), ALL_STATIONS for an unrestricted actor, None = unknown
    scope (nothing is shown). The service-channel read never widens the actor's scope."""
    if allowed is None:
        return None
    if allowed is ALL_STATIONS:
        return PendingView(pending.as_dict(), True)
    if not isinstance(allowed, frozenset):
        return None
    out = {q: tuple(s for s in ids if s in allowed) for q, ids in pending.as_dict().items()}
    complete = all(len(out[q]) == len(getattr(pending, q)) for q in QUEUES)
    return PendingView(out, complete)


def presence_diagnostic(state: AccessState | Unknown) -> str | None:
    return state.presence if isinstance(state, AccessState) else None


def is_cleanup_proof(_state: Any) -> bool:
    """ACR5-03: absent / not_found / delete_pending / empty queues are never proof that anything was removed."""
    return False


# ---------------------------------------------------------------- ACR5-02 schedules/normalize_user

def normalize_request(schedule: Any) -> dict[str, Any]:
    if not schedule_ok(schedule):
        raise ValueError("invalid schedule")
    return {"type": NORMALIZE_TYPE, "schedule": copy.deepcopy(schedule)}


def parse_normalized(frame: Any) -> dict[str, Any] | Unknown:
    res = _result(frame)
    if isinstance(res, Unknown):
        return res
    if not {"schema_version", "normalization", "schedule"} <= set(res):
        return Unknown("missing_field")
    if not (_pos_int(res["schema_version"]) and res["schema_version"] == 1) or res["normalization"] != NORMALIZATION:
        return Unknown("unsupported_normalization")
    if not schedule_ok(res["schedule"]):
        return Unknown("malformed")
    return copy.deepcopy(res["schedule"])


Normalizer = Callable[[dict[str, Any]], Any]  # schedule -> the normalize_user frame


def _normalized(normalize: Normalizer, schedule: dict[str, Any]) -> dict[str, Any] | None:
    try:
        out = parse_normalized(normalize(copy.deepcopy(schedule)))
    except Exception:  # noqa: BLE001 - a transport loss is UNKNOWN
        return None
    return None if isinstance(out, Unknown) else out


def policy_equivalent(desired: Any, observed: Any, normalize: Normalizer) -> bool | None:
    """True / False / None (cannot tell). Mode and bindings are compared first and exactly; the schedule only through the normalizer."""
    if desired is None and observed is None:
        return True
    if desired is None or observed is None:
        return False
    if not policy_ok(desired) or not policy_ok(observed):
        return None
    if desired["mode"] != observed["mode"] or desired["bindings"] != observed["bindings"]:
        return False
    a = _normalized(normalize, desired["schedule"])
    b = _normalized(normalize, observed["schedule"])
    if a is None or b is None:
        return None
    return a == b


def grant_policy_proven(desired_schedule: Any, observed_policy: Any, normalize: Normalizer) -> bool | None:
    """The grant proof: Arx requests {mode: ha, schedule, bindings: {}}; a native policy never proves it."""
    if desired_schedule is None and observed_policy is None:
        return True
    if desired_schedule is None or observed_policy is None:
        return False
    if not policy_ok(observed_policy):
        return None
    if observed_policy["mode"] != "ha" or observed_policy["bindings"] != {}:
        return False
    return policy_equivalent({"mode": "ha", "schedule": desired_schedule, "bindings": {}}, observed_policy, normalize)


# ---------------------------------------------------------------- ACR5-04 feature dry plans

@dataclass(frozen=True)
class FeaturePlan:
    feature: str
    draft: dict[str, Any]

    @property
    def executable(self) -> bool:
        return False  # a draft is never a capability: no adapter exists on either side


def parse_feature_plan(raw: Any) -> FeaturePlan | Unknown:
    if not isinstance(raw, dict) or set(raw) != PLAN_KEYS:
        return Unknown("fields")
    if not (_pos_int(raw["schema_version"]) and raw["schema_version"] == 1):
        return Unknown("unsupported_schema")
    if not isinstance(raw["feature"], str) or not FEATURE_RE.fullmatch(raw["feature"]) or not isinstance(raw["draft"], dict):
        return Unknown("malformed")
    if raw["execution_available"] is not False or raw["authority_verified"] is not False or raw["status"] != "adapter_not_implemented":
        return Unknown("claims_capability")
    return FeaturePlan(raw["feature"], copy.deepcopy(raw["draft"]))


def consume_plan(conn: sqlite3.Connection, plan: FeaturePlan) -> None:
    """Never executes anything: refused while OFF, and refused when ON because no adapter exists."""
    if not consumer_on(conn, "acr5_04"):
        raise ConsumerOff("not_permitted")
    raise ConsumerOff("adapter_not_implemented")
