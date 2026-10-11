"""A test stand-in for CR-033 D2 (the `access_control_station` scope), used by the CR-036 S3/S4 tests.

CR-033 (origin/pilot/WXD-wave1, migration 0077, `rbac.station_chain`) owns the station scope. Until it is merged, this branch's
`bindings` table refuses the scope type and rbac knows no station chain. The S3 filter only ever calls
`rbac.authorize(conn, principal, permission, ("access_control_station", station_id))`, so the tests need exactly two things:

- a station binding: written as a REAL row when the database accepts the scope type (CR-033 merged); otherwise injected into
  `rbac._active_bindings` for that user only (an in-memory double - nothing of CR-033's code or migration is copied);
- a station chain: rbac's own when it has `station_chain` (CR-033 merged); otherwise `[(station), (site)?, installation]` from
  the placements the test declares.

Everything else - deny overrides, the role catalogue, inactive users, group bindings - is rbac's real code. After the merge the
same tests run against the real scope with no change; delete the double then.
"""
from __future__ import annotations

import sqlite3
from typing import Any

import pytest

from smplwise import rbac
from smplwise.db import Database, new_id, now_iso, permission_revision
from smplwise.services import intercom_authority as ia

STATION = ia.STATION_SCOPE


class StationScope:
    def __init__(self, monkeypatch: pytest.MonkeyPatch, settings: Any) -> None:
        self.settings = settings
        self.injected: dict[str, list[dict[str, Any]]] = {}
        self.placement: dict[str, list[tuple[str, str]]] = {}  # station id -> its ancestors below the installation (the double only)
        self.real = hasattr(rbac, "station_chain")
        if not self.real:
            original_bindings = rbac._active_bindings
            original_chain = rbac.scope_chain

            def bindings(conn: sqlite3.Connection, principal: rbac.Principal) -> list[Any]:
                return list(original_bindings(conn, principal)) + [dict(b) for b in self.injected.get(principal.user_id, [])]

            def chain(conn: sqlite3.Connection, target_type: str, target_id: str) -> list[tuple[str, str]]:
                if target_type != STATION:
                    return original_chain(conn, target_type, target_id)
                return [(STATION, target_id), *self.placement.get(target_id, []), rbac.INSTALLATION]

            monkeypatch.setattr(rbac, "_active_bindings", bindings)
            monkeypatch.setattr(rbac, "scope_chain", chain)

    def bind(self, user_id: str, role: str, station_id: str, effect: str = "allow") -> None:
        """A binding of `role` on one station for `user_id` (a dev principal's id is `dev-<name>`)."""
        db = Database(self.settings.db_path)
        with db.connection() as conn:
            try:
                conn.execute(
                    "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?)",
                    (new_id(), user_id, role, STATION, station_id, effect, permission_revision(conn), now_iso()),
                )
                return
            except sqlite3.IntegrityError:
                if self.real:
                    raise
        self.injected.setdefault(user_id, []).append({
            "id": new_id(), "subject_kind": "user", "subject_id": user_id, "role_id": role, "scope_type": STATION, "scope_id": station_id,
            "effect": effect, "permission_revision": 1, "assigned_by": "test", "created_at": now_iso(), "expires_at": None, "revoked_at": None,
        })

    def place(self, station_id: str, site_id: str, building_id: str | None = None) -> None:
        """A station placed under a site (and optionally one of its buildings): CR-033's own placement row once it is
        merged (its Settings card writes the same table), the double's chain before."""
        if self.real:
            db = Database(self.settings.db_path)
            with db.connection() as conn:
                conn.execute("INSERT INTO intercom_station_placement(config_entry_id, site_id, building_id, assigned_by, assigned_at, revision) VALUES (?,?,?,?,?,1)",
                             (station_id, site_id, building_id, "test", now_iso()))
            return
        self.placement[station_id] = ([("building", building_id)] if building_id else []) + [("site", site_id)]


@pytest.fixture()
def station_scope(monkeypatch: pytest.MonkeyPatch, settings: Any) -> StationScope:
    return StationScope(monkeypatch, settings)
