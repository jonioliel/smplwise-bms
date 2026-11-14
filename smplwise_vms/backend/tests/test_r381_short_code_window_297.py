"""WISKEYNEXT-297 slice B (board r381 "a temporary keypad code for vendors, for a day or an hour, through WisKey, with revocation").

Finding: for a VENDOR's technician this already exists - the external-access grant (CR-ARX-WISKEY-SHARED-IDENTITY, services/access_grants.py)
with `credential = 'pin'` takes UTC instants (any length up to the 14-day cap, so one hour is allowed), generates the PIN in WisKey with
`users/pin_generate` + `users/update` (catalog commands, HA feed), sends it by WhatsApp only to the confirmed number and strips it at the
end of the window or on a manual revoke. These tests prove the one-hour and the one-day cases end to end on fakes, so the board row can
be judged on evidence. What r381 would add beyond this (a code not bound to a person, a one-time code, visitors) needs a WisKey command
that is not in the catalog and an owner decision - see docs/changes/WISKEYNEXT-297-R381-TEMP-CODE.md.

FAKES ONLY (tests/fake_wiskey.FakeAccessEngine / FakeCodeTransport, injected clock): nothing here contacts WisKey, HA, a station, a door or
WhatsApp. The go-live permit is patched on inside the fixture exactly like tests/test_access_grants.py."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from test_access_grants import PHONE, SENTINELS, T0, Env  # helpers only (no test functions imported)
from tickets_world import API

from smplwise.services import access_grants as ag

UTC = timezone.utc


def z(t: datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    yield e
    ag.reset_for_tests()


def _approved(env: Env, vf: datetime, vu: datetime) -> str:
    r = env.request(vf=z(vf), vu=z(vu))
    assert r.status_code == 200, r.text
    gid = r.json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    return gid


def test_a_one_hour_code_is_sent_at_once_works_only_inside_the_hour_and_is_stripped_at_its_end(env):
    vf, vu = T0 + timedelta(minutes=30), T0 + timedelta(minutes=90)
    gid = _approved(env, vf, vu)
    env.run()
    g = env.grant(gid)
    assert g["state"] == "active" and g["code_due_at"] == z(T0), "the evening before has passed: the code is due at once (owner answer 4)"
    p = env.person_of(gid)
    assert (p["valid_from"], p["valid_until"]) == (z(vf), z(vu)), "WisKey validity is the exact hour, not a whole day"
    assert p["doors"] == {"st-a": [1]} and p["active"] is True
    env.run()
    assert len(env.transport.sent) == 1
    number, text = env.transport.sent[0]
    pin = env.person_of(gid)["pin"]
    assert number == PHONE and pin in SENTINELS and pin in text and "http" not in text
    # still inside the hour: nothing changes
    env.clock[0] = vu - timedelta(minutes=1)
    env.run()
    assert env.grant(gid)["state"] == "active" and env.person_of(gid)["pin"] == pin
    # the hour ends: R1 strips the PIN and the doors in WisKey
    env.clock[0] = vu
    env.run()
    g = env.grant(gid)
    assert g["state"] == "ended" and g["end_reason"] == "ended"
    p = env.person_of(gid)
    assert p["pin"] is None and p["doors"] == {} and p["active"] is False


def test_a_one_day_code_is_sent_the_evening_before_and_ends_with_the_day(env):
    vf = datetime(2026, 10, 21, 4, 0, tzinfo=UTC)   # Wed 07:00 Asia/Jerusalem
    vu = datetime(2026, 10, 21, 17, 0, tzinfo=UTC)  # Wed 20:00
    gid = _approved(env, vf, vu)
    env.run()
    assert env.grant(gid)["code_due_at"] == "2026-10-20T15:00:00Z", "18:00 local the evening before (owner answer 4)"
    env.run()
    assert env.transport.sent == []
    env.clock[0] = datetime(2026, 10, 20, 15, 0, tzinfo=UTC)
    env.run()
    assert len(env.transport.sent) == 1 and env.grant(gid)["code_state"] == "sent"
    env.clock[0] = vu
    env.run()
    assert env.grant(gid)["state"] == "ended" and env.person_of(gid)["pin"] is None


def test_a_manual_revoke_inside_the_hour_strips_the_code_at_once(env):
    gid = _approved(env, T0 + timedelta(minutes=5), T0 + timedelta(minutes=65))
    env.run()
    env.run()
    assert env.person_of(gid)["pin"] in SENTINELS
    assert env.post(f"/access-grants/{gid}/revoke").status_code == 200
    env.run()
    g = env.grant(gid)
    assert g["state"] == "revoked"
    p = env.person_of(gid)
    assert p["pin"] is None and p["doors"] == {} and p["active"] is False


@pytest.mark.parametrize("minutes", [1, 15, 60, 24 * 60, 14 * 24 * 60])
def test_any_window_up_to_the_fourteen_day_cap_is_accepted(env, minutes):
    vf = T0 + timedelta(hours=1)
    r = env.request(vf=z(vf), vu=z(vf + timedelta(minutes=minutes)))
    assert r.status_code == 200, r.text


def test_a_window_longer_than_the_cap_is_refused(env):
    vf = T0 + timedelta(hours=1)
    r = env.request(vf=z(vf), vu=z(vf + timedelta(days=14, minutes=1)))
    assert r.status_code == 422 and r.json()["details"]["code"] == "too_long"


def test_the_code_is_never_shown_to_anyone_in_arx(env):
    gid = _approved(env, T0 + timedelta(minutes=5), T0 + timedelta(minutes=65))
    env.run()
    env.run()
    pin = env.person_of(gid)["pin"]
    assert pin in SENTINELS
    for path in ("/access-grants", "/access-grants/digest", "/access-grants/export.csv"):
        r = env.c.get(f"{API}{path}")
        assert r.status_code == 200 and pin not in r.text, path
    assert all(pin not in a for a in env.answers)
