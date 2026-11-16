"""CR-SETTING-CALLERS-2440 (review 05:P1-03, the call sites): no module reads every setting to subscript one plain key, the
`.get(key, fallback)` call sites that were converted had a fallback that could never be used, and the alert listener asks for
the time zone once per ZONE_CACHE_S instead of once per alert."""
from __future__ import annotations

import ast
import datetime as dt
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import events_ingest, settings_store

BACKEND = Path(__file__).resolve().parents[1] / "smplwise"
# Files other rows hold (MASTER_PLAN: "except main.py and any file listed by TIMEUTIL, PATH-CONFINE, ADMIN-GATE or TK-*").
# The closing chain converts them; a name may only leave this list.
WAITING = {"routers/energy_billing.py": 1, "services/access_grants.py": 1}
# The plain keys the converted call sites read; three of them were read with `.get(key, fallback)`.
CONVERTED_KEYS = ("time.zone", "snapshots.max_age_s", "history.ha_secondary", "cases.import_max_mb", "storage.min_free_mb",
                  "remote.max_live_streams", "schedules.enabled", "media.max_live_sessions", "playback.lease_s",
                  "playback.max_seeks_per_min", "playback.cross_recorder_sync", "remote.policy", "ui.global_search",
                  "ui.global_search_roles")


def _store_names(tree: ast.Module) -> set[str]:
    """The local names bound to the settings store's `read_settings` (imported from the store or through the router)."""
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and (
                node.module.endswith("routers.settings") or node.module.endswith("settings_store") or (node.module == "settings" and node.level)):
            names.update(a.asname or a.name for a in node.names if a.name == "read_settings")
    return names


def _single_key_reads(path: Path) -> list[tuple[int, str]]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names = _store_names(tree)
    found: list[tuple[int, str]] = []
    if not names:
        return found

    def is_read(node: ast.AST) -> bool:
        return isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in names

    for node in ast.walk(tree):
        key = None
        if isinstance(node, ast.Subscript) and is_read(node.value) and isinstance(node.slice, ast.Constant):
            key = node.slice.value
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "get" and is_read(node.func.value) \
                and node.args and isinstance(node.args[0], ast.Constant):
            key = node.args[0].value
        if isinstance(key, str) and key in settings_store.DEFAULTS and key not in settings_store.NORMALISED_KEYS:
            found.append((node.lineno, key))
    return sorted(found)


def test_no_module_reads_every_setting_for_one_plain_key():
    seen: dict[str, int] = {}
    for path in sorted(BACKEND.rglob("*.py")):
        rel = path.relative_to(BACKEND).as_posix()
        if rel in ("main.py", "services/settings_store.py"):
            continue
        hits = _single_key_reads(path)
        if rel in WAITING:
            seen[rel] = len(hits)
            continue
        assert not hits, f"{rel}: use settings_store.setting_value(conn, key) for {hits}"
    assert seen == WAITING, "a waiting file was converted (or gained a site): update WAITING - it may only shrink"


def test_the_guard_recognises_the_shapes(tmp_path):
    sample = tmp_path / "sample.py"
    sample.write_text(
        "from ..routers.settings import read_settings as rs\n"
        "def f(conn):\n"
        "    a = rs(conn)['time.zone']\n"
        "    b = rs(conn).get('playback.lease_s', 3)\n"
        "    c = rs(conn)['ui.skin']\n"  # a normalised key: read_settings is the right reader
        "    s = rs(conn)\n"  # several keys from one read: not a single-key read
        "    return a, b, c, s['time.zone']\n", encoding="utf-8")
    assert _single_key_reads(sample) == [(3, "time.zone"), (4, "playback.lease_s")]


