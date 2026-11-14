"""WisKey round 6 (Part A, R6-A2..R6-A5), branch pilot/WISKEYFINAL3-281. Fakes only: no WisKey, Home Assistant, station or door.

R6-A2 / ACR6-01  atomic durable admission (one write transaction checks and claims; two instances on one database)
R6-A4 / ACR6-03  the remaining malformed person-record shapes make the door map UNKNOWN (never dropped)
R6-A3 / ACR6-03  normal provisioning is `accepted`, never `verified`; the arrival reply carries the same five fields as present()
R6-A5 / ACR6-04  the create-recovery helper is private, admin-only, per-operation evidence, never a multi-op collapse
R6-A1 (remote-completion fence) is NOT in this round: WisKey designs that protocol next."""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

import pytest
from test_wiskey_final281 import (  # noqa: F401 - fixtures used by name
    ADMIN,
    _approved,
    _create_lands_then_unknown,
    _raw,
    _rows,
    _view,
    arr,
    audits,
    env,
    jdb,
    make_sync,
    ops_of,
)

from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.rbac import Principal
from smplwise.services import access_grant_engine as age
from smplwise.services import access_grants as ag
from smplwise.services import intercom_sync
from smplwise.services import intercom_write_journal as wj

BACKEND = Path(__file__).resolve().parents[1]


# ================================================================ R6-A2: atomic admission


def _legacy_admit(journal: wj.WriteJournal, target: str, between) -> str | None:
    """The round-5 shape (check on one connection, insert on another) - kept here ONLY to show the race the new admission closes."""
    blocked = journal.blocking(target)
    if blocked is not None:
        return blocked
    between()
    journal.begin(target, "person", "config")
    return None


def _race(fn_a, fn_b) -> list[Any]:
    out: list[Any] = [None, None]
    errors: list[BaseException] = []

    def run(i, fn):
        try:
            out[i] = fn()
        except BaseException as exc:  # noqa: BLE001 - surfaced below
            errors.append(exc)

    threads = [threading.Thread(target=run, args=(0, fn_a)), threading.Thread(target=run, args=(1, fn_b))]
    for t in threads:
        t.start()
    for t in threads:
        t.join(30)
    assert not errors, errors
    return out


def _barrier_hook(barrier: threading.Barrier):
    def hook():
        try:
            barrier.wait()  # both instances meet between their check and their insert - if both can get there
        except threading.BrokenBarrierError:
            pass  # the other instance never reached its check: it is waiting for this transaction's write lock
    return hook


def test_r6_a2_the_split_check_then_insert_admits_two_writes_under_a_barrier(settings, jdb):
    """The counterexample, deterministically: two instances, one database, a barrier between check and insert -> both admitted."""
    other = Database(settings.db_path)  # a second process's own Database object on the same file
    a = wj.WriteJournal(jdb, boot_id="boot-A")
    b = wj.WriteJournal(other, boot_id="boot-B")
    target = intercom_sync.person_target("race-legacy")
    barrier = threading.Barrier(2, timeout=5)
    out = _race(lambda: _legacy_admit(a, target, _barrier_hook(barrier)), lambda: _legacy_admit(b, target, _barrier_hook(barrier)))
    assert out == [None, None] and len(_rows(jdb, target)) == 2, "the old shape lets both through"


def test_r6_a2_one_transaction_admits_exactly_one_of_two_instances(settings, jdb):
    other = Database(settings.db_path)
    a = wj.WriteJournal(jdb, boot_id="boot-A")
    b = wj.WriteJournal(other, boot_id="boot-B")
    target = intercom_sync.person_target("race-atomic")
    barrier = threading.Barrier(2, timeout=1.5)
    out = _race(lambda: a.admit(target, "person", "config", _between=_barrier_hook(barrier)),
                lambda: b.admit(target, "person", "config", _between=_barrier_hook(barrier)))
    admitted = [o for o in out if o[0] is None]
    refused = [o for o in out if o[0] is not None]
    assert len(admitted) == 1 and admitted[0][1], out
    assert len(refused) == 1 and refused[0] == ("outcome_pending", None), "the loser is refused, not sent, nothing recorded"
    rows = _rows(jdb, target)
    assert len(rows) == 1 and rows[0]["state"] == "dispatched" and rows[0]["id"] == admitted[0][1]


