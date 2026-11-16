"""CR-SETTINGS-STORE-2436 (review 05:P1-03 helper, 05:P1-10 step 1): the settings registry lives in services/settings_store.py,
routers/settings.py re-exports it, and `setting_value(conn, key)` answers every plain key exactly as `read_settings(conn)[key]`
does - stored, missing and empty - while refusing a key that read_settings normalises. GET /settings answers on the read
connection, also while another writer holds the write lock."""
from __future__ import annotations

import threading

import pytest
from fastapi.testclient import TestClient

from smplwise.db import get_setting
from smplwise.main import create_app
from smplwise.routers import settings as settings_router
from smplwise.services import settings_store


def _plain_keys() -> list[str]:
    return [k for k in settings_store.DEFAULTS if k not in settings_store.NORMALISED_KEYS]


def _stored_sample(key: str) -> str:
    """A value that differs from the default and that the key's plain read accepts (an int for INT_KEYS)."""
    if key in settings_store.INT_KEYS:
        return str(int(settings_store.DEFAULTS[key] or "0") + 7)
    return "parity-" + key


def test_the_router_re_exports_the_store():
    for name in ("DEFAULTS", "INT_KEYS", "PRIVATE_KEYS", "SCHEDULE_CLASSES", "PLAN_SURFACES", "CLASSES_REV_KEY", "FROZEN_SKINS",
                 "FROZEN_FALLBACK_SKIN", "TAB_STYLES", "TABS_SLUG", "TABS_MAX_JSON", "read_settings", "stored_skin",
                 "stored_plan_surfaces", "stored_schedule_classes", "normalize_tabs", "_stored_tabs", "_stored_nav_size",
                 "_stored_mobile", "_stored_xs", "_stored_timeline_colors", "_stored_area_row", "_stored_remote_default",
                 "_stored_favourites", "setting_value", "NORMALISED_KEYS"):
        assert getattr(settings_router, name) is getattr(settings_store, name), name


def test_the_store_imports_no_router():
    import ast
    import inspect

    tree = ast.parse(inspect.getsource(settings_store))
    for node in tree.body:  # module level only: read_settings imports the background stamps at call time
        if isinstance(node, ast.ImportFrom):
            assert "routers" not in (node.module or ""), node.module
            assert not (node.level and node.module is None and any(a.name == "routers" for a in node.names))


@pytest.mark.parametrize("state", ["stored", "missing", "empty"])
def test_setting_value_equals_read_settings_for_every_plain_key(settings, state):
    app = create_app(settings)
    keys = _plain_keys()
    assert len(keys) > 150, "most keys are plain"
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM settings WHERE key IN (%s)" % ",".join("?" * len(keys)), keys)
        if state != "missing":
            conn.executemany("INSERT INTO settings(key, value) VALUES(?, ?)",
                             [(k, _stored_sample(k) if state == "stored" else "") for k in keys])
        full = settings_store.read_settings(conn, private=True)
        for key in keys:
            got = settings_store.setting_value(conn, key)
            assert got == full[key] and type(got) is type(full[key]), (state, key, got, full[key])
            if state == "stored":
                expected = int(_stored_sample(key)) if key in settings_store.INT_KEYS else _stored_sample(key)
                assert got == expected, key


def test_normalised_keys_is_complete_and_refused(settings):
    """A plain key reads back a stored odd value unchanged; every key that does not is in NORMALISED_KEYS (so the list can
    not fall behind a new normaliser in read_settings), and setting_value refuses those and unknown keys."""
    app = create_app(settings)
    odd = {k: "parity-odd-value" for k in settings_store.DEFAULTS if k not in settings_store.INT_KEYS}
    with app.state.db.connection() as conn:
        conn.executemany("INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)", list(odd.items()))
        full = settings_store.read_settings(conn, private=True)
        changed = {k for k in odd if full.get(k, "<absent>") != "parity-odd-value"}
        missing = sorted(changed - settings_store.NORMALISED_KEYS)
        assert not missing, f"read_settings normalises these keys; add them to NORMALISED_KEYS: {missing}"
        for key in sorted(settings_store.NORMALISED_KEYS):
            assert key in settings_store.DEFAULTS, f"NORMALISED_KEYS names an unknown key: {key}"
            with pytest.raises(KeyError):
                settings_store.setting_value(conn, key)
        for key in ("doors.ui.tab", "home.multi_building", "no.such.key"):
            with pytest.raises(KeyError):
                settings_store.setting_value(conn, key)


def test_read_settings_bulk_read_equals_the_per_key_read(settings, monkeypatch):
    """The store's own seam (the router-level patch in test_perf_home_devices no longer reaches read_settings after the move)."""
    app = create_app(settings)
    with app.state.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('ui.skin', 'arx')")
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('playback.max_sessions', '3')")
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('ui.motion', '')")
        fast = settings_store.read_settings(conn, private=True)
        monkeypatch.setattr(settings_store, "get_settings_many", lambda cn, keys: {k: v for k in keys if (v := get_setting(cn, k, "\0")) != "\0"})
        slow = settings_store.read_settings(conn, private=True)
    assert fast == slow


def test_get_settings_answers_while_the_write_lock_is_held(settings):
    app = create_app(settings)
    c = TestClient(app)
    before = c.get("/api/v1/settings")
    assert before.status_code == 200
    held, release = threading.Event(), threading.Event()

    def writer():
        with app.state.db.connection() as conn:
            conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('parity.lock', '1')")
            held.set()
            release.wait(10)

    t = threading.Thread(target=writer)
    t.start()
    try:
        assert held.wait(5)
        during = c.get("/api/v1/settings")
    finally:
        release.set()
        t.join(10)
    assert during.status_code == 200
    assert during.json() == before.json()
