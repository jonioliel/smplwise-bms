"""WKWRITE-295 item 9: the THREE separate crash windows of a native people write, FAKES ONLY.

    window 1 - before send:                    the intent is committed, the send marker is not   -> recovery: not_sent
    window 2 - after send, no ACK:             the marker is committed, WisKey did not commit     -> recovery: unknown, resolve: unknown
    window 3 - after person+receipt COMMIT:    WisKey committed, the ACK never reached the lineage -> recovery: unknown, resolve: committed

Two kinds of experiment, labelled as what they are:
- SIMULATED (in-process): a `SimulatedKill` (BaseException) raised at the step; the dead writer's lineage object is abandoned without
  close (no lease release), and a new lineage is opened on the same files - a simulated process kill between steps of a fake transport.
- REAL PROCESS EXIT: a child Python process (tests/wkwrite_crash_child.py) runs the same write and ends itself with `os._exit(137)` at
  the step (no handler / finally / atexit / SQLite close). The parent reopens the files. It is a real OS process exit of a test child
  running the Arx lineage + writer code against a file-backed fake WisKey - NOT the Arx server process, NOT the direct transport, NOT
  WisKey. Neither experiment covers power loss.
In every window the people write is never sent a second time."""
from __future__ import annotations

import asyncio
import os
import sqlite3
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import wiskey_native_write as nw
from smplwise.services import wiskey_write_lineage as wl
from wkwrite_fake import FakeWisKey, SimulatedKill

BACKEND = Path(__file__).resolve().parents[1]
ACTOR = nw.WriteActor("arx-user-1", "Operator One", True)


def run(coro: Any) -> Any:
    return asyncio.run(coro)


def later() -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=31)  # the restarted process: the dead holder's lease has lapsed


def make_main(tmp: Path) -> Path:
    main = tmp / "smplwise.db"
    c = sqlite3.connect(main)
    c.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    c.commit()
    c.close()
    return main


def restart(tmp: Path, main: Path, fake: FakeWisKey) -> tuple[wl.WriteLineage, nw.NativePeopleWriter, str]:
    lin = wl.open_lineage(tmp, wl.SettingsAnchor(main), holder="restarted", clock=later)
    assert lin.status == "ok", lin.status
    scope = nw.parse_source(fake.source()).scope
    return lin, nw.NativePeopleWriter(fake, lin), scope


def creates(fake: FakeWisKey) -> int:
    return sum(1 for c, _ in fake.sent if c == "users/create")


def only_operation(lin: wl.WriteLineage) -> str:
    rows = lin.db.execute("SELECT operation_id FROM intents").fetchall()
    assert len(rows) == 1
    return rows[0][0]


# ---------------------------------------------------------------- SIMULATED process kill (in-process, fake transport)

@pytest.mark.parametrize("window", ["before_send", "after_send_no_commit", "after_commit_no_ack"])
def test_simulated_kill_in_each_window(tmp_path: Path, window: str):
    main = make_main(tmp_path)
    fake = FakeWisKey()
    dead = wl.open_lineage(tmp_path, wl.SettingsAnchor(main), holder="dead")
    if window == "before_send":
        def kill(operation_id: str) -> None:
            raise SimulatedKill("before_send")
        dead.begin_send = kill  # type: ignore[method-assign]
    elif window == "after_send_no_commit":
        fake.faults["users/create"] = ["kill_before_arrival"]
    else:
        fake.faults["users/create"] = ["kill_after_commit"]
    writer = nw.NativePeopleWriter(fake, dead)
    with pytest.raises(SimulatedKill):
        run(writer.write("users/create", {"data": {"display_name": "P"}}, actor=ACTOR, decision=nw.ArxDecision(
            str(uuid.uuid4()), "g", 1, 1, datetime.now(timezone.utc)), create_origin_ref="arx-grant:k-1"))
    # the process is gone: its lineage object is abandoned (no close, no lease release)
    lin, w, scope = restart(tmp_path, main, fake)
    op = only_operation(lin)
    counts = w.recover(scope)
    sent_before = creates(fake)
    if window == "before_send":
        assert counts == {"not_sent": 1, "unknown": 0} and lin.get(op).state == "not_sent" and sent_before == 0
        assert fake.s["users"] == {}
    elif window == "after_send_no_commit":
        assert counts == {"not_sent": 0, "unknown": 1}
        res = run(w.resolve(op))
        assert (res.state, res.code) == ("unknown", "remote:unknown") and fake.s["users"] == {}
    else:
        assert counts == {"not_sent": 0, "unknown": 1}
        res = run(w.resolve(op))
        assert (res.state, res.user_id, res.person_revision) == ("committed", "u-1", 1)
    assert creates(fake) == sent_before  # recovery and resolve never send the mutation again
    kinds = [p["kind"] for p in lin.proofs(op)]
    assert kinds[0] == "intent_committed" and ("recovered_before_send" in kinds) == (window == "before_send")
    lin.close()


# ---------------------------------------------------------------- REAL child-process exit

@pytest.mark.parametrize("window", ["before_send", "after_send_no_commit", "after_commit_no_ack"])
def test_real_process_exit_in_each_window(tmp_path: Path, window: str):
    main = make_main(tmp_path)
    state = tmp_path / "fake_wiskey.json"
    FakeWisKey(state).save()
    env = {**os.environ, "PYTHONPATH": os.pathsep.join([str(BACKEND), str(BACKEND / "tests")])}
    proc = subprocess.run([sys.executable, str(BACKEND / "tests" / "wkwrite_crash_child.py"), str(tmp_path), str(main), str(state), window],
                          cwd=str(tmp_path), env=env, capture_output=True, text=True, timeout=120)
    assert proc.returncode == 137, (proc.returncode, proc.stdout[-2000:], proc.stderr[-4000:])
    assert "UNREACHABLE" not in proc.stdout
    fake = FakeWisKey(state)  # WisKey's side as it was when the child died
    lin, w, scope = restart(tmp_path, main, fake)
    op = only_operation(lin)
    assert lin.get(op).state == ("intent" if window == "before_send" else "sending")  # what the dead process left on disk
    counts = w.recover(scope)
    if window == "before_send":
        assert counts == {"not_sent": 1, "unknown": 0} and fake.s["users"] == {}
    elif window == "after_send_no_commit":
        assert counts == {"not_sent": 0, "unknown": 1}
        assert run(w.resolve(op)).state == "unknown" and fake.s["users"] == {}
    else:
        assert counts == {"not_sent": 0, "unknown": 1} and fake.s["receipts"]
        res = run(w.resolve(op))
        assert (res.state, res.person_revision) == ("committed", 1)
    assert creates(fake) == 0  # the restarted process never sent users/create (the child's one attempt is WisKey's only copy)
    lin.close()