def test_r6_a2_two_sync_instances_on_one_database_send_exactly_one_write(make_sync, jdb):
    a, b = make_sync("boot-A"), make_sync("boot-B")
    target = intercom_sync.person_target("race-sync")
    barrier = threading.Barrier(2, timeout=1.5)
    for s in (a, b):
        admit = s.journal.admit
        s.journal.admit = lambda t, k, l, _admit=admit: _admit(t, k, l, _between=_barrier_hook(barrier))
    sent: list[str] = []
    done = {"A": threading.Event(), "B": threading.Event()}

    def writer(name):
        peer = "B" if name == "A" else "A"

        async def send(_call):
            sent.append(name)
            done[peer].wait(5)  # the admitted write stays OUT on the wire until the other instance has decided
            return {"id": "race-sync", "revision": 2}

        def go():
            s = a if name == "A" else b
            try:
                s.action(None, "person", send, lambda raw: raw, "w", lane="config", target=target, free=True)
                return "sent"
            except ApiError as exc:
                return (exc.code, exc.details.get("outcome"))
            finally:
                done[name].set()
        return go

    out = _race(writer("A"), writer("B"))
    assert sorted(map(str, out)) == sorted(["sent", str(("intercom_outcome_pending", "not_sent"))]), out
    assert len(sent) == 1, "exactly one instance sent a frame"
    assert [r["state"] for r in _rows(jdb, target)] == ["ok"], "the refused instance left no row behind"


def test_r6_a2_an_unresolved_row_refuses_with_no_side_effect(jdb):
    target = intercom_sync.person_target("held")
    now = [2_000_000.0]
    dead = wj.WriteJournal(jdb, boot_id="boot-dead", clock=lambda: now[0])
    op = dead.begin(target, "person", "config")
    dead.finish(op, "unknown")  # over, outcome unknown: a fresh readback is required
    live = wj.WriteJournal(jdb, boot_id="boot-live", clock=lambda: now[0] + 1)
    before = _rows(jdb, target)
    assert live.admit(target, "person", "config") == ("readback_required", None)
    assert _rows(jdb, target) == before, "nothing inserted, nothing changed"


def test_r6_a2_the_product_path_no_longer_uses_the_split_shape():
    src = (BACKEND / "smplwise" / "services" / "intercom_sync.py").read_text(encoding="utf-8")
    body = src.split("def _journal_admit", 1)[1].split("\n    def ", 1)[0]
    assert "journal.admit(" in body and ".blocking(" not in body and ".begin(" not in body


# ================================================================ R6-A4: malformed shapes -> UNKNOWN


_OK_ROW = {"enabled": True, "allowed_locks": [1], "desired_revision": 4, "applied_revision": 4, "sync_state": "synced"}


@pytest.mark.parametrize("assignments", [
    {"st-a": {"allowed_locks": [1], "desired_revision": 4, "applied_revision": 4, "sync_state": "synced"}},  # missing enabled
    {"st-a": _OK_ROW, "st-b": {"allowed_locks": [1]}},  # missing enabled next to a valid row: the map may not shrink
    {"st-a": _OK_ROW, "st-b": {"enabled": False, "allowed_locks": "1"}},  # disabled, malformed lock list
    {"st-a": _OK_ROW, "st-b": {"enabled": False, "allowed_locks": [1, True]}},
    {"st-a": _OK_ROW, "st-b": {"enabled": False}},  # disabled, no lock list
    {"st-a": {**_OK_ROW, "allowed_locks": [0]}},  # relay 0
    {"st-a": {**_OK_ROW, "allowed_locks": [3]}},  # relay 3
    {"st-a": _OK_ROW, "st-b": {"enabled": False, "allowed_locks": [3]}},  # an unsupported relay on a disabled row
    {"st-a": {**_OK_ROW, "desired_revision": 0}},  # bookkeeping revision 0
    {"st-a": {**_OK_ROW, "applied_revision": -1}},  # bookkeeping revision -1
    {"st-a": _OK_ROW, "st-b": {"enabled": False, "allowed_locks": [1], "desired_revision": 0}},
    {"st-a": _OK_ROW, " ": {"enabled": True, "allowed_locks": [1]}},  # a blank station id
])
def test_r6_a4_a_malformed_assignment_makes_the_map_unknown(assignments):
    p = age.person_from_raw(_raw(assignments=assignments))
    assert p.doors_known is False and p.doors == {} and p.stations_synced is None and p.overrides_known is False


@pytest.mark.parametrize("over", [
    {"group_ids": [""]}, {"group_ids": ["g1", "  "]},  # blank group ids
    {"permission_overrides": {"": "deny"}}, {"permission_overrides": {"  ": "allow"}},  # blank override keys
])
def test_r6_a4_blank_group_or_override_identifiers_make_the_map_unknown(over):
    assert age.person_from_raw(_raw(**over)).doors_known is False


