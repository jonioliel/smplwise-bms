"""CR-CORE-HELPERS-2438 (code review 2026-11-13): the additive core helpers - errors.ServiceInvalid (04:F16 step one),
db.has_table / db.has_column (D8 helper half), db.update (04:F25), the call-budget hook and the remembered busy timeout
(05:P3-04), and services/values.py (04:F24). Nothing adopts them in this branch; these tests pin what they answer."""
from __future__ import annotations

import sqlite3

import pytest

from smplwise import db as db_mod
from smplwise.db import Database, PooledConnection, has_column, has_table, set_setting, update
from smplwise.errors import ApiError, ServiceInvalid


@pytest.fixture()
def db(tmp_path) -> Database:
    d = Database(tmp_path / "t.db", pool=True)
    d.migrate()
    db_mod.forget_schema_cache()
    yield d
    d.close_pool()


# ---------------------------------------------------------------- errors.ServiceInvalid


def test_service_invalid_is_a_value_error_with_one_envelope():
    e = ServiceInvalid("ערך לא תקין", fields=["a", "b"], details={"message_en": "Invalid value"})
    assert isinstance(e, ValueError) and str(e) == "ערך לא תקין"
    err = e.to_api_error()
    assert isinstance(err, ApiError) and (err.status, err.code, err.user_message) == (422, "validation", "ערך לא תקין")
    assert err.details == {"message_en": "Invalid value", "fields": ["a", "b"]}
    assert ServiceInvalid(code="setup_incomplete").to_api_error("ההגדרה לא הושלמה.", status=409).payload("cid") == {
        "code": "setup_incomplete", "user_message": "ההגדרה לא הושלמה.", "retryable": False, "correlation_id": "cid", "details": {}}


def test_a_subclass_keeps_its_own_constructor_and_envelope_key():
    class Invalid(ServiceInvalid):  # the calendar shape: (message, field, code); the endpoint answers details.field
        def __init__(self, message: str, field: str, code: str = "validation") -> None:
            super().__init__(message, code=code)
            self.field = field

        def api_details(self) -> dict:
            return {"field": self.field}

    e = Invalid("שעה לא תקינה", "start", "bad_time")
    assert (e.code, e.field, e.message) == ("bad_time", "start", "שעה לא תקינה")
    err = e.to_api_error()
    assert (err.status, err.code, err.details) == (422, "bad_time", {"field": "start"})

    class Bare(ServiceInvalid):  # a class that never calls the base constructor still answers from the class defaults
        def __init__(self, key: str) -> None:
            ValueError.__init__(self, key)
            self.key = key

    b = Bare("log.hours").to_api_error("ערך לא תקין ביומן ההפעלות.")
    assert (b.status, b.code, b.details) == (422, "validation", {})


# ---------------------------------------------------------------- db.has_table / db.has_column


def test_has_table_and_has_column_answer_like_the_probes(db):
    with db.connection(mode="read") as conn:
        assert has_table(conn, "settings") and not has_table(conn, "no_such_table")
        assert has_column(conn, "settings", "value") and not has_column(conn, "settings", "nope")
        assert not has_column(conn, "no_such_table", "value")
        with pytest.raises(ValueError):
            has_column(conn, "settings; DROP TABLE settings", "value")
        probe = conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", ("settings",)).fetchone() is not None
        assert has_table(conn, "settings") is probe


def test_a_committed_schema_change_is_seen_at_once(db):
    with db.connection(mode="read") as conn:
        assert not has_table(conn, "cr_helpers_t")
    with db.connection() as conn:
        conn.execute("CREATE TABLE cr_helpers_t (id INTEGER PRIMARY KEY)")
        assert has_table(conn, "cr_helpers_t")  # the transaction's own change
    with db.connection(mode="read") as conn:
        assert has_table(conn, "cr_helpers_t") and not has_column(conn, "cr_helpers_t", "extra")
    with db.connection() as conn:
        conn.execute("ALTER TABLE cr_helpers_t ADD COLUMN extra TEXT")
    with db.connection(mode="read") as conn:
        assert has_column(conn, "cr_helpers_t", "extra")


def test_a_rolled_back_schema_change_never_answers_for_a_later_one(db):
    """A write transaction's uncommitted CREATE bumps schema_version; after its rollback a different change commits under the same
    number. The answer given inside the rolled-back transaction must not be the cached answer for the committed one."""
    class Boom(Exception):
        pass

    with pytest.raises(Boom):
        with db.connection() as conn:
            conn.execute("CREATE TABLE cr_helpers_gone (id INTEGER)")
            assert has_table(conn, "cr_helpers_gone")
            raise Boom
    with db.connection() as conn:
        conn.execute("CREATE TABLE cr_helpers_kept (id INTEGER)")
    with db.connection(mode="read") as conn:
        assert has_table(conn, "cr_helpers_kept") and not has_table(conn, "cr_helpers_gone")


def test_a_connection_without_a_file_is_asked_directly():
    conn = sqlite3.connect(":memory:")
    try:
        conn.execute("CREATE TABLE t (a INTEGER)")
        assert has_table(conn, "t") and has_column(conn, "t", "a") and not has_column(conn, "t", "b") and not has_table(conn, "u")
    finally:
        conn.close()


