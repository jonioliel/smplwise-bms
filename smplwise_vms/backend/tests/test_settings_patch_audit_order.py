"""CR-SETTINGS-PATCH-A-2440 (review 05:P1-10 step 2): `PATCH /settings` is split into per-group handlers in a table. This file
pins what the split must keep, and was written and green BEFORE any code moved:

- the order of the checks: of two refusals in one request the earlier one answers (every neighbouring pair, in the order the
  one long function ran them), for a system administrator and for a holder of `system.configure` alone;
- the audit rows of one large accepted request: actions, decisions, resource ids, details and their order;
- a refusal stores nothing, and the helper keys (`*_confirm`, `*_force`) are never stored."""
from __future__ import annotations

import json
from typing import Any

from fastapi.testclient import TestClient

from smplwise.db import bump_permission_revision, new_id, now_iso, permission_revision, set_setting
from smplwise.main import create_app
from smplwise.routers.settings import ALLOW_DISARM_WORD, LOCAL_PURGE_WORD, SettingsPatch

API = "/api/v1/settings"
BAD = {"__bad__": "x"}
SAMI = {"X-SW-Dev-User": "sami"}
FINGERPRINT = ":".join(["AB"] * 32)
ANDROID = f"org.example.arx:{FINGERPRINT}"

# One refused request per check, in the order `patch_settings` runs the checks (a system administrator, local channel).
CHECKS: list[tuple[str, dict[str, Any], int, str]] = [
    ("ui.design_names", {"ui.design_names": "not json"}, 422, "validation"),
    ("ui.tabs", {"ui.tabs": {"Bad Slug!": {}}}, 422, "validation"),
    ("ui.nav_size", {"ui.nav_size": BAD}, 422, "validation"),
    ("ui.look", {"ui.look": BAD}, 422, "validation"),
    ("ui.palettes", {"ui.palettes": [BAD]}, 422, "validation"),
    ("ui.tabs_mode_groups", {"ui.tabs_mode_groups": BAD}, 422, "validation"),
    ("ui.dd_style_groups", {"ui.dd_style_groups": BAD}, 422, "validation"),
    ("ui.dd_size_groups", {"ui.dd_size_groups": BAD}, 422, "validation"),
    ("ui.dd_ring_groups", {"ui.dd_ring_groups": BAD}, 422, "validation"),
    ("ui.dd_panel_groups", {"ui.dd_panel_groups": BAD}, 422, "validation"),
    ("ui.mobile", {"ui.mobile": BAD}, 422, "validation"),
    ("ui.xs", {"ui.xs": BAD}, 422, "validation"),
    ("timeline.colors", {"timeline.colors": BAD}, 422, "validation"),
    ("ui.accent", {"ui.accent": "nope"}, 422, "validation"),
    ("ui.toggle_on", {"ui.toggle_on": "nope"}, 422, "validation"),
    ("devices.area_row", {"devices.area_row": BAD}, 422, "validation"),
    ("devices.floor_row", {"devices.floor_row": BAD}, 422, "validation"),
    ("home.screen", {"home.screen": BAD}, 422, "validation"),
    ("plan.surfaces", {"plan.surfaces": ["nope"]}, 422, "validation"),
    ("plan.view", {"plan.view": BAD}, 422, "validation"),
    ("site.latitude", {"site.latitude": "91"}, 422, "validation"),
    ("site.longitude", {"site.longitude": "181"}, 422, "validation"),
    ("plan.bakes", {"plan.bakes": BAD}, 422, "validation"),
    ("schedules.classes", {"schedules.classes": ["nope"]}, 422, "validation"),
    ("automations.code_view_roles", {"automations.code_view_roles": ["bad role!!"]}, 422, "validation"),
    ("automations.templates_hidden", {"automations.templates_hidden": ["bad id!!"]}, 422, "validation"),
    ("automations.templates_order", {"automations.templates_order": ["bad id!!"]}, 422, "validation"),
    ("automations.notify_targets", {"automations.notify_targets": ["bad id!!"]}, 422, "validation"),
    ("automations.limits", {"automations.limits": BAD}, 422, "validation"),
    ("multimedia.remote_default", {"multimedia.remote_default": BAD}, 422, "validation"),
    ("app.android_url", {"app.android_url": "ftp://example.org/app.apk"}, 422, "validation"),
    ("app.android_version", {"app.android_version": "bad version!"}, 422, "validation"),
    ("app.android_sha256", {"app.android_sha256": "zz"}, 422, "validation"),
    ("schedules.allow_disarm", {"schedules.allow_disarm": "true"}, 422, "confirm_required"),
    ("security.local_identity_extended", {"security.local_identity_extended": "on"}, 409, "extended_not_permitted"),
    ("security.local_public_url", {"security.local_public_url": "http://192.0.2.1/x"}, 422, "validation"),
    ("security.local_passkey_android", {"security.local_passkey_android": "garbage"}, 422, "validation"),
    ("privacy.local_purge", {"privacy.local_purge": "on"}, 422, "confirm_required"),
    ("schedules.shabbat_sensor", {"schedules.shabbat_sensor": "binary_sensor.no_such_sensor"}, 422, "validation"),
    ("map.default_floor", {"map.default_floor": "no_such_floor"}, 422, "validation"),
    ("home.title", {"home.title": "a\tb"}, 422, "validation"),
    ("home.floor_order", {"home.floor_order": "not json"}, 422, "validation"),
    ("home.widgets", {"home.widgets": BAD}, 422, "validation"),
    ("time.zone", {"time.zone": "Mars/Olympus_Mons"}, 422, "validation"),
    ("ai.provider", {"ai.provider": "external"}, 422, "provider_not_available"),
]

