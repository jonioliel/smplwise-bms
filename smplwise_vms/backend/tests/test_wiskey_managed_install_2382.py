"""WISKEY-MANAGED-INSTALL-2382: WisKey installs and upgrades through Arx (docs/changes/WISKEY-MANAGED-INSTALL-2382.md).

Negative cases first: the switch (off by default, typed phrase, the one writer), manual markers (never replaced before adoption), an
unknown tree, a marker with other content, a downgrade, the Core that does not stop, a missing / stale backup, the Core gate. Then the
runs: adopt, convert / upgrade / fresh install, failure -> automatic rollback, the owner's rollback, start-up recovery.

FAKES ONLY: a fake Supervisor / Core (`FakePlatform`), a synthetic configuration tree and a synthetic managed bundle (SW_NATIVE_SRC).
No Home Assistant, no WisKey, no lab host. The worker thread runs inline; the clock is virtual."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind

from smplwise.db import get_setting, set_setting
from smplwise.services import backup, self_update
from smplwise.services import bridge_install
from smplwise.services import wiskey_auto_install as wai
from smplwise.services import wiskey_managed_install as wmi
from smplwise.services import wiskey_versions as wv
from smplwise.services.wiskey_distribution_digest import digest, files

BACKEND = Path(__file__).resolve().parents[1]
PACKAGE = BACKEND / "smplwise"
API = "/api/v1/wiskey/managed"
CODE = "a" * 40
WALL0 = 1_893_456_000.0  # 2030-01-01T00:00:00Z - a fixed wall clock
PHRASE_ON = wmi.PHRASES[wmi.K_ENABLED]
PHRASE_RISK = wmi.PHRASES[wmi.K_RISK]


# ================================================================ pure: version ordering

def test_semver_precedence_numeric_prerelease_and_build_metadata():
    order = ["2.0.0-rc.9", "2.0.0-rc.10", "2.0.0-rc.38", "2.0.0-rc.39+arx-align.20261029.04", "2.0.0", "2.0.1-rc.1", "2.0.1-rc.7",
             "2.0.1-rc.10", "2.0.1", "2.1.0"]
    keys = [wv.key(v) for v in order]
    assert all(k is not None for k in keys) and keys == sorted(keys)
    assert wv.compare("2.0.1-rc.9", "2.0.1-rc.10") == -1, "rc.10 is newer than rc.9 (a string compare says the opposite)"
    assert wv.compare("2.0.0-rc.39+arx-align.20261029.04", "2.0.0-rc.39") == 0, "build metadata never orders"
    assert wv.compare("2.0.0-rc.39+arx-align.20261029.04", "2.0.1-rc.10") == -1, "the 2.38.0 bundle is OLDER than the lab's rc.10"
    assert wv.compare("2.0.0-alpha", "2.0.0-alpha.1") == -1 and wv.compare("2.0.0-alpha.1", "2.0.0-alpha.beta") == -1
    for bad in ("rc38", "2.0", "v2.0.1", "2.0.01", "2.0.1-rc.01", "", None, 2, "2.0.1-rc.10 "):
        assert wv.key(bad) is None and wv.compare(bad, "2.0.1") is None


@pytest.mark.parametrize("installed,bundled,expected", [
    (None, {"version": "2.0.1-rc.10", "digest": "B"}, "install"),
    ({"version": "2.0.1-rc.10", "digest": "B"}, {"version": "2.0.1-rc.10", "digest": "B"}, "up_to_date"),
    ({"version": "2.0.1-rc.7", "digest": "A"}, {"version": "2.0.1-rc.10", "digest": "B"}, "upgrade"),
    ({"version": "2.0.1-rc.10", "digest": "A"}, {"version": "2.0.0-rc.39+arx-align.20261029.04", "digest": "B"}, "downgrade_refused"),
    ({"version": "2.0.1-rc.10", "digest": "A", "product_CODE": CODE, "profile": "owner_manual_existing"},
     {"version": "2.0.1-rc.10", "digest": "B", "product_CODE": CODE, "profile": "managed_original_authority_flow"}, "convert"),
    ({"version": "2.0.1-rc.10", "digest": "A", "product_CODE": "b" * 40, "profile": "owner_manual_existing"},
     {"version": "2.0.1-rc.10", "digest": "B", "product_CODE": CODE, "profile": "managed_original_authority_flow"}, "same_version_different_content"),
    ({"version": "2.0.0-rc.38", "digest": "A"}, {"version": "2.0.0-rc.38", "digest": "B"}, "same_version_different_content"),
    ({"version": "not-a-version", "digest": "A"}, {"version": "2.0.1-rc.10", "digest": "B"}, "version_unknown"),
    ({"version": "2.0.1", "digest": "A"}, None, "bundle_missing"),
])
def test_plan_never_downgrades_and_never_trusts_a_label_alone(installed, bundled, expected):
    assert wv.plan(installed, bundled) == expected


def test_the_lab_case_with_the_shipped_bundle_is_a_conversion():
    """Lab 03.11: manual rc.10 (digest 9a3f...). Against the 2.38.0 bundle (rc.39) that is a downgrade; against the shipped rc.10 managed
    bundle it is a conversion - and the two trees differ by exactly the manual marker."""
    manual = wv.identify("9a3f237d673bafdb316eddba1bf0d42b86a7e631a82998d090d367033dab4ce5")
    rc39 = wv.identify("00df5e151fa8dc30be983389af8f3b483e709e74060663f9a85dcf889dc5c459")
    assert manual and manual["profile"] == "owner_manual_existing" and rc39 and rc39["profile"] == "arx_bundle_legacy"
    installed = {"version": "2.0.1-rc.10", "digest": manual["component_digest"], "product_CODE": manual["product_CODE"], "profile": manual["profile"]}
    assert wv.plan(installed, {"version": rc39["label"], "digest": rc39["component_digest"]}) == "downgrade_refused"
    shipped = wmi.bundle_info()
    assert shipped["state"] == "ok" and shipped["version"] == "2.0.1-rc.10" and shipped["product_CODE"] == manual["product_CODE"]
    assert wv.identify(shipped["digest"])["profile"] == "managed_original_authority_flow"
    assert wv.plan(installed, shipped) == "convert"
    assert manual["files"] == shipped["files"] + 1


# ================================================================ pure: the registry comparison

def _snap(entries: dict[str, str], devices=("d1",), entities=(("lock.door", "u1", "d1"),)) -> dict[str, Any]:
    return {"entries": dict(entries), "devices": sorted(devices), "entities": sorted(list(e) for e in entities)}


def test_snapshot_from_keeps_only_the_wiskey_part():
    entries = [{"entry_id": "e1", "domain": "hikvision_intercom", "state": "loaded"}]
    devices = [{"id": "d1", "config_entries": ["e1"]}, {"id": "other", "config_entries": ["x"]}]
    entities = [{"entity_id": "lock.door", "unique_id": "u1", "device_id": "d1", "platform": "hikvision_intercom", "config_entry_id": "e1"},
                {"entity_id": "light.x", "unique_id": "u9", "device_id": "other", "platform": "hue", "config_entry_id": "x"}]
    assert wmi.snapshot_from(entries, devices, entities) == _snap({"e1": "loaded"})
    assert wmi.snapshot_from(None, devices, entities) is None


def test_compare_snapshots_closed_codes():
    before = _snap({"e1": "loaded", "e2": "setup_retry"})
    assert wmi.compare_snapshots(before, before) is None
    assert wmi.compare_snapshots(before, None) == "snapshot_unavailable"
    assert wmi.compare_snapshots(before, _snap({"e1": "loaded"})) == "entries_changed"
    assert wmi.compare_snapshots(before, _snap({"e1": "setup_error", "e2": "setup_retry"})) == "entry_not_loaded"
    assert wmi.compare_snapshots(before, _snap({"e1": "loaded", "e2": "loaded"})) is None, "an entry not loaded before may load after"
    assert wmi.compare_snapshots(before, _snap({"e1": "loaded", "e2": "setup_retry"}, devices=("d2",))) == "devices_changed"
    assert wmi.compare_snapshots(before, _snap({"e1": "loaded", "e2": "setup_retry"}, entities=(("lock.door", "u2", "d1"),))) == "entities_changed"


# ================================================================ fixtures: a fake platform, a synthetic config tree and bundle

def _write_tree(root: Path, version: str, *, marker: bool, body: str = "SYNTHETIC = True\n") -> Path:
    root.mkdir(parents=True)
    (root / "manifest.json").write_text(json.dumps({"domain": "hikvision_intercom", "version": version}), encoding="utf-8")
    (root / "core.py").write_text(body, encoding="utf-8")
    if marker:
        (root / wmi.COMPONENT_MARKER).write_text(json.dumps(wmi.MANUAL_PROFILE_DOC), encoding="utf-8")
    return root


def _managed_bundle(root: Path, version: str = "2.0.1-rc.10", body: str = "SYNTHETIC = True\n") -> Path:
    component = _write_tree(root / "hikvision_intercom", version, marker=False, body=body)
    rows = files(component)
    pinned = {"hikvision_intercom/" + r["path"]: r["sha256"] for r in rows}
    tree = hashlib.sha256()
    for name, value in sorted(pinned.items()):
        tree.update(name.encode() + b"\0" + value.encode() + b"\n")
    pin = {"component": "hikvision_intercom", "product_CODE": CODE, "component_version": version, "profile": wv.MANAGED_PROFILE,
           "file_count": len(rows), "files": pinned, "tree_sha256": tree.hexdigest(), "component_digest_recomputed": digest(component)}
    (root / wai.PIN_NAME).write_text(json.dumps(pin), encoding="utf-8")
    return component


def _registry(cfg: Path, entries=("e1", "e2"), minor: int = 2) -> None:
    storage = cfg / ".storage"
    storage.mkdir(exist_ok=True)
    doc = {"data": {"entries": [{"entry_id": e, "domain": "hikvision_intercom", "version": 1, "minor_version": minor} for e in entries]
                    + [{"entry_id": "hue1", "domain": "hue", "version": 1, "minor_version": 1}]}}
    (storage / "core.config_entries").write_text(json.dumps(doc), encoding="utf-8")
    (storage / "core.device_registry").write_text('{"data": {"devices": []}}', encoding="utf-8")
    (storage / "core.entity_registry").write_text('{"data": {"entities": []}}', encoding="utf-8")
    (storage / "hikvision_intercom.stations").write_text('{"data": {}}', encoding="utf-8")


def tree_state(path: Path) -> str | None:
    """Names + bytes of everything under `path` (lstat only), None when absent."""
    if not path.exists():
        return None
    h = hashlib.sha256()
    for p in sorted(path.rglob("*")):
        rel = p.relative_to(path).as_posix()
        h.update((("D" if p.is_dir() else "F") + rel).encode() + b"\0" + (p.read_bytes() if p.is_file() else b"") + b"\n")
    return h.hexdigest()


class FakePlatform:
    """The Supervisor + Core: a running flag, stop / start behaviours, a backup list, a Core gate verdict and a registry snapshot derived
    from the fake config tree (an entry is `setup_error` while the installed component's version is in `broken`)."""

    def __init__(self, cfg: Path) -> None:
        self.cfg = cfg
        self.running = True
        self.stop_mode = "ok"      # ok | refuse | ignore (answers ok, keeps running)
        self.start_mode = "ok"     # ok | fail
        self.gate: dict[str, Any] = {"state": "supported", "code": None}
        self.backup_rows: list[dict[str, Any]] | None = [{"slug": "b1", "type": "full", "date": "2029-12-31T23:00:00+00:00",
                                                          "content": {"homeassistant": True, "addons": [], "folders": []}}]
        self.broken: set[str] = set()
        self.calls: list[str] = []
        self.tree_when: dict[str, str | None] = {}

    def _tree(self) -> str | None:
        return tree_state(self.cfg / "custom_components" / "hikvision_intercom")

    def configured(self) -> bool:
        return True

    def core_api_up(self) -> bool:
        return self.running

    def stop_core(self) -> str:
        self.calls.append("stop")
        self.tree_when["stop"] = self._tree()
        if self.stop_mode == "refuse":
            return "error"
        if self.stop_mode == "ok":
            self.running = False
        return "ok"

    def start_core(self) -> str:
        self.calls.append("start")
        self.tree_when.setdefault("first_start", self._tree())
        if self.start_mode == "fail":
            return "error"
        self.running = True
        return "ok"

    def backups(self) -> list[dict[str, Any]] | None:
        self.calls.append("backups")
        return self.backup_rows

    def core_gate(self) -> dict[str, Any]:
        self.calls.append("gate")
        return self.gate

    def snapshot(self) -> dict[str, Any] | None:
        assert self.running, "the registry is read only while Core runs"
        try:
            doc = json.loads((self.cfg / ".storage" / "core.config_entries").read_text(encoding="utf-8"))
        except OSError:
            return None
        target = self.cfg / "custom_components" / "hikvision_intercom"
        try:
            version = json.loads((target / "manifest.json").read_text(encoding="utf-8"))["version"]
        except OSError:
            version = None
        state = "setup_error" if version in self.broken else "loaded"
        ids = [e["entry_id"] for e in doc["data"]["entries"] if e["domain"] == "hikvision_intercom"]
        entries = [{"entry_id": e, "domain": "hikvision_intercom", "state": state} for e in ids]
        devices = [{"id": "dev-" + e, "config_entries": [e]} for e in ids]
        entities = [{"entity_id": "lock." + e, "unique_id": "u-" + e, "device_id": "dev-" + e, "platform": "hikvision_intercom",
                     "config_entry_id": e} for e in ids]
        return wmi.snapshot_from(entries, devices, entities)


@pytest.fixture()
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, client) -> dict[str, Any]:
    cfg = tmp_path / "ha"
    cfg.mkdir()
    (cfg / "configuration.yaml").write_text("", encoding="utf-8")
    _registry(cfg)
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(cfg))
    bundle = _managed_bundle(tmp_path / "image")
    monkeypatch.setenv("SW_NATIVE_SRC", str(bundle))
    wmi._BUNDLE_CACHE.update(key=None, value=None)
    manual_dir = _write_tree(tmp_path / "ref" / "manual", "2.0.1-rc.10", marker=True)
    known = (
        {"label": "2.0.1-rc.10", "product_CODE": CODE, "profile": wv.MANUAL_PROFILE, "component_digest": digest(manual_dir)},
        {"label": "2.0.1-rc.10", "product_CODE": CODE, "profile": wv.MANAGED_PROFILE, "component_digest": digest(bundle)},
    )
    monkeypatch.setattr(wv, "_known", lambda: known)
    platform = FakePlatform(cfg)
    monkeypatch.setattr(wmi, "PLATFORM", lambda _settings: platform)
    monkeypatch.setattr(wmi, "SPAWN", lambda fn: fn())
    clock = {"t": 0.0}
    monkeypatch.setattr(wmi, "CLOCK", lambda: clock["t"])
    monkeypatch.setattr(wmi, "SLEEP", lambda s: clock.__setitem__("t", clock["t"] + s))
    monkeypatch.setattr(wmi, "WALL", lambda: WALL0 + clock["t"])
    return {"cfg": cfg, "bundle": bundle, "platform": platform, "client": client, "db": client.app.state.db, "settings": client.app.state.settings,
            "manual_digest": digest(manual_dir), "managed_digest": digest(bundle), "tmp": tmp_path}


