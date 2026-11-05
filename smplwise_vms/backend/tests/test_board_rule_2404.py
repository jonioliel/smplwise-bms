"""BOARD-RULE-2404: the planning registry's dependency rule (owner decision 2026-11-05, round 22 Q1 = ב).

A card may stand in REVIEW when every dependency is in REVIEW or DONE; READY, IN_PROGRESS, VALIDATION and DONE still need every
dependency DONE; BACKLOG and BLOCKED carry no dependency rule. Pure function plus one end-to-end validate() over a tiny registry.
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


def idx(**statuses):
    return {k: {"id": k, "status": v, "dependencies": []} for k, v in statuses.items()}


def card(status, *deps):
    return {"id": "C", "status": status, "dependencies": list(deps)}


@pytest.mark.parametrize("dep_status", ["REVIEW", "DONE"])
def test_review_accepts_review_or_done_dependencies(dep_status):
    assert rule(card("REVIEW", "A"), idx(A=dep_status)) is None


@pytest.mark.parametrize("dep_status", ["BACKLOG", "BLOCKED", "READY", "IN_PROGRESS", "VALIDATION"])
def test_review_refuses_other_dependency_states(dep_status):
    err = rule(card("REVIEW", "A"), idx(A=dep_status))
    assert err == "C: dependencies not REVIEW or DONE (A)"


def test_review_names_only_the_unmet_dependencies():
    assert rule(card("REVIEW", "A", "B", "D"), idx(A="REVIEW", B="BACKLOG", D="BLOCKED")) == "C: dependencies not REVIEW or DONE (B, D)"


@pytest.mark.parametrize("status", ["READY", "IN_PROGRESS", "VALIDATION", "DONE"])
def test_other_working_states_still_need_done(status):
    assert rule(card(status, "A"), idx(A="DONE")) is None
    assert rule(card(status, "A"), idx(A="REVIEW")) == "C: dependencies not DONE (A)"


@pytest.mark.parametrize("status", ["BACKLOG", "BLOCKED"])
def test_backlog_and_blocked_have_no_dependency_rule(status):
    assert rule(card(status, "A"), idx(A="BACKLOG")) is None


def test_unknown_dependency_is_unmet():
    assert rule(card("REVIEW", "ZZ"), {}) == "C: dependencies not REVIEW or DONE (ZZ)"


def _registry(tmp_path: Path, child_status: str, parent_status: str) -> Path:
    mgmt = tmp_path / "management"
    mgmt.mkdir()
    (tmp_path / "docs" / "design").mkdir(parents=True)
    (tmp_path / "docs" / "design" / "REFERENCE_MANIFEST.json").write_text("[]", encoding="utf-8")

    def task(tid, status, deps):
        return {"id": tid, "title": tid, "phase": "V1", "priority": "P1", "status": status, "dependencies": deps,
                "chapters": [], "screens": [], "owner_role": "x", "requires_hardware": False, "acceptance": ["a"],
                "requirement_ids": [f"R-{tid}"], "test_ids": [f"AT-{tid}"], "blocker": None, "evidence": [], "commit": None}
    tasks = [task("P", parent_status, []), task("K", child_status, ["P"])]
    reqs = [{"id": f"R-{t}", "task_ids": [t], "test_ids": [f"AT-{t}"], "screens": []} for t in ("P", "K")]
    tests = [{"id": f"AT-{t}", "requirement_ids": [f"R-{t}"], "task_ids": [t], "status": "NOT_RUN"} for t in ("P", "K")]
    for name, data in (("tasks.json", tasks), ("requirements.json", reqs), ("test_catalog.json", tests), ("screens.json", [])):
        (mgmt / name).write_text(json.dumps(data), encoding="utf-8")
    return tmp_path


def test_validate_accepts_review_child_of_review_parent(tmp_path):
    errors, *_ = project_status.validate(_registry(tmp_path, "REVIEW", "REVIEW"))
    assert errors == []


def test_validate_refuses_review_child_of_backlog_parent(tmp_path):
    errors, *_ = project_status.validate(_registry(tmp_path, "REVIEW", "BACKLOG"))
    assert errors == ["K: dependencies not REVIEW or DONE (P)"]


def test_validate_still_refuses_in_progress_child_of_review_parent(tmp_path):
    errors, *_ = project_status.validate(_registry(tmp_path, "IN_PROGRESS", "REVIEW"))
    assert errors == ["K: dependencies not DONE (P)"]
