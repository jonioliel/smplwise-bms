"""SECFIX2-295: the open item of the 2.9.3 release report - "a restricted writer gets 403 instead of 404 for a malformed WisKey person
record of a person he cannot see".

Since WISKEYARX-291 ARX-N03 a malformed / incomplete record has an UNKNOWN station set; `intercom_writes.check_person` then refuses every
writer who is not unrestricted with 403 `intercom_person_scope` - BEFORE the visibility step. A restricted writer who could not see the
person (the read side hides a malformed record from a restricted operator: WisKey Q1) therefore tells "exists but malformed" (403) from
"does not exist" (404): an existence oracle for ids he may not see.

The switch `access.unknown_person_uniform_404` (default "true" since the owner decision 2026-10-21 - FABLEFIX-295; "false" = the former
403; a value an installation stored stays) answers such a caller the uniform
404 instead - the same bytes as an id WisKey does not know. A caller who CAN see the person (unrestricted `access.people.read` or
`access.people.manage`) keeps the 403: for him the person exists, and the 403 says why he may not change it. Fakes only (tests/fake_wiskey.py)."""
from __future__ import annotations

import json
from typing import Any

import pytest
from conftest import as_user
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_intercom_writes_s11 import API, env, person, post, rev, sent, wx  # noqa: F401 - `wx` is a fixture

from smplwise.errors import ApiError
from smplwise.services import intercom_adapter
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_writes as iw

KEY = "access.unknown_person_uniform_404"


def _switch(c, on: bool) -> None:
    r = c.patch("/api/v1/settings", json={KEY: "true" if on else "false"}, headers=as_user("root"))
    assert r.status_code == 200, r.text


def _malform(fake: Any, user_id: str, how: str) -> None:
    p = person(fake, user_id)
    assert p is not None
    if how == "overrides":
        p["permission_overrides"] = ["entry-b"]  # not a dict: the whole record is unknown since ARX-N03
    elif how == "assignment_row":
        p["assignments"]["entry-c"] = "garbled"
    elif how == "active":
        p.pop("active", None)
    else:
        raise AssertionError(how)


def _strip(r) -> str:
    d = r.json()
    d.pop("correlation_id", None)
    return json.dumps(d, sort_keys=True)


MALFORMS = ("overrides", "assignment_row", "active")


# ---------------------------------------------------------------- default (owner 2026-10-21): the uniform 404; a stored "false" stays


@pytest.mark.parametrize("how", MALFORMS)
def test_default_a_restricted_writer_gets_the_404_for_a_malformed_record(wx, how):
    fake, c, _s = wx
    _malform(fake, "u2", how)  # u2: entry-b only, not mia's to see; the switch was never saved
    r = post(c, "/people/u2/active", "mia", active=False, revision=3)
    assert r.status_code == 404, r.text
    assert not sent(fake, "users/set_active")


@pytest.mark.parametrize("how", MALFORMS)
def test_a_stored_false_keeps_the_former_403(wx, how):
    fake, c, _s = wx
    _switch(c, False)
    _malform(fake, "u2", how)
    r = post(c, "/people/u2/active", "mia", active=False, revision=3)
    assert r.status_code == 403 and r.json()["code"] == "intercom_person_scope", r.text
    assert not sent(fake, "users/set_active")


def test_the_switch_is_on_by_default_and_validated(wx):
    _fake, c, _s = wx
    got = c.get("/api/v1/settings", headers=as_user("root")).json()["settings"]
    assert got[KEY] == "true"
    assert c.patch("/api/v1/settings", json={KEY: "maybe"}, headers=as_user("root")).status_code == 422
    assert c.patch("/api/v1/settings", json={KEY: "true"}, headers=as_user("mia")).status_code == 403, "system.configure only"


# ---------------------------------------------------------------- switched on: no existence oracle


@pytest.mark.parametrize("how", MALFORMS)
def test_on_a_restricted_writer_gets_the_uniform_404_byte_identical_to_an_unknown_id(wx, how):
    fake, c, _s = wx
    _switch(c, True)
    _malform(fake, "u2", how)
    answers = [post(c, f"/people/{uid}/active", "mia", active=False, revision=3) for uid in ("u2", "u-nobody")]
    assert {a.status_code for a in answers} == {404}, [a.text for a in answers]
    assert _strip(answers[0]) == _strip(answers[1]), "no existence oracle: the same answer for a malformed record and for nobody"
    assert answers[0].json()["code"] == "intercom_person_not_found"
    assert not sent(fake, "users/set_active")


def test_on_every_write_route_and_the_editor_answer_the_same_404(wx):
    fake, c, _s = wx
    _switch(c, True)
    _malform(fake, "u2", "overrides")
    for uid in ("u2", "u-nobody"):
        r = c.put(API + f"/people/{uid}", json=env(data={"display_name": "X"}, revision=3), headers=as_user("mia"))
        assert r.status_code == 404 and r.json()["code"] == "intercom_person_not_found", (uid, r.text)
        r = c.get(API + f"/people/{uid}/editor", headers=as_user("mia"))
        assert r.status_code == 404 and r.json()["code"] == "intercom_person_not_found", (uid, r.text)
    assert not sent(fake, "users/update")


