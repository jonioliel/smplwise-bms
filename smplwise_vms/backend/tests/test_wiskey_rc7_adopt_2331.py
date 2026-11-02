"""WISKEY-RC7-ADOPT-2331: the Arx side of the WisKey Mac rc.7 adoption, with owner decision 1B (01.11).

1. Section 8a "how do we prove an existing installation is never overwritten": four fixtures - (a) a manual install, (b) a foreign
   tree, (c) a bad managed pin, (d) a valid managed bundle with the switch off - each asserts that the digest of the component
   directory is the same before and after, that no backup / temporary tree appears, and that a refusal audit row exists.
2. Decision 1B: no code path turns `wiskey.auto_install` on.
3. rc.7 row 5: the generation fence is a publication fence only, and refuses explicitly (`generation_fence_unsupported`) without fcntl.
4. rc.7 rows 1 + 6: the post-approval relay map sync - nothing without the owner's switch, commit before I/O, audited outcome, no retry,
   a failure never undoes the approval; `prepare_quiesced` has no production caller (maintenance_v1 is NOT_BUILT).

Synthetic bundles, a fake direct port and real SQLite only; no HA, no WisKey, no station, no door. Symlink fixtures need POSIX and
skip on Windows (runner)."""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from smplwise.db import Database, get_setting, set_setting
from smplwise.services import wiskey_auto_install as install
from smplwise.services import wiskey_native_projection as projection
from smplwise.services.wiskey_distribution_digest import digest, files

BACKEND = Path(__file__).resolve().parents[1]
PACKAGE = BACKEND / "smplwise"
posix_only = pytest.mark.skipif(sys.platform == "win32" or not hasattr(os, "symlink"), reason="symlink fixtures need POSIX (runner)")
needs_fcntl = pytest.mark.skipif(not projection.fence_supported(), reason="flock needs POSIX fcntl (runner)")


# ---------------------------------------------------------------- helpers

def _pin(component: Path, *, profile: str | None = install.MANAGED_PROFILE) -> dict[str, Any]:
    rows = files(component)
    pinned = {"hikvision_intercom/" + r["path"]: r["sha256"] for r in rows}
    tree = hashlib.sha256()
    for name, value in sorted(pinned.items()):
        tree.update(name.encode() + b"\0" + value.encode() + b"\n")
    pin: dict[str, Any] = {"files": pinned, "tree_sha256": tree.hexdigest(), "product_CODE": "b" * 40, "file_count": len(rows),
                           "component_digest_recomputed": digest(component)}
    if profile is not None:
        pin["profile"] = profile
    return pin


def make_bundle(root: Path, version: str = "2.0.1-rc.7", body: str = "synthetic managed source\n") -> Path:
    component = root / "hikvision_intercom"
    component.mkdir(parents=True)
    (component / "manifest.json").write_text(json.dumps({"domain": "hikvision_intercom", "version": version}))
    (component / "synthetic.txt").write_text(body)
    (root / install.PIN_NAME).write_text(json.dumps(_pin(component)))
    return component


def tree_digest(path: Path) -> str | None:
    """Every entry under `path` (names, link targets, file bytes) - lstat only, a link is never followed. None: absent."""
    if not os.path.lexists(path):
        return None
    h = hashlib.sha256()
    entries = [path, *sorted(path.rglob("*"))] if path.is_dir() and not path.is_symlink() else [path]
    for p in entries:
        rel = p.relative_to(path).as_posix() if p != path else "."
        if p.is_symlink():
            h.update(b"L" + rel.encode() + b"\0" + os.readlink(p).encode() + b"\n")
        elif p.is_dir():
            h.update(b"D" + rel.encode() + b"\n")
        else:
            h.update(b"F" + rel.encode() + b"\0" + hashlib.sha256(p.read_bytes()).hexdigest().encode() + b"\n")
    return h.hexdigest()


def siblings(cfg: Path) -> list[str]:
    cc = cfg / "custom_components"
    return sorted(p.name for p in cc.iterdir()) if cc.is_dir() else []


