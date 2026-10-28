"""WISKEY-ADOPT-2272: regression tests for the independent review of the branch (findings H1..L9, docs/changes/WISKEY-ADOPT-2272.md
"Review findings and fixes"). Synthetic data and fakes only: no socket, no WhatsApp, no restart, no Home Assistant."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from smplwise.db import get_setting, set_setting
from smplwise.services import wa_template_send as wts
from smplwise.services import wiskey_auto_install as wai

REPO = Path(__file__).resolve().parents[3]


def _app(settings: Any) -> Any:
    from smplwise.main import create_app

    return create_app(settings)


def _registry(*items: dict[str, Any]) -> dict[str, Any]:
    return {"schema_version": 1, "state": "ready", "templates": list(items)}


def _item(account: str, ref: str, name: str = "access_notice") -> dict[str, Any]:
    return {"account": account, "template_ref": ref, "expected_template_revision": 2, "template_name": name, "language": "he"}


ADMIN = [{"id": "welcome", "name": "welcome_tpl", "language": "he", "params": ["name"], "purpose": "consent_request"},
         {"id": "notice_b", "name": "notice_tpl", "language": "en", "params": [], "purpose": "notice",
          "template_ref": "wk-ref-b", "template_revision": 3}]


def _store_admin(app: Any) -> None:
    with app.state.db.write_aside() as conn:
        wts.store_registry(conn, wts.validate_registry(ADMIN)[0])


# ================================================================ H1: the registry sync merges, never wipes

def test_h1_admin_rows_are_kept_after_a_sync(settings: Any) -> None:
    app = _app(settings)
    _store_admin(app)
    assert wai.sync_native_templates(app.state.db, _registry(_item("acct-a", "r1"), _item("acct-b", "r2"))) == 2
    with app.state.db.connection() as conn:
        refs = wts.load_registry(conn)
    assert [r.id for r in refs[:2]] == ["welcome", "notice_b"] and refs[0].params == ("name",) and refs[1].wiskey_ref == "wk-ref-b"
    assert sorted(r.account for r in refs[2:]) == ["acct-a", "acct-b"] and all(r.id.startswith("native_") for r in refs[2:])
    # a later sync replaces only the native rows (r2 gone), the administrator's rows stay byte-for-byte
    assert wai.sync_native_templates(app.state.db, _registry(_item("acct-a", "r1"))) == 1
    with app.state.db.connection() as conn:
        refs = wts.load_registry(conn)
    assert [wts.ref_doc(r) for r in refs[:2]] == ADMIN and [r.account for r in refs[2:]] == ["acct-a"]


def test_h1_an_empty_reply_never_wipes_the_registry(settings: Any) -> None:
    app = _app(settings)
    _store_admin(app)
    wai.sync_native_templates(app.state.db, _registry(_item("acct-a", "r1")))
    with app.state.db.connection() as conn:
        before = get_setting(conn, wts.REGISTRY_KEY)
    with pytest.raises(wai.InstallationError) as exc:
        wai.sync_native_templates(app.state.db, _registry())
    assert exc.value.code == "native_registry_empty"
    with app.state.db.connection() as conn:
        assert get_setting(conn, wts.REGISTRY_KEY) == before


def test_h1_an_unreadable_stored_registry_is_never_overwritten(settings: Any) -> None:
    app = _app(settings)
    with app.state.db.write_aside() as conn:
        set_setting(conn, wts.REGISTRY_KEY, json.dumps([{"id": "BAD ID"}]))
    with pytest.raises(wai.InstallationError) as exc:
        wai.sync_native_templates(app.state.db, _registry(_item("acct-a", "r1")))
    assert exc.value.code == "stored_registry_unreadable"
    with app.state.db.connection() as conn:
        assert json.loads(get_setting(conn, wts.REGISTRY_KEY)) == [{"id": "BAD ID"}]


def test_h1_each_applied_sync_writes_one_audit_row_with_counts_only(settings: Any) -> None:
    app = _app(settings)
    _store_admin(app)
    wai.sync_native_templates(app.state.db, _registry(_item("acct-a", "r1")))
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = ?", (wai.AUDIT_REGISTRY_SYNC,)).fetchall()
    assert len(rows) == 1
    details = json.loads(rows[0][0])
    assert details == {"native": 1, "admin_kept": 2, "native_removed": 0, "accounts": 1}
    assert "acct-a" not in rows[0][0] and "r1" not in rows[0][0]


def test_h1_the_reconcile_keeps_the_registry_on_an_empty_reply(settings: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from smplwise.services import wiskey_direct_join
    from test_wiskey_adopt_2272_contrib import synthetic_manifest, write_manifest

    cfg = tmp_path / "ha"
    (cfg / ".storage").mkdir(parents=True)
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(cfg))
    write_manifest(cfg, synthetic_manifest())
    app = _app(settings)
    _store_admin(app)
    with app.state.db.write_aside() as conn:
        set_setting(conn, wai.SWITCH_KEY, "on")

    class Join:
        class capture_port:  # noqa: N801 - the join's attribute name
            @staticmethod
            def call(command: str, params: dict[str, Any], *, timeout_s: float) -> dict[str, Any]:
                return _registry()

        @staticmethod
        def selected(command: str | None = None) -> bool:
            return True

    monkeypatch.setattr(wiskey_direct_join, "JOIN", Join())
    assert wai.reconcile_installation(app.state.db, settings) == "registry_invalid"
    with app.state.db.connection() as conn:
        assert [wts.ref_doc(r) for r in wts.load_registry(conn)] == ADMIN


# ================================================================ H2: the installation keys never travel in a backup

INSTALLATION_KEYS = ("wiskey.auto_install", "wiskey.installation.restart_digest", "wiskey.events.cursor",
                     "wiskey.installation.staged_digest", "wiskey.installation.native_accounts")


def test_h2_backup_does_not_carry_the_installation_keys_and_a_restore_never_writes_them(settings: Any) -> None:
    from smplwise.services import backup

    app = _app(settings)
    with app.state.db.write_aside() as conn:
        for key in INSTALLATION_KEYS:
            set_setting(conn, key, "local")
        set_setting(conn, "ui.synthetic_marker", "x")  # control: an ordinary setting still travels
    with app.state.db.connection() as conn:
        exported = {r["key"] for r in backup.snapshot(conn)["settings"]}
    assert not exported & set(INSTALLATION_KEYS) and "ui.synthetic_marker" in exported
    archive = [{"key": k, "value": "from-archive"} for k in INSTALLATION_KEYS]
    with app.state.db.write_aside() as conn:
        assert backup._insert_rows(conn, "settings", archive, True) == 0
    with app.state.db.connection() as conn:
        assert all(get_setting(conn, k) == "local" for k in INSTALLATION_KEYS)


def test_h2_the_document_no_longer_claims_the_switch_is_simply_not_exported() -> None:
    doc = (REPO / "docs/changes/WISKEY-ADOPT-2272.md").read_text(encoding="utf-8")
    assert "kept out of backups" in doc and "SETTINGS_KEEP" in doc

# ================================================================ H3: staging never overwrites a tree Arx did not stage, never downgrades

BUNDLE = REPO / "smplwise_vms" / "integration" / "hikvision_intercom"


def _pinned_copy(root: Path, version: str | None = None, marker: str | None = None) -> Path:
    """A synthetic pinned bundle: the real one copied, optionally with another manifest version / one changed file, re-pinned."""
    import hashlib
    import shutil

    src = root / "hikvision_intercom"
    shutil.copytree(BUNDLE, src, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    if version is not None:
        manifest = json.loads((src / "manifest.json").read_text(encoding="utf-8"))
        manifest["version"] = version
        (src / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    if marker is not None:
        (src / "synthetic_marker.txt").write_text(marker, encoding="utf-8")
    files = wai._tree_files(src)
    tree = hashlib.sha256()
    for name in sorted(files):
        tree.update(name.encode("utf-8") + b"\0" + files[name].encode("ascii") + b"\n")
    (root / wai.PIN_NAME).write_text(json.dumps({"files": files, "tree_sha256": tree.hexdigest()}), encoding="utf-8")
    return src


@pytest.fixture()
def cfg(tmp_path: Path) -> Path:
    root = tmp_path / "ha"
    (root / "custom_components").mkdir(parents=True)
    return root


def test_h3_semver_order() -> None:
    assert wai.semver_key("2.0.0-rc.38") < wai.semver_key("2.0.0-rc.39") < wai.semver_key("2.0.0") < wai.semver_key("2.0.1")
    assert wai.semver_key("2.0.0-rc.9") < wai.semver_key("2.0.0-rc.10") and wai.semver_key("rc38") is None


def test_h3_a_missing_target_is_staged_and_an_identical_one_is_up_to_date(cfg: Path, tmp_path: Path) -> None:
    src = _pinned_copy(tmp_path / "a")
    assert wai.stage_native_bundle(cfg, src, None) == "staged"
    assert wai.stage_native_bundle(cfg, src, None) == "up_to_date"


def test_h3_a_newer_installed_tree_is_refused_and_left_as_it_is(cfg: Path, tmp_path: Path) -> None:
    newer = _pinned_copy(tmp_path / "newer", version="2.0.1")
    wai.stage_native_bundle(cfg, newer, None)
    target = cfg / "custom_components" / "hikvision_intercom"
    before = wai.source_digest(target)
    older = _pinned_copy(tmp_path / "older")  # the image's rc.38
    # refused even when the newer tree is the one Arx staged itself (an older image never downgrades)
    assert wai.stage_native_bundle(cfg, older, before) == "native_newer_installed"
    assert wai.source_digest(target) == before and not target.with_name("hikvision_intercom" + wai.BACKUP_SUFFIX).exists()


def test_h3_a_foreign_tree_is_refused(cfg: Path, tmp_path: Path) -> None:
    foreign = _pinned_copy(tmp_path / "foreign", version="1.9.0")
    wai.stage_native_bundle(cfg, foreign, None)
    target = cfg / "custom_components" / "hikvision_intercom"
    before = wai.source_digest(target)
    src = _pinned_copy(tmp_path / "src")
    assert wai.stage_native_bundle(cfg, src, None) == "native_foreign_installed"
    assert wai.stage_native_bundle(cfg, src, "0" * 64) == "native_foreign_installed"
    assert wai.source_digest(target) == before


def test_h3_arx_s_own_tree_is_replaced_and_kept_as_the_rollback_backup(cfg: Path, tmp_path: Path) -> None:
    first = _pinned_copy(tmp_path / "first", marker="one")
    assert wai.stage_native_bundle(cfg, first, None) == "staged"
    target = cfg / "custom_components" / "hikvision_intercom"
    staged = wai.source_digest(target)
    second = _pinned_copy(tmp_path / "second", marker="two")
    assert wai.stage_native_bundle(cfg, second, staged) == "staged"
    backup = target.with_name("hikvision_intercom" + wai.BACKUP_SUFFIX)
    assert (target / "synthetic_marker.txt").read_text(encoding="utf-8") == "two"
    assert (backup / "synthetic_marker.txt").read_text(encoding="utf-8") == "one" and wai.source_digest(backup) == staged


def test_h3_the_installer_stores_the_staged_digest_and_refuses_a_newer_tree(settings: Any, tmp_path: Path,
                                                                            monkeypatch: pytest.MonkeyPatch) -> None:
    from smplwise.services import bridge_install, ha_client

    cfg_dir = tmp_path / "cfg"
    cfg_dir.mkdir()
    (cfg_dir / "configuration.yaml").write_text("", encoding="utf-8")
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(cfg_dir))
    monkeypatch.setattr(ha_client, "supervisor_token", lambda: None)
    restarts: list[Any] = []
    monkeypatch.setattr(ha_client, "call_service", lambda *a, **k: restarts.append(a) or {})
    wai.NATIVE.update(state="off", code=None, version=None, restart=None)
    newer = _pinned_copy(tmp_path / "newer", version="3.0.0")
    wai.stage_native_bundle(cfg_dir, newer, None)  # someone installed a newer WisKey
    app = _app(settings)
    with app.state.db.write_aside() as conn:
        set_setting(conn, wai.SWITCH_KEY, "on")
    st = bridge_install.install(app.state.db, settings)
    assert st["wiskey_native"]["state"] == "refused" and st["wiskey_native"]["code"] == "native_newer_installed" and restarts == []
    with app.state.db.connection() as conn:
        assert get_setting(conn, wai.STAGED_DIGEST_KEY) is None
    import shutil

    shutil.rmtree(cfg_dir / "custom_components" / "hikvision_intercom")
    st = bridge_install.install(app.state.db, settings)
    assert st["wiskey_native"]["state"] == "staged"
    with app.state.db.connection() as conn:
        assert get_setting(conn, wai.STAGED_DIGEST_KEY) == wai.source_digest(BUNDLE)

# ================================================================ H4: the bridge starts the native component only for an auto-install entry

def test_h4_the_native_setup_is_gated_on_the_auto_install_entry_flag() -> None:
    from types import SimpleNamespace

    from keyrot_harness import load_bridge

    bridge = load_bridge()

    def hass(*loaded: str) -> Any:
        return SimpleNamespace(config=SimpleNamespace(components=set(loaded)))

    def entry(**data: Any) -> Any:
        return SimpleNamespace(data={"addon_url": "http://synthetic", "pairing_code": "synthetic", **data})

    assert bridge.native_setup_wanted(hass(), entry()) is False  # paired by hand / ordinary discovery: never
    assert bridge.native_setup_wanted(hass(), entry(wiskey_auto_install="true")) is False  # only the exact flag
    assert bridge.native_setup_wanted(hass(), entry(wiskey_auto_install=True)) is True
    assert bridge.native_setup_wanted(hass("hikvision_intercom"), entry(wiskey_auto_install=True)) is False  # already loaded


def test_h4_only_the_auto_install_discovery_writes_the_entry_flag() -> None:
    for root in (REPO / "custom_components" / "smplwise_bridge", REPO / "smplwise_vms" / "integration" / "smplwise_bridge"):
        src = (root / "config_flow.py").read_text(encoding="utf-8")
        assert src.count("CONF_WISKEY_AUTO_INSTALL: True") == 2, root  # the auto-install create + the auto-install update of an entry
        assert "**({CONF_WISKEY_AUTO_INSTALL: True} if auto else {})" in src and 'auto = cfg.get("wiskey_auto_install") is True' in src
        user = src.split("async def async_step_user", 1)[1].split("async def async_step_hassio", 1)[0]
        confirm = src.split("async def async_step_hassio_confirm", 1)[1].split("class SmplwiseBridgeOptionsFlow", 1)[0]
        assert "WISKEY" not in user and "WISKEY" not in confirm

# ================================================================ M1: activation fills only what the installation needs, audited

def test_m1_activation_fills_only_the_provider_and_audits_it(settings: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from smplwise.services import intercom_messaging, wa_pacing
    from test_wiskey_adopt_2272_contrib import synthetic_manifest, write_manifest

    cfg = tmp_path / "ha"
    (cfg / ".storage").mkdir(parents=True)
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(cfg))
    write_manifest(cfg, synthetic_manifest())
    app = _app(settings)
    with app.state.db.write_aside() as conn:
        set_setting(conn, wai.SWITCH_KEY, "on")
        before = {k: get_setting(conn, k) for k in ("access.station_media", "access.station_listen", wts.SWITCH_KEY,
                                                    wa_pacing.SETTING_KEY, intercom_messaging.SETTING_KEY)}
    assert wai.activate_software(app.state.db) is True
    assert wai.activate_software(app.state.db) is True  # a second start fills nothing more
    with app.state.db.connection() as conn:
        after = {k: get_setting(conn, k) for k in before}
        assert after == before and get_setting(conn, "access.station_media_provider") == "auto"
        rows = conn.execute("SELECT resource_id, details_json FROM audit_log WHERE action = ?", (wai.AUDIT_ACTIVATE,)).fetchall()
    assert [(r[0], json.loads(r[1])) for r in rows] == [
        ("access.station_media_provider", {"key": "access.station_media_provider", "before": None, "after": "auto"})]
    assert wai.ACTIVATION_DEFAULTS == (("access.station_media_provider", "auto"),)
    doc = (REPO / "docs/changes/WISKEY-ADOPT-2272.md").read_text(encoding="utf-8")
    assert "Owner steps after the automatic installation" in doc

# ================================================================ M2: the approval writes stay excluded unless the switch is on

@pytest.mark.parametrize("command", ["jobs/approval_decide", "jobs/approval_request"])
def test_m2_the_approval_writes_are_excluded_unless_the_switch_is_on(command: str, monkeypatch: pytest.MonkeyPatch) -> None:
    from smplwise.services import wiskey_direct_catalog as wdc

    monkeypatch.setattr(wdc, "INSTALLATION_SWITCH", None)
    assert wdc.direct_refusal(command) == "owner_excluded"  # no join / no reader: excluded
    monkeypatch.setattr(wdc, "INSTALLATION_SWITCH", lambda: False)
    assert wdc.direct_refusal(command) == "owner_excluded"

    def broken() -> bool:
        raise RuntimeError("synthetic")

    monkeypatch.setattr(wdc, "INSTALLATION_SWITCH", broken)
    assert wdc.direct_refusal(command) == "owner_excluded"  # unreadable: excluded
    monkeypatch.setattr(wdc, "INSTALLATION_SWITCH", lambda: True)
    assert wdc.direct_refusal(command) is None
    assert wdc.direct_refusal("jobs/approval_review") is None  # the read is never excluded


def test_m2_the_join_installs_the_live_switch_reader_and_shutdown_removes_it(settings: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    from smplwise.services import wiskey_direct_catalog as wdc
    from smplwise.services import wiskey_direct_join as join

    app = _app(settings)
    monkeypatch.setattr(wdc, "INSTALLATION_SWITCH", None)

    async def opener() -> Any:
        raise OSError("synthetic: never connects")

    j = join.startup(app.state.db, settings, opener=opener, open_lineage=False, provider_reader=lambda: True,
                     key_reader=lambda: "synthetic-pairing-key-0123456789abcdef")
    try:
        assert j is not None and wdc.INSTALLATION_SWITCH is not None
        assert wdc.direct_refusal("jobs/approval_decide") == "owner_excluded"
        with app.state.db.write_aside() as conn:
            set_setting(conn, wai.SWITCH_KEY, "on")
        assert wdc.direct_refusal("jobs/approval_decide") is None
    finally:
        join.shutdown()
    assert wdc.INSTALLATION_SWITCH is None and wdc.direct_refusal("jobs/approval_decide") == "owner_excluded"


def test_m2_the_documents_require_a_written_owner_confirmation() -> None:
    for name in ("WISKEY-ADOPT-2272.md", "WKWRITE-295-ADOPTION-MAP.md", "WKR5-295.md"):
        text = (REPO / "docs" / "changes" / name).read_text(encoding="utf-8")
        assert "review M2" in text and "in writing" in text.lower(), name

# ================================================================ M3: an account only on sync-created rows, verified against WisKey's list

from intercom_station_scope import station_scope  # noqa: E402,F401 - a fixture
from test_intercom_messaging import mc, req  # noqa: E402,F401 - `mc` is a fixture
from test_tplv2_295 import REF, preview, v2  # noqa: E402,F401 - `v2` is a fixture


def test_m3_parse_ref_accepts_an_account_only_on_a_native_row() -> None:
    assert wts.parse_ref({**REF, "account": "acct-a"}) is None
    assert wts.parse_ref({**REF, "id": "native_abc", "account": "acct-a"}).account == "acct-a"


def test_m3_the_admin_put_strips_the_account_and_keeps_the_synced_rows(v2: Any) -> None:
    c, _s, _station, _open = v2
    db = c.app.state.db
    wai.sync_native_templates(db, _registry(_item("acct-a", "r1")))
    with db.connection() as conn:
        native = [r for r in wts.load_registry(conn) if wts.is_native(r)]
    forged = {"id": native[0].id, "name": "forged_name", "language": "he", "params": [], "purpose": "notice", "account": "acct-x"}
    r = req(c, "PUT", "/messaging/template-send", json={"templates": [{**REF, "account": "acct-evil"}, forged]})
    assert r.status_code == 200, r.text
    with db.connection() as conn:
        refs = wts.load_registry(conn)
    assert [(x.id, x.account) for x in refs] == [("access", None), (native[0].id, "acct-a")]
    assert refs[1].name == "access_notice"  # the synced row is the sync's: an administrator PUT never rewrites it
    bad = req(c, "PUT", "/messaging/template-send", json={"templates": [{**REF, "id": "native_x", "name": "x"}, {**REF, "id": "BAD"}]})
    assert bad.status_code == 422 and bad.json()["details"]["errors"] == [{"path": "templates.1", "code": "invalid"}]


def test_m3_a_native_account_is_used_only_when_wiskey_listed_it_and_the_switch_is_on(v2: Any) -> None:
    c, _s, _station, open_v2 = v2
    open_v2()
    db = c.app.state.db
    wai.sync_native_templates(db, _registry(_item("acct-a", "r1")))
    with db.connection() as conn:
        rid = next(r.id for r in wts.load_registry(conn) if wts.is_native(r))
    off = preview(c, template=rid).json()
    assert off["preview"]["account"] is None and "account_unavailable" in off["blockers"]  # switch off: never the native account
    with db.write_aside() as conn:
        set_setting(conn, wai.SWITCH_KEY, "on")
    on = preview(c, template=rid).json()
    assert on["preview"]["account"] == "acct-a" and "account_unavailable" not in on["blockers"]
    with db.write_aside() as conn:
        set_setting(conn, wai.NATIVE_ACCOUNTS_KEY, json.dumps(["acct-other"]))  # WisKey no longer lists it
    gone = preview(c, template=rid).json()
    assert gone["preview"]["account"] is None and "account_unavailable" in gone["blockers"]