@pytest.mark.parametrize("active", ["missing", None, "true", 1, 0])
def test_r6_a4_a_missing_or_non_boolean_active_is_unknown_never_inactive(active):
    raw = _raw(assignments={}, group_ids=[], permission_overrides={}, pin_configured=False)
    if active == "missing":
        raw.pop("active")
    else:
        raw["active"] = active
    p = age.person_from_raw(raw)
    assert p.doors_known is False and p.overrides_known is False
    assert ag.Worker._revoked(p) is False, "an otherwise empty record without a readable `active` is never revoke proof"


@pytest.mark.parametrize("revision", [0, -1])
def test_r6_a4_a_non_positive_record_revision_is_not_a_person(revision):
    with pytest.raises(ValueError):
        age.person_from_raw(_raw(revision=revision))


def test_r6_a4_valid_shapes_stay_known():
    pending = {"enabled": True, "allowed_locks": [1, 2], "desired_revision": 4, "applied_revision": None, "sync_state": "pending"}
    off = {"enabled": False, "allowed_locks": [2], "desired_revision": 3, "applied_revision": 3, "sync_state": "synced"}
    p = age.person_from_raw(_raw(assignments={"st-a": pending, "st-b": off}, group_ids=["g1"], permission_overrides={"st-c": "deny"}))
    # STATIONSYNC-295 / R11-I2-01: a well-formed enabled row with applied_revision null ("not applied yet") is explicitly behind -> False
    assert p.doors_known is True and p.doors == {"st-a": [1, 2]} and p.stations_synced is False
    revoked = age.person_from_raw(_raw(active=False, assignments={}, group_ids=[], permission_overrides={}, pin_configured=False))
    assert revoked.doors_known is True and ag.Worker._revoked(revoked) is True, "a well-formed empty inactive record still proves the strip"


# ================================================================ R6-A3: accepted, not verified; the arrival reply's shape


@pytest.mark.parametrize("row, want", [
    ({"state": "active", "needs_push": 0}, (False, False, False, "accepted")),  # normal provisioning AND a legacy active row
    ({"state": "active", "needs_push": 1}, (True, True, False, "desired")),
    ({"state": "approved", "needs_push": 0}, (False, True, False, "desired")),
    ({"state": "unknown", "needs_push": 0}, (False, True, False, "desired")),
])
def test_r6_a3_no_row_is_presented_as_verified_without_a_recorded_proof(row, want):
    s = ag.sync_status(row)
    assert (s["needs_push"], s["pending_sync"], s["scope_verified"], s["doors_state"]) == want


def test_r6_a3_a_provisioned_grant_is_accepted_not_verified(env, monkeypatch):
    """SHAREDID-293 (owner decision 2, supersedes the R6-A3 "never verified" choice): the provisioning write's answer is no proof -
    accepted; only a stored fresh read-back proof (the verify pass) makes it verified."""
    from smplwise.services import access_external as ax

    real_verify = ax.verify_pass
    monkeypatch.setattr(ax, "verify_pass", lambda db: 0)
    gid = env.active_grant(doors={"st-a": [1]})
    v = _view(env, gid)
    assert v["grant_state"] == "active" and v["scope_verified"] is False and v["doors_state"] == "accepted"
    assert "verified_central" not in json.dumps(v)
    monkeypatch.setattr(ax, "verify_pass", real_verify)
    env.run()
    v = _view(env, gid)
    assert v["scope_verified"] is True and v["doors_state"] == "verified_central"


def test_r6_a3_the_arrival_reply_carries_the_same_five_fields_as_present(arr):
    from test_wiskey_final280 import _live_grant

    _live_grant(arr, assignment_id=None, source_ref=arr.ticket_id, source_kind="ticket")
    r = arr.post()
    assert r.status_code == 200, r.text
    body = r.json()
    assert {"grant_state", "needs_push", "pending_sync", "scope_verified", "doors_state"} <= set(body)
    assert isinstance(body["needs_push"], bool)
    assert (body["pending_sync"], body["scope_verified"], body["doors_state"]) == (True, False, "desired")


# ================================================================ R6-A5: the private recovery helper


def _unresolved(env) -> tuple[str, list[str], str]:
    gid = _approved(env)
    created = _create_lands_then_unknown(env)
    env.run()
    op = [o for o in ops_of(env.db, gid) if o["state"] in wj.OPEN]
    assert len(op) == 1
    return gid, created, op[0]["id"]


SERVICE = BACKEND / "smplwise" / "services" / "access_grants.py"


