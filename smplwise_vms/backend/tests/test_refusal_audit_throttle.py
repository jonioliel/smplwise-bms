"""The audit throttle of the refusals an anonymous caller can repeat at will (services/ha_user_auth.RefusalAudits):
per user AND reason for `rate_limited_user` (per address for `rate_limited_ip`), and the folded refusals are counted and
flushed - into the next row of the same key, or as an end-of-window summary row - never dropped."""
from __future__ import annotations

import json
import time

import pytest

from smplwise.services import ha_user_auth as hua


@pytest.fixture(autouse=True)
def _clean():
    hua.REFUSAL_AUDITS.clear()
    yield
    hua.REFUSAL_AUDITS.clear()


def _rows(db, reason: str | None = None) -> list[dict]:
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT reason, resource_id, details_json FROM audit_log WHERE action = 'auth.remote_session.rejected' ORDER BY id").fetchall()
    out = [{"reason": r["reason"], "resource_id": r["resource_id"], "details": json.loads(r["details_json"] or "{}")} for r in rows]
    return [r for r in out if reason is None or r["reason"] == reason]


def _refuse(db, reason: str, ip: str, user: str | None = None) -> None:
    hua._audit_refusal(db, actor=None, reason=reason, meta={"client_ip": ip}, subject=user)


def test_the_user_limit_is_throttled_per_user_and_reason_not_per_address(client):
    db = client.app.state.db
    # two users behind one address: one row each
    _refuse(db, "rate_limited_user", "198.51.100.1", "u-a")
    _refuse(db, "rate_limited_user", "198.51.100.1", "u-b")
    # one user from two addresses: still one row (and the second is counted)
    _refuse(db, "rate_limited_user", "198.51.100.2", "u-a")
    rows = _rows(db, "rate_limited_user")
    assert sorted(r["resource_id"] for r in rows) == ["u-a", "u-b"]
    # the address limit keeps its own key: the same address is one row per reason, whoever it asked for
    _refuse(db, "rate_limited_ip", "198.51.100.1")
    _refuse(db, "rate_limited_ip", "198.51.100.1")
    _refuse(db, "rate_limited_ip", "198.51.100.3")
    assert len(_rows(db, "rate_limited_ip")) == 2
    # a user and an address never share a key, even when the strings look alike
    assert hua._throttle_key("rate_limited_user", {"client_ip": "x"}, "u-a") != hua._throttle_key("rate_limited_ip", {"client_ip": "u-a"}, None)


def test_suppressed_counts_travel_with_the_next_row_of_the_same_key(client, monkeypatch):
    db = client.app.state.db
    for _ in range(4):
        _refuse(db, "rate_limited_user", "198.51.100.1", "u-a")
    assert len(_rows(db, "rate_limited_user")) == 1
    monkeypatch.setattr(hua.RefusalAudits, "WINDOW_S", 0.0)  # the next minute
    _refuse(db, "rate_limited_user", "198.51.100.1", "u-a")
    rows = _rows(db, "rate_limited_user")
    assert len(rows) == 2 and rows[-1]["details"]["suppressed_since_last"] == 3
    assert hua.flush_refusal_summaries(db) == 0  # nothing was left behind


def test_a_key_that_goes_quiet_gets_an_end_of_window_summary_row(client, monkeypatch):
    db = client.app.state.db
    monkeypatch.setattr(hua.RefusalAudits, "WINDOW_S", 0.2)
    for _ in range(6):
        _refuse(db, "rate_limited_user", "198.51.100.1", "u-quiet")
    assert len(_rows(db, "rate_limited_user")) == 1
    assert hua.flush_refusal_summaries(db) == 0  # the window is still open
    time.sleep(0.3)
    assert hua.flush_refusal_summaries(db) == 1
    rows = _rows(db, "rate_limited_user")
    assert len(rows) == 2 and rows[-1]["resource_id"] == "u-quiet"
    assert rows[-1]["details"]["suppressed"] == 5 and rows[-1]["details"]["summary"] == "window_end"
    assert hua.flush_refusal_summaries(db) == 0  # counted once


def test_another_keys_refusal_flushes_a_quiet_keys_summary(client, monkeypatch):
    db = client.app.state.db
    monkeypatch.setattr(hua.RefusalAudits, "WINDOW_S", 0.2)
    for _ in range(3):
        _refuse(db, "rate_limited_ip", "198.51.100.9")
    time.sleep(0.3)
    _refuse(db, "rate_limited_user", "198.51.100.1", "u-other")  # any later throttled refusal drains the ended windows
    summary = [r for r in _rows(db, "rate_limited_ip") if r["details"].get("summary")]
    assert len(summary) == 1 and summary[0]["details"]["suppressed"] == 2 and summary[0]["details"]["client_ip"] == "198.51.100.9"


def test_a_full_table_never_drops_a_held_count():
    a = hua.RefusalAudits()
    a.WINDOW_S = 0.05
    a.admit("held", {"reason": "rate_limited_user", "meta": {}, "resource_id": "u"})
    a.admit("held")
    a.admit("held")
    for i in range(20001):
        a.admit(f"k{i}")
    time.sleep(0.1)
    a.admit("trigger-prune-1")  # the rollover path prunes when the table is large
    assert [(k, n) for k, n, _ in a.expired()] == [("held", 2)]
