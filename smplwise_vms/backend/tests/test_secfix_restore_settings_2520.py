"""SEC-FIX-2520 SEC-3 (docs/review/DEEP-REVIEW-2520-SECURITY.md): a restore put the archive's older remote sign-in policy back -
the second-factor policy and its bearer switch, the remote-access policy, the administrators' MFA rule and default, the strict CSP -
because those keys were not on backup.SETTINGS_KEEP. They are kept now, the `security.*` / `remote.*` families are kept by default
(fail closed) unless named in backup.SETTINGS_TRAVEL, and a ratchet fails for any key of the families that is classified nowhere.

A scratch data directory with the real migrations; no app server, no network."""
from __future__ import annotations

import ast
import json
import zipfile
from pathlib import Path

import pytest

from smplwise.db import Database, get_setting, set_setting
from smplwise.services import backup as svc
from smplwise.services.settings_store import DEFAULTS

PACKAGE = Path(svc.__file__).resolve().parents[1]
SETTING_CALLS = {"get_setting", "set_setting", "setting_value", "_setting", "delete_setting", "get_settings_many"}

# the installation's current (strict) policy, and what an older archive held (looser)
STRICT = {"security.second_factor_policy": "admins", "security.second_factor_bearer": "enforce", "remote.policy": "flag",
          "remote.require_mfa_admin": "true", "remote.admins_default": "false", "remote.csp_enforce": "true",
          "security.local_password_min": "16", "security.local_session": "absolute_12h"}
LOOSE = {"security.second_factor_policy": "optional", "security.second_factor_bearer": "off", "remote.policy": "any_role",
         "remote.require_mfa_admin": "false", "remote.admins_default": "true", "remote.csp_enforce": "false",
         "security.local_password_min": "8", "security.local_session": "rolling_30d"}


def _policy_keys_in_source() -> set[str]:
    """Every `security.*` / `remote.*` settings key the package names: DEFAULTS, the literal key of a settings read or write, and
    a module constant named *KEY* (FEATURE_KEY = "security.app_refresh", ...)."""
    keys = {k for k in DEFAULTS if k.startswith(svc.POLICY_PREFIXES)}

    def literal(node: ast.AST) -> str | None:
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value.startswith(svc.POLICY_PREFIXES):
            v = node.value
            if v.endswith((".", "_")) or " " in v:
                return None  # a prefix or a sentence, not a key
            return v
        return None

    for path in PACKAGE.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                fn = node.func.attr if isinstance(node.func, ast.Attribute) else getattr(node.func, "id", "")
                if fn in SETTING_CALLS:
                    keys.update(k for k in map(literal, node.args) if k)
            elif isinstance(node, (ast.Assign, ast.AnnAssign)):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                if any(isinstance(t, ast.Name) and "KEY" in t.id and not t.id.startswith("_") for t in targets) and node.value is not None:
                    values = node.value.elts if isinstance(node.value, (ast.Tuple, ast.List, ast.Set)) else [node.value]
                    keys.update(k for k in map(literal, values) if k)
    return keys


def test_every_security_and_remote_setting_is_classified_keep_or_travel():
    keys = _policy_keys_in_source()
    assert {"security.second_factor_policy", "remote.policy", "security.app_refresh", "security.step_up"} <= keys  # the scan finds them
    unclassified = sorted(k for k in keys if k not in svc.SETTINGS_KEEP and k not in svc.SETTINGS_TRAVEL)
    assert not unclassified, ("classify each new security.* / remote.* setting in services/backup.py: SETTINGS_KEEP (never exported, "
                              f"never restored) or SETTINGS_TRAVEL (restorable, no sign-in or access rule): {unclassified}")
    assert not (svc.SETTINGS_TRAVEL & svc.SETTINGS_KEEP)
    assert all(k.startswith(svc.POLICY_PREFIXES) for k in svc.SETTINGS_TRAVEL)


@pytest.mark.parametrize("key", sorted(STRICT) + ["security.passkey_remote_factor", "security.factor_reset_channel", "security.step_up",
                                                  "security.step_up_minutes", "security.step_up_local", "security.some_future_key"])
def test_the_policy_keys_are_kept(key):
    assert svc._kept_setting(key)  # the named keys, the 2.52 keys and - fail closed - an unnamed future key of the family


