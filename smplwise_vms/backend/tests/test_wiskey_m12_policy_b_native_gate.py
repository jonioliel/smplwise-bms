"""WISKEY-RC7-ADOPT-2331 S2 (WisKey M12 policy B, owner 02.11): the switch and the Core runtime checks in front of the WisKey NATIVE
writer (`wiskey_auto_install.preflight_managed_runtime`, called by `installer_step`), adopted semantically from the contribution
(M12-POLICY-B.20261102.01) - not applied as a patch.

1. OFF (missing / null / any value but `on`) refuses before any Core read and before the native writer: ZERO calls to
   `stage_native_bundle` / `_swap_with_backup` / `wiskey_core_runtime_gate.read_core`, the component tree unchanged, audited.
2. The guards (manual / foreign / pin) come first, whatever the switch says, with the honest `refused` / `error` state.
3. The owner's ON + a managed pin reaches the Core READ gate; anything but `supported` (Arx has no image verifier, so always today)
   refuses with the gate's closed code (`blocked`), audited, nothing written. A legacy pin keeps the earlier rule (no Core read).
4. Owner default D2=a (Arx deviation): Arx's own bridge copy keeps updating with the WisKey switch off; only the native writer is gated.
5. The gate itself: never `supported` from observation JSON, a stale challenge or a missing verifier; bootstrap without a probe install.

The positive control (a faked `supported` verdict) only shows that the original file writer runs AFTER the gate; it claims no Core
support (Arx has no verifier). Synthetic bundles and real SQLite; no HA, no WisKey, no restart, no door."""
from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from test_wiskey_rc7_adopt_2331 import make_bundle, refusals, tree_digest

from smplwise.db import Database, get_setting, set_setting
from smplwise.services import bridge_install
from smplwise.services import wiskey_auto_install as install
from smplwise.services import wiskey_core_runtime_gate as gate

NOT_SUPPORTED = [
    {"state": "unavailable", "code": "core_runtime_unavailable"},
    {"state": "unavailable", "code": "core_runtime_bootstrap_unavailable"},
    {"state": "unavailable", "code": "core_runtime_observation_thread_required"},
    {"state": "refused", "code": "core_runtime_observation_invalid"},
    {"state": "unverified", "code": "core_runtime_provenance_unavailable"},
    {"state": "unsupported", "code": "core_runtime_unsupported"},
    None,
    "supported",
    {"state": "SUPPORTED", "code": None},
]


@pytest.fixture
def database(tmp_path: Path) -> Database:
    db = Database(tmp_path / "synthetic.sqlite")
    db.migrate()
    return db


