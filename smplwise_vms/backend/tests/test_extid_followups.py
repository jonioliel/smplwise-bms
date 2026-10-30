"""EXTID-295: the documented follow-ups of the extended service identity (CR-USR2 sections 11.6 / 12.3 / 12.4, backlog item
`extended-identity-followups`) - negative first. The extended mode stays LOCKED (`EXTENDED_GO_LIVE_PERMITTED = False`); nothing here is a
permit. Fakes only: no Home Assistant is imported or contacted, no token, no device.

1. The alarm bypass cue: the panel list offers zone bypass / restore and arming with the bypass set to an Arx-only person only when the
   service identity would actually send it (the extended mode in force). With the mode off (always, in this build) the controls are not
   offered - the server refusal stays exactly as before.
2. The bridge allowlist selector (12.4 item 4): the options-flow field of the runnable allowlist is a multi-entity picker limited to
   scripts / scenes / automations instead of free text; what it stores is unchanged (a sorted list of ids; malformed = empty at run time).
   Bridge 0.9.4 (0.9.3 stays reserved for the key-rotation branch); the add-on still needs only 0.9.2 for the extended items.
3. The residual-risk text (12.3 item 3 / risk R5): the entity policy of the service user protects only when a Home Assistant administrator
   restricted it - said in the bridge's options flow, on the add-on's service-identity card and in the operator / customer documents."""
from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest

from bridge_loader import MIRROR, SRC, load
from smplwise.db import bump_permission_revision, new_id, now_iso, permission_revision, set_setting
from smplwise.rbac import Principal
from smplwise.services import service_identity as si
from test_service_identity import LID, _local, _seed  # noqa: F401
from test_service_identity_extended import _as, _ext

from test_alarm import _fresh_limits, alarm_app  # noqa: E402,F401  (fixtures)

ROOT = Path(__file__).resolve().parents[3]
PANEL = "alarm_control_panel.risco_house"


def _panel_state(db) -> None:
    from smplwise.services import ha_sync as hs

    with db.connection() as conn:
        now = now_iso()
        hs.upsert_state(conn, {"entity_id": PANEL, "state": "disarmed", "last_changed": now, "last_updated": now,
                               "attributes": {"friendly_name": "x", "code_format": "number", "code_arm_required": False, "supported_features": 1 | 2 | 4 | 16}})


# ---------------------------------------------------------------- 1. the alarm bypass cue

def test_the_build_still_ships_locked():
    assert si.EXTENDED_GO_LIVE_PERMITTED is False


def test_a_local_user_is_not_offered_bypass_while_the_extended_mode_is_off_without_the_go_live_permit(alarm_app):
    """The shipped build: a local site administrator holds alarm.bypass, but the service identity refuses every bypass - so the panel list
    does not offer it (bypass, restore, arming with the bypass set). Plain arming stays offered; the server refusal stays."""
    from test_alarm import _act, _bypass, _no_code, _panel, _panels

    app, _s, c, calls, _ = alarm_app
    db = app.state.db
    _seed(db, role="site_admin")
    _panel_state(db)
    _no_code(c, LID)
    with db.connection() as conn:  # even a stored "on" changes nothing in this build
        set_setting(conn, si.EXTENDED_SETTING, "on")
        set_setting(conn, si.BRIDGE_EXTENDED, "true")
        set_setting(conn, "bridge.integration_version", "0.9.2")
    try:
        _as(app, _local())
        p = _panel(_panels(c), PANEL)
        assert p["can"]["bypass"] is False and p["can"]["restore"] is False
        assert "arm_custom_bypass" not in p["arm_modes"]
        assert p["can"]["arm"] is True and "arm_away" in p["arm_modes"]  # plain arming is untouched
        n = len(calls)
        assert _bypass(c, "binary_sensor.kitchen_window", True, confirmed=True).json()["code"] == "service_identity_refused"
        assert len(calls) == n  # the refusal itself is unchanged and nothing is sent
        assert _act(c, PANEL, "arm_custom_bypass").status_code in (403, 422)
        assert len(calls) == n
    finally:
        app.dependency_overrides.clear()