def refusals(db: Database) -> list[dict[str, Any]]:
    with db.connection(mode="read") as c:
        rows = c.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (install.AUDIT_NATIVE_REFUSED,)).fetchall()
        return [dict(r) for r in rows]


def switch(db: Database) -> str | None:
    with db.connection(mode="read") as c:
        return get_setting(c, install.SWITCH_KEY)


@pytest.fixture
def database(tmp_path: Path) -> Database:
    db = Database(tmp_path / "synthetic.sqlite")
    db.migrate()
    return db


@pytest.fixture
def bundle(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    component = make_bundle(tmp_path / "integration")
    monkeypatch.setenv("SW_NATIVE_SRC", str(component))
    monkeypatch.delenv("SW_HA_CONFIG_DIR", raising=False)
    install.NATIVE.update(state="off", code=None, version=None, restart=None)
    return component


def _owned_previous_tree(tmp_path: Path, cfg: Path, db: Database) -> Path:
    """An older tree that Arx itself staged (its digest is STAGED_DIGEST_KEY)."""
    old = make_bundle(tmp_path / "older", version="2.0.1-rc.6", body="synthetic previous managed source\n")
    target = cfg / "custom_components" / "hikvision_intercom"
    shutil.copytree(old, target)
    with db.connection() as c:
        set_setting(c, install.STAGED_DIGEST_KEY, install.source_digest(target))
    return target


def _set_switch(db: Database, on: bool) -> None:
    if on:
        with db.connection() as c:
            set_setting(c, install.SWITCH_KEY, "on")


# ---------------------------------------------------------------- 1. section 8a: no overwrite, refusal audited

def _fixture_manual_component_marker(tmp_path: Path, cfg: Path, db: Database, source: Path) -> None:
    target = cfg / "custom_components" / "hikvision_intercom"
    target.mkdir(parents=True)
    (target / "_manual_upgrade_profile.json").write_text('{"synthetic": "manual"}')
    (target / "manual_payload.py").write_bytes(b"# synthetic manual install - must be preserved\n")


def _fixture_manual_config_marker(tmp_path: Path, cfg: Path, db: Database, source: Path) -> None:
    (cfg / "hikvision_intercom_manual_upgrade.json").write_text('{"synthetic": "manual"}')
    _owned_previous_tree(tmp_path, cfg, db)  # even an Arx-staged tree is left alone under the owner's manual profile


def _fixture_foreign_tree(tmp_path: Path, cfg: Path, db: Database, source: Path) -> None:
    target = cfg / "custom_components" / "hikvision_intercom"
    target.mkdir(parents=True)
    (target / "manifest.json").write_text(json.dumps({"domain": "hikvision_intercom", "version": "2.0.1-rc.5"}))
    (target / "foreign.py").write_bytes(b"# synthetic tree someone else installed\n")
    with db.connection() as c:
        set_setting(c, install.STAGED_DIGEST_KEY, "0" * 64)  # Arx staged something else


def _fixture_foreign_identical_tree(tmp_path: Path, cfg: Path, db: Database, source: Path) -> None:
    shutil.copytree(source, cfg / "custom_components" / "hikvision_intercom")  # byte-identical, but never staged by Arx


def _fixture_bad_pin(tmp_path: Path, cfg: Path, db: Database, source: Path) -> None:
    _owned_previous_tree(tmp_path, cfg, db)
    pin_path = source.parent / install.PIN_NAME
    pin = json.loads(pin_path.read_text())
    pin["component_digest_recomputed"] = "f" * 64  # the per-file pin still matches; the managed digest does not
    pin_path.write_text(json.dumps(pin))


def _fixture_bad_pin_bytes(tmp_path: Path, cfg: Path, db: Database, source: Path) -> None:
    _owned_previous_tree(tmp_path, cfg, db)
    (source / "synthetic.txt").write_text("changed after the pin\n")


def _fixture_valid_managed(tmp_path: Path, cfg: Path, db: Database, source: Path) -> None:
    _owned_previous_tree(tmp_path, cfg, db)  # a valid, Arx-owned older tree: with the switch on it WOULD be replaced


CASES = [
    ("manual_component_marker", _fixture_manual_component_marker, "manual_install_present", "native_foreign_installed"),
    ("manual_config_marker", _fixture_manual_config_marker, "manual_install_present", "native_foreign_installed"),
    ("foreign_tree", _fixture_foreign_tree, "foreign_install_present", "native_foreign_installed"),
    ("foreign_identical_tree", _fixture_foreign_identical_tree, "foreign_install_present", "native_foreign_installed"),
    ("bad_pin_managed_digest", _fixture_bad_pin, "pin_mismatch", "native_pin_mismatch"),
    ("bad_pin_bytes", _fixture_bad_pin_bytes, "pin_mismatch", "native_pin_mismatch"),
]


@pytest.mark.parametrize("switch_on", [False, True], ids=["switch_off", "switch_on"])
@pytest.mark.parametrize("name,prepare,reason,code", CASES, ids=[c[0] for c in CASES])
def test_8a_existing_install_is_never_overwritten_and_the_refusal_is_audited(tmp_path, bundle, database, switch_on, name, prepare,
                                                                             reason, code):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    prepare(tmp_path, cfg, database, bundle)
    _set_switch(database, switch_on)
    target = cfg / "custom_components" / "hikvision_intercom"
    before, names_before = tree_digest(target), siblings(cfg)
    staged_before = install._staged_digest(database, None)

    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=True)

    assert tree_digest(target) == before, f"{name}: the component directory changed"
    assert siblings(cfg) == names_before, f"{name}: a backup / temporary tree appeared"
    assert install._staged_digest(database, None) == staged_before
    assert switch(database) == ("on" if switch_on else None)  # never turned on by the installer
    assert answer["restart"] is None
    # WisKey M12 policy B (S2): the honest refused / error state with its code, also with the switch off (was `off` before)
    assert answer["code"] == code and answer["state"] in ("refused", "error"), answer
    (row,) = refusals(database)
    details = json.loads(row["details_json"])
    assert row["decision"] == "denied" and row["reason"] == reason and row["resource_id"] == "hikvision_intercom"
    assert details["code"] == code and details["switch"] == ("on" if switch_on else "off") and details["component_written"] is False
    assert str(cfg) not in row["details_json"] and str(tmp_path) not in row["details_json"]  # codes and digests only


