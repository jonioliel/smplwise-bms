"""A small world for the CR-018 source tests (S2): a floor-2 camera, entities placed on floor 2 or nowhere, users with different reach, a fake clock
for the pipeline, a fake push service and helpers to push HA states, run the monitor pass, flush the outbox and read the inbox as a user."""
from __future__ import annotations

import datetime as dt
import json
from typing import Any

import httpx
import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from test_push import Browser, FakePushService

from smplwise.main import create_app
from smplwise.services import notify, notify_channels, notify_sensors, notify_sources
from smplwise.services import push as svc

API = "/api/v1"
NOW = dt.datetime(2026, 10, 1, 9, 0, tzinfo=dt.timezone.utc)  # 12:00 in Asia/Jerusalem (quiet hours are 22:00-07:00 by default... and off in the S1 migration)


class Clock:
    def __init__(self, at: dt.datetime) -> None:
        self.now = at

    def __call__(self) -> dt.datetime:
        return self.now

    def advance(self, **kw: float) -> dt.datetime:
        self.now = self.now + dt.timedelta(**kw)
        return self.now


@pytest.fixture()
def clock(monkeypatch) -> Clock:
    c = Clock(NOW)
    monkeypatch.setattr(notify, "now_utc", c)
    notify_sources.reset()
    yield c
    notify_sources.reset()


@pytest.fixture()
def fake_push(monkeypatch):
    fake = FakePushService()
    monkeypatch.setattr(svc, "TRANSPORT", httpx.MockTransport(fake.handler))
    monkeypatch.setattr(svc, "BACKOFF_S", (0.0, 0.0, 0.0))
    svc.reset_limits()
    yield fake
    svc.NOTIFIER.shutdown()
    svc.reset_limits()


