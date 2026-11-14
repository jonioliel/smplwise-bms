"""WKWRITE-295 crash child (run by tests/test_wkwrite_295_crash.py, never by pytest directly).

Runs ONE native users/create through the real lineage code against the file-backed fake WisKey and terminates THIS Python process
with `os._exit(137)` at the requested crash window: no exception handler, `finally`, atexit hook or SQLite close runs. This is a real
OS process exit of a test child running Arx's lineage/writer modules - not the Arx server process and not the real transport.

argv: data_dir main_db fake_state window   (window: before_send | after_send_no_commit | after_commit_no_ack)
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from smplwise.services import wiskey_native_write as nw
from smplwise.services import wiskey_write_lineage as wl
from wkwrite_fake import FakeWisKey


def die() -> None:
    sys.stdout.flush()
    os._exit(137)


class DieOnMutation:
    """The frame of the mutation is handed to the transport and the process dies before WisKey commits anything."""

    def __init__(self, fake: FakeWisKey) -> None:
        self.fake = fake

    async def send_signed(self, command, parameters, *, operation_id):
        if command == "users/create":
            die()
        return await self.fake.send_signed(command, parameters, operation_id=operation_id)


def main() -> None:
    data_dir, main_db, state, window = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4]
    fake = FakeWisKey(state)
    lin = wl.open_lineage(data_dir, wl.SettingsAnchor(main_db), holder="crash-child")
    port = fake
    if window == "before_send":
        lin.begin_send = lambda operation_id: die()  # type: ignore[method-assign]
    elif window == "after_send_no_commit":
        port = DieOnMutation(fake)
    elif window == "after_commit_no_ack":
        fake.faults["users/create"] = ["exit_after_commit"]
        fake.on_step = lambda step: die()
    else:
        raise SystemExit(2)
    writer = nw.NativePeopleWriter(port, lin)
    actor = nw.WriteActor("arx-user-1", "Operator One", True)
    dec = nw.ArxDecision(str(uuid.uuid4()), "grant-1", 1, 1, datetime.now(timezone.utc))
    asyncio.run(writer.write("users/create", {"data": {"display_name": "Crash Person"}}, actor=actor, decision=dec,
                             create_origin_ref="arx-grant:crash-1"))
    print("UNREACHABLE: the write returned")
    sys.exit(0)


if __name__ == "__main__":
    main()
