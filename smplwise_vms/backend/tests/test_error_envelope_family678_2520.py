"""ADR019-FAMILY678-2520: ADR-019 (one field-error envelope, L2) Step 1 for families 6, 7 and 8.

* family 6 - automations, scenarios, schedules, blueprints: the domain issue lists `[{path, code, message}]` (blueprints: `param`)
  also answer D1 `fields` / `problems` (`errors.issue_problems`: field = the path, an empty path = `body`; blueprints
  `params.<name>`); the list itself is still sent as `errors`, the promoted codes keep `path`. Scenario settings: `key` -> `fields`.
  The forwarded `(status, payload)` replies of the routers are success answers only (every refusal raises `ApiError`), checked
  statically below.
* family 7 - electricity and water billing: the server already answered `fields` as names; the refused tariff definition and
  formula issue lists also answer `fields` / `problems` (`{field, code}`: their text is the envelope's message).
* family 8 - the rest: every refusal that named `details.field` / `details.key` also answers `fields` (legacy key kept); the two
  hand-built envelopes (`local_identity._error`, the Digital Asset Links 404) are `ApiError.payload()`.
  Left for a later row: `services/media_groups.py` (`key` is a device key VALUE, not a field name - see the change note).
No app is started here: the helpers the routes raise are exercised directly."""
from __future__ import annotations

import ast
import importlib.util
import json
from pathlib import Path

import pytest

from smplwise import errors
from smplwise.errors import ApiError
from smplwise.routers import automation_blueprints, local_identity, local_passkeys
from smplwise.routers import scenarios as scenarios_router
from smplwise.services import (automation_ops, door_windows, energy_billing, energy_formula, energy_tou, home_family, ma_direct, offline_field,
                               quiet_windows, readiness, scenario_settings, scenarios, schedule_ops)

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "smplwise_vms" / "backend" / "smplwise"
FAMILY_6 = {"automation", "scenarios", "scenario", "schedule"}
FAMILY_7 = {"energy", "water"}
FAMILY_8 = {"app", "backup", "brand", "building", "capture", "compliance", "docread", "door", "home", "incidents", "intercom", "local",
            "ma", "offline", "quiet", "readiness", "second", "settings", "user", "white"}
LEFT = {"services/media_groups.py"}  # see the module docstring


def _inventory():
    spec = importlib.util.spec_from_file_location("error_contract_inventory", REPO / "scripts" / "error_contract_inventory.py")
    m = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(m)
    return m


def _raises(fn, *args, **kwargs) -> ApiError:
    with pytest.raises(ApiError) as ex:
        fn(*args, **kwargs)
    return ex.value


# ---------------------------------------------------------------- the inventory and the ratchet


def test_families_six_seven_eight_have_no_legacy_422_left():
    inv = _inventory()
    err = inv.scan_errors(PKG)
    fams = FAMILY_6 | FAMILY_7 | FAMILY_8
    mine = [s for s in err["sites"] if s["layer"] != "public_app" and inv.family_of(s["module"]) in fams and s["module"] not in LEFT]
    legacy = [f'{s["module"]}:{s["line"]}' for s in mine if s["status"] and 422 in s["status"] and inv.is_legacy(s)]
    assert legacy == []
    named = [f'{s["module"]}:{s["line"]}' for s in mine
             if isinstance(s["details"], list) and {"field", "key"} & set(s["details"]) and "fields" not in s["details"]]
    assert named == [], "a refusal that names a field also sends `fields` (400 / 403 / 409 included)"
    hand_built = [d for d in err["direct_json"] if d["module"] in {"routers/local_identity.py", "routers/local_passkeys.py"}]
    assert hand_built and all(d["content"] == "ApiError.payload" for d in hand_built), hand_built


