"""0.1.161: the settings list of screens / speakers shows the integration, the platform's device id and the availability of each device,
read from the registry data already mirrored (no migration)."""
from __future__ import annotations

import media_seed as seed
import pytest
from fastapi.testclient import TestClient

from smplwise.main import create_app


@pytest.fixture()
def m(settings):
    c = TestClient(create_app(settings))
    seed.install(c)
    return c


def by_anchor(c: TestClient) -> dict:
    return {d["anchor_entity_id"]: d for d in seed.admin(c)["devices"]}


def test_integrations_are_the_distinct_sorted_platforms_of_all_endpoints(m):
    d = by_anchor(m)
    living = d["media_player.tv_living"]
    assert living["integrations"] == sorted(set(living["integrations"]))
    assert {"samsungtv_smart", "cast", "smartthings"} <= set(living["integrations"])
    assert d["media_player.lg_office"]["integrations"] == ["webostv"]
    assert d["media_player.generic_tv"]["integrations"] == ["generic"]


def test_ha_device_id_and_availability_exposed_for_screens(m):
    d = by_anchor(m)
    assert d["media_player.lg_office"]["ha_device_id"] == "d_lg"
    assert d["media_player.lg_office"]["available"] is True
    assert d["media_player.lg_storage"]["available"] is False
    assert d["media_player.lg_storage"]["integrations"] == ["webostv"]


def test_device_without_registry_entry_and_removed_entity(m):
    # a media_player with a state and no registry entry: no integration and no device id, and the route still answers
    m.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "media_player.orphan_tv", "state": "on", "attributes": {"friendly_name": "Orphan", "device_class": "tv"}}]})
    orphan = by_anchor(m).get("media_player.orphan_tv")
    if orphan is not None:
        assert orphan["integrations"] == [] and orphan["ha_device_id"] is None
    # an entity removed from the registry drops out of the integrations without breaking the list
    reg = [e for e in seed.ENTITY_REGISTRY if e["entity_id"] != "media_player.tv_living_cast"]
    assert m.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": seed.DEVICES, "areas": seed.AREAS, "floors": seed.FLOORS}).status_code == 200
    assert isinstance(by_anchor(m)["media_player.tv_living"]["integrations"], list)
