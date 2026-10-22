"""ENTPOL-295 (Fable review 4, owner decision 3 of 2026-10-21): the automatic refusal while the service user is not restricted by an entity
policy - the bridge side (bridge 0.9.6, both copies), fail closed. Negative cases first.

On top of EXTID-295's group reading: (a) an ambiguous policy value - one Home Assistant would read by truthiness while an exact `is True`
said no (`control: 1`, `"yes"`, `0`) - is unknown = refused; (b) Home Assistant's own merged permission object
(`user.permissions.access_all_entities("control")`) has the last word, so a shape the group reading gets wrong cannot pass; a raising or
missing check = unknown = refused. Fakes only: no Home Assistant contacted."""
from __future__ import annotations

import asyncio
import hashlib
from types import SimpleNamespace

import pytest

from bridge_loader import MIRROR, SRC
from test_bridge_service_identity import EXTENDED_ITEMS, RESTRICTED, SECRET, SID, _hass, _obo, _signed, si, signing


class Perms:
    def __init__(self, every):
        self.every = every
        self.asked: list[str] = []

    def access_all_entities(self, key):
        self.asked.append(key)
        if isinstance(self.every, Exception):
            raise self.every
        return self.every


def _user(groups=RESTRICTED, **over):
    return SimpleNamespace(**{"id": SID, "is_active": True, "is_admin": False, "system_generated": False, "groups": groups, **over})


def _group(policy):
    return [SimpleNamespace(id="arx_service", policy=policy)]


def _screen(user, service, feature, body):
    msg = _signed({"user_id": SID, "request_id": "r1", "on_behalf_of": _obo(feature), **body})
    return asyncio.run(si.screen(_hass(**{SID: user}), signing.Verifier(SECRET), msg, service, SID, True))


def _error(result):
    return None if result[1] is None else result[1]["error"]


# ---------------------------------------------------------------- 1. ambiguous policy values: unknown, refused

@pytest.mark.parametrize("policy", [
    {"entities": {"all": {"control": 1}}},  # Home Assistant: truthy = control of every entity
    {"entities": {"all": {"control": "yes"}}},
    {"entities": {"all": {"control": [True]}}},
    {"entities": {"all": {"control": 0}}},  # falsy, but not a clear False either
    {"entities": {"all": 1}},
    {"entities": {"all": 0}},
    {"entities": {"all": []}},
    {"entities": 1},
    {"entities": []},
], ids=lambda p: repr(p))
def test_an_ambiguous_policy_value_is_unknown(policy):
    assert si.service_policy_restricted(_user(_group(policy))) is None


@pytest.mark.parametrize("service,feature,body", EXTENDED_ITEMS)
@pytest.mark.parametrize("policy", [{"entities": {"all": {"control": 1}}}, {"entities": {"all": {"control": "yes"}}}, {"entities": {"all": 0}}],
                         ids=["control-1", "control-yes", "all-0"])
def test_an_ambiguous_policy_refuses_every_extended_item(service, feature, body, policy):
    assert _error(_screen(_user(_group(policy)), service, feature, body)) == "service_identity_policy_default"


@pytest.mark.parametrize("policy,expected", [
    ({"entities": {"all": {"control": True}}}, False),
    ({"entities": {"all": {"control": False, "read": True}}}, True),
    ({"entities": {"all": {"control": None}}}, True),
    ({"entities": {"all": {"read": True}}}, True),
    ({"entities": {"all": False}}, True),
    ({"entities": {"all": None, "domains": {"light": True}}}, True),
    ({"entities": {}}, True),  # an empty entities policy: nothing at all
], ids=lambda v: repr(v))
def test_clear_policy_values_keep_their_meaning(policy, expected):
    assert si.service_policy_restricted(_user(_group(policy))) is expected


# ---------------------------------------------------------------- 2. Home Assistant's own permission object has the last word

@pytest.mark.parametrize("every,expected", [
    (True, False),  # the group reading said restricted, Home Assistant says every entity: not restricted
    ("x", False),  # any truthy answer counts as every entity
    (False, True),
    (None, True),
    (RuntimeError("boom"), None),  # a raising check: unknown
])
def test_home_assistants_permission_object_decides(every, expected):
    perms = Perms(every)
    assert si.service_policy_restricted(_user(permissions=perms)) is expected
    assert perms.asked == ["control"]


def test_a_permission_object_without_the_check_is_unknown():
    assert si.service_policy_restricted(_user(permissions=SimpleNamespace())) is None


def test_the_permission_object_is_not_asked_when_the_groups_already_refuse():
    perms = Perms(False)
    assert si.service_policy_restricted(_user([SimpleNamespace(id="system-users", policy={"entities": True})], permissions=perms)) is False
    assert perms.asked == []


@pytest.mark.parametrize("service,feature,body", EXTENDED_ITEMS)
def test_home_assistant_saying_every_entity_refuses_every_extended_item(service, feature, body):
    assert _error(_screen(_user(permissions=Perms(True)), service, feature, body)) == "service_identity_policy_default"
    assert _error(_screen(_user(permissions=Perms(RuntimeError("x"))), service, feature, body)) == "service_identity_policy_default"


# ---------------------------------------------------------------- 3. unreachable Home Assistant: the auth API raises - nothing admitted

def test_a_raising_user_lookup_admits_nothing():
    class DownAuth:
        async def async_get_user(self, user_id):
            raise ConnectionError("unreachable")

    msg = _signed({"user_id": SID, "request_id": "r1", "on_behalf_of": _obo(), "domain": "lock", "service": "unlock",
                   "data": {"entity_id": "lock.front"}})
    with pytest.raises(ConnectionError):  # the handler never runs; Home Assistant answers the service call with an error
        asyncio.run(si.screen(SimpleNamespace(auth=DownAuth()), signing.Verifier(SECRET), msg, "execute", SID, True))


def test_the_directory_push_sends_no_report_when_the_lookup_fails():
    text = (SRC / "__init__.py").read_text(encoding="utf-8")
    # the lookup sits outside the push's try: a failure ends the push, so the add-on's report ages out (ENTPOL-295 policy_stale)
    head = text.index("async def push_directory")
    body = text[head:text.index("async def sync_directory")]
    assert body.index("service_policy_restricted(await hass.auth.async_get_user(sid))") < body.index("try:")


# ---------------------------------------------------------------- 4. positive: restricted by groups AND by Home Assistant = admitted

@pytest.mark.parametrize("service,feature,body", EXTENDED_ITEMS)
def test_a_restricted_service_user_is_admitted_for_every_extended_item(service, feature, body):
    out, refused = _screen(_user(permissions=Perms(False)), service, feature, body)
    assert refused is None and out["user_id"] == SID and "on_behalf_of" not in out


def test_both_bridge_copies_are_byte_identical():
    a = hashlib.sha256((SRC / "service_identity.py").read_bytes()).hexdigest()
    b = hashlib.sha256((MIRROR / "service_identity.py").read_bytes()).hexdigest()
    assert a == b
