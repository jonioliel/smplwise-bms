"""GATE-TRUST-2540 (review finding TR-04, remainder): release_check proves the shipped bundle (smplwise_vms/www) is the build of the gated
SOURCE, not only of the version. `npm run build:addon` writes www/build-stamp.json with the digest of the frontend build inputs
(frontend/scripts/build-stamp.mjs); release_check recomputes it on the checkout. A frontend change committed after the rebuild fails the
release; before the release (CHANGELOG head a DRAFT) or before STAMP_REQUIRED_FROM it is a warning."""
from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("release_check_stamp_2540", ROOT / "scripts" / "release_check.py")
rc = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(rc)

INPUTS = ["frontend/src", "frontend/index.html"]


def _git(root: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(root), "-c", "user.email=t@t", "-c", "user.name=t", *args], check=True, capture_output=True)


def _repo(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    files = {
        "frontend/scripts/build-stamp-inputs.json": json.dumps({"paths": INPUTS}),
        "frontend/src/a.ts": "export const a = 1;\n",
        "frontend/src/sub/b.ts": "export const b = 2;\n",
        "frontend/index.html": "<html></html>\n",
        "frontend/tests/t.spec.ts": "test\n",
        "smplwise_vms/config.yaml": 'version: "2.54.0"\n',
    }
    for rel, text in files.items():
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_bytes(text.encode("utf-8"))
    (root / "smplwise_vms" / "www").mkdir(parents=True)
    subprocess.run(["git", "init", "-q", str(root)], check=True)
    _git(root, "config", "core.autocrlf", "false")
    _git(root, "add", "-A")
    _git(root, "commit", "-qm", "v1")
    return root


def _stamp(root: Path, version: str = "2.54.0") -> dict:
    d = rc.inputs_digest(root, INPUTS)
    head = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    doc = {"schema": 1, "version": version, "inputs_sha256": d["digest"], "files": d["files"], "inputs": INPUTS, "source_commit": head}
    (root / "smplwise_vms" / "www" / "build-stamp.json").write_text(json.dumps(doc), encoding="utf-8")
    return doc


def test_stamp_of_these_sources_passes(tmp_path):
    root = _repo(tmp_path)
    _stamp(root)
    r = rc.shipped_build_stamp(root, "2.54.0", released=True)
    assert r["ok"] and not r["warn"], r


def test_frontend_change_after_the_rebuild_fails_the_release(tmp_path):
    root = _repo(tmp_path)
    _stamp(root)
    (root / "frontend" / "src" / "sub" / "b.ts").write_text("export const b = 3;\n", encoding="utf-8")
    _git(root, "commit", "-qam", "a fix after the rebuild")
    r = rc.shipped_build_stamp(root, "2.54.0", released=True)
    assert not r["ok"] and "differ" in r["detail"] and "frontend/src/sub/b.ts" in r["detail"], r


def test_a_change_outside_the_build_inputs_does_not_count(tmp_path):
    root = _repo(tmp_path)
    _stamp(root)
    (root / "frontend" / "tests" / "t.spec.ts").write_text("a changed test\n", encoding="utf-8")
    _git(root, "commit", "-qam", "test only")
    assert rc.shipped_build_stamp(root, "2.54.0", released=True)["ok"]


def test_missing_stamp_fails_from_the_required_version_and_warns_before(tmp_path):
    root = _repo(tmp_path)
    r = rc.shipped_build_stamp(root, "2.54.0", released=True)
    assert not r["ok"] and "missing" in r["detail"] and "build:addon" in r["detail"]
    r = rc.shipped_build_stamp(root, "2.53.0", released=True)            # a bundle built before the stamp existed
    assert r["ok"] and r["warn"] and r["detail"].startswith("WARNING")
    r = rc.shipped_build_stamp(root, "2.54.0", released=False)           # a train ahead of its release rebuild
    assert r["ok"] and r["warn"] and "DRAFT" in r["detail"]


def test_stamp_of_another_version_fails(tmp_path):
    root = _repo(tmp_path)
    _stamp(root, version="2.53.0")
    r = rc.shipped_build_stamp(root, "2.54.0", released=True)
    assert not r["ok"] and "version 2.53.0" in r["detail"]


def test_crlf_checkout_hashes_like_lf(tmp_path):
    root = _repo(tmp_path)
    _stamp(root)
    p = root / "frontend" / "src" / "a.ts"
    p.write_bytes(p.read_bytes().replace(b"\n", b"\r\n"))
    assert rc.shipped_build_stamp(root, "2.54.0", released=True)["ok"]


def test_the_node_writer_and_this_check_agree(tmp_path):
    node = shutil.which("node")
    if not node:
        pytest.skip("node is not installed")
    root = _repo(tmp_path)
    out = subprocess.run([node, str(ROOT / "frontend" / "scripts" / "build-stamp.mjs"), "--root", str(root), "--print"],
                         capture_output=True, text=True, timeout=60)
    # build-stamp.mjs reads the input list next to itself (this repository's), so compare on that list
    assert out.returncode == 0, out.stderr
    stamp = json.loads(out.stdout)
    assert stamp["version"] == "2.54.0"
    assert stamp["inputs_sha256"] == rc.inputs_digest(root, stamp["inputs"])["digest"]


def test_this_tree_lists_its_build_inputs():
    paths = rc.stamp_input_paths(ROOT)
    assert "frontend/src" in paths and "frontend/package-lock.json" in paths
    assert all((ROOT / p).exists() for p in paths), [p for p in paths if not (ROOT / p).exists()]


def test_run_checks_has_the_stamp_row():
    by = {c["name"]: c for c in rc.run_checks(ROOT)["checks"]}
    assert "shipped UI bundle built from these sources (www/build-stamp.json)" in by
