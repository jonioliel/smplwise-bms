"""BRIDGE-UPDATE-LISTENER-2401: bridge 0.10.4 no longer combines a config-entry update listener with a config-flow reload.

Home Assistant 2026.6 deprecated it and 2026.12 refuses it. The lab log (2026-11-04 audit) showed, at every Home Assistant start:
"Detected that custom integration 'smplwise_bridge' has an update listener and should use it for scheduling a reload. This will stop
working in Home Assistant 2026.12.0". The source is the discovery re-pair path of the config flow (0.10.3,
`_discovered_for_existing`): `_abort_if_unique_id_configured(updates=...)` reloads an entry that has the bridge's update listener.

0.10.4: the flow passes `reload_on_update=False` when the entry has an update listener, and the listener (`entry_updated`) schedules the
ONE reload when the pairing changed; options and the bridge's own code wipe still reload nothing and push the directory now, as before.

Three layers: a static pin on both copies, the REAL config flow under a fake core that refuses the deprecated combination as 2026.12 does
(test_bridge_stale_discovery_2383's flow stub), and the REAL `async_setup_entry` listener under the key-rotation harness."""
from __future__ import annotations

import ast
import json
import secrets
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

import keyrot_harness as kh
import test_bridge_stale_discovery_2383 as flowh
from smplwise.main import create_app
from smplwise.services import bridge_keys as bk

ROOT = Path(__file__).resolve().parents[3]
COPIES = (ROOT / "custom_components" / "smplwise_bridge", ROOT / "smplwise_vms" / "integration" / "smplwise_bridge")
API = "/api/v1"
DEPRECATED = "has an update listener and should use it for scheduling a reload"


def _calls(tree: ast.AST, name: str) -> list[ast.Call]:
    return [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == name]


# ====================================================================== static pin (both copies)

@pytest.mark.parametrize("root", COPIES, ids=["source", "mirror"])
def test_no_flow_reload_is_combined_with_the_update_listener(root: Path):
    flow_src = (root / "config_flow.py").read_text(encoding="utf-8")
    flow = ast.parse(flow_src)
    assert "async_update_reload_and_abort" not in flow_src, "the reloading update-and-abort helper reloads on top of the listener"
    assert "OptionsFlowWithReload" not in flow_src, "OptionsFlowWithReload is not allowed together with an update listener"
    updating = [c for c in _calls(flow, "_abort_if_unique_id_configured") if any(k.arg == "updates" for k in c.keywords)]
    assert len(updating) == 1, "one updating abort: the discovery re-pair path"
    assert any(k.arg == "reload_on_update" for k in updating[0].keywords), "the updating abort must decide reload_on_update itself"
    assert "update_listeners" in ast.unparse(next(k.value for k in updating[0].keywords if k.arg == "reload_on_update"))

    init = ast.parse((root / "__init__.py").read_text(encoding="utf-8"))
    adds = _calls(init, "add_update_listener")
    assert len(adds) == 1, "exactly one update listener"
    wrapped = [c for c in _calls(init, "async_on_unload") if any(a is adds[0] for a in ast.walk(c))]
    assert wrapped, "the listener is removed with the entry: entry.async_on_unload(entry.add_update_listener(...))"
    assert isinstance(adds[0].args[0], ast.Name) and adds[0].args[0].id == "entry_updated"
    listener = next(n for n in ast.walk(init) if isinstance(n, ast.AsyncFunctionDef) and n.name == "entry_updated")
    assert any(isinstance(n, ast.Name) and n.id == "schedule_reload" for n in ast.walk(listener)), "the listener schedules the reload"
    assert not any(isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef) and n.name == "options_updated" for n in ast.walk(init))


