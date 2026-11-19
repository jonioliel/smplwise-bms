"""CR-ROUTE-CHAR-2460: the coverage script (scripts/wire_route_coverage.py) sees every modelled route, adds up the oracle files of
several runs, and its static scan follows path constants; the oracle writes its file when SW_WIRE_COVERAGE_DIR is set."""
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def _script():
    spec = importlib.util.spec_from_file_location("wire_route_coverage", ROOT / "scripts" / "wire_route_coverage.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def test_every_modelled_route_is_listed_once():
    from test_wire_routers_b_2450 import ROUTERS

    routes = _script().modelled_routes()
    keys = [r["key"] for r in routes]
    assert len(keys) == len(set(keys))
    assert {r["router"] for r in routes} >= set(ROUTERS) | {"energy_meters", "energy_billing", "water", "water_billing"}
    assert "POST /api/v1/cases/{case_id}/items/{item_id}/preserve" in keys and all(k.split(" ", 1)[1].startswith("/api/v1/") for k in keys)


def test_runs_add_up(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    a.mkdir()
    b.mkdir()
    (a / "oracle-1.json").write_text(json.dumps({"GET /api/v1/x": 2}), encoding="utf-8")
    (a / "oracle-2.json").write_text(json.dumps({"GET /api/v1/x": 1, "PUT /api/v1/y": 1}), encoding="utf-8")
    (b / "oracle-3.json").write_text(json.dumps({"GET /api/v1/x": 4, "PUT /arx/api/v1/y": 2}), encoding="utf-8")  # the Arx mount
    (b / "other.json").write_text("not ours", encoding="utf-8")
    assert _script().covered([a, b]) == {"GET /api/v1/x": 7, "PUT /api/v1/y": 3}


def test_routes_answering_their_own_json_response_are_told_apart():
    routes = {r["key"]: r for r in _script().modelled_routes()}
    assert routes["POST /api/v1/auth/local/sign-in"]["own_json"] is True
    assert routes["GET /api/v1/energy/bills/state"]["own_json"] is True
    assert routes["GET /api/v1/floors/{floor_id}"]["own_json"] is False


def test_static_scan_expands_imported_path_constants():
    mod = _script()
    texts = {"helper_x.py": 'API = "/api/v1/infra/water"\n',
             "test_a.py": 'from helper_x import API\n\ndef t(c, mid):\n    c.post(f"{API}/meters/{mid}/replace")\n'}
    consts = mod._consts(texts)
    assert consts["test_a.py"] == {"API": "/api/v1/infra/water"}
    text = mod._expanded(texts["test_a.py"], consts["test_a.py"])
    assert mod._path_regex("/infra/water/meters/{meter_id}/replace").search(text)
    assert not mod._path_regex("/infra/water/meters/{meter_id}/mute").search(text)


def test_the_oracle_writes_its_file_when_asked(tmp_path):
    code = ("import sys; sys.path.insert(0, 'tests'); from support import wire_oracle as w; w.install(); "
            "w.CHECKED['GET /api/v1/z'] = 3")
    env = {**os.environ, "SW_WIRE_COVERAGE_DIR": str(tmp_path), "SW_WIRE_ORACLE": "1"}
    subprocess.run([sys.executable, "-c", code], cwd=ROOT / "smplwise_vms" / "backend", env=env, check=True, timeout=300)
    files = list(tmp_path.glob("oracle-*.json"))
    assert len(files) == 1 and json.loads(files[0].read_text(encoding="utf-8")) == {"GET /api/v1/z": 3}