# The same for a holder of `system.configure` who is not a system administrator: each of these is refused with its own audit row.
ADMIN_ONLY: list[tuple[str, dict[str, Any], str]] = [
    ("schedules.allow_disarm", {"schedules.allow_disarm": "false"}, "schedules.allow_disarm"),
    ("security.local_identity", {"security.local_identity": "on"}, "identity.local.feature"),
    ("security.local_identity_extended", {"security.local_identity_extended": "on"}, "identity.service_identity.extended_switch"),
    ("security.local_public_url", {"security.local_public_url": "https://arx.example.org"}, "identity.local.public_url"),
    ("security.local_passkey_first", {"security.local_passkey_first": "on"}, "identity.local.passkey_setting"),
    ("security.local_passkey_android", {"security.local_passkey_android": ANDROID}, "identity.local.passkey_setting"),
    ("privacy.local_purge", {"privacy.local_purge": "on", "privacy.local_purge_confirm": LOCAL_PURGE_WORD}, "privacy.local_purge.setting"),
    ("privacy.local_purge_days", {"privacy.local_purge_days": 60}, "privacy.local_purge.setting"),
]


def _answer(r: Any) -> tuple[int, str, str, Any]:
    body = r.json()
    return r.status_code, body.get("code"), body.get("user_message"), body.get("details")


def _settings_rows(app: Any) -> list[tuple[str, str]]:
    with app.state.db.connection(mode="read") as conn:
        return [tuple(r) for r in conn.execute("SELECT key, value FROM settings ORDER BY key")]


def _audit_rows(app: Any, after: int = 0) -> list[dict[str, Any]]:
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT id, actor_user_id, action, decision, resource_type, resource_id, reason, details_json FROM audit_log "
                            "WHERE id > ? ORDER BY id", (after,)).fetchall()
    return [{**dict(r), "details": json.loads(r["details_json"]) if r["details_json"] else None} for r in rows]


def _last_audit(app: Any) -> int:
    with app.state.db.connection(mode="read") as conn:
        return int(conn.execute("SELECT COALESCE(MAX(id), 0) FROM audit_log").fetchone()[0])


def _disarm_off(app: Any) -> None:
    """`schedules.allow_disarm` is "true" by default; allowing it again (with the typed word) needs it stored as "false"."""
    with app.state.db.connection() as conn:
        set_setting(conn, "schedules.allow_disarm", "false")


def _configure_only(app: Any, client: TestClient) -> None:
    """`sami`: a custom role holding system.configure at the installation, not a system administrator."""
    client.get("/api/v1/me", headers=SAMI)
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('cfg_only', 'cfg', ?, ?, ?)",
                     (json.dumps(["system.configure"]), now_iso(), now_iso()))
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', 'dev-sami', 'cfg_only', 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), permission_revision(conn), now_iso()))
        bump_permission_revision(conn)


