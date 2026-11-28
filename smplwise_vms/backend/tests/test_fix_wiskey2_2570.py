"""FIX-WISKEY2-2570: the second deep review of the WisKey / access area (docs/review/DEEP-REVIEW-2570-WISKEY-ACCESS.md, WA2-01..05).

FAKES ONLY: the fake direct feature port (wkcap_fakes.FakeDirectPort), the fake Supervisor / Core of the managed install
(test_wiskey_managed_install_2382.FakePlatform), real SQLite lineage files in a temporary folder. Nothing contacts WisKey, Home
Assistant, a station or a door.

- WA2-01 (high): the emergency RELEASE through the direct engine is authorized against, and sent in the name of, the person who
  RELEASED the incident - never the starter. An unknown / inactive / unentitled releaser is refused and nothing is sent.
- WA2-02 (medium): an unexpected error while the managed install has Core stopped asks for ONE start; the start-up recovery also
  covers a run left `failed / run_crashed` with Core stopped (once).
- WA2-03 (low): a recovery never turns this process's own in-flight write into unknown (a verified refusal stays provable).
- WA2-04 (low): an error between admit and the send marker settles the intent `not_sent` instead of holding the person.
- WA2-05 (low, latent): a guard - the service-write journal is not wired in production; wiring it needs the bounded settle /
  administrator close first.
"""
from __future__ import annotations

import ast
import asyncio
import json
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
import test_wkcap_295 as wk
from test_t06_admission_295 import fenv, make_user  # noqa: F401 - a fixture
from test_wiskey_managed_install_2382 import API, _adopted, _audit_rows, _job, world  # noqa: F401 - a fixture
from wkcap_fakes import FakeDirectPort

from smplwise.db import bump_permission_revision, set_setting
from smplwise.rbac import STATION
from smplwise.services import door_windows_engine as dwe
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_emergency_direct as ed
from smplwise.services import wiskey_managed_install as wmi
from smplwise.services import wiskey_native_write as nw
from smplwise.services import wiskey_write_lineage as wl

BACKEND = Path(__file__).resolve().parents[1]


# ================================================================ WA2-01: the releaser, never the starter

def _incident(e: Any, *, starter: str, releaser: str | None, release_request_id: str | None = "rel-1") -> None:
    with e.db.connection() as conn:
        conn.execute("INSERT INTO door_emergency_incidents(id, kind, scope_type, scope_id, state, actor_kind, requested_by, requested_at, request_id, "
                     "doors_total, released_by, released_at, release_request_id) VALUES ('inc-x','open','installation','*','releasing','person',?, "
                     "'2026-11-28T08:00:00Z','inc-1',1,?,?,?)",
                     (starter, releaser, "2026-11-28T08:05:00Z" if releaser else None, release_request_id))


def _revoke_all(e: Any, user_id: str) -> None:
    with e.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_kind = 'user' AND subject_id = ?", ("2026-11-28T08:01:00Z", user_id))
        bump_permission_revision(conn)


def _deactivate(e: Any, user_id: str) -> None:
    with e.db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (user_id,))
        bump_permission_revision(conn)


def _held(e: Any, port: FakeDirectPort) -> Any:
    """The door is held open by the incident's starter (the apply goes through Arx's own resolver)."""
    eng = wk.engine_for(e, port, ed.incident_context)
    assert eng.apply("open", "st-a", 1, "inc-1:st-a:1", "").state == "acknowledged"
    return eng


def _actor_of_last_start(port: FakeDirectPort) -> dict[str, Any]:
    return port.sent("features/start")[-1]["policy_snapshot"]["actor"]


def test_release_ids_are_parsed_from_the_right():
    assert ed.release_id_of("rel-1:r:st-a:1") == "rel-1"
    assert ed.release_id_of("cli-9:sup:r:st-a:2") == "cli-9:sup", "the OPEN-over-LOCK supersede id carries a colon"
    assert ed.release_id_of("inc-1:st-a:1") is None and ed.release_id_of("no-such-request") is None


