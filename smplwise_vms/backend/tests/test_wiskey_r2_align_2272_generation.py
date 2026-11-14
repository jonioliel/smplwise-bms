"""WISKEY-R2-ALIGN-2272: deterministic interleavings (threads + explicit events) on the REAL functions for WisKey finding
WIN-R2-ARX-GEN-01: (a) a restart claim is read-and-written under one lock with CAS, (b) a late failure of install A never marks a newer
install B failed, (c) reconcile never overwrites the journal of B after the proof of A. Synthetic digests only; no platform, no network."""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

import pytest

from smplwise.db import get_setting, set_setting
from smplwise.errors import ApiError
from smplwise.services import ha_client
from smplwise.services import wiskey_auto_install as wai
from smplwise.services import wiskey_direct_join
from smplwise.services import wiskey_install_generation as gen

T = 10.0  # generous join timeout; a hang fails the test instead of the run


def _db(settings: Any) -> Any:
    from smplwise.main import create_app

    return create_app(settings).state.db


def _source(tmp_path: Path, name: str, body: str) -> Path:
    src = tmp_path / name
    src.mkdir()
    (src / "manifest.json").write_text('{"version":"1.0.0"}', encoding="utf-8")
    (src / "a.py").write_text(body, encoding="utf-8")
    return src


def _setting(db: Any, key: str) -> Any:
    with db.connection(mode="read", label="test read") as c:
        return get_setting(c, key)


@pytest.fixture(autouse=True)
def _clean_hook() -> Any:
    gen._test_hook = None
    yield
    gen._test_hook = None


