"""USR2 phase 3, the BRIDGE side (custom_components/smplwise_bridge/service_identity.py, bridge 0.9.0) - negative cases first.

The bridge decides independently of the add-on: a message acting for an Arx-only person (`on_behalf_of`) runs only as the ONE service identity
configured in the bridge's own options, never an administrator, only for the per-feature allow-list; automations, the area write and the
stream source never; the service identity never acts as itself; a local id is never a Home Assistant user. The person's id is attribution
only - forging it changes nothing about who acts. Fakes only: no Home Assistant is imported or contacted."""
from __future__ import annotations

import ast
import asyncio
from types import SimpleNamespace

import pytest

from bridge_loader import MIRROR, SRC, init_allowed_services, load

si = load("service_identity")
signing = load("signing")

SECRET = "pairing-secret"
SID = "a" * 32  # the service identity (32 hex)
OTHER = "b" * 32  # another, regular HA user
ADMIN = "c" * 32  # an HA administrator
LID = "l_01JABCDEFGHJKMNPQRSTVWXYZ0"  # an Arx-only person (l_ + 26 Crockford base32)


class FakeAuth:
    def __init__(self, users):
        self.users = users
        self.asked: list[str] = []

    async def async_get_user(self, user_id):
        self.asked.append(user_id)
        return self.users.get(user_id)


# 0.9.6 (CR-USR2 13.6): the service user in a group whose entity policy names only some devices - "restricted". Home Assistant's default
# for a regular user is the built-in `system-users` group, which allows every entity.
RESTRICTED = [SimpleNamespace(id="arx_service", name="Arx service", policy={"entities": {"entity_ids": {"light.x": True, "lock.front": True}}})]
DEFAULT_GROUPS = [SimpleNamespace(id="system-users", name="Users", policy={"entities": True})]


def _hass(**over):
    users = {
        SID: SimpleNamespace(id=SID, is_active=True, is_admin=False, system_generated=False, groups=RESTRICTED),
        OTHER: SimpleNamespace(id=OTHER, is_active=True, is_admin=False, system_generated=False),
        ADMIN: SimpleNamespace(id=ADMIN, is_active=True, is_admin=True, system_generated=False),
    }
    users.update(over)
    return SimpleNamespace(auth=FakeAuth(users))


def _signed(body: dict) -> dict:
    return signing.sign(SECRET, body)


def _obo(feature: str = "devices.control", **over) -> dict:
    return {"kind": "local", "user_id": LID, "feature": feature, **over}


def _execute(domain="light", service="turn_on", user_id=SID, obo=None, **extra) -> dict:
    body = {"user_id": user_id, "domain": domain, "service": service, "data": {"entity_id": f"{domain}.x"}, "request_id": "r1", **extra}
    if obo is not None:
        body["on_behalf_of"] = obo
    return _signed(body)


def _screen(msg: dict, service: str = "execute", configured=SID, hass=None, verifier=None):
    return asyncio.run(si.screen(hass or _hass(), verifier or signing.Verifier(SECRET), msg, service, configured))


def _error(result) -> str | None:
    msg, refused = result
    return None if refused is None else refused["error"]


# ---------------------------------------------------------------- refusals first

def test_a_bad_signature_is_refused_before_anything_else():
    msg = _execute(obo=_obo())
    msg["on_behalf_of"] = _obo(user_id="l_01JABCDEFGHJKMNPQRSTVWXYZ1")  # tampered after signing: the forged person breaks the signature
    hass = _hass()
    assert _error(_screen(msg, hass=hass)) == "bad_signature"
    assert hass.auth.asked == []


def test_on_behalf_of_must_name_the_configured_service_identity():
    assert _error(_screen(_execute(user_id=OTHER, obo=_obo()))) == "service_identity_refused"  # the add-on cannot pick another HA user
    assert _error(_screen(_execute(user_id=ADMIN, obo=_obo()), configured=ADMIN)) == "service_identity_admin"  # an admin is refused even when configured
    assert _error(_screen(_execute(obo=_obo()), configured=None)) == "service_identity_unconfigured"
    assert _error(_screen(_execute(obo=_obo()), configured="not-an-id")) == "service_identity_unconfigured"