def _install_manual(w: dict[str, Any], version: str = "2.0.1-rc.10", *, config_marker: bool = True, body: str = "SYNTHETIC = True\n") -> Path:
    target = _write_tree(w["cfg"] / "custom_components" / "hikvision_intercom", version, marker=True, body=body)
    if config_marker:
        (w["cfg"] / wmi.CONFIG_MARKER).write_text(json.dumps(wmi.MANUAL_PROFILE_DOC), encoding="utf-8")
    return target


def _switch_on(w: dict[str, Any], key: str = "enabled", phrase: str = PHRASE_ON):
    return w["client"].put(API + "/switch", json={"switch": key, "value": "on", "confirm": phrase})


def _audit_rows(db, action: str) -> list[dict[str, Any]]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def _setting(db, key: str) -> str | None:
    with db.connection(mode="read") as conn:
        return get_setting(conn, key)


def _job(w) -> dict[str, Any]:
    return w["client"].get(API).json()["job"]


# ================================================================ the owner switch

def test_the_switches_are_off_by_default_and_the_view_names_no_path(world):
    _install_manual(world)
    body = world["client"].get(API).json()
    assert body["switches"] == {"enabled": "off", "core_risk": "off"}
    assert body["unattended_permitted"] is False, "the unattended path stays closed (policy B)"
    assert body["installed"]["ownership"] == "manual" and body["installed"]["markers"] == {"component": "manual", "config": "manual"}
    assert body["plan"] == "convert" and body["runnable"] is False and body["adoptable"] is True
    text = json.dumps(body, ensure_ascii=False)
    assert str(world["cfg"]) not in text and str(world["tmp"]) not in text and "/homeassistant" not in text