def test_travel_keys_are_not_kept():
    assert not any(svc._kept_setting(k) for k in svc.SETTINGS_TRAVEL)


def _db(settings) -> Database:
    db = Database(settings.db_path)
    db.migrate()
    db.ensure_migration_objects()
    return db


def _set_all(db: Database, values: dict[str, str]) -> None:
    with db.connection() as conn:
        for k, v in values.items():
            set_setting(conn, k, v)


def _values(db: Database, keys) -> dict[str, str | None]:
    with db.connection(mode="read") as conn:
        return {k: get_setting(conn, k) for k in keys}


@pytest.mark.parametrize("mode", ["replace", "merge"])
def test_a_restore_of_an_older_archive_keeps_the_current_sign_in_policy(settings, mode):
    db = _db(settings)
    _set_all(db, LOOSE)  # last week: the looser policy
    with db.connection() as conn:
        entry = svc.create(settings, conn, "manual")
    archive = svc.backups_dir(settings) / entry["name"]
    with zipfile.ZipFile(archive) as z:
        carried = {r["key"] for r in json.loads(z.read("data/settings.json"))}
    assert not (carried & set(STRICT))  # never exported
    _set_all(db, STRICT)  # this week: the owner tightened it
    with db.connection() as conn:
        svc.restore(settings, conn, archive, mode=mode, scope="project", process_hooks=False)
    assert _values(db, STRICT) == STRICT


def test_a_hand_made_archive_carrying_looser_values_changes_nothing(settings, tmp_path):
    db = _db(settings)
    _set_all(db, STRICT)
    with db.connection() as conn:
        entry = svc.create(settings, conn, "manual")
    src = svc.backups_dir(settings) / entry["name"]
    forged = svc.backups_dir(settings) / "forged.zip"
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(forged, "w") as zout:
        for info in zin.infolist():
            body = zin.read(info.filename)
            if info.filename == "data/settings.json":
                rows = json.loads(body) + [{"key": k, "value": v} for k, v in LOOSE.items()]
                body = json.dumps(rows).encode("utf-8")
            zout.writestr(info.filename, body)
    with db.connection() as conn:
        svc.restore(settings, conn, forged, mode="replace", scope="project", process_hooks=False)
    assert _values(db, STRICT) == STRICT


def test_a_travel_key_still_travels(settings):
    db = _db(settings)
    _set_all(db, {"remote.wall_profile": "main"})
    with db.connection() as conn:
        entry = svc.create(settings, conn, "manual")
    _set_all(db, {"remote.wall_profile": "sub"})
    with db.connection() as conn:
        svc.restore(settings, conn, svc.backups_dir(settings) / entry["name"], mode="replace", scope="project", process_hooks=False)
    assert _values(db, ["remote.wall_profile"]) == {"remote.wall_profile": "main"}


def test_the_drill_of_an_older_archive_carrying_a_newly_kept_key_warns_and_passes(settings, tmp_path):
    from smplwise.services import backup_drill as drill

    db = _db(settings)
    with db.connection() as conn:
        entry = svc.create(settings, conn, "manual")
    src = svc.backups_dir(settings) / entry["name"]
    older = tmp_path / "older.zip"
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(older, "w") as zout:
        manifest = json.loads(zin.read("manifest.json"))
        rows = json.loads(zin.read("data/settings.json")) + [{"key": "remote.policy", "value": "any_role"}]
        manifest["app_version"] = "2.51.0"  # written before SEC-FIX-2520 put the key on the keep list
        manifest["tables"]["settings"] = len(rows)
        for info in zin.infolist():
            body = zin.read(info.filename)
            if info.filename == "data/settings.json":
                body = json.dumps(rows).encode("utf-8")
            elif info.filename == "manifest.json":
                body = json.dumps(manifest).encode("utf-8")
            zout.writestr(info.filename, body)
    result = drill.run_drill(settings, older, write_result=False)
    check = next(c for c in result["checks"] if c["name"] == "archive_without_kept_settings")
    assert (check["ok"], check["severity"], check["detail"]) == (False, "warn", {"carried": ["remote.policy"], "older_build": True})
    assert result["result"] == "PASS", [c for c in result["checks"] if not c["ok"]]