@pytest.mark.parametrize("user", [None, SimpleNamespace(id=SID, is_active=False, is_admin=False, system_generated=False),
                                  SimpleNamespace(id=SID, is_active=True, is_admin=False, system_generated=True),
                                  SimpleNamespace(id=SID, is_active=True)])  # no is_admin attribute at all: treated as an administrator
def test_the_service_user_must_exist_be_active_human_and_not_admin(user):
    hass = _hass(**{SID: user})
    assert _error(_screen(_execute(obo=_obo()), hass=hass)) in ("service_identity_unknown_user", "service_identity_admin")


def test_the_service_identity_never_acts_as_itself_and_a_local_id_is_never_a_user():
    assert _error(_screen(_execute(user_id=SID))) == "service_identity_refused"  # no on_behalf_of -> the allow-list cannot be bypassed
    assert _error(_screen(_execute(user_id=LID))) == "service_identity_refused"
    assert _error(_screen(_execute(user_id=LID), configured=None)) == "service_identity_refused"


@pytest.mark.parametrize("obo", [
    "local", ["local"], {}, _obo(kind="ha"), _obo(user_id=OTHER), _obo(user_id="l_short"), _obo(user_id="l_01jabcdefghjkmnpqrstvwxyz0"),
    {**_obo(), "is_admin": True}, {**_obo(), "role": "system_admin"}, {"kind": "local", "user_id": LID},
])
def test_malformed_or_padded_on_behalf_of_is_refused(obo):
    assert _error(_screen(_execute(obo=obo))) == "service_identity_refused"


@pytest.mark.parametrize("feature,domain,service", [
    ("devices.control", "lock", "unlock"),  # a door: kept refused
    ("devices.control", "alarm_control_panel", "alarm_disarm"),  # the alarm is its own feature
    ("alarm", "switch", "turn_on"),  # a zone bypass switch is not arm / disarm
    ("alarm", "alarm_control_panel", "alarm_trigger"),
    ("alarm", "alarm_control_panel", "alarm_arm_custom_bypass"),  # review F1: arming with the bypass set is a zone bypass
    ("alarm", "select", "select_option"),
    ("devices.control", "script", "turn_on"),  # review F2: a script / scene may open a door or disarm (owner Q5 open)
    ("devices.control", "scene", "turn_on"),
    ("media", "light", "turn_on"),
    ("automations", "automation", "trigger"),
    ("system", "homeassistant", "restart"),
    ("devices.area", "light", "turn_on"),  # the spec's area key is off by default
])
def test_items_outside_the_feature_allow_list_are_refused(feature, domain, service):
    assert _error(_screen(_execute(domain=domain, service=service, obo=_obo(feature)))) == "service_identity_refused"


@pytest.mark.parametrize("item", sorted(si.NEVER_LOCAL))
def test_never_local_items_are_refused_even_when_a_table_lists_them(monkeypatch, item):
    """Review F1 / F2: an explicit rule, not only the shape of the tables - a widened table still cannot carry them for a local identity."""
    for feature in ("devices.control", "alarm", "media"):
        widened = {k: dict(v) for k, v in si.SERVICE_FEATURES.items()}
        widened[feature]["execute"] = frozenset(widened[feature]["execute"]) | {item}
        monkeypatch.setattr(si, "SERVICE_FEATURES", widened)
        assert _error(_screen(_execute(domain=item[0], service=item[1], obo=_obo(feature)))) == "service_identity_refused", (feature, item)
    out, refused = _screen(_execute(domain=item[0], service=item[1], user_id=OTHER))
    assert refused is None  # a Home Assistant user is untouched by the never-list (its own allow-list and Arx RBAC decide)


