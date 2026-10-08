"""Bridge 0.8.0: the CARD1 allow-list pairs shipped without a version bump, so an older installed bridge answered service_not_allowed.
The version, both copies, the add-on's required version and the administrator notice (health report) must agree."""
from __future__ import annotations

import json
import re

from bridge_loader import MIRROR, SRC
from conftest import seed_tree
from fastapi.testclient import TestClient

from smplwise.db import set_setting
from smplwise.main import create_app
from smplwise.services import ha_bridge

PAIRS = [("vacuum", "pause"), ("valve", "open_valve"), ("valve", "close_valve"), ("water_heater", "turn_on"), ("water_heater", "turn_off")]


def _t(v: str) -> tuple[int, ...]:
    return tuple(int(x) for x in re.findall(r"\d+", v))


def test_bridge_is_080_in_every_place_and_both_copies_are_identical():
    for root in (SRC, MIRROR):
        assert json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.8.0", root
        assert 'VERSION = "0.8.0"' in (root / "const.py").read_text(encoding="utf-8"), root
        assert "const VERSION = '0.8.0'" in (root / "www" / "smplwise-card.js").read_text(encoding="utf-8"), root
    files = sorted(p.relative_to(SRC).as_posix() for p in SRC.rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc")
    mirror_files = sorted(p.relative_to(MIRROR).as_posix() for p in MIRROR.rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc")
    assert files == mirror_files
    for rel in files:
        assert (SRC / rel).read_bytes() == (MIRROR / rel).read_bytes(), rel


def test_both_copies_allow_the_equipment_pairs_and_the_addon_requires_080():
    for root in (SRC, MIRROR):
        text = (root / "__init__.py").read_text(encoding="utf-8")
        for domain, service in PAIRS:
            assert f'("{domain}", "{service}")' in text, (root, domain, service)
    assert ha_bridge.BRIDGE_EQUIPMENT_REQUIRED == "0.8.0"
    for key in ("vacuum.pause", "valve.open_valve", "valve.close_valve", "water_heater.turn_on", "water_heater.turn_off"):
        assert key in ha_bridge.ACTIONS


def test_health_report_tells_the_administrator_when_the_bridge_is_older(settings):
    c = TestClient(create_app(settings))
    seed_tree(c)
    db = c.app.state.db

    def bridge_check(version: str):
        with db.connection() as conn:
            set_setting(conn, "bridge.secret", "s")
            set_setting(conn, "bridge.paired_at", "2026-10-08T00:00:00Z")
            set_setting(conn, "bridge.integration_version", version)
        r = c.get("/api/v1/health/report")
        assert r.status_code == 200, r.text
        return next(x for x in r.json()["checks"] if x["id"] == "bridge")

    old = bridge_check("0.7.0")
    assert old["meta"]["bridge_outdated"] is True and old["meta"]["bridge_required"] == "0.8.0" and old["status"] == "warn" and "0.8.0" in old["detail"]
    new = bridge_check("0.8.0")
    assert new["meta"]["bridge_outdated"] is False and "נדרש עדכון" not in new["detail"]
    assert _t("0.8.0") >= _t(ha_bridge.BRIDGE_EQUIPMENT_REQUIRED)
