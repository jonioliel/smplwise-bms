"""CR-BRIDGE-RUNTIME-2436 (code review 2026-11-13, report 05 P1-11 and P1-12): the bridge's runtime edges.

P1-11 - the import-time distribution digest (the "loaded" pair digest WisKey's readiness reader compares) ran twice, unguarded: a stray
symlink, a non-regular file or a missing manifest in the bridge folder raised `ValueError` at import and Home Assistant could not load the
integration at all. Now it is computed once, and a failure leaves `LOADED_DISTRIBUTION = None` (the reader then reports a mismatch).

P1-12 - the directory pushes the setup and the update listener start are tied to the config entry (`entry.async_create_background_task`,
cancelled by Home Assistant at unload), and the key saver lives in `entry.runtime_data` so `async_unload_entry` saves a dirty key set
(the high-water mark) before the entry goes away; before, a pending 2 s save was dropped with the unloaded setup (a short replay window).

Fakes only: the real bridge package loaded under the key-rotation harness' stubs; no Home Assistant, network or lab."""
from __future__ import annotations

import ast
import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

import keyrot_harness as kh
from smplwise.main import create_app
from smplwise.services import bridge_keys as bk

ROOT = Path(__file__).resolve().parents[3]
COPIES = (ROOT / "custom_components" / "smplwise_bridge", ROOT / "smplwise_vms" / "integration" / "smplwise_bridge")
NATIVE = ROOT / "smplwise_vms" / "integration" / "hikvision_intercom"
API = "/api/v1"


# ====================================================================== P1-11: the import-time digest

def _bridge_copy(tmp_path: Path) -> Path:
    target = tmp_path / "smplwise_bridge"
    shutil.copytree(COPIES[0], target, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    return target


@pytest.fixture()
def import_copy(monkeypatch):
    """Import a bridge folder (a copy) as a package, with the harness' Home Assistant stubs, under a private name; cleaned up after."""
    names: list[str] = []

    def load(folder: Path) -> Any:
        pkg = f"_cr_bridge_runtime_{len(names)}"
        names.append(pkg)
        monkeypatch.setattr(kh, "BRIDGE_DIR", folder)
        monkeypatch.setattr(kh, "PKG", pkg)
        return kh.load_bridge()

    yield load
    for pkg in names:
        for name in [n for n in sys.modules if n == pkg or n.startswith(pkg + ".")]:
            sys.modules.pop(name, None)


def test_a_clean_tree_gives_the_same_loaded_digest_as_before(tmp_path, import_copy):
    folder = _bridge_copy(tmp_path)
    mod = import_copy(folder)
    digest = sys.modules[f"{mod.__name__}.wiskey_distribution_digest"].digest
    assert mod.LOADED_DISTRIBUTION == digest(folder) and re.fullmatch("[0-9a-f]{64}", mod.LOADED_DISTRIBUTION)
    assert re.fullmatch("[0-9a-f]{32}", mod.LOADED_BOOT_ID) and mod.LOADED_PROCESS_ID == os.getpid()


def test_a_missing_manifest_still_lets_the_bridge_import(tmp_path, import_copy):
    folder = _bridge_copy(tmp_path)
    (folder / "manifest.json").unlink()  # the digest refuses it: component_manifest_missing
    mod = import_copy(folder)
    assert mod.LOADED_DISTRIBUTION is None, "no digest: the readiness reader sees 'not matching'"
    assert re.fullmatch("[0-9a-f]{32}", mod.LOADED_BOOT_ID) and mod.LOADED_PROCESS_ID == os.getpid()
    assert callable(mod.async_setup_entry) and callable(mod.async_unload_entry)


def test_a_stray_symlink_still_lets_the_bridge_import(tmp_path, import_copy):
    folder = _bridge_copy(tmp_path)
    try:
        os.symlink(folder / "const.py", folder / "stray_link.py")
    except (OSError, NotImplementedError) as exc:  # Windows without the symlink privilege
        pytest.skip(f"symlinks not available here ({type(exc).__name__})")
    mod = import_copy(folder)
    assert mod.LOADED_DISTRIBUTION is None
    assert re.fullmatch("[0-9a-f]{32}", mod.LOADED_BOOT_ID) and mod.LOADED_PROCESS_ID == os.getpid()


def test_a_digest_failure_of_any_kind_is_not_fatal(tmp_path, import_copy, monkeypatch):
    """The same guard for a failure that does not depend on the host (a non-regular file is hard to make portably): the digest raises."""
    folder = _bridge_copy(tmp_path)
    source = (folder / "wiskey_distribution_digest.py").read_text(encoding="utf-8")
    (folder / "wiskey_distribution_digest.py").write_text(source + '\n\ndef digest(root):\n    raise ValueError("component_non_regular")\n',
                                                         encoding="utf-8", newline="\n")
    mod = import_copy(folder)
    assert mod.LOADED_DISTRIBUTION is None


@pytest.mark.parametrize("root", COPIES, ids=["source", "mirror"])
def test_the_digest_is_computed_once_inside_a_guard(root: Path):
    tree = ast.parse((root / "__init__.py").read_text(encoding="utf-8"))
    calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and "digest" in n.func.id]
    assert len(calls) == 1, "one import-time digest"
    guarded = [t for t in ast.walk(tree) if isinstance(t, ast.Try) and any(c in ast.walk(t) for c in calls)]
    assert guarded, "the digest runs inside try/except"
    assigned = [n for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "LOADED_DISTRIBUTION"
                                                                         for t in n.targets)]
    assert len(assigned) == 1, "LOADED_DISTRIBUTION is bound once"
    for name in ("LOADED_BOOT_ID", "LOADED_PROCESS_ID"):
        assert any(isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in n.targets) for n in tree.body)


