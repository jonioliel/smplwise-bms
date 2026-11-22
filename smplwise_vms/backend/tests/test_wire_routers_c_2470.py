"""CR-RESPONSE-MODELS-C-2470 (code review 07:F8 step 2, MASTER_PLAN 3.6): the fourteen routers whose SQL moved into store modules in
CR-ROUTER-SQL-B-2450 answer through explicit response models (smplwise/wire/<router>.py), and the frontend's wire types for them are
generated (scripts/gen_wire_types.py -> frontend/src/api/generated/wire-<router>.ts). Same checks as tests/test_wire_routers_b_2450.py
(the batch-A routers).

The characterisation is the wire oracle (tests/support/wire_oracle.py, installed by conftest): every answer a test of these routers
receives is compared, in the same request, with the route's pre-model serialisation - keys, values and number / boolean types must be
identical, under SW_WIRE_STRICT=1. This file checks the route table: every JSON route of each router HAS a model (a route without a JSON
body is listed in its wire module's `NO_JSON`), the generated client types are current and name every modelled route, and the SQL boundary
of CR-ROUTER-SQL-B-2450 still holds."""
from __future__ import annotations

import importlib
import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi.routing import APIRoute

from smplwise.wire import WireModel

ROOT = Path(__file__).resolve().parents[3]
# router module -> generated file (scripts/gen_wire_types.py FAMILIES)
ROUTERS = {
    "calendar_feeds": "wire-calendar-feeds.ts",
    "door_windows": "wire-door-windows.ts",
    "frigate": "wire-frigate.ts",
    "devices": "wire-devices.ts",
    "generator": "wire-generator.ts",
    "doors": "wire-doors.ts",
    "rules": "wire-rules.ts",
    "notices": "wire-notices.ts",
    "tickets_costs": "wire-tickets-costs.ts",
    "views": "wire-views.ts",
    "access_custom_roles": "wire-access-custom-roles.ts",
    "recorders": "wire-recorders.ts",
    "calendar": "wire-calendar.ts",
    "notifications": "wire-notifications.ts",
}


def _gen():
    spec = importlib.util.spec_from_file_location("gen_wire_types", ROOT / "scripts" / "gen_wire_types.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules.setdefault("gen_wire_types", mod)
    spec.loader.exec_module(mod)
    return mod


def _routes(name: str) -> list[tuple[str, APIRoute]]:
    out = []
    for r in importlib.import_module(f"smplwise.routers.{name}").router.routes:
        if isinstance(r, APIRoute):
            for m in sorted(r.methods - {"HEAD", "OPTIONS"}):
                out.append((f"{m} {r.path}", r))
    return out


@pytest.mark.parametrize("name", sorted(ROUTERS))
def test_every_json_route_declares_a_wire_model(name):
    gen = _gen()
    no_json = importlib.import_module(f"smplwise.wire.{name}").NO_JSON
    missing, stale = [], []
    keys = set()
    for key, r in _routes(name):
        keys.add(key)
        if key in no_json:
            if gen.wire_models(r.response_model):
                stale.append(key)
            continue
        if not gen.wire_models(r.response_model):
            missing.append(key)
        elif not r.response_model_exclude_unset:
            missing.append(key + " (exclude_unset)")
    assert not missing, f"{name}: JSON routes without a response model: {missing}"
    assert not stale, f"{name}: routes listed as non-JSON but modelled: {stale}"
    assert not (set(no_json) - keys), f"{name}: NO_JSON names routes the router does not have: {sorted(set(no_json) - keys)}"


@pytest.mark.parametrize("name", sorted(ROUTERS))
def test_every_model_is_a_wire_model(name):
    m = importlib.import_module(f"smplwise.wire.{name}")
    for attr, obj in vars(m).items():
        if isinstance(obj, type) and issubclass(obj, WireModel) and obj.__module__ == m.__name__:
            assert obj.model_config.get("extra") == "allow", attr


def test_the_generated_client_types_are_current():
    """frontend/src/api/generated/ is what scripts/gen_wire_types.py writes from the models (run it after a model change)."""
    assert _gen().main(["--check"]) == 0


@pytest.mark.parametrize("name", sorted(ROUTERS))
def test_the_route_map_names_every_modelled_route(name):
    text = (ROOT / "frontend" / "src" / "api" / "generated" / ROUTERS[name]).read_text(encoding="utf-8")
    no_json = importlib.import_module(f"smplwise.wire.{name}").NO_JSON
    for key, _r in _routes(name):
        if key not in no_json:
            method, path = key.split(" ", 1)
            assert f'"{method} /api/v1{path}"' in text, key


def test_the_family_table_matches_the_generator():
    fams = {mods: fname for fname, mods in _gen().FAMILIES.values()}
    for name, fname in ROUTERS.items():
        assert fams.get((name,)) == fname, name


@pytest.mark.parametrize("name", sorted(ROUTERS))
def test_no_raw_sql_came_back_into_the_router(name):
    """CR-ROUTER-SQL-B-2450 (review 05 SQL boundary): the statements of these routers live in their store modules."""
    spec = importlib.util.spec_from_file_location("sql_boundary_report", ROOT / "scripts" / "sql_boundary_report.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    found = mod.scan_file(ROOT / "smplwise_vms" / "backend" / "smplwise" / "routers" / f"{name}.py")
    assert found["execute_calls"] == 0, (name, found)