def test_services_outside_every_feature_are_refused():
    base = {"user_id": SID, "request_id": "r1", "on_behalf_of": _obo("devices.control")}
    assert _error(_screen(_signed({**base, "op": "upsert", "kind": "automation"}), "config_item")) == "automation_write_requires_ha_identity"
    assert _error(_screen(_signed({**base, "op": "trigger", "on_behalf_of": _obo("schedules")}), "config_item")) == "automation_write_requires_ha_identity"
    assert _error(_screen(_signed({**base, "entity_id": "light.x", "area_id": "kitchen"}), "set_entity_area")) == "service_identity_refused"
    assert _error(_screen(_signed({**base, "entity_id": "camera.x", "on_behalf_of": _obo("media")}), "stream_source")) == "service_identity_refused"
    assert _error(_screen(_signed({**base, "op": "play", "entity_id": "media_player.tv", "on_behalf_of": _obo("media")}), "cast_stream")) == "service_identity_refused"
    assert _error(_screen(_signed({**base, "op": ["play"], "entity_id": "media_player.tv", "on_behalf_of": _obo("cast")}), "cast_stream")) == "service_identity_refused"
    assert _error(_screen(_signed({**base, "query": "secrets", "on_behalf_of": _obo("media")}), "media_query")) == "service_identity_refused"
    assert _error(_screen(_signed({**base, "op": "purge", "on_behalf_of": _obo("schedules")}), "schedule")) == "service_identity_refused"


# ---------------------------------------------------------------- what is allowed, and what reaches the handler

@pytest.mark.parametrize("service,feature,body", [
    ("execute", "devices.control", {"domain": "light", "service": "turn_on", "data": {"entity_id": "light.x"}}),
    ("execute", "alarm", {"domain": "alarm_control_panel", "service": "alarm_arm_away", "data": {"entity_id": "alarm_control_panel.h"}}),
    ("execute", "alarm", {"domain": "alarm_control_panel", "service": "alarm_disarm", "data": {"entity_id": "alarm_control_panel.h"}}),
    ("execute", "media", {"domain": "media_player", "service": "volume_set", "data": {"entity_id": "media_player.x", "volume_level": 0.2}}),
    ("media_query", "media", {"query": "queue", "entity_id": "media_player.x"}),
    ("cast_stream", "cast", {"op": "stop", "entity_id": "media_player.tv"}),
    ("schedule", "schedules", {"op": "add", "payload": {}}),
])
def test_allowed_items_pass_as_the_service_identity_without_the_attribution_block(service, feature, body):
    msg = _signed({"user_id": SID, "request_id": "r1", "on_behalf_of": _obo(feature), **body})
    out, refused = _screen(msg, service)
    assert refused is None
    assert "on_behalf_of" not in out and out["user_id"] == SID  # the handler's strict key sets and Context(user_id) see the service identity only
    assert {k: out[k] for k in body} == body


def test_forged_attribution_never_changes_who_acts():
    """Two signed messages that differ only in the person: both act as the service identity - nothing authorises by the attribution."""
    a, _ = _screen(_execute(obo=_obo()))
    b, _ = _screen(_execute(obo=_obo(user_id="l_01JZZZZZZZZZZZZZZZZZZZZZZZ")))
    assert a["user_id"] == b["user_id"] == SID


def test_ha_users_are_untouched():
    out, refused = _screen(_execute(user_id=OTHER))
    assert refused is None and out["user_id"] == OTHER and "on_behalf_of" not in out
    out, refused = _screen(_execute(user_id=OTHER), configured=None)  # the bridge without a service identity behaves exactly as 0.8.0
    assert refused is None and out["user_id"] == OTHER


def test_the_signature_is_spent_once_and_the_handler_gets_preverified():
    verifier = signing.Verifier(SECRET)
    msg = _execute(obo=_obo())
    assert _screen(msg, verifier=verifier)[1] is None
    assert _error(_screen(msg, verifier=verifier)) == "replay"
    assert si.PREVERIFIED.verify({"anything": 1}) is None


def test_options_flow_check():
    hass = _hass()
    assert asyncio.run(si.options_error(hass, "")) is None
    assert asyncio.run(si.options_error(hass, SID)) is None
    assert asyncio.run(si.options_error(hass, ADMIN)) == "service_user_admin"
    assert asyncio.run(si.options_error(hass, "d" * 32)) == "service_user_unknown"
    assert asyncio.run(si.options_error(hass, "ABC")) == "service_user_format"
    assert asyncio.run(si.options_error(hass, LID)) == "service_user_format"


# ---------------------------------------------------------------- the tables, the wiring and the version

