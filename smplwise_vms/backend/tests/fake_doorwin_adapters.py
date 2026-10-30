"""DOORWIN-295: the W0 fakes behind the product's typed seam (services/door_windows_engine.py), plus a test world for the product.

- `ProgramEngineAdapter` - `WindowEngine` (tier B) over `FakeProgramEngine` in its direct command form: the same three WisKey commands,
  the same refusals, the same lost answers. Nothing here reaches WisKey, Home Assistant, a station or a door.
- `ScriptedEmergencyEngine` - `EmergencyEngine` answering per door from a script (a list of outcomes per door, consumed per attempt), with
  a call log (instants included) for the E-1 / SR-3 assertions.
- `ProductWorld` - a FastAPI app on a temporary database with the door directory, the engines and the clock replaced, and helpers to seed
  people and bindings. `go_live=True` switches the permit AND `LIVE_ENGINE_BUILT` on INSIDE the test only (the fakes stand in for a built
  live engine); `go_live=False` leaves both constants exactly as shipped (DWFIX-295 / review 3 DW-08: permit True, engine not built).
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Any, Callable

from fake_doorwin_program import ACTION, LIST, SAVE, FakeEngineError, FakeOutcomeUnknown, FakeProgramEngine, FakeTransportDown

from smplwise.services import door_windows_engine as dwe

PRE_EFFECT = {"revision_conflict": "revision_conflict"}


class ProgramEngineAdapter:
    tier = "program"

    def __init__(self, fake: FakeProgramEngine) -> None:
        self.fake = fake
        self.calls: list[tuple[str, str, int]] = []

    def _do(self, command: str, **fields: Any) -> dict[str, Any]:
        try:
            return self.fake.command(command, **fields)
        except FakeEngineError as exc:
            raise dwe.EngineError(PRE_EFFECT.get(exc.code, "refused"), exc.code) from None
        except FakeOutcomeUnknown:
            raise dwe.EngineError("unknown", "answer_lost") from None
        except FakeTransportDown:
            raise dwe.EngineError("not_sent", "transport_down") from None

    @staticmethod
    def _find(listing: dict[str, Any], station_id: str, relay: int) -> dwe.ProgramState:
        for p in listing.get("programs", []):
            if p.get("station_id") == station_id and p.get("door") == relay:
                return dwe.program_state_of(p)
        return dwe.ProgramState(False)

    def read(self, station_id: str, relay: int) -> dwe.ProgramState:
        self.calls.append(("read", station_id, relay))
        return self._find(self._do(LIST, station_id=station_id), station_id, relay)

    def save(self, station_id: str, relay: int, revision: int, policy: dict[str, Any], enabled: bool) -> dwe.ProgramState:
        self.calls.append(("save", station_id, relay))
        return self._find(self._do(SAVE, station_id=station_id, door=relay, revision=revision, policy=policy, enabled=enabled), station_id, relay)

    def pause(self, station_id: str, relay: int, revision: int) -> dwe.ProgramState:
        self.calls.append(("pause", station_id, relay))
        return self._find(self._do(ACTION, station_id=station_id, door=relay, revision=revision, action="pause"), station_id, relay)


@dataclass
class ScriptedEmergencyEngine:
    """Per door ("station:relay") a list of outcomes, one per attempt (the last one repeats); default acknowledged."""

    now: Callable[[], dt.datetime] = lambda: dt.datetime.now(dt.timezone.utc)
    script: dict[str, list[str]] = field(default_factory=dict)
    release_script: dict[str, list[str]] = field(default_factory=dict)
    open_supported: bool = True
    lock_supported: bool = True
    simulated: bool = False
    calls: list[dict[str, Any]] = field(default_factory=list)

    def _answer(self, phase: str, kind: str, station_id: str, relay: int, request_id: str) -> dwe.DoorOutcome:
        key = f"{station_id}:{relay}"
        n = sum(1 for c in self.calls if c["door"] == key and c["phase"] == phase)
        seq = (self.script if phase == "apply" else self.release_script).get(key, ["acknowledged"])
        outcome = seq[min(n, len(seq) - 1)]
        self.calls.append({"at": self.now(), "phase": phase, "kind": kind, "door": key, "request_id": request_id, "outcome": outcome})
        if outcome == "raise_unknown":
            raise dwe.EngineError("unknown", "answer_lost")
        if outcome == "raise_refused":
            raise dwe.EngineError("refused", "device_busy")
        return dwe.DoorOutcome(outcome, "")

    def apply(self, kind: str, station_id: str, relay: int, request_id: str, reason: str) -> dwe.DoorOutcome:
        return self._answer("apply", kind, station_id, relay, request_id)

    def release(self, kind: str, station_id: str, relay: int, request_id: str) -> dwe.DoorOutcome:
        return self._answer("release", kind, station_id, relay, request_id)


# ---------------------------------------------------------------- the product world

API = "/api/v1"


class ProductWorld:
    """The app with the door-windows seams replaced. `world` (a W0 `DoorwinWorld`) provides the clock and the fake program engine;
    without one the clock is a plain list the test moves and the window engine is `prepared` (tier D)."""

    def __init__(self, settings: Any, monkeypatch: Any, *, world: Any = None, go_live: bool = True, start: dt.datetime | None = None) -> None:
        from fastapi.testclient import TestClient
        from fake_doorwin_world import DOCK, ENTRY, SIDE

        from smplwise.db import Database
        from smplwise.main import create_app
        from smplwise.routers import door_windows as router
        from smplwise.services import door_emergency as de
        from smplwise.services import door_windows as dw

        self.settings, self.world, self.dw, self.de = settings, world, dw, de
        self.ENTRY, self.SIDE, self.DOCK = ENTRY, SIDE, DOCK
        if go_live:
            monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", True)
            monkeypatch.setattr(dwe, "LIVE_ENGINE_BUILT", True)
        self.t = [start or dt.datetime(2026, 11, 2, 6, 0, tzinfo=dt.timezone.utc)]  # Monday 08:00 in Asia/Jerusalem (UTC+2 after 25.10)
        self.now = (lambda: world.clock.now()) if world is not None else (lambda: self.t[0])
        monkeypatch.setattr(router, "now_utc", self.now)
        monkeypatch.setattr(de, "now_utc", self.now)
        self.doors = [dw.Door(ENTRY, 1, "כניסה ראשית", "לובי", "Asia/Jerusalem"), dw.Door(SIDE, 1, "דלת צד", "חצר", "Asia/Jerusalem"),
                      dw.Door(DOCK, 1, "רציף 1", "מחסן", "Asia/Jerusalem"), dw.Door(DOCK, 2, "רציף 2", "מחסן", "Asia/Jerusalem")]
        monkeypatch.setattr(dw, "DOOR_DIRECTORY", lambda conn: list(self.doors))
        self.window_engine: Any = ProgramEngineAdapter(world.programs) if world is not None else dwe.PreparedEngine()
        monkeypatch.setattr(dwe, "WINDOW_ENGINE_FACTORY", lambda s: self.window_engine)
        self.emergency = ScriptedEmergencyEngine(now=self.now)
        monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_FACTORY", lambda s: self.emergency)
        monkeypatch.setattr(de, "DISPATCH_INLINE", True)
        de.reset_rate()
        self.c = TestClient(create_app(settings))
        self.c.get(f"{API}/me")  # joni bootstraps as system_admin
        self.db = Database(settings.db_path)

    # ---- people and bindings
    def bind(self, user: str, role: str, scope_type: str = "installation", scope_id: str = "*", effect: str = "allow") -> None:
        from conftest import as_user

        from smplwise.db import new_id, now_iso, permission_revision

        self.c.get(f"{API}/me", headers=as_user(user))
        with self.db.connection() as conn:
            conn.execute("""INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at)
                            VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?)""", (new_id(), f"dev-{user}", role, scope_type, scope_id, effect, permission_revision(conn), now_iso()))

    def role(self, name: str, sensitive: list[str], permissions: list[str] | None = None) -> str:
        r = self.c.post(f"{API}/access/roles", json={"name": name, "description": "doorwin test", "permissions": permissions or ["access.read", "access.stations.read"],
                                                     "sensitive": sensitive})
        assert r.status_code == 201, r.text
        return r.json()["id"]

    def place(self, station_id: str, site_id: str, building_id: str | None = None) -> None:
        from smplwise.db import now_iso

        with self.db.connection() as conn:
            conn.execute("INSERT INTO intercom_station_placement(config_entry_id, site_id, building_id, assigned_by, assigned_at, revision) VALUES (?,?,?,?,?,1)",
                         (station_id, site_id, building_id, "test", now_iso()))

    # ---- HTTP
    def call(self, method: str, path: str, user: str | None = None, **body: Any):
        from conftest import as_user

        kwargs: dict[str, Any] = {"headers": as_user(user)} if user else {}
        if method in ("POST", "PUT", "PATCH"):
            kwargs["json"] = body
        return self.c.request(method, f"{API}{path}", **kwargs)

    def get(self, path: str, user: str | None = None):
        return self.call("GET", path, user)

    def post(self, path: str, user: str | None = None, **body: Any):
        return self.call("POST", path, user, **body)

    def put(self, path: str, user: str | None = None, **body: Any):
        return self.call("PUT", path, user, **body)

    # ---- windows
    def windows_on(self) -> None:
        r = self.put("/doors/windows/settings", changes={"doors.windows.enabled": "on"}, confirmed=True)
        assert r.status_code == 200, r.text

    def rule(self, *, doors: list[tuple[str, int]] | None = None, periods: list[dict[str, Any]] | None = None, kind: str = "weekly", enable: bool = True,
             user: str | None = None, name: str = "פתיחת בוקר", **extra: Any):
        return self.post("/doors/windows/rules", user, name=name, kind=kind, doors=[{"station_id": s, "relay": r} for s, r in (doors or [(self.ENTRY, 1)])],
                         periods=periods or [{"weekday": d, "start": "08:00", "end": "11:00"} for d in range(0, 5)], enable=enable, confirmed=True, **extra)

    def sync(self) -> dict[str, Any]:
        return self.dw.sync(self.db, self.settings, self.now())

    def watch(self) -> dict[str, Any]:
        from smplwise.services import door_windows_watch as dww

        return dww.watch(self.db, self.settings, self.now())

    def occurrences(self, **where: Any) -> list[dict[str, Any]]:
        sql = "SELECT * FROM door_window_occurrences" + (" WHERE " + " AND ".join(f"{k} = ?" for k in where) if where else "") + " ORDER BY start_at"
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute(sql, tuple(where.values())).fetchall()]

    def rows(self, sql: str, *args: Any) -> list[dict[str, Any]]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute(sql, args).fetchall()]

    def audit_actions(self, prefix: str = "door.") -> list[str]:
        return [r["action"] for r in self.rows("SELECT action FROM audit_log WHERE action LIKE ? ORDER BY id", prefix + "%")]

    # ---- emergency
    def emergency_on(self) -> None:
        r = self.put("/doors/emergency/settings", changes={"doors.emergency.enabled": "on"}, confirmed=True)
        assert r.status_code == 200, r.text

    def press(self, kind: str = "lock_secure", user: str | None = None, *, scope_type: str = "installation", scope_id: str = "*", drill: bool = False,
              reason: str = "") -> Any:
        import uuid

        p = self.post("/doors/emergency/prepare", user, action="start", kind=kind, scope_type=scope_type, scope_id=scope_id, drill=drill)
        if p.status_code != 200:
            return p
        return self.post("/doors/emergency/incidents", user, confirm_token=p.json()["confirm_token"], confirmed=True, reason=reason,
                         client_request_id=str(uuid.uuid4()))

    def release(self, incident_id: str, kind: str = "lock_secure", user: str | None = None, *, drill: bool = False) -> Any:
        import uuid

        p = self.post("/doors/emergency/prepare", user, action="release", kind=kind, incident_id=incident_id, drill=drill)
        if p.status_code != 200:
            return p
        return self.post(f"/doors/emergency/incidents/{incident_id}/release", user, confirm_token=p.json()["confirm_token"], confirmed=True,
                         client_request_id=str(uuid.uuid4()))