"""Value-free native audio attempt quarantine across an HA process crash.

Persist before device I/O. Only the original joined native close, or original
preflight evidence that open was never attempted, can clear that attempt. A
reopened pending record refuses new audio; it never recreates a session/close.
"""

from __future__ import annotations

import asyncio
import re
import weakref
from dataclasses import dataclass
from functools import partial

from .media_lifetime import join_owned
from .storage import AccessStore
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal

_OWNERS = weakref.WeakKeyDictionary()


def _validate(state):
    if (
        type(state) is not dict or set(state) != {"schema_version", "pending"}
        or type(state["schema_version"]) is not int or state["schema_version"] != 1
        or type(state["pending"]) is not dict or len(state["pending"]) > 128
    ):
        raise Refusal("audio_journal_invalid")
    for station, reference in state["pending"].items():
        if (
            type(station) is not str or not 1 <= len(station) <= 128
            or any(ord(c) < 32 or ord(c) == 127 for c in station)
            or type(reference) is not str or re.fullmatch(r"[0-9a-f]{32}", reference) is None
        ):
            raise Refusal("audio_journal_invalid")


@dataclass(repr=False)
class _Owner:
    store: object
    hass: object
    config: object
    path: str
    ports: tuple
    state: dict
    lock: object
    poisoned: bool = False


class NativeAudioAttemptJournal:
    def __init__(self, store, state):
        if type(store) is not AccessStore:
            raise ValueError("Original private HA store required")
        state = {"schema_version": 1, "pending": {}} if state is None else state
        _validate(state)
        _OWNERS[self] = _Owner(
            store, store.hass, store.hass.config, store.path,
            (store.async_save, store._save_strict, store.hass.async_add_executor_job),
            {"schema_version": 1, "pending": dict(state["pending"])}, asyncio.Lock(),
        )

    def _owner(self):
        o = _OWNERS.get(self)
        if (
            o is None or o.store.hass is not o.hass or o.hass.config is not o.config
            or o.store.path != o.path
            or not same_ports(o.ports, (
                o.store.async_save, o.store._save_strict, o.hass.async_add_executor_job,
            ))
        ):
            raise Refusal("audio_journal_unavailable")
        return o

    def pending(self):
        return dict(self._owner().state["pending"])

    async def reserve(self, station, reference, guard):
        o = self._owner()
        async with o.lock:
            guard()
            if o.poisoned or station in o.state["pending"]:
                raise Refusal("cleanup_failed")
            draft = {"schema_version": 1, "pending": {
                **o.state["pending"], station: reference,
            }}
            _validate(draft)
            # Keep the original uncertain reservation even if atomic save's
            # acknowledgement is lost. Cleanup may clear only this same ref.
            o.state = draft
            try:
                result, cancelled = await join_owned(o.ports[0](draft))
                if result is not None:
                    raise Refusal("audio_journal_unavailable")
                self._owner()
                if cancelled:
                    raise asyncio.CancelledError
                guard()
            except BaseException:
                o.poisoned = True
                raise

    async def clear_joined(self, station, reference):
        o = self._owner()
        async with o.lock:
            if o.state["pending"].get(station) != reference:
                raise Refusal("cleanup_failed")
            draft = {"schema_version": 1, "pending": {
                key: value for key, value in o.state["pending"].items() if key != station
            }}
            # This exact cleanup port only removes an original attempt. Unlike
            # new desired-state writes, it must remain durable during HA stop.
            # Borrow the same original private atomic writer/executor; never
            # change AccessStore's ordinary storage_stopping admission rule.
            result, cancelled = await join_owned(o.ports[2](partial(o.ports[1], draft)))
            if result is not None:
                raise Refusal("audio_journal_unavailable")
            self._owner()
            o.state = draft
            if not draft["pending"]:
                o.poisoned = False
            if cancelled:
                raise asyncio.CancelledError

    def retire(self):
        _OWNERS.pop(self, None)


@dataclass(frozen=True, repr=False)
class AudioQuarantine:
    """Durable refusal evidence, explicitly not a recreated native session."""

    station_id: str
    attempt_ref: str
    connection: object = None


def restore_audio_quarantines(journal, sessions, tts):
    if type(journal) is not NativeAudioAttemptJournal:
        raise Refusal("audio_journal_unavailable")
    for station, reference in journal.pending().items():
        if station in sessions or station in tts:
            raise Refusal("cleanup_failed")
        sessions[station] = AudioQuarantine(station, reference)
