"""WISKEY-R3-2272: the owner decision of 29.10 - `wiskey.auto_install` stays OFF by default and every installation effect stays behind
it; a foreign / already installed `hikvision_intercom` (e.g. the owner's manual WisKey install, 2.0.1-rc.1, 169 files) is left exactly as
it is; a tree Arx staged and then replaces is kept as `.smplwise-backup`. Also the station still: both still routes serve the installed
WisKey still only with the switch on. Synthetic trees and fakes only - no lab host, no restart, no WisKey."""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

import pytest
from test_intercom import SNAP, camera_feed, fake_go2rtc, feed  # noqa: F401 - fixtures
from test_wiskey_adopt_2272_installer import _app, ha_cfg, supervisor  # noqa: F401 - fixtures

from smplwise.db import get_setting, set_setting
from smplwise.services import bridge_install
from smplwise.services import wiskey_auto_install as wai

REPO = Path(__file__).resolve().parents[3]
BUNDLE = REPO / "smplwise_vms" / "integration" / "hikvision_intercom"
NATIVE_REL = Path("custom_components") / "hikvision_intercom"


def _manual_install(cfg: Path, version: str, files: int = 169) -> Path:
    """A synthetic stand-in for the owner's manual WisKey install: domain hikvision_intercom, `files` files in total, another content
    (hence another digest) than the pinned bundle. Nothing of the real tree is copied."""
    tree = cfg / NATIVE_REL
    tree.mkdir(parents=True)
    (tree / "manifest.json").write_text(json.dumps({"domain": "hikvision_intercom", "name": "manual install", "version": version}), encoding="utf-8")
    for i in range(files - 1):
        sub = tree / f"part{i % 7}"
        sub.mkdir(exist_ok=True)
        (sub / f"module_{i}.py").write_text(f"# synthetic manual-install file {i} of {version}\n", encoding="utf-8")
    assert sum(1 for p in tree.rglob("*") if p.is_file()) == files
    return tree


def _snapshot(tree: Path) -> dict[str, str]:
    return {p.relative_to(tree).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(tree.rglob("*")) if p.is_file()}


