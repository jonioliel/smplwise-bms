"""WISKEY-ADOPT-2272 step 5: the installer as far as WisKey's owner28 delivery specifies it - config directory discovery (the existing
`bridge_install.ha_config_dir`), staging of the PINNED native bundle next to the bridge, the bridge's automatic-install discovery flag,
one restart request per source digest (never replayed), and the hourly reconcile. Everything stays OFF by default
(`wiskey.auto_install`): with the switch off the add-on behaves exactly as before. No real restart, no Supervisor, no WisKey."""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import pytest

from smplwise.db import get_setting, set_setting
from smplwise.errors import ApiError
from smplwise.services import bridge_install, ha_client
from smplwise.services import wiskey_auto_install as wai
from test_wiskey_adopt_2272_contrib import synthetic_manifest, write_manifest

REPO = Path(__file__).resolve().parents[3]
BUNDLE = REPO / "smplwise_vms" / "integration" / "hikvision_intercom"


@pytest.fixture()
def ha_cfg(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    cfg = tmp_path / "ha"
    cfg.mkdir()
    (cfg / "configuration.yaml").write_text("", encoding="utf-8")
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(cfg))
    wai.NATIVE.update(state="off", code=None, version=None, restart=None)
    return cfg


@pytest.fixture()
def supervisor(monkeypatch: pytest.MonkeyPatch) -> dict[str, list[Any]]:
    seen: dict[str, list[Any]] = {"discovery": [], "restart": []}
    monkeypatch.setattr(ha_client, "supervisor_token", lambda: "synthetic-supervisor-token")
    monkeypatch.setattr(ha_client, "post_discovery", lambda _s, service, config: seen["discovery"].append(dict(config)) or {"uuid": "u1"})

    def call_service(_s: Any, domain: str, service: str, data: dict[str, Any], **_k: Any) -> dict[str, Any]:
        seen["restart"].append((domain, service))
        return {}

    monkeypatch.setattr(ha_client, "call_service", call_service)
    return seen


def _app(settings: Any, switch: bool) -> Any:
    from smplwise.main import create_app

    app = create_app(settings)
    if switch:
        with app.state.db.write_aside() as conn:
            set_setting(conn, wai.SWITCH_KEY, "on")
    return app


def test_switch_off_changes_nothing(settings: Any, ha_cfg: Path, supervisor: dict[str, list[Any]]) -> None:
    app = _app(settings, False)
    st = bridge_install.install(app.state.db, settings)
    assert st["wiskey_native"]["state"] == "off"
    assert not (ha_cfg / "custom_components" / "hikvision_intercom").exists()
    assert supervisor["restart"] == [] and "wiskey_auto_install" not in supervisor["discovery"][0]
    assert (ha_cfg / "custom_components" / "smplwise_bridge" / "manifest.json").is_file()  # the bridge itself as before


def test_switch_on_stages_the_pinned_bundle_and_requests_one_restart_per_digest(settings: Any, ha_cfg: Path,
                                                                               supervisor: dict[str, list[Any]]) -> None:
    app = _app(settings, True)
    st = bridge_install.install(app.state.db, settings)
    target = ha_cfg / "custom_components" / "hikvision_intercom"
    assert st["wiskey_native"]["state"] == "staged" and st["wiskey_native"]["restart"] == "requested"
    assert wai.source_digest(target) == wai.source_digest(BUNDLE)
    assert supervisor["restart"] == [("homeassistant", "restart")] and supervisor["discovery"][0]["wiskey_auto_install"] is True
    with app.state.db.connection() as conn:
        assert get_setting(conn, wai.RESTART_DIGEST_KEY) == wai.source_digest(BUNDLE)
    again = bridge_install.install(app.state.db, settings)  # same source: up to date, no second restart
    assert again["wiskey_native"]["state"] == "up_to_date" and supervisor["restart"] == [("homeassistant", "restart")]
    assert "path" not in str(again["wiskey_native"]).lower() and str(ha_cfg) not in str(again["wiskey_native"])


def test_a_tree_edited_after_staging_is_never_overwritten_and_never_restarted(settings: Any, ha_cfg: Path,
                                                                             supervisor: dict[str, list[Any]]) -> None:
    # review H3: an installed tree whose digest is not the one Arx staged last is someone else's - refused, left exactly as it is
    app = _app(settings, True)
    bridge_install.install(app.state.db, settings)
    edited = ha_cfg / "custom_components" / "hikvision_intercom" / "const.py"
    edited.write_text("# edited\n", encoding="utf-8")
    st = bridge_install.install(app.state.db, settings)
    assert st["wiskey_native"]["state"] == "refused" and st["wiskey_native"]["code"] == "native_foreign_installed"
    assert edited.read_text(encoding="utf-8") == "# edited\n" and len(supervisor["restart"]) == 1