@posix_only
@pytest.mark.parametrize("switch_on", [False, True], ids=["switch_off", "switch_on"])
def test_8a_manual_marker_as_a_dangling_link_is_a_manual_install(tmp_path, bundle, database, switch_on):
    cfg = tmp_path / "ha"
    target = cfg / "custom_components" / "hikvision_intercom"
    target.mkdir(parents=True)
    (target / "_manual_upgrade_profile.json").symlink_to(tmp_path / "missing-manual-profile")
    (target / "manual_payload.py").write_bytes(b"# synthetic manual install\n")
    _set_switch(database, switch_on)
    before = tree_digest(target)
    install.installer_step(database, SimpleNamespace(), cfg, None, restart=True)
    assert tree_digest(target) == before
    (row,) = refusals(database)
    assert row["reason"] == "manual_install_present"


@posix_only
@pytest.mark.parametrize("switch_on", [False, True], ids=["switch_off", "switch_on"])
def test_8a_target_that_is_a_link_or_holds_a_link_is_foreign(tmp_path, bundle, database, switch_on):
    cfg = tmp_path / "ha"
    (cfg / "custom_components").mkdir(parents=True)
    elsewhere = tmp_path / "elsewhere"
    shutil.copytree(bundle, elsewhere)
    (cfg / "custom_components" / "hikvision_intercom").symlink_to(elsewhere, target_is_directory=True)
    _set_switch(database, switch_on)
    before, inside = tree_digest(cfg / "custom_components" / "hikvision_intercom"), tree_digest(elsewhere)
    install.installer_step(database, SimpleNamespace(), cfg, None, restart=True)
    assert tree_digest(cfg / "custom_components" / "hikvision_intercom") == before and tree_digest(elsewhere) == inside
    (row,) = refusals(database)
    assert row["reason"] == "foreign_install_present"