def _wiskey_settings(app: Any) -> dict[str, Any]:
    with app.state.db.connection() as conn:
        return {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings WHERE key LIKE 'wiskey.%'").fetchall()}


def test_the_switch_is_off_by_default_and_nothing_wiskey_is_written(settings: Any, ha_cfg: Path, supervisor: dict[str, list[Any]]) -> None:  # noqa: F811
    app = _app(settings, False)
    assert wai.switch_on_db(app.state.db) is False and wai.SWITCH_KEY == "wiskey.auto_install"
    before = _wiskey_settings(app)
    st = bridge_install.install(app.state.db, settings)
    assert st["wiskey_native"]["state"] == "off"
    assert not (ha_cfg / NATIVE_REL).exists() and not (ha_cfg / (str(NATIVE_REL) + wai.BACKUP_SUFFIX)).exists()
    assert not (ha_cfg / ".storage").exists(), "no projection, no source export, no private directory with the switch off"
    assert supervisor["restart"] == [] and "wiskey_auto_install" not in supervisor["discovery"][0]
    assert _wiskey_settings(app) == before == {}
    # the janitor entry with the switch off: no readiness observation, no installation effect
    wai._last_reconcile["at"] = float("-inf")
    assert wai.reconcile_due(app.state.db, settings, now=10_000.0) == "off"
    assert _wiskey_settings(app) == {} and not (ha_cfg / ".storage").exists()


@pytest.mark.parametrize("version,code", [("2.0.1-rc.1", "native_newer_installed"), ("2.0.0-rc.1", "native_foreign_installed"),
                                          ("not-a-semver", "native_foreign_installed")])
def test_a_manual_native_install_is_left_untouched_with_the_switch_on(settings: Any, ha_cfg: Path, supervisor: dict[str, list[Any]],  # noqa: F811
                                                                      version: str, code: str) -> None:
    """The owner's lab: a manual WisKey install (2.0.1-rc.1, 169 files, domain hikvision_intercom) with another digest than the pinned
    rc.39 bundle. Arx never overwrites, deletes, backs up or restarts for it, whichever refusal code names it."""
    tree = _manual_install(ha_cfg, version)
    before = _snapshot(tree)
    assert wai.source_digest(tree) != wai.source_digest(BUNDLE)
    app = _app(settings, True)
    st = bridge_install.install(app.state.db, settings)
    assert st["wiskey_native"]["state"] == "refused" and st["wiskey_native"]["code"] == code
    assert _snapshot(tree) == before, "the installed tree is byte-identical"
    assert not tree.with_name(tree.name + wai.BACKUP_SUFFIX).exists() and not tree.with_name(tree.name + ".smplwise-new").exists()
    assert supervisor["restart"] == [], "no platform restart for a tree Arx did not stage"
    with app.state.db.connection() as conn:
        assert get_setting(conn, wai.STAGED_DIGEST_KEY) is None
    again = bridge_install.install(app.state.db, settings)  # and a second run changes nothing either
    assert again["wiskey_native"]["code"] == code and _snapshot(tree) == before and supervisor["restart"] == []


def test_a_manual_native_install_is_left_untouched_with_the_switch_off(settings: Any, ha_cfg: Path, supervisor: dict[str, list[Any]]) -> None:  # noqa: F811
    tree = _manual_install(ha_cfg, "2.0.1-rc.1")
    before = _snapshot(tree)
    app = _app(settings, False)
    st = bridge_install.install(app.state.db, settings)
    assert st["wiskey_native"]["state"] == "off" and _snapshot(tree) == before and supervisor["restart"] == []


def test_stage_native_bundle_classifies_the_manual_tree_as_foreign_without_a_staged_digest(tmp_path: Path) -> None:
    cfg = tmp_path / "ha"
    cfg.mkdir()
    tree = _manual_install(cfg, "2.0.0-rc.1")
    before = _snapshot(tree)
    assert wai.stage_native_bundle(cfg, BUNDLE, None) == "native_foreign_installed"
    assert wai.stage_native_bundle(cfg, BUNDLE, "0" * 64) == "native_foreign_installed"  # not the digest Arx staged
    assert _snapshot(tree) == before and not tree.with_name(tree.name + wai.BACKUP_SUFFIX).exists()


def test_a_tree_arx_staged_is_replaced_and_kept_as_the_backup(tmp_path: Path) -> None:
    cfg = tmp_path / "ha"
    cfg.mkdir()
    assert wai.stage_native_bundle(cfg, BUNDLE, None) == "staged"
    tree = cfg / NATIVE_REL
    staged = wai.source_digest(tree)
    assert staged == wai.source_digest(BUNDLE)
    # a later image with another native tree (same label, different content must restage by bytes): replace Arx's own tree, keep a backup
    other = tmp_path / "other" / "hikvision_intercom"
    shutil.copytree(BUNDLE, other, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    (other / "synthetic_extra.txt").write_text("changed content under the same label", encoding="utf-8")
    pin_files = wai._tree_files(other)
    tree_hash = hashlib.sha256()
    for name in sorted(pin_files):
        tree_hash.update(name.encode() + b"\0" + pin_files[name].encode("ascii") + b"\n")
    (other.parent / wai.PIN_NAME).write_text(json.dumps({"files": pin_files, "tree_sha256": tree_hash.hexdigest()}), encoding="utf-8")
    assert wai.stage_native_bundle(cfg, other, staged) == "staged"
    backup = tree.with_name(tree.name + wai.BACKUP_SUFFIX)
    assert wai.source_digest(backup) == staged and (tree / "synthetic_extra.txt").is_file()


# ---------------------------------------------------------------- the station still (legacy door-card route, one switch)

def _native(monkeypatch: pytest.MonkeyPatch, answer: Any) -> dict[str, int]:
    seen = {"native": 0}

    def installed(_s: Any, station_id: str, *_a: Any) -> Any:
        seen["native"] += 1
        if isinstance(answer, Exception):
            raise answer
        return answer

    monkeypatch.setattr(wai, "installed_snapshot", installed)
    return seen


def test_camera_snapshot_route_is_unchanged_with_the_switch_off(feed, fake_go2rtc, monkeypatch) -> None:  # noqa: F811
    seen = _native(monkeypatch, (b"\xff\xd8native", "image/jpeg"))
    c, _s = camera_feed(feed)
    r = c.get(SNAP.format("entry-a"))
    assert r.status_code == 200 and seen["native"] == 0 and r.headers["x-snapshot-age"] == "0" and r.content != b"\xff\xd8native"


def test_camera_snapshot_route_prefers_the_installed_still_with_the_switch_on(feed, fake_go2rtc, monkeypatch) -> None:  # noqa: F811
    seen = _native(monkeypatch, (b"\xff\xd8native", "image/jpeg"))
    c, _s = camera_feed(feed)
    with c.app.state.db.write_aside() as conn:
        set_setting(conn, wai.SWITCH_KEY, "on")
    r = c.get(SNAP.format("entry-a"))
    assert r.status_code == 200 and r.content == b"\xff\xd8native" and seen["native"] == 1
    assert r.headers["cache-control"] == "private, no-store" and r.headers["x-snapshot-stale"] == "false"
    assert fake_go2rtc[0] == [], "go2rtc is not asked when the installed still is there"
    # an offline station keeps the legacy path (no native call)
    assert c.get(SNAP.format("entry-b")).status_code == 503 and seen["native"] == 1


def test_camera_snapshot_route_falls_back_when_native_has_no_still_and_refuses_on_an_ambiguous_one(feed, fake_go2rtc, monkeypatch) -> None:  # noqa: F811
    seen = _native(monkeypatch, None)  # zero cameras / unsupported -> the legacy path answers
    c, _s = camera_feed(feed)
    with c.app.state.db.write_aside() as conn:
        set_setting(conn, wai.SWITCH_KEY, "on")
    assert c.get(SNAP.format("entry-a")).status_code == 200 and seen["native"] == 1
    from smplwise.services.wiskey_media_bridge import MediaBridgeError

    _native(monkeypatch, MediaBridgeError("station_camera_ambiguous"))
    r = c.get(SNAP.format("entry-a") + "?t=1")
    assert r.status_code == 503 and r.json()["code"] == "intercom_snapshot_not_ready"
    assert "ambiguous" not in r.text, "no cause text, no first-camera guess"
