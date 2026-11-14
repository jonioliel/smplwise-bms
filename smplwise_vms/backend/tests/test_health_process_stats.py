"""Process and db-file counters in /health: computation with fakes, the cache, null fallbacks, the exposure rule."""
from __future__ import annotations

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import process_stats as ps


def setup_function(_f):
    ps.reset_cache()


def test_db_and_wal_sizes_and_missing_wal(tmp_path):
    db = tmp_path / "x.db"
    db.write_bytes(b"a" * 100)
    v = ps.snapshot(db)
    assert v["db"] == {"size_bytes": 100, "wal_bytes": 0}
    ps.reset_cache()
    (tmp_path / "x.db-wal").write_bytes(b"b" * 7)
    assert ps.snapshot(db)["db"] == {"size_bytes": 100, "wal_bytes": 7}


def test_missing_db_is_null_and_never_raises(tmp_path):
    v = ps.snapshot(tmp_path / "nope.db")
    assert v["db"]["size_bytes"] is None
    assert set(v["process"]) == {"uptime_s", "threads", "open_fds", "rss_mb"}
    assert isinstance(v["process"]["threads"], int) and v["process"]["uptime_s"] >= 0


def test_unreadable_counters_become_null(tmp_path, monkeypatch):
    def boom():
        raise OSError("no /proc here")

    monkeypatch.setattr(ps, "_open_fds", boom)
    monkeypatch.setattr(ps, "_rss_mb", boom)
    v = ps.snapshot(tmp_path / "d.db")
    assert v["process"]["open_fds"] is None and v["process"]["rss_mb"] is None
    assert v["process"]["threads"] is not None


def test_whole_computation_failure_gives_all_nulls(tmp_path, monkeypatch):
    monkeypatch.setattr(ps, "_compute", lambda *a: (_ for _ in ()).throw(RuntimeError("x")))
    v = ps.snapshot(tmp_path / "d.db")
    assert all(x is None for x in v["process"].values()) and all(x is None for x in v["db"].values())


def test_cache_window(tmp_path, monkeypatch):
    calls = []
    real = ps._compute
    monkeypatch.setattr(ps, "_compute", lambda p, n: calls.append(1) or real(p, n))
    t = [1000.0]
    clock = lambda: t[0]  # noqa: E731
    db = tmp_path / "d.db"
    first = ps.snapshot(db, clock)
    t[0] += ps.CACHE_TTL_S - 0.1
    assert ps.snapshot(db, clock) is first and len(calls) == 1
    t[0] += 0.2
    ps.snapshot(db, clock)
    assert len(calls) == 2
    ps.snapshot(tmp_path / "other.db", clock)  # another database path is never served from the cache
    assert len(calls) == 3


def test_health_exposes_blocks_only_to_diagnostics_holder(settings):
    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    admin = c.get("/api/v1/health").json()  # the dev admin holds system.configure
    assert set(admin["process"]) == {"uptime_s", "threads", "open_fds", "rss_mb"}
    assert admin["db"]["size_bytes"] > 0 and admin["db"]["wal_bytes"] is not None
    assert "ok" in admin["db"]
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    viewer = c.get("/api/v1/health", headers=as_user("ron")).json()
    assert "process" not in viewer
    assert "size_bytes" not in viewer["db"] and "wal_bytes" not in viewer["db"]
    blob = str(admin)
    assert str(settings.data_dir) not in blob