def test_8a_d_valid_managed_bundle_with_the_switch_off_writes_nothing(tmp_path, bundle, database):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    target = _owned_previous_tree(tmp_path, cfg, database)
    before, names_before = tree_digest(target), siblings(cfg)
    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=True)
    assert answer == {"state": "off", "code": None, "version": None, "restart": None}
    assert tree_digest(target) == before and siblings(cfg) == names_before
    assert switch(database) is None
    (row,) = refusals(database)
    assert row["reason"] == "auto_install_off" and json.loads(row["details_json"])["switch"] == "off"
    # the same refusal on the next start-up is not repeated
    install.installer_step(database, SimpleNamespace(), cfg, None, restart=True)
    assert len(refusals(database)) == 1 and tree_digest(target) == before
    # fresh installation (no tree at all): still nothing is created
    shutil.rmtree(cfg / "custom_components")
    install.installer_step(database, SimpleNamespace(), cfg, None, restart=True)
    assert not (cfg / "custom_components").exists() and switch(database) is None


def test_8a_d_after_the_owner_switch_the_owned_tree_is_replaced_with_one_backup(tmp_path, bundle, database, monkeypatch):
    # the positive control of (d): with the owner's switch on, an Arx-owned older tree IS replaced and kept as the one backup.
    # M12 policy B (S2): a managed pin now passes the Core runtime READ gate first; Arx has no image verifier, so the verdict is
    # SYNTHETIC here (tests/test_wiskey_m12_policy_b_native_gate.py proves it is never `supported` without one)
    from smplwise.services import wiskey_core_runtime_gate as gate

    monkeypatch.setattr(gate, "read_core", lambda settings, **_: {"state": "supported", "code": None})
    cfg = tmp_path / "ha"
    cfg.mkdir()
    target = _owned_previous_tree(tmp_path, cfg, database)
    previous = tree_digest(target)
    _set_switch(database, True)
    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert answer["state"] == "staged", answer
    assert digest(target) == digest(bundle)
    assert tree_digest(cfg / "custom_components" / ("hikvision_intercom" + install.BACKUP_SUFFIX)) == previous
    assert refusals(database) == []  # a guarded write that proceeds is not a refusal


def test_8a_bridge_install_under_a_manual_profile_writes_neither_component_and_audits(tmp_path, settings, monkeypatch, bundle):
    from smplwise.main import create_app
    from smplwise.services import bridge_install

    cfg = tmp_path / "ha-bridge"
    cfg.mkdir()
    (cfg / "configuration.yaml").write_text("")
    (cfg / "hikvision_intercom_manual_upgrade.json").write_text('{"synthetic": "manual"}')
    target = cfg / "custom_components" / "hikvision_intercom"
    target.mkdir(parents=True)
    (target / "manual_payload.py").write_bytes(b"# synthetic manual install\n")
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(cfg))
    app = create_app(settings)
    with app.state.db.write_aside() as conn:
        set_setting(conn, install.SWITCH_KEY, "on")
    before, names_before = tree_digest(cfg / "custom_components"), siblings(cfg)
    st = bridge_install.install(app.state.db, settings)
    assert st["last_error"] == "manual_owner_upgrade_profile"
    assert tree_digest(cfg / "custom_components") == before and siblings(cfg) == names_before
    (row,) = refusals(app.state.db)
    assert row["reason"] == "manual_install_present"


# ---------------------------------------------------------------- 2. decision 1B: nothing turns the switch on