@pytest.mark.parametrize("confirm", [None, "", "on", "מאשר", PHRASE_ON + "!", PHRASE_RISK])
def test_on_needs_the_exact_typed_phrase(world, confirm):
    r = world["client"].put(API + "/switch", json={"switch": "enabled", "value": "on", "confirm": confirm})
    assert r.status_code == 422 and r.json()["code"] == "confirmation_required", r.text
    assert _setting(world["db"], wmi.K_ENABLED) is None
    (row,) = _audit_rows(world["db"], "settings.changed")
    assert row["decision"] == "denied" and row["reason"] == "confirmation_required"


@pytest.mark.parametrize("value", ["ON", "true", "1", "yes", ""])
def test_a_value_other_than_off_or_on_is_refused(world, value):
    r = world["client"].put(API + "/switch", json={"switch": "enabled", "value": value, "confirm": PHRASE_ON})
    assert r.status_code == 422 and _setting(world["db"], wmi.K_ENABLED) is None


def test_on_with_the_phrase_is_written_audited_and_installs_nothing(world):
    _install_manual(world)
    before = tree_state(world["cfg"])
    r = _switch_on(world)
    assert r.status_code == 200 and r.json()["switches"]["enabled"] == "on", r.text
    rows = [r for r in _audit_rows(world["db"], "settings.changed") if r["decision"] == "allowed"]
    assert [json.loads(r["details_json"]) for r in rows] == [{"key": wmi.K_ENABLED, "before": "off", "after": "on"}]
    assert tree_state(world["cfg"]) == before and world["platform"].calls == [], "switching on stops, swaps and reads nothing"


