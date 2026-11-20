"""CR-RESPONSE-MODELS-B-2450: the temperature route no other test reaches answers as before (through the wire oracle,
tests/support/wire_oracle.py): `PUT /infra/temperature/order` (the management list after a reorder)."""
from __future__ import annotations

from support import wire_oracle
from test_infra_temperature import API, app, create  # noqa: F401 - `app` is the module's fixture


def test_reorder_answers_the_management_list_as_before(app):  # noqa: F811 - the imported fixture
    c, _db, _settings, _clock = app
    a = create(c)
    b = create(c, name="מקפיא", temp_entity_id="sensor.freezer_temp", door_entity_id=None, low=-25, high=-15.5)
    r = c.put(f"{API}/order", json={"ids": [b, a]})
    assert r.status_code == 200, r.text
    assert [u["id"] for u in r.json()["units"]] == [b, a]
    assert wire_oracle.CHECKED.get(f"PUT {API}/order"), "never compared by the oracle"
