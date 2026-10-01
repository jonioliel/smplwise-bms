"""Multi-Claude coordination: master lease, quota-ranked succession, handoff, task claims, lab gating.
Uses a local bare repository as the shared remote; no network and no real project state."""
from __future__ import annotations

import importlib.util
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("coord", ROOT / "scripts" / "coord.py")
coord = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(coord)


class Clock:
    def __init__(self):
        self.t = 1_000_000.0

    def __call__(self):
        return self.t


@pytest.fixture
def world(tmp_path):
    remote = tmp_path / "remote.git"
    subprocess.run(["git", "init", "--bare", "--quiet", str(remote)], check=True)
    clock = Clock()

    def session(name: str) -> "coord.Coord":
        c = coord.Coord(str(remote), tmp_path / f"clone-{name}", now=clock)
        return c

    return session, clock


def test_first_session_becomes_master_and_second_is_refused(world):
    session, _ = world
    a, b = session("a"), session("b")
    a.claim_master("a", 80)
    with pytest.raises(coord.Refused):
        b.claim_master("b", 99)
    assert b.status()["lease"]["master"] == "a"


def test_lost_race_when_two_sessions_claim_from_the_same_state(world):
    session, _ = world
    a, b = session("a"), session("b")
    a.status()
    b.status()  # both clones now hold the same vacant state
    a.claim_master("a", 50)
    b.sync = lambda: None  # b acts on its stale copy, as in a real race
    with pytest.raises(coord.LostRace):
        b.claim_master("b", 50)


def test_lease_expires_without_heartbeat_and_highest_quota_wins(world):
    session, clock = world
    a, b, c = session("a"), session("b"), session("c")
    a.claim_master("a", 60)
    b.ping("b", 40)
    c.ping("c", 90)
    clock.t += coord.TTL_SECONDS + 1  # master silent: lease expired, candidates keep pinging
    b.ping("b", 40)
    c.ping("c", 90)
    with pytest.raises(coord.Refused):
        b.claim_master("b", 40)  # c has more quota
    c.claim_master("c", 90)
    assert c.status()["lease"]["master"] == "c"


def test_heartbeat_keeps_lease_and_flags_low_quota(world):
    session, clock = world
    a, b = session("a"), session("b")
    a.claim_master("a", 50)
    clock.t += coord.TTL_SECONDS - 60
    assert a.heartbeat("a", 40) is False
    clock.t += coord.TTL_SECONDS - 60
    with pytest.raises(coord.Refused):
        b.claim_master("b", 80)  # heartbeat kept the lease alive
    assert a.heartbeat("a", coord.LOW_QUOTA_PERCENT - 1) is True


def test_handoff_releases_lease_and_publishes_notes(world, tmp_path):
    session, _ = world
    a, b = session("a"), session("b")
    a.claim_master("a", 8)
    note = tmp_path / "h.md"
    note.write_text("# Handoff\nnext: T005\n", encoding="utf-8")
    a.handoff("a", note)
    b.claim_master("b", 70)  # vacant immediately, no TTL wait
    assert "next: T005" in (b.dir / "HANDOFF.md").read_text(encoding="utf-8")
    with pytest.raises(coord.Refused):
        a.heartbeat("a", 5)  # a is no longer master


def test_task_claims_are_exclusive_and_released(world):
    session, _ = world
    a, b = session("a"), session("b")
    a.claim_task("a", "T005")
    with pytest.raises(coord.Refused):
        b.claim_task("b", "T005")
    a.finish_task("a", "T005")
    b.claim_task("b", "T005")


def test_cloud_session_cannot_take_lab_task(world):
    session, _ = world
    with pytest.raises(coord.Refused):
        session("a").claim_task("a", "T003", needs_lab=True, cloud=True)
    session("a").claim_task("a", "T003", needs_lab=True, cloud=False)


def test_requires_hardware_is_read_from_tasks_json():
    assert coord._task_needs_lab(ROOT, "T003") in (True, False)
    assert coord._task_needs_lab(ROOT, "T-does-not-exist") is False