@pytest.fixture
def managed(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    component = make_bundle(tmp_path / "integration")  # managed profile pin (rc.7 shape)
    monkeypatch.setenv("SW_NATIVE_SRC", str(component))
    monkeypatch.delenv("SW_HA_CONFIG_DIR", raising=False)
    install.NATIVE.update(state="off", code=None, version=None, restart=None)
    return component


@pytest.fixture
def legacy(managed: Path) -> Path:
    pin_path = managed.parent / install.PIN_NAME
    pin = json.loads(pin_path.read_text())
    for k in ("profile", "product_CODE", "file_count", "component_digest_recomputed"):
        pin.pop(k)
    pin_path.write_text(json.dumps(pin))
    return managed


@pytest.fixture
def calls(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Counts every call of the native writer, its swap and the Core read; each still runs the original (or the given verdict)."""
    seen: list[str] = []
    stage, swap = install.stage_native_bundle, install._swap_with_backup

    def staged(*a: Any, **k: Any) -> Any:
        seen.append("stage_native_bundle")
        return stage(*a, **k)

    def swapped(*a: Any, **k: Any) -> Any:
        seen.append("_swap_with_backup")
        return swap(*a, **k)

    monkeypatch.setattr(install, "stage_native_bundle", staged)
    monkeypatch.setattr(install, "_swap_with_backup", swapped)
    return seen


def verdict(monkeypatch: pytest.MonkeyPatch, seen: list[str], value: Any) -> None:
    def read_core(settings: Any, **_: Any) -> Any:
        seen.append("read_core")
        return value

    monkeypatch.setattr(gate, "read_core", read_core)


def forbid_core(monkeypatch: pytest.MonkeyPatch) -> None:
    def read_core(*_: Any, **__: Any) -> Any:
        raise AssertionError("the Core read ran with the switch off")

    monkeypatch.setattr(gate, "read_core", read_core)


def settings_rows(db: Database) -> list[tuple[str, str]]:
    with db.connection(mode="read") as c:
        return [tuple(r) for r in c.execute("SELECT key, value FROM settings ORDER BY key").fetchall()]


def owned_older_tree(tmp_path: Path, cfg: Path, db: Database) -> Path:
    old = make_bundle(tmp_path / "older", version="2.0.1-rc.6", body="synthetic previous managed source\n")
    target = cfg / "custom_components" / "hikvision_intercom"
    shutil.copytree(old, target)
    with db.connection() as c:
        set_setting(c, install.STAGED_DIGEST_KEY, install.source_digest(target))
    return target


def set_switch(db: Database, value: str | None) -> None:
    if value is not None:
        with db.connection() as c:
            set_setting(c, install.SWITCH_KEY, value)


# ---------------------------------------------------------------- 1. OFF: before the Core read and before the native writer

@pytest.mark.parametrize("stored", [None, "off", "", "ON", "true", "1", " on", "null"])
def test_off_refuses_before_the_core_read_and_with_zero_native_writer_calls(tmp_path, managed, database, calls, monkeypatch, stored):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    target = owned_older_tree(tmp_path, cfg, database)
    set_switch(database, stored)
    forbid_core(monkeypatch)
    before, rows_before = tree_digest(cfg / "custom_components"), settings_rows(database)

    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=True)

    assert answer == {"state": "off", "code": None, "version": None, "restart": None}
    assert calls == [], calls
    assert tree_digest(cfg / "custom_components") == before and target.is_dir()
    assert settings_rows(database) == rows_before, "the gate writes no setting (never the switch)"
    (row,) = refusals(database)
    assert row["reason"] == "auto_install_off" and json.loads(row["details_json"])["switch"] == "off"


def test_off_with_a_legacy_pin_is_refused_the_same_way(tmp_path, legacy, database, calls, monkeypatch):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    forbid_core(monkeypatch)
    assert install.preflight_managed_runtime(database, SimpleNamespace(), cfg, None) is False
    assert install.NATIVE["state"] == "off" and calls == [] and not (cfg / "custom_components").exists()


def test_preflight_managed_runtime_never_writes_the_switch(tmp_path, managed, database, monkeypatch):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    for value in (None, "on"):
        set_switch(database, value)
        verdict(monkeypatch, [], {"state": "unverified", "code": "core_runtime_provenance_unavailable"})
        before = settings_rows(database)
        assert install.preflight_managed_runtime(database, SimpleNamespace(), cfg, None) is False
        assert settings_rows(database) == before
    with database.connection(mode="read") as c:
        assert get_setting(c, install.SWITCH_KEY) == "on"  # exactly the value the test (the owner's step) wrote


# ---------------------------------------------------------------- 2. the guards first, honest state also with the switch off

@pytest.mark.parametrize("switch_on", [False, True], ids=["switch_off", "switch_on"])
def test_a_manual_install_is_refused_before_the_switch_and_the_core_read(tmp_path, managed, database, calls, monkeypatch, switch_on):
    cfg = tmp_path / "ha"
    target = cfg / "custom_components" / "hikvision_intercom"
    target.mkdir(parents=True)
    (target / "_manual_upgrade_profile.json").write_text('{"synthetic": "manual"}')
    set_switch(database, "on" if switch_on else None)
    forbid_core(monkeypatch)
    before = tree_digest(target)
    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=True)
    assert answer["state"] == "refused" and answer["code"] == "native_foreign_installed", answer
    assert calls == [] and tree_digest(target) == before
    (row,) = refusals(database)
    assert row["reason"] == "manual_install_present"


# ---------------------------------------------------------------- 3. the owner's ON reaches the Core READ gate; never supported today

@pytest.mark.parametrize("value", NOT_SUPPORTED, ids=[str(i) for i in range(len(NOT_SUPPORTED))])
def test_owner_on_with_a_managed_pin_is_blocked_unless_the_core_gate_says_supported(tmp_path, managed, database, calls, monkeypatch,
                                                                                    value):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    target = owned_older_tree(tmp_path, cfg, database)
    set_switch(database, "on")
    verdict(monkeypatch, calls, value)
    before, rows_before = tree_digest(cfg / "custom_components"), settings_rows(database)

    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=True)

    code = value["code"] if isinstance(value, dict) and isinstance(value.get("code"), str) else "core_runtime_unavailable"
    assert answer == {"state": "blocked", "code": code, "version": None, "restart": None}, answer
    assert calls == ["read_core"], "exactly one Core read, then no native writer"
    assert tree_digest(cfg / "custom_components") == before and target.is_dir()
    assert settings_rows(database) == rows_before
    (row,) = refusals(database)
    details = json.loads(row["details_json"])
    assert row["reason"] == code and details["code"] == code and details["switch"] == "on" and details["component_written"] is False


def test_the_real_core_read_without_a_home_connection_is_unavailable_and_blocks(tmp_path, managed, database, calls):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    set_switch(database, "on")
    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert answer["state"] == "blocked" and answer["code"] == "core_runtime_unavailable", answer
    assert calls == [] and not (cfg / "custom_components").exists()


def test_positive_control_the_original_writer_runs_only_after_a_supported_verdict(tmp_path, managed, database, calls, monkeypatch):
    # SYNTHETIC verdict: Arx has no image verifier, so production never reaches this; it proves the order, not Core support
    cfg = tmp_path / "ha"
    cfg.mkdir()
    owned_older_tree(tmp_path, cfg, database)
    set_switch(database, "on")
    verdict(monkeypatch, calls, {"state": "supported", "code": None})
    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert answer["state"] == "staged", answer
    assert calls == ["read_core", "stage_native_bundle", "_swap_with_backup"]
    assert refusals(database) == []


def test_owner_on_with_a_legacy_pin_keeps_the_earlier_rule_without_a_core_read(tmp_path, legacy, database, calls, monkeypatch):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    set_switch(database, "on")
    verdict(monkeypatch, calls, {"state": "unavailable", "code": "core_runtime_unavailable"})
    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert answer["state"] == "staged", answer
    assert calls == ["stage_native_bundle", "_swap_with_backup"]


# ---------------------------------------------------------------- 4. D2=a: Arx's own bridge copy is independent of the WisKey switch

def _bridge_world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path]:
    cfg = tmp_path / "ha-bridge"
    cfg.mkdir()
    (cfg / "configuration.yaml").write_text("homeassistant:\n")
    bridge_src = tmp_path / "synthetic-bridge"
    bridge_src.mkdir()
    (bridge_src / "manifest.json").write_text(json.dumps({"domain": "smplwise_bridge", "version": "9.9.9-synthetic"}))
    (bridge_src / "__init__.py").write_text("# synthetic bridge\n")
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(cfg))
    monkeypatch.setenv("SW_INTEGRATION_SRC", str(bridge_src))
    return cfg, bridge_src


@pytest.mark.parametrize("switch_on", [False, True], ids=["switch_off", "switch_on_core_blocked"])
def test_the_arx_bridge_keeps_updating_while_the_native_writer_is_gated(tmp_path, managed, database, calls, monkeypatch, switch_on):
    cfg, _ = _bridge_world(tmp_path, monkeypatch)
    target = owned_older_tree(tmp_path, cfg, database)
    set_switch(database, "on" if switch_on else None)
    if switch_on:
        verdict(monkeypatch, calls, {"state": "unverified", "code": "core_runtime_provenance_unavailable"})
    else:
        forbid_core(monkeypatch)
    native_before = tree_digest(target)
    copies: list[str] = []
    copy = bridge_install._copy_tree
    monkeypatch.setattr(bridge_install, "_copy_tree", lambda s, d: copies.append(d.name) or copy(s, d))

    st = bridge_install.install(database, SimpleNamespace(), force=False, announce=False)

    assert copies == ["smplwise_bridge"] and st["installed_now"] is True and st["last_error"] is None, st
    assert (cfg / "custom_components" / "smplwise_bridge" / "manifest.json").is_file()
    assert tree_digest(target) == native_before
    assert calls == (["read_core"] if switch_on else [])
    assert st["wiskey_native"]["state"] == ("blocked" if switch_on else "off")
    assert "preflight_managed_runtime(" not in Path(bridge_install.__file__).read_text(encoding="utf-8")


def test_a_manual_profile_still_blocks_both_writers(tmp_path, managed, database, calls, monkeypatch):
    cfg, _ = _bridge_world(tmp_path, monkeypatch)
    (cfg / "hikvision_intercom_manual_upgrade.json").write_text('{"synthetic": "manual"}')
    forbid_core(monkeypatch)
    st = bridge_install.install(database, SimpleNamespace(), force=False, announce=False)
    assert st["last_error"] == "manual_owner_upgrade_profile"
    assert not (cfg / "custom_components").exists() and calls == []


# ---------------------------------------------------------------- 5. the gate itself

def _observation(challenge: str) -> dict[str, Any]:
    module = {"loaded": True, "version": "1.0", "disk": None, "loaded_code_sha256": None, "native_image_attestation": "unavailable"}
    return {"contract": "wiskey-core-runtime-observation.v1", "schema_version": 1, "challenge": challenge, "process_id": 42,
            "boot_id": "synthetic-boot", "process_started_at": 1.5, "boot_scope": "core_process_birth", "observer_ref": "synthetic",
            "observed_monotonic_ns": 7, "core_version": "2026.10.0", "python": "3.13.0", "implementation": "cpython",
            "soabi": "cpython-313", "architecture": "x86_64", "platform": "linux", "image_identity": None,
            "image_provenance": "unavailable", "modules": {m: dict(module) for m in ("orjson", "orjson.orjson", "aiohttp", "aiohttp.web_ws")},
            "scope": "loaded process observation; disk hashes are not native image attestation"}


def test_the_gate_is_never_supported_from_the_observation_alone():
    c = "synthetic-fresh-challenge-0001"
    v = _observation(c)
    assert gate.evaluate(v, c) == {"state": "unverified", "code": "core_runtime_provenance_unavailable"}
    assert gate.evaluate({**v, "image_provenance": "verified"}, c)["code"] == "core_runtime_observation_invalid"
    assert gate.evaluate({**v, "supported": True}, c)["code"] == "core_runtime_observation_invalid"
    assert gate.evaluate(v, "stale-challenge-000000")["code"] == "core_runtime_observation_invalid"
    assert gate.evaluate({"addon_version": "new"}, c)["code"] == "core_runtime_unavailable"
    assert gate.evaluate({**v, "boot_scope": "unavailable"}, c)["code"] == "core_runtime_process_unavailable"
    assert gate.evaluate(v, c, image_verifier=lambda _: None)["code"] == "core_runtime_provenance_unavailable"
    assert gate.evaluate(v, c, image_verifier=lambda _: False)["code"] == "core_runtime_unsupported"
    assert gate.evaluate(v, c, image_verifier=lambda _: "yes")["code"] == "core_runtime_provenance_unavailable"
    assert gate.evaluate(v, c, image_verifier=lambda _: True)["state"] == "supported"  # only a real verifier could; Arx has none


def test_the_bootstrap_read_never_installs_to_probe():
    seen: list[str] = []

    def missing(command: str, params: dict[str, Any]) -> dict[str, Any]:
        seen.append(command)
        return {"success": False, "error": {"code": "unknown_command"}}

    assert gate.observe(missing)["code"] == "core_runtime_bootstrap_unavailable"
    assert seen == list(gate.COMMANDS)
    assert gate.observe(lambda c, p: {"success": False, "error": {"code": "timeout"}})["code"] == "core_runtime_unavailable"


def test_read_core_refuses_inside_a_running_event_loop():
    async def inside() -> dict[str, Any]:
        return gate.read_core(SimpleNamespace())

    assert asyncio.run(inside()) == {"state": "unavailable", "code": "core_runtime_observation_thread_required"}


def test_read_core_without_a_connection_is_unavailable():
    assert gate.read_core(SimpleNamespace(), timeout_s=1.0) == {"state": "unavailable", "code": "core_runtime_unavailable"}