def _function(source: str, name: str) -> ast.FunctionDef:
    return next(n for n in ast.walk(ast.parse(source)) if isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef) and n.name == name)


def test_the_readiness_reader_treats_a_missing_bridge_digest_as_not_matching():
    """WisKey's reader (byte-exact, never edited) compares `loaded` with the controller's `expected` map by equality, and `expected` only
    ever holds 64-hex digests (component_map refuses anything else), so a `None` loaded digest can never match: the reader reports
    `distribution_digest_mismatch`, never `ready`."""
    reader = (NATIVE / "installation_readiness.py").read_text(encoding="utf-8")
    assert '"smplwise_bridge": getattr(bridge, "LOADED_DISTRIBUTION", None)' in reader
    assert 'not all(base[k] == state["expected"] for k in ["staged", "installed", "loaded"])' in reader
    assert 'base["reason"] = "distribution_digest_mismatch"' in reader
    controller = (NATIVE / "installation_controller.py").read_text(encoding="utf-8")
    scope: dict[str, Any] = {"re": re, "NAMES": {"smplwise_bridge", "hikvision_intercom"}}
    exec(compile(ast.Module(body=[_function(controller, "component_map")], type_ignores=[]), "component_map", "exec"), scope)  # noqa: S102
    component_map = scope["component_map"]
    good = {"smplwise_bridge": "a" * 64, "hikvision_intercom": "b" * 64}
    assert component_map(good, full=True) == good
    with pytest.raises(ValueError):
        component_map({**good, "smplwise_bridge": None}, full=True)
    assert {**good, "smplwise_bridge": None} != good


# ====================================================================== P1-12: tracked tasks and the flush at unload

@pytest.mark.parametrize("root", COPIES, ids=["source", "mirror"])
def test_the_directory_pushes_are_tied_to_the_entry(root: Path):
    source = (root / "__init__.py").read_text(encoding="utf-8")
    setup = ast.unparse(_function(source, "async_setup_entry"))
    assert "hass.async_create_task(push_directory())" not in setup
    assert setup.count("entry.async_create_background_task(hass, push_directory()") == 2, "the setup's push and the listener's push"
    # the native setup of WisKey's component is NOT cancelled with the bridge entry (a bridge reload must not abort another
    # integration's setup half-way); it stays a Home Assistant task, as test_wiskey_adopt_2272_contrib pins
    assert "hass.async_create_task(_async_setup_native(hass))" in setup
    assert "entry.runtime_data = saver" in setup
    unload = ast.unparse(_function(source, "async_unload_entry"))
    assert "persist()" in unload


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
    yield s
    s.stop()


def _signed_execute(side: kh.BridgeSide, ts: int) -> dict[str, Any]:
    """A signed `execute` the bridge verifies (a new high-water mark) and then refuses (a service outside the allowlist): nothing runs."""
    body = {"domain": "homeassistant", "service": "not_a_real_service", "user_id": "u-runtime-2436", "request_id": "r-runtime-2436",
            "data": {"entity_id": "light.x"}}
    return side.call_service(side.mod.DOMAIN, side.mod.SERVICE_EXECUTE, bk.sign_with("g0-legacy", side.entry_code, body, ts=ts))


def test_unload_flushes_a_dirty_high_water_mark(side):
    before = (side.stored_state() or {}).get("hw", {})
    ts = int(time.time())
    answer = _signed_execute(side, ts)
    assert answer == {"ok": False, "error": "service_not_allowed"}, answer
    ks = side.ks
    assert ks.dirty and ks.hw.get("g0-legacy") == ts, "the verified message set a new high-water mark, not saved yet"
    assert (side.stored_state() or {}).get("hw", {}) == before, "the delayed save is still pending"
    side.stop()  # Home Assistant unloads the entry; the pending delayed save never runs (the harness drops queued tasks, as a reload does)
    assert side.stored_state()["hw"]["g0-legacy"] == ts, "the unload saved the high-water mark"
    assert not ks.dirty


def test_a_restart_refuses_the_replayed_message_after_the_flush(side):
    msg = bk.sign_with("g0-legacy", side.entry_code, {"domain": "homeassistant", "service": "not_a_real_service", "user_id": "u-runtime-2436", "request_id": "r-runtime-2436",
                                                       "data": {"entity_id": "light.x"}}, ts=int(time.time()))
    assert side.call_service(side.mod.DOMAIN, side.mod.SERVICE_EXECUTE, dict(msg))["error"] == "service_not_allowed"
    side.restart()  # the reload: the nonce cache is gone, only the saved high-water mark remembers the message
    again = side.call_service(side.mod.DOMAIN, side.mod.SERVICE_EXECUTE, dict(msg))
    assert again.get("error") != "service_not_allowed", again


def test_a_failed_flush_never_fails_the_unload(side):
    _signed_execute(side, int(time.time()))
    assert side.ks.dirty
    side.save_failures = 1
    assert side.hass is not None
    assert side.hass.run(side.mod.async_unload_entry(side.hass, side.entry)) is True
    assert side.ks.dirty, "the save failed: still dirty"


def test_the_listeners_push_is_an_entry_task(side):
    assert side.hass is not None
    before = list(side.entry.background)
    side.hass.config_entries.async_update_entry(side.entry, options={**side.entry.options, side.mod.CONF_DELEGATED_AUTHORING: True})
    side.settle()
    assert side.entry.background[len(before):] == ["smplwise_bridge push_directory"], "the listener's push is tied to the entry"
    assert before == ["smplwise_bridge push_directory"], "so is the setup's first push"
