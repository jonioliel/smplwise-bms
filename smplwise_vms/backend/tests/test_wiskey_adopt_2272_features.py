"""WISKEY-ADOPT-2272 step 4: the installed-client consumers - WisKey's durable template queue, the durable event cursor and the
version-2 discovery reader (the v3 pacing companion reader is tested in test_wiskey_adopt_2272_contrib.py; the media terminal re-check
after `lease.confirm` and `window_open` in test_wiskey_mac_adopt_298*.py). Fakes only: no socket, no WhatsApp, no station."""
from __future__ import annotations

import asyncio
import json
import sqlite3
from typing import Any

import pytest

from smplwise.services import wiskey_direct_discovery as dd
from smplwise.services import wiskey_installed_features as wif


def apply_installed_features_migration(conn: sqlite3.Connection) -> None:
    """Review L3: the tables come from the numbered migration (the consumers run no DDL)."""
    from pathlib import Path

    from smplwise.db import MIGRATIONS_DIR

    conn.executescript((Path(MIGRATIONS_DIR) / wif.MIGRATION).read_text(encoding="utf-8"))


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)")
    apply_installed_features_migration(conn)
    return conn


# ================================================================ the template queue

def _job(state: str, result: Any = None, op: str = "op-1") -> dict[str, Any]:
    return {"schema_version": 1, "state": state, "result": result, "operation_id": op, "replay_available": False}


def _tpl(op: str = "op-1", req: str = "req-1") -> dict[str, Any]:
    return {"schema_version": 2, "request_id": req, "operation_id": op, "recipient_ref": "person-synthetic-7", "expected_person_revision": 1,
            "account": "acct", "template_name": "access_notice", "language": "he", "template_ref": "ref-1", "expected_template_revision": 1}


@pytest.mark.parametrize("raw,state,outcome", [
    (_job("queued"), "queued", "pending"),
    (_job("dispatching"), "dispatching", "pending"),
    (_job("completed", {"state": "accepted", "code": "provider_accepted", "provider_accepted": True}), "completed", "accepted"),
    (_job("completed", {"state": "not_sent", "code": "queue_expired", "retry_after_s": None}), "completed", "not_sent"),
    (_job("completed", {"state": "unknown", "code": "provider_outcome_unknown"}), "completed", "unknown"),
    (_job("unknown", {"state": "unknown", "code": "ack_lost_no_replay"}), "unknown", "unknown"),
    (_job("unknown", {"state": "not_sent", "code": "x"}), "unknown", "unknown"),  # an UNKNOWN job never becomes not_sent
    (_job("cancelled", {"state": "not_sent", "code": "cancelled_before_dispatch"}), "cancelled", "not_sent"),
    (_job("cancelled", {"state": "accepted"}), "cancelled", "unknown"),
    (_job("completed", {"state": "accepted", "provider_accepted": False}), "completed", "unknown"),
    ({**_job("queued"), "replay_available": True}, "unknown", "unknown"),
    ({**_job("queued"), "operation_id": "other"}, "unknown", "unknown"),
    ({**_job("queued"), "extra": 1}, "unknown", "unknown"),
    (None, "unknown", "unknown"),
])
def test_job_reader_is_closed_and_conservative(raw: Any, state: str, outcome: str) -> None:
    v = wif.read_job(raw, operation_id="op-1")
    assert (v.state, v.outcome) == (state, outcome)


class Client:
    def __init__(self, *answers: Any) -> None:
        self.answers = list(answers)
        self.calls: list[tuple[str, Any]] = []

    async def enqueue(self, template: dict[str, Any], ttl_s: int) -> Any:
        self.calls.append(("enqueue", (template["operation_id"], ttl_s)))
        return self._next()

    async def call(self, command: str, params: dict[str, Any]) -> Any:
        self.calls.append((command, params))
        return self._next()

    async def events(self, cursor: str | None, limit: int) -> Any:
        self.calls.append(("events", (cursor, limit)))
        return self._next()

    def _next(self) -> Any:
        a = self.answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return a


class Lost(Exception):
    outcome, code = "unknown", "connection_closed"


