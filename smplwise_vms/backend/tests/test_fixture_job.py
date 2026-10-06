"""scripts/fixture_job.py and its spec list (frontend/tests/fixtures/fixture_specs.json), shared with the release gate."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def _load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


fj = _load("fixture_job", "scripts/fixture_job.py")
GROUPS = fj.load_specs()


def test_every_listed_spec_and_script_exists():
    for g in GROUPS.values():
        assert (ROOT / g["script"]).is_file()
        if g.get("seed"):
            assert (ROOT / g["seed"]).is_file()
        for name in g["specs"]:
            assert (ROOT / "frontend" / "tests" / name).is_file(), name


def test_each_spec_listed_once():
    names = [n for g in GROUPS.values() for n in g["specs"]]
    assert len(names) == len(set(names))


def test_the_gate_and_the_job_agree():
    gate = _load("release_gate", "scripts/gate/release_gate.py")
    assert gate.FIXTURE_SPECS == fj.gate_specs(GROUPS) == {"evidence-camera-card.spec.ts"}


def test_the_four_specs_are_covered():
    names = {n for g in GROUPS.values() for n in g["specs"]}
    assert {"evidence-arx-second-factor.spec.ts", "evidence-arx-sessions.spec.ts", "evidence-custom-roles.spec.ts", "evidence-plan-package.spec.ts"} <= names


def test_norm_accepts_paths_and_bare_names():
    assert fj.norm("frontend/tests/evidence-arx-sessions.spec.ts") == "evidence-arx-sessions.spec.ts"
    assert fj.norm("evidence-arx-sessions") == "evidence-arx-sessions.spec.ts"
    assert fj.norm("tests" + chr(92) + "x.spec.ts") == "x.spec.ts"


def test_plan_picks_groups_and_projects():
    todo, unknown = fj.plan(GROUPS, ["evidence-arx-second-factor"], [])
    assert unknown == [] and [g for g, _ in todo] == ["arx"]
    assert todo[0][1] == [(("desktop",), ["evidence-arx-second-factor.spec.ts"])]
    todo, _ = fj.plan(GROUPS, ["evidence-arx-second-factor.spec.ts"], ["mobile"])
    assert todo[0][1][0][0] == ("mobile",)
    todo, unknown = fj.plan(GROUPS, ["nope.spec.ts"], [])
    assert unknown == ["nope.spec.ts"] and todo == []
    allg, _ = fj.plan(GROUPS, [], [])
    assert {g for g, _ in allg} == set(GROUPS)


def test_free_ports_range_is_free():
    import socket

    p = fj.free_ports(2)
    for i in range(3):
        s = socket.socket()
        s.bind(("127.0.0.1", p + i))
        s.close()


def test_judge_refuses_all_skipped_and_failures():
    assert fj.judge(0, {"expected": 3, "skipped": 0, "unexpected": 0, "flaky": 0}) == "PASS"
    assert fj.judge(0, {"expected": 0, "skipped": 4, "unexpected": 0}).startswith("FAIL (nothing ran")
    assert fj.judge(1, {"expected": 2, "unexpected": 1}).startswith("FAIL")
    assert fj.judge(0, None).startswith("FAIL")
    assert json.dumps(fj.judge(0, {"expected": 1}))
