"""WISKEYA06-297 (board "WisKey A06", WisKey W-031 / T06; FAKES ONLY): identity source + role + scope -> admission, and the work-state mapping,
for the parts the earlier T06 slices left open.

Already pinned elsewhere (not repeated here):
- every signed command -> its admission gate: tests/test_t06_admission_295.py (docs/changes/T06-ADMISSION-MAPPING-295.md);
- the three admission gaps W031 closed: tests/test_w031_295.py (docs/changes/W031-295.md);
- the work states of the direct FEATURE client (features/start, features/result): pilot/WISKEYNEXT-297 slice A
  (docs/changes/WISKEYNEXT-297-T06-WORK-STATES.md, not on this base).

What this file adds (the table is docs/changes/WISKEYA06-297.md):
A. The identity source is Arx's own, current RBAC at the moment of each signed emergency command: the same person object, with its binding
   revoked / expired / denied between two commands, is refused on the second. Nothing about the role is carried or cached by the caller.
B. EMROLE (the emergency-open role given to non-administrators, landed in 2.20.0) on the SIGNED path (`features/start`, emergency v2): the T06 note
   left these rows open because EMROLE was not in its candidate. A guard granted the role by a security manager at a building is admitted on that
   building's station only; the security manager's own grant right is not an open right; a revoke through the grant module and an expiry stop the
   next command; a local (Arx-only) identity's role addition is admitted on its scope only and never without an expiry.
C. The work-state words outside the feature client: the trusted door answer (`door_open`, `door_open_status`), the native people-write receipt and
   the people-CSV receipt. `admitted`, `pending`, `running`, `accepted`, `active` and a static `status.active` are never read as a done door, a
   committed write or a device proof.

Nothing here contacts WisKey, Home Assistant, a station, a door or a network: the wire is FakeDirectPort (a recorder)."""
from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
import test_wkcap_295 as wk
from conftest import as_user
from wkcap_fakes import FakeDirectPort

from smplwise.db import new_id, now_iso, permission_revision
from smplwise.rbac import STATION, Principal
from smplwise.services import door_emergency_grants as deg
from smplwise.services import trusted_door
from smplwise.services import wiskey_emergency_direct as ed
from smplwise.services import wiskey_feature_exec as fx
from smplwise.services import wiskey_native_write as nw
from smplwise.services import wiskey_people_csv as wpc

API = "/api/v1"
NOT_DONE = ("admitted", "pending", "running", "accepted", "active", "queued", "in_progress", "started", "ok", "success", "done", "true")


# ======================================================================================================================================
# the world: one site, building b1 holds station st-a, building b2 holds station st-b; both stations have a confirmed relay map
# ======================================================================================================================================

@pytest.fixture()
def aenv(settings):
    e = wk.Env(settings)
    admin = e.principal("joni")
    now = now_iso()
    with e.db.connection() as conn:
        conn.execute("INSERT INTO sites(id, name, created_at, updated_at) VALUES ('s1', 'Site', ?, ?)", (now, now))
        for b, st in (("b1", "st-a"), ("b2", "st-b")):
            conn.execute("INSERT INTO buildings(id, site_id, name, created_at, updated_at) VALUES (?, 's1', ?, ?, ?)", (b, b.upper(), now, now))
            conn.execute("INSERT INTO intercom_station_placement(config_entry_id, site_id, building_id, assigned_by, assigned_at, revision) VALUES (?, 's1', ?, 'test', ?, 1)",
                         (st, b, now))
            fx.set_relay_map(conn, station_id=st, api_relay=1, physical_relay=2, confirmed_by=admin.user_id, expected_revision=0)
    e.admin = admin
    return e


def bind(e: Any, user_id: str, role: str, scope_type: str, scope_id: str, *, effect: str = "allow") -> str:
    bid = new_id()
    with e.db.connection() as conn:
        conn.execute(
            "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at)"
            " VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?)", (bid, user_id, role, scope_type, scope_id, effect, permission_revision(conn), now_iso()))
    return bid


