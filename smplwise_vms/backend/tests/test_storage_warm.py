"""The storage report is warmed in the background (once at a time, at most every 8 minutes unless forced), so a
request after a quiet spell finds a cached report instead of paying the cold NVR build."""
from __future__ import annotations

import time

from conftest import seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import storage


def _wait_idle(timeout=10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        with storage._warm_lock:
            if not storage._warm_state["running"]:
                return
        time.sleep(0.05)
    raise AssertionError("warm-up did not finish")


def test_warm_builds_once_and_respects_the_interval(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    calls = []
    monkeypatch.setattr(storage, "build", lambda _s, _tz, cams, now: calls.append(len(cams)) or {"summary": {"ok": True}, "cameras": [], "fetched_at": now.isoformat()})
    storage.invalidate()
    with storage._warm_lock:
        storage._warm_state.update(running=False, last=0.0, builds=0)
    assert storage.warm(app.state.db, settings) is True
    _wait_idle()
    assert calls == [0] and storage._warm_state["builds"] == 1
    # the next request is served from the warm cache without a build
    with app.state.db.connection() as conn:
        rep = storage.report(settings, conn)
    assert rep["cached"] is True and calls == [0]
    # within the interval nothing runs again; forced, it does
    assert storage.warm(app.state.db, settings) is False
    assert storage.warm(app.state.db, settings, force=True) is True
    _wait_idle()
    assert calls == [0, 0] and storage._warm_state["builds"] == 2
    # a failing build is logged, never raised, and releases the slot
    monkeypatch.setattr(storage, "build", lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("nvr down")))
    assert storage.warm(app.state.db, settings, force=True) is True
    _wait_idle()
    assert storage._warm_state["running"] is False and storage._warm_state["builds"] == 3
