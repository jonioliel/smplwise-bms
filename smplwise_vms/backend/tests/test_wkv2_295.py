"""WKV2-295 (FAKES ONLY): the ONE strict Arx consumer of WisKey's access_state readback, v1 + v2 (round-12 audit F-01 / F-02).

Fixtures: tests/fixtures/wiskey_access_state_v2/*.json, synthetic, hand-derived from the WisKey delivery (see PROVENANCE.txt there).
Nothing here contacts WisKey, Home Assistant, a station or a door; GO_LIVE stays False and no switch is turned on in a settings table."""
from __future__ import annotations

import copy
import json
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import access_grant_engine as age
from smplwise.services import access_grants as ag
from smplwise.services import wiskey_access_state as was
from smplwise.services import wiskey_acr5 as a5
from smplwise.services.access_grant_engine import WiskeyServiceEngine

FIX = Path(__file__).resolve().parent / "fixtures" / "wiskey_access_state_v2"
PKG = Path(__file__).resolve().parents[1] / "smplwise"
PERSON = "person-a"
REV = 4


def fx(name: str) -> dict[str, Any]:
    return json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))


def frame(result: dict[str, Any]) -> dict[str, Any]:
    return {"id": 7, "type": "result", "success": True, "result": result}


def v1(**over: Any) -> dict[str, Any]:
    raw = {k: v for k, v in fx("present_empty_bookkeeping").items() if k not in ("central_revocation_predicate", "central_revoked")}
    raw["schema_version"] = 1
    raw.update(over)
    return raw


ALL_FIXTURES = sorted(p.stem for p in FIX.glob("*.json"))


# ================================================================ every delivery-derived fixture parses, closed and consistent


def test_the_fixture_set_is_complete_and_synthetic():
    assert len(ALL_FIXTURES) == 10
    for name in ALL_FIXTURES:
        text = (FIX / f"{name}.json").read_text(encoding="utf-8")
        assert "person-a" in text and "NEVER_EXPORT" not in text and "pin\": \"" not in text, name


@pytest.mark.parametrize("name", ALL_FIXTURES)
def test_every_fixture_parses_as_v2(name):
    st = was.parse_result(fx(name), user_id=PERSON, revision=REV, expect=2)
    assert st.schema_version == 2 and st.central_revocation_predicate == was.CENTRAL_REVOCATION_PREDICATE
    assert set(st.pending.as_dict()) == set(was.QUEUES)
    with pytest.raises(TypeError):
        bool(st.pending)  # never collapsed into one boolean


@pytest.mark.parametrize("name,presence,pending,central,synced,unverified", [
    ("present_empty_bookkeeping", "present", False, True, None, ()),
    ("present_revoked_pin_pending", "present", True, True, None, ()),
    ("present_disabled_row_unapplied", "present", True, True, None, ("station-a",)),
    ("present_enabled_row_synced", "present", False, False, True, ()),
    ("present_active_no_rows", "present", False, False, None, ()),
    ("absent", "absent", None, None, None, ()),
    ("delete_pending", "delete_pending", True, None, None, ()),
    ("present_revoked_disabled_row_applied", "present", False, True, None, ()),
])
def test_parsed_fields_are_kept_apart(name, presence, pending, central, synced, unverified):
    st = was.parse_result(fx(name), user_id=PERSON, revision=REV)
    assert (st.presence, st.revocation_pending, st.central_revoked, st.stations_synced, st.pending.unverified) == (
        presence, pending, central, synced, unverified)


# ================================================================ the verdict table (F-01 + F-02)

A = frozenset({"station-a"})
AB = frozenset({"station-a", "station-b"})


@pytest.mark.parametrize("name,last_known,expected", [
    # F-02: entirely empty bookkeeping is NEVER clean, whatever Arx knows
    ("present_empty_bookkeeping", A, None),
    ("present_empty_bookkeeping", frozenset(), None),
    ("present_empty_bookkeeping", None, None),
    # positive per-station evidence for every last-known station
    ("present_revoked_disabled_row_applied", A, False),
    ("present_revoked_disabled_row_applied", frozenset(), False),
    ("present_revoked_disabled_row_applied", AB, None),  # station-b known to Arx, missing from the answer: not verified
    ("present_revoked_disabled_row_applied", None, None),  # no last-known record: not verified
    ("present_revoked_two_disabled_rows_applied", AB, False),
    # tracked work is owed
    ("present_revoked_pin_pending", A, True),
    ("present_disabled_row_unapplied", A, True),
    ("present_disabled_row_behind", A, True),
    ("delete_pending", A, True),
    # central access remains / absence: never clean
    ("present_enabled_row_synced", A, None),
    ("present_active_no_rows", A, None),
    ("absent", A, None),
    ("absent", None, None),
])
def test_v2_verdict(name, last_known, expected):
    st = was.parse_result(fx(name), user_id=PERSON, revision=REV)
    assert was.revocation_verdict_v2(st, person_id=PERSON, revision=REV, last_known_stations=last_known) is expected


