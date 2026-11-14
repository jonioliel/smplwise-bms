"""GATE-HYGIENE-2402: whole-package scanners and pins run in EVERY gate selection.

Main v2.39.0 shipped red on the SR-1 pin (test_fake_doorwin_closed_rule_sr1.py): it parses every module under smplwise/ by PATH, so no
import closure, name stem or API segment of the change-based selection reached it, and the 2.39.0 gates never ran it. The fix is a
declarative list in the tested checkout (tests/gate_always_run.json) that scripts/gate/select_tests.py honours, and gate 2
(gate2_select.py) inherits through select(). This file proves:
  * the list parses, every listed file exists, and the examples the lead named are on it;
  * every backend test that walks the package, the router registry or the repository (select_tests.PACKAGE_SCAN_RE) is listed or
    reviewed as "not_scanners" - a new scanner without a list entry fails HERE, in every gate (this file is on its own list);
  * the v1 selector and the gate-2 selector both select a listed file for an unrelated change (a tiny real git repository);
  * a malformed list raises (the engine then runs the full tier), a missing list is empty (older branches behave as before).
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

TESTS = Path(__file__).resolve().parent
ROOT = TESTS.parents[2]
GATE = ROOT / "scripts" / "gate"
if str(GATE) not in sys.path:
    sys.path.insert(0, str(GATE))

import gate2_select as g2  # noqa: E402
import select_tests as st  # noqa: E402  (the module gate2_select itself uses in a repository checkout)

LIST = TESTS / st.ALWAYS_RUN_FILE


def _doc() -> dict:
    return json.loads(LIST.read_text(encoding="utf-8"))


def test_the_list_parses_and_every_entry_is_a_real_test_file():
    listed = st.always_run_backend(ROOT)
    exempt = _doc().get("not_scanners", {})
    assert listed, "the always-run list is empty"
    assert not [n for n in listed if not (TESTS / n).is_file()], "listed files that do not exist"
    assert not [n for n in exempt if not (TESTS / n).is_file()], "reviewed non-scanners that do not exist"
    assert not set(listed) & set(exempt), "a file cannot be both always-run and a reviewed non-scanner"
    assert all(v.strip() for v in list(listed.values()) + list(exempt.values())), "every entry says why"


def test_the_named_scanners_and_pins_are_listed():
    listed = st.always_run_backend(ROOT)
    for n in ("test_fake_doorwin_closed_rule_sr1.py",   # SR-1, the 2.39.0 miss
              "test_no_ip_literals.py",                 # repository-wide lint
              "test_wiskey_door_path.py",               # the signing-caller pin
              "test_wiskey_channels.py",                # the channel allow-list pin
              "test_remote_access.py",                  # route walks
              "test_plan_routes_unique.py",             # route registry
              "test_gate_always_run.py"):               # this guard
        assert n in listed, n


def test_every_package_scanner_is_listed_or_reviewed():
    found = st.package_scanners(TESTS)
    listed = set(st.always_run_backend(ROOT))
    exempt = set(_doc().get("not_scanners", {}))
    missing = sorted(found - listed - exempt)
    assert not missing, (f"these backend tests walk the package / router registry / repository but are not on {LIST.name}: "
                         f"{missing}. Add each to 'backend' (it then runs in every gate) or, when it walks nothing, to 'not_scanners'.")


@pytest.mark.parametrize("text, hit", [
    ('for p in PACKAGE.rglob("*.py"):', True),
    ("for p in (ROOT / 'routers').glob('*.py'):", True),
    ("for info in pkgutil.iter_modules(routers_pkg.__path__):", True),
    ("routes = [r for r in app.routes]", True),
    ('subprocess.run(["git", "ls-files", "-z"])', True),
    ('assert not list(tmp_path.rglob("*.jpg"))', False),
    ("for r in incidents_router.router.routes:", False),
])
def test_the_detector(text, hit):
    assert bool(st.PACKAGE_SCAN_RE.search(text)) is hit


# ---------------------------------------------------------------- the selectors honour the list (a tiny real git repository)
FILES = {
    "smplwise_vms/backend/smplwise/__init__.py": '__version__ = "1.0.0"\n',
    "smplwise_vms/backend/smplwise/services/__init__.py": "",
    "smplwise_vms/backend/smplwise/services/door_tech.py": "X = 1\n",
    "smplwise_vms/backend/smplwise/services/lonely.py": "Y = 2\n",
    "smplwise_vms/backend/tests/test_door_tech.py": "from smplwise.services.door_tech import X\n",
    "smplwise_vms/backend/tests/test_pin_by_path.py": "for p in PACKAGE.rglob('*.py'):\n    pass\n",
    "smplwise_vms/backend/tests/test_unrelated.py": "",
    "frontend/tests/unit-x.spec.ts": "",
}
PIN = "test_pin_by_path.py"


def _git(repo: Path, *a: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *a], check=True, capture_output=True, text=True).stdout


@pytest.fixture(scope="module")
def _repo(tmp_path_factory):
    r = tmp_path_factory.mktemp("always_run") / "repo"
    for p, t in FILES.items():
        f = r / p
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(t, encoding="utf-8")
    _git(r.parent, "init", "-q", str(r))
    _git(r, "config", "user.email", "t@t"); _git(r, "config", "user.name", "t"); _git(r, "config", "core.autocrlf", "false")
    _git(r, "add", "-A"); _git(r, "commit", "-qm", "base"); _git(r, "tag", "base")
    (r / "smplwise_vms/backend/smplwise/services/lonely.py").write_text("Y = 3\n", encoding="utf-8")   # a far change
    _git(r, "add", "-A"); _git(r, "commit", "-qm", "far change")
    return r


@pytest.fixture()
def repo(_repo):
    """One git repository per module (git is slow on Windows); the list file is untracked and removed after every test."""
    lst = _repo / st.BE / "tests" / st.ALWAYS_RUN_FILE
    lst.unlink(missing_ok=True)
    yield _repo
    lst.unlink(missing_ok=True)


def _write_list(repo: Path, doc) -> None:
    (repo / st.BE / "tests" / st.ALWAYS_RUN_FILE).write_text(doc if isinstance(doc, str) else json.dumps(doc), encoding="utf-8")


def test_without_the_list_a_path_scanner_is_dropped_by_both_selectors(repo):
    """The 2.39.0 shape: the pin imports nothing and its name matches no changed module."""
    assert PIN in st.select_diff(repo, "base", "HEAD")["backend"]["dropped"]
    assert PIN in g2.select_gate2(repo, "base", "HEAD", costs={})["backend"]["dropped"]


def test_the_v1_selector_honours_the_list(repo):
    _write_list(repo, {"backend": {PIN: "package walk"}})
    sel = st.select_diff(repo, "base", "HEAD")
    assert PIN in sel["backend"]["selected"]
    assert sel["backend"]["why"][PIN].startswith("always-run (gate_always_run.json)")
    assert "test_unrelated.py" in sel["backend"]["dropped"]          # the list adds, it does not widen the selection


def test_the_gate2_selector_honours_the_list(repo):
    _write_list(repo, {"backend": {PIN: "package walk"}})
    sel = g2.select_gate2(repo, "base", "HEAD", costs={})
    assert PIN in sel["backend"]["selected"]
    assert sel["backend"]["why"][PIN].startswith("always-run")
    assert "test_unrelated.py" in sel["backend"]["dropped"]


def test_a_listed_file_that_does_not_exist_is_ignored_by_the_selector(repo):
    _write_list(repo, {"backend": {PIN: "package walk", "test_gone.py": "deleted later"}})
    sel = st.select_diff(repo, "base", "HEAD")
    assert PIN in sel["backend"]["selected"] and "test_gone.py" not in sel["backend"]["selected"]


@pytest.mark.parametrize("bad", ["{not json", {"backend": ["test_pin_by_path.py"]}, {"backend": {"pin.py": "x"}}, {"other": {}}])
def test_a_malformed_list_raises_so_the_engine_runs_the_full_tier(repo, bad):
    _write_list(repo, bad)
    with pytest.raises((ValueError, json.JSONDecodeError)):
        st.select(repo, [("M", "smplwise_vms/backend/smplwise/services/lonely.py")])


def test_a_missing_list_is_empty(tmp_path):
    assert st.always_run_backend(tmp_path) == {}
