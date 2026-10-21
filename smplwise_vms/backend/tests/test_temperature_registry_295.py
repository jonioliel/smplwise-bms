"""TEMPREG-295: the temperature report use is part of the messaging registry from application start, and follows the module state.

Before: `services/temperature_whatsapp` joined the registry only once a temperature route or tick first imported it, and the use had no
module gate, so the Settings messaging accounts screen showed or omitted it depending on what had run since the restart."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from conftest import as_user
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso
from smplwise.main import create_app
from smplwise.services import messaging_runtime as mr

API = "/api/v1"
URL = f"{API}/messaging/whatsapp"
USE = "infra.temperature.reports"


def _define_unit(c, settings) -> None:
    at = now_iso()
    with Database(settings.db_path).connection() as conn:
        conn.execute("""INSERT INTO ha_entities (entity_id, name, domain, device_class, unit, state, available, last_changed, last_updated, first_seen_at, updated_at)
                        VALUES ('sensor.fridge_temp', 'fridge', 'sensor', 'temperature', '°C', '4.0', 1, ?, ?, ?, ?)""", (at, at, at, at))
    r = c.post(f"{API}/infra/temperature", json={"name": "מקרר", "temp_entity_id": "sensor.fridge_temp", "low": 2, "high": 6, "defrost_mode": "none"})
    assert r.status_code in (200, 201), r.text


def test_the_use_is_registered_by_application_start_without_any_temperature_route(settings):
    """A fresh interpreter that only builds the app (no temperature request, no tick) already has the report use in the registry."""
    code = (
        "import sys; sys.path.insert(0, %r)\n"
        "from smplwise.main import create_app\n"
        "from smplwise.services import messaging_runtime as mr\n"
        "create_app(%r)\n"
        "print('USE_REGISTERED' if any(p.__module__.endswith('temperature_whatsapp') for p in mr._USE_PROVIDERS) else 'USE_MISSING')\n"
    ) % (str(Path(__file__).resolve().parents[1]), settings)
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=120, cwd=str(Path(__file__).resolve().parents[1]))
    assert "USE_REGISTERED" in out.stdout, out.stdout + out.stderr


def test_the_use_is_hidden_while_the_module_is_off_and_shown_once_a_unit_is_defined(settings):
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")  # joni bootstraps as system_admin
    assert any(getattr(p, "__module__", "").endswith("temperature_whatsapp") for p in mr._USE_PROVIDERS)  # registered, not lazily
    off = c.get(URL, headers=as_user("joni")).json()
    assert USE not in [u["key"] for u in off["uses"]]
    _define_unit(c, settings)
    on = c.get(URL, headers=as_user("joni")).json()
    assert USE in [u["key"] for u in on["uses"]]
    assert "temperature" in on["modules"]