def test_the_verdict_refuses_another_person_another_revision_and_v1():
    st = was.parse_result(fx("present_revoked_disabled_row_applied"), user_id=PERSON)
    assert was.revocation_verdict_v2(st, person_id="person-b", revision=REV, last_known_stations=A) is None
    for rev in (3, 5, True, 0, "4", None):
        assert was.revocation_verdict_v2(st, person_id=PERSON, revision=rev, last_known_stations=A) is None, rev
    old = was.parse_result(v1(), user_id=PERSON)
    assert was.revocation_verdict_v2(old, person_id=PERSON, revision=REV, last_known_stations=A) is None, "v1 is no alternate proof"
    assert was.revocation_verdict_v2(was.AccessStateError("malformed"), person_id=PERSON, revision=REV, last_known_stations=A) is None


def test_an_unproven_or_enabled_row_for_a_known_station_is_not_verified():
    raw = fx("present_revoked_two_disabled_rows_applied")
    raw["assignments"][1].update(applied=None, applied_revision=None)
    raw["pending"]["unverified"] = ["station-b"]
    raw["revocation_pending"] = None
    st = was.parse_result(raw, user_id=PERSON, revision=REV)
    assert was.revocation_verdict_v2(st, person_id=PERSON, revision=REV, last_known_stations=frozenset({"station-a"})) is None


# ================================================================ malformed / edge cases: every one is a typed refusal


def _mut(path: tuple, value: Any, base: str = "present_revoked_disabled_row_applied") -> dict[str, Any]:
    raw = copy.deepcopy(fx(base))
    target = raw
    for key in path[:-1]:
        target = target[key]
    if value is DELETE:
        del target[path[-1]]
    else:
        target[path[-1]] = value
    return raw


DELETE = object()

