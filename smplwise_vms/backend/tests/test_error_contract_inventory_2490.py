"""API-CONTRACT-ADR-2490: the inventory behind ADR-019 (scripts/error_contract_inventory.py) classifies 422 envelope shapes by their
`details` keys, finds the request-body models of the routes with their effective `extra` and client, lists plain-dict bodies and
the frontend reads of error-details keys - on a small tree, and on the real code without importing it."""
from __future__ import annotations

import importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]


def _mod():
    spec = importlib.util.spec_from_file_location("error_contract_inventory", REPO / "scripts" / "error_contract_inventory.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ROUTER = '''
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from ..errors import ApiError, validation
from ..models import Shared

router = APIRouter(prefix="/things")


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Inner(BaseModel):
    a: int


class ThingIn(Strict):
    name: str
    inner: Inner | None = None


class Loose(BaseModel):
    x: int


@router.post("/{tid}")
def create(tid: str, body: ThingIn, conn=Depends(lambda: None)):
    if not body.name:
        raise ApiError(422, "validation", "name", details={"fields": ["name"]})
    if body.name == "x":
        raise ApiError(422, "validation", "one", details={"field": "name"})
    if body.name == "y":
        raise ApiError(409 if tid else 422, "bad_key", "k", details={"key": "a.b"})
    raise validation("no details")


@router.put("/{tid}")
def replace(tid: str, body: Loose | None = None):
    try:
        pass
    except svc.ThingInvalid as exc:
        raise svc.err(422, "validation", fields=[{"field": "x", "code": "missing"}]) from None


@router.patch("/{tid}/raw")
def raw(tid: str, body: dict[str, Any]):
    return JSONResponse(status_code=422, content={"code": "x"})


@router.post("/devices/presence")
def shared(body: Shared):
    return {}
'''

MODELS = '''
from pydantic import BaseModel
class Shared(BaseModel):
    model_config = {"extra": "ignore"}
    a: int
'''


def _tree(tmp_path: Path) -> Path:
    (tmp_path / "routers").mkdir()
    (tmp_path / "routers" / "__init__.py").write_text("", encoding="utf-8")
    (tmp_path / "routers" / "things.py").write_text(ROUTER, encoding="utf-8")
    (tmp_path / "models.py").write_text(MODELS, encoding="utf-8")
    (tmp_path / "services" / "tickets").mkdir(parents=True)
    (tmp_path / "services" / "tickets" / "public_app.py").write_text('def f():\n    raise PublicError(422, "invalid", fields=[])\n', encoding="utf-8")
    return tmp_path


def test_shape_of_orders_the_keys():
    m = _mod()
    assert m.shape_of([]) == "none"
    assert m.shape_of(None) == "none"
    assert m.shape_of("dynamic") == "dynamic"
    assert m.shape_of(["field", "fields"]) == "fields"
    assert m.shape_of(["errors", "fields"]) == "errors"
    assert m.shape_of(["key"]) == "key"
    assert m.shape_of(["max"]) == "other"
    assert m.shape_of(["**"]) == "dynamic"


def test_error_sites_on_a_small_tree(tmp_path):
    m = _mod()
    root = _tree(tmp_path)
    err = m.scan_errors(root)
    sites = {(s["callee"], s["code"]): s for s in err["sites"]}
    assert sites[("ApiError", "bad_key")]["status"] == [409, 422]
    assert sites[("validation", "validation")]["details"] == []
    assert sites[("err", "validation")]["fields_form"] == "list[object]"
    shapes = sorted(m.shape_of(s["details"]) for s in err["sites"] if s["layer"] == "router")
    assert shapes == ["field", "fields", "fields", "key", "none"]
    assert [s["layer"] for s in err["sites"] if s["callee"] == "PublicError"] == ["public_app"]
    assert [t["exception"] for t in err["translations"]] == ["ThingInvalid"]
    assert [(d["status"], d["content"]) for d in err["direct_json"]] == [([422], "dict:code")]


def test_request_models_on_a_small_tree(tmp_path):
    m = _mod()
    root = _tree(tmp_path)
    req = m.scan_request_models(root)
    models = {x["model"]: x for x in req["models"]}
    thing = models["routers.things.ThingIn"]
    assert thing["extra"] == "forbid", "inherited from the strict base"
    assert thing["routes"] == ["POST /api/v1/things/{tid}"] and thing["clients"] == ["web_ui"]
    assert thing["nested"] == [{"model": "routers.things.Inner", "extra": "default"}]
    assert models["routers.things.Loose"]["extra"] == "default"
    assert models["models.Shared"]["extra"] == "ignore", "a dict model_config, resolved through the relative import"
    assert req["nested_only"] == {"routers.things.Inner": "default"}
    assert [(d["method"], d["path"]) for d in req["dict_bodies"]] == [("PATCH", "/api/v1/things/{tid}/raw")]


def test_client_of_paths():
    m = _mod()
    assert m.client_of("/api/v1/ha/bridge/directory") == "ha_bridge"
    assert m.client_of("/api/v1/presence/devices/{device_id}/events") == "phone_app"
    assert m.client_of("/api/v1/notifications/devices") == "phone_app"
    assert m.client_of("/api/v1/push/subscriptions") == "browser_push"
    assert m.client_of("/api/v1/presence/settings") == "web_ui"


def test_frontend_reads(tmp_path):
    m = _mod()
    (tmp_path / "api" / "generated").mkdir(parents=True)
    (tmp_path / "a.ts").write_text(
        "const f = err.body.details?.fields;\n"
        "const g = (e.body.details as { key?: string })?.key;\n"
        "const h = details.open; // a <details> element\n", encoding="utf-8")
    (tmp_path / "api" / "generated" / "wire.ts").write_text("const x = err.body.details?.field;\n", encoding="utf-8")
    assert m.scan_frontend(tmp_path) == {"fields": ["a.ts:1"], "key": ["a.ts:2"]}


def test_the_inventory_runs_on_the_real_code():
    m = _mod()
    rep = m.build()
    s = rep["summary"]
    assert s["sites_422"] > 100 and s["request_models"] > 100
    # RELEASE-2520-TRAIN: ADR-019 Step 1 is complete on the 2.52 train (error_contract_ratchet.json: 0 legacy 422 sites since
    # ADR019-FAMILY45 / FAMILY678 and the train's schedule-reads fix), so the legacy `field` shape is gone - the inventory still sees the
    # canonical `fields` shape and the detail-less `none`, and reports no legacy shape any more
    assert {"fields", "none"} <= set(s["shapes_422"]), "the inventory sees the canonical shape and the detail-less 422s"
    assert "field" not in set(s["shapes_422"]), "no legacy `details.field` 422 left (ADR-019 Step 1 done; the ratchet is 0)"
    assert "forbid" in s["request_models_by_extra"]
    assert "phone_app" in s["request_models_by_client"]
    assert any(d["path"] == "/api/v1/ha/bridge/directory" for d in rep["dict_bodies"]), "the bridge push stays a signed dict body"
    assert "fields" in rep["frontend"]
    md = m.markdown(rep)
    assert md.startswith("# Error envelope") and "## Request models" in md


def test_family_and_legacy():
    m = _mod()
    assert m.family_of("routers/access_control_door.py") == "access"
    assert m.family_of("services/tickets/store.py") == "tickets"
    assert m.family_of("routers/energy_billing.py") == "energy"
    assert m.family_of("main.py") == "core"
    assert m.is_legacy({"details": ["field"]}) and m.is_legacy({"details": ["key"]}) and m.is_legacy({"details": ["errors"]})
    assert m.is_legacy({"details": ["fields"], "fields_form": "map"})
    assert not m.is_legacy({"details": ["fields"], "fields_form": "list[str]"})
    assert not m.is_legacy({"details": []}) and not m.is_legacy({"details": ["max"]})