def test_the_risk_switch_needs_the_managed_switch_and_its_own_phrase_and_goes_off_with_it(world):
    assert _switch_on(world, "core_risk", PHRASE_RISK).status_code == 409
    assert _switch_on(world).status_code == 200
    assert _switch_on(world, "core_risk", PHRASE_ON).status_code == 422
    assert _switch_on(world, "core_risk", PHRASE_RISK).json()["switches"] == {"enabled": "on", "core_risk": "on"}
    r = world["client"].put(API + "/switch", json={"switch": "enabled", "value": "off"})
    assert r.status_code == 200 and r.json()["switches"] == {"enabled": "off", "core_risk": "off"}


def test_a_non_system_admin_is_refused(world, settings):
    bind(world["client"], settings, "otto", "site_admin", "installation", "*")
    for method, path, body in (("get", API, None), ("put", API + "/switch", {"switch": "enabled", "value": "on", "confirm": PHRASE_ON}),
                               ("post", API + "/adopt", {"confirm": wmi.ADOPT_PHRASE}), ("post", API + "/upgrade", None),
                               ("post", API + "/rollback", None), ("post", API + "/check", None)):
        r = getattr(world["client"], method)(path, headers=as_user("otto"), **({"json": body} if body is not None else {}))
        assert r.status_code == 403, (path, r.text)
    assert _setting(world["db"], wmi.K_ENABLED) is None and world["platform"].calls == []


@pytest.mark.parametrize("stored", [None, "", "ON", "true", " on", "null"])
def test_missing_or_any_value_but_on_reads_off(world, stored):
    if stored is not None:
        with world["db"].connection() as conn:
            set_setting(conn, wmi.K_ENABLED, stored)
    with world["db"].connection(mode="read") as conn:
        assert wmi.enabled(conn) is False