MALFORMED = [
    # version dispatch
    (("schema_version",), 3, "unsupported_schema"), (("schema_version",), 0, "unsupported_schema"),
    (("schema_version",), True, "unsupported_schema"), (("schema_version",), "2", "unsupported_schema"),
    (("schema_version",), 2.0, "unsupported_schema"), (("schema_version",), None, "unsupported_schema"),
    (("schema_version",), DELETE, "unsupported_schema"),
    # closed schema
    (("device_confirmed",), True, "unknown_field"), (("assignments", 0, "last_sync_at"), "2026-10-20T09:00:00+00:00", "unknown_field"),
    (("pending", "extra"), [], "unknown_field"),
    (("central_revoked",), DELETE, "missing_field"), (("central_revocation_predicate",), DELETE, "missing_field"),
    (("pending",), DELETE, "missing_field"), (("pending", "unverified"), DELETE, "missing_field"),
    (("assignments", 0, "applied"), DELETE, "missing_field"),
    # identity / observation
    (("observation",), "cache", "unsupported_observation"), (("scope",), "caller", "unsupported_observation"),
    (("central_revocation_predicate",), "something-else-v2", "unsupported_observation"),
    (("user_id",), "person-b", "user_mismatch"), (("user_id",), "person-a ", "user_mismatch"), (("user_id",), None, "user_mismatch"),
    # revision: strict positive non-bool int, bounded, equal to the fresh users/get revision
    (("person_revision",), 5, "revision_conflict"), (("person_revision",), 3, "revision_conflict"),
    (("person_revision",), True, "malformed"), (("person_revision",), 0, "malformed"), (("person_revision",), -1, "malformed"),
    (("person_revision",), "4", "malformed"), (("person_revision",), 4.0, "malformed"), (("person_revision",), None, "malformed"),
    (("person_revision",), 2 ** 53, "malformed"),
    # types
    (("presence",), "gone", "malformed"), (("revocation_pending",), 0, "malformed"), (("revocation_pending",), "false", "malformed"),
    (("stations_synced",), 1, "malformed"), (("central_revoked",), "true", "malformed"), (("central_revoked",), None, "malformed"),
    (("assignments",), {}, "malformed"), (("pending",), [], "malformed"), (("timing_policy",), [], "malformed"),
    (("pending", "cards"), "station-a", "malformed"), (("pending", "cards"), [7], "malformed"), (("pending", "cards"), [""], "malformed"),
    (("pending", "cards"), ["  "], "malformed"), (("pending", "cards"), ["st\u0000a"], "malformed"), (("pending", "cards"), ["st\u007fa"], "malformed"),
    (("pending", "cards"), ["x" * 129], "malformed"),
    (("assignments", 0, "enabled"), "no", "malformed"), (("assignments", 0, "allowed_locks"), [3], "malformed"),
    (("assignments", 0, "allowed_locks"), [1, 1], "malformed"), (("assignments", 0, "allowed_locks"), [2, 1], "malformed"),
    (("assignments", 0, "allowed_locks"), [True], "malformed"), (("assignments", 0, "desired_revision"), 0, "malformed"),
    (("assignments", 0, "applied_revision"), True, "malformed"), (("assignments", 0, "sync_state"), "done", "malformed"),
    (("assignments", 0, "applied"), 1, "malformed"), (("assignments", 0, "station_id"), "", "malformed"),
    # internal consistency (WisKey's projection rules)
    (("revocation_pending",), None, "inconsistent"), (("revocation_pending",), True, "inconsistent"),
    (("pending", "pins"), ["station-a"], "inconsistent"),  # owed work but revocation_pending false
    (("pending", "unverified"), ["station-z"], "inconsistent"),  # unverified only must read null, not false
    (("stations_synced",), True, "inconsistent"), (("stations_synced",), False, "inconsistent"),
    (("assignments", 0, "enabled"), True, "inconsistent"),  # central_revoked true beside an enabled row
    (("assignments", 0, "applied_revision"), 3, "inconsistent"),  # applied true but bookkeeping behind
    (("assignments", 0, "desired_revision"), 3, "inconsistent"),  # applied true for an older revision
    (("assignments", 0, "sync_state"), "pending", "inconsistent"),
    (("assignments", 0, "applied"), False, "inconsistent"),  # false but not in operations
    (("assignments", 0, "applied"), None, "inconsistent"),  # unknown but not in unverified
]


@pytest.mark.parametrize("path,value,code", MALFORMED, ids=[f"{'.'.join(map(str, p))}={v!r}"[:60] for p, v, _ in MALFORMED])
def test_malformed_v2_is_a_typed_refusal(path, value, code):
    with pytest.raises(was.AccessStateError) as err:
        was.parse_result(_mut(path, value), user_id=PERSON, revision=REV)
    assert err.value.code == code
    assert isinstance(err.value, ValueError)


@pytest.mark.parametrize("base,path,value,code", [
    ("absent", ("central_revoked",), True, "inconsistent"), ("absent", ("central_revoked",), False, "inconsistent"),
    ("absent", ("revocation_pending",), False, "inconsistent"), ("absent", ("person_revision",), 4, "malformed"),
    ("absent", ("assignments",), [{"station_id": "station-a", "enabled": False, "allowed_locks": [], "desired_revision": None,
                                   "applied_revision": None, "sync_state": None, "applied": None}], "inconsistent"),
    ("absent", ("timing_policy",), {"mode": "ha", "bindings": {}, "schedule": {"mode": "weekly", "timezone": "UTC", "days": ["Monday"],
                                                                               "dates": [], "periods": [{"start": "08:00", "end": "17:00"}]}},
     "inconsistent"),
    ("absent", ("stations_synced",), False, "inconsistent"),
    ("delete_pending", ("revocation_pending",), None, "inconsistent"), ("delete_pending", ("central_revoked",), True, "inconsistent"),
    ("present_enabled_row_synced", ("assignments", 0, "allowed_locks"), [], "inconsistent"),
    ("present_enabled_row_synced", ("stations_synced",), None, "inconsistent"),
    ("present_disabled_row_unapplied", ("pending", "unverified"), [], "inconsistent"),
    ("present_disabled_row_behind", ("pending", "operations"), [], "inconsistent"),
])
def test_malformed_v2_variants(base, path, value, code):
    with pytest.raises(was.AccessStateError) as err:
        was.parse_result(_mut(path, value, base), user_id=PERSON, revision=REV)
    assert err.value.code == code