def test_feature_tables_are_inside_the_execute_allow_list():
    allowed = init_allowed_services()
    assert si.DEVICE_PAIRS == allowed - {p for p in allowed if p[0] == "alarm_control_panel"} - si.NEVER_LOCAL
    assert si.ALARM_PAIRS <= allowed and ("alarm_control_panel", "alarm_trigger") not in si.ALARM_PAIRS
    assert not (si.ALARM_PAIRS | si.DEVICE_PAIRS) & si.NEVER_LOCAL
    assert {("lock", "unlock"), ("script", "turn_on"), ("scene", "turn_on"), ("alarm_control_panel", "alarm_arm_custom_bypass")} <= si.NEVER_LOCAL
    assert si.MEDIA_PAIRS <= si.DEVICE_PAIRS and all(d in si.MEDIA_DOMAINS for d, _ in si.MEDIA_PAIRS)
    assert set(si.SERVICE_FEATURES) == {"devices.control", "alarm", "media", "cast", "schedules"}
    assert not any(s in svc for svc in si.SERVICE_FEATURES.values() for s in ("config_item", "set_entity_area", "stream_source"))


def test_every_signed_service_is_screened_and_no_handler_verifies_again():
    """Every service registered in __init__.py goes through screen() first; the module handlers get PREVERIFIED (their own verify would answer
    `replay`); the strict schemas accept the optional `on_behalf_of` block."""
    text = (SRC / "__init__.py").read_text(encoding="utf-8")
    for name in ("SERVICE_EXECUTE", "SERVICE_SET_AREA", "SERVICE_SCHEDULE", "SERVICE_STREAM_SOURCE", "SERVICE_MEDIA_QUERY", "SERVICE_CAST_STREAM", "SERVICE_CONFIG_ITEM"):
        assert f"await screened({name}, call)" in text, name
    assert "verifier.verify(msg)" not in text
    assert text.count("service_identity.PREVERIFIED") == 5
    assert text.count('vol.Optional("on_behalf_of"): dict') == 3  # the three PREVENT_EXTRA schemas (stream_source, media_query, cast_stream)
    assert '"service_user_id": service_identity.configured_id(service_user_id())' in text  # the add-on's health check learns the bridge's copy
    tree = ast.parse(text)
    assert tree is not None


def test_version_092_and_both_copies_identical():
    import json

    for root in (SRC, MIRROR):
        assert json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.10.1"
        assert 'VERSION = "0.10.1"' in (root / "const.py").read_text(encoding="utf-8")
        assert (root / "service_identity.py").read_bytes() == (SRC / "service_identity.py").read_bytes()
    for name in ("strings.json", "translations/en.json", "translations/he.json"):
        data = json.loads((SRC / name).read_text(encoding="utf-8"))
        assert "service_user_id" in data["options"]["step"]["init"]["data"], name
        assert "local_identity_extended" in data["options"]["step"]["init"]["data"], name  # 0.9.1 (SVCIDENT2)
        assert set(data["options"]["error"]) == {"service_user_format", "service_user_unknown", "service_user_admin", "runnable_format", "runnable_too_many"}, name  # 0.9.2


# ---------------------------------------------------------------- 0.9.1 (SVCIDENT2): the extended switch - negative cases first

EXTENDED_ITEMS = [  # (bridge service, feature, body) that only the extended switch admits (owner decisions 1, 2, 3, 5 of 2026-10-17)
    ("execute", "devices.control", {"domain": "lock", "service": "unlock", "data": {"entity_id": "lock.front"}}),
    ("execute", "devices.control", {"domain": "script", "service": "turn_on", "data": {"entity_id": "script.x"}}),
    ("execute", "devices.control", {"domain": "scene", "service": "turn_on", "data": {"entity_id": "scene.x"}}),
    ("execute", "alarm", {"domain": "alarm_control_panel", "service": "alarm_arm_custom_bypass", "data": {"entity_id": "alarm_control_panel.h"}}),
    ("execute", "alarm.bypass", {"domain": "switch", "service": "turn_on", "data": {"entity_id": "switch.kitchen_bypass"}}),
    ("execute", "alarm.bypass", {"domain": "select", "service": "select_option", "data": {"entity_id": "select.zone_3", "option": "bypassed"}}),
    ("stream_source", "cameras.live", {"entity_id": "camera.garden"}),
    # second round (owner 2026-10-17): running from the automations screen - run ops only
    ("config_item", "automations.run", {"op": "trigger", "kind": "automation", "item_id": "a1"}),
    ("config_item", "automations.run", {"op": "run_script", "kind": "script", "item_id": "s1"}),
    ("config_item", "automations.run", {"op": "apply_scene", "entity_id": "scene.x"}),
]


