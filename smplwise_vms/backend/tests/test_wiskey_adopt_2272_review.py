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