def test_the_converted_keys_are_plain_and_always_answered(settings):
    """`read_settings(conn).get(key, fallback)` never used its fallback for these keys (read_settings answers every DEFAULTS
    key), so `setting_value(conn, key)` is the same value - with nothing stored, and with an empty value stored."""
    app = create_app(settings)
    with app.state.db.connection() as conn:
        for state in ("missing", "empty"):
            conn.execute("DELETE FROM settings WHERE key IN (%s)" % ",".join("?" * len(CONVERTED_KEYS)), CONVERTED_KEYS)
            if state == "empty":
                conn.executemany("INSERT INTO settings(key, value) VALUES(?, '')", [(k,) for k in CONVERTED_KEYS])
            full = settings_store.read_settings(conn)
            for key in CONVERTED_KEYS:
                assert key in settings_store.DEFAULTS and key not in settings_store.NORMALISED_KEYS, key
                value = settings_store.setting_value(conn, key)
                assert value == full[key] and type(value) is type(full[key]), (state, key)
                assert value == full.get(key, "a fallback that is never used"), (state, key)


# ---------------------------------------------------------------- the alert listener's zone

class _Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def monotonic(self) -> float:
        return self.now


def _listener() -> events_ingest.AlertStreamListener:
    return events_ingest.AlertStreamListener(state=events_ingest.IngestState(), ingest_queue=events_ingest.IngestQueue(maxlen=8))


@pytest.fixture()
def clock(monkeypatch) -> _Clock:
    c = _Clock()
    monkeypatch.setattr(events_ingest.time, "monotonic", c.monotonic)
    return c


def test_the_zone_is_asked_once_per_window(clock):
    listener = _listener()
    calls: list[str] = []
    zones = iter(["Asia/Jerusalem", "Europe/London", "America/New_York"])

    def getter() -> str:
        calls.append(next(zones))
        return calls[-1]

    listener.tz_getter = getter
    assert [listener._zone() for _ in range(50)] == ["Asia/Jerusalem"] * 50
    assert len(calls) == 1
    clock.now += events_ingest.ZONE_CACHE_S - 0.01
    assert listener._zone() == "Asia/Jerusalem" and len(calls) == 1
    clock.now += 0.02  # the window is over: a zone saved in the settings is picked up
    assert listener._zone() == "Europe/London" and len(calls) == 2
    assert listener._zone() == "Europe/London" and len(calls) == 2


def test_a_replaced_getter_is_asked_at_once(clock):
    listener = _listener()
    listener.tz_getter = lambda: "Asia/Jerusalem"
    assert listener._zone() == "Asia/Jerusalem"
    listener.tz_getter = lambda: "Europe/London"  # start() of another run, or a test
    assert listener._zone() == "Europe/London"


def test_a_failing_getter_raises_and_keeps_nothing(clock):
    listener = _listener()
    state = {"fail": False}

    def getter() -> str:
        if state["fail"]:
            raise RuntimeError("database is locked")
        return "Asia/Jerusalem"

    listener.tz_getter = getter
    assert listener._zone() == "Asia/Jerusalem"
    clock.now += events_ingest.ZONE_CACHE_S + 1
    state["fail"] = True
    with pytest.raises(RuntimeError):  # the getter's error reaches the caller, as before
        listener._zone()
    state["fail"] = False
    assert listener._zone() == "Asia/Jerusalem"


def test_a_burst_of_alerts_is_stored_in_the_zone_with_one_read(settings):
    """Through the real store path: four alerts, one zone read; the stored instant is the device's instant."""
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    client = TestClient(app)
    for ch in (1, 2, 3, 4):
        client.post("/api/v1/cameras", json={"channel": ch, "alias": f"c{ch}"})
    listener = _listener()
    calls: list[int] = []

    def getter() -> str:
        calls.append(1)
        return "Asia/Jerusalem"

    listener.db, listener.settings, listener.tz_getter = app.state.db, s, getter
    when = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=5)).astimezone(dt.timezone(dt.timedelta(hours=3))).replace(microsecond=0)
    for ch in (1, 2, 3, 4):
        listener._handle(events_ingest.ParsedAlert(raw_type="VMD", state="active", channel=ch, dyn_channel=None,
                                                   device_time=when.isoformat(), description="", target="", active_post_count=1))
    assert len(calls) == 1
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT occurred_at FROM events WHERE source = 'alertstream'").fetchall()
    assert len(rows) == 4
    assert {r[0] for r in rows} == {when.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
