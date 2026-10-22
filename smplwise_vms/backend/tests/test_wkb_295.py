"""WKB-295 (FAKES ONLY): WisKey requirements A04 (T02/Q1, per-station removal proof) and A05 (T05, the durable full original).
Nothing contacts WisKey, Home Assistant or a station; every answer is hand-built, every transport is a fake."""
from __future__ import annotations

import copy
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import access_grant_engine as age
from smplwise.services import wiskey_access_state as was
from smplwise.services import wiskey_intents as wi
from smplwise.services import wiskey_peer as wp

PERSON, REV = "person-a", 4
PRED = was.CENTRAL_REVOCATION_PREDICATE


# ================================================================ A04: one station's removal, judged per station

def _row(sid: str, *, enabled: bool = False, applied: bool | None = True, applied_rev: int | None = REV, sync: str | None = "synced",
         locks: list[int] | None = None) -> dict[str, Any]:
    return {"station_id": sid, "enabled": enabled, "allowed_locks": locks or [1], "desired_revision": REV, "applied_revision": applied_rev,
            "sync_state": sync, "applied": applied}


def _answer(rows: list[dict[str, Any]], *, operations=(), unverified=(), pins=(), central_revoked: bool | None = None,
            presence: str = "present") -> dict[str, Any]:
    queues = {"bindings": [], "tombstones": [], "cards": [], "pins": sorted(pins), "operations": sorted(operations), "unverified": sorted(unverified)}
    removal = any(queues[q] for q in was.REMOVAL_QUEUES)
    enabled = [r["applied"] for r in rows if r["enabled"]]
    synced = None if not enabled else False if False in enabled else None if None in enabled else True
    if central_revoked is None:
        central_revoked = not any(r["enabled"] for r in rows)
    return {"schema_version": 2, "observation": was.OBSERVATION, "scope": was.SCOPE, "user_id": PERSON, "person_revision": REV,
            "presence": presence, "revocation_pending": True if removal else (None if queues["unverified"] else False),
            "stations_synced": synced, "assignments": rows, "timing_policy": None, "pending": queues,
            "central_revocation_predicate": PRED, "central_revoked": central_revoked}


def _parse(raw: dict[str, Any]) -> was.AccessState:
    return was.parse_result(raw, user_id=PERSON, revision=REV, expect=2)


def _station(st: was.AccessState, sid: str) -> bool | None:
    return was.station_removal_verdict_v2(st, person_id=PERSON, revision=REV, station_id=sid)


def _person(st: was.AccessState, known: frozenset[str]) -> bool | None:
    return was.revocation_verdict_v2(st, person_id=PERSON, revision=REV, last_known_stations=known)


def a_positive_b_pending() -> dict[str, Any]:
    """The SHARED case (WisKey T02/Q1): ONE answer, ONE revision. Station A: a disabled row applied at this revision (the station
    proof). Station B: a disabled row still behind, owed in `operations`. WisKey's top-level revocation_pending is therefore True."""
    return _answer([_row("station-a"), _row("station-b", applied=False, applied_rev=REV - 1, sync="pending")], operations=["station-b"])


def test_shared_a_positive_b_pending_in_the_same_revision():
    st = _parse(a_positive_b_pending())
    assert st.revocation_pending is True and st.person_revision == REV  # the global flag is True because of B alone
    assert _station(st, "station-a") is False  # A is proven on its own row (before WKB-295: None, the global flag blocked it)
    assert _station(st, "station-b") is True  # B: work still owed -> pending / blocked
    assert _station(st, "station-c") is None  # no row: UNKNOWN, never invented
    # the whole person is NOT clean in the same answer: a station proof is never a person clean
    assert _person(st, frozenset({"station-a", "station-b"})) is True
    assert _person(st, frozenset({"station-a"})) is True


def test_the_shared_case_through_the_engine_port():
    raw = a_positive_b_pending()
    reader = lambda pid, rev: (copy.deepcopy(raw), 2)  # noqa: E731 - a fake readback
    assert age.station_removal_from(reader, PERSON, REV, "station-a") is False
    assert age.station_removal_from(reader, PERSON, REV, "station-b") is True
    assert age.revocation_pending_from(reader, PERSON, REV, last_known_stations=frozenset({"station-a", "station-b"})) is True


def test_unknown_at_another_station_does_not_block_a_but_unknown_at_a_stays_blocked():
    other = _parse(_answer([_row("station-a"), _row("station-b", applied=None)], unverified=["station-b"]))
    assert other.revocation_pending is None
    assert _station(other, "station-a") is False
    assert _station(other, "station-b") is None  # UNKNOWN stays UNKNOWN, never False
    assert _person(other, frozenset({"station-a", "station-b"})) is None
    # A's own row looks applied, but WisKey lists A as unverified: UNKNOWN, never False
    own = _parse(_answer([_row("station-a")], unverified=["station-a"]))
    assert _station(own, "station-a") is None