def test_1b_no_production_code_turns_the_auto_install_switch_on():
    """Static: no module writes the WisKey switch by name. Inside wiskey_auto_install.py no set_setting names SWITCH_KEY at all; elsewhere
    no set_setting names `wai.SWITCH_KEY` / `wiskey_auto_install.SWITCH_KEY` / the literal key (other modules have their own SWITCH_KEY).
    The owner's generic settings screen writes keys it is given; it never names this one. M12 policy B S1: the owner's ONE writer is
    `wiskey_switches.apply` (closed list, all or nothing) - pinned by test_1b_exactly_one_writer_is_the_owners_switch_route."""
    call = re.compile(r"set_setting\(([^()]|\([^()]*\))*\)", re.S)
    offenders = []
    for path in PACKAGE.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        for m in call.finditer(text):
            args = m.group(0)
            own = path.name == "wiskey_auto_install.py" and re.search(r"\bSWITCH_KEY\b", args)
            other = re.search(r"(wai|wiskey_auto_install|install)\.SWITCH_KEY|[\"']wiskey\.auto_install[\"']", args)
            if own or other:
                offenders.append(f"{path.relative_to(BACKEND).as_posix()}: {args[:80]}")
    assert offenders == []
    assert "_approve_managed_bundle" not in (PACKAGE / "services" / "wiskey_auto_install.py").read_text(encoding="utf-8")


def test_1b_exactly_one_writer_is_the_owners_switch_route():
    """M12 policy B S1: the key is referenced as a writable key by exactly one module (services/wiskey_switches.py: INSTALL_SWITCH =
    wai.SWITCH_KEY), whose only set_setting sits in `apply` behind `check`. Backup's keep list and docstrings only name it. The
    contribution's `SettingsPatch` field is not adopted (a second writer)."""
    ref = re.compile(r"\b(wai|wiskey_auto_install|install)\.SWITCH_KEY\b")
    users = sorted(p.relative_to(BACKEND).as_posix() for p in PACKAGE.rglob("*.py")
                   if p.name != "wiskey_auto_install.py" and ref.search(p.read_text(encoding="utf-8")))
    assert users == ["smplwise/services/wiskey_switches.py"]
    text = (PACKAGE / "services" / "wiskey_switches.py").read_text(encoding="utf-8")
    assert text.count("set_setting(") == 1  # the import line names it without a call
    body = text[text.index("def apply("):]
    assert "set_setting(conn, key, changes[key])" in body and body.index("check(changes)") < body.index("set_setting(")
    from smplwise.routers import settings as settings_router

    fields = settings_router.SettingsPatch.model_fields
    assert not any(f.alias == install.SWITCH_KEY or name == "wiskey_auto_install" for name, f in fields.items())


def test_1b_the_switch_is_off_by_default_on_a_fresh_database(database):
    assert switch(database) is None and install.switch_on_db(database) is False


def test_1b_preflight_is_read_only(tmp_path, bundle, database):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    with database.connection(mode="read") as c:
        settings_before = c.execute("SELECT key, value FROM settings ORDER BY key").fetchall()
    assert install.preflight_native(database, None, cfg, bundle) is None
    with database.connection(mode="read") as c:
        assert c.execute("SELECT key, value FROM settings ORDER BY key").fetchall() == settings_before
    assert list(cfg.iterdir()) == []


# ---------------------------------------------------------------- 3. the generation fence (publication fence only)

def test_fence_refuses_explicitly_without_fcntl(tmp_path, monkeypatch, database):
    monkeypatch.setattr(projection, "_fcntl", None)
    with pytest.raises(install.InstallationError) as err:
        with projection.generation_fence(tmp_path):
            pytest.fail("entered the fence without fcntl")
    assert err.value.code == "generation_fence_unsupported"
    # publish refuses before any DB write; invalidate refuses and deletes nothing
    with pytest.raises(install.InstallationError):
        projection.publish(database, tmp_path, {"smplwise_bridge": "a", "hikvision_intercom": "b"}, generation_id="synthetic")
    with database.connection(mode="read") as c:
        assert get_setting(c, projection.EVIDENCE_KEY) is None
    doc = tmp_path / projection.RELATIVE
    doc.parent.mkdir(parents=True)
    doc.write_text("{}")
    with pytest.raises(install.InstallationError):
        projection.invalidate(tmp_path)
    assert doc.read_text() == "{}"