def test_a_release_by_a_second_person_is_sent_as_that_person_while_the_starter_lost_everything(fenv):
    e = fenv
    port = FakeDirectPort()
    starter = make_user(e, "wa_start", "emergency_open", STATION, "st-a")
    releaser = make_user(e, "wa_rel", "emergency_lock", STATION, "st-a")
    _incident(e, starter=starter.user_id, releaser=releaser.user_id)
    eng = _held(e, port)
    assert _actor_of_last_start(port) == {"kind": "human", "user_id": starter.user_id}, "the hold is the starter's"
    _revoke_all(e, starter.user_id)
    _deactivate(e, starter.user_id)  # the administrator's natural first reaction
    out = eng.release("open", "st-a", 1, "rel-1:r:st-a:1")
    assert out == dwe.DoorOutcome("acknowledged", "acknowledged"), out
    assert _actor_of_last_start(port) == {"kind": "human", "user_id": releaser.user_id}, "WisKey's ledger names the person who released"
    with e.db.connection(mode="read") as conn:
        ctx = ed.incident_context(conn, "rel-1:r:st-a:1")
    assert ctx.principals[0].user_id == releaser.user_id and ctx.trigger == "manual"


def test_a_release_by_the_starter_who_lost_the_permission_is_refused_and_nothing_is_sent(fenv):
    e = fenv
    port = FakeDirectPort()
    starter = make_user(e, "wa_self", "emergency_open", STATION, "st-a")
    _incident(e, starter=starter.user_id, releaser=starter.user_id)
    eng = _held(e, port)
    _revoke_all(e, starter.user_id)
    sent = len(port.sent("features/start"))
    out = eng.release("open", "st-a", 1, "rel-1:r:st-a:1")
    assert out.state == "refused", out
    assert len(port.sent("features/start")) == sent, "a refused release sends nothing"


def test_an_unauthorized_releaser_is_refused_never_replaced_by_the_entitled_starter(fenv):
    e = fenv
    port = FakeDirectPort()
    starter = make_user(e, "wa_ok", "emergency_open", STATION, "st-a")
    nobody = make_user(e, "wa_none", None, "installation", "*")
    _incident(e, starter=starter.user_id, releaser=nobody.user_id)
    eng = _held(e, port)
    sent = len(port.sent("features/start"))
    out = eng.release("open", "st-a", 1, "rel-1:r:st-a:1")
    assert out.state == "refused", out
    assert len(port.sent("features/start")) == sent


@pytest.mark.parametrize("case", ["inactive_releaser", "no_releaser_on_record", "unknown_release_id"])
def test_a_release_without_an_active_releaser_on_record_is_unauthorized(fenv, case):
    e = fenv
    port = FakeDirectPort()
    starter = make_user(e, "wa_s2", "emergency_open", STATION, "st-a")
    releaser = make_user(e, "wa_r2", "emergency_lock", STATION, "st-a")
    _incident(e, starter=starter.user_id, releaser=None if case == "no_releaser_on_record" else releaser.user_id)
    eng = _held(e, port)
    if case == "inactive_releaser":
        _deactivate(e, releaser.user_id)
    rid = "other:r:st-a:1" if case == "unknown_release_id" else "rel-1:r:st-a:1"
    sent = len(port.sent("features/start"))
    out = eng.release("open", "st-a", 1, rid)
    assert out == dwe.DoorOutcome("refused", "Unauthorized"), out
    assert len(port.sent("features/start")) == sent


def test_the_dispatchers_fallback_id_resolves_the_releaser_when_no_release_id_was_stored(fenv):
    e = fenv
    starter = make_user(e, "wa_s3", "emergency_open", STATION, "st-a")
    releaser = make_user(e, "wa_r3", "emergency_lock", STATION, "st-a")
    _incident(e, starter=starter.user_id, releaser=releaser.user_id, release_request_id=None)
    with e.db.connection(mode="read") as conn:
        assert ed.incident_context(conn, "inc-1:r:st-a:1").principals[0].user_id == releaser.user_id
        assert ed.incident_context(conn, "inc-1:st-a:1").principals[0].user_id == starter.user_id, "an apply stays the starter's"


# ================================================================ WA2-02: Core is never left stopped by a crash