def test_non_objects_and_bounds():
    for raw in (None, [], "ok", 1, True):
        with pytest.raises(was.AccessStateError):
            was.parse_result(raw, user_id=PERSON)
    big = fx("present_revoked_pin_pending")
    big["pending"]["pins"] = [f"s{i}" for i in range(was.MAX_QUEUE + 1)]
    with pytest.raises(was.AccessStateError) as err:
        was.parse_result(big, user_id=PERSON, revision=REV)
    assert err.value.code == "oversize"
    many = fx("present_revoked_disabled_row_applied")
    row = many["assignments"][0]
    many["assignments"] = [{**row, "station_id": f"s{i}"} for i in range(was.MAX_ROWS + 1)]
    with pytest.raises(was.AccessStateError) as err:
        was.parse_result(many, user_id=PERSON, revision=REV)
    assert err.value.code == "oversize"
    top = fx("present_revoked_disabled_row_applied")
    top["person_revision"] = top["assignments"][0]["desired_revision"] = top["assignments"][0]["applied_revision"] = was.MAX_REVISION
    assert was.parse_result(top, user_id=PERSON, revision=was.MAX_REVISION).person_revision == was.MAX_REVISION


def test_duplicate_rows_are_refused():
    raw = fx("present_revoked_disabled_row_applied")
    raw["assignments"].append(dict(raw["assignments"][0]))
    with pytest.raises(was.AccessStateError):
        was.parse_result(raw, user_id=PERSON, revision=REV)


# ================================================================ version dispatch and envelope


def test_no_fallback_between_versions():
    with pytest.raises(was.AccessStateError) as err:
        was.parse_result(v1(), user_id=PERSON, expect=2)
    assert err.value.code == "schema_mismatch"
    with pytest.raises(was.AccessStateError) as err:
        was.parse_result(fx("present_empty_bookkeeping"), user_id=PERSON, expect=1)
    assert err.value.code == "schema_mismatch"
    # a v2-labelled answer with only the v1 fields is refused, never read as v1
    with pytest.raises(was.AccessStateError) as err:
        was.parse_result(v1(schema_version=2), user_id=PERSON)
    assert err.value.code == "missing_field"


def test_v1_still_accepts_additive_fields_and_ignores_them():
    st = was.parse_result(v1(device_confirmed=True, central_revoked=True), user_id=PERSON)
    assert st.schema_version == 1 and st.central_revoked is None and not hasattr(st, "device_confirmed")


@pytest.mark.parametrize("bad,code", [
    (None, "malformed_envelope"), ({"type": "event"}, "malformed_envelope"), ({"type": "result", "id": True, "success": True}, "malformed_envelope"),
    ({"type": "result", "id": 1, "success": True, "result": []}, "malformed_envelope"),
    ({"type": "result", "id": 1, "success": "yes", "result": {}}, "malformed_envelope"),
    ({"type": "result", "id": 1, "success": False, "error": {"code": "readback_unavailable"}}, "readback_unavailable"),
    ({"type": "result", "id": 1, "success": False, "error": {"code": "feature_disabled"}}, "feature_disabled"),
    ({"type": "result", "id": 1, "success": False, "error": {"code": "unauthorized"}}, "unauthorized"),
    ({"type": "result", "id": 1, "success": False, "error": {"code": "revision_conflict"}}, "revision_conflict"),
    ({"type": "result", "id": 1, "success": False, "error": {"code": "x\u0000"}}, "error"),
    ({"type": "result", "id": 1, "success": False, "error": "boom"}, "error"),
])
def test_envelope_failures_are_typed(bad, code):
    with pytest.raises(was.AccessStateError) as err:
        was.parse_frame(bad, user_id=PERSON, revision=REV)
    assert err.value.code == code


# ================================================================ both former callers go through the single parser


def test_both_callers_use_the_single_parser(monkeypatch):
    calls: list[str] = []
    real = was.parse_result

    def spy(raw, **kw):
        calls.append(kw.get("user_id"))
        return real(raw, **kw)

    monkeypatch.setattr(was, "parse_result", spy)
    age.access_state_from_raw(fx("present_empty_bookkeeping"), user_id=PERSON)
    assert calls == [PERSON]
    a5.parse_access_state(frame(fx("present_empty_bookkeeping")), user_id=PERSON, revision=REV)
    assert calls == [PERSON, PERSON]
    age.revocation_pending_from(lambda uid, rev: fx("present_empty_bookkeeping"), PERSON, REV)
    assert len(calls) == 3


