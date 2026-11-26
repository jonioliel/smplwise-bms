"""LOWS-BRIDGE-GATE-2550 (deep review 2.52 WB-06, bridge 0.10.10): `keyset.Persister.control` rollback details.

(a) A failed rotation save rolls the key set back to the snapshot taken before the op; that snapshot can hold a high-water mark whose
    delayed save was still pending. The rollback must leave the set dirty so the mark is saved by the next persist (it used to be marked
    clean, and the mark waited for the next message to raise it again).
(b) A second control that arrives while the first one's save is in flight must not answer "ok" for a change the first one's rollback
    reverts: the lock covers the whole step (snapshot, op, save), so the second op runs after the rollback, on the state it reports.

Synthetic keys and the fakes of test_bridge_native_keyset_2520 only; nothing contacts a bridge, Home Assistant or WisKey."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from test_bridge_native_keyset_2520 import KID, World, bk, ksm, rotate, run  # noqa: E402


def _status(material: str, ts: int, gen: int = 1) -> dict:
    return bk.sign_with(KID, material, {"protocol": ksm.PROTOCOL, "op": "status", "rotation_id": f"synthetic-rotation-{gen}"}, ts=ts)


def test_a_rolled_back_control_keeps_an_unsaved_mark_dirty_and_saves_it_next():
    w = World()
    row = w.add()
    material = rotate(w, row)
    w.clock[0] += 5
    own = bk.sign_with(KID, material, {"op": "execute", "synthetic": True}, ts=int(w.now()))  # the bridge's own services: no save yet
    assert row.keyset.verify(own) is None and row.keyset.dirty
    mark = row.keyset.hw[KID]
    assert not row.saver.saved_through(KID, mark), "the delayed save is still pending"
    row.store.fail = 1
    try:
        run(row.saver.control(_status(material, int(w.now()))))
    except OSError:
        pass
    else:  # pragma: no cover - the synthetic store must fail
        raise AssertionError("the save was meant to fail")
    assert row.keyset.hw[KID] == mark, "the snapshot holds the mark"
    assert row.keyset.dirty, "WB-06 (a): after the rollback the unsaved mark is still to be saved"
    run(row.saver.persist())
    assert row.saver.saved_through(KID, mark) and row.store.saved[-1]["hw"][KID] == mark


def test_a_second_control_during_a_failing_save_never_answers_ok_for_a_reverted_change():
    w = World()
    row = w.add()
    material = rotate(w, row)
    assert row.keyset.old is not None, "the rotation is committed, the old key still verifies until retire"
    w.clock[0] += 1  # a new second: the status raises the mark, so its control really saves

    async def scenario() -> dict:
        row.store.gate, row.store.entered = asyncio.Event(), asyncio.Event()
        row.store.fail = 1
        gate = row.store.gate
        first = asyncio.create_task(row.saver.control(_status(material, int(w.now()))))
        await asyncio.wait_for(row.store.entered.wait(), 5)  # the first save is in flight
        retire = bk.sign_with(KID, material, {"protocol": ksm.PROTOCOL, "op": "retire", "rotation_id": "synthetic-rotation-1"},
                              ts=int(w.now()))
        second = asyncio.create_task(row.saver.control(retire))
        for _ in range(5):
            await asyncio.sleep(0)
        gate.set()
        try:
            await first
        except OSError:
            pass
        else:  # pragma: no cover
            raise AssertionError("the first save was meant to fail")
        return await second

    answer = run(scenario())
    assert answer["ok"] is True
    assert row.keyset.old is None, "WB-06 (b): the retire the second control answered 'ok' for is in effect"
    assert row.store.saved[-1]["old"] is None, "and it is saved"