def test_bridge_version_is_0_10_4_and_both_copies_are_identical():
    for root in COPIES:
        assert json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.10.6"
        assert 'VERSION = "0.10.6"' in (root / "const.py").read_text(encoding="utf-8")
        assert "const VERSION = '0.10.6';" in (root / "www" / "smplwise-card.js").read_text(encoding="utf-8")
    src, mirror = COPIES
    names = sorted(p.relative_to(src).as_posix() for p in src.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    assert names == sorted(p.relative_to(mirror).as_posix() for p in mirror.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    for name in names:
        assert (src / name).read_bytes() == (mirror / name).read_bytes(), name


# ====================================================================== the real config flow under a 2026.12-strict core

def test_the_strict_core_refuses_the_old_combination():
    """The fake core is strict: the 0.10.3 call (default reload_on_update) on an entry with a listener raises, as 2026.12 will."""
    hass = flowh.FakeHass(flowh.arx_verifier({"code": None}))
    entry = flowh.FakeEntry({"addon_url": flowh.URL, "pairing_code": flowh._code()})
    entry.update_listeners.append(lambda _h, _e: None)
    hass.entries["smplwise_bridge"] = entry
    flow = flowh._load("config_flow").SmplwiseBridgeConfigFlow()
    flow.hass, flow.unique_id = hass, "smplwise_bridge"
    with pytest.raises(RuntimeError, match=DEPRECATED):
        flow._abort_if_unique_id_configured(updates={"pairing_code": flowh._code()})


def test_loaded_entry_repair_updates_once_and_leaves_the_reload_to_the_listener():
    old, new = flowh._code(), flowh._code()
    hass = flowh.FakeHass(flowh.arx_verifier({"code": new}))
    entry = flowh.FakeEntry({"addon_url": flowh.URL, "pairing_code": old})
    seen: list[dict[str, Any]] = []
    entry.update_listeners.append(lambda _h, e: seen.append(dict(e.data)))
    hass.entries["smplwise_bridge"] = entry
    out = flowh.discover(hass, {"addon_url": flowh.URL, "pairing_code": new})
    assert out == {"type": "abort", "reason": "already_configured"}, "no RuntimeError from the strict core"
    assert entry.data["pairing_code"] == new and seen == [{"addon_url": flowh.URL, "pairing_code": new}]
    assert hass.reloads == [], "the flow does not reload: the listener does"


def test_entry_without_listener_keeps_the_flow_reload():
    """An entry that is not loaded (or waits for a setup retry) has no listener: the flow's own reload stays, as in 0.10.3."""
    old, new = flowh._code(), flowh._code()
    hass = flowh.FakeHass(flowh.arx_verifier({"code": new}))
    hass.entries["smplwise_bridge"] = flowh.FakeEntry({"addon_url": flowh.URL, "pairing_code": old})
    assert flowh.discover(hass, {"addon_url": flowh.URL, "pairing_code": new}) == {"type": "abort", "reason": "already_configured"}
    assert hass.reloads == [{"addon_url": flowh.URL, "pairing_code": new}]


def test_a_stale_code_still_touches_nothing_on_a_loaded_entry():
    old, new = flowh._code(), flowh._code()
    hass = flowh.FakeHass(flowh.arx_verifier({"code": new}))
    entry = flowh.FakeEntry({"addon_url": flowh.URL, "pairing_code": new})
    seen: list[Any] = []
    entry.update_listeners.append(lambda _h, e: seen.append(e))
    hass.entries["smplwise_bridge"] = entry
    assert flowh.discover(hass, {"addon_url": flowh.URL, "pairing_code": old}) == {"type": "abort", "reason": "already_configured"}
    assert entry.data["pairing_code"] == new and seen == [] and hass.reloads == []


# ====================================================================== the real listener (async_setup_entry under the harness)

@pytest.fixture()
def side(settings, monkeypatch):
    kh.install_no_network(monkeypatch)
    clock = kh.Clock()
    monkeypatch.setattr(time, "time", clock)
    bk.reset_for_tests()
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    r = c.get(f"{API}/ha/bridge/pairing")
    assert r.status_code == 200, r.text
    s = kh.BridgeSide(lambda: c, r.json()["pairing_code"], clock)
    assert s.entry.listeners, "the loaded bridge listens to its entry"
    yield s
    s.stop()


def _write(s: kh.BridgeSide, data: dict[str, Any] | None = None, options: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    before = len(s.pushes)
    assert s.hass is not None
    s.hass.config_entries.async_update_entry(s.entry, data=data, options=options)
    s.settle()
    return s.pushes[before:]


def test_an_options_change_pushes_the_directory_and_reloads_nothing(side):
    pushes = _write(side, options={**side.entry.options, side.mod.CONF_DELEGATED_AUTHORING: True})
    assert side.hass.config_entries.reloads == []
    assert [p["path"] for p in pushes] == ["/api/v1/ha/bridge/directory"] and pushes[0]["status"] == 200, "as before: told now"


def test_a_new_pairing_code_schedules_exactly_one_reload(side):
    new = secrets.token_urlsafe(24)
    pushes = _write(side, data={**side.entry.data, side.mod.CONF_PAIRING_CODE: new})
    assert side.hass.config_entries.reloads == [side.entry.entry_id] and pushes == [], "the K-02 re-pair runs in the fresh setup"
    _write(side, data={**side.entry.data})  # the same data written again before the reload ran
    _write(side, options={**side.entry.options, side.mod.CONF_DELEGATED_AUTHORING: True})
    assert side.hass.config_entries.reloads == [side.entry.entry_id], "one reload per new pairing"


@pytest.mark.parametrize("field", ["url", "auto_install"])
def test_a_new_address_or_the_auto_install_flag_reloads(side, field):
    m = side.mod
    data = {**side.entry.data}
    if field == "url":
        data[m.CONF_ADDON_URL] = "http://other-addon.invalid:8099"
    else:
        data[m.CONF_WISKEY_AUTO_INSTALL] = True
    _write(side, data=data)
    assert side.hass.config_entries.reloads == [side.entry.entry_id]


def test_the_bridges_own_code_wipe_is_not_a_new_pairing(side):
    """HA-06: a saved state that retired the pairing code blanks the entry's copy at setup. The listener's baseline follows the wipe, so a
    later options change still only pushes the directory (no reload, no K-02)."""
    code = side.entry_code
    ks = side.keyset_mod
    state = {"v": ks.STATE_VERSION, "signing": "g1-aaaaaaaa", "keys": {"g1-aaaaaaaa": secrets.token_urlsafe(32)}, "old": None, "next": None,
             "legacy_retired": True, "legacy_fp": ks.legacy_fingerprint(code), "rotation": None, "hw": {}}
    side.restore_storage({f"smplwise_bridge_keys_{side.entry.entry_id}": json.dumps(state)})
    assert side.entry_code == "" and not side.ks.repaired, "the setup wiped the retired code from the entry"
    _write(side, options={**side.entry.options, side.mod.CONF_DELEGATED_AUTHORING: True})
    assert side.hass.config_entries.reloads == []


def test_end_to_end_discovery_repair_on_a_loaded_bridge(side):
    """The real flow and the real listener together: an accepted re-pair updates the loaded entry once, the strict core sees no flow
    reload, and the bridge's listener schedules the one reload."""
    new = secrets.token_urlsafe(24)
    hass = flowh.FakeHass(flowh.arx_verifier({"code": new}))
    hass.entries["smplwise_bridge"] = side.entry
    url = side.entry.data[side.mod.CONF_ADDON_URL]
    out = flowh.discover(hass, {"addon_url": url, "pairing_code": new})
    assert out == {"type": "abort", "reason": "already_configured"} and hass.reloads == []
    assert side.entry_code == new and len(hass.pending) == 1
    before = len(side.pushes)
    side.hass.run(hass.pending.pop())
    side.settle()
    assert side.hass.config_entries.reloads == [side.entry.entry_id] and side.pushes[before:] == []