def test_no_duplicate_parser_is_left_in_the_callers():
    for rel in ("services/access_grant_engine.py", "services/wiskey_acr5.py"):
        text = (PKG / rel).read_text(encoding="utf-8")
        assert "durable_repository_snapshot" not in text and "all_managed_stations" not in text, rel
        assert "def _station_ids" not in text and "def _queues" not in text and "def _row(" not in text, rel
        assert "was.parse_result" in text or "was.parse_frame" in text, rel
    assert a5.AccessState is was.AccessState and a5.PendingQueues is was.PendingQueues and a5.schedule_ok is was.schedule_ok


# ================================================================ the engine caller


def test_engine_projection_of_v2_keeps_six_arrays_and_the_central_predicate():
    s = age.access_state_from_raw(fx("present_disabled_row_unapplied"), user_id=PERSON)
    assert s.schema_version == 2 and s.central_revoked is True and s.unverified == ("station-a",)
    assert s.pending == {"bindings": (), "tombstones": (), "cards": (), "pins": (), "operations": ("station-a",)}


@pytest.mark.parametrize("name,known,expected", [
    ("present_empty_bookkeeping", A, None), ("present_revoked_disabled_row_applied", A, False),
    ("present_revoked_disabled_row_applied", None, None), ("present_revoked_disabled_row_applied", AB, None),
    ("present_revoked_pin_pending", A, True), ("absent", A, None), ("delete_pending", A, True),
])
def test_engine_reader_judges_v2_with_the_last_known_record(name, known, expected):
    assert age.revocation_pending_from(lambda uid, rev: fx(name), PERSON, REV, last_known_stations=known) is expected


def test_engine_v1_is_unchanged():
    assert age.revocation_pending_from(lambda uid, rev: v1(), PERSON, REV) is None  # ECCACT-295 (WKV2B): v1 never proves a revocation
    assert age.revocation_pending_from(lambda uid, rev: v1(), PERSON, 5) is None


def test_engine_malformed_v2_is_unknown_and_never_re_asked_as_v1():
    asked: list = []

    def reader(uid, rev):
        asked.append((uid, rev))
        raw = fx("present_revoked_disabled_row_applied")
        raw["extra"] = 1
        return raw

    assert age.revocation_pending_from(reader, PERSON, REV, last_known_stations=A) is None
    assert asked == [(PERSON, REV)]


def test_the_live_engine_stays_refused_and_reads_the_last_known_record_only_with_a_reader(monkeypatch):
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", False)  # ECCACT-295: pins the permit-off behaviour
    asked: list = []

    def known(pid):
        asked.append(pid)
        return A

    eng = WiskeyServiceEngine(settings=None, access_state_reader=lambda uid, rev: fx("present_revoked_disabled_row_applied"),
                              last_known_stations=known)
    with pytest.raises(age.EngineError) as err:
        eng.revocation_pending(PERSON, REV)
    assert err.value.kind == "not_permitted" and asked == []
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", True)  # RAM only, this test
    assert eng.revocation_pending(PERSON, REV) is False and asked == [PERSON]
    eng.last_known_stations = lambda pid: (_ for _ in ()).throw(RuntimeError("db"))
    assert eng.revocation_pending(PERSON, REV) is None
    eng.last_known_stations = None
    assert eng.revocation_pending(PERSON, REV) is None


def test_engine_for_wires_a_last_known_provider(monkeypatch):
    monkeypatch.setattr(ag, "ENGINE_FACTORY", None)

    class DB:
        def connection(self, **_kw):
            raise sqlite3.OperationalError("no db")

    eng = ag.engine_for(DB())
    from smplwise.services.wiskey_readback import LiveReadback

    assert isinstance(eng.access_state_reader, LiveReadback), "ECCACT-295: the live, negotiated readback is wired (still behind GO_LIVE)"
    assert eng.last_known_stations("person-a") is None


# ================================================================ the ACR5 caller


def test_acr5_parses_v2_and_needs_both_central_predicates():
    s = a5.parse_access_state(frame(fx("present_revoked_disabled_row_applied")), user_id=PERSON, revision=REV, expect=2)
    assert isinstance(s, a5.AccessState) and s.central_revoked is True
    assert a5.revocation_verdict(s, requested_revision=REV, central_revoked_at=REV, last_known_stations=A) is False
    assert a5.revocation_verdict(s, requested_revision=REV, central_revoked_at=None, last_known_stations=A) is None
    assert a5.revocation_verdict(s, requested_revision=REV, central_revoked_at=3, last_known_stations=A) is None
    assert a5.revocation_verdict(s, requested_revision=REV, central_revoked_at=REV) is None  # no last-known record
    e = a5.parse_access_state(frame(fx("present_empty_bookkeeping")), user_id=PERSON, revision=REV)
    assert a5.revocation_verdict(e, requested_revision=REV, central_revoked_at=REV, last_known_stations=A) is None  # F-02
    assert a5.stations_synced_verdict(a5.parse_access_state(frame(fx("present_enabled_row_synced")), user_id=PERSON, revision=REV)) is True


