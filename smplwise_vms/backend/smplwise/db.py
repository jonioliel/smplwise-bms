"""SQLite access with versioned migrations (files in ./migrations, applied in order, recorded in
schema_migrations). One connection per request; WAL journal; foreign keys enforced."""
from __future__ import annotations

import datetime as dt
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def new_id() -> str:
    return secrets.token_hex(8)


class Database:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _open(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=10, isolation_level=None, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=10000")
        return conn

    def migrate(self) -> list[int]:
        applied: list[int] = []
        conn = self._open()
        try:
            conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
            done = {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}
            for file in sorted(MIGRATIONS_DIR.glob("*.sql")):
                version = int(file.name.split("_", 1)[0])
                if version in done:
                    continue
                # executescript() commits any open transaction first, so the migration carries its own
                # BEGIN/COMMIT and records itself inside the same transaction.
                sql = file.read_text(encoding="utf-8")
                conn.executescript(f"BEGIN;\n{sql}\nINSERT INTO schema_migrations(version, applied_at) VALUES({version}, '{now_iso()}');\nCOMMIT;")
                applied.append(version)
        finally:
            conn.close()
        return applied

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        """One transaction per request. Expected API errors (403, 409 …) still commit so that the
        audit row describing the refusal is kept; anything unexpected rolls back."""
        from .errors import ApiError

        conn = self._open()
        try:
            conn.execute("BEGIN")
            yield conn
            conn.execute("COMMIT")
        except ApiError:
            conn.execute("COMMIT")
            raise
        except BaseException:
            try:
                conn.execute("ROLLBACK")
            except sqlite3.Error:
                pass
            raise
        finally:
            conn.close()


def get_setting(conn: sqlite3.Connection, key: str, default: str | None = None) -> str | None:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row[0] if row else default


def set_setting(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))


def permission_revision(conn: sqlite3.Connection) -> int:
    return int(get_setting(conn, "permission_revision", "1") or 1)


def bump_permission_revision(conn: sqlite3.Connection) -> int:
    rev = permission_revision(conn) + 1
    set_setting(conn, "permission_revision", str(rev))
    return rev
