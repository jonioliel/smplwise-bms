"""RESPONSE-MODELS-E-2480 (code review 07:F8 step 2, MASTER_PLAN 3.6): the routers of scripts/gen_wire_types.py `FAMILIES_E` answer
through explicit response models (smplwise/wire/<router>.py, `ExactModel`: strict, so a value is never converted) and their client types
are generated (frontend/src/api/generated/wire-<router>.ts).

The characterisation is the wire oracle (tests/support/wire_oracle.py, installed by conftest): every answer a test receives from a
modelled route is compared, in the same request, with the route's pre-model serialisation, under SW_WIRE_STRICT=1. The models were drafted
from the answers the whole backend suite received (a shape recorder over every route) and checked against the router code. This file
checks the route table of every router of the block: every JSON route has a model with `exclude_unset` (a route without a JSON body is in
its wire module's `NO_JSON`), the models are strict wire models, and the generated client types are current and name every modelled route.
The application-wide count of what is still unmodelled is the ratchet (tests/test_wire_ratchet_2480.py)."""
from __future__ import annotations

import importlib
import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi.routing import APIRoute

from smplwise.wire import ExactModel, WireModel

ROOT = Path(__file__).resolve().parents[3]


def _gen():
    spec = importlib.util.spec_from_file_location("gen_wire_types", ROOT / "scripts" / "gen_wire_types.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules.setdefault("gen_wire_types", mod)
    spec.loader.exec_module(mod)
    return mod


GEN = _gen()
ROUTERS = {mods[0]: fname for fname, mods in GEN.FAMILIES_E.values()}


def _routes(name: str) -> list[tuple[str, APIRoute]]:
    out = []
    mod = importlib.import_module(f"smplwise.routers.{name}")
    for r in GEN.module_routes(mod):
        if isinstance(r, APIRoute) and r.endpoint.__module__ == mod.__name__:
            for m in sorted(r.methods - {"HEAD", "OPTIONS"}):
                out.append((f"{m} {r.path}", r))
    return out


def test_the_block():
    """Every router of the block has a wire module, one family per router, and no router of the block is in another family."""
    assert ROUTERS
    for _fname, mods in GEN.FAMILIES_E.values():
        assert len(mods) == 1
        importlib.import_module(f"smplwise.wire.{mods[0]}")
    others = {m for fam, (_f, mods) in GEN.FAMILIES.items() if fam not in GEN.FAMILIES_E for m in mods}
    assert not others & set(ROUTERS)


@pytest.mark.parametrize("name", sorted(ROUTERS))
def test_every_json_route_declares_a_wire_model(name):
    wmod = importlib.import_module(f"smplwise.wire.{name}")
    no_json = wmod.NO_JSON
    # RESPONSE-MODELS-E-2480: a JSON route no test answers successfully stays unmodelled, named in UNMODELLED (the ratchet counts it)
    unmodelled = getattr(wmod, "UNMODELLED", frozenset())
    missing, stale = [], []
    keys = set()
    for key, r in _routes(name):
        keys.add(key)
        documented = any(GEN.wire_models((x or {}).get("model")) for x in (r.responses or {}).values())
        if key in no_json:
            if GEN.wire_models(r.response_model) or documented:
                stale.append(key)
            continue
        if documented:
            continue
        if key in unmodelled:
            if GEN.wire_models(r.response_model):
                stale.append(key + " (UNMODELLED)")
            continue
        if not GEN.wire_models(r.response_model):
            missing.append(key)
        elif not r.response_model_exclude_unset:
            missing.append(key + " (exclude_unset)")
    assert not missing, f"{name}: JSON routes without a response model: {missing}"
    assert not stale, f"{name}: routes listed as non-JSON but modelled: {stale}"
    assert not (set(no_json) - keys), f"{name}: NO_JSON names routes the router does not have: {sorted(set(no_json) - keys)}"
    assert not (set(unmodelled) - keys), f"{name}: UNMODELLED names routes the router does not have: {sorted(set(unmodelled) - keys)}"


@pytest.mark.parametrize("name", sorted(ROUTERS))
def test_every_model_is_a_strict_wire_model(name):
    m = importlib.import_module(f"smplwise.wire.{name}")
    for attr, obj in vars(m).items():
        if isinstance(obj, type) and issubclass(obj, WireModel) and obj.__module__ == m.__name__:
            assert issubclass(obj, ExactModel), attr
            assert obj.model_config.get("extra") == "allow" and obj.model_config.get("strict") is True, attr


def test_model_names_are_unique_across_the_wire_package():
    """One name, one shape: the generated files of different families never declare the same interface name differently."""
    seen: dict[str, str] = {}
    dup = []
    for p in sorted((ROOT / "smplwise_vms" / "backend" / "smplwise" / "wire").glob("*.py")):
        if p.stem == "__init__":
            continue
        m = importlib.import_module(f"smplwise.wire.{p.stem}")
        for attr, obj in vars(m).items():
            if isinstance(obj, type) and issubclass(obj, WireModel) and obj.__module__ == m.__name__:
                if attr in seen and p.stem in ROUTERS:
                    dup.append((attr, seen[attr], p.stem))
                seen.setdefault(attr, p.stem)
    assert not dup, dup


def test_the_fallback_keeps_aliased_keys(monkeypatch):
    """Outside strict mode a value of another type sends the route's own object - including a key declared under an alias (`fields`,
    `schema`, a key that is no Python name). Before this row the fallback marked the ALIAS as set, and exclude_unset dropped the key
    (the oracle caught it: `GET /api/v1/access-control/groups` lost `fields`)."""
    import json

    from pydantic import Field

    monkeypatch.setenv("SW_WIRE_STRICT", "0")

    class Item(ExactModel):
        fields_: list[str] = Field(alias="fields")
        n: int

    class Answer(ExactModel):
        items: list[Item]

    built = {"items": [{"fields": ("a", "b"), "n": 1, "extra": True}]}  # a tuple: strict list refuses it -> fallback
    out = Answer.model_validate(built)
    sent = json.loads(Answer.__pydantic_serializer__.to_json(out, by_alias=True, exclude_unset=True, warnings=False))
    assert sent == {"items": [{"fields": ["a", "b"], "n": 1, "extra": True}]}


def test_the_generated_client_types_are_current():
    assert GEN.main(["--check"]) == 0


@pytest.mark.parametrize("name", sorted(ROUTERS))
def test_the_route_map_names_every_modelled_route(name):
    path = ROOT / "frontend" / "src" / "api" / "generated" / ROUTERS[name]
    if not any(GEN.wire_models(r.response_model) for _k, r in _routes(name)):
        assert not path.exists(), "a router without a modelled route has no generated file"
        return
    text = path.read_text(encoding="utf-8")
    no_json = importlib.import_module(f"smplwise.wire.{name}").NO_JSON
    for key, r in _routes(name):
        if key not in no_json and GEN.wire_models(r.response_model):
            method, path = key.split(" ", 1)
            assert f'"{method} /api/v1{path}"' in text, key