def test_a_station_proof_for_a_still_active_person_is_not_a_person_clean():
    st = _parse(_answer([_row("station-a"), _row("station-c", enabled=True)]))  # A blocked, C still allowed
    assert st.revocation_pending is False and st.central_revoked is False
    assert _station(st, "station-a") is False
    assert _station(st, "station-c") is None  # an enabled row is never a removal proof
    assert _person(st, frozenset({"station-a", "station-c"})) is None


@pytest.mark.parametrize("queue", ["bindings", "tombstones", "cards", "pins", "operations"])
def test_any_removal_queue_naming_a_is_pending_even_with_an_applied_row(queue):
    raw = _answer([_row("station-a")])
    raw["pending"][queue] = ["station-a"]
    raw["revocation_pending"] = True
    st = _parse(raw)
    assert _station(st, "station-a") is True


def test_whole_person_states_still_block_every_station():
    dp = _parse({**_answer([]), "presence": "delete_pending", "person_revision": None, "revocation_pending": True, "central_revoked": None,
                 "stations_synced": None})
    assert _station(dp, "station-a") is True
    absent = {**_answer([]), "presence": "absent", "person_revision": None, "revocation_pending": None, "central_revoked": None,
              "stations_synced": None}
    assert _station(_parse(absent), "station-a") is None  # absence is never a proof
    st = _parse(a_positive_b_pending())
    assert was.station_removal_verdict_v2(st, person_id=PERSON, revision=REV + 1, station_id="station-a") is None  # another revision


def test_v1_still_never_proves_one_station():
    raw = a_positive_b_pending()
    raw = {k: v for k, v in raw.items() if k not in ("central_revocation_predicate", "central_revoked")}
    raw["schema_version"] = 1
    v1 = was.parse_result(raw, user_id=PERSON, revision=REV, expect=1)
    assert _station(v1, "station-a") is None


# ================================================================ A05: the durable full original (fakes only)

BACKEND = Path(__file__).resolve().parents[1] / "smplwise" / "migrations"
MIGS = [BACKEND / "0145_wiskey_peer_intents_feature_registry.sql", BACKEND / "0146_wiskey_intent_originals.sql"]
REPO = "11111111-2222-4333-8444-555555555555"
OWNER = "a" * 32
PEER = wp._mint_peer(value="peer-1", peer_binding_ref="bind-1", peer_binding_revision=3, repository_id=REPO, query_owner_id=OWNER)
SOURCE = "context-read-not-yet-named"  # the agreed context source is a WisKey definition; this is a fake label


def ctx(epoch: int = 7, exclusive: bool = True, repo: str = REPO, owner: str = OWNER) -> wp.VerifiedWriteContext:
    return wp._mint_write_context(repository_id=repo, owner_id=owner, writer_epoch=epoch, exclusive_writer_established=exclusive, source=SOURCE)


def open_db(path: Path) -> sqlite3.Connection:
    c = sqlite3.connect(path)
    c.execute("PRAGMA foreign_keys=ON")
    return c


@pytest.fixture()
def dbfile(tmp_path: Path) -> Path:
    path = tmp_path / "arx.db"
    c = open_db(path)
    for m in MIGS:
        c.executescript(m.read_text(encoding="utf-8"))
    c.commit()
    c.close()
    return path


def update_original(n: int = 1) -> dict[str, Any]:
    return {"type": "hikvision_intercom/users/update", "user_id": "person-a", "expected_revision": 4, "name": f"Test Person {n}",
            "doors": {"station-a": [1]}, "operation_id": f"up-{n}"}


def admit_full(conn, n: int = 1, *, context=None, original=None, **over: Any) -> wi.FullOriginal:
    kw = dict(peer=PEER, context=context if context is not None else ctx(), operation_id=f"up-{n}", request_id=f"ureq-{n}",
              origin_ref=f"editor:{n}", operation_binding_ref=f"uopb-{n}", command="users/update",
              original=original if original is not None else update_original(n), user_id="person-a", revision_before=4)
    kw.update(over)
    return wi.admit_with_original(conn, **kw)


class FakeTransport:
    def __init__(self, fail: BaseException | None = None) -> None:
        self.sent: list[dict[str, Any]] = []
        self.fail = fail

    def __call__(self, frame: dict[str, Any]) -> Any:
        self.sent.append(frame)
        if self.fail is not None:
            raise self.fail
        return {"ok": True}


class Crash(BaseException):
    """A process dying mid-call (not an Exception: nothing in the code under test may swallow it)."""


