"""GATE-HARDEN-2520 (TR-04): release_check proves the shipped UI bundle (smplwise_vms/www) was built for THIS version: the service
worker's shell cache name `arx-shell-<config.yaml version>` in www/arx-sw.js. A mismatch fails once the CHANGELOG head is the release;
before that (a train branch whose CHANGELOG head is still a DRAFT, ahead of its release rebuild) it is a visible warning, not a failure."""
from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("release_check_bundle_2520", ROOT / "scripts" / "release_check.py")
rc = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(rc)

SW = 'const i=self,h="arx-shell-{v}",m="arx-meta";for(const e of await caches.keys())e.startsWith("arx-shell-")&&e!==h;'


def _addon(tmp_path: Path, shell: str | None) -> Path:
    addon = tmp_path / "smplwise_vms"
    (addon / "www").mkdir(parents=True)
    if shell is not None:
        (addon / "www" / "arx-sw.js").write_text(SW.format(v=shell), encoding="utf-8")
    return addon


def test_matching_shell_version_passes(tmp_path):
    r = rc.shipped_bundle_version(_addon(tmp_path, "2.52.0"), "2.52.0", released=True)
    assert r["ok"] and not r["warn"] and r["shell"] == "2.52.0"


def test_old_bundle_fails_at_release_time(tmp_path):
    r = rc.shipped_bundle_version(_addon(tmp_path, "2.51.0"), "2.52.0", released=True)
    assert not r["ok"] and "arx-shell-2.51.0" in r["detail"] and "build:addon" in r["detail"]


def test_old_bundle_only_warns_before_the_release_rebuild(tmp_path):
    r = rc.shipped_bundle_version(_addon(tmp_path, "2.51.0"), "2.52.0", released=False)
    assert r["ok"] and r["warn"] and r["detail"].startswith("WARNING")


def test_missing_or_unmarked_service_worker_fails_at_release(tmp_path):
    r = rc.shipped_bundle_version(_addon(tmp_path, None), "2.52.0", released=True)
    assert not r["ok"] and "missing" in r["detail"]
    addon = tmp_path / "b" / "smplwise_vms"
    (addon / "www").mkdir(parents=True)
    (addon / "www" / "arx-sw.js").write_text("self.addEventListener('install',()=>{})", encoding="utf-8")
    r = rc.shipped_bundle_version(addon, "2.52.0", released=True)
    assert not r["ok"] and "no arx-shell" in r["detail"]


def test_a_prefix_version_is_not_a_match(tmp_path):
    # 2.52.0 must not match a bundle of 2.52.01 or 2.52.0-rc1: the whole marker is compared
    assert not rc.shipped_bundle_version(_addon(tmp_path, "2.52.0-rc1"), "2.52.0", released=True)["ok"]


def test_run_checks_reports_the_bundle_row_on_this_tree():
    res = rc.run_checks(ROOT)
    by = {c["name"]: c for c in res["checks"]}
    row = by["shipped UI bundle built for this version (www/arx-sw.js shell cache)"]
    head = rc.changelog_head((ROOT / "smplwise_vms" / "CHANGELOG.md").read_text(encoding="utf-8"))
    if head == res["version"]:   # a released tree: the shipped bundle must be this version's
        assert row["ok"] and not row.get("warn"), row["detail"]
    else:                        # a train ahead of its release rebuild: a warning at most, never a failure
        assert row["ok"], row["detail"]
