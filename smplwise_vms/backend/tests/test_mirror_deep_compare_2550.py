"""LOWS-BRIDGE-GATE-2550 (deep review 2.52 TR-13): the two bridge mirror checks (`scripts/sync_integration.py --check`, run by the backend
suite, and `scripts/release_check.py` `dir_identical`) compare file BYTES. `filecmp.dircmp().diff_files` is shallow: two files of the same
size and the same mtime count as identical without being read, so a same-length edit (a version `0.10.8` -> `0.10.9`) in the same
timestamp tick passed as "in sync". Fake trees under tmp_path only."""
from __future__ import annotations

import importlib.util
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def _load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


rc = _load("release_check_2550", "scripts/release_check.py")
si = _load("sync_integration_2550", "scripts/sync_integration.py")


def _twins(tmp_path: Path) -> tuple[Path, Path]:
    """Two trees whose manifest differs in one same-length value, with the same size and the same mtime."""
    a, b = tmp_path / "src" / "smplwise_bridge", tmp_path / "mirror" / "smplwise_bridge"
    for root, version in ((a, "0.10.8"), (b, "0.10.9")):
        (root / "www").mkdir(parents=True)
        (root / "manifest.json").write_text('{"version": "%s"}\n' % version, encoding="utf-8")
        (root / "www" / "card.js").write_text("const VERSION = '%s';\n" % version, encoding="utf-8")
        (root / "same.py").write_text("x = 1\n", encoding="utf-8")
    for rel in ("manifest.json", "www/card.js", "same.py"):
        os.utime(a / rel, ns=(1_790_000_000_000_000_000, 1_790_000_000_000_000_000))
        os.utime(b / rel, ns=(1_790_000_000_000_000_000, 1_790_000_000_000_000_000))
        assert (a / rel).stat().st_size == (b / rel).stat().st_size
    return a, b


def test_release_check_sees_a_same_size_same_mtime_edit(tmp_path: Path) -> None:
    a, b = _twins(tmp_path)
    ok, diffs = rc.dir_identical(a, b)
    assert not ok and diffs == ["manifest.json (differs)", "www/card.js (differs)"], diffs


def test_sync_integration_check_sees_a_same_size_same_mtime_edit(tmp_path: Path, monkeypatch) -> None:
    a, b = _twins(tmp_path)
    monkeypatch.setattr(si, "SRC", a)
    monkeypatch.setattr(si, "DST", b)
    assert si.differences() == ["manifest.json (differs)", "www/card.js (differs)"]


def test_identical_trees_stay_identical(tmp_path: Path, monkeypatch) -> None:
    a, b = _twins(tmp_path)
    for rel in ("manifest.json", "www/card.js"):
        (b / rel).write_bytes((a / rel).read_bytes())
    assert rc.dir_identical(a, b) == (True, [])
    monkeypatch.setattr(si, "SRC", a)
    monkeypatch.setattr(si, "DST", b)
    assert si.differences() == []