def test_enqueue_records_first_and_never_enqueues_an_operation_twice() -> None:
    conn = _db()
    jobs = wif.TemplateJobs(conn)
    client = Client(Lost())
    v = asyncio.run(jobs.enqueue(client, _tpl(), ttl_s=120))
    assert (v.outcome, v.code) == ("unknown", "connection_closed") and jobs.row("op-1")["outcome"] == "unknown"
    again = asyncio.run(jobs.enqueue(client, _tpl(), ttl_s=120))  # a restart / a retry of the caller: observed, not sent
    assert again.outcome == "unknown" and client.calls == [("enqueue", ("op-1", 120))]
    # the job is read from WisKey instead
    client.answers.append(_job("unknown", {"state": "unknown", "code": "ack_lost_no_replay"}))
    assert asyncio.run(jobs.refresh(client, "op-1")).outcome == "unknown"
    # a NEW operation with the same request id is refused locally
    dup = asyncio.run(jobs.enqueue(client, _tpl(op="op-2"), ttl_s=120))
    assert dup.code == "request_already_recorded" and len([c for c in client.calls if c[0] == "enqueue"]) == 1


def test_enqueue_reads_the_job_document_and_cancel_only_reports() -> None:
    conn = _db()
    jobs = wif.TemplateJobs(conn)
    client = Client(_job("queued"), _job("cancelled", {"state": "not_sent", "code": "cancelled_before_dispatch"}))
    assert asyncio.run(jobs.enqueue(client, _tpl(), ttl_s=60)).outcome == "pending"
    assert asyncio.run(jobs.cancel(client, "op-1")).outcome == "not_sent"
    assert jobs.row("op-1")["state"] == "cancelled"
    stored = json.dumps(conn.execute("SELECT * FROM wiskey_template_jobs").fetchall())
    assert "access_notice" not in stored and "person-synthetic-7" not in stored  # ids and states only (person_id not given here)


@pytest.mark.parametrize("ttl", [0, 301, True, "60"])
def test_enqueue_refuses_a_bad_ttl_locally(ttl: Any) -> None:
    client = Client()
    v = asyncio.run(wif.TemplateJobs(_db()).enqueue(client, _tpl(), ttl_s=ttl))
    assert (v.outcome, v.code) == ("not_sent", "invalid_fields") and client.calls == []


# ================================================================ the event cursor

def _page(records: list[tuple[int, str]], cursor: str, *, has_more: bool = False, all_delivered: bool = True) -> dict[str, Any]:
    return {"contract": "wiskey-event-cursor.v1", "schema_version": 1, "state": "page", "reason": None,
            "records": [{"sequence": s, "event": {"id": e, "type": "door"}} for s, e in records], "cursor": cursor, "reset_cursor": None,
            "has_more": has_more, "all_delivered": all_delivered, "source": "a" * 32}


def _reset(reason: str) -> dict[str, Any]:
    return {"contract": "wiskey-event-cursor.v1", "schema_version": 1, "state": "reset_required", "reason": reason, "records": [],
            "cursor": "old", "reset_cursor": "src.9.mac", "has_more": False, "all_delivered": False, "source": "b" * 32}


def test_pull_delivers_in_order_dedups_and_stores_the_cursor_after_the_handler() -> None:
    conn = _db()
    cur = wif.EventCursor(conn)
    seen: list[str] = []
    client = Client(_page([(1, "e1"), (2, "e2")], "c2", has_more=True, all_delivered=False), _page([(2, "e2"), (3, "e3")], "c3"))
    r1 = asyncio.run(cur.pull(client, lambda e: seen.append(e["id"]), limit=2))
    assert (r1.delivered, r1.has_more, r1.all_delivered) == (2, True, False) and cur.state()["cursor"] == "c2"
    r2 = asyncio.run(cur.pull(client, lambda e: seen.append(e["id"]), limit=2))
    assert seen == ["e1", "e2", "e3"] and r2.duplicates == 1 and r2.all_delivered is True
    assert client.calls == [("events", (None, 2)), ("events", ("c2", 2))]


def test_a_failing_handler_keeps_the_cursor_and_the_page_comes_again() -> None:
    conn = _db()
    cur = wif.EventCursor(conn)

    def boom(_e: dict[str, Any]) -> None:
        raise RuntimeError("downstream")

    client = Client(_page([(1, "e1")], "c1"), _page([(1, "e1")], "c1"))
    with pytest.raises(RuntimeError):
        asyncio.run(cur.pull(client, boom))
    assert cur.state()["cursor"] is None
    got: list[str] = []
    asyncio.run(cur.pull(client, lambda e: got.append(e["id"])))
    assert got == ["e1"] and cur.state()["cursor"] == "c1"