def test_the_earlier_check_answers_for_every_neighbouring_pair(settings):
    app = create_app(settings)
    c = TestClient(app)
    assert c.get(API).status_code == 200
    _disarm_off(app)
    before = _settings_rows(app)
    alone = []
    for name, body, status, code in CHECKS:
        r = c.patch(API, json=body)
        assert (r.status_code, r.json().get("code")) == (status, code), (name, r.text)
        alone.append(_answer(r))
    for (name, body, _s, _c), (later, later_body, _s2, _c2), expected in zip(CHECKS, CHECKS[1:], alone):
        r = c.patch(API, json={**later_body, **body})  # the later key first in the document: the order is the handler's, not the body's
        assert _answer(r) == expected, f"{name} must answer before {later}: {r.text}"
    assert _settings_rows(app) == before, "a refused request stores nothing"


def test_the_administrator_only_checks_keep_their_order_and_their_denied_rows(settings):
    app = create_app(settings)
    c = TestClient(app)
    _configure_only(app, c)
    assert c.patch(API, json={"privacy.personal_export": "off"}, headers=SAMI).status_code == 200  # holds system.configure
    before = _settings_rows(app)
    alone = []
    for name, body, action in ADMIN_ONLY:
        mark = _last_audit(app)
        r = c.patch(API, json=body, headers=SAMI)
        assert r.status_code == 403 and r.json()["code"] == "forbidden", (name, r.text)
        rows = _audit_rows(app, mark)
        assert [(x["action"], x["decision"], x["reason"], x["actor_user_id"]) for x in rows] == [(action, "denied", "not_system_admin", "dev-sami")], name
        alone.append((_answer(r), [(x["action"], x["resource_type"], x["resource_id"], x["details"]) for x in rows]))
    for (name, body, _a), (later, later_body, _a2), (answer, denied) in zip(ADMIN_ONLY, ADMIN_ONLY[1:], alone):
        mark = _last_audit(app)
        r = c.patch(API, json={**later_body, **body}, headers=SAMI)
        assert _answer(r) == answer, f"{name} must answer before {later}: {r.text}"
        assert [(x["action"], x["resource_type"], x["resource_id"], x["details"]) for x in _audit_rows(app, mark)] == denied, name
    assert _settings_rows(app) == before