def hours(h: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ")


PAST = "2000-01-01T00:00:00Z"


def engine(e: Any, port: FakeDirectPort, who: Principal) -> Any:
    """The emergency v2 engine with a manual context for `who` (the same shape incident_context builds from Arx's incident record)."""
    ctx = ed.EmergencyContext(fx.human_actor(who.user_id), (who,), "arx-permissions", 5, "manual", True)
    return wk.engine_for(e, port, lambda conn, rid: ctx)


class Opener:
    """Counts the emergency OPEN commands one person may sign; every call is a new request id (no replay)."""

    def __init__(self, e: Any, port: FakeDirectPort, who: Principal) -> None:
        self.e, self.port, self.who, self.n = e, port, who, 0

    def open(self, station: str) -> str:
        self.n += 1
        return engine(self.e, self.port, self.who).apply("open", station, 1, f"req-{self.who.username}-{self.n}:{station}:1", "").state


def grant(e: Any, by: str, user_id: str, scope_type: str, scope_id: str, **extra: Any) -> Any:
    return e.c.post(f"{API}/doors/emergency/grants", headers=as_user(by),
                    json={"user_id": user_id, "scope_type": scope_type, "scope_id": scope_id, "confirmed": True, **extra})


# ======================================================================================================================================
# A. the identity source is the current Arx RBAC, read at each signed command
# ======================================================================================================================================

@pytest.mark.parametrize("change", ["revoke", "expire", "deny_at_building", "deny_at_installation", "binding_deleted"])
def test_the_same_person_is_refused_on_the_next_command_once_the_rbac_changed(aenv, change):
    e = aenv
    port = FakeDirectPort()
    who = e.principal("idsrc")
    bid = bind(e, who.user_id, "emergency_open", "building", "b1")
    o = Opener(e, port, who)
    assert o.open("st-a") == "acknowledged"
    assert len(port.sent("features/start")) == 1
    with e.db.connection() as conn:
        if change == "revoke":
            conn.execute("UPDATE bindings SET revoked_at = ? WHERE id = ?", (now_iso(), bid))
        elif change == "expire":
            conn.execute("UPDATE bindings SET expires_at = ? WHERE id = ?", (PAST, bid))
        elif change == "binding_deleted":
            conn.execute("DELETE FROM bindings WHERE id = ?", (bid,))
    if change == "deny_at_building":
        bind(e, who.user_id, "emergency_open", "building", "b1", effect="deny")
    elif change == "deny_at_installation":
        bind(e, who.user_id, "emergency_open", "installation", "*", effect="deny")
    assert o.open("st-a") == "refused", change
    assert len(port.sent("features/start")) == 1, "the refused command was never signed"


def test_the_signed_snapshot_names_only_what_the_current_rbac_grants_on_the_station(aenv):
    """The role is resolved, not carried: an `emergency_lock` holder at the building gets the lock words in the snapshot and never the open word; the
    open request of that person is refused before anything is signed."""
    e = aenv
    port = FakeDirectPort()
    locker = e.principal("locker")
    bind(e, locker.user_id, "emergency_lock", "building", "b1")
    with e.db.connection(mode="read") as conn:
        doc = fx.resolve_policy(conn, [locker], feature="emergency_buttons", targets=[("st-a", 1)])
    assert "door/emergency_open" not in doc.permissions and "door/emergency_secure" in doc.permissions
    assert Opener(e, port, locker).open("st-a") == "refused"
    assert port.sent("features/start") == []


# ======================================================================================================================================
# B. EMROLE on the signed emergency command (the rows the T06 note left open)
# ======================================================================================================================================

def test_a_guard_granted_by_a_security_manager_at_a_building_is_admitted_on_that_buildings_station_only(aenv):
    e = aenv
    port = FakeDirectPort()
    sam = e.principal("sam")
    guard = e.principal("guard")
    bind(e, sam.user_id, "security_manager", "building", "b1")
    r = grant(e, "sam", guard.user_id, "building", "b1", expires_at=hours(8))
    assert r.status_code == 201, r.text
    g = Opener(e, port, guard)
    assert g.open("st-a") == "acknowledged"
    assert g.open("st-b") == "refused", "the role was given at b1; st-b is in b2"
    (sent,) = port.sent("features/start")
    assert sent["request"]["actor"] == {"kind": "human", "user_id": guard.user_id}, "the command is attributed to the person whose rights were judged"
    assert [s["station_id"] for s in sent["policy_snapshot"]["stations"]] == ["st-a"]
    # the security manager's grant right is not an open right, and it does not reach another building
    assert Opener(e, port, sam).open("st-a") == "refused"
    r = grant(e, "sam", guard.user_id, "building", "b2", expires_at=hours(8))
    assert r.status_code == 403 and r.json()["code"] == "grant_not_allowed"
    assert len(port.sent("features/start")) == 1


def test_a_revoke_through_the_grant_module_stops_the_next_signed_command(aenv):
    e = aenv
    port = FakeDirectPort()
    sam = e.principal("sam2")
    guard = e.principal("guard2")
    bind(e, sam.user_id, "security_manager", "building", "b1")
    bid = grant(e, "sam2", guard.user_id, "building", "b1", expires_at=hours(4)).json()["grant"]["id"]
    g = Opener(e, port, guard)
    assert g.open("st-a") == "acknowledged"
    r = e.c.post(f"{API}/doors/emergency/grants/{bid}/revoke", headers=as_user("sam2"), json={"confirmed": True})
    assert r.status_code == 200, r.text
    assert g.open("st-a") == "refused"
    assert len(port.sent("features/start")) == 1


def test_an_emrole_grant_that_lapses_is_refused_at_use_time_without_a_sweeper(aenv):
    e = aenv
    port = FakeDirectPort()
    temp = e.principal("tempguard")
    assert grant(e, "joni", temp.user_id, "building", "b1", expires_at=hours(1)).status_code == 201
    g = Opener(e, port, temp)
    assert g.open("st-a") == "acknowledged"
    with e.db.connection() as conn:  # time passes: only the stored expiry moves, no job runs
        conn.execute("UPDATE bindings SET expires_at = ? WHERE subject_id = ? AND role_id = ?", (PAST, temp.user_id, deg.ROLE_ID))
    assert g.open("st-a") == "refused"
    assert len(port.sent("features/start")) == 1


def test_a_local_identity_holds_the_emergency_role_as_an_addition_only_with_an_expiry_and_only_on_its_scope(aenv):
    e = aenv
    port = FakeDirectPort()
    uid = "l_clerk0000a06"
    with e.db.connection() as conn:
        conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?, 'clerk', 'Clerk', 'local', 1, ?, ?)",
                     (uid, now_iso(), now_iso()))
    bind(e, uid, "operator", "installation", "*")  # its one ordinary role
    clerk = Principal(user_id=uid, username="clerk", display_name="Clerk", source="local")
    c = Opener(e, port, clerk)
    assert c.open("st-a") == "refused", "the ordinary role alone holds no emergency right"
    r = grant(e, "joni", uid, "building", "b1", no_expiry=True)
    assert r.status_code == 422 and r.json()["code"] == "expiry_required"
    assert grant(e, "joni", uid, "building", "b1", expires_at=hours(6)).status_code == 201
    assert c.open("st-a") == "acknowledged"
    assert c.open("st-b") == "refused"
    with e.db.connection() as conn:
        conn.execute("UPDATE bindings SET expires_at = ? WHERE subject_id = ? AND role_id = ?", (PAST, uid, deg.ROLE_ID))
    assert c.open("st-a") == "refused"
    assert len(port.sent("features/start")) == 1


