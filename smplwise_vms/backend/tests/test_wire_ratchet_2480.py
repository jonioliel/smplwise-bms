"""RESPONSE-MODELS-E-2480: the response-model ratchet (scripts/wire_ratchet.py). Every JSON route of the application has a wire model, or
its router module's count of unmodelled JSON routes is the one in scripts/wire_ratchet_baseline.json - a new route without a model
(or a removed model) raises a count and fails here. Only an INCREASE fails: a modelled route lowers a count, which passes with a hint,
and the baseline is lowered with `python scripts/wire_ratchet.py --ratchet` (like scripts/design_ratchet.py)."""
from __future__ import annotations

import importlib
import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]


def _script():
    if "wire_ratchet" in sys.modules:
        return sys.modules["wire_ratchet"]
    spec = importlib.util.spec_from_file_location("wire_ratchet", ROOT / "scripts" / "wire_ratchet.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules["wire_ratchet"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def rows():
    return _script().routes()


def test_no_count_is_above_its_baseline(rows):
    res = _script().check(rows)
    assert res["ok"], res["detail"]


def test_the_baseline_file_is_consistent():
    doc = json.loads((ROOT / "scripts" / "wire_ratchet_baseline.json").read_text(encoding="utf-8"))
    routers = doc["routers"]
    assert routers == dict(sorted(routers.items())), "keep the baseline sorted (merges stay line-local): run --update"
    assert all(isinstance(n, int) and n > 0 for n in routers.values())
    assert doc["total"] == sum(routers.values())


def test_the_route_table_is_the_application_s(rows):
    """Every HTTP route once, the developer-only and root routes included; modelled routes are seen as modelled."""
    keys = [r["full"] for r in rows]
    assert len(keys) == len(set(keys))
    assert "GET /healthz" in keys and "GET /api/v1/me" in keys
    me = next(r for r in rows if r["full"] == "GET /api/v1/me")
    assert me["modelled"] and me["router"] == "me"
    assert any(r["no_json"] for r in rows), "NO_JSON entries of the wire modules are read"


def test_no_json_lists_name_real_routes(rows):
    """A wire module's NO_JSON names only routes its router module has (a stale entry would hide a new JSON route of that path)."""
    have: dict[str, set[str]] = {}
    for r in rows:
        have.setdefault(r["router"], set()).update({r["key"], r["full"]})
    wire_dir = ROOT / "smplwise_vms" / "backend" / "smplwise" / "wire"
    stale = {}
    for p in sorted(wire_dir.glob("*.py")):
        if p.stem == "__init__" or p.stem not in have:
            continue
        no_json = getattr(importlib.import_module(f"smplwise.wire.{p.stem}"), "NO_JSON", frozenset())
        extra = sorted(set(no_json) - have[p.stem])
        if extra:
            stale[p.stem] = extra
    assert not stale, stale


def test_the_ratchet_sees_a_new_unmodelled_route(rows):
    """A route without a model in a router at zero, and a router that is not in the baseline at all, both fail."""
    script = _script()
    base = script.load_baseline()
    fake = [*rows, {"router": "zz_new_router", "key": "GET /zz", "full": "GET /api/v1/zz", "modelled": False, "no_json": False}]
    res = script.check(fake)
    assert not res["ok"] and "zz_new_router" in res["up"]
    modelled = next(r for r in rows if r["modelled"] and r["router"] not in base)
    fake = [*rows, {**modelled, "key": modelled["key"] + "/x", "full": modelled["full"] + "/x", "modelled": False}]
    res = script.check(fake)
    assert not res["ok"] and modelled["router"] in res["up"]


def test_a_decrease_passes_with_a_hint(rows):
    """Modelling a route (a count below its baseline) must not fail the check; the detail says how to lower the baseline."""
    script = _script()
    base = script.load_baseline()
    name = next(iter(base))
    victim = next(r for r in rows if r["router"] == name and not r["modelled"] and not r["no_json"])
    fake = [r for r in rows if r is not victim]
    res = script.check(fake)
    assert res["ok"] and not res["up"] and name in res["down"]
    assert res["down"][name] == (base[name], base[name] - 1)
    assert "--ratchet" in res["detail"]


def test_ratchet_option_lowers_and_never_raises(rows, tmp_path, monkeypatch):
    script = _script()
    monkeypatch.setattr(script, "BASELINE", tmp_path / "baseline.json")
    real = json.loads((ROOT / "scripts" / "wire_ratchet_baseline.json").read_text(encoding="utf-8"))["routers"]
    name = next(iter(real))
    (tmp_path / "baseline.json").write_text(json.dumps({"routers": {**real, name: real[name] + 2}}), encoding="utf-8")
    new, refused = script.update(False, rows)  # today's count is below the file: lowered to today's
    assert not refused and new[name] == real[name]
    assert script.check(rows)["ok"]
    (tmp_path / "baseline.json").write_text(json.dumps({"routers": {**real, name: real[name] - 1}}), encoding="utf-8")
    new, refused = script.update(False, rows)  # today's count is above the file: refused, file keeps the lower number
    assert refused == [name] and new[name] == real[name] - 1
    assert not script.check(rows)["ok"]
    new, refused = script.update(True, rows)  # --allow-raise
    assert not refused and new[name] == real[name]
    assert script.main(["--ratchet"]) == 0  # the CLI option exists (writes the monkeypatched file)
