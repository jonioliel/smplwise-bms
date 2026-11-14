"""An in-memory provider for the contract tests (section 12.2): sync tokens, etags, tombstones, 410-gone resync, injected failures and a
`user_*` side that plays the person editing the calendar outside Arx. No network, no credentials, no clock of its own."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, replace
from typing import Any

from .adapter import (Binding, ConnectionInfo, ExtCalendar, ExtDeletion, ExtEvent, Health, NeedsReauth, OutEvent, PullResult, PushResult, RateLimited, SyncError)

UTC = dt.timezone.utc


@dataclass
class _Rec:
    ev: ExtEvent
    seq: int


class FakeAdapter:
    def __init__(self, provider: str = "google") -> None:
        self.provider = provider
        self.calendars: dict[str, ExtCalendar] = {}
        self._events: dict[str, dict[str, _Rec]] = {}
        self._tombs: dict[str, dict[str, int]] = {}
        self._seq = 0
        self._etag = 0
        self._uid = 0
        self._min_valid: dict[str, int] = {}
        self._failures: list[tuple[str, SyncError]] = []
        self.calls: list[tuple[str, Any]] = []
        self.revoked = 0
        self.pushed: dict[str, OutEvent] = {}  # what each external event was last given (title, notes, location ...)
        self.health_state = Health("ok")

    # ------------------------------------------------------------ test controls (the provider side)
    def add_calendar(self, ref: str, name: str = "", *, can_write: bool = True, is_primary: bool = False) -> str:
        self.calendars[ref] = ExtCalendar(ref, name or ref, can_write, is_primary)
        self._events.setdefault(ref, {})
        self._tombs.setdefault(ref, {})
        return ref

    def fail_next(self, op: str, error: SyncError | None = None, *, times: int = 1) -> None:
        for _ in range(times):
            self._failures.append((op, error or SyncError("boom", code="provider_error")))

    def invalidate_tokens(self, ref: str) -> None:
        """Every token issued so far is gone (HTTP 410)."""
        self._min_valid[ref] = self._seq + 1

    def _bump(self) -> int:
        self._seq += 1
        return self._seq

    def _new_etag(self) -> str:
        self._etag += 1
        return f"e{self._etag}"

    def user_create(self, ref: str, title: str, start: dt.datetime, end: dt.datetime, *, notes: str = "", all_day: bool = False) -> str:
        self._uid += 1
        uid = f"ext{self._uid}"
        self._events[ref][uid] = _Rec(ExtEvent(uid, self._new_etag(), title, start, end, notes, all_day, updated=start), self._bump())
        return uid

    def user_edit(self, ref: str, uid: str, **fields: Any) -> None:
        rec = self._events[ref][uid]
        self._events[ref][uid] = _Rec(replace(rec.ev, etag=self._new_etag(), **fields), self._bump())

    def user_delete(self, ref: str, uid: str) -> None:
        self._events[ref].pop(uid)
        self._tombs[ref][uid] = self._bump()

    def events(self, ref: str) -> dict[str, ExtEvent]:
        return {u: r.ev for u, r in self._events[ref].items()}

    # ------------------------------------------------------------ the SyncAdapter protocol
    def _maybe_fail(self, op: str) -> None:
        for i, (o, err) in enumerate(self._failures):
            if o == op:
                del self._failures[i]
                raise err

    def health(self, connection: ConnectionInfo) -> Health:
        self.calls.append(("health", connection.id))
        return self.health_state

    def list_calendars(self, connection: ConnectionInfo) -> list[ExtCalendar]:
        self.calls.append(("list_calendars", connection.id))
        self._maybe_fail("list_calendars")
        return list(self.calendars.values())

    def pull(self, connection: ConnectionInfo, binding: Binding, since_token: str | None) -> PullResult:
        self.calls.append(("pull", since_token))
        self._maybe_fail("pull")
        ref = binding.external_ref
        if ref not in self.calendars:
            raise SyncError("unknown calendar", code="not_found")
        if since_token is None:
            return PullResult([r.ev for r in self._events[ref].values()], f"t{self._seq}")
        try:
            since = int(since_token[1:])
        except ValueError:
            return PullResult(full_resync_required=True)
        if since < self._min_valid.get(ref, 0) or since > self._seq:
            return PullResult(full_resync_required=True)
        changes: list[ExtEvent | ExtDeletion] = [r.ev for r in self._events[ref].values() if r.seq > since]
        changes += [ExtDeletion(u) for u, s in self._tombs[ref].items() if s > since]
        return PullResult(changes, f"t{self._seq}")

    def push(self, connection: ConnectionInfo, binding: Binding, event: OutEvent, ext_uid: str | None, etag: str | None) -> PushResult:
        self.calls.append(("push", event.arx_id))
        self._maybe_fail("push")
        if connection.scope != "read_write":
            raise SyncError("read-only connection", code="read_only")
        ref = binding.external_ref
        if ext_uid is None or ext_uid not in self._events[ref]:
            self._uid += 1
            ext_uid = f"ext{self._uid}"
        self.pushed[ext_uid] = event
        self._events[ref][ext_uid] = _Rec(ExtEvent(ext_uid, self._new_etag(), event.title, event.start, event.end, event.notes, event.all_day, event.tz, arx_id=event.arx_id,
                                                   updated=event.start), self._bump())
        return PushResult(ext_uid, self._events[ref][ext_uid].ev.etag)

    def delete(self, connection: ConnectionInfo, binding: Binding, ext_uid: str, etag: str | None) -> None:
        self.calls.append(("delete", ext_uid))
        self._maybe_fail("delete")
        ref = binding.external_ref
        if ext_uid in self._events[ref]:
            self._events[ref].pop(ext_uid)
            self._tombs[ref][ext_uid] = self._bump()

    def revoke(self, connection: ConnectionInfo) -> None:
        self.calls.append(("revoke", connection.id))
        self.revoked += 1


__all__ = ["FakeAdapter", "NeedsReauth", "RateLimited"]
