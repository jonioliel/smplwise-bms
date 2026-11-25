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
        assert g["script"] is None or (ROOT / g["script"]).is_file()   # null: a mocked group, no backend (GATE-FIXTURE-LANE-2530)
        if g.get("seed"):
            assert (ROOT / g["seed"]).is_file()
        for name in g["specs"]:
            assert (ROOT / "frontend" / "tests" / name).is_file(), name


def test_a_spec_in_several_groups_runs_there_with_another_env():
    """GATE-FIXTURE-LANE-2530: a spec may sit in more than one group (evidence-nvrless-cameras-2412: modes b / a on one backend,
    d on the recorder fixture; the media spec per house) - but never twice with the same backend and env."""
    seen = {}
    for gname, g in GROUPS.items():
        for n in g["specs"]:
            key = (n, g["script"], json.dumps(fj.stages(g), sort_keys=True))
            assert key not in seen, f"{n}: groups {seen.get(key)} and {gname} run it identically"
            seen[key] = gname


def test_the_gate_and_the_job_agree():
    gate = _load("release_gate", "scripts/gate/release_gate.py")
    # CURVEDGATE-297: the two curved-wall specs joined the gate (same fake backend as the camera card); GATE-FIXTURE-LANE-2530: the
    # fixture lane - the specs every released gate used to skip, each with its own fixture backend (or none)
    expected = {"evidence-camera-card.spec.ts", "evidence-curved-walls.spec.ts", "evidence-curve-points.spec.ts",
                "evidence-floorstrip.spec.ts", "evidence-nvrless-cameras-2412.spec.ts", "devpolish-2331-shoot.spec.ts",
                "hand-switch-home-personal-2500-shots.spec.ts", "hand-switch-home-edit-2500-shots.spec.ts"}
    # listed for the job, not (yet) the gate - each failed on the runner for a reason recorded in the JSON ("_why_not_gate"):
    # the WisKey specs predate the native people screen (CR-036 S7), the media spec's pre-S1 guesses, the home screen's 18 px scroll
    assert not fj.gate_specs({k: GROUPS[k] for k in ("wiskey", "media_ma", "media_sonos")})
    assert not GROUPS["devices"]["specs"]["evidence-home-screen.spec.ts"]["gate"]
    assert gate.FIXTURE_SPECS == fj.gate_specs(GROUPS) == expected
    assert {n for g in gate.fixture_groups(ROOT / "frontend").values() for n in g["specs"]} == expected


def test_the_built_in_default_is_the_devices_fallback():
    """GATE-FIXTURE-LANE-2530: the engine reads the groups from the WORKTREE under test (fixture_groups), so the ~/ copy on the
    runner runs whatever groups the branch declares; the built-in FIXTURE_SPECS literal is only the fallback for a worktree without
    the JSON: the devices backend and its three original gate specs, all still "gate": true in the devices group."""
    import ast
    import re

    src = (ROOT / "scripts" / "gate" / "release_gate.py").read_text(encoding="utf-8")
    m = re.search(r"^FIXTURE_SPECS = (\{[^}]*\})", src, re.M)
    legacy = ast.literal_eval(m.group(1))
    devices = GROUPS["devices"]
    assert legacy <= {n for n, s in devices["specs"].items() if s.get("gate")}
    gate = _load("release_gate_fb", "scripts/gate/release_gate.py")
    assert gate.FIXTURE_DEFAULT_GROUP["script"] == devices["script"] and gate.FIXTURE_DEFAULT_GROUP["pw_env"] == devices["pw_env"]


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


# ---------------------------------------------------------------- GATE-FIXTURE-LANE-2530: the fixture lane


def test_placeholders_expand_the_same_in_the_job_and_the_gate():
    gate = _load("release_gate_ph", "scripts/gate/release_gate.py")
    for v in ("{port}", "http://127.0.0.1:{port+1}", "{port+10}/x/{port}", "{out}/shots", "plain", "1"):
        assert gate.fixture_expand(v, 4100, "/tmp/o") == fj.expand(v, 4100, "/tmp/o")
    assert fj.expand("http://127.0.0.1:{port+1}", 4100, "") == "http://127.0.0.1:4101"
    assert fj.expand("{out}", 1, "/a/b") == "/a/b"