# ======================================================================================================================================
# C. work states outside the feature client: never a done door, a committed write or a device proof
# ======================================================================================================================================

RID = "req-a06-1"


@pytest.mark.parametrize("word", NOT_DONE)
def test_a_door_answer_with_a_work_state_word_is_unknown_never_sent(word):
    for answer in ({"result": word, "request_id": RID}, {"service_response": {"result": word, "request_id": RID}},
                   {"result": "stored_result", "request_id": RID, "outcome": {"result": word}}):
        outcome, _ = trusted_door.classify(answer, RID)
        assert outcome == "unknown", (word, answer)


@pytest.mark.parametrize("answer", [
    {"status": {"active": True}, "request_id": RID},
    {"active": True, "request_id": RID},
    {"result": None, "status": {"active": True}, "request_id": RID},
    {"result": "stored_result", "request_id": RID, "outcome": {"status": {"active": True}}},
    {"result": "stored_result", "request_id": RID, "outcome": {"active": True}, "status": {"active": True}},
    {"service_response": {"status": {"active": True}, "request_id": RID}},
])
def test_a_static_active_status_on_a_door_answer_is_never_proof(answer):
    assert trusted_door.classify(answer, RID)[0] == "unknown"


def test_only_the_closed_acknowledgement_of_this_request_is_sent():
    assert trusted_door.classify({"result": "acknowledged", "request_id": RID}, RID) == ("sent", None)
    assert trusted_door.classify({"result": "stored_result", "request_id": RID, "outcome": {"result": "acknowledged"}}, RID) == ("sent", "stored_result")
    assert trusted_door.classify({"result": "acknowledged", "request_id": "another"}, RID)[0] == "unknown", "another request's answer"
    assert trusted_door.classify({"result": "acknowledged"}, RID)[0] == "unknown", "no request id"
    assert trusted_door.classify({"result": "rejected", "stage": "time", "code": "expired", "request_id": RID}, RID) == ("refused", "time/expired")


