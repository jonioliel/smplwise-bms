"""CR-029: the add-on option `frigate_enabled` (default off) reaches the registry through run.sh as SW_FRIGATE."""
from __future__ import annotations

import re
from pathlib import Path

ADDON = Path(__file__).resolve().parents[2]


def test_manifest_has_the_option_off_by_default_with_a_schema():
    text = (ADDON / "config.yaml").read_text(encoding="utf-8")
    assert re.search(r"^  frigate_enabled: false\s*$", text, re.M)
    assert re.search(r"^  frigate_enabled: bool\?\s*$", text, re.M)


def test_run_script_maps_the_option_to_the_environment():
    sh = (ADDON / "run.sh").read_text(encoding="utf-8")
    assert "bashio::config.true 'frigate_enabled'" in sh
    assert "export SW_FRIGATE=1" in sh and "export SW_FRIGATE=0" in sh


def test_self_update_option_types_know_the_option():
    from smplwise.services import self_update

    assert self_update.OPTION_TYPES["frigate_enabled"] == "bool?"
