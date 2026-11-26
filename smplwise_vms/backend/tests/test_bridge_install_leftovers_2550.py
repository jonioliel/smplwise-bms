"""LOWS-BRIDGE-GATE-2550 (deep review 2.52 TR-12): an interrupted swap of the bridge copy leaves `smplwise_bridge.smplwise-old` /
`smplwise_bridge.smplwise-new` (each with a manifest of domain `smplwise_bridge`) in Home Assistant's custom_components. `.smplwise-old`
was removed only when another copy was needed, so it could stay for a whole version. Every install run now removes both leftover names
first - and nothing else. A fake Home Assistant config directory under tmp_path only."""
from __future__ import annotations

import json

import pytest

from smplwise.main import create_app
from smplwise.services import bridge_install, ha_client


@pytest.fixture()
def ha_cfg(tmp_path, monkeypatch):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    (cfg / "configuration.yaml").write_text("", encoding="utf-8")
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(cfg))
    monkeypatch.setattr(ha_client, "supervisor_token", lambda: None)  # no Supervisor: no discovery is posted
    return cfg


def _stray(cc, name: str) -> None:
    d = cc / name
    d.mkdir()
    (d / "manifest.json").write_text(json.dumps({"domain": "smplwise_bridge", "version": "0.0.1"}), encoding="utf-8")
    (d / "__init__.py").write_text("", encoding="utf-8")


def test_leftovers_of_an_interrupted_swap_are_removed_even_when_no_copy_is_needed(settings, ha_cfg):
    db = create_app(settings).state.db
    first = bridge_install.install(db, settings, announce=False)
    assert first["installed_now"] is True
    cc = ha_cfg / "custom_components"
    target = cc / "smplwise_bridge"
    marker = (target / bridge_install.MARKER).read_text(encoding="utf-8")
    _stray(cc, "smplwise_bridge.smplwise-old")
    _stray(cc, "smplwise_bridge.smplwise-new")
    foreign = cc / "smplwise_bridge.backup"  # any other name is not ours to touch
    _stray(cc, foreign.name)
    st = bridge_install.install(db, settings, announce=False)
    assert st["installed_now"] is False, "the installed copy is current: no copy is needed"
    assert not (cc / "smplwise_bridge.smplwise-old").exists(), "TR-12: the leftover of the replaced tree is gone"
    assert not (cc / "smplwise_bridge.smplwise-new").exists(), "TR-12: the leftover staged tree is gone"
    assert foreign.is_dir() and (foreign / "manifest.json").is_file()
    assert (target / bridge_install.MARKER).read_text(encoding="utf-8") == marker and (target / "manifest.json").is_file()


def test_a_leftover_name_that_is_a_link_is_left_alone(tmp_path):
    cc = tmp_path / "custom_components"
    cc.mkdir()
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    (elsewhere / "keep.txt").write_text("1", encoding="utf-8")
    link = cc / "smplwise_bridge.smplwise-old"
    try:
        link.symlink_to(elsewhere, target_is_directory=True)
    except OSError:
        pytest.skip("this platform cannot create a directory link here")
    assert bridge_install._sweep_leftovers(cc / "smplwise_bridge") == []
    assert link.is_symlink() and (elsewhere / "keep.txt").is_file()


def test_the_sweep_names_only_the_two_leftovers(tmp_path):
    cc = tmp_path / "custom_components"
    cc.mkdir()
    for name in ("smplwise_bridge.smplwise-old", "smplwise_bridge.smplwise-new", "smplwise_bridge.smplwise-older", "hikvision_intercom.smplwise-old"):
        _stray(cc, name)
    assert sorted(bridge_install._sweep_leftovers(cc / "smplwise_bridge")) == ["smplwise_bridge.smplwise-new", "smplwise_bridge.smplwise-old"]
    assert sorted(p.name for p in cc.iterdir()) == ["hikvision_intercom.smplwise-old", "smplwise_bridge.smplwise-older"]
