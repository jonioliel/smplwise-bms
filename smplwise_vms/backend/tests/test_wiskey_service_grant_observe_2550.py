"""LOWS-BRIDGE-GATE-2550 (deep review 2.52 WB-05): `GET /system/bridge-key/service-grant` no longer sends a signed WisKey read on every
call. A fresh observation (FRESHNESS_S, the same window the writes use) of the current connection that really sent the read is answered
as it is; a stale one, one of another connection, or one that sent nothing (a precondition: no read, no cost) is read again.
Fake direct join only (no socket, no WisKey)."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from smplwise.services import wiskey_direct_join  # noqa: E402
from smplwise.services import wiskey_service_grants_v3 as v3  # noqa: E402
from test_wiskey_service_grants_v3_2520 import REF2, Clock, FakeJoin, active_doc, fixture, source  # noqa: E402


def test_a_fresh_read_is_answered_without_a_new_one_and_a_stale_one_is_read_again() -> None:
    clock = Clock()
    join = FakeJoin(answers=[active_doc(), fixture("service_grants--current_v3.result.valid.json")])
    src = source(join, clock)
    first = src.observe()
    assert first.state == "active" and len(join.sent) == 1
    clock.t += v3.FRESHNESS_S - 1
    assert src.observe() is first and len(join.sent) == 1, "WB-05: no second signed read inside the freshness window"
    clock.t += 1
    assert src.observe().state == "absent_or_revoked" and len(join.sent) == 2, "stale: read again"


def test_another_connection_is_read_again() -> None:
    join = FakeJoin(answers=[active_doc(), fixture("service_grants--current_v3.result.valid.json")])
    src = source(join)
    assert src.observe().state == "active"
    join.session._link.connection_ref = REF2
    join.session.discovery.capabilities.connection_ref = REF2
    assert src.observe().state == "absent_or_revoked" and len(join.sent) == 2


def test_an_observation_that_sent_nothing_is_never_reused() -> None:
    join = FakeJoin(selected=False, answers=[active_doc()])
    src = source(join)
    assert src.observe().state == "unavailable" and join.sent == []
    join._selected = True
    join.session.transport_refusal = lambda command=None: None
    assert src.observe().state == "active" and len(join.sent) == 1, "the precondition cleared: read at once, not after 60 s"


def test_the_route_sends_one_read_for_two_visits(settings: Any, monkeypatch: Any) -> None:
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    join = FakeJoin(answers=[active_doc()])
    monkeypatch.setattr(wiskey_direct_join, "JOIN", join)
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    one = c.get("/api/v1/system/bridge-key/service-grant")
    two = c.get("/api/v1/system/bridge-key/service-grant")
    assert one.status_code == two.status_code == 200
    assert json.loads(one.text) == json.loads(two.text) and json.loads(two.text)["state"] == "active"
    assert join.sent == [("service_grants/current_v3", {})], "WB-05: the second visit inside the window sends nothing to WisKey"
