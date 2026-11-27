"""GATE-NIGHTLY-2560 (deep review TR-03, partial): scripts/release_check.py enforces "tag only after a green nightly or full gate at this head or
an ancestor, within limits". Real throw-away git repository + report files in the shape the engine writes (gate_<branch>_<sha>.json)."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("release_check", ROOT / "scripts" / "release_check.py")
rc = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(rc)

NOW = time.time()


def _git(repo: Path, *a: str) -> str:
    return subprocess.run(["git", "-C", str(repo), "-c", "user.name=t", "-c", "user.email=t@example.invalid", *a],
                          capture_output=True, text=True, check=True).stdout.strip()


@pytest.fixture()
def repo(tmp_path: Path) -> Path:
    r = tmp_path / "repo"
    r.mkdir()
    _git(r, "init", "-q")
    return r


def _commit(repo: Path, n: int) -> str:
    (repo / "f.txt").write_text(str(n), encoding="utf-8")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", f"c{n}")
    return _git(repo, "rev-parse", "HEAD")


def _report(d: Path, sha: str, verdict: str = "pass", tier: str = "L", age_days: float = 0.1, branch: str = "main") -> None:
    d.mkdir(parents=True, exist_ok=True)
    fin = datetime.fromtimestamp(NOW - age_days * 86400, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+0000")
    (d / f"gate_{branch}_{sha[:9]}.json").write_text(json.dumps({"branch": branch, "sha": sha[:9], "tier": tier, "verdict": verdict, "finished": fin}), encoding="utf-8")


def _check(repo: Path, res: Path, require: bool = False, **kw) -> dict:
    return rc.green_gate_check(repo, require, [res] if res.is_dir() else [], NOW, **kw)


def test_green_at_head_and_at_an_ancestor(repo: Path, tmp_path: Path) -> None:
    a = _commit(repo, 1)
    res = tmp_path / "res"
    _report(res, a)
    r = _check(repo, res, True)
    assert r["ok"] and not r["warn"] and "HEAD" in r["detail"]
    for n in range(2, 5):
        _commit(repo, n)
    r = _check(repo, res, True)
    assert r["ok"] and not r["warn"] and "3 commits behind HEAD" in r["detail"]
    assert rc.green_gate_check(repo, True, [res], NOW, max_age_days=7, max_commits=2)["ok"] is False, "too many commits behind"


def test_nightly_directory_counts_too(repo: Path, tmp_path: Path) -> None:
    a = _commit(repo, 1)
    res = tmp_path / "res"
    _report(res / "nightly", a)
    r = rc.green_gate_check(repo, True, [res, res / "nightly"], NOW)
    assert r["ok"] and not r["warn"]


@pytest.mark.parametrize("kw", [{"verdict": "fail"}, {"tier": "M"}, {"age_days": 9}, {"verdict": "running"}])
def test_a_report_that_does_not_qualify_fails_when_required_and_warns_otherwise(repo: Path, tmp_path: Path, kw: dict) -> None:
    a = _commit(repo, 1)
    res = tmp_path / "res"
    _report(res, a, **kw)
    r = _check(repo, res, True)
    assert r["ok"] is False and not r["warn"] and "no green tier-L report" in r["detail"]
    r = _check(repo, res, False)
    assert r["ok"] is True and r["warn"] is True and "required at --tag" in r["detail"]


def test_a_commit_that_is_not_an_ancestor_does_not_count(repo: Path, tmp_path: Path) -> None:
    a = _commit(repo, 1)
    _git(repo, "checkout", "-q", "-b", "side")
    side = _commit(repo, 2)
    _git(repo, "checkout", "-q", "-")
    _git(repo, "reset", "-q", "--hard", a)
    _commit(repo, 3)
    res = tmp_path / "res"
    _report(res, side)
    r = _check(repo, res, True)
    assert r["ok"] is False and "not an ancestor" in r["detail"]


def test_an_unknown_commit_does_not_count(repo: Path, tmp_path: Path) -> None:
    _commit(repo, 1)
    res = tmp_path / "res"
    _report(res, "deadbeef" * 5)
    r = _check(repo, res, True)
    assert r["ok"] is False and "not in this checkout" in r["detail"]


def test_no_results_directory_is_not_checked_never_a_silent_pass(repo: Path, tmp_path: Path) -> None:
    _commit(repo, 1)
    r = rc.green_gate_check(repo, True, [], NOW)
    assert r["ok"] is True and r["warn"] is True and r["detail"].startswith("NOT_CHECKED")


def test_not_a_git_checkout_is_not_checked(tmp_path: Path) -> None:
    r = rc.green_gate_check(tmp_path, True, [tmp_path], NOW)
    assert r["warn"] is True and r["detail"].startswith("NOT_CHECKED")


def test_results_dirs_honours_the_environment(tmp_path: Path) -> None:
    (tmp_path / "nightly").mkdir()
    assert rc.results_dirs({"SW_RESULTS_DIR": str(tmp_path)}) == [tmp_path, tmp_path / "nightly"]
    assert rc.results_dirs({"SW_RESULTS_DIR": str(tmp_path / "none")}) == []


def test_the_check_is_in_the_checklist_and_tag_requires_it(repo: Path, tmp_path: Path, monkeypatch, capsys) -> None:
    _commit(repo, 1)
    res = rc.run_checks(repo, False, [])
    by = {c["name"]: c for c in res["checks"]}
    name = "green nightly or full gate at this head or an ancestor (TR-03)"
    assert by[name]["ok"] and by[name]["warn"] and by[name]["detail"].startswith("NOT_CHECKED")
    out = tmp_path / "r"
    _report(out, "0" * 40)   # results present, nothing that covers HEAD
    assert next(c for c in rc.run_checks(repo, True, [out])["checks"] if c["name"] == name)["ok"] is False
    assert next(c for c in rc.run_checks(repo, False, [out])["checks"] if c["name"] == name)["warn"] is True
    monkeypatch.setenv("SW_RESULTS_DIR", str(out))
    rc.main(["--root", str(repo), "--tag"])
    assert "[FAIL] green nightly or full gate" in capsys.readouterr().out
