"""T072: the release checker passes on the repository as it is (one version everywhere, bridge copies identical,
contiguous migrations, built UI, release package and known-limits documents) and fails on a tree whose versions
disagree; the git tag is reported, never created."""
from __future__ import annotations

import importlib.util
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("release_check", ROOT / "scripts" / "release_check.py")
rc = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(rc)


def test_repository_is_release_consistent(tmp_path):
    res = rc.run_checks(ROOT)
    by = {c["name"]: c for c in res["checks"]}
    assert res["version"] and by["one version everywhere"]["ok"], by["one version everywhere"]["detail"]
    assert by["bridge integration copies identical"]["ok"], by["bridge integration copies identical"]["detail"]
    assert by["bridge version consistent (manifest = const)"]["ok"]
    assert by["migrations contiguous"]["ok"]
    assert by["built UI present in the add-on (www)"]["ok"]
    assert by["release package document present"]["ok"] and by["known-limits sources present"]["ok"]
    assert res["ok"] is True, "every required check passes on the current tree"
    out = tmp_path / "r.json"
    assert rc.main(["--root", str(ROOT), "--json", str(out), "--tag"]) == 0
    assert json.loads(out.read_text(encoding="utf-8"))["version"] == res["version"]


def test_mismatched_versions_fail(tmp_path):
    root = tmp_path / "repo"
    (root / "smplwise_vms" / "backend" / "smplwise" / "migrations").mkdir(parents=True)
    (root / "smplwise_vms" / "www" / "assets").mkdir(parents=True)
    (root / "contracts").mkdir()
    (root / "docs" / "release").mkdir(parents=True)
    (root / "docs" / "operations").mkdir(parents=True)
    (root / "smplwise_vms" / "config.yaml").write_text('name: x\nversion: "0.2.0"\n', encoding="utf-8")
    (root / "smplwise_vms" / "Dockerfile").write_text('LABEL io.hass.version="0.1.9"\n', encoding="utf-8")
    (root / "smplwise_vms" / "backend" / "smplwise" / "__init__.py").write_text('__version__ = "0.2.0"\n', encoding="utf-8")
    (root / "smplwise_vms" / "CHANGELOG.md").write_text("# Changelog\n\n## 0.2.0 (pilot)\n", encoding="utf-8")
    (root / "contracts" / "API_INVENTORY.md").write_text("# API inventory\n\nVersion 0.2.0 · 1 routes\n", encoding="utf-8")
    for n in ("0001_a.sql", "0003_c.sql"):
        (root / "smplwise_vms" / "backend" / "smplwise" / "migrations" / n).write_text("-- x\n", encoding="utf-8")
    (root / "smplwise_vms" / "www" / "index.html").write_text("<html></html>", encoding="utf-8")
    (root / "smplwise_vms" / "www" / "assets" / "index-abc.js").write_text("//", encoding="utf-8")
    shutil.copytree(ROOT / "custom_components" / "smplwise_bridge", root / "custom_components" / "smplwise_bridge", ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copytree(ROOT / "custom_components" / "smplwise_bridge", root / "smplwise_vms" / "integration" / "smplwise_bridge", ignore=shutil.ignore_patterns("__pycache__"))
    (root / "smplwise_vms" / "integration" / "smplwise_bridge" / "const.py").write_text('VERSION = "9.9.9"\n', encoding="utf-8")
    res = rc.run_checks(root)
    by = {c["name"]: c for c in res["checks"]}
    assert not by["one version everywhere"]["ok"] and "Dockerfile=0.1.9" in by["one version everywhere"]["detail"]
    assert not by["bridge integration copies identical"]["ok"] and "const.py" in by["bridge integration copies identical"]["detail"]
    assert not by["migrations contiguous"]["ok"]
    assert not by["release package document present"]["ok"]
    assert res["ok"] is False
    assert rc.main(["--root", str(root)]) == 1
