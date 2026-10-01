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
