"""T005 (T005-AUDIT-2406): the supply-chain guards of the dependency, licence and secrets audit.

- THIRD_PARTY_NOTICES.md names every direct Python requirement of the add-on image, every runtime npm package of the web UI
  bundle (the lock file's non-dev packages) and every third-party licence file shipped next to vendored code.
- Every direct Python requirement is pinned exactly or bounded above (tzdata, pure data, is the one allowed open range), so the
  Supervisor's install-time resolution cannot jump a major version.
- The private material stays out of git: `.gitignore` covers secrets/, private/, private-evidence/ and .env files, and no such
  path is tracked.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
NOTICES = REPO / "THIRD_PARTY_NOTICES.md"
REQUIREMENTS = REPO / "smplwise_vms" / "backend" / "requirements.txt"
FRONTEND_LOCK = REPO / "frontend" / "package-lock.json"

OPEN_RANGE_ALLOWED = {"tzdata"}
VENDORED_LICENCE_FILES = [
    "smplwise_vms/integration/hikvision_intercom/LICENSE",
    "custom_components/smplwise_bridge/LICENSE-WISKEY-core-runtime-observation.txt",
    "frontend/src/wiskey/LICENSE-embed-api-v1.txt",
    "docs/integrations/wiskey/catalog/rc37-contract.4/LICENSE",
]


def _norm(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def _requirements() -> list[tuple[str, str]]:
    out = []
    for raw in REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        spec = line.split(";", 1)[0].strip()
        m = re.match(r"^([A-Za-z0-9_.\-]+)(\[[^\]]*\])?\s*(.*)$", spec)
        assert m, f"unparsed requirement line: {raw!r}"
        out.append((m.group(1), m.group(3).strip()))
    return out


def _notices_text() -> str:
    return NOTICES.read_text(encoding="utf-8")


def _notices_names() -> set[str]:
    """Package names in the first column of every table row (bold and back-ticks removed)."""
    names = set()
    for line in _notices_text().splitlines():
        if not line.startswith("| ") or line.startswith("|---"):
            continue
        cell = line.split("|")[1].strip().strip("*").strip()
        first = re.split(r"[\s(]", cell, maxsplit=1)[0].strip("*`")
        if first:
            names.add(_norm(first))
    return names


def test_every_direct_python_requirement_is_in_the_notices() -> None:
    names = _notices_names()
    missing = [n for n, _ in _requirements() if _norm(n) not in names]
    assert not missing, f"requirements.txt packages missing from THIRD_PARTY_NOTICES.md: {missing}"


def test_every_direct_python_requirement_is_pinned_or_bounded() -> None:
    loose = []
    for name, spec in _requirements():
        if spec.startswith("=="):
            continue
        if "<" in spec or _norm(name) in OPEN_RANGE_ALLOWED:
            continue
        loose.append(f"{name}{spec}")
    assert not loose, f"requirements without an exact pin or an upper bound: {loose}"


def test_every_web_ui_runtime_package_is_in_the_notices() -> None:
    lock = json.loads(FRONTEND_LOCK.read_text(encoding="utf-8"))
    names = _notices_names()
    runtime = sorted(
        key.split("node_modules/")[-1]
        for key, meta in lock["packages"].items()
        if key and not meta.get("dev") and not meta.get("devOptional")
    )
    assert runtime, "no runtime package found in the frontend lock file"
    missing = [p for p in runtime if _norm(p) not in names]
    assert not missing, f"web UI runtime packages missing from THIRD_PARTY_NOTICES.md: {missing}"


def test_vendored_licence_files_exist_and_are_referenced() -> None:
    text = _notices_text()
    for rel in VENDORED_LICENCE_FILES:
        path = REPO / rel
        assert path.is_file(), f"vendored licence file missing: {rel}"
        assert "Permission is hereby granted" in path.read_text(encoding="utf-8"), f"not an MIT text: {rel}"
        folder, leaf = rel.rsplit("/", 1)
        assert rel in text or (folder in text and leaf in text) or (leaf != "LICENSE" and leaf in text), (
            f"THIRD_PARTY_NOTICES.md does not point at {rel}")


def test_gitignore_covers_the_private_material() -> None:
    lines = {ln.strip() for ln in (REPO / ".gitignore").read_text(encoding="utf-8").splitlines()}
    for entry in ("secrets/", "private/", "private-evidence/", ".env", ".env.*"):
        assert entry in lines, f".gitignore lacks {entry}"


def test_no_private_material_is_tracked() -> None:
    try:
        out = subprocess.run(["git", "ls-files", "-z"], cwd=REPO, capture_output=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        pytest.skip("not a git checkout")
    tracked = [p.decode("utf-8", "replace") for p in out.split(b"\x00") if p]
    bad = [
        p for p in tracked
        if p.split("/", 1)[0] in {"secrets", "private", "private-evidence"}
        or re.search(r"(^|/)\.env(\.[^/]+)?$", p) and not p.endswith(".env.example")
    ]
    assert not bad, f"private material is tracked: {bad}"