def test_fence_never_needed_when_nothing_was_published(tmp_path, monkeypatch):
    monkeypatch.setattr(projection, "_fcntl", None)
    projection.invalidate(tmp_path)  # no projection directory: nothing to withdraw, nothing created
    assert not (tmp_path / ".storage").exists()


def test_fence_has_no_state_counter_or_claim_in_the_file():
    source = (PACKAGE / "services" / "wiskey_native_projection.py").read_text(encoding="utf-8")
    fence = source[source.index("def generation_fence("):source.index("def pair_digest(")]
    assert "os.write" not in fence and ".write(" not in fence and "os.read" not in fence and "json" not in fence


@needs_fcntl
def test_fence_is_exclusive_and_busy_is_typed(tmp_path, monkeypatch):
    import fcntl

    monkeypatch.setattr(projection, "FENCE_WAIT_S", 0.05)
    with projection.generation_fence(tmp_path):
        lock = tmp_path / projection.RELATIVE
        path = lock.parent / projection.FENCE_NAME
        fd = os.open(path, os.O_RDWR)
        try:
            with pytest.raises(BlockingIOError):
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        finally:
            os.close(fd)
    fd = os.open(path, os.O_RDWR)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)  # released after the block
        with pytest.raises(TimeoutError, match="generation_fence_busy"):
            with projection.generation_fence(tmp_path):
                pass
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)
    assert path.read_bytes() == b""  # the fence file never holds state


# ---------------------------------------------------------------- 4. relay map sync after approval (rows 1 + 6)

class _Port:
    def __init__(self, db: Database, *, fail: str | None = None) -> None:
        from smplwise.services.wiskey_capture_port import PortIdentity

        self.db, self.fail, self.calls = db, fail, []
        self.ident = PortIdentity("synthetic-bridge", "synthetic-subject", "913d2f99-4b2c-4216-a6c9-f825bd057953", "synthetic-connection")

    def identity(self):
        return self.ident

    def call(self, command, parameters, *, timeout_s):
        from smplwise.services import wiskey_relay_map_native as native
        from smplwise.services.wiskey_capture_port import PortError

        assert timeout_s > 0
        self.calls.append(command)
        with self.db.connection(mode="read") as conn:  # an independent reader sees the committed approval during the transport
            assert conn.execute("SELECT COUNT(*) FROM wiskey_relay_map_stations").fetchone()[0] >= 1
        if command == native.SOURCE:
            return {"contract": native.CONTRACT, "schema_version": 1, "anti_rollback_scope": "surviving_native_projection",
                    "full_restore_continuity": "not_proven", "inventory": {},
                    "binding": {"repository_id": self.ident.repository_id, "bridge_entry_id": self.ident.entry_id,
                                "query_owner_id": self.ident.query_owner_id, "connection_ref": self.ident.connection_ref}}
        if self.fail:
            raise PortError(self.fail, "unknown")
        record = parameters["record"]
        return {"contract": native.ACK_CONTRACT, "schema_version": 1, "state": "staged", "code": None, "seq": record["seq"],
                "content_digest": record["content_digest"], "repository_id": self.ident.repository_id, "projection_sha256": "c" * 64,
                "activation": "not_performed", "loaded": False, "ready": False}


class _Join:
    def __init__(self, port: _Port) -> None:
        self.capture_port = port
        self.asked: list[str] = []

    def selected(self, command=None):
        self.asked.append(command)
        return True


@pytest.fixture
def world(settings, monkeypatch):
    from test_wiskey_relay_map_writer_2310 import ST, World

    from smplwise.services import intercom_sync

    intercom_sync.SYNC.reset()
    w = World(settings, monkeypatch)
    w.station = ST
    yield w
    intercom_sync.SYNC.reset()


def _sync_audits(w) -> list[dict[str, Any]]:
    with w.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT * FROM audit_log WHERE action IN ('wiskey.relay_map.synced', 'wiskey.relay_map.sync_deferred') "
                            "ORDER BY rowid").fetchall()
        return [dict(r) for r in rows]