def _screen_x(msg: dict, service: str = "execute", extended=True):
    return asyncio.run(si.screen(_hass(), signing.Verifier(SECRET), msg, service, SID, extended))


@pytest.mark.parametrize("service,feature,body", EXTENDED_ITEMS)
def test_switch_off_refuses_every_extended_item_exactly_as_090(service, feature, body):
    msg = _signed({"user_id": SID, "request_id": "r1", "on_behalf_of": _obo(feature), **body})
    before = "automation_write_requires_ha_identity" if service == "config_item" else "service_identity_refused"  # exactly the 0.9.0 answer
    assert _error(_screen_x(dict(msg), service, extended=False)) == before
    for not_true in ("true", 1, "on", None):  # only a real boolean True switches it on
        assert _error(_screen_x(_signed({"user_id": SID, "request_id": "r1", "on_behalf_of": _obo(feature), **body}), service, extended=not_true)) == before


@pytest.mark.parametrize("service,feature,body", EXTENDED_ITEMS)
def test_switch_on_admits_each_extended_item_as_the_service_identity(service, feature, body):
    out, refused = _screen_x(_signed({"user_id": SID, "request_id": "r1", "on_behalf_of": _obo(feature), **body}), service)
    assert refused is None and out["user_id"] == SID and "on_behalf_of" not in out


@pytest.mark.parametrize("feature,domain,service", [
    ("media", "lock", "unlock"),  # a door only under device control
    ("alarm", "lock", "unlock"),
    ("alarm", "switch", "turn_on"),  # the bypass control only under its own feature
    ("devices.control", "alarm_control_panel", "alarm_arm_custom_bypass"),
    ("alarm.bypass", "light", "turn_on"),
    ("alarm.bypass", "alarm_control_panel", "alarm_disarm"),
    ("cameras.live", "light", "turn_on"),
    ("alarm", "alarm_control_panel", "alarm_trigger"),
    ("system", "homeassistant", "restart"),
])
def test_switch_on_still_refuses_items_outside_their_feature(feature, domain, service):
    assert _error(_screen_x(_execute(domain=domain, service=service, obo=_obo(feature)))) == "service_identity_refused"


# ---------------------------------------------------------------- 0.9.6 (EXTID-295, CR-USR2 13.6): the default-policy refusal

def _sid(groups=..., **over):
    attrs = {"id": SID, "is_active": True, "is_admin": False, "system_generated": False, **over}
    if groups is not ...:
        attrs["groups"] = groups
    return SimpleNamespace(**attrs)


@pytest.mark.parametrize("service,feature,body", EXTENDED_ITEMS)
@pytest.mark.parametrize("user", [
    _sid(DEFAULT_GROUPS),  # Home Assistant's default for a regular user
    _sid(RESTRICTED + DEFAULT_GROUPS),  # a restricting group does not help while system-users is still there (the most permissive wins)
    _sid([SimpleNamespace(id="all_devices", policy={"entities": {"all": True}})]),
    _sid([SimpleNamespace(id="all_control", policy={"entities": {"all": {"read": True, "control": True}}})]),
    _sid([]),  # no group at all
    _sid(),  # groups not readable
    _sid([SimpleNamespace(id="odd", policy="not a mapping")]),
], ids=["system-users", "restricted+system-users", "all", "all-control", "no-group", "no-groups-attr", "odd-policy"])
def test_1306_an_extended_item_is_refused_while_the_service_policy_is_default_or_unknown(service, feature, body, user):
    """CR-USR2 13.6 (owner decision 3 of 2026-10-21) - negative first: the bridge refuses every item only the extended mode admits."""
    msg = _signed({"user_id": SID, "request_id": "r1", "on_behalf_of": _obo(feature), **body})
    result = asyncio.run(si.screen(_hass(**{SID: user}), signing.Verifier(SECRET), msg, service, SID, True))
    assert _error(result) == "service_identity_policy_default"