@pytest.mark.parametrize("reason", ["source_replaced", "cursor_ahead", "retention_gap"])
def test_a_reset_is_a_recorded_gap_never_all_delivered(reason: str) -> None:
    conn = _db()
    cur = wif.EventCursor(conn)
    client = Client(_reset(reason))
    r = asyncio.run(cur.pull(client, lambda e: None))
    assert (r.state, r.reason, r.all_delivered) == ("reset_required", reason, False)
    # nothing is read past an unacknowledged gap
    assert asyncio.run(cur.pull(client, lambda e: None)).state == "reset_pending" and len(client.calls) == 1
    ack = cur.acknowledge_reset()
    assert ack == {"reason": reason, "delivered": False} and cur.state()["cursor"] == "src.9.mac"
    assert cur.acknowledge_reset() is None


@pytest.mark.parametrize("mutate", [
    lambda d: d.update(contract="other"),
    lambda d: d.update(all_delivered=True, has_more=True),
    lambda d: d["records"].reverse(),  # out of sequence
    lambda d: d["records"][0]["event"].pop("id"),
    lambda d: d.update(reset_cursor="x"),
    lambda d: d.update(extra=1),
])
def test_page_reader_is_closed(mutate: Any) -> None:
    doc = _page([(1, "e1"), (2, "e2")], "c2")
    mutate(doc)
    with pytest.raises(wif.EventCursorError):
        wif.read_page(doc)


def test_a_reset_with_records_or_claiming_delivery_is_refused() -> None:
    for over in ({"all_delivered": True}, {"records": [{"sequence": 1, "event": {"id": "e"}}]}, {"reason": "other"}):
        with pytest.raises(wif.EventCursorError):
            wif.read_page({**_reset("retention_gap"), **over})


# ================================================================ discovery v2 (its own reader; v1 unchanged)

def _v2_doc(grant: Any = None) -> dict[str, Any]:
    from test_wkjoin_295 import JoinServer

    doc = JoinServer().capabilities_doc()
    doc["schema_version"] = 2
    doc["lifecycle"] = {**doc["lifecycle"], "event_cursor_resume": True}
    doc["native_installation"] = {"schema_version": 1, "contract": "wiskey-native-service-write.v2", "authority_mode": "permanent_full_installation",
                                  "grant_ref": grant, "source": "WisKey original automatic installation", "expires_at": None}
    return doc


GRANT = {"authority_ref": "installation:a", "authority_revision": 1, "scope_ref": "installation:a:all", "grant_id": "installation:a:grant",
         "grant_revision": 1, "permission_revision": 1}


def test_v2_document_is_read_and_v1_reader_still_refuses_it() -> None:
    cap, block = wif.read_capabilities_v2(_v2_doc(GRANT), "ref-1", manifest_grant=GRANT)
    assert cap.lists("users/create") and block["grant_ref"] == GRANT
    with pytest.raises(dd.DiscoveryError):
        dd.read_capabilities(_v2_doc(GRANT), "ref-1")  # the v1 reader is unchanged: a v2 document is not v1


@pytest.mark.parametrize("mutate,code", [
    (lambda d: d.update(schema_version=1), "capabilities_unsupported"),
    (lambda d: d["native_installation"].update(expires_at="2099-01-01T00:00:00Z"), "capabilities_invalid"),
    (lambda d: d["native_installation"].update(contract="wiskey-native-service-write.v1"), "capabilities_invalid"),
    (lambda d: d.update(lifecycle={**d["lifecycle"], "event_cursor_resume": False}), "lifecycle_unsupported"),
    (lambda d: d["native_installation"].update(grant_ref={**GRANT, "grant_revision": 2}), "installation_changed_reconnect_required"),
])
def test_v2_reader_refuses(mutate: Any, code: str) -> None:
    doc = _v2_doc(dict(GRANT))
    mutate(doc)
    with pytest.raises(dd.DiscoveryError) as exc:
        wif.read_capabilities_v2(doc, "ref-1", manifest_grant=GRANT)
    assert exc.value.code == code