def iso(t: dt.datetime) -> str:
    return t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class World:
    """joni = system administrator (holds notify.manage, sees everything); ops2 = operator on floor 2; ops3 = operator on floor 3; vera = viewer
    (installation scope); nobody = a user with no binding at all."""

    def __init__(self, settings, clock: Clock) -> None:
        self.settings = settings
        self.clock = clock
        self.app = create_app(settings)
        self.c = TestClient(self.app)
        self.db = self.app.state.db
        self.ids = seed_tree(self.c)
        self.cam = self.c.post(f"{API}/cameras", json={"channel": 1, "alias": "לובי"}).json()["id"]
        for f in (self.ids["floor2"], self.ids["floor3"]):
            asset = self.c.post(f"{API}/floors/{f}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
            v = self.c.post(f"{API}/floors/{f}/plan-versions", json={"asset_id": asset["id"]}).json()
            self.c.post(f"{API}/plan-versions/{v['id']}/publish")
        assert self.c.post(f"{API}/floors/{self.ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": self.cam, "x": 0.3, "y": 0.3}).status_code in (200, 201)
        bind(self.c, settings, "ops2", "operator", "floor", self.ids["floor2"])
        bind(self.c, settings, "ops3", "operator", "floor", self.ids["floor3"])
        bind(self.c, settings, "vera", "viewer", "installation", "*")
        self.c.get(f"{API}/me", headers=as_user("nobody"))
        self.browsers: dict[str, Browser] = {}

    # -- entities (the mirror of Home Assistant)
    def entity(self, entity_id: str, cls: str | None = None, state: str = "off", area: str | None = "kitchen", name: str | None = None, floor: str | None = None,
               changed: dt.datetime | None = None, hidden: int = 0, attrs: dict[str, Any] | None = None) -> str:
        domain = entity_id.split(".", 1)[0]
        stamp = iso(changed or self.clock.now)
        with self.db.connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO ha_entities(entity_id, area_id, area_name, name, domain, device_class, state, attributes_json, last_changed, state_seen_at, available, hidden, first_seen_at, updated_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?,?)",
                (entity_id, area, "מטבח" if area else None, name or entity_id, domain, cls, state, json.dumps(attrs or {}), stamp, stamp, hidden, stamp, stamp),
            )
        if floor:
            r = self.c.post(f"{API}/floors/{floor}/anchors", json={"resource_type": "ha_entity", "resource_id": entity_id, "x": 0.2, "y": 0.2})
            assert r.status_code == 201, r.text
        return entity_id

    def set_state(self, entity_id: str, state: str, changed: dt.datetime | None = None) -> None:
        with self.db.connection() as conn:
            conn.execute("UPDATE ha_entities SET state = ?, last_changed = ?, state_seen_at = ? WHERE entity_id = ?", (state, iso(changed or self.clock.now), iso(self.clock.now), entity_id))

    def push(self, entity_id: str, old: str | None, new: str, cls: str | None = None, ha_connected: bool = True, **attrs: Any) -> None:
        """A state_changed push through the real hook (inside a transaction, like services/ha_sync.handle_state_event)."""
        a = {"device_class": cls, **attrs} if cls else dict(attrs)
        old_state = {"entity_id": entity_id, "state": old, "attributes": a} if old is not None else None
        new_state = {"entity_id": entity_id, "state": new, "attributes": a}
        self.set_state(entity_id, new)
        with self.db.connection() as conn:
            notify_sensors.on_state(conn, old_state, new_state, ha_connected, self.clock.now)

    # -- the pipeline
    def tick(self, **kw: Any) -> dict[str, Any]:
        return notify_sources.tick(self.db, self.settings, self.clock.now)

    def scan(self, ha_connected: bool = True) -> dict[str, Any]:
        with self.db.connection() as conn:
            return notify_sensors.scan(conn, ha_connected, self.clock.now)

    def emit(self, source: str, kind: str, subject: str | None, **kw: Any):
        with self.db.connection() as conn:
            return notify.emit_full(conn, notify.Signal(source, kind, subject, **kw))

    def flush(self) -> int:
        return notify_channels.process_outbox_now(self.db)

    def rows(self, source: str | None = None, state: str | None = None) -> list[dict[str, Any]]:
        with self.db.connection(mode="read") as conn:
            sql, args = "SELECT * FROM notifications", []
            where = []
            if source:
                where.append("source = ?")
                args.append(source)
            if state == "open":
                where.append("state != 'resolved'")
            elif state:
                where.append("state = ?")
                args.append(state)
            rows = conn.execute(sql + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY first_at, id", args).fetchall()
            return [dict(r) for r in rows]

    def one(self, source: str, state: str | None = None) -> dict[str, Any]:
        rows = self.rows(source, state)
        assert len(rows) == 1, f"{source}: {len(rows)} rows: {[(r['state'], r['dedupe_key']) for r in rows]}"
        return rows[0]

    def recipients(self, nid: str) -> set[str]:
        with self.db.connection(mode="read") as conn:
            return {r[0].removeprefix("dev-") for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (nid,)).fetchall()}

    def deliveries(self, nid: str | None = None) -> list[dict[str, Any]]:
        with self.db.connection(mode="read") as conn:
            sql = "SELECT * FROM notification_deliveries" + (" WHERE notification_id = ?" if nid else "") + " ORDER BY created_at, id"
            return [dict(r) for r in conn.execute(sql, (nid,) if nid else ()).fetchall()]

    def inbox(self, user: str = "joni", **params: Any) -> list[dict[str, Any]]:
        r = self.c.get(f"{API}/notifications", params=params, headers=as_user(user))
        assert r.status_code == 200, r.text
        return r.json()["notifications"]

    def set_policy(self, source: str, **body: Any) -> dict[str, Any]:
        r = self.c.put(f"{API}/notify/policies/{source}", json=body)
        assert r.status_code == 200, r.text
        return r.json()

    def set_settings(self, **body: Any) -> dict[str, Any]:
        r = self.c.put(f"{API}/notify/settings", json=body)
        assert r.status_code == 200, r.text
        return r.json()

    def subscribe(self, *users: str) -> None:
        for u in users:
            b = self.browsers[u] = Browser(u)
            assert self.c.post(f"{API}/push/subscriptions", json=b.body(), headers=as_user(u)).status_code == 201

    def camera_status(self, status: str, last_seen: dt.datetime | None = None) -> None:
        with self.db.connection() as conn:
            conn.execute("UPDATE cameras SET status = ?, last_seen_at = ? WHERE id = ?", (status, iso(last_seen or self.clock.now), self.cam))

    def event(self, etype: str, raw: str, state: str = "active", at: dt.datetime | None = None, camera: str | None = None, ended: dt.datetime | None = None) -> str:
        eid = f"ev{abs(hash((etype, raw, state, at, camera))) % 10**9}"
        with self.db.connection() as conn:
            conn.execute(
                "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,1,'critical','measured','{}',?,?)",
                (eid, "alertstream", raw, etype, camera, 1 if camera else None, iso(at or self.clock.now), iso(ended) if ended else None, iso(self.clock.now), state, eid, iso(self.clock.now)),
            )
        return eid
