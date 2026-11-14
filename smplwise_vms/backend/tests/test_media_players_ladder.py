"""CR-016: the dedupe ladder (services/media_model.build) run over the two fixture houses of the evidence suite (`frontend/tests/fixtures/media_fake_ha.py`,
a Music Assistant house and a Sonos house without floors) must reproduce the clusters and the weak suggestions that fixture DECLARES from its own,
independent description of the ladder - rungs 1, 2, 2b, 2c, 3, 3b, 4, 5, 5b and the kinds that are never suggested. The fixture is read, never written; the test is skipped
when it is not in the checkout (the evidence suite lives on another branch until it is merged) or when `SW_MEDIA_FAKE_HA` names a file that does not exist."""
from __future__ import annotations

import importlib.util
import inspect
import itertools
import os
import sys
from pathlib import Path

import pytest

from smplwise.services import media_model as mm

FIXTURE = Path(os.environ.get("SW_MEDIA_FAKE_HA") or Path(__file__).resolve().parents[3] / "frontend" / "tests" / "fixtures" / "media_fake_ha.py")
pytestmark = pytest.mark.skipif(not FIXTURE.is_file(), reason="the evidence fixture houses are not in this checkout")


def fixture():
    spec = importlib.util.spec_from_file_location("media_fake_ha_ladder", FIXTURE)
    fx = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    sys.modules[spec.name] = fx  # type: ignore[union-attr]
    spec.loader.exec_module(fx)  # type: ignore[union-attr]
    if not getattr(fx, "build_world", None) or not inspect.signature(fx.build_world).parameters:
        pytest.skip("this is the CR-015 fixture (one house); the CR-016 houses come with the evidence suite")
    return fx


def convert(world):
    area_of = {d["id"]: d["area_id"] for d in world["devices"]}
    ents = []
    for e in world["entities"]:
        a = e["attributes"]
        ents.append({"entity_id": e["entity_id"], "domain": e["entity_id"].split(".", 1)[0], "platform": e["platform"], "unique_id": e["unique_id"], "device_id": e["device_id"],
                     "device_class": a.get("device_class"), "name": e.get("name") or a.get("friendly_name"), "original_name": e.get("original_name"),
                     "area_id": e.get("area_id") or area_of.get(e["device_id"]), "attributes": a, "state": e["state"], "available": e["state"] != "unavailable",
                     "supported_features": a.get("supported_features", 0), "hidden": bool(e.get("hidden_by")), "disabled": bool(e.get("disabled_by")), "last_changed": None, "last_updated": None})
    devs = [{"device_id": d["id"], "name": d["name"], "name_by_user": d.get("name_by_user"), "area_id": d["area_id"], "manufacturer": d.get("manufacturer"), "model": d.get("model"),
             "connections": mm.normalise_connections(d.get("connections")), "identifiers": mm.normalise_identifiers(d.get("identifiers"))} for d in world["devices"]]
    return ents, devs


@pytest.mark.parametrize("house", ["ma", "sonos"])
def test_the_ladder_reproduces_the_fixtures_declared_clusters_and_suggestions(house):
    world = fixture().build_world(house)
    ents, devs = convert(world)
    counter = itertools.count(1)
    model = mm.build(ents, devs, [], new_key=lambda: f"k{next(counter):031d}")
    mine = {frozenset(e.ref for e in d.endpoints) for d in model.devices.values()}
    declared = {frozenset(c) for c in world["clusters"]}
    assert mine == declared, (sorted(map(sorted, mine - declared)), sorted(map(sorted, declared - mine)))
    key_cluster = {d.key: frozenset(e.ref for e in d.endpoints) for d in model.devices.values()}
    ep_cluster = {f"ha:{ref}": c for c in mine for ref in c}
    got = {({"weak": "5"}.get(s.rule, s.rule), frozenset({ep_cluster[s.endpoint_id], key_cluster[s.device_key]})) for s in model.suggestions}
    want = {(s["rule"], frozenset({next(c for c in declared if s["a"][0] in c), next(c for c in declared if s["b"][0] in c)})) for s in world["suggestions"]}
    assert got == want, (sorted(got - want, key=str), sorted(want - got, key=str))


def test_receiver_b_with_a_different_model_string_stays_two_clusters_and_is_never_suggested():
    world = fixture().build_world("ma")
    ents, devs = convert(world)
    counter = itertools.count(1)
    model = mm.build(ents, devs, [], new_key=lambda: f"k{next(counter):031d}")
    refs = {e.ref: d for d in model.devices.values() for e in d.endpoints}
    heos, main = refs.get("media_player.cr016_denon_b_heos"), refs.get("media_player.cr016_denon_b")
    if heos is None or main is None:
        pytest.skip("this fixture version has no receiver B")
    assert heos.key != main.key, "a HEOS entity of another model string and no area is not merged by the ladder"
    assert not [s for s in model.suggestions if s.endpoint_id == "ha:media_player.cr016_denon_b_heos" or s.device_key in (heos.key, main.key) and "denon_b" in s.endpoint_id]
