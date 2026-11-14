"""The add-on documentation (DOCS.md, DOCS_HE.md) and config.yaml must agree on the options."""
from __future__ import annotations

import re
from pathlib import Path

import pytest

ADDON = Path(__file__).resolve().parents[2]
REPO = ADDON.parent
DOCS = {"DOCS.md": ADDON / "DOCS.md", "DOCS_HE.md": ADDON / "DOCS_HE.md"}


def _top_level_keys(text: str, block: str) -> list[str]:
    m = re.search(rf"^{block}:\n((?:(?:  .*|#.*)\n)+)", text, re.M)
    assert m, block
    return re.findall(r"^  ([a-z0-9_]+):", m.group(1), re.M)


def _options() -> list[str]:
    return _top_level_keys((ADDON / "config.yaml").read_text(encoding="utf-8"), "options")


def test_options_and_schema_have_the_same_keys():
    text = (ADDON / "config.yaml").read_text(encoding="utf-8")
    assert sorted(_options()) == sorted(_top_level_keys(text, "schema"))


@pytest.mark.parametrize("name", sorted(DOCS))
def test_every_option_is_documented(name):
    doc = DOCS[name].read_text(encoding="utf-8")
    missing = [k for k in _options() if f"`{k}`" not in doc]
    assert not missing, f"{name} does not mention options: {missing}"


@pytest.mark.parametrize("name", sorted(DOCS))
def test_documented_option_bullets_exist_in_config(name):
    doc = DOCS[name].read_text(encoding="utf-8")
    start = doc.index("**Configuration**")
    end = doc.index("\n## ", start)
    listed = set()
    for line in doc[start:end].splitlines():
        m = re.match(r"^   - ((?:`[a-z0-9_]+`(?:,? | and | ו-?)?)+)", line)
        if m:
            listed.update(re.findall(r"`([a-z0-9_]+)`", m.group(1)))
    unknown = listed - set(_options())
    assert not unknown, f"{name} documents options that config.yaml does not have: {sorted(unknown)}"
    assert "frigate_enabled" in listed and "push_relay_url" in listed and "log_level" in listed


@pytest.mark.parametrize("name", sorted(DOCS))
def test_referenced_files_exist(name):
    doc = DOCS[name].read_text(encoding="utf-8")
    for rel in ("scripts/stage_apk.py", "docs/api/mobile-presence-contract.md", "services/push-relay/README.md",
                "docs/release/RELEASE_PACKAGE_V1.md"):
        assert rel in doc, f"{name} no longer mentions {rel}"
        assert (REPO / rel).exists(), rel