def test_a_claim_is_one_critical_section_second_requester_waits_then_loses(settings: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db(settings)
    src = _source(tmp_path, "s1", "x = 1\n")
    calls: list[str] = []
    monkeypatch.setattr(ha_client, "call_service", lambda *_a, **_k: calls.append("restart") or {})
    inside, release = threading.Event(), threading.Event()
    first = {"done": False}

    def hook(point: str) -> None:  # A pauses INSIDE the claim critical section, right after its read
        if point == "claim:read" and not first["done"]:
            first["done"] = True
            inside.set()
            assert release.wait(T)

    gen._test_hook = hook
    res: dict[str, str] = {}
    ta = threading.Thread(target=lambda: res.__setitem__("a", wai.request_component_restart(db, settings, src)))
    ta.start()
    assert inside.wait(T)
    tb = threading.Thread(target=lambda: res.__setitem__("b", wai.request_component_restart(db, settings, src)))
    tb.start()
    tb.join(0.4)
    assert tb.is_alive() and "b" not in res  # B can not read between the read and the write of A: it waits on the shared lock
    release.set()
    ta.join(T)
    tb.join(T)
    assert res == {"a": "requested", "b": "already_requested"} and calls == ["restart"]
    j = gen.read(db)
    assert j is not None and j["state"] == gen.REQUESTED


def test_b_a_late_failure_of_install_a_never_marks_newer_install_b_failed(settings: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db(settings)
    src_a, src_b = _source(tmp_path, "sa", "x = 1\n"), _source(tmp_path, "sb", "x = 2\n")
    in_call, let_fail = threading.Event(), threading.Event()
    seen: list[str] = []

    def call_service(*_a: Any, **_k: Any) -> dict[str, Any]:
        seen.append("call")
        if len(seen) == 1:  # the restart call of install A is in flight (lock released) and fails late
            in_call.set()
            assert let_fail.wait(T)
            raise ApiError(502, "ha_unreachable", "synthetic")
        return {}

    monkeypatch.setattr(ha_client, "call_service", call_service)
    res: dict[str, str] = {}
    ta = threading.Thread(target=lambda: res.__setitem__("a", wai.request_component_restart(db, settings, src_a)))
    ta.start()
    assert in_call.wait(T)
    gen_a = gen.read(db)
    assert gen_a is not None and gen_a["state"] == gen.CLAIMED
    # while the call of A is outstanding the lock is free: install B starts a NEW generation and completes its own restart
    assert wai.request_component_restart(db, settings, src_b) == "requested"
    gen_b = gen.read(db)
    assert gen_b is not None and gen_b["generation_id"] != gen_a["generation_id"] and gen_b["state"] == gen.REQUESTED
    let_fail.set()
    ta.join(T)
    assert res["a"] == "restart_unknown"  # the caller of A still learns of its own failure ...
    assert gen.read(db) == gen_b  # ... but the journal of B is unchanged (not failed)
    assert _setting(db, wai.RESTART_DIGEST_KEY) == wai.source_digest(src_b)


def test_b_stale_finish_and_wrong_claim_are_cas_rejected(settings: Any) -> None:
    db = _db(settings)
    g1 = gen.begin(db, None, "d1")
    tok = gen.claim_restart(db, None, g1, "d1")
    assert tok and gen.claim_restart(db, None, g1, "d1") is None  # one claim only
    assert gen.finish_restart(db, None, g1, "not-the-claim", False) == gen.STALE
    g2 = gen.begin(db, None, "d2")
    assert g2 != g1 and gen.claim_restart(db, None, g1, "d1") is None  # a superseded generation can not claim
    assert gen.finish_restart(db, None, g1, tok, False) == gen.STALE
    j = gen.read(db)
    assert j is not None and j["generation_id"] == g2 and j["state"] == gen.STAGED


def test_c_reconcile_proof_of_a_does_not_overwrite_b(settings: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db(settings)
    with db.write_aside() as conn:
        set_setting(conn, wai.SWITCH_KEY, "on")
    g_a = gen.begin(db, None, "digest-a")
    monkeypatch.setattr(wai, "read_checked_installation", lambda *_a, **_k: {"readiness": "ready"})
    monkeypatch.setattr(wai, "sync_native_templates", lambda *_a, **_k: 1)
    in_io, resume = threading.Event(), threading.Event()

    class Port:
        def call(self, *_a: Any, **_k: Any) -> dict[str, Any]:  # the outside I/O of reconcile A (lock free)
            in_io.set()
            assert resume.wait(T)
            return {}

    class Join:
        capture_port = Port()

        def selected(self, _name: str) -> bool:
            return True

    monkeypatch.setattr(wiskey_direct_join, "JOIN", Join())
    res: dict[str, str] = {}
    t = threading.Thread(target=lambda: res.__setitem__("r", wai.reconcile_installation(db, settings)))
    t.start()
    assert in_io.wait(T)
    g_b = gen.begin(db, None, "digest-b")  # install B starts while the reconcile of A waits for WisKey
    assert gen.claim_restart(db, None, g_b, "digest-b")
    before = gen.read(db)
    resume.set()
    t.join(T)
    assert res["r"] == "registry_synced"
    assert gen.read(db) == before  # the proof of A was stale: state, claim and proof of B untouched
    assert before is not None and before["proof"] is None and before["generation_id"] == g_b and g_a != g_b


def test_c_proof_for_the_same_generation_is_merged_and_keeps_state(settings: Any) -> None:
    db = _db(settings)
    g = gen.begin(db, None, "d")
    tok = gen.claim_restart(db, None, g, "d")
    assert tok
    assert gen.record_proof(db, g, "reconcile", "registry_synced") == "recorded"
    assert gen.record_proof(db, g, "other-intent", "x") == gen.STALE
    j = gen.read(db)
    assert j is not None and j["state"] == gen.CLAIMED and j["claim"] == tok and j["proof"]["outcome"] == "registry_synced"
    assert gen.finish_restart(db, None, g, tok, True) == gen.REQUESTED  # the proof did not disturb the claim


def test_legacy_restart_claim_without_a_journal_still_blocks_a_replay(settings: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db(settings)
    src = _source(tmp_path, "sl", "x = 3\n")
    with db.write_aside() as conn:
        set_setting(conn, wai.RESTART_DIGEST_KEY, wai.source_digest(src))
    calls: list[str] = []
    monkeypatch.setattr(ha_client, "call_service", lambda *_a, **_k: calls.append("restart") or {})
    assert wai.request_component_restart(db, settings, src) == "already_requested" and calls == []