def test_acr5_typed_unknown_codes():
    u = a5.parse_access_state(frame(fx("present_empty_bookkeeping")), user_id=PERSON, revision=5)
    assert isinstance(u, a5.Unknown) and u.code == "revision_conflict"
    u = a5.parse_access_state(frame({**fx("present_empty_bookkeeping"), "schema_version": 9}), user_id=PERSON, revision=REV)
    assert u.code == "unsupported_schema"
    u = a5.parse_access_state(frame(v1()), user_id=PERSON, revision=REV, expect=2)
    assert u.code == "schema_mismatch"


def test_acr5_v2_request_and_capability():
    assert a5.access_state_request(PERSON, REV, version=2) == {"type": "hikvision_intercom/users/access_state_v2", "user_id": PERSON, "revision": REV}
    for version in (0, 3, True, "2"):
        with pytest.raises(ValueError):
            a5.access_state_request(PERSON, REV, version=version)
    assert a5.capability_ok({"person_access_state_v2"}, "acr5_01_v2") and not a5.capability_ok({"person_access_state_v1"}, "acr5_01_v2")


def test_acr5_port_with_expect_2_refuses_a_v1_answer():
    class Port:
        def __init__(self, answer):
            self.answer = answer

        def access_state(self, user_id, revision):
            return self.answer

    assert a5.revocation_pending_at(Port(frame(v1())), PERSON, REV, central_revoked_at=REV, expect=2, last_known_stations=A) is None
    ok = Port(frame(fx("present_revoked_disabled_row_applied")))
    assert a5.revocation_pending_at(ok, PERSON, REV, central_revoked_at=REV, expect=2, last_known_stations=A) is False


# ================================================================ Arx's own last-known doors record


@pytest.fixture()
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:")
    c.executescript("""
        CREATE TABLE access_person_links (id TEXT PRIMARY KEY, wiskey_person_id TEXT);
        CREATE TABLE access_grants (id TEXT PRIMARY KEY, link_id TEXT, doors_json TEXT NOT NULL, pushed INTEGER NOT NULL);
        CREATE TABLE access_station_permissions (id TEXT PRIMARY KEY, wiskey_person_id TEXT, station_id TEXT, effect TEXT,
                                                 wiskey_revision INTEGER);
        INSERT INTO access_person_links VALUES ('l1', 'person-a'), ('l2', 'person-b');
    """)
    return c


def test_last_known_stations_unions_pushed_grants_and_station_decisions(conn):
    conn.executemany("INSERT INTO access_grants VALUES (?, ?, ?, ?)", [
        ("g1", "l1", '{"station-a": [1]}', 1), ("g2", "l1", '{"station-c": [2]}', 0), ("g3", "l2", '{"station-z": [1]}', 1),
        ("g4", "l1", '{"station-b": [1, 2]}', 1)])
    conn.executemany("INSERT INTO access_station_permissions VALUES (?, ?, ?, ?, ?)", [
        ("p1", "person-a", "station-d", "deny", 7), ("p2", "person-a", "station-e", None, None), ("p3", "person-a", "station-f", "allow", None)])
    assert was.last_known_stations(conn, "person-a") == frozenset({"station-a", "station-b", "station-d", "station-f"})
    assert was.last_known_stations(conn, "person-c") == frozenset()


def test_last_known_stations_is_unknown_when_unreadable(conn):
    conn.execute("INSERT INTO access_grants VALUES ('g1', 'l1', 'not json', 1)")
    assert was.last_known_stations(conn, "person-a") is None
    conn.execute("DELETE FROM access_grants")
    conn.execute("INSERT INTO access_grants VALUES ('g1', 'l1', '[1]', 1)")
    assert was.last_known_stations(conn, "person-a") is None
    assert was.last_known_stations(conn, "") is None
    assert was.last_known_stations(sqlite3.connect(":memory:"), "person-a") is None  # no tables