def test_no_code_path_writes_the_managed_switches_except_the_owners_writer():
    """Static, same style as policy B's test_1b: K_ENABLED / K_RISK are written by one function only (`set_switch`, behind
    `check_switch`), and only the owner's route calls it. The policy-B check of `wiskey.auto_install` stays as it is."""
    call = re.compile(r"set_setting\(([^()]|\([^()]*\))*\)", re.S)
    text = (PACKAGE / "services" / "wiskey_managed_install.py").read_text(encoding="utf-8")
    body = text[text.index("def set_switch("):text.index("# ---------------------------------------------------------------- the bundle")]
    offenders = []
    for path in PACKAGE.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        for m in call.finditer(source):
            args = m.group(0)
            if re.search(r"K_ENABLED|K_RISK|wiskey\.managed\.(enabled|core_risk)", args):
                # the one named write allowed: inside set_switch, the accepted-risk switch going OFF with the managed switch
                if not (path.name == "wiskey_managed_install.py" and args == 'set_setting(conn, K_RISK, "off")' and args in body):
                    offenders.append(f"{path.relative_to(BACKEND).as_posix()}: {args[:80]}")
    assert offenders == []  # set_switch writes ON only by the closed list (`k`) behind check_switch, never by naming the key
    assert text.count('set_setting(conn, K_RISK, "off")') == 1
    assert body.index("check_switch(conn, key, value, confirm)") < body.index("set_setting(")
    users = sorted(p.relative_to(BACKEND).as_posix() for p in PACKAGE.rglob("*.py")
                   if re.search(r"\b(wmi|wiskey_managed_install)\.set_switch\(", p.read_text(encoding="utf-8")))
    assert users == ["smplwise/routers/wiskey_managed.py"]  # other modules' own `set_switch` functions are unrelated
    other = [p.relative_to(BACKEND).as_posix() for p in PACKAGE.rglob("*.py")
             if "wiskey.managed.enabled" in p.read_text(encoding="utf-8") and p.name != "wiskey_managed_install.py"]
    assert other == []
    assert wai.OWNER_ON_PERMITTED is False, "the unattended path's build constant is unchanged"


def test_the_managed_state_is_never_exported_or_restored():
    for key in (wmi.K_ENABLED, wmi.K_RISK, wmi.K_ADOPTION, wmi.K_JOB, wmi.K_INSTALLED):
        assert backup._kept_setting(key)


def test_the_supervisor_allow_list_gains_exactly_three_calls_and_never_creates_a_backup():
    assert {("GET", "/backups"), ("POST", "/core/stop"), ("POST", "/core/start")} <= self_update.ALLOWED
    for method, path in (("POST", "/backups/new/full"), ("POST", "/backups/new/partial"), ("POST", "/backups/b1/restore/full"),
                         ("GET", "/backups/b1/download"), ("POST", "/core/rebuild")):
        with pytest.raises(self_update.ProbeRefused):
            self_update.check_allowed(method, path)
    with pytest.raises(self_update.ProbeRefused):
        self_update.check_allowed("POST", "/core/stop", {"x": 1})


# ================================================================ manual markers and adoption

def test_a_manual_install_is_never_replaced_before_adoption(world):
    target = _install_manual(world)
    before = tree_state(world["cfg"])
    _switch_on(world)
    r = world["client"].post(API + "/upgrade")
    assert r.status_code == 409 and r.json()["code"] == "adoption_required", r.text
    assert tree_state(world["cfg"]) == before and world["platform"].calls == []
    assert bridge_install._manual_owner_profile(world["cfg"]) and (target / wmi.COMPONENT_MARKER).exists()
    (row,) = _audit_rows(world["db"], "wiskey.managed.run_started")
    assert row["decision"] == "denied" and row["reason"] == "adoption_required"


def test_adoption_needs_the_switch_and_the_phrase(world):
    _install_manual(world)
    assert world["client"].post(API + "/adopt", json={"confirm": wmi.ADOPT_PHRASE}).json()["code"] == "managed_off"
    _switch_on(world)
    r = world["client"].post(API + "/adopt", json={"confirm": "כן"})
    assert r.status_code == 422 and r.json()["code"] == "confirmation_required"
    assert _setting(world["db"], wmi.K_ADOPTION) is None


def test_adoption_backs_up_records_audits_and_changes_nothing_in_the_config_tree(world):
    _install_manual(world)
    _switch_on(world)
    before = tree_state(world["cfg"])
    r = world["client"].post(API + "/adopt", json={"confirm": wmi.ADOPT_PHRASE})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["installed"]["ownership"] == "adopted" and body["runnable"] is True and body["plan"] == "convert"
    assert tree_state(world["cfg"]) == before, "adoption writes nothing into the config tree; the markers stay until the swap"
    record = json.loads(_setting(world["db"], wmi.K_ADOPTION))
    assert record["digest"] == world["manual_digest"] and record["markers"] == {"component": "manual", "config": "manual"}
    backup_dir = Path(world["settings"].data_dir) / "wiskey-managed" / "backups" / record["backup"]
    assert digest(backup_dir / "component") == world["manual_digest"]
    assert sorted(p.name for p in (backup_dir / "markers").iterdir()) == sorted([wmi.COMPONENT_MARKER, wmi.CONFIG_MARKER])
    assert sorted(p.name for p in (backup_dir / "storage").iterdir()) == ["core.config_entries", "core.device_registry",
                                                                          "core.entity_registry", "hikvision_intercom.stations"]
    (row,) = _audit_rows(world["db"], "wiskey.managed.adopt")
    details = json.loads(row["details_json"])
    assert row["decision"] == "allowed" and details["config_written"] is False and details["digest"] == world["manual_digest"]
    assert world["client"].post(API + "/adopt", json={"confirm": wmi.ADOPT_PHRASE}).json()["code"] == "already_adopted"
    assert world["platform"].calls == []


