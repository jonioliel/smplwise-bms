"""CR-021 S4 (D8): the `[platform-restart]` marker of the running version's CHANGELOG section adds the "restart required" reason
`release` once per version. Local file only; no infrastructure call."""
from __future__ import annotations

from pathlib import Path

import pytest
from test_self_update import world  # noqa: F401 - fixture

from smplwise import __version__
from smplwise.services import platform_restart, release_notes

LOG = """# Changelog

## 9.9.1 (pilot) - later
- [platform-restart] not this one

## 9.9.0 (pilot) - the running one
### English
- New bridge.
- [platform-restart] the bridge changed; restart the platform once.

## 9.8.0 - older
- nothing
"""


def _write(tmp_path: Path, text: str) -> Path:
    p = tmp_path / "CHANGELOG.md"
    p.write_text(text, encoding="utf-8")
    return p


def test_section_and_flag():
    assert release_notes.section(LOG, "9.8.0") == ["- nothing"]
    assert release_notes.flagged(LOG, "9.9.0") is True
    assert release_notes.flagged(LOG, "9.8.0") is False, "the marker of another version does not count"
    assert release_notes.flagged(LOG, "9.7.0") is False, "a version without a section is not flagged"
    assert release_notes.flagged(LOG, "9.9") is False, "an exact version match only"


def test_reason_added_once_per_version(world, tmp_path):  # noqa: F811
    app, _ = world
    path = _write(tmp_path, LOG)
    with app.state.db.connection() as conn:
        assert release_notes.note_release_restart(conn, "9.9.0", path=path) is True
        assert {"code": "release", "version": "9.9.0"} in platform_restart.reasons(conn)
        assert release_notes.note_release_restart(conn, "9.9.0", path=path) is False, "already noted"
        platform_restart.clear_after_restart(conn, "9999-01-01T00:00:00Z")  # a successful platform restart
        assert release_notes.note_release_restart(conn, "9.9.0", path=path) is False, "a cleared reason is not added again at the next start"
        assert [r for r in platform_restart.reasons(conn) if r["code"] == "release"] == []
        assert release_notes.note_release_restart(conn, "9.9.1", path=path) is True, "the next flagged version adds it again"


@pytest.mark.parametrize("version", ["9.8.0", "1.0; drop", ""])
def test_no_reason(world, tmp_path, version):  # noqa: F811
    app, _ = world
    path = _write(tmp_path, LOG)
    with app.state.db.connection() as conn:
        assert release_notes.note_release_restart(conn, version, path=path) is False
        assert [r for r in platform_restart.reasons(conn) if r["code"] == "release"] == []


def test_missing_or_huge_file(world, tmp_path):  # noqa: F811
    app, _ = world
    big = tmp_path / "big.md"
    big.write_bytes(b"x" * (release_notes.MAX_BYTES + 1))
    with app.state.db.connection() as conn:
        assert release_notes.note_release_restart(conn, "9.9.0", path=tmp_path / "absent.md") is False
        assert release_notes.note_release_restart(conn, "9.9.0", path=big) is False


def test_repository_changelog_has_a_section_for_the_running_version():
    """The image copies smplwise_vms/CHANGELOG.md; the running version must have its own section for the marker to be read."""
    text = release_notes.read_changelog()
    assert text is not None, "smplwise_vms/CHANGELOG.md is found from the package"
    assert release_notes.section(text, __version__) is not None


def test_image_carries_the_changelog():
    dockerfile = Path(__file__).resolve().parents[2] / "Dockerfile"
    assert "COPY CHANGELOG.md /app/CHANGELOG.md" in dockerfile.read_text(encoding="utf-8")
