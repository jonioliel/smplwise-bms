"""DATA-RULES-2-2550 (1): the starter battery's system choice "automatic / 12 V / 24 V" of the generator settings screen.

The server side is DATA-RULES-2540's (`battery_nominal_v` on PUT /generator/devices/{id}, null = automatic, generator.manage). This row
adds the screen's control (frontend/tests/unit-data-rules-2-2550.spec.ts) and makes the audit row name the choice before and after
(before: only the new value, so the row did not say what was changed). A fake controller only (tests/generator_world.py)."""
from __future__ import annotations

import json

from conftest import as_user, bind
from test_data_rules_generator_2540 import API, _gen, app, rows  # noqa: F401 - `app` is the fixture


def _updates(db) -> list[dict]:
    return [json.loads(r["details_json"] or "null") for r in rows(db, "SELECT details_json FROM audit_log WHERE action = 'generator.device.update' ORDER BY id")]


def test_the_battery_choice_is_audited_with_the_value_before_and_after(app):
    c, db, settings = app
    g = _gen(db)
    assert c.get(f"{API}/devices/{g}").json()["battery_nominal_v"] is None  # default: automatic (today's behaviour)
    assert c.put(f"{API}/devices/{g}", json={"battery_nominal_v": 24}).status_code == 200
    assert c.put(f"{API}/devices/{g}", json={"battery_nominal_v": None}).status_code == 200
    assert _updates(db)[-2:] == [{"battery_nominal_v": 24, "battery_nominal_v_before": None}, {"battery_nominal_v": None, "battery_nominal_v_before": 24}]
    # a save of other fields only writes no battery details (the row stays as before)
    assert c.put(f"{API}/devices/{g}", json={"rated_kw": 40}).status_code == 200
    assert _updates(db)[-1] is None


def test_an_operator_cannot_choose_the_battery_system_and_the_refusal_is_audited(app):
    c, db, settings = app
    g = _gen(db)
    bind(c, settings, "ops", "operator", "installation", "*")
    assert c.put(f"{API}/devices/{g}", json={"battery_nominal_v": 12}, headers=as_user("ops")).status_code == 403
    assert rows(db, "SELECT 1 FROM audit_log WHERE action = 'generator.manage' AND decision = 'denied'")
    assert c.get(f"{API}/devices/{g}").json()["battery_nominal_v"] is None