def test_an_unknown_tree_is_never_adopted(world):
    _install_manual(world, body="EDITED BY HAND\n")  # markers are fine, but the bytes are no known tree
    _switch_on(world)
    before = tree_state(world["cfg"])
    r = world["client"].post(API + "/adopt", json={"confirm": wmi.ADOPT_PHRASE})
    assert r.status_code == 409 and r.json()["code"] == "installed_tree_not_recognized", r.text
    assert tree_state(world["cfg"]) == before and _setting(world["db"], wmi.K_ADOPTION) is None


def test_a_marker_with_other_content_is_refused(world):
    _install_manual(world)
    (world["cfg"] / wmi.CONFIG_MARKER).write_text(json.dumps({**wmi.MANUAL_PROFILE_DOC, "automatic_authority": True}), encoding="utf-8")
    _switch_on(world)
    body = world["client"].get(API).json()
    assert body["installed"]["ownership"] == "marker_invalid" and body["adoptable"] is False
    assert world["client"].post(API + "/adopt", json={"confirm": wmi.ADOPT_PHRASE}).json()["code"] == "manual_marker_invalid"
    assert world["client"].post(API + "/upgrade").json()["code"] == "installed_tree_not_recognized"


def test_a_tree_changed_after_adoption_needs_a_new_adoption(world):
    target = _install_manual(world)
    _switch_on(world)
    world["client"].post(API + "/adopt", json={"confirm": wmi.ADOPT_PHRASE})
    (target / "core.py").write_text("CHANGED = True\n", encoding="utf-8")
    r = world["client"].post(API + "/upgrade")
    assert r.status_code == 409 and r.json()["code"] == "adoption_required" and world["platform"].calls == []


# ================================================================ the runs

def _adopted(world) -> None:
    _install_manual(world)
    _switch_on(world)
    assert world["client"].post(API + "/adopt", json={"confirm": wmi.ADOPT_PHRASE}).status_code == 200


STEPS_OK = ["preflight", "core_gate", "backup_check", "snapshot_before", "stop_core", "backup_local", "swap", "start_core", "verify"]


def test_convert_succeeds_swaps_only_while_core_is_stopped_and_handles_the_markers(world):
    _adopted(world)
    r = world["client"].post(API + "/upgrade")
    assert r.status_code == 202, r.text
    job = _job(world)
    assert job["state"] == "succeeded" and job["kind"] == "convert" and job["code"] is None
    assert [s["name"] for s in job["steps"]] == STEPS_OK and all(s["state"] == "done" for s in job["steps"])
    assert (job["from_version"], job["to_version"]) == ("2.0.1-rc.10", "2.0.1-rc.10")
    p = world["platform"]
    assert p.calls == ["gate", "backups", "stop", "start"] and p.running
    assert p.tree_when["stop"] != p.tree_when["first_start"], "the tree changed between stop and start - never while Core ran"
    target = world["cfg"] / "custom_components" / "hikvision_intercom"
    assert digest(target) == world["managed_digest"] and not (target / wmi.COMPONENT_MARKER).exists()
    assert not (world["cfg"] / wmi.CONFIG_MARKER).exists(), "the config-level marker left the config dir"
    stage = world["cfg"] / wmi.STAGE_ROOT / job["id"]
    assert (stage / "markers" / wmi.CONFIG_MARKER).is_file(), "...moved into the stage, never deleted"
    assert digest(stage / "previous") == world["manual_digest"]
    assert not bridge_install._manual_owner_profile(world["cfg"]), "the unattended writers' manual profile is gone after the conversion"
    view = world["client"].get(API).json()
    assert view["installed"]["ownership"] == "arx_managed" and view["plan"] == "up_to_date" and view["rollback_available"] is True
    assert json.loads(_setting(world["db"], wmi.K_INSTALLED))["digest"] == world["managed_digest"]
    assert [r["decision"] for r in _audit_rows(world["db"], "wiskey.managed.run")] == ["allowed"]
    assert world["client"].post(API + "/upgrade").json()["code"] == "plan_refused", "nothing more to do"


def test_failure_after_start_rolls_back_automatically(world):
    _adopted(world)
    # the manual tree is rc.10 too: make only the NEW tree break by giving the bundle a newer version
    shutil.rmtree(world["bundle"].parent)
    _managed_bundle(world["bundle"].parent, version="2.0.1-rc.11")
    wmi._BUNDLE_CACHE.update(key=None, value=None)
    world["platform"].broken = {"2.0.1-rc.11"}
    assert world["client"].post(API + "/upgrade").status_code == 202
    job = _job(world)
    assert job["kind"] == "upgrade" and job["state"] == "rolled_back" and job["code"] == "entry_not_loaded"
    names = [s["name"] for s in job["steps"]]
    assert names == [*STEPS_OK, "stop_core", "rollback", "start_core_after_rollback", "verify_after_rollback"]
    assert [s["state"] for s in job["steps"]][-4:] == ["done", "done", "done", "done"]
    target = world["cfg"] / "custom_components" / "hikvision_intercom"
    assert digest(target) == world["manual_digest"] and (target / wmi.COMPONENT_MARKER).exists()
    assert (world["cfg"] / wmi.CONFIG_MARKER).is_file(), "the config-level marker is back"
    assert world["platform"].running and world["platform"].calls == ["gate", "backups", "stop", "start", "stop", "start"]
    assert job["storage_restored"] is False, "the entry schema did not change: code-only rollback"
    assert _setting(world["db"], wmi.K_INSTALLED) in (None, "", "null")
    assert [r["reason"] for r in _audit_rows(world["db"], "wiskey.managed.run")] == ["entry_not_loaded"]


