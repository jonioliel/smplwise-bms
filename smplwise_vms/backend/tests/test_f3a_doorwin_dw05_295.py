"""F3A-295 / Fable review 3 DW-05: an emergency RELEASE never needs the engine factory's permit (review 2 E-01) - a build whose permit is
False must still be able to end an incident a build with the permit started; only the release command itself has to exist. FAKES ONLY:
nothing reaches WisKey; the real `WiskeyEmergencyEngine` still answers `not_implemented` (LIVE_ENGINE_BUILT is False in the source)."""
from __future__ import annotations

import pytest
from fake_doorwin_adapters import ProductWorld

from smplwise.services import door_windows_engine as dwe


def test_the_live_engine_refuses_an_apply_without_the_permit_but_never_a_release_for_that_reason(monkeypatch):
    monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", False)
    eng = dwe.WiskeyEmergencyEngine(None)
    with pytest.raises(dwe.EngineError) as apply_exc:
        eng.apply("lock_secure", "st", 1, "req:st:1", "")
    assert apply_exc.value.kind == "not_permitted"
    with pytest.raises(dwe.EngineError) as release_exc:
        eng.release("lock_secure", "st", 1, "req:r:st:1")
    assert (release_exc.value.kind, release_exc.value.code) == ("not_implemented", "wiskey_emergency_coordinator_not_implemented"), \
        "the release reaches the (missing) release command; the permit is not consulted"


def test_with_the_permit_both_directions_answer_not_implemented_in_this_build():
    assert dwe.GO_LIVE_PERMITTED is True and dwe.LIVE_ENGINE_BUILT is False  # shipped constants, untouched
    eng = dwe.WiskeyEmergencyEngine(None)
    for call in (lambda: eng.apply("lock_secure", "st", 1, "r", ""), lambda: eng.release("lock_secure", "st", 1, "r")):
        with pytest.raises(dwe.EngineError) as exc:
            call()
        assert exc.value.kind == "not_implemented"


def test_an_incident_started_with_the_permit_is_released_through_the_real_engine_after_a_rollback(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    pw.emergency_on()
    iid = pw.press().json()["incident"]["id"]
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_FACTORY", dwe._emergency_engine)  # the build's own factory, not the fake
    monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", False)                          # ...in a build whose permit is False
    r = pw.release(iid)
    assert r.status_code == 200, r.text
    codes = {row["code"] for row in pw.rows("SELECT code FROM door_emergency_doors WHERE incident_id = ? AND phase = 'release'", iid)}
    assert codes and not any(c.startswith("not_permitted") for c in codes), codes
    assert codes == {"not_implemented:wiskey_emergency_coordinator_not_implemented"}
