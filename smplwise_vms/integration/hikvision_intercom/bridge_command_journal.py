"""Durable nonce admission before effects; contains no command payload values."""

from __future__ import annotations

import asyncio
import hashlib
import re
from datetime import timedelta

from .access.models import AccessError
from .trusted_actions.validation import aware


class BridgeCommandJournal:
    def __init__(self, store, state):
        self._store = store
        self._lock = asyncio.Lock()
        if state is None:
            state = {"schema_version": 1, "last_seen": None, "seen": {}}
        if (
            type(state) is not dict
            or set(state) != {"schema_version", "last_seen", "seen"}
            or type(state["schema_version"]) is not int
            or state["schema_version"] != 1
            or type(state["seen"]) is not dict
            or len(state["seen"]) > 4096
        ):
            raise AccessError("invalid_storage")
        if state["last_seen"] is not None:
            aware(state["last_seen"])
        for key, value in state["seen"].items():
            if type(key) is not str or re.fullmatch("[0-9a-f]{64}", key) is None:
                raise AccessError("invalid_storage")
            aware(value)
        self._state = state

    async def reserve(self, *, entry_id, user_id, nonce, now, guard):
        # This digest covers only public transport identifiers and a random
        # nonce. It never hashes a name/PIN/card/parameters or a request body.
        key = hashlib.sha256(f"{entry_id}\0{user_id}\0{nonce}".encode()).hexdigest()
        async with self._lock:
            guard()
            state = self._state
            if state["last_seen"] is not None and now < aware(state["last_seen"]):
                raise AccessError("Unauthorized")
            seen = {k: v for k, v in state["seen"].items() if now < aware(v)}
            if key in seen:
                raise AccessError("bridge_command_replayed")
            if len(seen) >= 4096:
                raise AccessError("bridge_command_capacity")
            seen[key] = (now + timedelta(seconds=120)).isoformat()
            draft = {"schema_version": 1, "last_seen": now.isoformat(), "seen": seen}
            task = asyncio.create_task(self._store.async_save(draft))
            cancelled = False
            while not task.done():
                try:
                    await asyncio.shield(task)
                except asyncio.CancelledError:
                    cancelled = True
            task.result()
            self._state = draft
            if cancelled:
                raise asyncio.CancelledError
            guard()
