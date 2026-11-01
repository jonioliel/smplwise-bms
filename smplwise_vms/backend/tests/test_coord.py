"""Multi-Claude coordination: master lease, quota-ranked succession, handoff, task claims, lab gating.
Uses a local bare repository as the shared remote; no network and no real project state."""
from __future__ import annotations

import importlib.util
import json
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
    assert "A0001 Goal: tidy docs - pending" in out
    assert coord.main(["accept", "--id", "x"]) == coord.EXIT_REFUSED  # not the addressee / no candidates


def test_presence_note_and_agents_are_published_and_kept(world):
    session, clock = world
    a, b = session("a"), session("b")
    a.claim_master("a", 60)
    a.heartbeat("a", 55, note="merging T010", agents=["rev1|pilot/T010-x|review|20m"])
    b.ping("b", 80, note="T011 in progress", agents=[])
    a.heartbeat("a", 50)  # no note passed: previous note stays
    ov = b.overview()
    by = {s["id"]: s for s in ov["sessions"]}
    assert by["a"]["role"] == "master" and by["a"]["quota"] == 50
    assert by["a"]["note"] == "merging T010" and by["a"]["agents"] == ["rev1|pilot/T010-x|review|20m"]
    assert by["b"]["role"] == "sub" and by["b"]["note"] == "T011 in progress"
    clock.t += 120
    assert {s["id"]: s for s in a.overview()["sessions"]}["b"]["heartbeat_age_seconds"] == 120


def test_note_and_agents_are_validated_for_secrets(world):
    session, _ = world
    a = session("a")
    with pytest.raises(coord.Refused):
        a.ping("a", 50, note="probing 192.0.2.5")
    with pytest.raises(coord.Refused):
        a.ping("a", 50, agents=["x|branch|token=abc123|1h"])
    assert a.overview()["sessions"] == []


def test_overview_lists_assignments_and_cli_json(tmp_path, monkeypatch, capsys):
    remote = tmp_path / "remote.git"
    subprocess.run(["git", "init", "--bare", "--quiet", str(remote)], check=True)
    monkeypatch.setenv("COORD_REMOTE", str(remote))
    monkeypatch.setenv("COORD_DIR", str(tmp_path / "cli-clone2"))  # real clock: CLI only
    assert coord.main(["claim-master", "--id", "m", "--quota", "70"]) == 0
    assert coord.main(["ping", "--id", "s", "--quota", "40", "--note", "idle",
                       "--agents", "r1|pilot/x|rev|5m; r2|pilot/y|dev|9m"]) == 0
    assert coord.main(["assign", "--id", "m", "--to", "s", "--task", "T050", "--branch", "pilot/T050-x"]) == 0
    capsys.readouterr()
    assert coord.main(["report", "--json"]) == 0
    data = json.loads(capsys.readouterr().out)
    assert data["master"] == "m"
    s = {x["id"]: x for x in data["sessions"]}["s"]
    assert s["assignments"][0]["task"] == "T050" and s["agents"] == ["r1|pilot/x|rev|5m", "r2|pilot/y|dev|9m"]
    assert coord.main(["report"]) == 0
    text = capsys.readouterr().out
    assert "master: m" in text and "A0001 T050 pilot/T050-x pending" in text
    assert "now: idle" in text and "agent: r2|pilot/y|dev|9m" in text

def test_cancel_by_sender_releases_claim(world):
    session, _ = world
    a, b = session("a"), session("b")
    ref = a.assign("a", "b", task="T060")
    b.accept("b", ref)
    with pytest.raises(coord.Refused):
        b.cancel("b", ref)  # only the sender
    a.cancel("a", ref)
    assert b.status()["claims"] == {} and b.inbox("b") == []


def test_watch_reports_deltas_and_exit_codes(world):
    session, clock = world
    m, s = session("m"), session("s")
    m.claim_master("m", 70)
    s.ping("s", 60)
    assert s.watch("s")["code"] == 0  # nothing yet
    ref = m.assign("m", "s", task="T070")
    res = s.watch("s", quota=55)
    assert res["code"] == coord.WATCH_BASE + coord.W_INBOX and "NEW  A0001 from m" in res["events"][0]
    assert s.watch("s")["code"] == 0 and s.watch("s")["open_inbox"] == 1  # delta only, then quiet
    s.accept("s", ref)
    s.done("s", "closing report", ref)
    res = m.watch("m")
    assert res["code"] == coord.WATCH_BASE + coord.W_FINISHED and "DONE A0001 finished by s" in res["events"][0]
    assert m.watch("m")["code"] == 0
    clock.t += coord.TTL_SECONDS + 1  # master silent, lease expired
    res = s.watch("s")
    assert res["code"] == coord.WATCH_BASE + coord.W_VACANT + coord.W_SILENT
    assert any(e.startswith("LEASE vacant") for e in res["events"]) and any(e.startswith("SILENT m") for e in res["events"])
    assert s.watch("s")["code"] == coord.WATCH_BASE + coord.W_VACANT  # silence reported once, vacancy until claimed