def test_on_a_malformed_record_of_the_writers_own_station_is_hidden_like_the_read_side(wx):
    """WisKey Q1: the read side hides a malformed record from a restricted operator - even one of her own station. The write side now
    agrees with it (404), instead of telling her the record exists."""
    fake, c, _s = wx
    _switch(c, True)
    _malform(fake, "u6", "overrides")  # u6: entry-a, mia's own station
    r = post(c, "/people/u6/active", "mia", active=False, revision=rev(fake, "u6"))
    assert r.status_code == 404 and r.json()["code"] == "intercom_person_not_found", r.text


def test_on_a_caller_who_can_see_the_person_keeps_the_403(wx):
    """otto: operator over the installation - reads every person (unrestricted access.people.read) but manages nobody. For him a
    malformed record is visible, so the refusal stays the explanatory 403."""
    fake, c, _s = wx
    _switch(c, True)
    _malform(fake, "u2", "overrides")
    r = post(c, "/people/u2/active", "otto", active=False, revision=3)
    assert r.status_code == 403, r.text


def test_on_an_unrestricted_writer_is_unaffected(wx):
    fake, c, _s = wx
    _switch(c, True)
    _malform(fake, "u2", "overrides")
    r = post(c, "/people/u2/active", "root", active=False, revision=rev(fake, "u2"))
    assert r.status_code == 200, r.text


def test_on_a_well_formed_foreign_person_stays_the_404_and_a_shared_one_the_403(wx):
    """The switch touches only the unknown-station branch: a well-formed person on a foreign station was already the uniform 404,
    and a well-formed person shared with a foreign station (visible) stays the 403."""
    fake, c, _s = wx
    _switch(c, True)
    r = post(c, "/people/u2/active", "mia", active=False, revision=3)
    assert r.status_code == 404 and r.json()["code"] == "intercom_person_not_found"
    p = person(fake, "u6")
    p["assignments"]["entry-b"] = {**p["assignments"]["entry-a"], "config_entry_id": "entry-b"}
    r = post(c, "/people/u6/active", "mia", active=False, revision=rev(fake, "u6"))
    assert r.status_code == 403 and r.json()["code"] == "intercom_person_scope", r.text


# ---------------------------------------------------------------- units: the gate itself


class _Auth(ia.Authority):
    def __init__(self, stations: set[str], *, read_all: bool = False, manage_all: bool = False, uniform: bool | None = False) -> None:
        super().__init__(None, None)  # type: ignore[arg-type]
        self.stations, self.read_all, self.manage_all, self.uniform = stations, read_all, manage_all, uniform

    def station(self, perm, sid):
        return sid in self.stations

    def unrestricted(self, perm):
        if perm == ia.PEOPLE_READ:
            return self.read_all
        if perm == iw.MANAGE:
            return self.manage_all
        return False

    def policy(self, key):
        if key == ia.UNKNOWN_PERSON_UNIFORM_404:
            if self.uniform is None:
                return super().policy(key)  # the real reader over no database: the documented fallback
            return self.uniform
        return False


def _unknown_person() -> dict[str, Any]:
    raw = {"id": "u9", "revision": 1, "active": True, "assignments": {"st-b": "garbled"}, "permission_overrides": {}, "group_ids": []}
    p = intercom_adapter.project_one_person(raw)
    assert ia.person_station_ids(p) is None
    return p


@pytest.mark.parametrize("uniform,status", [(False, 403), (True, 404)])
def test_unit_the_unknown_branch_follows_the_switch_for_a_caller_who_cannot_see(uniform, status):
    with pytest.raises(ApiError) as e:
        iw.check_person(_Auth({"st-a"}, uniform=uniform), _unknown_person())
    assert e.value.status == status


def test_unit_a_caller_with_unrestricted_read_keeps_the_403_when_on():
    with pytest.raises(ApiError) as e:
        iw.check_person(_Auth(set(), read_all=True, uniform=True), _unknown_person())
    assert e.value.status == 403 and e.value.code == "intercom_person_scope"


def test_unit_an_unreadable_switch_reads_as_the_uniform_404():
    """No database (the policy read fails): the switch reads "true" - the uniform 404 (the safe choice: no existence oracle). Both
    answers refuse the write."""
    with pytest.raises(ApiError) as e:
        iw.check_person(_Auth({"st-a"}, uniform=None), _unknown_person())
    assert e.value.status == 404


def test_the_switch_is_a_policy_key_with_the_current_default():
    assert ia.POLICY_DEFAULTS[ia.UNKNOWN_PERSON_UNIFORM_404] == "true" and ia.POLICY_ON_ERROR[ia.UNKNOWN_PERSON_UNIFORM_404] is True