def test_the_ratchet_baseline_holds_and_records_these_families_at_zero():
    inv = _inventory()
    base = json.loads((REPO / "scripts" / "error_contract_ratchet.json").read_text(encoding="utf-8"))
    now = inv.build()["summary"]["legacy_422_by_family"]
    assert inv.ratchet_problems(now, base) == []
    for fam in FAMILY_6 | FAMILY_7 | (FAMILY_8 - {"media"}):
        assert base["legacy_422_by_family"].get(fam, 0) == 0, fam
    # the check itself: a family that grows, or appears, is refused
    assert inv.ratchet_problems({**now, "home": 1}, base)
    assert inv.ratchet_problems({**now, "brand_new": 1}, base)


# ---------------------------------------------------------------- the helper


def test_issue_problems():
    issues = [{"path": "alias", "code": "alias_required", "message": "תנו שם"}, {"path": "", "code": "validation", "message": "m"},
              {"path": "templates.0", "code": "type"}]
    assert errors.issue_problems(issues) == [{"field": "alias", "code": "alias_required", "message": "תנו שם"},
                                             {"field": "body", "code": "validation", "message": "m"},
                                             {"field": "templates.0", "code": "type", "message": None}]
    assert errors.issue_problems([{"param": "x", "code": "required"}, {"param": "", "code": "rule"}], key="param", prefix="params.") == [
        {"field": "params.x", "code": "required", "message": None}, {"field": "params", "code": "rule", "message": None}]
    e = errors.field_error("m", problems=errors.issue_problems(issues))
    assert e.details["fields"] == ["alias", "body", "templates.0"]
    assert e.details["problems"][2] == {"field": "templates.0", "code": "type"}, "a missing message is left out"


# ---------------------------------------------------------------- family 6


@pytest.mark.parametrize("mod", [automation_ops, schedule_ops])
def test_problem_error_keeps_errors_and_adds_fields_problems(mod):
    issues = [{"path": "triggers.0", "code": "bad_value", "message": "ערך"}, {"path": "", "code": "validation", "message": "הטיוטה"}]
    e = mod.problem_error(issues)
    assert (e.status, e.code) == (422, "validation") and e.user_message.startswith("ערך לא תקין — triggers.0")
    assert e.details == {"errors": issues, "fields": ["triggers.0", "body"],
                         "problems": [{"field": "triggers.0", "code": "bad_value", "message": "ערך"}, {"field": "body", "code": "validation", "message": "הטיוטה"}]}
    promoted = [{"path": "x", "code": "v", "message": "m"}, {"path": "actions.1", "code": "action_not_allowed", "message": "אסור"}]
    p = mod.problem_error(promoted)
    assert (p.status, p.code) == (mod.PROMOTED["action_not_allowed"][0], "action_not_allowed")
    assert p.details["errors"] == promoted and p.details["path"] == "actions.1" and p.details["fields"] == ["x", "actions.1"]


def test_scenarios_validation_overrides_and_settings():
    e = scenarios._validation([{"path": "actions", "code": "flag_cycle", "message": "m"}])
    assert e.details == {"errors": [{"path": "actions", "code": "flag_cycle", "message": "m"}], "fields": ["actions"],
                         "problems": [{"field": "actions", "code": "flag_cycle", "message": "m"}]}
    o = _raises(scenarios_router._overrides, {"a": "text"})
    assert o.details["fields"] == ["overrides"] and o.details["errors"][0]["path"] == "overrides" and o.details["problems"][0]["code"] == "bad_value"
    s = _raises(scenario_settings.update, None, None, {"scenarios.no_such": "x"}, None)
    assert (s.code, s.details) == ("invalid_setting", {"key": "scenarios.no_such", "fields": ["scenarios.no_such"]})


def test_blueprint_parameter_problems_name_params():
    items = [{"param": "light", "code": "required", "message": "שדה חובה"}]
    e = automation_blueprints._problems(items)
    assert e.details == {"errors": items, "fields": ["params.light"], "problems": [{"field": "params.light", "code": "required", "message": "שדה חובה"}]}


