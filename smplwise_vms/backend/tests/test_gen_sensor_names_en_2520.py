"""GEN-SENSOR-NAMES-EN-2520: the generator sensor names exist in English too. The server sends them beside the unchanged Hebrew, as the alert
types' `title_en`: `needs_en` beside the routing's "requires sensor" `needs` (and the device detail's alert types), `label_en` beside a role's
`label` in the sensor-mapping answer. Additive: every Hebrew field keeps its value."""
from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient
from generator_world import make_generator

from smplwise.db import Database
from smplwise.services import generator_alerts as alerts
from smplwise.services import generator_catalog as cat
from smplwise.services import generator_runtime as runtime
from test_generator import API, detect, gid

HEB = re.compile(r"[֐-׿]")


@pytest.fixture()
def app(settings):
    from smplwise.main import create_app
    from smplwise.services import ha_sync

    ha_sync.STATE.connected = False
    alerts.reset()
    runtime.reset()
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    return c, Database(settings.db_path), settings


def _old_needs(t: cat.AlertType) -> str:
    """The Hebrew 'requires sensor' text as built before this row."""
    value = [cat.ROLES[r][2] for r in t.needs if not r.startswith("alarm_")]
    return ", ".join(value or [cat.ROLES[r][2] for r in t.needs])


def test_every_role_has_an_english_name_without_hebrew():
    assert set(cat.ROLE_NAMES_EN) == set(cat.ROLES)
    for role, name in cat.ROLE_NAMES_EN.items():
        assert name.strip() and not HEB.search(name), role
    assert cat.role_label("fuel_pct", "en") == "Fuel level" and cat.role_label("fuel_pct") == "מפלס דלק" == cat.ROLES["fuel_pct"][2]


def test_needs_label_hebrew_unchanged_and_english_in_the_same_order():
    for t in cat.ALERT_TYPES:
        assert cat.needs_label(t) == _old_needs(t), t.key
        en = cat.needs_label(t, "en")
        assert not HEB.search(en), t.key
        assert en.count(",") == cat.needs_label(t).count(","), t.key
    overload = cat.TYPE_BY_KEY["overload"]
    assert cat.needs_label(overload) == "עומס, הספק" and cat.needs_label(overload, "en") == "Load, Power"
    # the controller alarm outputs only when no value sensor can do it
    assert cat.needs_label(cat.TYPE_BY_KEY["low_fuel"], "en") == "Fuel level"


def test_policies_send_needs_en_beside_the_unchanged_hebrew(app):
    c, db, _ = app
    make_generator(db, "minimal")
    detect(db)
    g = gid(db)
    items = c.get(f"{API}/devices/{g}/policies").json()["items"]
    missing = [i for i in items if not i["available"]]
    assert missing, "the minimal controller leaves alert types without their sensor"
    for i in missing:
        t = cat.TYPE_BY_KEY[i["key"]]
        assert i["needs"] == _old_needs(t) and HEB.search(i["needs"])
        assert i["needs_en"] == cat.needs_label(t, "en") and not HEB.search(i["needs_en"])
    for i in items:
        if i["available"]:
            assert i["needs"] is None and i["needs_en"] is None


def test_device_detail_alert_types_send_needs_en(app):
    c, db, _ = app
    make_generator(db, "minimal")
    detect(db)
    d = c.get(f"{API}/devices/{gid(db)}").json()
    for t in d["alert_types"]:
        if t["available"]:
            assert t["needs"] is None and t["needs_en"] is None
        else:
            assert t["needs"] == _old_needs(cat.TYPE_BY_KEY[t["key"]]) and t["needs_en"] == cat.needs_label(cat.TYPE_BY_KEY[t["key"]], "en")


def test_role_mapping_sends_label_en_beside_the_unchanged_hebrew_label(app):
    c, db, _ = app
    make_generator(db, "full", model="DSE7320")
    detect(db)
    items = c.get(f"{API}/devices/{gid(db)}/roles").json()["items"]
    assert [i["role"] for i in items] == list(cat.ROLES)
    for i in items:
        assert i["label"] == cat.ROLES[i["role"]][2]
        assert i["label_en"] == cat.ROLE_NAMES_EN[i["role"]]
    fuel = next(i for i in items if i["role"] == "fuel_pct")
    assert (fuel["label"], fuel["label_en"]) == ("מפלס דלק", "Fuel level")