def test_a_failed_restart_answer_is_never_replayed(settings: Any, ha_cfg: Path, supervisor: dict[str, list[Any]],
                                                   monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    def lost(*_a: Any, **_k: Any) -> Any:
        calls.append("restart")
        raise ApiError(502, "ha_unreachable", "synthetic")

    monkeypatch.setattr(ha_client, "call_service", lost)
    app = _app(settings, True)
    assert bridge_install.install(app.state.db, settings)["wiskey_native"]["restart"] == "restart_unknown"
    shutil.rmtree(ha_cfg / "custom_components" / "hikvision_intercom")
    assert bridge_install.install(app.state.db, settings)["wiskey_native"]["restart"] == "already_requested"
    assert calls == ["restart"]


def test_a_bundle_that_differs_from_its_pin_is_never_installed(settings: Any, ha_cfg: Path, tmp_path: Path,
                                                              supervisor: dict[str, list[Any]], monkeypatch: pytest.MonkeyPatch) -> None:
    fake = tmp_path / "integ"
    shutil.copytree(BUNDLE, fake / "hikvision_intercom")
    shutil.copy(BUNDLE.parent / wai.PIN_NAME, fake / wai.PIN_NAME)
    (fake / "hikvision_intercom" / "const.py").write_text("# tampered\n", encoding="utf-8")
    monkeypatch.setenv("SW_NATIVE_SRC", str(fake / "hikvision_intercom"))
    app = _app(settings, True)
    st = bridge_install.install(app.state.db, settings)
    assert st["wiskey_native"] == {"state": "error", "code": "native_pin_mismatch", "version": st["wiskey_native"]["version"], "restart": None}
    assert not (ha_cfg / "custom_components" / "hikvision_intercom").exists() and supervisor["restart"] == []
    assert st["installed_version"] == st["source_version"]  # the bridge copy was not blocked


def test_no_mapping_reports_not_available_and_stages_nothing(settings: Any, supervisor: dict[str, list[Any]], tmp_path: Path,
                                                            monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(tmp_path / "absent"))
    app = _app(settings, True)
    st = bridge_install.install(app.state.db, settings)
    assert st["state"] == "not_available" and st["last_error"] == "ha_config_not_mapped" and supervisor["restart"] == []


def test_reconcile_is_off_by_default_and_hourly(settings: Any, ha_cfg: Path, supervisor: dict[str, list[Any]]) -> None:
    app = _app(settings, False)
    assert wai.reconcile_installation(app.state.db, settings) == "off"
    wai._last_reconcile["at"] = float("-inf")
    assert wai.reconcile_due(app.state.db, settings, now=10_000.0) == "off"
    assert wai.reconcile_due(app.state.db, settings, now=10_100.0) is None  # not due within the hour


def test_reconcile_with_switch_on(settings: Any, ha_cfg: Path, supervisor: dict[str, list[Any]], monkeypatch: pytest.MonkeyPatch) -> None:
    from smplwise.services import wa_template_send as wts
    from smplwise.services import wiskey_direct_join

    app = _app(settings, True)
    assert wai.reconcile_installation(app.state.db, settings) == "manifest_not_ready"
    write_manifest(ha_cfg, synthetic_manifest())
    monkeypatch.setattr(wiskey_direct_join, "JOIN", None)
    assert wai.reconcile_installation(app.state.db, settings) == "registry_not_selected"

    class Port:
        def call(self, command: str, params: dict[str, Any], *, timeout_s: float) -> dict[str, Any]:
            assert (command, params) == ("whatsapp/template_registry_v1", {})
            return {"schema_version": 1, "state": "ready", "templates": [
                {"account": "acct-a", "template_ref": "r1", "expected_template_revision": 1, "template_name": "access_notice", "language": "he"}]}

    class Join:
        capture_port = Port()

        def selected(self, command: str | None = None) -> bool:
            return True

    monkeypatch.setattr(wiskey_direct_join, "JOIN", Join())
    assert wai.reconcile_installation(app.state.db, settings) == "registry_synced"
    with app.state.db.connection() as conn:
        assert [r.account for r in wts.load_registry(conn)] == ["acct-a"]


def test_start_up_activation_is_wired_and_gated() -> None:
    src = (REPO / "smplwise_vms/backend/smplwise/main.py").read_text(encoding="utf-8")
    assert "wiskey_auto_install.activate_software" in src and "wiskey_auto_install.reconcile_due(db, settings)" in src