def test_a_rollback_restores_the_registry_only_when_the_entry_schema_changed(world, monkeypatch):
    _adopted(world)
    shutil.rmtree(world["bundle"].parent)
    _managed_bundle(world["bundle"].parent, version="2.0.1-rc.11")
    wmi._BUNDLE_CACHE.update(key=None, value=None)
    p = world["platform"]
    p.broken = {"2.0.1-rc.11"}
    original_start = p.start_core

    def start_and_migrate() -> str:  # the new component migrates the entry schema on its first start
        if p.calls.count("start") == 0:
            _registry(world["cfg"], minor=3)
        return original_start()

    monkeypatch.setattr(p, "start_core", start_and_migrate)
    world["client"].post(API + "/upgrade")
    job = _job(world)
    assert job["state"] == "rolled_back" and job["storage_restored"] is True
    doc = json.loads((world["cfg"] / ".storage" / "core.config_entries").read_text(encoding="utf-8"))
    assert {e["minor_version"] for e in doc["data"]["entries"] if e["domain"] == "hikvision_intercom"} == {2}


def test_a_downgrade_is_refused_before_anything_is_touched(world, monkeypatch):
    _install_manual(world, version="2.0.2")
    # make the newer manual tree a known one so it can be adopted
    known = (*wv._known(), {"label": "2.0.2", "product_CODE": CODE, "profile": wv.MANUAL_PROFILE,
                            "component_digest": digest(world["cfg"] / "custom_components" / "hikvision_intercom")})
    monkeypatch.setattr(wv, "_known", lambda: known)
    _switch_on(world)
    assert world["client"].post(API + "/adopt", json={"confirm": wmi.ADOPT_PHRASE}).status_code == 200
    before = tree_state(world["cfg"])
    r = world["client"].post(API + "/upgrade")
    assert r.status_code == 409 and r.json()["code"] == "plan_refused" and r.json()["details"]["plan"] == "downgrade_refused", r.text
    assert tree_state(world["cfg"]) == before and world["platform"].calls == []
    assert world["client"].get(API).json()["plan"] == "downgrade_refused"


def test_core_that_does_not_stop_aborts_without_touching_the_tree(world):
    _adopted(world)
    world["platform"].stop_mode = "ignore"
    before = tree_state(world["cfg"])
    world["client"].post(API + "/upgrade")
    job = _job(world)
    assert job["state"] == "aborted" and job["code"] == "core_did_not_stop"
    assert job["steps"][-1] == {**job["steps"][-1], "name": "stop_core", "state": "failed", "code": "core_did_not_stop"}
    assert tree_state(world["cfg"]) == before and world["platform"].calls == ["gate", "backups", "stop"]
    assert world["platform"].running


def test_a_refused_stop_aborts(world):
    _adopted(world)
    world["platform"].stop_mode = "refuse"
    before = tree_state(world["cfg"])
    world["client"].post(API + "/upgrade")
    assert _job(world)["code"] == "core_stop_refused" and tree_state(world["cfg"]) == before


@pytest.mark.parametrize("rows,code", [
    (None, "backups_unreadable"),
    ([], "full_backup_missing"),
    ([{"type": "partial", "date": "2029-12-31T23:00:00+00:00", "content": {"homeassistant": True}}], "full_backup_missing"),
    ([{"type": "full", "date": "2029-12-31T23:00:00+00:00", "content": {"homeassistant": False}}], "full_backup_missing"),
    ([{"type": "full", "date": "2029-12-30T23:00:00+00:00", "content": {"homeassistant": True}}], "full_backup_stale"),
    ([{"type": "full", "date": "not a date", "content": {"homeassistant": True}}], "full_backup_missing"),
])
def test_no_recent_full_backup_aborts_before_core_is_stopped(world, rows, code):
    _adopted(world)
    world["platform"].backup_rows = rows
    before = tree_state(world["cfg"])
    world["client"].post(API + "/upgrade")
    job = _job(world)
    assert job["state"] == "aborted" and job["code"] == code and "stop" not in world["platform"].calls
    assert tree_state(world["cfg"]) == before


@pytest.mark.parametrize("gate,risk,outcome", [
    ({"state": "unverified", "code": "core_runtime_provenance_unavailable"}, False, ("aborted", "core_gate_unverified")),
    ({"state": "unverified", "code": "core_runtime_provenance_unavailable"}, True, ("succeeded", None)),
    ({"state": "unsupported", "code": "core_runtime_unsupported"}, True, ("aborted", "core_runtime_unsupported")),
    ({"state": "refused", "code": "core_runtime_observation_invalid"}, True, ("aborted", "core_runtime_observation_invalid")),
    ({"state": "unavailable", "code": "core_runtime_bootstrap_unavailable"}, True, ("aborted", "core_runtime_bootstrap_unavailable")),
    (None, True, ("aborted", "core_runtime_unavailable")),
])
def test_the_core_gate_and_the_accepted_risk_switch(world, gate, risk, outcome):
    _adopted(world)
    if risk:
        assert _switch_on(world, "core_risk", PHRASE_RISK).status_code == 200
    world["platform"].gate = gate
    world["client"].post(API + "/upgrade")
    job = _job(world)
    assert (job["state"], job["code"]) == outcome
    assert job["risk_accepted"] is (outcome[0] == "succeeded" and (gate or {}).get("state") == "unverified")
    if outcome[0] == "aborted":
        assert "stop" not in world["platform"].calls


