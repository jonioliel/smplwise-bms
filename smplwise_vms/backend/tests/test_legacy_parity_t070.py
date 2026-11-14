"""T070: scripts/legacy_parity.py - the legacy add-on's surface is extracted from source text (never imported, option values
never kept), every legacy route is claimed exactly once by the parity map, every Arx route / evidence / option target named
there exists in the repository as it stands, and the two products' go2rtc names and add-on slugs cannot collide."""
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("legacy_parity", ROOT / "scripts" / "legacy_parity.py")
lp = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(lp)

SURFACE = json.loads((ROOT / "docs" / "legacy" / "legacy_surface_v1.5.27.json").read_text(encoding="utf-8"))
PMAP = json.loads((ROOT / "docs" / "legacy" / "PARITY_MAP.json").read_text(encoding="utf-8"))

LEGACY_MAIN = '''
from fastapi import FastAPI
app = FastAPI()
CONFIG_OVERRIDE = Path("/config/legacy_override.json")

@app.get("/api/a")
async def a():
    return {}

@app.websocket("/api/ws")
async def ws(w):
    pass

@app.api_route("/api/proxy/{p:path}", methods=["GET", "POST"])
async def proxy(p):
    name = f"pb_{p}"
    return {}

def helper():
    return "not a route"
'''
LEGACY_CONFIG = '''name: "Legacy"
version: "9.9.9"
slug: "legacy_x"
ingress_port: 8099
options:
  nvr_ip: "10.1.2.3"
  app_pin: "1234"
schema:
  nvr_ip: str
  app_pin: str
map:
  - config:rw
'''


def _states(rep):
    return {c["id"]: c["state"] for c in rep["checks"]}


def test_extract_reads_routes_and_option_keys_never_values():
    s = lp.extract_surface(LEGACY_MAIN, LEGACY_CONFIG, "var name='hik_ch'+ch;")
    assert [(r["method"], r["path"]) for r in s["routes"]] == [
        ("GET", "/api/a"), ("WS", "/api/ws"), ("GET", "/api/proxy/{p:path}"), ("POST", "/api/proxy/{p:path}")]
    assert s["options"] == ["nvr_ip", "app_pin"]
    blob = json.dumps(s)
    assert "1234" not in blob and "10.1.2.3" not in blob  # a PIN and a host from the defaults never reach the surface
    assert s["legacy"]["slug"] == "legacy_x" and s["legacy"]["map"] == ["config:rw"]
    assert s["go2rtc_stream_prefixes"] == ["hik_ch", "pb_"]
    assert s["persisted_files"] == ["/config/legacy_override.json"]
    assert s["home_assistant"]["entities"] == [] and not any(s["home_assistant"]["api_use"].values())


def test_committed_surface_is_the_legacy_1527_shape():
    assert SURFACE["legacy"]["version"] == "1.5.27" and SURFACE["legacy"]["slug"] == "hikvision_nvr"
    assert len(SURFACE["routes"]) == 47
    assert "nvr_password" in SURFACE["options"] and len(SURFACE["options"]) == 14
    assert not any(SURFACE["home_assistant"]["api_use"].values())  # an Ingress add-on: no entity, no service, no HA API
    blob = json.dumps(SURFACE)
    for secretish in ("1234", "2468", "10.0.0.100", "172.30.32.1", "admin"):
        assert secretish not in blob


def test_repository_parity_passes_every_check():
    rep = lp.run_checks(SURFACE, PMAP)
    states = _states(rep)
    assert all(v == "PASS" for k, v in states.items() if k != "C7"), rep["checks"]
    assert states["C7"] in ("PASS", "SKIPPED")
    assert rep["verdict"] == "PASS"
    gaps = {g["id"]: g["status"] for g in rep["gaps"]}
    assert gaps.get("P09") == "missing" and gaps.get("P18") == "missing" and gaps.get("P12") == "partial"