def test_the_answer_is_cached_per_file_and_schema_version(db):
    with db.connection(mode="read") as conn:
        assert has_column(conn, "settings", "key")
    assert any(k[0] == str(db.path) for k in db_mod._schema_cache)
    with db.connection(mode="read") as conn:
        seen: list[str] = []
        conn.set_trace_callback(seen.append)  # (tainting: this lease is closed afterwards, not pooled)
        assert has_column(conn, "settings", "key")
    assert not any("sqlite_master" in s or "table_info" in s for s in seen), seen


# ---------------------------------------------------------------- db.update


def test_update_binds_the_values_in_order_and_checks_every_identifier(db):
    with db.connection() as conn:
        set_setting(conn, "cr.helpers.a", "1")
        assert update(conn, "settings", {"value": "2"}, "key = ?", ("cr.helpers.a",)) == 1
        assert conn.execute("SELECT value FROM settings WHERE key = 'cr.helpers.a'").fetchone()[0] == "2"
        assert update(conn, "settings", {}, "key = ?", ("cr.helpers.a",)) == 0
        assert update(conn, "settings", {"value": "3"}, "key = ?", ("missing",)) == 0
        for bad in ({"value = 'x', key": "y"}, {"Value": "x"}, {"1value": "x"}, {"value;": "x"}):
            with pytest.raises(ValueError):
                update(conn, "settings", bad, "key = ?", ("cr.helpers.a",))
        with pytest.raises(ValueError):
            update(conn, "settings where 1=1 --", {"value": "x"}, "key = ?", ("cr.helpers.a",))
        with pytest.raises(ValueError):
            update(conn, "settings", {"value": "x"}, "  ")
        assert conn.execute("SELECT value FROM settings WHERE key = 'cr.helpers.a'").fetchone()[0] == "2"


# ---------------------------------------------------------------- the call-budget hook and the remembered busy timeout


def test_the_call_budget_registers_itself_and_still_bounds_every_write(db):
    from smplwise.services import wiskey_call_budget as budget

    assert db_mod._call_budget is budget
    with budget.until(budget.now() - 1):  # a budget already spent: no write may start
        with pytest.raises(budget.DeadlineExpired):
            with db.connection():
                pass
    with db.connection() as conn:  # outside the budget: as before
        conn.execute("SELECT 1")


def test_a_reused_lease_does_not_read_its_busy_timeout_back(db, monkeypatch):
    with db.connection():
        pass  # the first lease opens the connection (it reads busy_timeout once at its BEGIN)
    seen: list[str] = []
    real = PooledConnection.execute

    def spy(self, *args, **kwargs):
        if args and isinstance(args[0], str):
            seen.append(args[0])
        return real(self, *args, **kwargs)

    monkeypatch.setattr(PooledConnection, "execute", spy)
    with db.connection() as conn:
        assert conn._busy_ms == int(db_mod.BUSY_TIMEOUT_S * 1000)
    assert not any("busy_timeout" in s for s in seen), seen


def test_a_lease_that_sets_its_busy_timeout_is_read_again(db):
    with db.connection():
        pass
    with db.connection() as conn:
        conn.execute("PRAGMA busy_timeout=5")
        assert conn._busy_ms is None
        conn.execute("COMMIT")
        db_mod._begin_immediate(conn, "test")  # the next BEGIN reads the value the lease has now
        assert conn._busy_ms == 5
    with db.connection() as conn:  # the pool hands it out again at the product value
        assert conn.execute("PRAGMA busy_timeout").fetchone()[0] == int(db_mod.BUSY_TIMEOUT_S * 1000)


# ---------------------------------------------------------------- services/values.py


def test_clip_equals_each_copy():
    from smplwise.services import notify_policy, push, values
    from smplwise.services.notices import push as notices_push

    for text, n in [("", 5), (None, 5), ("  a   b\nc ", 10), ("x" * 50, 10), ("שלום עולם", 4), ("abc", 3), ("abcd", 3)]:
        want = values.clip(text, n)
        assert want == notices_push._clip(text, n) == notify_policy._clip(text, n) == push._clip(text, n), (text, n)


def test_checked_setting_equals_each_copy(db):
    from smplwise.services import offline_field, quiet_windows, readiness, values

    for mod in (offline_field, quiet_windows, readiness):
        for key in mod.SETTINGS:
            for stored in (None, "", "not-a-valid-value-at-all", mod.SETTINGS[key][0]):
                with db.connection() as conn:
                    if stored is None:
                        conn.execute("DELETE FROM settings WHERE key = ?", (key,))
                    else:
                        set_setting(conn, key, stored)
                    assert values.checked_setting(conn, mod.SETTINGS, key) == mod.setting(conn, key), (mod.__name__, key, stored)


def test_object_with_keys_equals_each_copy():
    from smplwise.services import area_row, home_screen_options, values

    allowed = ("a", "b")
    for value in ({"a": 1}, {}, {"a": 1, "c": 2, "z": 3}, [], "x", None):
        outs = []
        for fn in (values.object_with_keys, area_row._object, home_screen_options._object):
            try:
                outs.append(("ok", fn(value, "thing", allowed)))
            except ValueError as exc:
                outs.append(("err", str(exc)))
        assert outs[0] == outs[1] == outs[2], (value, outs)