def test_r6_a5_the_helper_is_private_and_has_no_route():
    """SHAREDID-293 (owner decision 7, 2026-10-20): the reviewed caller now exists - ONE service function, access_external.attach_recovered
    (system administrators, interactive, every refusal audited), behind POST /access-grants/{id}/attach-recovered. No other caller.
    R8-A3 (ARX-N05) kept: only the EXACT defining service path is exempt (the same-named router is inspected like any other file), and
    inside the service the name appears only at its definition."""
    assert not hasattr(ag, "attach_recovered_person"), "no public name"
    assert Path(ag.__file__).resolve() == SERVICE.resolve()
    callers = []
    for path in (BACKEND / "smplwise").rglob("*.py"):
        if path.resolve() == SERVICE.resolve():
            continue
        if "_attach_recovered_person" in path.read_text(encoding="utf-8"):
            callers.append(f"{path.parent.name}/{path.name}")
    assert callers == ["services/access_external.py"], f"the one reviewed caller only: {callers}"
    router = BACKEND / "smplwise" / "routers" / "access_grants.py"
    assert router.is_file() and "_attach_recovered_person" not in router.read_text(encoding="utf-8"), "the same-named router is inspected"
    src = SERVICE.read_text(encoding="utf-8")
    assert src.count("_attach_recovered_person(") == 1 and "def _attach_recovered_person(" in src, "the service defines it and never calls it"


@pytest.mark.parametrize("actor", [None, "system", Principal("nobody", "nobody", "nobody", "ha")])
def test_r6_a5_only_a_system_administrator_may_attach(env, actor):
    gid, created, op_id = _unresolved(env)
    with pytest.raises(ApiError) as e:
        ag._attach_recovered_person(env.db, gid, op_id, created[0], actor=actor, evidence_ref="case:recovery-0001")
    assert e.value.status == 403 and e.value.code == "not_system_admin"
    assert env.grant(gid)["link_id"] is None and [o["state"] for o in ops_of(env.db, gid)] == ["unknown"]


@pytest.mark.parametrize("evidence", ["", "short", None, "x" * 200, "bad ref with spaces"])
def test_r6_a5_a_per_operation_evidence_reference_is_required(env, evidence):
    gid, created, op_id = _unresolved(env)
    with pytest.raises(ApiError) as e:
        ag._attach_recovered_person(env.db, gid, op_id, created[0], actor=ADMIN, evidence_ref=evidence)
    assert e.value.status == 422 and env.grant(gid)["link_id"] is None


def test_r6_a5_the_operation_must_be_this_grants_unresolved_create(env):
    gid, created, _op_id = _unresolved(env)
    with pytest.raises(ApiError) as e:
        ag._attach_recovered_person(env.db, gid, "0" * 32, created[0], actor=ADMIN, evidence_ref="case:recovery-0001")
    assert e.value.code == "access_create_not_unresolved" and env.grant(gid)["link_id"] is None


def test_r6_a5_several_unresolved_creates_are_never_collapsed_onto_one_person(env):
    gid, created, op_id = _unresolved(env)
    with env.db.connection() as conn:  # a second lost create of the same grant (e.g. an older build's retry)
        second = wj.create_intent(conn, gid, "contact", "c-x", "ticket:x")
        wj.create_dispatched(conn, second)
        wj.create_finished(conn, second, "unknown")
    for which in (op_id, second):
        with pytest.raises(ApiError) as e:
            ag._attach_recovered_person(env.db, gid, which, created[0], actor=ADMIN, evidence_ref="case:recovery-0001")
        assert e.value.code == "access_create_ambiguous"
    assert sorted(o["state"] for o in ops_of(env.db, gid)) == ["unknown", "unknown"] and env.grant(gid)["link_id"] is None


def test_r6_a5_an_attach_reconciles_exactly_that_operation_and_audits_the_evidence(env):
    gid, created, op_id = _unresolved(env)
    link = ag._attach_recovered_person(env.db, gid, op_id, created[0], actor=ADMIN, evidence_ref="case:recovery-0001", request_id="rq-1")
    assert link["wiskey_person_id"] == created[0] and link["origin"] == "created_from_arx"
    ops = ops_of(env.db, gid)
    assert [(o["id"], o["state"], o["result_ref"]) for o in ops] == [(op_id, "reconciled", created[0])]
    a = audits(env, "access.grant.create_recovered", gid)
    assert len(a) == 1 and a[0]["op_id"] == op_id and a[0]["evidence_ref"] == "case:recovery-0001"


def test_r6_a5_no_comment_promises_access_state_as_a_recovery_feed():
    src = (BACKEND / "smplwise" / "services" / "access_grants.py").read_text(encoding="utf-8")
    assert "users/access_state - ACR5-01, NOT built). Allowed only" not in src
    assert "carries no purpose" in src
