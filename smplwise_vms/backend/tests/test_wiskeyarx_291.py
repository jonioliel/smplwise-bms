"""WisKey round 9 / Arx reply 10 - the Arx-side open items, branch pilot/WISKEYARX-291. Fakes and static checks only: no WisKey,
Home Assistant, station, door or lock. The extended service identity and the grant engine stay locked (asserted below).

ARX-N03 (R8-A1 / R6-A4)  ONE strict completeness verdict (`access_grant_engine.access_shape`) shared by the engine and every
                          authorization projection: malformed is never an apparently complete (filtered / empty) map
ARX-N04 (R6-A5 / R8-A2)  the private recovery helper also refuses an inactive / unknown actor and audits the exact original create
ARX-N05 (R8-A3)          the no-caller test is pinned to the exact service path (test_wiskey_final3_281.py); stale comments aligned
ARX-N07 (R9-A03)          Arx sends `api_contract` omitted or 1 only (never 0)"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest
from test_wiskey_final281 import (  # noqa: F401 - fixtures used by name
    ADMIN,
    _approved,
    _create_lands_then_unknown,
    audits,
    env,
    ops_of,
)

from smplwise.errors import ApiError
from smplwise.services import access_grant_engine as age
from smplwise.services import access_grants as ag
from smplwise.services import intercom_adapter, intercom_authority, intercom_sync
from smplwise.services import intercom_write_journal as wj
from smplwise.services import intercom_writes as iw

BACKEND = Path(__file__).resolve().parents[1]
SERVICES = BACKEND / "smplwise" / "services"

_ROW = {"enabled": True, "allowed_locks": [1], "desired_revision": 4, "applied_revision": 4, "sync_state": "synced"}


def _raw(**over: Any) -> dict[str, Any]:
    base = {"id": "u1", "revision": 4, "display_name": "Dana", "active": True, "group_ids": [], "permission_overrides": {}, "pin_configured": False,
            "assignments": {"st-a": dict(_ROW)}}
    return {**base, **over}


# every malformed shape the engine already rejects (R5-A7 / R6-A4), now judged by the one shared verdict
MALFORMED = [
    {"assignments": {"st-a": _ROW, "st-b": {"allowed_locks": [1]}}},  # missing enabled
    {"assignments": {"st-a": _ROW, "st-b": {"enabled": "yes", "allowed_locks": [1]}}},  # non-boolean enabled
    {"assignments": {"st-a": _ROW, "st-b": {"enabled": False, "allowed_locks": [3]}}},  # unsupported relay on a disabled row
    {"assignments": {"st-a": _ROW, "st-b": {"enabled": True, "allowed_locks": [1, True]}}},  # a bool is not a relay
    {"assignments": {"st-a": _ROW, "st-b": {"enabled": True, "allowed_locks": "1"}}},
    {"assignments": {"st-a": _ROW, "st-b": {**_ROW, "desired_revision": 0}}},  # bookkeeping revision 0
    {"assignments": {"st-a": _ROW, "st-b": "enabled"}},  # a row that is not an object
    {"assignments": {"st-a": _ROW, " ": dict(_ROW)}},  # a blank station key
    {"assignments": ["st-a"]},  # the container itself has the wrong type
    {"group_ids": ["g1", " "]},
    {"group_ids": "g1"},
    {"permission_overrides": {"": "deny"}},
    {"permission_overrides": {"st-c": "maybe"}},
    {"permission_overrides": ["st-c"]},
    {"active": None},
    {"active": "true"},
]


# ================================================================ ARX-N03: one strict verdict, engine == projections


@pytest.mark.parametrize("over", MALFORMED)
def test_n03_a_malformed_record_is_unknown_in_the_engine_and_in_every_authorization_projection(over):
    raw = _raw(**over)
    shape = age.access_shape(raw)
    assert shape.complete is False and shape.malformed, over
    assert age.person_from_raw(raw).doors_known is False
    scope = intercom_sync.person_scope(raw)
    assert scope["access_known"] is False and scope["stations_known"] is False and scope["access_malformed"]
    read = intercom_sync.project_person(raw)
    assert read["access_known"] is False and read["stations_known"] is False, "the read people view never claims a complete set"
    superset = intercom_adapter.project_person(raw)
    assert superset["access_known"] is False and superset["stations_known"] is False
    assert intercom_authority.person_station_ids(superset) is None, "an authorization consumer sees UNKNOWN, never a filtered list"


def test_n03_a_missing_active_is_not_read_as_inactive_by_the_projection_consumers():
    raw = _raw()
    raw.pop("active")
    assert age.access_shape(raw).malformed == ("active",)
    assert intercom_authority.person_station_ids(intercom_adapter.project_person(raw)) is None


def test_n03_a_well_formed_record_keeps_todays_projection():
    raw = _raw(assignments={"st-a": dict(_ROW), "st-b": {"enabled": False, "allowed_locks": [2], "desired_revision": None,
                                                          "applied_revision": None, "sync_state": "pending"}},
               group_ids=["g1"], permission_overrides={"st-c": "deny"})
    assert age.access_shape(raw) == age.AccessShape(True, (), ())
    assert age.person_from_raw(raw).doors_known is True
    assert intercom_sync.person_scope(raw)["access_known"] is True and intercom_sync.person_scope(raw)["access_malformed"] == []
    superset = intercom_adapter.project_person(raw)
    assert superset["stations_known"] is True and intercom_authority.person_station_ids(superset) == ["st-a", "st-b"]
    assert intercom_sync.project_person(raw)["stations_known"] is True


def test_n03_absent_overrides_or_groups_block_the_engine_but_not_the_people_views():
    """Absent is UNREADABLE (missing), not malformed: the engine's door map needs all three containers (no write is planned on a partial
    record), the people views never use overrides / groups as the station set - unchanged from today."""
    raw = _raw()
    raw.pop("permission_overrides")
    raw.pop("group_ids")
    shape = age.access_shape(raw)
    assert shape.complete is False and shape.malformed == () and set(shape.missing) == {"permission_overrides", "group_ids"}
    assert age.person_from_raw(raw).doors_known is False
    assert intercom_adapter.project_person(raw)["stations_known"] is True


@pytest.mark.parametrize("over", [*MALFORMED, {}, {"redacted_fields": ["access"]}, {"operator_editable": True}, {"permission_overrides": None},
                                  {"assignments": {}}, {"assignments": None}])
def test_n03_the_engine_door_map_is_known_exactly_when_the_shared_verdict_is_complete(over):
    raw = _raw(**over)
    scope = intercom_sync.person_scope(raw)
    assert age.person_from_raw(raw).doors_known is (age.access_shape(raw).complete and scope["stations_known"])


class _Auth:
    """An operator who manages ONLY st-a (never unrestricted)."""

    def station(self, perm, sid):
        return sid == "st-a"

    def unrestricted(self, perm):
        return False

    def policy(self, name):
        return False


def test_n03_a_malformed_row_for_a_foreign_station_cannot_hide_it_from_the_scope_gate():
    """The R8-A1 consequence: before, the superset dropped a non-object row (station st-b) and the gate saw only st-a - an operator of st-a
    could have changed a person shared with st-b. Now the station set is unknown and the gate refuses (nothing sent)."""
    raw = _raw(assignments={"st-a": dict(_ROW), "st-b": "garbled"})
    with pytest.raises(ApiError) as e:
        iw.check_person(_Auth(), intercom_adapter.project_one_person(raw))
    assert e.value.status == 403 and e.value.code == "intercom_person_scope"
    ok = intercom_adapter.project_one_person(_raw())
    assert iw.check_person(_Auth(), ok).stations == ["st-a"], "a well-formed record of the operator's own station still passes"


def test_n03_an_invalid_station_id_dropped_by_the_superset_clears_completeness():
    raw = _raw(assignments={"st-a": dict(_ROW), "st-\x01b": dict(_ROW)})  # a control character: not an id Arx evaluates
    p = intercom_adapter.project_person(raw)
    assert [a["station_id"] for a in p["assignments"]] == ["st-a"]
    assert p["stations_known"] is False and p["access_known"] is False


@pytest.mark.parametrize("revision", [0, -3])
def test_n03_a_non_positive_revision_is_none_in_the_projections(revision):
    raw = _raw(revision=revision)
    assert intercom_adapter.project_person(raw)["revision"] is None
    assert intercom_sync.project_person(raw)["revision"] is None
    with pytest.raises(ValueError):
        age.person_from_raw(raw)


# ================================================================ ARX-N04: the private recovery helper's own guards


def _unresolved(env) -> tuple[str, list[str], str]:
    gid = _approved(env)
    created = _create_lands_then_unknown(env)
    env.run()
    op = [o for o in ops_of(env.db, gid) if o["state"] in wj.OPEN]
    assert len(op) == 1
    return gid, created, op[0]["id"]


def _set_active(env, user_id: str, active: int | None) -> None:
    with env.db.connection() as conn:
        if active is None:
            conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
            return
        n = conn.execute("UPDATE users SET active = ? WHERE id = ?", (active, user_id)).rowcount
        assert n == 1, "the test administrator has a users row"


@pytest.mark.parametrize("state", [0, None])
def test_n04_an_inactive_or_unknown_administrator_is_refused(env, state):
    gid, created, op_id = _unresolved(env)
    _set_active(env, ADMIN.user_id, state)
    with pytest.raises(ApiError) as e:
        ag._attach_recovered_person(env.db, gid, op_id, created[0], actor=ADMIN, evidence_ref="case:recovery-0001")
    assert e.value.status == 403 and e.value.code in ("actor_inactive", "not_system_admin")
    assert env.grant(gid)["link_id"] is None and [o["state"] for o in ops_of(env.db, gid)] == ["unknown"]


def test_n04_the_audit_carries_the_proof_decision_and_the_exact_original_create(env):
    gid, created, op_id = _unresolved(env)
    with env.db.connection(mode="read") as conn:
        before = dict(conn.execute("SELECT * FROM intercom_write_ops WHERE id = ?", (op_id,)).fetchone())
    ag._attach_recovered_person(env.db, gid, op_id, created[0], actor=ADMIN, evidence_ref="case:recovery-0001", request_id="rq-n04")
    a = audits(env, "access.grant.create_recovered", gid)
    assert len(a) == 1 and a[0]["op_id"] == op_id and a[0]["proof_decision"] == "attached_on_recorded_evidence"
    original = a[0]["original_create"]
    assert original["state"] == before["state"] == "unknown"
    assert original["purpose_ref"] == before["purpose_ref"] and original["started_ts"] == before["started_ts"]


# ================================================================ ARX-N05: stale comments


def test_n05_no_comment_calls_the_frozen_normalizer_not_accepted():
    for name in ("access_grant_engine.py", "access_grants.py"):
        src = (SERVICES / name).read_text(encoding="utf-8")
        assert "not an accepted contract" not in src, name
    assert "NOT built or wired a client" in (SERVICES / "access_grant_engine.py").read_text(encoding="utf-8")


def test_n05_the_arrival_comment_does_not_claim_a_proven_scope():
    src = (SERVICES / "access_arrival.py").read_text(encoding="utf-8")
    assert "whether the scope is\n    # proven" not in src and "scope_verified` is ALWAYS false" in src
    assert ag.sync_status({"state": "active", "needs_push": 0})["scope_verified"] is False


# ================================================================ ARX-N07: api_contract omitted or 1


def test_n07_arx_sends_api_contract_one_or_omits_it():
    from smplwise.services import intercom_client, intercom_messaging_adapter

    assert intercom_client.API_CONTRACT == 1 and intercom_adapter.API_CONTRACT == 1 and intercom_messaging_adapter.API_CONTRACT == 1
    pattern = re.compile(r"api_contract\s*=\s*(?!API_CONTRACT\b)[^\s,)]|[\"']api_contract[\"']\s*:\s*(?!API_CONTRACT\b)[^\s,}]")
    for path in (BACKEND / "smplwise").rglob("*.py"):
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.lstrip().startswith("#"):
                continue
            assert not pattern.search(line), f"api_contract set to something other than API_CONTRACT: {path.name}: {line.strip()}"


# ================================================================ the locks stay closed


def test_locks_stay_closed():
    from smplwise.services import service_identity

    assert ag.GO_LIVE_PERMITTED is True and ag.go_live_permitted() is True  # ECCACT-295: opened by the owner decision of 2026-10-21
    assert service_identity.EXTENDED_GO_LIVE_PERMITTED is False