def test_reservations_never_collide_and_release(world):
    session, _ = world
    a, b = session("a"), session("b")
    assert a.reserve("a", "migration", count=2, floor=47) == ["0048", "0049"]
    assert b.reserve("b", "migration", floor=47) == ["0050"]  # skips what a holds
    with pytest.raises(coord.Refused):
        b.reserve("b", "migration", value="48")
    assert a.reserve("a", "migration", value="0048") == ["0048"]  # idempotent for the owner
    with pytest.raises(coord.Refused):
        b.release_reserved("b", "migration", "0049")
    a.release_reserved("a", "migration", "0049")
    assert a.reservations()["migration"] == {"0048": "a", "0050": "b"}
    assert a.reserve("a", "port") == [str(coord.PORT_FLOOR)]
    assert b.reserve("b", "port") == [str(coord.PORT_FLOOR + 1)]
    with pytest.raises(coord.Refused):
        a.reserve("a", "cache")


@pytest.fixture
def code_repo(tmp_path):
    """A bare 'GitHub' with g0/intake and two pushed pilot branches, plus a working clone."""
    remote = tmp_path / "code.git"
    work = tmp_path / "work"
    subprocess.run(["git", "init", "--bare", "--quiet", str(remote)], check=True)
    subprocess.run(["git", "init", "--quiet", str(work)], check=True)
    ident = ["-c", "user.name=t", "-c", "user.email=t@localhost"]

    def git(*args):
        subprocess.run(["git", *ident, *args], cwd=work, check=True, capture_output=True, text=True)

    def commit(path, subject):
        target = work / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(subject, encoding="utf-8")
        git("add", "-A")
        git("commit", "--quiet", "-m", subject)

    git("remote", "add", "origin", str(remote))
    git("checkout", "--quiet", "-b", "g0/intake")
    commit(f"{coord.MIGRATIONS_DIR}/0047_base.sql", "release: 0.1.151 base")
    git("push", "--quiet", "origin", "g0/intake")
    git("checkout", "--quiet", "-b", "pilot/T080-x")
    commit(f"{coord.MIGRATIONS_DIR}/0049_feature.sql", "feat: T080 first")
    commit("a.txt", "feat: T080 second")
    git("push", "--quiet", "origin", "pilot/T080-x")
    git("checkout", "--quiet", "g0/intake")
    commit("b.txt", "merge: something new on intake")
    git("push", "--quiet", "origin", "g0/intake")
    git("checkout", "--quiet", "-b", "pilot/T081-y")
    commit("c.txt", "docs: T081")
    git("push", "--quiet", "origin", "pilot/T081-y")
    return work


def test_branches_lists_pilot_branches_with_ahead_behind_and_owner(code_repo):
    rows = coord.branches_info(code_repo, owners={"pilot/T080-x": "pc2-sub"})
    by = {r["branch"]: r for r in rows}
    assert set(by) == {"pilot/T080-x", "pilot/T081-y"}
    assert (by["pilot/T080-x"]["ahead"], by["pilot/T080-x"]["behind"]) == (2, 1)
    assert (by["pilot/T081-y"]["ahead"], by["pilot/T081-y"]["behind"]) == (1, 0)
    assert by["pilot/T080-x"]["owner"] == "pc2-sub" and by["pilot/T081-y"]["owner"] is None
    assert by["pilot/T081-y"]["subject"] == "docs: T081" and by["pilot/T081-y"]["age_seconds"] < 600


def test_max_migration_sees_pushed_pilot_branches(code_repo):
    assert coord.max_migration(code_repo) == 49  # 0049 exists only on a pushed pilot branch


def test_auto_handoff_fills_branches_claims_release_assignments(world, code_repo):
    session, _ = world
    m, s = session("m"), session("s")
    m.claim_master("m", 8)
    s.ping("s", 70, note="running T080 review", agents=["rev|pilot/T080-x|review|10m"])
    m.assign("m", "s", task="T080", branch="pilot/T080-x")
    s.accept("s")
    m.reserve("m", "migration", count=1, floor=coord.max_migration(code_repo))
    draft = m.handoff_draft(code_repo, "m")
    for needle in ("release: 0.1.151 base", "pilot/T080-x (s): +2 / -1", "- T080: s", "A0001 T080 -> s [accepted]",
                   "- migration 0050: m", "running T080 review", "agent: rev|pilot/T080-x|review|10m", "## To fill by hand"):
        assert needle in draft, needle
    m.handoff_text("m", draft)
    s.claim_master("s", 70)
    assert "pilot/T081-y" in (s.dir / "HANDOFF.md").read_text(encoding="utf-8")