"""The add-on version must be one number everywhere: config.yaml (what Home Assistant offers), the image label,
and the package (what /health, backup manifests and the pre-upgrade copy report)."""
from __future__ import annotations

import re
from pathlib import Path

from smplwise import __version__

ADDON = Path(__file__).resolve().parents[2]


def test_versions_agree():
    config = (ADDON / "config.yaml").read_text(encoding="utf-8")
    dockerfile = (ADDON / "Dockerfile").read_text(encoding="utf-8")
    cfg = re.search(r'^version:\s*"([^"]+)"', config, re.M)
    lbl = re.search(r'io\.hass\.version="([^"]+)"', dockerfile)
    assert cfg and lbl, "version strings not found"
    assert cfg.group(1) == __version__ == lbl.group(1), f"config.yaml {cfg.group(1)} / package {__version__} / image {lbl.group(1)}"