ORIGINAL7 = {"repository_id": "r", "verified_peer_ref": "p", "peer_binding_ref": "b", "peer_binding_revision": 1, "query_owner_id": "q",
             "descriptor_epoch": "e", "original": {"n": 1}}
RECEIPT = {"schema": nw.RECEIPT_FORMAT, **copy.deepcopy(ORIGINAL7), "source_epoch": "e", "create_origin_ref": "o", "capture_original": None,
           "user_id": "u-1", "person_revision": 1, "central_state": "committed", "device_application": "unknown", "signed_capture_covered": False}
KW = {"original7": ORIGINAL7, "command": "users/create", "target_ref": None, "revision_sent": None, "create_origin_ref": "o"}


def test_the_native_write_receipt_baseline_is_committed_with_an_unknown_device():
    assert nw.verify_receipt(dict(RECEIPT), **KW) == ("u-1", 1)


@pytest.mark.parametrize("word", NOT_DONE)
def test_a_native_write_receipt_in_a_work_state_is_not_a_committed_write(word):
    with pytest.raises(nw.ReceiptMismatch) as exc:
        nw.verify_receipt({**RECEIPT, "central_state": word}, **KW)
    assert exc.value.code == "receipt:state"


@pytest.mark.parametrize("word", NOT_DONE + ("applied", "delivered", "committed", "confirmed"))
def test_a_native_write_receipt_never_claims_a_device_application(word):
    with pytest.raises(nw.ReceiptMismatch) as exc:
        nw.verify_receipt({**RECEIPT, "device_application": word}, **KW)
    assert exc.value.code == "receipt:state"


@pytest.mark.parametrize("extra", [{"active": True}, {"status": {"active": True}}, {"accepted": True}, {"execution_result": "accepted"}])
def test_a_native_write_receipt_with_a_status_flag_is_refused_whole(extra):
    with pytest.raises(nw.ReceiptMismatch) as exc:
        nw.verify_receipt({**RECEIPT, **extra}, **KW)
    assert exc.value.code == "receipt:fields"


CSV_RECEIPT = {"id": "j", "kind": "import", "state": "completed", "revision": 2, "created_at": "x", "updated_at": "y", "approval": None,
               "total": 2, "saved": 1, "failed": 0, "pending": 1, "errors": [], "device_application": "unknown",
               "source_binding": {"schema": "wiskey-arx-native-row-receipt.v1", "rows": {
                   "1": {"user_id": "u1", "person_revision": 1, "source_line": 2, "origin_ref": "o1", "state": "central_committed"}}}}


@pytest.mark.parametrize("word", [w for w in NOT_DONE if w not in wpc.JOB_STATES])
def test_a_people_csv_receipt_with_a_job_state_outside_the_closed_set_is_unreadable(word):
    assert wpc.read_receipt({**CSV_RECEIPT, "state": word}) is None


@pytest.mark.parametrize("word", NOT_DONE + ("committed", "applied"))
def test_a_people_csv_row_counts_as_committed_only_when_wiskey_says_central_committed(word):
    r = copy.deepcopy(CSV_RECEIPT)
    r["source_binding"]["rows"]["2"] = {"user_id": "u2", "person_revision": 1, "source_line": 3, "origin_ref": "o2", "state": word}
    got = wpc.read_receipt(r)
    assert got is not None and got["central_committed_lines"] == [2], word
    assert got["device_application"] == "unknown"


def test_a_running_csv_job_is_reported_as_running_and_never_as_device_proof():
    got = wpc.read_receipt({**CSV_RECEIPT, "state": "running"})
    assert got is not None and got["job_state"] == "running" and got["device_application"] == "unknown"
    for flag in ({"active": True}, {"status": {"active": True}}):
        assert wpc.read_receipt({**CSV_RECEIPT, **flag}) is None
    assert wpc.read_receipt({**CSV_RECEIPT, "device_application": "applied"}) is None