def test_a_local_user_is_offered_bypass_only_when_the_mode_is_in_force(alarm_app, monkeypatch):
    """The future enabled behaviour (permit monkeypatched): mode off = not offered; mode on = offered under the user's own alarm.bypass."""
    from test_alarm import _no_code, _panel, _panels

    monkeypatch.setattr(si, "EXTENDED_GO_LIVE_PERMITTED", True)
    app, _s, c, _calls, _ = alarm_app
    db = app.state.db
    _seed(db, role="site_admin")
    _panel_state(db)
    _no_code(c, LID)
    try:
        _as(app, _local())
        _ext(db, on=False)
        p = _panel(_panels(c), PANEL)
        assert p["can"]["bypass"] is False and p["can"]["restore"] is False and "arm_custom_bypass" not in p["arm_modes"]
        _ext(db)
        p = _panel(_panels(c), PANEL)
        assert p["can"]["bypass"] is True and p["can"]["restore"] is True and "arm_custom_bypass" in p["arm_modes"]
    finally:
        app.dependency_overrides.clear()


def test_a_home_assistant_user_with_alarm_bypass_is_unchanged(alarm_app):
    from test_alarm import _no_code, _panel, _panels

    app, _s, c, _calls, _ = alarm_app
    db = app.state.db
    _panel_state(db)
    with db.connection() as conn:
        now = now_iso()
        conn.execute("INSERT OR IGNORE INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES ('u-sa', 'sa', 'SA', 'remote', 1, ?, ?)", (now, now))
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', 'u-sa', 'site_admin', 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), permission_revision(conn), now))
        bump_permission_revision(conn)
    _no_code(c, "u-sa")
    try:
        _as(app, Principal(user_id="u-sa", username="sa", display_name="SA", source="remote", via="cookie"))
        p = _panel(_panels(c), PANEL)
        assert p["can"]["bypass"] is True and "arm_custom_bypass" in p["arm_modes"]  # the mode concerns Arx-only people only
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------- 2. the bridge allowlist selector (bridge 0.9.4)

rn = load("runnable")


def _flow_tree() -> tuple[str, ast.Module]:
    text = (SRC / "config_flow.py").read_text(encoding="utf-8")
    return text, ast.parse(text)


def test_the_runnable_field_is_no_longer_free_text():
    text, _ = _flow_tree()
    assert "vol.Optional(CONF_LOCAL_IDENTITY_RUNNABLE, default=runnable_text): str" not in text  # negative first: the 0.9.2 free-text field
    assert "runnable_text" not in text


def test_the_runnable_field_is_a_multi_entity_picker_of_runnable_domains():
    text, tree = _flow_tree()
    assert "from homeassistant.helpers import selector" in text
    assert "selector.EntitySelector(selector.EntitySelectorConfig(domain=list(RUNNABLE_DOMAINS), multiple=True))" in text
    # suggested_value, not default: a cleared picker must store an EMPTY list (with `default` the old list would come back)
    assert "vol.Optional(CONF_LOCAL_IDENTITY_RUNNABLE, description={'suggested_value': runnable_list})" in text.replace('"', "'")
    assert "runnable_list = selector_value(options.get(CONF_LOCAL_IDENTITY_RUNNABLE))" in text
    # what is stored is unchanged: the parsed, sorted list (parse_runnable judges the picker's list exactly as it judged the text)
    assert "CONF_LOCAL_IDENTITY_RUNNABLE: sorted(runnable_ids or ())" in text
    assert "parse_runnable(user_input.get(CONF_LOCAL_IDENTITY_RUNNABLE))" in text
    assert rn.RUNNABLE_DOMAINS == ("automation", "scene", "script")


