"""scripts/gate/targeted_plan.py (GATEHYGIENE 2.9.1): the red-gate rule and the fast-tier run list, as a pure function of the diff."""
from __future__ import annotations

import importlib.util
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
_spec = importlib.util.spec_from_file_location("targeted_plan", ROOT / "scripts" / "gate" / "targeted_plan.py")
tp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tp)

B = "smplwise_vms/backend/tests/"
F = "frontend/tests/"
BACK = {
    "test_tickets_board.py": "from tickets_world import API, build\nfrom hygiene import assert_defaults\n",
    "test_tickets_table.py": "import hygiene\n",
    "test_events.py": "from conftest import bind\n",
    "test_gate_hygiene.py": "import hygiene\n",
    "tickets_world.py": "",
    "hygiene.py": "",
}
SPECS = {
    "evidence-tickets-3b.spec.ts": "import { url } from './tickets-mocks';\n",
    "layout-x.spec.ts": "import { guard } from './layout-guard.js';\n",
    "unit-y.spec.ts": "",
    "tickets-mocks.ts": "",
    "layout-guard.ts": "",
}


@pytest.mark.parametrize("path,kind", [
    (B + "test_tickets_board.py", "test"), (F + "evidence-x.spec.ts", "test"), ("frontend/playwright.config.ts", "test"),
    ("scripts/gate/release_gate.py", "tooling"), ("docs/changes/GATE-TEST-HYGIENE.md", "doc"), ("management/tasks.json", "doc"),
    ("AGENTS.md", "doc"), ("smplwise_vms/CHANGELOG.md", "product"), ("smplwise_vms/backend/smplwise/main.py", "product"),
    ("frontend/src/app.ts", "product"), ("frontend/vite.config.ts", "product"), ("smplwise_vms/www/index.html", "product"),
    ("smplwise_vms/backend/smplwise/migrations/0122_x.sql", "product"), ("scripts/release_check.py", "product"),
])
def test_every_path_has_a_kind_and_only_tests_docs_and_gate_tooling_are_not_product(path, kind):
    assert tp.kind_of(path) == kind


def test_the_290_gate_fix_is_a_targeted_run():
    """The 2.9.0 gate reds (ca56b9d5b): two backend test files changed, the two failures live in them."""
    p = tp.plan([B + "test_tickets_board.py", B + "test_tickets_table.py"], BACK, SPECS,
                ["tests/test_tickets_board.py::test_display_settings_d19_d21_and_d28", "tests/test_tickets_table.py::test_monthly_report_cap_returns_413"])
    assert p["allowed"] is True and p["reasons"] == []
    assert p["run"]["backend"] == ["tests/test_gate_hygiene.py", "tests/test_tickets_board.py", "tests/test_tickets_table.py"]
    assert p["run"]["tsc"] is False and p["run"]["playwright"] == [] and p["run"]["release_check"] is True


def test_a_product_byte_means_a_full_gate():
    p = tp.plan([B + "test_tickets_board.py", "smplwise_vms/backend/smplwise/services/tickets/settings_doc.py"], BACK, SPECS)
    assert p["allowed"] is False and "product file" in p["reasons"][0]


def test_a_failure_the_diff_does_not_touch_is_not_shown_stale():
    p = tp.plan([B + "test_tickets_board.py"], BACK, SPECS, ["tests/test_events.py::test_x", "evidence-z.spec.ts:40"])
    assert p["allowed"] is False and "test_events.py::test_x" in p["reasons"][0] and "evidence-z.spec.ts:40" in p["reasons"][0]


def test_a_changed_helper_pulls_in_its_importers():
    p = tp.plan([B + "hygiene.py", F + "tickets-mocks.ts", F + "layout-guard.ts"], BACK, SPECS)
    assert p["allowed"] is True
    assert p["run"]["backend"] == ["tests/test_gate_hygiene.py", "tests/test_tickets_board.py", "tests/test_tickets_table.py"]
    assert p["run"]["playwright"] == ["evidence-tickets-3b.spec.ts", "layout-x.spec.ts"] and p["run"]["tsc"] is True


@pytest.mark.parametrize("path,suite", [(B + "conftest.py", "backend"), ("frontend/playwright.config.ts", "frontend")])
def test_a_suite_wide_test_file_needs_the_whole_suite(path, suite):
    p = tp.plan([path], BACK, SPECS)
    assert p["allowed"] is False and f"{suite} suite-wide" in p["reasons"][0]


def test_docs_only_runs_release_check_and_the_hygiene_guard():
    p = tp.plan(["docs/release/2.9.1-RELEASE-NOTES.md", "management/test_catalog.json"], BACK, SPECS)
    assert p["allowed"] is True and p["run"]["backend"] == ["tests/test_gate_hygiene.py"] and p["run"]["playwright"] == []


def test_a_deleted_test_file_is_not_run():
    p = tp.plan([B + "test_gone.py", F + "gone.spec.ts"], BACK, SPECS)
    assert p["allowed"] is True and "tests/test_gone.py" not in p["run"]["backend"] and p["run"]["playwright"] == []


def test_the_cli_on_this_repository():
    """End to end against git: the 2.9.0 gate-fix commit (ca56b9d5b) relative to its parent is a targeted run. Skipped when the commit
    is not in this clone (a shallow checkout)."""
    if subprocess.run(["git", "cat-file", "-e", "ca56b9d5b^{commit}"], cwd=ROOT, capture_output=True).returncode != 0:
        pytest.skip("commit ca56b9d5b not in this clone")
    assert tp.main(["--base", "ca56b9d5b~1", "--head", "ca56b9d5b", "--failed",
                    "tests/test_tickets_board.py::test_display_settings_d19_d21_and_d28"]) == 0
    assert tp.main(["--base", "ca56b9d5b~3", "--head", "ca56b9d5b"]) == 2  # the 2.9.0 prep and bundle commits are product