def test_full_original_hash_and_context_are_committed_before_returning(dbfile):
    c = open_db(dbfile)
    full = admit_full(c)
    assert not c.in_transaction  # the commit point is inside admit_with_original
    # a SECOND connection (another process) already sees all of it, before any I/O happened
    other = open_db(dbfile)
    o = wi.original(other, REPO, OWNER, "up-1")
    got = wi.stored_original(other, o)
    assert got is not None and got.original() == update_original(1)
    assert got.original_sha256 == wi.sha256_hex(wi.canonical(update_original(1)))
    assert got.context()["writer_epoch"] == 7 and got.context()["exclusive_writer_established"] is True
    assert got.context()["peer_binding_revision"] == 3 and got.context()["source"] == SOURCE
    assert o.issued_epoch == 7 and wi.state(other, o) == "intent" and full.original_sha256 == got.original_sha256


def test_admission_is_atomic_a_failed_original_insert_leaves_no_intent(dbfile):
    c = open_db(dbfile)
    c.execute("CREATE TRIGGER boom BEFORE INSERT ON wiskey_intent_originals BEGIN SELECT RAISE(ABORT, 'disk gone'); END")
    c.commit()
    with pytest.raises(sqlite3.DatabaseError):
        admit_full(c)
    assert not c.in_transaction
    assert open_db(dbfile).execute("SELECT count(*) FROM wiskey_fence_intents").fetchone()[0] == 0


def test_crash_after_sent_is_committed_restart_resolves_and_never_resends(dbfile):
    c = open_db(dbfile)
    full = admit_full(c)
    t = FakeTransport(fail=Crash())
    with pytest.raises(Crash):
        wi.send_once(c, full.exact, t, context=ctx(), peer=PEER)
    assert len(t.sent) == 1 and t.sent[0] == update_original(1)  # the stored bytes went out, exactly once
    c.close()  # the process dies here
    r = open_db(dbfile)  # restart
    o = wi.original(r, REPO, OWNER, "up-1")
    assert wi.state(r, o) == "sent"
    assert [(x.operation_id, k) for x, k in wi.recovery_plan(r)] == [("up-1", "resolve_with_original")]
    body = wi.resolve_request(r, o)
    assert body["original"] == update_original(1) and body["original_sha256"] == full.original_sha256
    assert body["operation_id"] == "up-1" and body["issued_epoch"] == 7 and body["context_sha256"] == full.context_sha256
    t2 = FakeTransport()
    with pytest.raises(wi.IntentError) as e:
        wi.send_once(r, o, t2, context=ctx(), peer=PEER)
    assert e.value.code == "not_sendable" and t2.sent == []  # no replay after restart


def test_crash_before_the_send_restart_holds_it_and_sends_nothing_by_itself(dbfile):
    c = open_db(dbfile)
    admit_full(c)
    c.close()  # dies between the committed admission and the send
    r = open_db(dbfile)
    assert [k for _, k in wi.recovery_plan(r)] == ["held_not_sent"]
    o = wi.original(r, REPO, OWNER, "up-1")
    # a later send needs a fresh sealed context with the SAME epoch; a new epoch sends nothing
    t = FakeTransport()
    with pytest.raises(wi.IntentError) as e:
        wi.send_once(r, o, t, context=ctx(epoch=8), peer=PEER)
    assert e.value.code == "epoch_changed" and t.sent == [] and wi.state(r, o) == "intent"


def test_a_transport_error_is_unknown_committed_and_never_retried(dbfile):
    c = open_db(dbfile)
    full = admit_full(c)
    t = FakeTransport(fail=RuntimeError("socket closed"))
    assert wi.send_once(c, full.exact, t, context=ctx(), peer=PEER) is None
    r = open_db(dbfile)
    o = wi.original(r, REPO, OWNER, "up-1")
    assert wi.state(r, o) == "unknown" and [k for _, k in wi.recovery_plan(r)] == ["resolve_with_original"]
    with pytest.raises(wi.IntentError):
        wi.send_once(r, o, FakeTransport(), context=ctx(), peer=PEER)


def test_an_old_intent_without_an_original_stays_unknown_and_is_never_rebuilt(dbfile):
    c = open_db(dbfile)
    o = wi.admit(c, peer=PEER, operation_id="old-1", request_id="oreq-1", origin_ref="editor:old", operation_binding_ref="oopb-1",
                 issued_epoch=7, command="users/create")
    wi.mark_sent(c, o)
    c.commit()
    c.close()
    r = open_db(dbfile)
    o = wi.original(r, REPO, OWNER, "old-1")
    assert [k for _, k in wi.recovery_plan(r)] == ["unknown_no_original"]
    for call in (lambda: wi.resolve_request(r, o), lambda: wi.send_once(r, o, FakeTransport(), context=ctx(), peer=PEER)):
        with pytest.raises(wi.IntentError) as e:
            call()
        assert e.value.code == "no_original"
    assert wi.state(r, o) == "sent"  # nothing moved it, nothing sent it