def test_the_owners_rollback_puts_the_manual_tree_and_markers_back(world):
    _adopted(world)
    world["client"].post(API + "/upgrade")
    assert _job(world)["state"] == "succeeded"
    world["platform"].calls.clear()
    r = world["client"].post(API + "/rollback")
    assert r.status_code == 202, r.text
    job = _job(world)
    assert job["kind"] == "rollback" and job["state"] == "succeeded", job
    assert [s["name"] for s in job["steps"]] == ["preflight", "snapshot_before", "stop_core", "backup_local", "swap", "start_core", "verify"]
    target = world["cfg"] / "custom_components" / "hikvision_intercom"
    assert digest(target) == world["manual_digest"] and (world["cfg"] / wmi.CONFIG_MARKER).is_file()
    assert world["platform"].calls == ["stop", "start"]
    view = world["client"].get(API).json()
    assert view["installed"]["ownership"] == "adopted" and view["rollback_available"] is False and view["plan"] == "convert"
    assert world["client"].post(API + "/rollback").json()["code"] == "rollback_unavailable"


def test_a_fresh_install_and_a_core_that_does_not_come_back(world):
    _switch_on(world)
    assert world["client"].get(API).json()["plan"] == "install"
    world["platform"].start_mode = "fail"
    world["client"].post(API + "/upgrade")
    job = _job(world)
    assert job["kind"] == "install" and job["state"] == "rollback_failed" and job["code"] == "core_start_refused"
    assert not (world["cfg"] / "custom_components" / "hikvision_intercom").exists(), "the fresh tree was taken out again"
    world["platform"].start_mode = "ok"
    world["platform"].running = True
    world["client"].post(API + "/upgrade")
    job = _job(world)
    assert job["state"] == "succeeded" and digest(world["cfg"] / "custom_components" / "hikvision_intercom") == world["managed_digest"]


def test_one_run_at_a_time(world):
    _adopted(world)
    with world["db"].write_aside() as conn:
        set_setting(conn, wmi.K_JOB, json.dumps({"id": "20300101T000000Z-abcdef", "state": "running", "kind": "convert", "steps": []}))
    r = world["client"].post(API + "/upgrade")
    assert r.status_code == 409 and r.json()["code"] == "job_running"
    assert wmi._RUN_LOCK.acquire(blocking=False)
    try:
        with pytest.raises(wmi.ManagedRefused) as exc:
            wmi.start(world["db"], world["settings"], "forward")
        assert exc.value.code == "job_running"
    finally:
        wmi._RUN_LOCK.release()


def test_the_dry_run_check_lists_every_verdict_and_changes_nothing(world):
    _adopted(world)
    world["platform"].gate = {"state": "unverified", "code": "core_runtime_provenance_unavailable"}
    world["platform"].backup_rows = []
    before = tree_state(world["cfg"])
    body = world["client"].post(API + "/check").json()
    assert body["plan"] == "convert" and body["ready"] is False
    assert {i["name"]: (i["state"], i["code"]) for i in body["items"]} == {
        "preflight": ("pass", None), "core_gate": ("fail", "core_gate_unverified"), "backup_check": ("fail", "full_backup_missing")}
    assert tree_state(world["cfg"]) == before and "stop" not in world["platform"].calls and _job(world) is None


def test_recovery_after_an_arx_restart_mid_run_never_leaves_core_stopped(world):
    _adopted(world)
    target = world["cfg"] / "custom_components" / "hikvision_intercom"
    job_id = "20300101T000000Z-abcdef"
    stage = world["cfg"] / wmi.STAGE_ROOT / job_id
    stage.mkdir(parents=True)
    target.rename(stage / "previous")  # the crash hit between the two renames
    world["platform"].running = False
    with world["db"].write_aside() as conn:
        set_setting(conn, wmi.K_JOB, json.dumps({"id": job_id, "state": "running", "kind": "convert", "steps": [], "rollback_of": None}))
    assert wmi.recover_interrupted(world["db"], world["settings"]) == "interrupted"
    assert digest(target) == world["manual_digest"] and world["platform"].running and world["platform"].calls == ["start"]
    job = _job(world)
    assert job["state"] == "interrupted" and job["code"] == "arx_restarted"
    assert wmi.recover_interrupted(world["db"], world["settings"]) is None, "nothing left to recover"


def test_an_invalid_shipped_bundle_is_refused(world):
    _adopted(world)
    (world["bundle"] / "core.py").write_text("TAMPERED = True\n", encoding="utf-8")
    wmi._BUNDLE_CACHE.update(key=None, value=None)
    body = world["client"].get(API).json()
    assert body["bundle"]["state"] == "bundle_invalid" and body["runnable"] is False
    r = world["client"].post(API + "/upgrade")
    assert r.status_code == 409 and r.json()["code"] == "bundle_invalid" and world["platform"].calls == []
