"""WKR5-295 unit E (FAKES ONLY): the Arx emergency dispatcher drives wiskey-emergency-event.v2 through DirectEmergencyEngine.

The owner approved developing a NEW OPEN attempt after UNKNOWN (hand-off R5 unit E). The dispatcher's bounded retry of an UNKNOWN OPEN
apply now runs when - and only when - the engine is the v2 engine whose every retry is a new Request + operation on the same event
fence (`retry_of` = the UNKNOWN attempt); a live attempt is never retried and a durable release wins. The v1 rule (the SAME request
resent, DW09_OPEN_RETRY_AFTER_UNKNOWN) stays OFF. The WisKey side is tests/wkcap_fakes.FakeDirectPort; nothing here reaches WisKey,
Home Assistant, a station or a door, and no switch ships on."""
from __future__ import annotations

import datetime as dt

import pytest
from fake_doorwin_adapters import ProductWorld
from wkcap_fakes import FakeDirectPort

from smplwise.services import door_emergency as de
from smplwise.services import door_windows_engine as dwe
from smplwise.services import wiskey_emergency_direct as ed
from smplwise.services import wiskey_feature_direct as fd
from smplwise.services import wiskey_feature_exec as fx


@pytest.fixture()
def v2(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    pw.emergency_on()
    monkeypatch.setattr(dwe.WiskeyEmergencyEngine, "open_supported", True)
    assert pw.post("/doors/emergency/attestation", version=de.ATTESTATION_VERSION, accepted=True, confirmed=True).status_code == 200
    assert pw.put("/doors/emergency/settings", changes={"doors.emergency.open_enabled": "on"}, confirmed=True).status_code == 200
    with pw.db.connection(mode="read") as conn:
        admin = conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()["id"]
    with pw.db.connection() as conn:
        for d in pw.doors:
            fx.set_relay_map(conn, station_id=d.station_id, api_relay=d.relay, physical_relay=d.relay, confirmed_by=admin, expected_revision=0)
    port = FakeDirectPort()
    engine = ed.DirectEmergencyEngine(fd.FeatureAdapters(fd.DirectFeatureClient(port), port), lambda: pw.db.connection(),
                                      clock=lambda: dt.datetime.now(dt.timezone.utc), sleep=lambda s: None, polls=2)
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_FACTORY", lambda s: engine)
    pw.port, pw.engine = port, engine
    return pw


def starts(port: FakeDirectPort) -> list[dict]:
    return port.sent("features/start")


def door_rows(pw, iid: str, phase: str = "apply") -> dict[str, dict]:
    return {f"{r['station_id']}:{r['relay']}": r for r in pw.rows("SELECT * FROM door_emergency_doors WHERE incident_id = ? AND phase = ?", iid, phase)}


def test_the_v2_engine_is_what_lets_an_unknown_open_retry_and_the_v1_rule_stays_off():
    assert de.DW09_OPEN_RETRY_AFTER_UNKNOWN is False
    port = FakeDirectPort()
    v2_engine = ed.DirectEmergencyEngine(fd.FeatureAdapters(fd.DirectFeatureClient(port), port), lambda: None)
    assert de.v2_new_attempts(v2_engine) is True
    for other in (dwe.WiskeyEmergencyEngine(None), dwe.DrillEngine(), None):
        assert de.v2_new_attempts(other) is False
    assert de._retryable({"kind": "open"}, "apply", v2_engine) is True
    assert de._retryable({"kind": "open"}, "apply", dwe.WiskeyEmergencyEngine(None)) is False
    assert de._retryable({"kind": "lock_secure"}, "release", v2_engine) is False  # a LOCK release is never retried


def test_an_unknown_open_is_retried_as_a_new_attempt_on_the_same_fence(v2):
    pw = v2
    pw.port.start_script = ["ack_loss"]  # the FIRST door's hold: WisKey may have acted, the answer is lost
    r = pw.press("open")
    assert r.status_code == 201, r.text
    iid = r.json()["incident"]["id"]
    first = starts(pw.port)[0]
    door = f"{first['request']['params']['station_id']}:{first['request']['params']['relay']}"
    row = door_rows(pw, iid)[door]
    assert row["state"] == "unknown" and row["next_at"], "the bounded retry is planned (v2 engine)"
    sent_before = len(starts(pw.port))
    pw.t[0] += dt.timedelta(seconds=de.RETRY_GAP_S + 1)
    assert de.retry_tick(pw.db, pw.settings, pw.now()) == 1
    retry = starts(pw.port)[sent_before]
    assert len(starts(pw.port)) == sent_before + 1, "only the unknown door is attempted again"
    p0, p1 = first["policy_snapshot"]["private_input"], retry["policy_snapshot"]["private_input"]
    assert p1["event_ref"] == p0["event_ref"] and p1["command"] == "hold_open", "same event, same fence"
    assert p1["retry_of"] == first["request"]["operation_id"], "a NEW attempt naming the UNKNOWN one"
    assert retry["request"]["request_id"] != first["request"]["request_id"] and retry["request"]["operation_id"] != first["request"]["operation_id"]
    assert door_rows(pw, iid)[door]["state"] == "acknowledged"
    with pw.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT state FROM wiskey_feature_intents WHERE parameter_reference = ? ORDER BY rowid", (p0["event_ref"],)).fetchall()
    assert [x["state"] for x in rows] == ["unknown", "accepted"], "the old attempt keeps its UNKNOWN; nothing rewrote it"


def test_a_live_attempt_is_not_resent_by_the_dispatcher(v2):
    pw = v2
    pw.port.result_mode = "running"  # every hold is admitted and still running at the host
    iid = pw.press("open").json()["incident"]["id"]
    n = len(starts(pw.port))
    assert all(r["state"] == "unknown" for r in door_rows(pw, iid).values())
    for _ in range(de.MAX_ATTEMPTS):
        pw.t[0] += dt.timedelta(seconds=de.RETRY_GAP_S + 1)
        de.retry_tick(pw.db, pw.settings, pw.now())
    assert len(starts(pw.port)) == n, "a live attempt answers attempt_live: nothing is sent again"
    assert {r["code"] for r in door_rows(pw, iid).values()} <= {"attempt_live", "running"}


def test_a_durable_release_wins_over_a_pending_retry(v2):
    pw = v2
    pw.port.start_script = ["ack_loss"]
    iid = pw.press("open").json()["incident"]["id"]
    assert pw.release(iid, kind="open").status_code == 200
    n = len(starts(pw.port))
    pw.t[0] += dt.timedelta(seconds=de.RETRY_GAP_S + 1)
    de.retry_tick(pw.db, pw.settings, pw.now())
    later = starts(pw.port)[n:]
    assert all(s["policy_snapshot"]["private_input"]["command"] == "release" for s in later), "no hold goes out after the release"