def test_every_placeholder_in_the_json_is_known_and_the_ports_fit():
    import re

    for gname, g in GROUPS.items():
        for benv, penv in fj.stages(g):
            for v in list(benv.values()) + list(penv.values()):
                left = re.sub(r"\{port(\+\d+)?\}|\{out\}", "", str(v))
                assert "{" not in left, f"{gname}: unknown placeholder in {v!r}"
                for n in re.findall(r"\{port\+(\d+)\}", str(v)):
                    assert int(n) <= int(g.get("extra_ports", 1)), f"{gname}: {v!r} is above its extra_ports"


def test_stages_merge_the_then_env_over_the_group():
    g = GROUPS["nvrless_cameras"]
    st = fj.stages(g)
    assert [b["SW_WEBRTC"] for b, _ in st] == ["1", "0"]
    assert [p["SW_EVID2412"] for _, p in st] == ["b", "a"] and all(p["SW_LIVE"] == "1" for _, p in st)
    gate = _load("release_gate_st", "scripts/gate/release_gate.py")
    assert gate.fixture_stages(g) == [tuple(x) for x in st]


def test_the_gate_runs_one_pool_job_per_fixture_group():
    gate = _load("release_gate_cls", "scripts/gate/release_gate.py")
    cls = gate.classify(ROOT / "frontend", "L")
    assert set(cls["fixture_groups"]) == {k for k, g in GROUPS.items() if any(s.get("gate") for s in g["specs"].values())}
    assert cls["fixture_groups"]["shots_home_edit"] == {"hand-switch-home-edit-2500-shots.spec.ts": ["desktop"]}
    assert "wiskey" not in cls["fixture_groups"]   # no "gate": true spec in it
    jobs = [j for j in gate.v2_jobs(cls, {}, "L", False) if j["kind"] == "fixture"]
    assert sorted(j["group"] for j in jobs) == sorted(cls["fixture_groups"])
    by = {j["group"]: j for j in jobs}
    assert by["shots_devpolish"]["workers"] == 1 and by["nvrless_recorder"]["workers"] == 2   # a backend + a browser weigh two slots
    assert by["nvrless_cameras"]["est"] > by["nvrless_recorder"]["est"]               # the `then` stage runs the spec again
    assert gate.classify(ROOT / "frontend", "M")["fixture_groups"] == {}              # below tier L no fixture group runs (as before)


def test_the_gate_falls_back_to_the_devices_group_without_the_json(tmp_path):
    gate = _load("release_gate_nojson", "scripts/gate/release_gate.py")
    got = gate.fixture_groups(tmp_path)
    assert list(got) == ["devices"] and set(got["devices"]["specs"]) == gate.FIXTURE_SPECS


def test_the_selection_keeps_only_the_selected_fixture_specs():
    gate = _load("release_gate_sel", "scripts/gate/release_gate.py")
    cls = gate.classify(ROOT / "frontend", "L")
    sel = {"frontend": {"selected": ["evidence-nvrless-cameras-2412.spec.ts"], "dropped": ["x"]}, "full": {}}
    out = gate.filter_classification(cls, sel)
    three = ["desktop", "tablet", "mobile"]
    assert out["fixture_groups"] == {"nvrless_cameras": {"evidence-nvrless-cameras-2412.spec.ts": three},
                                     "nvrless_recorder": {"evidence-nvrless-cameras-2412.spec.ts": three}}


def test_the_list_names_the_groups_without_a_backend(monkeypatch, capsys):
    monkeypatch.setattr(fj, "load_specs", lambda: GROUPS)
    assert fj.main(["--list"]) == 0
    listed = capsys.readouterr().out
    assert "shots_devpolish (no backend)" in listed and "wiskey frontend/tests/fixtures/wiskey_fake_ha.py" in listed
