"""CR-017 S1 test seam: the add-on's `AutomationsTransport` over S2's `FakeHaConfig` (tests/fake_ha_config.py), and the S1 API tests' own world.

The Home Assistant double is S2's: the config REST API, WebSocket, runtime services, reload semantics, traces and the REAL bridge code
(`bridge_config_item`) all come from `fake_ha_config`. What is S1's: the population the API tests rely on (`automations_seed_s1.py`: the entities of
`fake_scheduler`'s world, so `conftest.seed_tree` placements and CR-014 helpers apply), the transport that routes the add-on's calls into the fake, and the
mirror seed (the entities, registry rows, areas and floors the entity sync would have written). No network, no Home Assistant."""
from __future__ import annotations

import copy
from typing import Any

import automations_seed_s1 as seed
from fake_ha_config import FakeHaConfig, slug
from fake_scheduler import AREAS, FLOORS, world_registry, world_states
from smplwise.errors import ApiError

SECRET_DEFAULT = "pairing-secret-for-tests"


def build_world(**kw: Any) -> FakeHaConfig:
    """S2's fake, populated with the S1 test world: the generic entities, the 16 automations / 3 scripts / 2 scenes of `automations_seed_s1`, 20 integration
    scenes, a YAML-managed automation and one without an id."""
    f = FakeHaConfig(**kw)
    for eid, st in world_states().items():
        f.states[eid] = copy.deepcopy(st)
    f.registry.extend(world_registry())
    data = seed.seed_probe_like()
    for cfg in data["automations"]:
        eid = f._unique_entity("automation", slug(str(cfg.get("alias", ""))) or f"automation_{cfg['id'][-4:]}")
        f._seed_automation(eid, cfg["id"], cfg, True)
    for key, cfg in data["scripts"].items():
        f.scripts[key] = copy.deepcopy(cfg)
        f._seed_script_entity(key, cfg)
    for cfg in data["scenes"]:
        f.scenes.append(copy.deepcopy(cfg))
        f._seed_scene_entity(f._unique_entity("scene", slug(str(cfg.get("name", ""))) or f"scene_{cfg['id'][-4:]}"), cfg["id"], cfg)
    for eid in seed.integration_scenes():
        f.states[eid] = {"entity_id": eid, "state": "unknown", "last_changed": f.iso(), "attributes": {"friendly_name": eid.split(".", 1)[1].replace("_", " ")}}
        f.registry.append(f._reg_row(eid, platform="wall_hub", unique_id=eid))
    # a YAML-managed automation (an entity with an id that the editor's file does not hold) and one without any id
    cfg = {"id": "yaml1", "alias": "אוטומציה מקובץ תצורה", "mode": "single", "triggers": [{"trigger": "time", "at": "04:00:00"}], "conditions": [],
           "actions": [{"action": "light.turn_off", "target": {"entity_id": ["light.office"]}}]}
    f.yaml_items["automation.yaml_managed"] = cfg
    f.states["automation.yaml_managed"] = {"entity_id": "automation.yaml_managed", "state": "on", "last_changed": f.iso(),
                                           "attributes": {"friendly_name": cfg["alias"], "id": "yaml1", "mode": "single", "current": 0, "last_triggered": None}}
    f.registry.append(f._reg_row("automation.yaml_managed", platform="automation", unique_id="yaml1"))
    f.yaml_items["automation.no_id_item"] = {"alias": "אוטומציה בלי מזהה", "mode": "single", "triggers": [{"trigger": "time", "at": "04:30:00"}], "conditions": [], "actions": []}
    f.states["automation.no_id_item"] = {"entity_id": "automation.no_id_item", "state": "on", "last_changed": f.iso(),
                                         "attributes": {"friendly_name": "אוטומציה בלי מזהה", "mode": "single", "current": 0, "last_triggered": None}}
    return f


class FakeTransport:
    """The add-on's `AutomationsTransport` over a FakeHaConfig: no network. `up = False` is an unreachable Home Assistant (503 `ha_unavailable`).

    The bridge side: `admins` = the HA users (ids as the directory pushes them) that are HA administrators, `delegated` = the options-flow switch,
    `allowed[user]` = the entities that non-administrator may control (absent / None = all), `fail_next["timeout"]` = the next bridge call times out
    before anything is applied, `fail_next["answer"]` = the next bridge answer as given (nothing applied). `bridge_calls` records every message the add-on signed (without the signature fields)."""

    def __init__(self, fake: FakeHaConfig, secret: str) -> None:
        self.fake, self.secret = fake, secret
        self.up = True
        self.configured_flag = True
        self.admins: set[str] = {"dev-joni"}
        self.delegated = False
        self.allowed: dict[str, set[str] | None] = {}
        self.fail_next: dict[str, Any] = {}
        self.bridge_calls: list[dict[str, Any]] = []
        self.ws_calls: list[str] = []
        self.on_change: Any = None

    def _check(self) -> None:
        if not self.up:
            raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True)

    def rest_config(self, kind: str, config_id: str) -> tuple[int, Any]:
        self._check()
        status, body = self.fake.rest("GET", f"/api/config/{kind}/config/{config_id}")
        return status, (None if isinstance(body, str) else body)

    def ws(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        self._check()
        self.ws_calls.append(msg_type)
        return self.fake.ws({"type": msg_type, **kw})

    def bridge(self, payload: dict[str, Any]) -> dict[str, Any]:
        self._check()
        self.bridge_calls.append({k: v for k, v in payload.items() if k not in ("sig", "nonce", "ts")})
        if self.fail_next.pop("timeout", None):
            raise ApiError(504, "config_timeout", "תשתית המערכת לא ענתה בזמן; ייתכן שהשינוי נשמר. רעננו לפני ניסיון נוסף.")
        answer = self.fail_next.pop("answer", None)  # `fail_next["answer"]` = the bridge's next answer, verbatim (nothing applied)
        if answer is not None:
            return answer
        uid = payload.get("user_id")
        hass = self.fake.bridge_hass()
        hass.write_files()  # the files are the fake's lists as they are now (a test may have edited them outside the bridge)
        resp = self.fake.bridge_config_item(payload, self.secret, delegated=self.delegated, is_admin=uid in self.admins, allowed=self.allowed.get(uid))
        hass.pull_files()  # a delete reloads nothing: take the file's state in
        if self.on_change is not None:
            self.on_change()
        return resp

    def state(self, entity_id: str) -> dict[str, Any] | None:
        self._check()
        st = self.fake.states.get(entity_id)
        return copy.deepcopy(st) if st else None

    def connected(self) -> bool:
        return self.up

    def configured(self) -> bool:
        return self.configured_flag


def seed_mirror(db: Any, fake: FakeHaConfig) -> None:
    """Put the entities, the loaded automations / scripts / scenes, their registry rows and the HA areas / floors into the add-on's mirror (what the entity sync
    would have written)."""
    from smplwise.services import ha_client, ha_sync

    with db.connection() as conn:
        for st in fake.states.values():
            ha_sync.upsert_state(conn, st)
        ha_sync.apply_registry(conn, ha_client.registry_maps(fake.registry, [], AREAS, FLOORS))
        ha_sync.apply_structure(conn, AREAS, FLOORS)