def test_a_database_failure_after_the_stop_still_starts_core_once(world, monkeypatch):
    _adopted(world)
    p = world["platform"]

    def full_disk(*_a: Any, **_k: Any) -> None:
        raise OSError(28, "No space left on device")

    real = wmi._job_update
    armed = {"on": True}

    def flaky(db: Any, job: dict[str, Any]) -> None:
        last = job["steps"][-1] if job.get("steps") else {}
        if armed["on"] and last.get("name") == "backup_local" and last.get("state") == "failed":
            armed["on"] = False
            raise sqlite3.OperationalError("database or disk is full")
        real(db, job)

    monkeypatch.setattr(wmi, "private_backup", full_disk)
    monkeypatch.setattr(wmi, "_job_update", flaky)
    target = world["cfg"] / "custom_components" / "hikvision_intercom"
    before = wmi.tree_digest(target)
    r = world["client"].post(API + "/upgrade")
    assert r.status_code == 202, r.text
    assert p.calls.count("stop") == 1 and p.calls[-1] == "start" and p.calls.count("start") == 1, p.calls
    assert p.running, "Core was asked to start again (no retry: one request)"
    job = _job(world)
    assert job["state"] == "failed" and job["code"] == "run_crashed", job
    assert wmi.tree_digest(target) == before, "nothing was swapped"
    rows = [json.loads(x["details_json"]) for x in _audit_rows(world["db"], "wiskey.managed.run") if x["reason"] == "run_crashed"]
    assert rows and rows[-1]["core_rescue"] == ["core_start_requested"] and rows[-1]["error"] == "OperationalError"


def test_an_unexpected_error_inside_the_swap_restarts_core_with_the_tree_unchanged(world, monkeypatch):
    _adopted(world)
    p = world["platform"]
    target = world["cfg"] / "custom_components" / "hikvision_intercom"
    before = wmi.tree_digest(target)
    calls = {"n": 0}
    real_digest = wmi.tree_digest

    def odd_digest(path: Any) -> str:
        if Path(path).name == "candidate":
            calls["n"] += 1
            raise ValueError("special file")
        return real_digest(path)

    monkeypatch.setattr(wmi, "tree_digest", odd_digest)
    assert world["client"].post(API + "/upgrade").status_code == 202
    assert calls["n"] == 1 and p.running and p.calls.count("start") == 1, p.calls
    assert real_digest(target) == before
    assert _job(world)["code"] == "run_crashed"


def test_startup_recovery_starts_core_for_a_crashed_run_left_with_core_stopped_once(world):
    _adopted(world)
    p = world["platform"]
    p.running = False
    job_id = "20300101T000000Z-abcdef"
    steps = [{"name": n, "state": "done", "code": None, "at": "x"} for n in ("preflight", "core_gate", "backup_check", "snapshot_before", "stop_core")]
    steps.append({"name": "backup_local", "state": "failed", "code": "backup_failed", "at": "x"})
    with world["db"].write_aside() as conn:
        set_setting(conn, wmi.K_JOB, json.dumps({"id": job_id, "state": "failed", "code": "run_crashed", "kind": "convert", "steps": steps,
                                                 "rollback_of": None}))
    assert wmi.recover_interrupted(world["db"], world["settings"]) == "crash_recovered"
    assert p.running and p.calls == ["start"]
    job = _job(world)
    assert job["state"] == "failed" and job["code"] == "run_crashed", "the status stays honest: the run failed"
    assert wmi.recover_interrupted(world["db"], world["settings"]) is None, "recorded once, never repeated"
    assert p.calls == ["start"]


def test_startup_recovery_leaves_a_crashed_run_alone_when_core_was_started_again_or_never_stopped(world):
    _adopted(world)
    p = world["platform"]
    p.running = False
    for steps in ([{"name": "stop_core", "state": "done"}, {"name": "start_core", "state": "done"}], [{"name": "preflight", "state": "done"}],
                  [{"name": "stop_core", "state": "failed", "code": "core_stop_refused"}]):
        with world["db"].write_aside() as conn:
            set_setting(conn, wmi.K_JOB, json.dumps({"id": "20300101T000000Z-abcdef", "state": "failed", "code": "run_crashed", "kind": "convert",
                                                     "steps": steps, "rollback_of": None}))
        assert wmi.recover_interrupted(world["db"], world["settings"]) is None
    assert p.calls == []


