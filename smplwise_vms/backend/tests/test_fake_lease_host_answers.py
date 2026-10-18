"""ARX-FU 2-4: the fake WisKey lease host answers in the closed shapes of docs/contracts/wiskey-capture-lease/SCHEMA.md section 4."""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from fake_wiskey import LEASE_PERSON, FakeLeaseHost

CAPTURE_TECHNOLOGIES = ("TypeA_M1", "TypeA_CPU", "TypeB", "ID_125K", "FelicaCard", "DesfireCard")


class Clock:
    def now(self) -> int:
        return 1_800_000_000


def dto(action: str, **params):
    return SimpleNamespace(action=action, params=params, request_id="r1", actor_id="a1", station="entry-a")


def test_cancel_with_no_session_is_capture_not_found_not_acknowledged():
    host = FakeLeaseHost(Clock())
    a = host.handle_request(dto("capture_cancel", lease_ref="nope", session_id="x"))
    assert a == {"result": "refused", "request_id": "r1", "code": "capture_not_found"}
    assert a.get("cancelled") is None


def test_cancel_with_a_session_is_acknowledged():
    host = FakeLeaseHost(Clock())
    host.leases["L1"] = {"session_id": "s", "actor": "a1", "station": "entry-a", "state": "waiting", "card": None, "expires": Clock().now() + 60}
    assert host.handle_request(dto("capture_cancel", lease_ref="L1", session_id="s")) == {"result": "acknowledged", "request_id": "r1", "cancelled": True}


@pytest.mark.parametrize("tech", [None])
def test_the_fake_card_technology_is_a_wiskey_value(tech):
    host = FakeLeaseHost(Clock())
    host.leases["L1"] = {"session_id": "s", "actor": "a1", "station": "entry-a", "state": "waiting", "card": None, "expires": Clock().now() + 60}
    host.present_card("L1")
    t = host.leases["L1"]["card"]["technology"]
    assert t in CAPTURE_TECHNOLOGIES and t != "mifare"


def test_person_assignments_is_an_object_keyed_by_station_like_ManagedUser_public():
    assert isinstance(LEASE_PERSON["assignments"], dict) and not isinstance(LEASE_PERSON["assignments"], list)
    for sid, a in LEASE_PERSON["assignments"].items():
        assert a["config_entry_id"] == sid