def test_the_audit_rows_of_one_large_request_keep_their_order(settings):
    app = create_app(settings)
    c = TestClient(app)
    assert c.get(API).status_code == 200
    with app.state.db.connection() as conn:
        set_setting(conn, "security.local_identity_extended", "on")  # the OFF direction is the one this build allows
        set_setting(conn, "schedules.allow_disarm", "false")
        conn.execute("INSERT INTO ha_entities(entity_id, platform, name, domain, first_seen_at, updated_at) VALUES (?,?,?,?,?,?)",
                     ("binary_sensor.motion_hall", "demo", "hall", "binary_sensor", now_iso(), now_iso()))
    mark = _last_audit(app)
    body = {
        # sent in the reverse of the order the rows are written in
        "docread.enabled": "true", "maintenance.enabled": "true", "emergency_readiness.enabled": "true", "tickets.enabled": "true",
        "update.apply_enabled": "false",
        "schedules.allow_disarm": "true", "schedules.allow_disarm_confirm": ALLOW_DISARM_WORD,
        "security.local_identity": "on",
        "privacy.local_purge_days": 60, "privacy.local_purge": "on", "privacy.local_purge_confirm": LOCAL_PURGE_WORD,
        "security.local_passkey_android": ANDROID, "security.local_passkey_first": "on",
        "security.local_public_url": "https://arx.example.org",
        "security.local_identity_extended": "off",
        "schedules.shabbat_sensor": "binary_sensor.motion_hall", "schedules.shabbat_sensor_force": True,
        "home.title": "  Lobby  ", "plan.surfaces": ["area", "devices"], "ui.design_names": json.dumps({"a": " One "}),
    }
    r = c.patch(API, json=body)
    assert r.status_code == 200, r.text
    rows = _audit_rows(app, mark)
    assert all(x["actor_user_id"] == "dev-joni" for x in rows)
    assert [(x["action"], x["decision"], x["resource_type"], x["resource_id"], x["reason"]) for x in rows] == [
        ("identity.service_identity.extended_switch", "allowed", "installation", "service_identity", None),
        ("identity.local.public_url", "allowed", "installation", "local_identity", None),
        ("identity.local.passkey_setting", "allowed", "installation", "local_identity", None),
        ("identity.local.passkey_setting", "allowed", "installation", "local_identity", None),
        ("privacy.local_purge.setting", "allowed", "installation", "local_privacy", None),
        ("privacy.local_purge.setting", "allowed", "installation", "local_privacy", None),
        ("identity.local.feature_enabled", "allowed", "installation", "local_identity", None),
        ("schedules.allow_disarm", "allowed", "installation", "*", None),
        ("system.update.apply_enabled", "allowed", "installation", "update", None),
        ("tickets.module.enable", "allowed", "installation", "tickets", None),
        ("emergency_readiness.module.enable", "allowed", "installation", "emergency_readiness", None),
        ("maintenance.module.enable", "allowed", "installation", "maintenance", None),
        ("docread.enable", "allowed", "installation", "docread", None),
        ("settings.update", "allowed", "installation", "*", None),
    ]
    details = [x["details"] for x in rows]
    assert details[:13] == [
        {"from": "on", "to": "off", "channel": "local"},
        {"to": "https://arx.example.org"},
        {"key": "security.local_passkey_first", "to": "on"},
        {"key": "security.local_passkey_android", "to": "set"},
        {"key": "privacy.local_purge", "from": "off", "to": "on", "channel": "local", "confirm_word": "he"},  # CR-I18N-CONFIRM-WORDS-2442
        {"key": "privacy.local_purge_days", "from": "30", "to": "60", "channel": "local"},
        None,
        {"to": "true", "confirm_word": "he"},  # CR-I18N-CONFIRM-WORDS-2442: which word confirmed it
        {"to": False},
        None, None, None, None,
    ]
    # the last row carries what was stored, as stored: normalised values, no helper key, the override on the record
    assert details[13] == {
        "docread.enabled": "true", "maintenance.enabled": "true", "emergency_readiness.enabled": "true", "tickets.enabled": "true",
        "update.apply_enabled": "false", "schedules.allow_disarm": "true", "security.local_identity": "on",
        "privacy.local_purge_days": 60, "privacy.local_purge": "on",
        "security.local_passkey_android": ANDROID, "security.local_passkey_first": "on",
        "security.local_public_url": "https://arx.example.org", "security.local_identity_extended": "off",
        "schedules.shabbat_sensor": "binary_sensor.motion_hall",
        "home.title": "Lobby", "plan.surfaces": ["devices", "area"], "ui.design_names": json.dumps({"a": "One", "b": "SW B"}, ensure_ascii=False),
        "forced": True,
    }
    declared = [f.alias for f in SettingsPatch.model_fields.values()]
    assert list(details[13]) == [k for k in declared if k in details[13]] + ["forced"], "the keys keep the order of the model's fields"
    stored = dict(_settings_rows(app))
    assert not [k for k in stored if k.endswith(("_confirm", "_force"))]
    assert (stored["home.title"], stored["plan.surfaces"], stored["privacy.local_purge_days"]) == ("Lobby", '["devices","area"]', "60")
    assert r.json()["can_edit"] is True and r.json()["settings"]["home.title"] == "Lobby"


def test_a_request_that_repeats_the_stored_values_writes_one_row(settings):
    """The switches write their own row only for an actual change; a repeated value is dropped from the change (the keys the
    function pops) or kept (the module switches), exactly as before the split."""
    app = create_app(settings)
    c = TestClient(app)
    assert c.get(API).status_code == 200
    mark = _last_audit(app)
    body = {"schedules.allow_disarm": "true", "security.local_identity": "off", "security.local_identity_extended": "off",
            "security.local_public_url": "", "security.local_passkey_first": "off", "security.local_passkey_android": "",
            "privacy.local_purge": "off", "privacy.local_purge_days": 30, "update.apply_enabled": "true",
            "tickets.enabled": "false", "maintenance.enabled": "false", "docread.enabled": "false", "emergency_readiness.enabled": "false"}
    r = c.patch(API, json=body)
    assert r.status_code == 200, r.text
    rows = _audit_rows(app, mark)
    assert [x["action"] for x in rows] == ["settings.update"]
    assert rows[0]["details"] == rows[0]["details"] | {"security.local_public_url": ""}
    assert sorted(rows[0]["details"]) == sorted(["security.local_public_url", "update.apply_enabled", "tickets.enabled", "maintenance.enabled",
                                                 "docread.enabled", "emergency_readiness.enabled"])


