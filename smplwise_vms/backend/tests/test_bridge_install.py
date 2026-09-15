"""The add-on delivers the bridge integration into Home Assistant's config directory and announces it to the
Supervisor; the mirror inside the add-on build context must match the canonical integration source."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import bridge_install, ha_bridge, ha_client

REPO = Path(__file__).resolve().parents[3]


@pytest.fixture()
def ha_cfg(tmp_path, monkeypatch):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    (cfg / "configuration.yaml").write_text("", encoding="utf-8")
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(cfg))
    return cfg


def test_install_copies_announces_and_tracks_versions(settings, ha_cfg, monkeypatch):
    posted: list[tuple[str, dict]] = []
    monkeypatch.setattr(ha_client, "supervisor_token", lambda: "supervisor-token")
    monkeypatch.setattr(ha_client, "post_discovery", lambda _s, service, config: posted.append((service, config)) or {"uuid": "u1"})
    app = create_app(settings)
    db = app.state.db
    st = bridge_install.install(db, settings)
    target = ha_cfg / "custom_components" / "smplwise_bridge"
    assert (target / "manifest.json").is_file() and (target / "config_flow.py").is_file() and (target / "translations" / "he.json").is_file()
    assert st["installed_version"] == st["source_version"] and st["state"] == "installed_pending" and st["installed_now"] is True
    assert posted and posted[0][0] == "smplwise_bridge" and posted[0][1]["addon_url"].endswith(":8099")
    with db.connection() as conn:
        assert ha_bridge.signing_key(conn) == posted[0][1]["pairing_code"], "the announced code is the add-on's pairing secret"
    # a second run changes nothing and leaves foreign folders alone
    foreign = ha_cfg / "custom_components" / "other" / "x.py"
    foreign.parent.mkdir()
    foreign.write_text("1", encoding="utf-8")
    marker_at = json.loads((target / bridge_install.MARKER).read_text(encoding="utf-8"))["at"]
    st2 = bridge_install.install(db, settings)
    assert st2["installed_now"] is False and json.loads((target / bridge_install.MARKER).read_text(encoding="utf-8"))["at"] == marker_at and foreign.exists()
    # an outdated copy is replaced completely (stale files go away)
    (target / "stale.py").write_text("old", encoding="utf-8")
    m = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
    m["version"] = "0.0.1"
    (target / "manifest.json").write_text(json.dumps(m), encoding="utf-8")
    st3 = bridge_install.install(db, settings)
    assert st3["installed_now"] is True and not (target / "stale.py").exists() and st3["installed_version"] == st3["source_version"]
    # once the integration pings with that version the state is active; an older running copy means update_pending
    c = TestClient(app)
    with db.connection() as conn:
        secret = ha_bridge.signing_key(conn)
    assert c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": st3["source_version"]})).status_code == 200
    integ = c.get("/api/v1/ha/status").json()["integration"]
    assert integ["state"] == "active" and integ["active_version"] == st3["source_version"] and integ["config_dir"] == str(ha_cfg)
    assert c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.0.1"})).status_code == 200
    assert c.get("/api/v1/ha/status").json()["integration"]["state"] == "update_pending"


def test_without_mapping_the_status_is_honest(settings, tmp_path, monkeypatch):
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(tmp_path / "nope"))
    app = create_app(settings)
    st = bridge_install.install(app.state.db, settings)
    assert st["state"] == "not_available" and st["last_error"] == "ha_config_not_mapped" and st["source_version"]
    bridge_install.run_startup(app.state.db, settings)  # never raises


def test_install_endpoint_is_admin_only_and_audited(settings, ha_cfg, monkeypatch):
    monkeypatch.setattr(ha_client, "supervisor_token", lambda: None)
    app = create_app(settings)
    c = TestClient(app)
    bind(c, settings, "ron", "viewer", "installation", "*")
    assert c.post("/api/v1/ha/bridge/install", headers=as_user("ron")).status_code == 403
    r = c.post("/api/v1/ha/bridge/install")
    assert r.status_code == 200 and r.json()["state"] == "installed_pending" and r.json()["discovery_posted_at"] is None
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'bridge.install'").fetchone()[0] == 1


@pytest.mark.skipif(not (REPO / "custom_components" / "smplwise_bridge").is_dir(), reason="repository layout not available")
def test_integration_mirror_matches_source():
    sys.path.insert(0, str(REPO / "scripts"))
    import sync_integration  # noqa: E402

    assert sync_integration.differences() == [], "run python scripts/sync_integration.py"