def test_1306_basic_items_and_home_assistant_users_are_not_affected():
    hass = _hass(**{SID: _sid(DEFAULT_GROUPS)})
    out, refused = asyncio.run(si.screen(hass, signing.Verifier(SECRET), _execute(obo=_obo()), "execute", SID, True))  # light.turn_on: a basic item
    assert refused is None and out["user_id"] == SID
    out, refused = asyncio.run(si.screen(hass, signing.Verifier(SECRET), _execute(obo=_obo()), "execute", SID, False))  # the switch off: as 0.9.5
    assert refused is None
    body = {"domain": "lock", "service": "unlock", "data": {"entity_id": "lock.front"}, "request_id": "r1"}
    out, refused = asyncio.run(si.screen(hass, signing.Verifier(SECRET), _signed({"user_id": OTHER, **body}), "execute", SID, True))
    assert refused is None and out["user_id"] == OTHER  # a Home Assistant user's own message: never judged here


@pytest.mark.parametrize("user,expected", [
    (_sid(RESTRICTED), True),
    (_sid([SimpleNamespace(id="g1", policy={"entities": {"domains": {"light": True}}}), SimpleNamespace(id="g2", policy={"entities": None})]), True),
    (_sid([SimpleNamespace(id="read_all", policy={"entities": {"all": {"read": True}}})]), True),  # read everything, control nothing
    (_sid(DEFAULT_GROUPS), False),
    (_sid([SimpleNamespace(id="system-admin", policy={"entities": True})]), False),
    (_sid([SimpleNamespace(id="g", policy={"entities": True})]), False),
    (_sid([SimpleNamespace(id="g", policy={"entities": {"all": True}})]), False),
    (_sid([SimpleNamespace(id="g", policy={"entities": {"all": {"control": True}}})]), False),
    (_sid([]), False),
    (_sid(RESTRICTED, is_admin=True), False),
    (_sid(RESTRICTED, is_active=False), False),
    (None, False),
    (_sid(), None),
    (_sid([SimpleNamespace(id="g", policy=None)]), None),
    (_sid([SimpleNamespace(id="g", policy={"entities": "yes"})]), None),
    (_sid([SimpleNamespace(id="g", policy={"entities": {"all": "yes"}})]), None),
], ids=lambda v: None)
def test_1306_service_policy_restricted_table(user, expected):
    assert si.service_policy_restricted(user) is expected


def test_1306_a_raising_groups_api_is_unknown():
    class Raising:
        id, is_active, is_admin = SID, True, False

        @property
        def groups(self):
            raise RuntimeError("boom")

    assert si.service_policy_restricted(Raising()) is None


def test_1306_the_push_reports_a_boolean_only():
    text = (SRC / "__init__.py").read_text(encoding="utf-8")
    assert '"service_policy_restricted": policy_restricted' in text
    assert "service_identity.service_policy_restricted(await hass.auth.async_get_user(sid)) if sid else None" in text
    assert si.POLICY_DEFAULT == "service_identity_policy_default"


def test_switch_on_never_admits_the_area_write_or_automations(monkeypatch):
    base = {"user_id": SID, "request_id": "r1"}
    for feature in ("devices.control", "devices.area", "cameras.live"):
        msg = _signed({**base, "entity_id": "light.x", "area_id": "kitchen", "on_behalf_of": _obo(feature)})
        assert _error(_screen_x(msg, "set_entity_area")) == "service_identity_refused"
    # an explicit rule, not only the tables: a table widened to the area write still cannot carry it
    widened = {k: dict(v) for k, v in si.EXTENDED_FEATURES.items()}
    widened["devices.area"] = {"set_entity_area": frozenset({None})}
    monkeypatch.setattr(si, "EXTENDED_FEATURES", widened)
    assert _error(_screen_x(_signed({**base, "entity_id": "light.x", "area_id": "k", "on_behalf_of": _obo("devices.area")}), "set_entity_area")) == "service_identity_refused"
    assert si.never_list(True) == {si.AREA_WRITE} and si.NEVER_LOCAL_EXTENDED == frozenset({("smplwise_bridge", "set_entity_area")})
    for op in ("upsert", "delete", "enable", "disable", "stop_script", "snapshot_scene", ["trigger"]):  # writes and the other runtime ops: HA users only
        for feature in ("automations.run", "devices.control"):
            assert _error(_screen_x(_signed({**base, "op": op, "kind": "script", "on_behalf_of": _obo(feature)}), "config_item")) == "automation_write_requires_ha_identity", (op, feature)
    for feature in ("devices.control", "schedules", "automations"):  # a run op only under its own feature
        assert _error(_screen_x(_signed({**base, "op": "trigger", "kind": "automation", "on_behalf_of": _obo(feature)}), "config_item")) == "service_identity_refused", feature