def test_the_table_names_declared_settings_and_no_prefix_twice():
    """A dict keeps one handler per prefix: two groups naming the same prefix would silently drop a check."""
    from smplwise.routers import settings_patch
    from smplwise.routers.settings_patch import content, ui

    assert len(settings_patch.VALIDATORS) == len(ui.VALIDATORS) + len(content.VALIDATORS) + 21  # ONVIF-API-2500 + MFA-PASSKEYS-2490 + MFA-RESET-HARDENING-2510
    declared = [f.alias for f in SettingsPatch.model_fields.values()]
    for prefix in settings_patch.VALIDATORS:
        assert any(alias.startswith(prefix) for alias in declared), prefix


def test_the_tables_are_in_the_order_of_the_one_long_function():
    """CR-SETTINGS-PATCH-B-2440: the whole route runs from the two tables. Their order is the order of the checks and of the
    audit rows; a new entry goes where its check belongs, and this list says so."""
    from smplwise.routers import settings_patch

    assert list(settings_patch.VALIDATORS) == [
        "ui.design_names", "ui.tabs", "ui.nav_size", "ui.look", "ui.palettes", "ui.tabs_mode_groups", "ui.dd_style_groups", "ui.dd_size_groups",
        "ui.dd_ring_groups", "ui.dd_panel_groups", "ui.mobile", "ui.xs", "timeline.colors", "ui.accent", "ui.toggle_on", "devices.area_row",
        "devices.floor_row", "home.screen", "plan.surfaces", "plan.view", "site.", "plan.bakes", "schedules.classes", "automations.",
        "multimedia.remote_default", "app.android_",
        "schedules.allow_disarm", "update.apply_enabled", "security.local_identity", "security.local_identity_extended",
        "security.local_public_url", "security.local_passkey_", "security.passkeys_all_users", "security.factor_reset_channel", "privacy.local_purge", "tickets.enabled", "maintenance.enabled",
        "docread.enabled", "cameras.discovery_allowed_ranges", "emergency_readiness.enabled", "schedules.shabbat_sensor", "map.default_floor", "home.title", "home.floor_order",
        "home.widgets", "time.zone", "ai.provider",
    ]
    assert [f"{step.__module__.rsplit('.', 1)[-1]}.{step.__name__}" for step in settings_patch.AFTER] == [
        "effects.store", "effects.schedules_switched_on", "effects.automations_switched_on", "effects.remote_csp",
        "effects.station_media_provider", "effects.microphone_policy", "identity.local_identity_changed", "identity.local_switch_applied",
        "identity.disarm_changed", "modules.update_changed", "modules.tickets_changed", "modules.emergency_changed",
        "modules.maintenance_changed", "modules.docread_changed", "effects.settings_updated",
    ]


def test_the_package_does_not_import_the_router():
    import ast
    from pathlib import Path

    from smplwise.routers import settings_patch

    for path in sorted(Path(settings_patch.__file__).parent.glob("*.py")):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.ImportFrom):
                assert not (node.module or "").endswith("routers.settings") and not (node.level == 2 and node.module == "settings"), path.name
                assert not (node.level == 2 and node.module is None and any(a.name == "settings" for a in node.names)), path.name


def test_the_followers_of_a_setting_are_told_after_the_store(settings, monkeypatch):
    """The steps after the checks: the value is stored before a follower reads it, and a refused request tells nobody."""
    from smplwise import remote_channel
    from smplwise.db import get_setting

    app = create_app(settings)
    c = TestClient(app)
    assert c.get(API).status_code == 200
    seen: list[tuple[str, Any]] = []
    monkeypatch.setattr(remote_channel, "set_csp_enforce", lambda value: seen.append(("csp", value)))
    monkeypatch.setattr(remote_channel, "load_mic_mode_from", lambda conn: seen.append(("mic", get_setting(conn, "ui.hide_wiskey", None))))
    r = c.patch(API, json={"remote.csp_enforce": "false", "ui.hide_wiskey": "true", "time.zone": "Mars/Olympus_Mons"})
    assert r.status_code == 422 and seen == [], "a refused request tells nobody"
    r = c.patch(API, json={"ui.hide_wiskey": "true", "remote.csp_enforce": "false"})
    assert r.status_code == 200, r.text
    assert seen == [("csp", False), ("mic", "true")], "in the table's order, and the microphone policy reads the stored value"