@pytest.mark.parametrize("stored, shown", [
    (None, []), ("", []), ([], []),
    (["script.b", "scene.a", "automation.c"], ["automation.c", "scene.a", "script.b"]),
    ("script.b, scene.a", ["scene.a", "script.b"]),  # a 0.9.2 text value is shown as a list
    (["light.kitchen"], []), ("not an id", []), (42, []), ([1, 2], []),  # malformed = empty (fail closed, as at run time)
])
def test_the_picker_shows_the_stored_list_or_nothing(stored, shown):
    assert rn.selector_value(stored) == shown


def test_the_picker_value_is_judged_like_the_text_was():
    assert rn.parse_runnable(["script.a", "scene.b"]) == (frozenset({"script.a", "scene.b"}), None)
    assert rn.parse_runnable(None) == (frozenset(), None)  # a cleared picker
    assert rn.parse_runnable(["light.kitchen"]) == (None, "runnable_format")  # the picker filters domains; the check stays
    assert rn.parse_runnable([f"script.s{i}" for i in range(rn.MAX_RUNNABLE + 1)]) == (None, "runnable_too_many")


def test_bridge_094_everywhere_and_the_addon_still_needs_only_092():
    for root in (SRC, MIRROR):
        assert json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.10.1"
        assert 'VERSION = "0.10.1"' in (root / "const.py").read_text(encoding="utf-8")
        assert "const VERSION = '0.10.1'" in (root / "www" / "smplwise-card.js").read_text(encoding="utf-8")
    for path in sorted(p for p in SRC.rglob("*") if p.is_file() and "__pycache__" not in p.parts):
        rel = path.relative_to(SRC)
        assert (MIRROR / rel).read_bytes() == path.read_bytes(), rel
    # the picker changed no stored format (0.9.4 kept 0.9.2); Fable review 4 (V-01 + CR-USR2 13.6) moved the requirement to 0.9.6
    assert si.BRIDGE_EXTENDED_REQUIRED == "0.9.6"


# ---------------------------------------------------------------- 3. the residual-risk text (12.3 item 3, risk R5)

POLICY_EN = "entity policy"


def test_the_bridge_options_flow_states_the_entity_policy_residual_risk():
    for name, needle in (("strings.json", POLICY_EN), ("translations/en.json", POLICY_EN), ("translations/he.json", "מדיניות ישויות")):
        data = json.loads((SRC / name).read_text(encoding="utf-8"))
        desc = data["options"]["step"]["init"]["description"]
        assert needle in desc, name
        assert "0.9.4" in desc and "0.9.2" not in desc, name
        label = data["options"]["step"]["init"]["data"]["local_identity_runnable"]
        assert "comma" not in label.lower() and "פסיק" not in label, name  # the picker has no separators to explain


def test_the_operator_and_customer_documents_state_the_residual_risks():
    docs = {
        "smplwise_vms/DOCS.md": ("residual risks the installer must know", "The entity policy protects only when you restrict the service user",
                                 "*Kill paths*", "Bridge 0.9.4"),
        "smplwise_vms/DOCS_HE.md": ("סיכונים שנותרו ושהמתקין חייב להכיר", "מדיניות הישויות מגינה רק כשמגבילים את משתמש השירות", "*דרכי כיבוי*",
                                    "גשר 0.9.4"),
        "docs/user-guide/he/47-identity-users_HE.md": ("## סיכונים שנותרו בזהות השירות המורחבת", "מדיניות ישויות של משתמש השירות",
                                                        "דרכי כיבוי", "0.9.4"),
    }
    for rel, needles in docs.items():
        text = (ROOT / rel).read_text(encoding="utf-8")
        for needle in needles:
            assert needle in text, (rel, needle)


def test_the_operator_guide_names_no_home_assistant_outside_settings_text():
    """The Hebrew guide chapter is operator-facing: the new section speaks of "תשתית המערכת", never of Home Assistant by name."""
    text = (ROOT / "docs/user-guide/he/47-identity-users_HE.md").read_text(encoding="utf-8")
    section = text.split("## סיכונים שנותרו בזהות השירות המורחבת", 1)[1].split("\n## ", 1)[0]
    assert "Home Assistant" not in section and " HA " not in section