def test_assign_inbox_accept_done_roundtrip_with_claim(world):
    session, _ = world
    m, s = session("m"), session("s")
    m.claim_master("m", 70)
    ref = m.assign("m", "s", task="T005", branch="pilot/T005-x", priority="high")
    assert ref == "A0001"
    m.assign("m", "s", text="Write the docs page", priority="low")
    inbox = s.inbox("s")
    assert [r["id"] for r in inbox] == ["A0001", "A0002"]  # high priority first
    s.accept("s", "A0001")
    assert s.status()["claims"] == {"T005": "s"}
    with pytest.raises(coord.Refused):
        s.accept("s", "A0001")  # not pending any more
    rec = s.done("s", "Report: ok, tests run: none", "A0001")
    assert rec["status"] == "done" and s.status()["claims"] == {}
    assert [r["id"] for r in s.inbox("s")] == ["A0002"]
    rows = m.report()
    assert [(r["id"], r["status"]) for r in rows] == [("A0001", "done"), ("A0002", "pending")]
    assert "Report: ok" in rows[0]["report"]


def test_assignments_work_in_both_directions_and_after_a_role_swap(world):
    session, _ = world
    a, b = session("a"), session("b")
    a.claim_master("a", 60)
    a.assign("a", "b", task="T010")
    b.accept("b")  # single pending -> no --ref needed
    b.assign("b", "master", text="Found a blocker in the schema, please decide")  # sub -> master
    assert [r["from"] for r in a.inbox("a")] == ["b"]
    note = Path(a.dir).parent / "h.md"
    note.write_text("# Handoff\n", encoding="utf-8")
    a.handoff("a", note)
    b.claim_master("b", 70)  # roles swap
    a.assign("a", "master", task="T011")  # old master now sends work to the new master
    assert [r["id"] for r in b.inbox("b")] == ["A0001", "A0003"]  # A0001 accepted, still open
    b.accept("b", "A0003")
    b.assign("b", "a", task="T012")  # new master assigns to the old master
    assert [r["id"] for r in a.inbox("a")] == ["A0002", "A0004"]  # the sub's note + new task


def test_only_the_addressee_can_accept_or_finish(world):
    session, _ = world
    a, b, c = session("a"), session("b"), session("c")
    ref = a.assign("a", "b", task="T020")
    with pytest.raises(coord.Refused):
        c.accept("c", ref)
    with pytest.raises(coord.Refused):
        c.done("c", "report", ref)
    with pytest.raises(coord.Refused):
        a.assign("a", "a", task="T021")  # to self
    with pytest.raises(coord.Refused):
        a.assign("a", "master", task="T021")  # no live master


def test_accept_refused_when_task_claimed_by_someone_else(world):
    session, _ = world
    a, b = session("a"), session("b")
    a.claim_task("a", "T030")
    c = session("c")
    d = session("d")
    ref2 = d.assign("d", "c", task="T030")
    with pytest.raises(coord.Refused):
        c.accept("c", ref2)


@pytest.mark.parametrize("bad", [
    "connect to 192.0.2.50 and probe",
    "mac aa:bb:cc:dd:ee:ff is the camera",
    "token=abcdef123456",
    "password: hunter2",
    "serial number: DS-2CD2143",
    "key 0123456789abcdef0123456789abcdef0123",
    "http://user:pw@host/x",
])
def test_secrets_and_lab_identifiers_are_refused(world, bad):
    session, _ = world
    a = session("a")
    with pytest.raises(coord.Refused):
        a.assign("a", "b", text=bad)
    with pytest.raises(coord.Refused):
        a.assign("a", "b", task="T001", branch=bad)
    with pytest.raises(coord.Refused):
        a.done("a", bad, "A0001")
    assert a.report() == []  # nothing was published


def test_clean_text_and_versions_pass_validation(world):
    session, _ = world
    session("a").assign("a", "b", text="Bump lit to 3.2.1 and run pytest tests/test_coord.py")


def test_cli_assign_from_text_file_and_report(world, tmp_path, monkeypatch, capsys):
    remote = tmp_path / "remote.git"
    card = tmp_path / "card.md"
    card.write_text("Goal: tidy docs\n", encoding="utf-8")
    monkeypatch.setenv("COORD_REMOTE", str(remote))
    monkeypatch.setenv("COORD_DIR", str(tmp_path / "cli-clone"))
    assert coord.main(["assign", "--id", "m", "--to", "s", "--task", str(card), "--priority", "high"]) == 0
    assert coord.main(["report"]) == 0
    out = capsys.readouterr().out
    assert "A0001 [pending] m -> s (high) Goal: tidy docs" in out
    assert coord.main(["accept", "--id", "x"]) == coord.EXIT_REFUSED  # not the addressee / no candidates