@pytest.mark.parametrize("bad, code", [
    ("plain", "context_unverified"),
    ("fence", "context_unverified"),
    ("not_exclusive", "writer_unproven"),
    ("other_repo", "context_mismatch"),
    ("other_owner", "context_mismatch"),
])
def test_the_context_must_come_from_the_sealed_source_and_match_the_pin(dbfile, bad, code):
    c = open_db(dbfile)
    value = {"plain": {"repository_id": REPO, "owner_id": OWNER, "writer_epoch": 7, "exclusive_writer_established": True},
             "fence": wp.FenceContext(REPO, 7, OWNER, True),
             "not_exclusive": ctx(exclusive=False),
             "other_repo": ctx(repo="99999999-2222-4333-8444-555555555555"),
             "other_owner": ctx(owner="b" * 32)}[bad]
    with pytest.raises(wi.IntentError) as e:
        admit_full(c, context=value)
    assert e.value.code == code
    assert c.execute("SELECT count(*) FROM wiskey_fence_intents").fetchone()[0] == 0


def test_the_context_cannot_be_forged():
    with pytest.raises(wp.PeerSeamError):
        wp.VerifiedWriteContext(repository_id=REPO, owner_id=OWNER, writer_epoch=7, exclusive_writer_established=True, source=SOURCE)
    with pytest.raises(wp.PeerSeamError):
        wp._mint_write_context(repository_id=REPO, owner_id=OWNER, writer_epoch=True, exclusive_writer_established=True, source=SOURCE)
    with pytest.raises(wp.PeerSeamError):
        wp.as_write_context(wp.FenceContext(REPO, 7, OWNER, True))


@pytest.mark.parametrize("original, code", [
    ({"type": "x", "pin": "1234"}, "secret_in_original"),
    ({"type": "x", "nested": {"Card_No": "123"}}, "secret_in_original"),
    ({"type": "x", "cards": [{"value": "1"}]}, "secret_in_original"),
    ({"type": "x", "ratio": 0.5}, "original_type"),
    ({"type": "x", "big": 2 ** 53}, "original_unsafe_int"),
    ({"id": 4, "type": "x"}, "original_has_message_id"),
    ({}, "original_shape"),
    ({"type": "x", "blob": "y" * 70000}, "original_too_large"),
])
def test_originals_that_cannot_be_stored_safely_are_refused_before_anything_is_written(dbfile, original, code):
    c = open_db(dbfile)
    with pytest.raises(wi.IntentError) as e:
        admit_full(c, original=original)
    assert e.value.code == code
    assert c.execute("SELECT count(*) FROM wiskey_fence_intents").fetchone()[0] == 0


def test_an_open_transaction_is_refused_the_commit_point_must_be_ours(dbfile):
    c = open_db(dbfile)
    c.execute("BEGIN")
    with pytest.raises(wi.IntentError) as e:
        admit_full(c)
    assert e.value.code == "open_transaction"


def test_originals_and_selectors_are_immutable_and_a_tampered_original_is_corrupt(dbfile):
    c = open_db(dbfile)
    full = admit_full(c)
    for sql in ("UPDATE wiskey_intent_originals SET original_json = '{}'", "DELETE FROM wiskey_intent_originals",
                "UPDATE wiskey_fence_intents SET issued_epoch = 8", "UPDATE wiskey_fence_intents SET origin_ref = 'x'"):
        with pytest.raises(sqlite3.DatabaseError):
            c.execute(sql)
        c.rollback()
    wi.mark_sent(c, full.exact)  # the state columns still move
    c.commit()
    # tamper behind the trigger (as a broken disk / manual edit would): the read refuses it, recovery treats it as no original
    c.execute("DROP TRIGGER wiskey_intent_originals_immutable")
    c.execute("UPDATE wiskey_intent_originals SET original_json = replace(original_json, 'Test Person 1', 'Someone Else')")
    c.commit()
    with pytest.raises(wi.IntentError) as e:
        wi.resolve_request(c, full.exact)
    assert e.value.code == "original_corrupt"
    assert [k for _, k in wi.recovery_plan(c)] == ["unknown_no_original"]


def test_duplicates_are_refused_and_the_first_original_is_kept(dbfile):
    c = open_db(dbfile)
    first = admit_full(c)
    with pytest.raises(wi.IntentError) as e:
        admit_full(c, original={**update_original(1), "name": "changed"})
    assert e.value.code == "duplicate" and not c.in_transaction
    assert wi.stored_original(c, first.exact).original() == update_original(1)


def test_the_proposed_create_resolution_is_not_an_alias_of_the_original_path():
    assert wi.PROPOSED_CREATE_COMMAND == "hikvision_intercom/person_writes/resolve_create"
    with pytest.raises(wp.PeerSeamError):
        wi.LiveResolveTransport().resolve(None)  # type: ignore[arg-type]
