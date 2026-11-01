"""WISKEY-RC7-ADOPT-2331 (rc.7 map row 7): the WisKey Mac rc.7 contribution test of the managed-bundle installer policy, adopted with
owner decision 1B (01.11): `wiskey.auto_install` stays OFF by default and NO code path turns it on. The two contribution tests that
expected the switch to turn itself on (`..._activates_without_owner_switch`, `..._can_activate_internal_setting`) now assert that it
does NOT, and that after the owner's own switch the managed path works.

Real SQLite and the original installer/file I/O, synthetic bundle only. No HA process, grant or restart is exercised by these units.
Symlinks need POSIX (Windows without developer mode cannot create them): those tests skip there and run on the runner.
"""
import hashlib
import json
import os
import shutil
import sys
from types import SimpleNamespace

import pytest

from smplwise.db import Database, get_setting, set_setting
from smplwise.services import wiskey_auto_install as install
from smplwise.services.wiskey_distribution_digest import digest, files

posix_only = pytest.mark.skipif(sys.platform == "win32" or not hasattr(os, "symlink"), reason="symlink fixtures need POSIX (runner)")


@pytest.fixture
def source(tmp_path, monkeypatch):
    root = tmp_path / 'integration'
    component = root / 'hikvision_intercom'
    component.mkdir(parents=True)
    (component / 'manifest.json').write_text(json.dumps({'domain': 'hikvision_intercom', 'version': '2.0.1-rc.7'}))
    (component / 'synthetic.txt').write_text('synthetic original source\n')
    rows = files(component)
    pinned = {'hikvision_intercom/' + r['path']: r['sha256'] for r in rows}
    tree = hashlib.sha256()
    for name, value in sorted(pinned.items()):
        tree.update(name.encode() + b'\0' + value.encode() + b'\n')
    pin = {'files': pinned, 'tree_sha256': tree.hexdigest(), 'profile': 'managed_original_authority_flow', 'product_CODE': 'a' * 40,
           'file_count': len(rows), 'component_digest_recomputed': digest(component)}
    (root / install.PIN_NAME).write_text(json.dumps(pin))
    monkeypatch.setenv('SW_NATIVE_SRC', str(component))
    monkeypatch.delenv('SW_HA_CONFIG_DIR', raising=False)  # no projection context: these units stay off the generation journal
    install.NATIVE.update(state='off', code=None, version=None, restart=None)
    return component


@pytest.fixture
def database(tmp_path):
    db = Database(tmp_path / 'synthetic.sqlite')
    db.migrate()
    return db


def setting(db):
    with db.connection(mode='read') as c:
        return get_setting(c, install.SWITCH_KEY)


def owner_switch_on(db):
    """The explicit owner step (Settings), simulated as the plain setting write the owner's screen performs."""
    with db.connection() as c:
        set_setting(c, install.SWITCH_KEY, 'on')


def test_approved_managed_fresh_install_does_not_activate_without_owner_switch(tmp_path, source, database):
    # 1B: was `..._activates_without_owner_switch` in the contribution
    cfg = tmp_path / 'ha'
    cfg.mkdir()
    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert answer['state'] == 'off' and answer['code'] is None, answer
    assert setting(database) is None
    assert not (cfg / 'custom_components').exists()
    # after the owner's own switch the managed path works: staged once, then up to date, no restart asked
    owner_switch_on(database)
    staged = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert staged['state'] == 'staged', staged
    target = cfg / 'custom_components/hikvision_intercom'
    assert digest(target) == digest(source)
    again = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert again['state'] == 'up_to_date' and again['restart'] is None
    assert not (cfg / '.storage/hikvision_intercom.arx_installation/manifest.json').exists()
    assert setting(database) == 'on'  # still exactly the owner's value


@posix_only
def test_existing_manual_marker_refuses_before_policy_and_copy(tmp_path, source, database):
    cfg = tmp_path / 'ha'
    target = cfg / 'custom_components/hikvision_intercom'
    target.mkdir(parents=True)
    (target / '_manual_upgrade_profile.json').symlink_to(tmp_path / 'not-a-file')
    (target / 'owner').write_bytes(b'synthetic preserve')
    owner_switch_on(database)  # the guard holds even with the owner's switch on
    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert answer['code'] == 'native_foreign_installed', answer
    assert setting(database) == 'on' and (target / 'owner').read_bytes() == b'synthetic preserve'


def test_unmarked_foreign_equal_tree_is_not_new_managed_authority(tmp_path, source, database):
    cfg = tmp_path / 'ha'
    target = cfg / 'custom_components/hikvision_intercom'
    shutil.copytree(source, target)
    owner_switch_on(database)
    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert answer['code'] == 'native_foreign_installed', answer
    with database.connection(mode='read') as c:
        assert get_setting(c, install.STAGED_DIGEST_KEY) is None  # an identical tree Arx did not stage is never adopted


def test_existing_owned_managed_tree_is_not_activated_by_the_installer(tmp_path, source, database):
    # 1B: was `..._can_activate_internal_setting` in the contribution
    cfg = tmp_path / 'ha'
    target = cfg / 'custom_components/hikvision_intercom'
    shutil.copytree(source, target)
    with database.connection() as c:
        set_setting(c, install.STAGED_DIGEST_KEY, install.source_digest(target))
        set_setting(c, install.SWITCH_KEY, 'off')
    result = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert result['state'] == 'off' and setting(database) == 'off'
    owner_switch_on(database)
    result = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert result['state'] == 'up_to_date' and setting(database) == 'on'


@posix_only
@pytest.mark.parametrize('name', ['.DS_Store', '__pycache__'])
def test_ignored_symlink_source_refused_before_target_read(tmp_path, source, database, name):
    # A dangling link would raise if followed; the original lstat scanner refuses it.
    (source / name).symlink_to(tmp_path / 'outside-missing')
    cfg = tmp_path / 'ha'
    cfg.mkdir()
    owner_switch_on(database)
    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert answer['state'] == 'error' and answer['code'] == 'native_source_refused', answer
    assert not (cfg / 'custom_components/hikvision_intercom').exists()


def test_tampered_managed_pin_cannot_install(tmp_path, source, database):
    (source / 'synthetic.txt').write_text('changed after pin')
    cfg = tmp_path / 'ha'
    cfg.mkdir()
    owner_switch_on(database)
    result = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert result['code'] == 'native_pin_mismatch' and not (cfg / 'custom_components').exists()


def test_legacy_unprofiled_bundle_keeps_source_off(tmp_path, source, database):
    p = source.parent / install.PIN_NAME
    value = json.loads(p.read_text())
    value.pop('profile')
    p.write_text(json.dumps(value))
    cfg = tmp_path / 'ha'
    cfg.mkdir()
    result = install.installer_step(database, SimpleNamespace(), cfg, None, restart=False)
    assert result['state'] == 'off' and setting(database) is None