def test_sync_with_the_switch_off_sends_nothing_and_is_audited(world, monkeypatch):
    from smplwise.services import wiskey_direct_join

    monkeypatch.setattr(wiskey_direct_join, "installed", lambda: pytest.fail("the join must not even be looked up with the switch off"))
    r = world.save(world.station, [(1, 2), (2, 1)], 0)
    assert r.status_code == 200, r.text
    (a,) = _sync_audits(world)
    assert a["action"] == "wiskey.relay_map.sync_deferred" and a["reason"] == "switch_off"
    with world.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM wiskey_relay_map_exports").fetchone()[0] == 0


def test_sync_with_the_owner_switch_stages_once_and_acks_by_the_verified_subject(world, monkeypatch):
    from smplwise.services import wiskey_direct_join
    from smplwise.services import wiskey_relay_map_native as native

    port = _Port(world.db)
    join = _Join(port)
    monkeypatch.setattr(wiskey_direct_join, "installed", lambda: join)
    with world.db.connection() as conn:
        set_setting(conn, install.SWITCH_KEY, "on")
    r = world.save(world.station, [(1, 2), (2, 1)], 0)
    assert r.status_code == 200, r.text
    assert port.calls == [native.SOURCE, native.STAGE] and set(join.asked) == {native.SOURCE, native.STAGE}
    (a,) = _sync_audits(world)
    details = json.loads(a["details_json"])
    assert a["action"] == "wiskey.relay_map.synced" and details["seq"] == 1 and details["ack"] == "staged"
    with world.db.connection(mode="read") as conn:
        assert conn.execute("SELECT acked_by FROM wiskey_relay_map_exports WHERE seq = 1").fetchone()[0] == "native:synthetic-bridge"
        assert get_setting(conn, install.SWITCH_KEY) == "on"


def test_sync_unknown_outcome_keeps_the_approval_is_audited_and_never_retried(world, monkeypatch):
    from smplwise.services import wiskey_direct_join

    port = _Port(world.db, fail="synthetic_ack_loss")
    monkeypatch.setattr(wiskey_direct_join, "installed", lambda: _Join(port))
    with world.db.connection() as conn:
        set_setting(conn, install.SWITCH_KEY, "on")
    r = world.save(world.station, [(1, 2), (2, 1)], 0)
    assert r.status_code == 200, r.text
    assert r.json()["revision"] == 1
    assert len(port.calls) == 2  # source + one stage, no retry
    (a,) = _sync_audits(world)
    assert a["action"] == "wiskey.relay_map.sync_deferred" and a["reason"] == "synthetic_ack_loss"
    assert json.loads(a["details_json"]) == {"outcome": "unknown"}
    with world.db.connection(mode="read") as conn:
        assert conn.execute("SELECT revision FROM wiskey_relay_map_stations").fetchone()[0] == 1
        assert conn.execute("SELECT acked_at FROM wiskey_relay_map_exports WHERE seq = 1").fetchone()[0] is None


def test_prepare_quiesced_has_no_production_caller_and_demands_a_maintenance_token(database):
    from smplwise.services import wiskey_relay_map_native as native
    from smplwise.services.wiskey_capture_port import PortError

    callers = [p.relative_to(BACKEND).as_posix() for p in PACKAGE.rglob("*.py")
               if "prepare_quiesced" in p.read_text(encoding="utf-8") and p.name != "wiskey_relay_map_native.py"]
    assert callers == []
    with pytest.raises(PortError) as err:
        native.prepare_quiesced(database, _Port(database), {"record": {"seq": 1}}, maintenance_token="")
    assert err.value.code == "relay_export_maintenance_required" and err.value.outcome == "not_sent"


def test_catalog_declares_the_five_relay_map_commands_and_keeps_the_m2_exclusion():
    from smplwise.services import wiskey_direct_catalog as catalog
    from smplwise.services import wiskey_relay_map_native as native

    commands = {e.command for e in catalog.load().entries()}
    assert set(native.COMMANDS) <= commands and len(native.COMMANDS) == 5
    assert catalog.OWNER_EXCLUDED_WRITES == frozenset({"jobs/approval_decide", "jobs/approval_request"})
