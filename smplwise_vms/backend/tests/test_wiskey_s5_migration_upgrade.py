"""WISKEY-S5-PREMERGE: the WisKey migrations follow the 2.37.0 train at 0194 / 0195 / 0196.

The runner (`Database.migrate`) keys on the integer prefix only: files sorted by name, a version recorded in `schema_migrations`
is skipped, no checksum of the file text is kept. So the renumbering (one header line added, DDL unchanged) is safe for every
database that never ran a WisKey development branch, and two files with one number would break it (the second INSERT of the
same version hits the primary key). Proves on the real migration files:
- the sequence is contiguous 0001..0196, unique, and the train's 0192 / 0193 keep their numbers;
- a 2.35.0 database (ends at 0191) upgrades in one start to 0196, each of 0192..0196 once and in order;
- a 2.36.x / 2.37.0 database (ends at 0193, the train) upgrades to 0196 running exactly the three WisKey files;
- the objects of all five exist afterwards and a second start runs nothing.
Every value is invented."""
from __future__ import annotations

import shutil

from smplwise import db as dbmod

TRAIN = {192: "0192_ha_labels.sql", 193: "0193_calendar_feed_review.sql"}
WISKEY = {194: "0194_wiskey_installed_features.sql", 195: "0195_wiskey_relay_map_stations.sql", 196: "0196_wiskey_relay_map_exports.sql"}


def _numbers() -> list[int]:
    return sorted(int(f.name.split("_", 1)[0]) for f in dbmod.MIGRATIONS_DIR.glob("*.sql"))


def _database_at(last: int, settings, tmp_path, monkeypatch) -> dbmod.Database:
    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / f"at-{last:04d}"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) <= last:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    assert database.migrate()[-1] == last
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    return database


def _objects(database: dbmod.Database) -> tuple[set[str], set[str], set[str]]:
    with database.connection("read") as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        triggers = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'trigger'")}
        feed_cols = {r[1] for r in conn.execute("PRAGMA table_info(cal_feeds)")}
    return tables, triggers, feed_cols


def _assert_all_five(database: dbmod.Database) -> None:
    tables, triggers, feed_cols = _objects(database)
    assert {"ha_labels", "ha_area_labels", "ha_label_sync"} <= tables
    assert {"remote_enabled", "token_set_at"} <= feed_cols
    assert {"wiskey_template_jobs", "wiskey_event_seen", "wiskey_relay_map_stations", "wiskey_relay_map_exports"} <= tables
    assert {"wiskey_relay_map_exports_kept", "wiskey_relay_map_exports_sealed"} <= triggers
    with database.connection("read") as conn:
        recorded = {r[0] for r in conn.execute("SELECT version FROM schema_migrations")}
    assert set(range(1, 197)) <= recorded


def test_s5_the_sequence_is_contiguous_unique_and_the_wiskey_files_follow_the_train() -> None:
    nums = _numbers()
    assert nums == list(range(1, len(nums) + 1)), "contiguous, no duplicate (release_check 'migrations contiguous')"
    assert nums[-1] == 196
    names = {f.name for f in dbmod.MIGRATIONS_DIR.glob("019*.sql")}
    assert set(TRAIN.values()) | set(WISKEY.values()) <= names
    assert not any(n.startswith(("0192_wiskey", "0193_wiskey")) for n in names), "the old WisKey numbers are gone"
    from smplwise.services import wiskey_installed_features as wif
    assert wif.MIGRATION == WISKEY[194]
    for name in WISKEY.values():
        first = (dbmod.MIGRATIONS_DIR / name).read_text(encoding="utf-8").splitlines()[0]
        assert first.startswith("-- WISKEY-S5-PREMERGE: renumbered") and "content unchanged" in first


def test_s5_a_2350_database_upgrades_0191_to_0196_in_one_start(settings, tmp_path, monkeypatch) -> None:
    database = _database_at(191, settings, tmp_path, monkeypatch)
    tables, _, _ = _objects(database)
    assert "ha_labels" not in tables and "wiskey_template_jobs" not in tables
    assert database.migrate() == [192, 193, 194, 195, 196], "each once, in order, no gap"
    _assert_all_five(database)
    assert database.migrate() == [], "a second start runs nothing"


def test_s5_a_2370_train_database_runs_exactly_the_three_wiskey_files(settings, tmp_path, monkeypatch) -> None:
    database = _database_at(193, settings, tmp_path, monkeypatch)
    with database.connection() as conn:  # data written by the train's release stays as it was
        conn.execute("INSERT INTO ha_labels(label_id, name, updated_at) VALUES ('lbl-a', 'תווית', '2026-11-03T00:00:00Z')")
    assert database.migrate() == [194, 195, 196]
    _assert_all_five(database)
    with database.connection("read") as conn:
        assert conn.execute("SELECT name FROM ha_labels WHERE label_id = 'lbl-a'").fetchone()[0] == "תווית"
    assert database.migrate() == []
