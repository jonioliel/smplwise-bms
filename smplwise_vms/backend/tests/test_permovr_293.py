"""PERMOVR-293 (owner decision 2026-10-20 08:10, WisKey Q2): a person's own permission overrides are STATIONS of that person in the
station-permission gate of a write (services/intercom_writes.py `check_person`).

Before: the gate's "every station of the person before AND after the change" was the person's ASSIGNMENTS only - the closed superset
projection (intercom_adapter.project_person) dropped `permission_overrides`, so a personal allow or deny on a station outside the
writer's chain (a "foreign" station) was never checked. WisKey's `users/update` replaces the COMPLETE overrides dict, so a manager
scoped to entry-a could save a person and silently drop that person's deny on entry-b (or any write could touch a person whose access
reaches a station the writer does not hold).

Now: the override stations (allow AND deny) join the person's stations; each is decided by `rbac.authorize` over the station chain
(deny-overrides: an explicit deny binding of the writer on that station refuses even with an allow elsewhere); overrides that are
missing, redacted or malformed are UNKNOWN and refuse every writer who is not unrestricted (fail closed). Visibility is unchanged
(WisKey Q1: a malformed record stays hidden from a restricted operator; overrides never make a person visible or hidden).

Fakes only: the stateful fake WisKey (tests/fake_wiskey.py), CR-033's station scope double (tests/intercom_station_scope.py)."""
from __future__ import annotations

from typing import Any

import pytest
from conftest import as_user
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_intercom_writes_s11 import API, env, person, post, rev, sent, wx  # noqa: F401 - `wx` is a fixture

from smplwise.errors import ApiError
from smplwise.services import intercom_adapter
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_writes as iw

OWN_EDIT = {"permission_overrides": {"entry-a": "allow"}, "door_permissions": {"entry-a": [1]}}


def _overrides(fake: Any, user_id: str, value: Any) -> None:
    p = person(fake, user_id)
    assert p is not None
    if value is _MISSING:
        p.pop("permission_overrides", None)
    else:
        p["permission_overrides"] = value


_MISSING = object()


# ---------------------------------------------------------------- end to end: the routes over the fake WisKey