def test_unclaimed_and_double_claimed_routes_fail_c1():
    pm = copy.deepcopy(PMAP)
    pm["capabilities"][0]["legacy_routes"].pop()  # GET /api/auth/tech/status now unclaimed
    pm["capabilities"][1]["legacy_routes"].append("POST /api/nvr/reboot")  # claimed by P10 too
    rep = lp.run_checks(SURFACE, pm, streams=None)
    c1 = next(c for c in rep["checks"] if c["id"] == "C1")
    assert c1["state"] == "FAIL"
    assert any("not claimed" in p and "/api/auth/tech/status" in p for p in c1["problems"])
    assert any("claimed twice" in p for p in c1["problems"])
    assert rep["verdict"] == "FAIL"


def test_unknown_arx_route_and_missing_evidence_fail():
    pm = copy.deepcopy(PMAP)
    pm["capabilities"][3]["arx_routes"].append("GET /api/v1/nvr/no-such-route")
    pm["capabilities"][4]["evidence"].append("smplwise_vms/backend/tests/test_does_not_exist.py")
    rep = lp.run_checks(SURFACE, pm, streams=None)
    st = _states(rep)
    assert st["C2"] == "FAIL" and st["C3"] == "FAIL"
    assert st["C7"] == "SKIPPED"  # no stream names given: skipped, never a pass


def test_a_gap_without_a_decision_fails_c4():
    pm = copy.deepcopy(PMAP)
    cap = next(c for c in pm["capabilities"] if c["id"] == "P09")
    cap["decision"] = ""
    rep = lp.run_checks(SURFACE, pm, streams=None)
    assert _states(rep)["C4"] == "FAIL"


def test_option_target_on_a_deprecated_or_unknown_arx_option_fails_c5():
    keys, deprecated = lp.arx_options()
    assert "nvr_password" in deprecated and "go2rtc_url" in keys and "go2rtc_url" not in deprecated
    stale = [row for row in lp.load_migrate_option_map()]
    stale = [("nvr_password", "option:nvr_password", "old map") if r[0] == "nvr_password" else r for r in stale]
    stale.append(("go2rtc_url", "option:no_such_option", "typo"))
    rep = lp.run_checks(SURFACE, PMAP, option_map=stale, streams=None)
    c5 = next(c for c in rep["checks"] if c["id"] == "C5")
    assert c5["state"] == "FAIL"
    assert any("DEPRECATED" in p for p in c5["problems"]) and any("no such Arx add-on option" in p for p in c5["problems"])


def test_stream_namespaces_collide_fails_c7():
    rep = lp.run_checks(SURFACE, PMAP, streams=("hik_", ["hik_ch3", "smplwise_nvr-1_ch1_main"]))
    c7 = next(c for c in rep["checks"] if c["id"] == "C7")
    assert c7["state"] == "FAIL"
    assert any("legacy stream name inside the Arx namespace" in p for p in c7["problems"])
    assert any("matches a legacy pattern" in p for p in c7["problems"])


def test_same_slug_or_arx_touching_legacy_files_fails_c8(tmp_path):
    src = tmp_path / "bad.py"
    src.write_text('P = "/config/hikvision_nvr_override.json"\n', encoding="utf-8")
    rep = lp.run_checks(SURFACE, PMAP, streams=None, slug="hikvision_nvr", arx_sources=[src])
    c8 = next(c for c in rep["checks"] if c["id"] == "C8")
    assert c8["state"] == "FAIL" and len(c8["problems"]) == 2


def test_cli_check_writes_reports_and_exit_codes(tmp_path):
    out_json, out_md = tmp_path / "r.json", tmp_path / "r.md"
    assert lp.main(["check", "--json", str(out_json), "--md", str(out_md)]) == 0
    assert json.loads(out_json.read_text(encoding="utf-8"))["verdict"] == "PASS"
    md = out_md.read_text(encoding="utf-8")
    assert "| P22 |" in md and "Verdict **PASS**" in md
    bad = tmp_path / "map.json"
    pm = copy.deepcopy(PMAP)
    pm["capabilities"] = pm["capabilities"][1:]
    bad.write_text(json.dumps(pm), encoding="utf-8")
    assert lp.main(["check", "--map", str(bad)]) == 1
    assert lp.main(["check", "--map", str(tmp_path / "missing.json")]) == 2

