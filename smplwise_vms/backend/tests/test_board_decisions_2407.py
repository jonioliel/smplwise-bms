"""BOARD-DECISIONS-2407: a dependency on an OBSOLETE card counts as satisfied (owner decision 2026-11-07).

OBSOLETE = status BLOCKED, a blocker starting "Excluded - OBSOLETE" and an evidence line starting "EXCLUDED". The rule of
BOARD-RULE-2404 (test_board_rule_2404.py) is otherwise unchanged. Pure functions plus end-to-end validate() over a tiny registry,
and one check over the real registry for the cards this change touched.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
import project_status  # noqa: E402

rule = project_status.dependency_error
OBS_BLOCKER = "Excluded - OBSOLETE by owner decision (test)"
OBS_EVIDENCE = ["EXCLUDED - OBSOLETE (test)"]


def dep(status="BLOCKED", blocker=OBS_BLOCKER, evidence=OBS_EVIDENCE):
    return {"id": "A", "status": status, "dependencies": [], "blocker": blocker, "evidence": list(evidence)}


def card(status, *deps):
    return {"id": "C", "status": status, "dependencies": list(deps)}


def test_is_obsolete_needs_all_three_marks():
    assert project_status.is_obsolete(dep())


@pytest.mark.parametrize(
    "kwargs",
    [
        {"status": "BACKLOG"},  # not BLOCKED
        {"blocker": "Waiting for the owner"},  # plain BLOCKED
        {"blocker": "Excluded - owner decision 2026-09-22"},  # excluded, but not OBSOLETE
        {"evidence": ["commit abc (release 1.0)"]},  # no EXCLUDED evidence line
        {"evidence": []},
        {"blocker": None},
    ],
)
def test_is_obsolete_refuses_partial_marks(kwargs):
    assert not project_status.is_obsolete(dep(**kwargs))


def test_is_obsolete_tolerates_missing_card():
    assert not project_status.is_obsolete(None)
    assert not project_status.is_obsolete({})


@pytest.mark.parametrize("status", ["READY", "IN_PROGRESS", "REVIEW", "VALIDATION", "DONE"])
def test_obsolete_dependency_is_met_under_every_rule(status):
    assert rule(card(status, "A"), {"A": dep()}) is None


@pytest.mark.parametrize("status", ["REVIEW", "DONE"])
def test_plain_blocked_dependency_is_still_unmet(status):
    err = rule(card(status, "A"), {"A": dep(blocker="Waiting for the owner")})
    assert err is not None and err.endswith("(A)")


def test_obsolete_dependency_does_not_hide_other_unmet_ones():
    index = {"A": dep(), "B": {"id": "B", "status": "BACKLOG", "dependencies": []}}
    assert rule(card("REVIEW", "A", "B"), index) == "C: dependencies not REVIEW or DONE (B)"


def test_unknown_dependency_is_still_unmet():
    assert rule(card("REVIEW", "ZZ"), {}) == "C: dependencies not REVIEW or DONE (ZZ)"


def _registry(tmp_path: Path, child_status: str, parent: dict) -> Path:
    mgmt = tmp_path / "management"
    mgmt.mkdir()
    (tmp_path / "docs" / "design").mkdir(parents=True)
    (tmp_path / "docs" / "design" / "REFERENCE_MANIFEST.json").write_text("[]", encoding="utf-8")

    def task(tid, status, deps, blocker=None, evidence=()):
        return {"id": tid, "title": tid, "phase": "V1", "priority": "P1", "status": status, "dependencies": deps,
                "chapters": [], "screens": [], "owner_role": "x", "requires_hardware": False, "acceptance": ["a"],
                "requirement_ids": [f"R-{tid}"], "test_ids": [f"AT-{tid}"], "blocker": blocker, "evidence": list(evidence),
                "commit": None, "model_policy": {}, "deliverables": ["d"]}
    tasks = [task("P", parent["status"], [], parent.get("blocker"), parent.get("evidence", ())), task("K", child_status, ["P"])]
    reqs = [{"id": f"R-{t}", "task_ids": [t], "test_ids": [f"AT-{t}"], "screens": [], "phase": "V1", "statement": t}
            for t in ("P", "K")]
    tests = [{"id": f"AT-{t}", "requirement_ids": [f"R-{t}"], "task_ids": [t], "status": "NOT_RUN"} for t in ("P", "K")]
    for name, data in (("tasks.json", tasks), ("requirements.json", reqs), ("test_catalog.json", tests), ("screens.json", [])):
        (mgmt / name).write_text(json.dumps(data), encoding="utf-8")
    return tmp_path


def test_validate_accepts_review_child_of_obsolete_parent(tmp_path):
    errors, *_ = project_status.validate(_registry(tmp_path, "REVIEW", dep()))
    assert errors == []


def test_validate_refuses_review_child_of_plain_blocked_parent(tmp_path):
    errors, *_ = project_status.validate(_registry(tmp_path, "REVIEW", dep(blocker="Waiting for the owner")))
    assert errors == ["K: dependencies not REVIEW or DONE (P)"]


def test_status_header_states_the_obsolete_rule(tmp_path):
    root = _registry(tmp_path, "REVIEW", dep())
    (root / "management" / "tasks").mkdir()
    (root / "management" / "project.json").write_text(json.dumps({"version": "test"}), encoding="utf-8")
    errors, *data = project_status.validate(root)
    assert errors == []
    project_status.generate(root, *data)
    text = (root / "management" / "STATUS.md").read_text(encoding="utf-8")
    assert "a dependency on an OBSOLETE card counts as satisfied" in text


def test_real_registry_cards_of_this_change():
    tasks = {t["id"]: t for t in json.loads((ROOT / "management" / "tasks.json").read_text(encoding="utf-8"))}
    for tid in ("T003", "T004", "WXG0", "WXG1"):
        assert project_status.is_obsolete(tasks[tid]), tid
    for tid in ("T006", "T070"):
        assert not {"T003", "T004"} & set(tasks[tid]["dependencies"]), tid
