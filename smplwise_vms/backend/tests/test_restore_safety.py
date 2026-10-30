"""OFFBOX-RESTORE-2300, owner decisions 2026-10-30:

1. The default scope of a restore from an off-box copy is "project + access", and it is a setting (`backup.offbox_restore_scope`).
2. The pre-restore safety archive can be sealed with a password the operator types (`safety_backup_password`); a weak one is refused
   BEFORE anything is written, under its own code, and the value never reaches an answer or an audit row.
3. A LOCAL restore also writes the safety archive first; a setting (`backup.safety_before_local_restore`, default on) turns it off.
"""
from __future__ import annotations

import json

from test_backup_sensitive import PW, _export, _restore, _wipe_maria, bx  # noqa: F401 - `bx` is a fixture
from test_offbox_restore import URL, _b_import_key, _b_target, _prepare, world  # noqa: F401 - `world` is a fixture

from smplwise.routers.settings import DEFAULTS
from smplwise.services import backup as svc
from smplwise.services import restore_safety

SAFETY_PW = "a different safety password"


def _safety_files(settings) -> list[str]:
    return sorted(p.name for p in svc.backups_dir(settings).glob("auto-pre-restore-*"))


def _audit_text(db, action: str) -> str:
    with db.connection(mode="read") as conn:
        return json.dumps([tuple(r) for r in conn.execute("SELECT action, reason, details_json FROM audit_log WHERE action = ?", (action,))])


# ---------------------------------------------------------------- the settings and their defaults


def test_the_defaults_are_pinned():
    assert restore_safety.SCOPE_SETTING == "backup.offbox_restore_scope" and restore_safety.SCOPE_DEFAULT == "project+access"
    assert restore_safety.LOCAL_SAFETY_SETTING == "backup.safety_before_local_restore" and restore_safety.LOCAL_SAFETY_DEFAULT == "on"
    assert DEFAULTS["backup.offbox_restore_scope"] == "project+access"
    assert DEFAULTS["backup.safety_before_local_restore"] == "on"
    # installation policy: an archive never carries them back
    assert {"backup.offbox_restore_scope", "backup.safety_before_local_restore"} <= svc.SETTINGS_KEEP


def test_the_settings_are_read_and_validated_through_the_settings_api(client):
    s = client.get("/api/v1/settings").json()["settings"]
    assert s["backup.offbox_restore_scope"] == "project+access" and s["backup.safety_before_local_restore"] == "on"
    assert client.patch("/api/v1/settings", json={"backup.offbox_restore_scope": "everything"}).status_code == 422
    assert client.patch("/api/v1/settings", json={"backup.safety_before_local_restore": "maybe"}).status_code == 422
    r = client.patch("/api/v1/settings", json={"backup.offbox_restore_scope": "project", "backup.safety_before_local_restore": "off"})
    assert r.status_code == 200, r.text
    assert r.json()["settings"]["backup.offbox_restore_scope"] == "project" and r.json()["settings"]["backup.safety_before_local_restore"] == "off"


# ---------------------------------------------------------------- decision 1: the off-box scope default comes from the setting


def test_an_offbox_restore_without_a_scope_uses_the_setting(world):
    w = world
    p = w.c.post(f"{URL}/restore/prepare", json={"target_id": w.tid, "object": w.obj}).json()
    assert w.c.post(f"{URL}/restore", json={"stage_id": p["id"], "confirm": "RESTORE"}).status_code == 200
    assert '\\"scope\\": \\"project+access\\"' in _audit_text(w.db, "backup.offbox.restore")
    assert w.c.patch("/api/v1/settings", json={"backup.offbox_restore_scope": "project"}).status_code == 200
    p = w.c.post(f"{URL}/restore/prepare", json={"target_id": w.tid, "object": w.obj}).json()
    assert w.c.post(f"{URL}/restore", json={"stage_id": p["id"], "confirm": "RESTORE"}).status_code == 200
    assert '\\"scope\\": \\"project\\"' in _audit_text(w.db, "backup.offbox.restore")


# ---------------------------------------------------------------- decision 2: the safety archive's password


def test_an_offbox_restore_seals_the_safety_archive_with_the_typed_password(world):
    w = world
    tid = _b_target(w)
    _b_import_key(w)
    p = _prepare(w, tid).json()
    weak = w.cb.post(f"{URL}/restore", json={"stage_id": p["id"], "confirm": "RESTORE", "safety_backup_password": "short"})
    assert weak.status_code == 422 and weak.json()["code"] == "safety_password_weak" and "short" not in weak.text
    assert _safety_files(w.sb) == [], "a refused safety password writes nothing"
    ok = w.cb.post(f"{URL}/restore", json={"stage_id": p["id"], "confirm": "RESTORE", "safety_backup_password": SAFETY_PW})
    assert ok.status_code == 200, ok.text
    assert SAFETY_PW not in ok.text and SAFETY_PW not in _audit_text(w.app_b.state.db, "backup.offbox.restore")


def test_a_local_restore_seals_the_safety_archive_with_the_typed_password(bx):
    name = _export(bx).json()["name"]
    weak = _restore(bx, name, backup_password=PW, safety_backup_password="short")
    assert weak.status_code == 422 and weak.json()["code"] == "safety_password_weak" and weak.json()["details"]["min_chars"] == 12
    assert "short" not in weak.text and _safety_files(bx.settings) == []
    r = _restore(bx, name, backup_password=PW, safety_backup_password=SAFETY_PW)
    assert r.status_code == 200, r.text
    safety = r.json()["safety_archive"]["name"]
    assert svc.entry(svc.backups_dir(bx.settings) / safety)["sensitive"]["state"] == "encrypted"
    assert SAFETY_PW not in r.text and SAFETY_PW not in _audit_text(bx.db, "backup.restore") and PW not in _audit_text(bx.db, "backup.restore")


def test_without_a_safety_password_the_safety_archive_omits_the_sensitive_section(bx):
    name = _export(bx).json()["name"]
    r = _restore(bx, name, backup_password=PW)
    assert r.status_code == 200, r.text
    assert svc.entry(svc.backups_dir(bx.settings) / r.json()["safety_archive"]["name"])["sensitive"]["state"] == "omitted"


# ---------------------------------------------------------------- decision 3: a safety archive before a LOCAL restore


def test_a_local_restore_writes_a_safety_archive_of_the_state_before_it(bx):
    name = _export(bx).json()["name"]
    _wipe_maria(bx)
    r = _restore(bx, name, backup_password=PW)
    assert r.status_code == 200, r.text
    safety = r.json()["safety_archive"]
    assert safety["name"].startswith("auto-pre-restore-") and _safety_files(bx.settings) == [safety["name"]]
    m = svc.read_manifest(svc.backups_dir(bx.settings) / safety["name"])
    assert m["kind"] == "auto-pre-restore" and name in m["note"]
    assert safety["name"] in _audit_text(bx.db, "backup.restore")


def test_a_refused_local_restore_leaves_no_safety_archive(bx):
    name = _export(bx).json()["name"]
    r = _restore(bx, name, backup_password="this is not the password")
    assert r.status_code == 409 and r.json()["code"] == "backup_password_wrong"
    assert _safety_files(bx.settings) == []


def test_the_setting_turns_the_local_safety_archive_off(bx):
    assert bx.admin.patch("/api/v1/settings", json={"backup.safety_before_local_restore": "off"}).status_code == 200
    name = _export(bx).json()["name"]
    r = _restore(bx, name, backup_password=PW, safety_backup_password=SAFETY_PW)
    assert r.status_code == 200, r.text
    assert r.json()["safety_archive"] is None and _safety_files(bx.settings) == []