def test_forwarded_replies_are_success_answers_only():
    """The routers forward `(status, payload)` from these services as a JSONResponse (ADR-019 "direct JSONResponse answers"): every
    literal status they return is a success; a refusal is raised as `ApiError` and answered by the one handler."""
    services = ["services/automation_ops.py", "services/schedule_ops.py", "services/cast_sessions.py", "services/media_commands.py", "services/media_queue.py"]
    found = []
    for rel in services:
        for node in ast.walk(ast.parse((PKG / rel).read_text(encoding="utf-8"))):
            if isinstance(node, ast.Return) and isinstance(node.value, ast.Tuple) and node.value.elts:
                first = node.value.elts[0]
                for c in ([first.body, first.orelse] if isinstance(first, ast.IfExp) else [first]):
                    if isinstance(c, ast.Constant) and isinstance(c.value, int) and not isinstance(c.value, bool) and c.value >= 100:
                        found.append((rel, node.lineno, c.value))
    assert found and all(s < 400 for _, _, s in found), [f for f in found if f[2] >= 400]


# ---------------------------------------------------------------- family 7


def test_tariff_definition_and_formula_refusals():
    e = energy_billing.tou_error(energy_tou.TouError("gap", "seasons.0", "חסר טווח"))
    assert (e.code, e.user_message) == ("tariff_definition_invalid", "חסר טווח")
    assert e.details == {"errors": [{"code": "gap", "path": "seasons.0", "message": "חסר טווח"}], "fields": ["definition.seasons.0"],
                         "problems": [{"field": "definition.seasons.0", "code": "gap"}]}
    assert energy_billing.tou_error(energy_tou.TouError("empty", "", "m")).details["fields"] == ["definition"]
    f = energy_billing.formula_error(energy_formula.FormulaError("empty"))
    assert f.code == "formula_invalid" and f.details["fields"] == ["formula"] and f.details["problems"] == [{"field": "formula", "code": "empty"}]
    assert f.details["errors"][0]["code"] == "empty" and "pos" in f.details["errors"][0]
    assert energy_billing.formula_error(energy_formula.FormulaError("empty"), "preset").details["fields"] == ["preset"]


# ---------------------------------------------------------------- family 8


def test_settings_documents_name_the_key_in_fields():
    for fn, args in ((door_windows.update_settings, (None, {"doors.nope": "x"})), (offline_field.update_settings, (None, None, {"x.nope": "1"}, None)),
                     (quiet_windows.update_settings, (None, None, {"x.nope": "1"}, None)), (readiness.update_settings, (None, None, {"x.nope": "1"}, None))):
        e = _raises(fn, *args)
        assert e.code == "invalid_setting" and e.details["fields"] == [e.details["key"]], fn


def test_home_family_keeps_its_class_and_adds_fields():
    e = _raises(home_family.scene_draft, "n", "light.kitchen", "10:00", ["sun"])
    assert isinstance(e, home_family.HomeFamilyError) and e.details == {"field": "scene", "fields": ["scene"]}


def test_music_server_address_refusal():
    port = sorted(ma_direct.REFUSED_PORTS)[0]
    e = _raises(ma_direct.check_address, f"http://ma.example:{port}")
    assert (e.code, e.details) == ("port_refused", {"field": "url", "fields": ["url"]})


def test_hand_built_envelopes_are_api_error_payloads(monkeypatch):
    monkeypatch.setattr(local_identity, "_rid", lambda _r: "cid-1")
    r = local_identity._error(object(), 429, "rate_limited", "נסו שוב", {"Retry-After": "60"}, retryable=True)
    assert r.status_code == 429 and r.headers["retry-after"] == "60"
    assert json.loads(r.body) == {"code": "rate_limited", "user_message": "נסו שוב", "retryable": True, "correlation_id": "cid-1", "details": {}}
    src = (PKG / "routers" / "local_passkeys.py").read_text(encoding="utf-8")
    assert 'ApiError(404, "not_found", "Not found").payload(' in src and '"user_message": "Not found"' not in src
    assert local_passkeys.assetlinks is not None