# ================================================================ WA2-03 / WA2-04: the people-write lineage

class _Clock:
    def __call__(self) -> datetime:
        return datetime.now(timezone.utc)


class _FlakyAnchor:
    def __init__(self, inner: wl.SettingsAnchor) -> None:
        self.inner, self.fail = inner, False

    def read(self) -> Any:
        return self.inner.read()

    def write(self, generation: str, seq: int) -> None:
        if self.fail:
            raise sqlite3.OperationalError("database is locked")
        self.inner.write(generation, seq)


@pytest.fixture()
def lineage(tmp_path: Path) -> Any:
    main = tmp_path / "smplwise.db"
    c = sqlite3.connect(main)
    c.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    c.commit()
    c.close()
    anchor = _FlakyAnchor(wl.SettingsAnchor(main))
    lin = wl.open_lineage(tmp_path, anchor, holder="holder-A", clock=_Clock())
    yield lin, anchor, tmp_path
    lin.close()


KW = {"kind": "peer_write", "command": "users/update", "target_ref": "u-1", "create_origin_ref": None, "revision_sent": 1,
      "sealed_field": "original", "sealed_value": {"x": 1}}


def test_a_recovery_in_the_same_process_leaves_the_in_flight_write_to_its_own_call(lineage):
    lin, _anchor, _tmp = lineage
    scope = "repo|svc"
    lin.acquire_writer(scope)
    lin.admit(scope=scope, operation_id="op-live", request_id="req-live", **KW)
    lin.begin_send("op-live")
    assert lin.recover(scope) == {"not_sent": 0, "unknown": 0}, "this process's own live write is not a crash leftover"
    assert lin.get("op-live").state == "sending"
    assert lin.mark_refused("op-live", "revision_conflict") == "settled", "WisKey's verified refusal is still recorded"
    assert lin.get("op-live").state == "refused"


def test_a_new_process_still_recovers_every_row_a_dead_one_left(lineage):
    lin, anchor, tmp = lineage
    scope = "repo|svc"
    lin.acquire_writer(scope)
    lin.admit(scope=scope, operation_id="op-a", request_id="req-a", **KW)
    lin.begin_send("op-a")
    lin.admit(scope=scope, operation_id="op-b", request_id="req-b", **{**KW, "target_ref": "u-2"})
    with lin._lock:  # the process dies: its lease lapses (no clean release)
        lin.db.execute("UPDATE writer_scope SET lease_until = '2000-01-01T00:00:00.000000Z'")
    other = wl.open_lineage(tmp, anchor, holder="holder-B", clock=_Clock())
    try:
        assert other.recover(scope) == {"not_sent": 1, "unknown": 1}
        assert other.get("op-a").state == "unknown" and other.get("op-b").state == "not_sent"
    finally:
        other.close()


def test_recover_now_skips_a_scope_this_process_already_recovered(monkeypatch):
    recovered: list[str] = []

    class FakeWriter:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        async def observe_source(self) -> Any:
            return SimpleNamespace(scope="repo|svc")

        def recover(self, scope: str) -> dict[str, int]:
            recovered.append(scope)
            return {"not_sent": 0, "unknown": 1}

    monkeypatch.setattr(nw, "NativePeopleWriter", FakeWriter)
    fake = SimpleNamespace(lineage=object(), selected=lambda *_a: True, command_port=object(), _recover_lock=threading.Lock(),
                           _recovered={"repo|svc"}, session=SimpleNamespace(run_sync=lambda coro, _t: asyncio.run(coro)))
    assert join.DirectJoin.recover_now(fake) == {"not_sent": 0, "unknown": 0}
    assert recovered == [], "a scope is recovered once per process: a second recovery would turn live writes unknown"
    fake._recovered = set()
    assert join.DirectJoin.recover_now(fake) == {"not_sent": 0, "unknown": 1} and recovered == ["repo|svc"] and fake._recovered == {"repo|svc"}