@pytest.mark.parametrize("effect", ["deny", "allow"])
def test_a_personal_override_on_a_foreign_station_is_a_station_of_the_person(wx, effect):
    """u6 is assigned to entry-a only (mia's station) but carries a personal override on entry-b (not hers). Saving u6 would replace the
    COMPLETE overrides dict - the entry-b entry is a change on a station off her chain: refused, nothing sent."""
    fake, c, _s = wx
    _overrides(fake, "u6", {"entry-b": effect})
    r = c.put(API + "/people/u6", json=env(data=OWN_EDIT, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 403 and r.json()["code"] == "intercom_person_scope" and r.json()["details"]["outcome"] == "not_sent", r.text
    r = post(c, "/people/u6/active", "mia", active=False, revision=rev(fake, "u6"))
    assert r.status_code == 403 and r.json()["code"] == "intercom_person_scope", r.text
    assert c.get(API + "/people/u6/editor", headers=as_user("mia")).status_code == 403, "the editor itself refuses (a person shared with a foreign station)"
    assert not sent(fake, "users/update") and not sent(fake, "users/set_active")
    assert person(fake, "u6")["permission_overrides"] == {"entry-b": effect}, "the foreign entry survives"


def test_an_override_on_the_writers_own_station_is_still_allowed(wx):
    fake, c, _s = wx
    _overrides(fake, "u6", {"entry-a": "allow"})
    r = c.put(API + "/people/u6", json=env(data={"display_name": "Gal B"}, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 200, r.text


def test_an_override_station_is_decided_per_station_and_a_deny_binding_wins(wx, station_scope):  # noqa: F811
    fake, c, _s = wx
    _overrides(fake, "u6", {"entry-b": "deny"})
    station_scope.bind("dev-mia", "site_admin", "entry-b")  # now an allow on entry-b as well: the override station is covered
    r = c.put(API + "/people/u6", json=env(data={"display_name": "Gal B"}, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 200, r.text
    station_scope.bind("dev-mia", "site_admin", "entry-b", effect="deny")  # an explicit deny on that station beats the allow
    r = c.put(API + "/people/u6", json=env(data={"display_name": "Gal C"}, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 403 and r.json()["code"] == "intercom_person_scope", r.text
    assert person(fake, "u6")["display_name"] == "Gal B"


@pytest.mark.parametrize("bad", [_MISSING, None, ["entry-b"], {"entry-b": "maybe"}, {"": "deny"}, {"entry-b": "deny", "x" * 200: "allow"}])
def test_unknown_or_malformed_overrides_fail_closed_for_a_restricted_writer(wx, bad):
    fake, c, _s = wx
    _overrides(fake, "u6", bad)
    r = c.put(API + "/people/u6", json=env(data={"display_name": "Gal B"}, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 403 and r.json()["code"] == "intercom_person_scope", (bad, r.text)
    assert not sent(fake, "users/update")
    r = c.put(API + "/people/u6", json=env(data={"display_name": "Root's"}, revision=rev(fake, "u6")), headers=as_user("root"))
    assert r.status_code == 200, "an unrestricted writer covers every station, known or not"


def test_a_person_the_writer_cannot_see_stays_the_uniform_404_whatever_the_overrides(wx):
    fake, c, _s = wx
    # u2 is on entry-b only: not mia's to see. A WELL-FORMED override set (integ/293): a malformed one makes the whole record unknown
    # since WISKEYARX-291 ARX-N03 (2.9.2), and check_person then refuses a restricted writer with 403 intercom_person_scope before
    # the visibility step (test_wiskeyarx_291::test_n03_...; open item in the 2.9.3 release report)
    _overrides(fake, "u2", {"entry-a": "allow", "entry-b": "deny"})
    answers = [post(c, f"/people/{uid}/active", "mia", active=False, revision=3) for uid in ("u2", "u-nobody")]
    assert {a.status_code for a in answers} == {404}, [a.text for a in answers]
    assert answers[0].json()["code"] == answers[1].json()["code"] == "intercom_person_not_found", "no existence oracle"


# ---------------------------------------------------------------- units: the projection and the gate

def test_the_superset_carries_the_override_stations_or_unknown():
    base = {"id": "u1", "revision": 1, "assignments": {"st-a": {"enabled": True, "allowed_locks": [1]}}}
    assert intercom_adapter.project_person({**base, "permission_overrides": {"st-b": "deny", "st-c": "allow"}})["override_stations"] == ["st-b", "st-c"]
    assert intercom_adapter.project_person({**base, "permission_overrides": {}})["override_stations"] == []
    for bad in ({}, {"permission_overrides": None}, {"permission_overrides": ["st-b"]}, {"permission_overrides": {"st-b": "maybe"}},
                {"permission_overrides": {"": "deny"}}, {"permission_overrides": {"st-b": "deny"}, "redacted_fields": ["access"]}):
        assert intercom_adapter.project_person({**base, **bad})["override_stations"] is None, bad


class _Auth(ia.Authority):
    """The real Authority's derived rules over a stated per-station answer (no database: a policy read fails closed to the safe choice)."""

    def __init__(self, stations: set[str], unrestricted: bool = False, denied: frozenset[str] = frozenset()) -> None:
        super().__init__(None, None)  # type: ignore[arg-type]
        self.stations, self.all, self.denied = stations, unrestricted, denied

    def station(self, perm, sid):
        return sid not in self.denied and (self.all or sid in self.stations)

    def unrestricted(self, perm):
        return self.all and not self.denied


def _superset(**over: Any) -> dict:
    base = {"id": "u1", "revision": 3, "assignments": [{"station_id": "st-a", "enabled": True, "doors": [1]}], "stations_known": True,
            "access_known": True, "override_stations": []}
    return {**base, **over}


def test_gate_station_ids_join_assignments_and_overrides():
    assert ia.person_gate_station_ids(_superset(override_stations=["st-b", "st-a"])) == ["st-a", "st-b"]
    assert ia.person_gate_station_ids(_superset(override_stations=None)) is None
    assert ia.person_gate_station_ids(_superset(stations_known=False)) is None
    assert ia.person_station_ids(_superset(override_stations=["st-b"])) == ["st-a"], "visibility keeps the assignments (Q1 unchanged)"


def test_check_person_covers_every_override_station():
    with pytest.raises(ApiError) as e:
        iw.check_person(_Auth({"st-a"}), _superset(override_stations=["st-b"]))
    assert e.value.code == "intercom_person_scope"
    assert iw.check_person(_Auth({"st-a", "st-b"}), _superset(override_stations=["st-b"])).stations == ["st-a", "st-b"]
    with pytest.raises(ApiError):
        iw.check_person(_Auth({"st-a", "st-b"}, denied=frozenset({"st-b"})), _superset(override_stations=["st-b"]))
    with pytest.raises(ApiError) as e:
        iw.check_person(_Auth({"st-a"}), _superset(override_stations=None))
    assert e.value.code == "intercom_person_scope", "unknown overrides refuse a restricted writer"
    assert iw.check_person(_Auth(set(), unrestricted=True), _superset(override_stations=None)).person is not None


def test_view_person_editable_counts_the_override_stations_and_q1_stays():
    assert ia.view_person(_Auth({"st-a"}), _superset())["editable"] is True
    assert ia.view_person(_Auth({"st-a"}), _superset(override_stations=["st-b"]))["editable"] is False
    assert ia.view_person(_Auth({"st-a"}), _superset(override_stations=None))["editable"] is False
    assert ia.view_person(_Auth({"st-a"}), _superset(override_stations=["st-b"])) is not None, "an override never hides a visible person"
    # WisKey Q1 (owner 2026-10-20): a malformed / incomplete record stays hidden from a restricted operator
    assert ia.view_person(_Auth({"st-a"}), _superset(stations_known=False)) is None
    assert ia.view_person(_Auth({"st-a"}), _superset(assignments=None)) is None