def test_switch_on_keeps_every_identity_rule():
    body = {"domain": "lock", "service": "unlock", "data": {"entity_id": "lock.front"}, "request_id": "r1"}
    assert _error(_screen_x(_signed({"user_id": OTHER, "on_behalf_of": _obo(), **body}))) == "service_identity_refused"
    msg = _signed({"user_id": ADMIN, "on_behalf_of": _obo(), **body})
    assert _error(asyncio.run(si.screen(_hass(), signing.Verifier(SECRET), msg, "execute", ADMIN, True))) == "service_identity_admin"
    assert _error(_screen_x(_signed({"user_id": SID, **body}))) == "service_identity_refused"  # never as itself
    assert _error(_screen_x(_signed({"user_id": LID, **body}))) == "service_identity_refused"
    out, refused = _screen_x(_signed({"user_id": OTHER, **body}))  # a Home Assistant user: untouched by the switch
    assert refused is None and out["user_id"] == OTHER


def test_extended_tables_match_the_addon_and_extend_only_what_the_owner_named():
    import importlib

    added = {k: {s: frozenset(v) - frozenset(si.SERVICE_FEATURES.get(k, {}).get(s, frozenset())) for s, v in d.items()} for k, d in si.EXTENDED_FEATURES.items()}
    added = {k: {s: v for s, v in d.items() if v} for k, d in added.items()}
    assert {k: d for k, d in added.items() if d} == {
        "devices.control": {"execute": frozenset({("lock", "unlock"), ("lock", "open"), ("script", "turn_on"), ("scene", "turn_on")})},
        "alarm": {"execute": frozenset({("alarm_control_panel", "alarm_arm_custom_bypass")})},
        "alarm.bypass": {"execute": frozenset({("switch", "turn_on"), ("switch", "turn_off"), ("select", "select_option")})},
        "cameras.live": {"stream_source": frozenset({"read"})},
        "automations.run": {"config_item": frozenset({"trigger", "run_script", "apply_scene"})},
    }
    addon = importlib.import_module("smplwise.services.service_identity")
    assert addon.NEVER_LOCAL_EXTENDED == si.NEVER_LOCAL_EXTENDED and addon.AREA_WRITE == si.AREA_WRITE
    assert {k: {s: frozenset(v) for s, v in d.items()} for k, d in addon.EXTENDED_FEATURES.items()} == \
           {k: {s: frozenset(v) for s, v in d.items()} for k, d in si.EXTENDED_FEATURES.items()}


def test_the_switch_is_read_live_and_travels_with_the_directory_push():
    text = (SRC / "__init__.py").read_text(encoding="utf-8")
    assert "entry.options.get(CONF_LOCAL_IDENTITY_EXTENDED, False) is True" in text
    assert "service_identity.screen(hass, verifier, dict(call.data), name, service_user_id(), local_extended())" in text
    assert '"local_identity_extended": local_extended()' in text
    assert "admin_waived=on_behalf and local_extended()" in text  # the stream source's administrator rule is waived only for a screened local message
    flow = (SRC / "config_flow.py").read_text(encoding="utf-8")
    assert "vol.Optional(CONF_LOCAL_IDENTITY_EXTENDED, default=extended): bool" in flow
    assert load("const").CONF_LOCAL_IDENTITY_EXTENDED == "local_identity_extended"