def test_an_anchor_failure_settles_the_intent_not_sent_and_frees_the_person(lineage):
    lin, anchor, _tmp = lineage
    scope = "repo|svc"
    lin.acquire_writer(scope)
    anchor.fail = True
    with pytest.raises(wl.LineageError) as exc:
        lin.admit(scope=scope, operation_id="op-1", request_id="req-1", **KW)
    assert exc.value.code == "anchor_write_failed"
    assert lin.get("op-1").state == "not_sent"
    anchor.fail = False
    assert lin.admit(scope=scope, operation_id="op-2", request_id="req-2", **KW).state == "intent", "the person is not held"


def test_a_send_marker_failure_is_not_sent_and_frees_the_person(tmp_path: Path):
    from wkwrite_fake import FakeWisKey

    main = tmp_path / "smplwise.db"
    c = sqlite3.connect(main)
    c.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    c.commit()
    c.close()
    lin = wl.open_lineage(tmp_path, wl.SettingsAnchor(main), holder="holder-A", clock=_Clock())
    fake = FakeWisKey()
    writer = nw.NativePeopleWriter(fake, lin)
    real = lin.begin_send

    def busy(operation_id: str) -> None:
        raise sqlite3.OperationalError("database is locked")

    lin.begin_send = busy  # type: ignore[method-assign]
    dec = nw.ArxDecision(decision_id="d-1", grant_id="g-1", grant_revision=1, permission_revision=1, decided_at=datetime.now(timezone.utc))
    actor = nw.WriteActor(user_id="arx-user-1", display_name="Operator One", session_active=True)
    try:
        out = asyncio.run(writer.write("users/create", {"data": {"display_name": "P"}}, actor=actor, decision=dec, create_origin_ref="arx-grant:k-1"))
        assert (out.state, out.code) == ("not_sent", "send_marker_failed")
        assert lin.get(out.operation_id).state == "not_sent"
        assert [c for c, _ in fake.sent if c == "users/create"] == [], "no frame of the mutation left"
        lin.begin_send = real  # type: ignore[method-assign]
        again = asyncio.run(writer.write("users/create", {"data": {"display_name": "P"}}, actor=actor,
                                         decision=nw.ArxDecision("d-2", "g-1", 1, 1, datetime.now(timezone.utc) - timedelta(seconds=1)),
                                         create_origin_ref="arx-grant:k-2"))
        assert again.state == "committed"
    finally:
        lin.close()


# ================================================================ WA2-05: the service-write journal stays unwired (guard)

def test_the_service_write_journal_has_no_production_caller_until_a_bounded_close_exists():
    """WA2-05 (latent): an UNKNOWN row of `wiskey_service_write_journal` holds its person until a status read answers `completed`;
    there is no janitor and no administrator close yet. That is safe ONLY while no product code builds the journal client. Wiring it
    (`ServiceWriteClient(` / `Journal(` of services/wiskey_service_write.py outside that module) must come with a periodic bounded
    `settle_unknown`, an audited administrator close and an age rule - then this guard is replaced by their tests."""
    hits = []
    for path in (BACKEND / "smplwise").rglob("*.py"):
        if path.name == "wiskey_service_write.py":
            continue
        text = path.read_text(encoding="utf-8")
        if "wiskey_service_write" not in text:
            continue
        tree = ast.parse(text)
        imports_it = any(isinstance(n, ast.ImportFrom) and (n.module or "").endswith("wiskey_service_write") for n in ast.walk(tree))
        if not imports_it:
            continue
        for n in ast.walk(tree):
            if isinstance(n, ast.Call):
                name = n.func.attr if isinstance(n.func, ast.Attribute) else getattr(n.func, "id", None)
                if name in ("ServiceWriteClient", "Journal", "settle_unknown"):
                    hits.append(f"{path.relative_to(BACKEND)}:{n.lineno}:{name}")
    assert hits == [], f"WA2-05: the service-write journal is being wired - add the bounded close first: {hits}"
    from smplwise.services.wiskey_service_write import FinalServiceWriter

    joined = SimpleNamespace(selected=lambda _c: True, session=SimpleNamespace(entry_id="entry-1"))
    assert FinalServiceWriter.from_join(joined).available() is False
