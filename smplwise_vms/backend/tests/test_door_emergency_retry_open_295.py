"""WKOPENUNK-295 (WisKey emergency-event v2, P0-4): the EXPLICIT new OPEN attempt after an UNKNOWN.

The automatic OPEN retry stays OFF (`DW09_OPEN_RETRY_AFTER_UNKNOWN`). What exists is one door-level action: a system administrator, naming the door, starts one new attempt for a
door whose OPEN apply ended UNKNOWN. Fakes only (`ScriptedEmergencyEngine`): nothing reaches WisKey, Home Assistant, a station or a door."""
from __future__ import annotations

import datetime as dt

import pytest
from fake_doorwin_adapters import ProductWorld

from smplwise.services import door_emergency as de
from smplwise.services import door_windows_engine as dwe


@pytest.fixture()
def pw(settings, monkeypatch):
    w = ProductWorld(settings, monkeypatch, go_live=True)
    w.emergency_on()
    monkeypatch.setattr(dwe.WiskeyEmergencyEngine, "open_supported", True)
    assert w.put("/doors/emergency/settings", changes={"doors.emergency.open_enabled": "on"}, confirmed=True).json()["code"] == "attestation_required"
    assert w.post("/doors/emergency/attestation", version=de.ATTESTATION_VERSION, accepted=True, confirmed=True).status_code == 200
    assert w.put("/doors/emergency/settings", changes={"doors.emergency.open_enabled": "on"}, confirmed=True).status_code == 200
    return w


def tick(pw, seconds: int) -> None:
    pw.t[0] += dt.timedelta(seconds=seconds)


def door_row(pw, iid: str, station: str, relay: int = 1) -> dict:
    return pw.rows("SELECT state, code, attempts, next_at FROM door_emergency_doors WHERE incident_id = ? AND station_id = ? AND relay = ? AND phase = 'apply'", iid, station, relay)[0]


def apply_calls(pw, station: str) -> list:
    return [c for c in pw.emergency.calls if c["door"] == f"{station}:1" and c["phase"] == "apply"]


def retry(pw, iid: str, station: str, name: str, user: str | None = None):
    return pw.post(f"/doors/emergency/incidents/{iid}/retry-open", user, station_id=station, relay=1, confirm_door=name)


def test_an_unknown_open_is_retried_only_by_an_explicit_admin_action_naming_the_door(pw):
    assert de.DW09_OPEN_RETRY_AFTER_UNKNOWN is False
    pw.emergency.script = {f"{pw.ENTRY}:1": ["unknown", "acknowledged"]}
    inc = pw.press("open").json()["incident"]
    for _ in range(4):  # the clock runs, the retry tick runs: nothing is ever resent on its own
        tick(pw, 10)
        de.retry_tick(pw.db, pw.settings, pw.t[0])
    assert len(apply_calls(pw, pw.ENTRY)) == 1 and door_row(pw, inc["id"], pw.ENTRY)["state"] == "unknown"
    r = retry(pw, inc["id"], pw.ENTRY, "כניסה ראשית")
    assert r.status_code == 200, r.text
    assert len(apply_calls(pw, pw.ENTRY)) == 2, "exactly one new attempt, on the same per-door request id"
    assert len({c["request_id"] for c in apply_calls(pw, pw.ENTRY)}) == 1, "the per-door request id (and so the event fence) is unchanged"
    assert door_row(pw, inc["id"], pw.ENTRY)["state"] == "acknowledged"
    audit = pw.rows("SELECT action, details_json FROM audit_log WHERE action = 'door.emergency.retry_open'")
    assert len(audit) == 1 and "earlier_outcome" in audit[0]["details_json"] and "unknown" in audit[0]["details_json"]


def test_the_confirmation_must_name_the_door(pw):
    pw.emergency.script = {f"{pw.ENTRY}:1": ["unknown", "acknowledged"]}
    inc = pw.press("open").json()["incident"]
    tick(pw, 11)
    for wrong in ("דלת צד", "כן", " ", "כניסה"):
        r = retry(pw, inc["id"], pw.ENTRY, wrong)
        assert r.status_code == 409 and r.json()["code"] == "confirm_door_required", (wrong, r.text)
    assert len(apply_calls(pw, pw.ENTRY)) == 1
    assert retry(pw, inc["id"], pw.ENTRY, f"{pw.ENTRY}:1").status_code == 200, "the door key is accepted as the name as well"


def test_only_a_system_administrator(pw):
    pw.emergency.script = {f"{pw.ENTRY}:1": ["unknown", "acknowledged"]}
    inc = pw.press("open").json()["incident"]
    tick(pw, 11)
    pw.bind("opener", "site_admin")  # holds the emergency permissions, is NOT a system administrator
    r = retry(pw, inc["id"], pw.ENTRY, "כניסה ראשית", user="opener")
    assert r.status_code == 403, r.text
    assert len(apply_calls(pw, pw.ENTRY)) == 1


def test_only_an_unknown_door_of_a_live_open_incident_and_not_too_soon(pw):
    pw.emergency.script = {f"{pw.ENTRY}:1": ["unknown", "acknowledged"]}
    inc = pw.press("open").json()["incident"]
    assert retry(pw, inc["id"], pw.ENTRY, "כניסה ראשית").json()["code"] == "too_soon", "ten seconds apart, like the other bounded retries"
    tick(pw, 11)
    assert retry(pw, inc["id"], pw.SIDE, "דלת צד").json()["code"] == "door_not_unknown", "an acknowledged door is never retried"
    assert retry(pw, inc["id"], pw.ENTRY, "כניסה ראשית").status_code == 200
    assert retry(pw, inc["id"], pw.ENTRY, "כניסה ראשית").json()["code"] == "door_not_unknown", "the retried door is acknowledged now: no second one"
    assert pw.post("/doors/emergency/incidents/does-not-exist/retry-open", station_id=pw.ENTRY, relay=1, confirm_door="כניסה ראשית").json()["code"] == "not_retryable"


def test_a_lock_a_drill_and_a_released_incident_never_take_it(pw):
    pw.emergency.script = {f"{pw.ENTRY}:1": ["unknown"]}
    lock = pw.press("lock_secure").json()["incident"]
    tick(pw, 11)
    assert retry(pw, lock["id"], pw.ENTRY, "כניסה ראשית").json()["code"] == "not_retryable"
    pw.release(lock["id"], "lock_secure")
    tick(pw, 11)
    drill = pw.press("open", drill=True).json()["incident"]
    assert retry(pw, drill["id"], pw.ENTRY, "כניסה ראשית").json()["code"] == "not_retryable"
    assert not [c for c in pw.emergency.calls if c["kind"] == "open"], "a drill never reaches the engine"


def test_a_live_attempt_is_never_retried_and_one_at_a_time(pw):
    pw.emergency.script = {f"{pw.ENTRY}:1": ["unknown", "acknowledged"], f"{pw.SIDE}:1": ["unknown", "acknowledged"]}
    inc = pw.press("open").json()["incident"]
    tick(pw, 11)
    # a door row that is still pending/sent (a call in flight) blocks any other retry of the same incident
    with pw.db.connection() as conn:
        conn.execute("UPDATE door_emergency_doors SET state = 'sent' WHERE incident_id = ? AND station_id = ? AND phase = 'apply'", (inc["id"], pw.SIDE))
    assert retry(pw, inc["id"], pw.ENTRY, "כניסה ראשית").json()["code"] == "retry_in_progress"
    assert len(apply_calls(pw, pw.ENTRY)) == 1
